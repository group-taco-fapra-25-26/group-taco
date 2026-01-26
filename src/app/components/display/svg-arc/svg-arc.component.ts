import { Component, computed, input } from '@angular/core';
import { SHAPE } from '../../../classes/diagram/diagram-node';
import { Coords } from '../../../classes/json-petri-net';
import { DisplayableEdge, DisplayableNode } from '../../../classes/displayable-graph.interface';
import { PLACE_RADIUS, TRANSITION_SIZE } from '../display.constants';

// Extend DisplayableEdge to allow startOffset/endOffset
export interface DisplayableEdgeWithOffset extends DisplayableEdge {
    startOffset?: Coords;
    endOffset?: Coords;
}

@Component({
    selector: 'g[appSvgArc]',
    imports: [],
    templateUrl: './svg-arc.component.html',
    styleUrl: './svg-arc.component.css',
})
export class SvgArcComponent {
    readonly RADIUS = PLACE_RADIUS;
    readonly RECT_WIDTH = TRANSITION_SIZE;
    readonly RECT_HEIGHT = TRANSITION_SIZE;

    readonly diagramArc = input<DisplayableEdgeWithOffset>();
    readonly nodes = input<DisplayableNode[]>([]);

    readonly sourceNode = computed(() => {
        const arc = this.diagramArc();
        const nodeList = this.nodes();
        if (!arc || !nodeList) return undefined;
        return nodeList.find((node) => node.id === arc.source);
    });

    readonly targetNode = computed(() => {
        const arc = this.diagramArc();
        const nodeList = this.nodes();
        if (!arc || !nodeList) return undefined;
        return nodeList.find((node) => node.id === arc.target);
    });

    /**
     * Returns the connection point on the node's edge, with optional parallel offset.
     */
    private getOffsetConnectionPoint(
        node: DisplayableNode | undefined,
        otherNode: DisplayableNode | undefined,
        offset = 0,
    ): Coords {
        if (!node || !otherNode) return { x: 0, y: 0 };
        const dx = otherNode.x - node.x;
        const dy = otherNode.y - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance === 0) return { x: node.x, y: node.y };
        const normalizedX = dx / distance;
        const normalizedY = dy / distance;
        // Perpendicular vector
        const perpX = -normalizedY;
        const perpY = normalizedX;
        // Get connection point on node edge
        let basePoint: Coords;
        if (node.shape === SHAPE.CIRCLE) {
            const radius = this.RADIUS;
            basePoint = {
                x: node.x + normalizedX * radius,
                y: node.y + normalizedY * radius,
            };
        } else {
            const halfWidth = this.RECT_WIDTH / 2;
            const halfHeight = this.RECT_HEIGHT / 2;
            const xIntercept = Math.abs(normalizedX) > 0 ? halfWidth / Math.abs(normalizedX) : Infinity;
            const yIntercept = Math.abs(normalizedY) > 0 ? halfHeight / Math.abs(normalizedY) : Infinity;
            const intercept = Math.min(xIntercept, yIntercept);
            basePoint = {
                x: node.x + normalizedX * intercept,
                y: node.y + normalizedY * intercept,
            };
        }
        // Apply parallel offset
        return {
            x: basePoint.x + perpX * offset,
            y: basePoint.y + perpY * offset,
        };
    }

    readonly sourceConnectionPoint = computed(() => {
        const arc = this.diagramArc();
        const source = this.sourceNode();
        const target = this.targetNode();
        // Use startOffset if present (for parallel arcs)
        const offset = arc && arc.startOffset ? this.getOffsetFromCenters(source, target, arc.startOffset) : 0;
        return this.getOffsetConnectionPoint(source, target, offset);
    });

    readonly targetConnectionPoint = computed(() => {
        const arc = this.diagramArc();
        const source = this.sourceNode();
        const target = this.targetNode();
        // Use endOffset if present (for parallel arcs)
        const offset = arc && arc.endOffset ? this.getOffsetFromCenters(target, source, arc.endOffset) : 0;
        return this.getOffsetConnectionPoint(target, source, offset);
    });

    /**
     * Calculates the perpendicular offset value from the node center to the offset point.
     */
    private getOffsetFromCenters(
        node: DisplayableNode | undefined,
        otherNode: DisplayableNode | undefined,
        offsetPoint: Coords,
    ): number {
        if (!node || !otherNode) return 0;
        // Vector from node to otherNode
        const dx = otherNode.x - node.x;
        const dy = otherNode.y - node.y;
        // Perpendicular vector
        const perpX = -dy;
        const perpY = dx;
        // Vector from node to offsetPoint
        const ox = offsetPoint.x - node.x;
        const oy = offsetPoint.y - node.y;
        // Project offset vector onto perpendicular
        const perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
        if (perpLength === 0) return 0;
        return (ox * perpX + oy * perpY) / perpLength;
    }

    readonly pathData = computed(() => {
        const sourcePoint = this.sourceConnectionPoint();
        const targetPoint = this.targetConnectionPoint();
        const arc = this.diagramArc();

        if (!arc) return '';

        const bendPoints = arc.bendPoints;

        let path = `M ${sourcePoint.x} ${sourcePoint.y}`;

        // Add bend points if they exist
        if (bendPoints.length > 0) {
            for (const point of bendPoints) {
                path += ` L ${point.x} ${point.y}`;
            }
        }

        path += ` L ${targetPoint.x} ${targetPoint.y}`;

        return path;
    });

    readonly labelPosition = computed(() => {
        const source = this.sourceNode();
        const target = this.targetNode();
        const arc = this.diagramArc();

        if (!source || !target || !arc) return { x: 0, y: 0 };

        const points: Coords[] = [{ x: source.x, y: source.y }, ...arc.bendPoints, { x: target.x, y: target.y }];

        const segmentLengths: number[] = [];
        let total = 0;
        for (let i = 0; i < points.length - 1; i++) {
            const dx = points[i + 1].x - points[i].x;
            const dy = points[i + 1].y - points[i].y;
            const len = Math.sqrt(dx * dx + dy * dy);
            segmentLengths.push(len);
            total += len;
        }
        if (total === 0) return { x: source.x, y: source.y - 10 };

        let targetDist = total / 2;
        for (let i = 0; i < segmentLengths.length; i++) {
            if (targetDist <= segmentLengths[i]) {
                const t = targetDist / segmentLengths[i];
                return {
                    x: points[i].x + (points[i + 1].x - points[i].x) * t,
                    y: points[i].y + (points[i + 1].y - points[i].y) * t - 10,
                };
            }
            targetDist -= segmentLengths[i];
        }

        const last = points[points.length - 1];
        return { x: last.x, y: last.y - 10 };
    });

    readonly hasLabel = computed(() => {
        const arc = this.diagramArc();
        return arc?.displayLabel && arc.displayLabel.length > 0;
    });

    readonly displayText = computed(() => {
        const arc = this.diagramArc();
        return arc?.displayLabel || '';
    });
}
