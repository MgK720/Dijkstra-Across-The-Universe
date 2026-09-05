import test from 'node:test';
import assert from 'node:assert/strict';
import { generateUniverse, weight } from '../src/simulation/universe.js';
import { Dijkstra, MinHeap } from '../src/simulation/dijkstra.js';
const u = generateUniverse('84729153');
function reference(u, start, mode) {
  const d = new Array(u.nodes.length).fill(Infinity);
  d[start] = 0;
  for (let i = 0; i < u.nodes.length - 1; i++) {
    let changed = false;
    for (const e of u.edges) {
      const w = weight(e, mode);
      if (d[e.a] + w < d[e.b]) {
        d[e.b] = d[e.a] + w;
        changed = true;
      }
      if (d[e.b] + w < d[e.a]) {
        d[e.a] = d[e.b] + w;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return d;
}
test('binary heap is stable by cost then node id', () => {
  const h = new MinHeap();
  for (const id of [8, 3, 4, 0, 9]) h.push({ id, cost: id % 3 });
  const out = [];
  while (h.size) out.push(h.pop().id);
  assert.deepEqual(out, [0, 3, 9, 4, 8]);
});
test('all profiles have finite strictly positive weights', () => {
  for (const mode of ['fastest', 'safest', 'energy'])
    for (const e of u.edges)
      assert.ok(Number.isFinite(weight(e, mode)) && weight(e, mode) > 0);
});
test('Sol and Earth exist; entire network and default target are reachable', () => {
  assert.equal(u.nodes[0].name, 'Sol');
  assert.ok(u.nodes[0].planets.some((p) => p.name === 'Earth'));
  const d = reference(u, 0, 'fastest');
  assert.ok(d.every(Number.isFinite));
  assert.ok(u.nodes[u.target].similarity >= 0.9);
});
test('same seed reproduces exact stars, planets, edges, weights and mission', () =>
  assert.deepEqual(generateUniverse(u.seed), u));
test('new seeds change graph topology, positions, planets and mission', () => {
  const v = generateUniverse('new-seed');
  assert.notDeepEqual(
    v.edges.map((e) => [e.a, e.b]),
    u.edges.map((e) => [e.a, e.b]),
  );
  assert.notDeepEqual(v.stars, u.stars);
  assert.notDeepEqual(v.nodes[1].planets, u.nodes[1].planets);
});
test('Dijkstra equals independent Bellman-Ford for every cost profile', () => {
  for (const mode of ['fastest', 'safest', 'energy']) {
    const e = new Dijkstra(u, 0, u.target, mode).run(),
      d = reference(u, 0, mode);
    assert.ok(e.found);
    assert.ok(Math.abs(e.dist[e.target] - d[e.target]) < 1e-8);
    for (let i = 0; i < u.nodes.length; i++)
      if (e.status[i] === 2) assert.ok(Math.abs(e.dist[i] - d[i]) < 1e-8);
  }
});
test('predecessors reconstruct a valid path whose summed weight is final cost', () => {
  const e = new Dijkstra(u).run(),
    path = e.path();
  assert.equal(path[0], 0);
  assert.equal(path.at(-1), u.target);
  assert.equal(new Set(path).size, path.length);
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const edge = u.edges[e.prevEdge[path[i]]];
    assert.ok([edge.a, edge.b].includes(path[i - 1]));
    assert.ok([edge.a, edge.b].includes(path[i]));
    cost += weight(edge, e.mode);
  }
  assert.ok(Math.abs(cost - e.dist[e.target]) < 1e-8);
});
test('RESET reproduces result without mutating universe', () => {
  const before = JSON.stringify(u),
    a = new Dijkstra(u).run(),
    b = new Dijkstra(u).run();
  assert.deepEqual(a.path(), b.path());
  assert.equal(a.dist[a.target], b.dist[b.target]);
  assert.equal(JSON.stringify(u), before);
});
test('STEP settles exactly one node, records discovery and performs real relaxations', () => {
  const e = new Dijkstra(u);
  assert.deepEqual(e.path(), []);
  for (let i = 0; i < 20 && !e.done; i++) {
    const visited = e.visited,
      steps = e.steps;
    assert.ok(e.step());
    assert.equal(e.visited, visited + 1);
    assert.equal(e.steps, steps + 1);
    assert.equal(e.settled[e.current], e.steps);
    for (const ev of e.events) {
      assert.equal(e.prev[ev.node], e.current);
      assert.ok(e.discovered[ev.node] >= 0);
    }
  }
});
test('WARP batching produces identical result and counters', () => {
  const a = new Dijkstra(u),
    b = new Dijkstra(u);
  while (!a.done) a.step();
  while (!b.done) b.run(80);
  assert.deepEqual(a.path(), b.path());
  assert.deepEqual(a.dist, b.dist);
  assert.equal(a.relaxations, b.relaxations);
  assert.equal(a.visited, b.visited);
});
test('cost profiles can change the optimal route', () => {
  const paths = ['fastest', 'safest', 'energy'].map((mode) =>
    new Dijkstra(u, 0, u.target, mode).run().path().join(','),
  );
  assert.ok(new Set(paths).size > 1);
});
test('start = target is a zero-cost one-node route', () => {
  const e = new Dijkstra(u, 4, 4).run();
  assert.deepEqual(e.path(), [4]);
  assert.equal(e.dist[4], 0);
  assert.equal(e.steps, 1);
});
test('unreachable target terminates with no fabricated route', () => {
  const isolated = {
    nodes: [
      { id: 0, lanes: [] },
      { id: 1, lanes: [] },
    ],
    edges: [],
    start: 0,
    target: 1,
  };
  const e = new Dijkstra(isolated).run();
  assert.equal(e.found, false);
  assert.equal(e.done, true);
  assert.deepEqual(e.path(), []);
});
test('twenty different universes have reachable nontrivial correct missions', () => {
  for (let i = 0; i < 20; i++) {
    const v = generateUniverse('audit-' + i),
      e = new Dijkstra(v).run();
    assert.ok(e.found);
    assert.ok(e.path().length >= 2);
    assert.ok(
      Math.abs(e.dist[e.target] - reference(v, 0, 'fastest')[e.target]) < 1e-8,
    );
  }
});
