import { inject, Injectable } from '@angular/core';
import { DiagramNode } from '../classes/diagram/diagram-node';
import { SourcePetriNetService } from './source-petri-net.service';
import { DiagramArc } from '../classes/diagram/diagram-arc';
import { Coords } from '../classes/json-petri-net';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
    providedIn: 'root',
})
export class SpringEmbedderService {
    private _sourceNetService = inject(SourcePetriNetService);
    public isOptimalLayoutCalculated = toSignal(this._sourceNetService.optimalLayoutCalculated$);

    private readonly LENGTH_CONSTANT = 150;
    private readonly STIFFNESS_CONSTANT = 0.2;
    private readonly REPULSION_CONSTANT = 15000;
    private readonly PARALLEL_OFFSET = 26;

    private readonly MAX_ITERATIONS = 100000;
    private readonly MIN_MOVEMENT = 0.1;

    /**
     * Calculates the layout of the current source Petri net using the spring embedder algorithm.
     * Based on Peter Eades idea from "A heuristic for graph drawing" (1984).
     */
    public async calculateLayout(): Promise<void> {
        const diagram = this._sourceNetService.getCurrentSourceNet();
        if (!diagram) return;
        const nodes: DiagramNode[] = diagram.allNodes;
        const arcs: DiagramArc[] = diagram.arcs;

        arcs.forEach((arc: DiagramArc) => (arc.bendPoints = []));

        const neighborMap: Map<string, DiagramNode[]> = new Map<string, DiagramNode[]>();
        nodes.forEach((node: DiagramNode) => {
            const neighbors: DiagramNode[] = arcs
                .filter((arc: DiagramArc): boolean => arc.source === node.id || arc.target === node.id)
                .map(
                    (arc: DiagramArc): DiagramNode =>
                        arc.source === node.id
                            ? nodes.find((n: DiagramNode): boolean => n.id === arc.target)!
                            : nodes.find((n: DiagramNode): boolean => n.id === arc.source)!,
                );
            neighborMap.set(node.id, neighbors);
        });

        for (let i = 0; i < this.MAX_ITERATIONS; i++) {
            if (this._calculateNewPosition(nodes, neighborMap) < this.MIN_MOVEMENT) {
                this._sourceNetService.optimalLayoutCalculated();
                break;
            }
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        this._separateParallelArcs(arcs, nodes);
        this._sourceNetService.updateEditedNet(diagram);
    }

    private _calculateNewPosition(nodes: DiagramNode[], neighborMap: Map<string, DiagramNode[]>): number {
        let totalMovement = 0;
        nodes.forEach((node: DiagramNode) => {
            const force: Coords = { x: 0, y: 0 };

            neighborMap.get(node.id)?.forEach((neighbor: DiagramNode) => {
                const mechanicalForce: Coords = this._calculateMechanicalForces(node, neighbor);
                force.x += mechanicalForce.x;
                force.y += mechanicalForce.y;
            });

            nodes.forEach((other: DiagramNode) => {
                if (node.id === other.id) return;
                const electricalForce = this._calculateElectricalForces(node, other);
                force.x -= electricalForce.x;
                force.y -= electricalForce.y;
            });

            node.x += force.x;
            node.y += force.y;

            const movement = Math.sqrt(force.x * force.x + force.y * force.y);
            totalMovement += movement;
        });
        return totalMovement;
    }

    /**
     * Calculates the Euclidean distance between two diagram nodes.
     * @param nodeA
     *              the first diagram node
     * @param nodeB
     *               the second diagram node
     * @return the distance between the two nodes
     */
    private _calculateDistance(nodeA: DiagramNode, nodeB: DiagramNode): number {
        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculates the mechanical (spring) forces between two connected nodes.
     * @param node
     *              the current node
     * @param neighbor
     *              the neighboring node
     * @return the mechanical force vector
     */
    private _calculateMechanicalForces(node: DiagramNode, neighbor: DiagramNode): Coords {
        const distance = this._calculateDistance(node, neighbor);
        if (distance < 0.1) {
            return this.setRandomPosition();
        }
        const lengthDiff = distance - this.LENGTH_CONSTANT;
        const directionX = (neighbor.x - node.x) / distance;
        const directionY = (neighbor.y - node.y) / distance;
        return {
            x: this.STIFFNESS_CONSTANT * lengthDiff * directionX,
            y: this.STIFFNESS_CONSTANT * lengthDiff * directionY,
        };
    }

    private setRandomPosition(): Coords {
        return {
            x: (Math.random() - 0.5) * 10,
            y: (Math.random() - 0.5) * 10,
        };
    }

    /**
     * Calculates the electrical (repulsion) forces between two nodes.
     * @param node
     *             the current node
     * @param other
     *            the other node
     * @return the repulsion force vector
     */
    private _calculateElectricalForces(node: DiagramNode, other: DiagramNode): Coords {
        const distance = this._calculateDistance(node, other);
        if (distance < 0.1) {
            return this.setRandomPosition();
        }
        const repulsionMagnitude = this.REPULSION_CONSTANT / (distance * distance);
        const directionX = (other.x - node.x) / distance;
        const directionY = (other.y - node.y) / distance;
        return {
            x: repulsionMagnitude * directionX,
            y: repulsionMagnitude * directionY,
        };
    }

    private _separateParallelArcs(arcs: DiagramArc[], nodes: DiagramNode[]): void {
        const nodeMap = new Map<string, DiagramNode>();
        nodes.forEach((node) => nodeMap.set(node.id, node));

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
            const distance = Math.sqrt(dx * dx + dy * dy);
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

                    let offset = (index - centerIndex) * this.PARALLEL_OFFSET;
                    if (baseShiftSign !== 0) {
                        offset += baseShiftSign * (this.PARALLEL_OFFSET / 2);
                    }
                    if (Math.abs(offset) < 0.01 && pairedExists) {
                        offset = this.PARALLEL_OFFSET / 2;
                    }

                    if (Math.abs(offset) < 0.01) {
                        arc.bendPoints = [];
                        return;
                    }

                    const p1Ratio = 1 / 3;
                    const p2Ratio = 2 / 3;
                    arc.bendPoints = [
                        {
                            x: start.x + (end.x - start.x) * p1Ratio + perpX * offset,
                            y: start.y + (end.y - start.y) * p1Ratio + perpY * offset,
                        },
                        {
                            x: start.x + (end.x - start.x) * p2Ratio + perpX * offset,
                            y: start.y + (end.y - start.y) * p2Ratio + perpY * offset,
                        },
                    ];
                });
            };

            applyOffsets(forward, 0, backward.length > 0);
            applyOffsets(backward, -1, forward.length > 0);
        });
    }
}
