import { inject, Injectable } from '@angular/core';
import { DiagramNode } from '../classes/diagram/diagram-node';
import { SourcePetriNetService } from './source-petri-net.service';
import { PanningService } from './panning.service';
import { DiagramArc } from '../classes/diagram/diagram-arc';
import { Coords } from '../classes/json-petri-net';
import { toSignal } from '@angular/core/rxjs-interop';
import { applyParallelOffsetsToArcs, DEFAULT_PARALLEL_OFFSET } from './arc-parallel-offset.util';

@Injectable({
    providedIn: 'root',
})
export class SpringEmbedderService {
    private _sourceNetService = inject(SourcePetriNetService);
    private _panningService = inject(PanningService);
    public isOptimalLayoutCalculated = toSignal(this._sourceNetService.optimalLayoutCalculated$);

    private readonly LENGTH_CONSTANT = 150;
    private readonly STIFFNESS_CONSTANT = 0.2;
    private readonly REPULSION_CONSTANT = 15000;
    private readonly GRAVITY_CONSTANT = 0.0025;
    private readonly PARALLEL_OFFSET = DEFAULT_PARALLEL_OFFSET;

    private readonly MAX_ITERATIONS = 1000;
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

        const viewBox = this._panningService.viewBox();
        const center = {
            x: viewBox.minX + viewBox.width / 2,
            y: viewBox.minY + viewBox.height / 2,
        };

        for (let i = 0; i < this.MAX_ITERATIONS; i++) {
            if (this._calculateNewPosition(nodes, neighborMap, center) < this.MIN_MOVEMENT) {
                this._sourceNetService.optimalLayoutCalculated();
                break;
            }
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        this._separateParallelArcs(arcs, nodes);
        this._sourceNetService.updateEditedNet(diagram);
    }

    private _calculateNewPosition(
        nodes: DiagramNode[],
        neighborMap: Map<string, DiagramNode[]>,
        center: Coords,
    ): number {
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

            const gravityForce = this._calculateCentralGravityForce(node, center);
            force.x += gravityForce.x;
            force.y += gravityForce.y;

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

    /**
     * Calculates the central gravity force pulling a node towards the center of the layout.
     * @param node
     *            the current node
     * @param center
     *          the center coordinates
     * @return the gravity force vector
     */
    private _calculateCentralGravityForce(node: DiagramNode, center: Coords): Coords {
        return {
            x: (center.x - node.x) * this.GRAVITY_CONSTANT,
            y: (center.y - node.y) * this.GRAVITY_CONSTANT,
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
        applyParallelOffsetsToArcs(arcs, nodes, this.PARALLEL_OFFSET);
    }
}
