// All simulation randomness lives here. Rendering never consumes this stream.
export function random(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const freshSeed = () =>
  String(crypto.getRandomValues(new Uint32Array(1))[0]);
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function weight(edge, mode = 'fastest') {
  if (mode === 'safest')
    return edge.length * (0.06 + edge.risk * 5 + (1 - edge.stability) * 2);
  if (mode === 'energy') return edge.energy * (1 + edge.interference * 2);
  return (edge.time * (1 + edge.congestion * 1.4)) / edge.stability;
}
const syllables = [
  'Aster',
  'Vela',
  'Kepler',
  'Orion',
  'Lyra',
  'Nacre',
  'Cygnus',
  'Eos',
  'Tethys',
  'Aurelia',
  'Sagan',
  'Halley',
  'Nereid',
  'Altair',
  'Caelum',
  'Elara',
];
export function generateUniverse(seed) {
  const r = random(seed),
    normal = () =>
      Math.sqrt(-2 * Math.log(Math.max(r(), 1e-9))) *
      Math.cos(2 * Math.PI * r());
  const armCount = 3 + Math.floor(r() * 3),
    twist = 3.2 + r() * 3,
    phase = r() * Math.PI * 2;
  const regions = [],
    nodes = [],
    edges = [],
    stars = [],
    edgeKeys = new Set();
  const regionCount = 25 + Math.floor(r() * 10);
  function spiral(radius, arm, spread = 1) {
    const theta =
      phase + (arm / armCount) * Math.PI * 2 + (radius / 260) * twist;
    return {
      x: Math.cos(theta) * radius + normal() * spread,
      y: normal() * (5 + spread * 0.28),
      z: Math.sin(theta) * radius + normal() * spread,
    };
  }
  for (let i = 0; i < 12000; i++) {
    const radius = Math.pow(r(), 0.66) * 290;
    const p =
      i < 1800
        ? { x: normal() * 24, y: normal() * 8, z: normal() * 24 }
        : spiral(radius, Math.floor(r() * armCount), 5 + radius * 0.035);
    stars.push({ ...p, size: 0.5 + r() * 2, warmth: r() });
  }
  for (let i = 0; i < regionCount; i++) {
    const p = spiral(45 + Math.pow(r(), 0.8) * 215, i % armCount, 13);
    const region = {
      ...p,
      id: i,
      name:
        syllables[i % syllables.length] + ' ' + String(i + 1).padStart(2, '0'),
      nodes: [],
    };
    regions.push(region);
    const count = 18 + Math.floor(r() * 15),
      spread = 8 + r() * 13;
    for (let j = 0; j < count; j++) {
      const id = nodes.length;
      const planets = Array.from(
        { length: 1 + Math.floor(r() * 8) },
        (_, k) => ({
          name: String.fromCharCode(98 + k),
          temperature: 140 + r() * 380,
          similarity: r(),
          radius: 0.5 + r() * 2,
          phase: r() * Math.PI * 2,
        }),
      );
      const best = planets.reduce((a, b) =>
        a.similarity > b.similarity ? a : b,
      );
      const node = {
        id,
        region: i,
        name: syllables[Math.floor(r() * syllables.length)] + ' ' + (100 + id),
        x: p.x + normal() * spread,
        y: p.y + normal() * spread * 0.4,
        z: p.z + normal() * spread,
        starType: [
          'G · Yellow dwarf',
          'K · Orange dwarf',
          'M · Red dwarf',
          'F · White star',
          'B · Blue giant',
        ][Math.floor(r() * 5)],
        planets,
        similarity: best.similarity,
        temperature: best.temperature,
        habitable: best.similarity > 0.8,
        lanes: [],
        hub: j === 0,
      };
      nodes.push(node);
      region.nodes.push(id);
    }
  }
  function add(a, b, kind = 'local') {
    if (a === b) return;
    const key = [Math.min(a, b), Math.max(a, b)].join(':');
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    const length = Math.max(0.01, distance(nodes[a], nodes[b]));
    const edge = {
      id: edges.length,
      a,
      b,
      kind,
      length,
      time: length * (0.5 + r() * 1.3) * (kind === 'corridor' ? 0.3 : 1),
      energy: length * (0.3 + r() * 2),
      stability: 0.35 + r() * 0.65,
      risk: 0.02 + r() * 0.98,
      interference: r(),
      congestion: r(),
      bend: (r() - 0.5) * 0.45,
    };
    edges.push(edge);
    nodes[a].lanes.push(edge.id);
    nodes[b].lanes.push(edge.id);
  }
  // Euclidean Prim trees guarantee connected local infrastructure; short chords add alternatives.
  for (const region of regions) {
    const connected = new Set([region.nodes[0]]);
    while (connected.size < region.nodes.length) {
      let best = Infinity,
        a,
        b;
      for (const u of connected)
        for (const v of region.nodes)
          if (!connected.has(v)) {
            const d = distance(nodes[u], nodes[v]);
            if (d < best) {
              best = d;
              a = u;
              b = v;
            }
          }
      add(a, b);
      connected.add(b);
    }
    for (const u of region.nodes) {
      if (r() < 0.16) continue; // Preserve some terminal branches.
      const near = region.nodes
        .filter((v) => v !== u)
        .sort(
          (a, b) => distance(nodes[u], nodes[a]) - distance(nodes[u], nodes[b]),
        );
      for (const v of near.slice(0, 2 + Math.floor(r() * 2))) add(u, v);
    }
    for (const v of region.nodes.slice(1))
      if (r() < 0.1) add(region.nodes[0], v, 'hub');
  }
  function bridge(a, b, kind = 'regional') {
    let best = Infinity,
      u,
      v;
    for (const x of regions[a].nodes)
      for (const y of regions[b].nodes) {
        const d = distance(nodes[x], nodes[y]);
        if (d < best) {
          best = d;
          u = x;
          v = y;
        }
      }
    add(u, v, kind);
  }
  const connected = new Set([0]);
  while (connected.size < regions.length) {
    let best = Infinity,
      a,
      b;
    for (const u of connected)
      for (const v of regions)
        if (!connected.has(v.id)) {
          const d = distance(regions[u], v);
          if (d < best) {
            best = d;
            a = u;
            b = v.id;
          }
        }
    bridge(a, b);
    connected.add(b);
  }
  for (const region of regions)
    if (r() < 0.3) {
      const nearest = regions
        .filter((x) => x.id !== region.id)
        .sort((a, b) => distance(region, a) - distance(region, b));
      bridge(region.id, nearest[1].id);
    }
  for (let i = 0; i < 2 + Math.floor(r() * 3); i++) {
    const a = Math.floor(r() * regions.length),
      b = (a + Math.floor(regions.length / 2) + i) % regions.length;
    add(regions[a].nodes[0], regions[b].nodes[0], 'corridor');
  }
  const sol = nodes[0];
  sol.name = 'Sol';
  sol.starType = 'G2V · Yellow dwarf';
  sol.similarity = 1;
  sol.habitable = true;
  sol.planets = [
    {
      name: 'Mercury',
      temperature: 440,
      similarity: 0.2,
      radius: 0.38,
      phase: 0,
    },
    {
      name: 'Venus',
      temperature: 737,
      similarity: 0.4,
      radius: 0.95,
      phase: 1,
    },
    { name: 'Earth', temperature: 288, similarity: 1, radius: 1, phase: 2 },
    {
      name: 'Mars',
      temperature: 210,
      similarity: 0.64,
      radius: 0.53,
      phase: 3,
    },
    {
      name: 'Jupiter',
      temperature: 165,
      similarity: 0.1,
      radius: 2.4,
      phase: 4,
    },
    { name: 'Saturn', temperature: 134, similarity: 0.1, radius: 2, phase: 5 },
    { name: 'Uranus', temperature: 76, similarity: 0.1, radius: 1.7, phase: 6 },
    {
      name: 'Neptune',
      temperature: 72,
      similarity: 0.1,
      radius: 1.6,
      phase: 7,
    },
  ];
  sol.temperature = 288;
  // Unweighted reachability is only mission selection, never a precomputed optimal route.
  const hops = Array.from({ length: nodes.length }, () => Infinity);
  hops[0] = 0;
  const queue = [0];
  for (let k = 0; k < queue.length; k++)
    for (const eId of nodes[queue[k]].lanes) {
      const e = edges[eId],
        v = e.a === queue[k] ? e.b : e.a;
      if (!Number.isFinite(hops[v])) {
        hops[v] = hops[queue[k]] + 1;
        queue.push(v);
      }
    }
  let candidates = nodes.filter(
    (n) =>
      n.region !== 0 &&
      distance(sol, n) >= 80 &&
      n.similarity >= 0.92 &&
      hops[n.id] >= 8 &&
      hops[n.id] <= 40,
  );
  if (!candidates.length)
    candidates = nodes.filter(
      (n) => n.id !== 0 && n.similarity >= 0.9 && Number.isFinite(hops[n.id]),
    );
  if (!candidates.length) {
    const n = nodes[queue[queue.length - 1]];
    n.planets[0].similarity = 0.96;
    n.similarity = 0.96;
    n.habitable = true;
    candidates = [n];
  }
  candidates.sort(
    (a, b) =>
      distance(sol, a) - distance(sol, b) || b.similarity - a.similarity,
  );
  // Active systems are a subset of the 12,000 unique stars, also rendered in a state-aware batch.
  for (const n of nodes)
    Object.assign(stars[stars.length - 1 - n.id], { x: n.x, y: n.y, z: n.z });
  return {
    seed: String(seed),
    stars,
    nodes,
    edges,
    regions,
    target: candidates[0].id,
    start: 0,
    armCount,
  };
}
