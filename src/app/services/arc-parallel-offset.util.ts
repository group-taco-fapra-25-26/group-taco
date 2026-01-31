import { DisplayableEdge, DisplayableNode } from '../classes/displayable-graph.interface';
import { Coords } from '../classes/json-petri-net';

export const DEFAULT_PARALLEL_OFFSET = 26;
export const OFFSET_TOLERANCE = 0.01;
export const BEND_POINT_RATIO_START = 1 / 3;
export const BEND_POINT_RATIO_END = 2 / 3;
export const MIN_ARC_LENGTH = 1;
export const MIN_GROUP_SIZE = 2;

/**
 * Helper to calculate the perpendicular offset for a specific arc in a parallel group.
 */
function calculateOffset(
    index: number,
    count: number,
    pairedExists: boolean,
    baseShiftSign: 0 | -1 | 1,
    parallelOffset: number,
): number | null {
    const centerIndex = (count - 1) / 2;
    let offset = (index - centerIndex) * parallelOffset;

    if (baseShiftSign !== 0) {
        offset += baseShiftSign * (parallelOffset / 2);
    }
    if (Math.abs(offset) < OFFSET_TOLERANCE && pairedExists) {
        offset = parallelOffset / 2;
    }

    if (Math.abs(offset) < OFFSET_TOLERANCE) {
        return null;
    }
    return offset;
}

/**
 * Helper to generate bend points based on start/end coordinates and a perpendicular offset.
 */
function calculateBendPoints(
    start: DisplayableNode,
    end: DisplayableNode,
    offset: number,
    perpX: number,
    perpY: number,
): Coords[] {
    const p1 = BEND_POINT_RATIO_START;
    const p2 = BEND_POINT_RATIO_END;
    return [
        {
            x: start.x + (end.x - start.x) * p1 + perpX * offset,
            y: start.y + (end.y - start.y) * p1 + perpY * offset,
        },
        {
            x: start.x + (end.x - start.x) * p2 + perpX * offset,
            y: start.y + (end.y - start.y) * p2 + perpY * offset,
        },
    ];
}

/**
 * Calculates bend points for a specific arc to separate parallel edges.
 * @param arc The specific arc we need to compute bend points for.
 * @param allEdges A list of all edges in the graph, used to find peers.
 * @param allNodes A list or map of all nodes, used for geometry calculations.
 * @param parallelOffset The distance separation factor.
 * @returns Array of Coordinates for the bend points, or empty if straight.
 */
export function computeBendPointsForArc(
    arc: DisplayableEdge,
    allEdges: DisplayableEdge[],
    allNodes: DisplayableNode[] | Map<string, DisplayableNode>,
    parallelOffset = DEFAULT_PARALLEL_OFFSET,
): Coords[] {
    const nodeMap: Map<string, DisplayableNode> =
        allNodes instanceof Map ? allNodes : new Map(allNodes.map((n) => [n.id, n]));

    // 1. Identify valid group (parallel arcs)
    const key = arc.source < arc.target ? `${arc.source}~${arc.target}` : `${arc.target}~${arc.source}`;

    // We only care about edges in the same group
    const group = allEdges.filter((e) => {
        const k = e.source < e.target ? `${e.source}~${e.target}` : `${e.target}~${e.source}`;
        return k === key;
    });

    if (group.length < MIN_GROUP_SIZE) return [];

    const [aId, bId] = key.split('~');
    const nodeA = nodeMap.get(aId);
    const nodeB = nodeMap.get(bId);
    if (!nodeA || !nodeB) return [];

    const dx = nodeB.x - nodeA.x;
    const dy = nodeB.y - nodeA.y;
    const distance = Math.hypot(dx, dy);
    if (distance < MIN_ARC_LENGTH) return [];

    const perpX = -dy / distance;
    const perpY = dx / distance;

    const forward = group
        .filter((e) => e.source === aId && e.target === bId) // A->B
        .sort((a, b) => a.id.localeCompare(b.id));
    const backward = group
        .filter((e) => e.source === bId && e.target === aId) // B->A
        .sort((a, b) => a.id.localeCompare(b.id));

    // 2. Determine index and context for our specific arc
    const isForward = arc.source === aId && arc.target === bId;
    const list = isForward ? forward : backward;
    const index = list.findIndex((e) => e.id === arc.id);

    if (index === -1) return []; // Should not happen given logic above

    const baseShiftSign = isForward ? 0 : -1;
    const pairedExists = isForward ? backward.length > 0 : forward.length > 0;

    const offset = calculateOffset(index, list.length, pairedExists, baseShiftSign, parallelOffset);

    if (offset === null) {
        return [];
    }

    const start = nodeMap.get(arc.source)!;
    const end = nodeMap.get(arc.target)!;

    return calculateBendPoints(start, end, offset, perpX, perpY);
}

// Patch: Extend DisplayableEdge to allow startOffset/endOffset
export interface DisplayableEdgeWithOffset extends DisplayableEdge {
    startOffset?: Coords;
    endOffset?: Coords;
}

/**
 * Applies symmetric bend-point offsets to parallel arcs between the same node pair.
 * Mutates the provided arcs in place by writing bendPoints.
 */
export function applyParallelOffsetsToArcs(
    arcs: DisplayableEdge[],
    nodes: DisplayableNode[] | Map<string, DisplayableNode>,
    parallelOffset = DEFAULT_PARALLEL_OFFSET,
): void {
    const nodeMap: Map<string, DisplayableNode> = nodes instanceof Map ? nodes : new Map(nodes.map((n) => [n.id, n]));

    const groups = new Map<string, DisplayableEdge[]>();
    arcs.forEach((arc) => {
        const key = arc.source < arc.target ? `${arc.source}~${arc.target}` : `${arc.target}~${arc.source}`;
        const list = groups.get(key) || [];
        list.push(arc);
        groups.set(key, list);
    });

    groups.forEach((group, key) => {
        if (group.length < MIN_GROUP_SIZE) return;
        const [aId, bId] = key.split('~');
        const nodeA = nodeMap.get(aId);
        const nodeB = nodeMap.get(bId);
        if (!nodeA || !nodeB) return;

        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.hypot(dx, dy);
        if (distance < MIN_ARC_LENGTH) return;

        const perpX = -dy / distance;
        const perpY = dx / distance;

        const forward = group
            .filter((arc) => arc.source === aId && arc.target === bId)
            .sort((a, b) => a.id.localeCompare(b.id));
        const backward = group
            .filter((arc) => arc.source === bId && arc.target === aId)
            .sort((a, b) => a.id.localeCompare(b.id));

        const applyOffsets = (list: DisplayableEdge[], baseShiftSign: -1 | 0 | 1) => {
            const pairedExists = baseShiftSign === 0 ? backward.length > 0 : forward.length > 0;

            list.forEach((arc, index) => {
                const start = nodeMap.get(arc.source);
                const end = nodeMap.get(arc.target);
                if (!start || !end) return;

                let offset = calculateOffset(index, list.length, pairedExists, baseShiftSign, parallelOffset);

                // Negate offset for backward arcs to shift to the opposite side
                if (baseShiftSign === -1 && offset !== null) {
                    offset = -offset;
                }

                if (offset === null) {
                    arc.bendPoints = [];
                    (arc as DisplayableEdgeWithOffset).startOffset = undefined;
                    (arc as DisplayableEdgeWithOffset).endOffset = undefined;
                    return;
                }

                // Calculate perpendicular vector
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const distance = Math.hypot(dx, dy);
                const perpX = -dy / distance;
                const perpY = dx / distance;

                // Offset start and end points
                (arc as DisplayableEdgeWithOffset).startOffset = {
                    x: start.x + perpX * offset,
                    y: start.y + perpY * offset,
                };
                (arc as DisplayableEdgeWithOffset).endOffset = {
                    x: end.x + perpX * offset,
                    y: end.y + perpY * offset,
                };

                arc.bendPoints = [];
            });
        };

        applyOffsets(forward, 0);
        applyOffsets(backward, -1);
    });
}
