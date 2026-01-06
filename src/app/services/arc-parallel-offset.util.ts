import { DiagramArc } from '../classes/diagram/diagram-arc';
import { DiagramNode } from '../classes/diagram/diagram-node';

export const DEFAULT_PARALLEL_OFFSET = 26;

/**
 * Applies symmetric bend-point offsets to parallel arcs between the same node pair.
 * Mutates the provided arcs in place by writing bendPoints.
 */
export function applyParallelOffsetsToArcs(
    arcs: DiagramArc[],
    nodes: DiagramNode[] | Map<string, DiagramNode>,
    parallelOffset = DEFAULT_PARALLEL_OFFSET,
): void {
    const nodeMap: Map<string, DiagramNode> = nodes instanceof Map ? nodes : new Map(nodes.map((n) => [n.id, n]));

    const groups = new Map<string, DiagramArc[]>();
    arcs.forEach((arc) => {
        const key = arc.source < arc.target ? `${arc.source}~${arc.target}` : `${arc.target}~${arc.source}`;
        const list = groups.get(key) || [];
        list.push(arc);
        groups.set(key, list);
    });

    groups.forEach((group, key) => {
        if (group.length < 2) return;
        const [aId, bId] = key.split('~');
        const nodeA = nodeMap.get(aId);
        const nodeB = nodeMap.get(bId);
        if (!nodeA || !nodeB) return;

        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1) return;

        const perpX = -dy / distance;
        const perpY = dx / distance;

        const forward = group
            .filter((arc) => arc.source === aId && arc.target === bId)
            .sort((a, b) => a.id.localeCompare(b.id));
        const backward = group
            .filter((arc) => arc.source === bId && arc.target === aId)
            .sort((a, b) => a.id.localeCompare(b.id));

        const applyOffsets = (list: DiagramArc[], baseShiftSign: -1 | 0 | 1, pairedExists: boolean) => {
            const centerIndex = (list.length - 1) / 2;
            list.forEach((arc, index) => {
                const start = nodeMap.get(arc.source);
                const end = nodeMap.get(arc.target);
                if (!start || !end) return;

                let offset = (index - centerIndex) * parallelOffset;
                if (baseShiftSign !== 0) {
                    offset += baseShiftSign * (parallelOffset / 2);
                }
                if (Math.abs(offset) < 0.01 && pairedExists) {
                    offset = parallelOffset / 2;
                }

                if (Math.abs(offset) < 0.01) {
                    arc.bendPoints = [];
                    return;
                }

                const p1 = 1 / 3;
                const p2 = 2 / 3;
                arc.bendPoints = [
                    {
                        x: start.x + (end.x - start.x) * p1 + perpX * offset,
                        y: start.y + (end.y - start.y) * p1 + perpY * offset,
                    },
                    {
                        x: start.x + (end.x - start.x) * p2 + perpX * offset,
                        y: start.y + (end.y - start.y) * p2 + perpY * offset,
                    },
                ];
            });
        };

        applyOffsets(forward, 0, backward.length > 0);
        applyOffsets(backward, -1, forward.length > 0);
    });
}
