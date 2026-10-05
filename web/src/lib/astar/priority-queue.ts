/**
 * Binary min-heap with the same ordering as Python's `queue.PriorityQueue`
 * holding `[f, insert_order, node]` lists: compare by f, then by insert order
 * (insert orders are unique, so the node itself is never compared).
 */
export interface QueueItem<T> {
  f: number;
  order: number;
  value: T;
}

const less = <T>(a: QueueItem<T>, b: QueueItem<T>) =>
  a.f < b.f || (a.f === b.f && a.order < b.order);

export class PriorityQueue<T> {
  private heap: QueueItem<T>[] = [];

  get size(): number {
    return this.heap.length;
  }

  empty(): boolean {
    return this.heap.length === 0;
  }

  put(item: QueueItem<T>): void {
    const h = this.heap;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!less(h[i], h[parent])) break;
      [h[i], h[parent]] = [h[parent], h[i]];
      i = parent;
    }
  }

  get(): QueueItem<T> {
    const h = this.heap;
    if (h.length === 0) throw new Error("get() from an empty priority queue");
    const top = h[0];
    const last = h.pop()!;
    if (h.length > 0) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && less(h[l], h[m])) m = l;
        if (r < h.length && less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }
}
