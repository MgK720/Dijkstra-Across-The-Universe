import { weight } from './universe.js';
export class MinHeap {
  items = [];
  get size() {
    return this.items.length;
  }
  less(a, b) {
    return a.cost < b.cost || (a.cost === b.cost && a.id < b.id);
  }
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    if (!a.length) return null;
    const top = a[0],
      last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        let j = i;
        const l = i * 2 + 1;
        if (l < a.length && this.less(a[l], a[j])) j = l;
        if (l + 1 < a.length && this.less(a[l + 1], a[j])) j = l + 1;
        if (i === j) break;
        [a[i], a[j]] = [a[j], a[i]];
        i = j;
      }
    }
    return top;
  }
}
export class Dijkstra {
  constructor(
    universe,
    start = universe.start,
    target = universe.target,
    mode = 'fastest',
  ) {
    this.universe = universe;
    this.start = start;
    this.target = target;
    this.mode = mode;
    const n = universe.nodes.length;
    this.dist = new Float64Array(n).fill(Infinity);
    this.prev = new Int32Array(n).fill(-1);
    this.prevEdge = new Int32Array(n).fill(-1);
    this.status = new Uint8Array(n);
    this.discovered = new Int32Array(n).fill(-1);
    this.settled = new Int32Array(n).fill(-1);
    this.heap = new MinHeap();
    this.steps = 0;
    this.visited = 0;
    this.relaxations = 0;
    this.improvements = 0;
    this.current = -1;
    this.done = false;
    this.found = false;
    this.elapsed = 0;
    this.events = [];
    this.dist[start] = 0;
    this.status[start] = 1;
    this.discovered[start] = 0;
    this.heap.push({ id: start, cost: 0 });
  }
  // One step = one permanent settlement and every outgoing relaxation, skipping stale heap entries.
  step() {
    if (this.done) return false;
    const begin = performance.now();
    this.events = [];
    let item;
    while (this.heap.size) {
      const next = this.heap.pop();
      if (this.status[next.id] !== 2 && next.cost === this.dist[next.id]) {
        item = next;
        break;
      }
    }
    if (!item) {
      this.done = true;
      this.elapsed += performance.now() - begin;
      return false;
    }
    const u = item.id;
    this.current = u;
    this.steps++;
    this.visited++;
    this.status[u] = 2;
    this.settled[u] = this.steps;
    if (u === this.target) {
      this.done = true;
      this.found = true;
    } else
      for (const eId of this.universe.nodes[u].lanes) {
        const e = this.universe.edges[eId],
          v = e.a === u ? e.b : e.a;
        if (this.status[v] === 2) continue;
        this.relaxations++;
        const candidate = this.dist[u] + weight(e, this.mode);
        if (candidate < this.dist[v]) {
          const old = this.prevEdge[v];
          this.events.push({ edge: eId, node: v, old, improved: old !== -1 });
          this.improvements++;
          this.dist[v] = candidate;
          this.prev[v] = u;
          this.prevEdge[v] = eId;
          if (this.discovered[v] === -1) this.discovered[v] = this.steps;
          this.status[v] = 1;
          this.heap.push({ id: v, cost: candidate });
        }
      }
    this.elapsed += performance.now() - begin;
    return true;
  }
  run(budget = Infinity) {
    let i = 0;
    while (!this.done && i++ < budget) this.step();
    return this;
  }
  get frontier() {
    let n = 0;
    for (const s of this.status) if (s === 1) n++;
    return n;
  }
  next(count = 5) {
    return Array.from(this.status.entries())
      .filter(([, s]) => s === 1)
      .map(([id]) => ({ id, cost: this.dist[id], predecessor: this.prev[id] }))
      .sort((a, b) => a.cost - b.cost || a.id - b.id)
      .slice(0, count);
  }
  path() {
    if (!this.found) return [];
    const result = [];
    let u = this.target;
    while (u !== -1) {
      result.push(u);
      if (u === this.start) break;
      u = this.prev[u];
      if (result.length > this.status.length)
        throw new Error('Invalid predecessor chain');
    }
    return result.reverse();
  }
}
