/**
 * Auto layout for workflow graphs
 * Top-to-bottom layered layout: each node sits one row below its deepest parent,
 * children are centered under their parents and rows never overlap.
 */

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
  x: number;
  /** Source handle ids in display order (e.g. classifier categories), used to order branches */
  handleOrder?: string[];
}

export interface LayoutEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface LayoutOptions {
  horizontalGap?: number;
  verticalGap?: number;
}

export type LayoutPositions = Record<string, { x: number; y: number }>;

export const computeLayeredLayout = (
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  { horizontalGap = 64, verticalGap = 96 }: LayoutOptions = {},
): LayoutPositions => {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const validEdges = edges.filter(e => byId.has(e.source) && byId.has(e.target) && e.source !== e.target);
  const parents = new Map<string, LayoutEdge[]>(nodes.map(n => [n.id, []]));
  const children = new Map<string, string[]>(nodes.map(n => [n.id, []]));
  const inDegree = new Map<string, number>(nodes.map(n => [n.id, 0]));
  validEdges.forEach(e => {
    parents.get(e.target)!.push(e);
    children.get(e.source)!.push(e.target);
    inDegree.set(e.target, inDegree.get(e.target)! + 1);
  });

  // 1. Assign rows by longest path from the roots (Kahn's algorithm)
  const layer = new Map<string, number>();
  const queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
  queue.forEach(id => layer.set(id, 0));
  const remaining = new Map(inDegree);
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of children.get(id)!) {
      layer.set(child, Math.max(layer.get(child) ?? 0, layer.get(id)! + 1));
      remaining.set(child, remaining.get(child)! - 1);
      if (remaining.get(child) === 0) queue.push(child);
    }
  }
  // Nodes inside cycles never reach in-degree 0: put them below everything else
  const maxLayer = Math.max(0, ...layer.values());
  nodes.forEach(n => {
    if (!layer.has(n.id)) layer.set(n.id, maxLayer + 1);
  });

  const rows: string[][] = [];
  nodes.forEach(n => {
    const l = layer.get(n.id)!;
    (rows[l] ||= []).push(n.id);
  });

  // 2. Order nodes in each row by the position of their parents (and branch order)
  const order = new Map<string, number>();
  const centers = new Map<string, number>();
  const positions: LayoutPositions = {};
  let y = 0;

  rows.forEach((row = [], rowIndex) => {
    const sortKey = (id: string): number => {
      const incoming = parents.get(id)!.filter(e => order.has(e.source));
      if (rowIndex === 0 || incoming.length === 0) return byId.get(id)!.x;
      const keys = incoming.map(e => {
        const handles = byId.get(e.source)!.handleOrder ?? [];
        const handleIndex = e.sourceHandle ? handles.indexOf(e.sourceHandle) : -1;
        const fraction = handleIndex >= 0 ? (handleIndex + 1) / (handles.length + 1) : 0.5;
        return order.get(e.source)! + fraction;
      });
      return keys.reduce((a, b) => a + b, 0) / keys.length;
    };
    const keyed = row.map(id => ({ id, key: sortKey(id) }));
    // Roots keep their left-to-right order on the canvas; other rows follow their parents
    keyed.sort((a, b) => a.key - b.key);
    const sorted = keyed.map(k => k.id);
    sorted.forEach((id, i) => order.set(id, i));

    // 3. Place each node under the mean of its parents' centers, then push apart overlaps
    const desired = sorted.map(id => {
      const incoming = parents.get(id)!.filter(e => centers.has(e.source));
      if (incoming.length === 0) return 0;
      return incoming.reduce((sum, e) => sum + centers.get(e.source)!, 0) / incoming.length;
    });
    const widths = sorted.map(id => byId.get(id)!.width);
    const placed: number[] = [];
    sorted.forEach((_, i) => {
      if (i === 0) {
        placed.push(desired[i]);
        return;
      }
      const minCenter = placed[i - 1] + widths[i - 1] / 2 + horizontalGap + widths[i] / 2;
      placed.push(Math.max(desired[i], minCenter));
    });
    // Shift the whole row so it stays balanced around where its parents are
    const shift = desired.reduce((sum, d, i) => sum + (d - placed[i]), 0) / Math.max(1, sorted.length);
    const rowHeight = Math.max(...sorted.map(id => byId.get(id)!.height));

    sorted.forEach((id, i) => {
      const center = placed[i] + shift;
      centers.set(id, center);
      positions[id] = { x: Math.round(center - widths[i] / 2), y: Math.round(y) };
    });
    y += rowHeight + verticalGap;
  });

  return positions;
};
