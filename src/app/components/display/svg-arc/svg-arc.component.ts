import { Component, computed, input } from '@angular/core';
import { SHAPE } from '../../../classes/diagram/diagram-node';
import { Coords } from '../../../classes/json-petri-net';
import { DisplayableEdge, DisplayableNode } from '../../../classes/displayable-graph.interface';
import { PLACE_RADIUS, TRANSITION_SIZE } from '../display.constants';

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

    readonly diagramArc = input<DisplayableEdge>();
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

    readonly sourceConnectionPoint = computed(() => {
        const source = this.sourceNode();
        const target = this.targetNode();

        if (!source || !target) return { x: 0, y: 0 };

        return this.getConnectionPoint(source, target, true);
    });

    readonly targetConnectionPoint = computed(() => {
        const source = this.sourceNode();
        const target = this.targetNode();

        if (!source || !target) return { x: 0, y: 0 };

        return this.getConnectionPoint(target, source, false);
    });

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

    private getConnectionPoint(node: DisplayableNode, otherNode: DisplayableNode, isSource: boolean): Coords {
        const dx = otherNode.x - node.x;
        const dy = otherNode.y - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return { x: node.x, y: node.y };

        const normalizedX = dx / distance;
        const normalizedY = dy / distance;

        // Determine if this is a place (circle) or transition (rectangle)
        if (node.shape === SHAPE.CIRCLE) {
            const radius = this.RADIUS;
            return {
                x: node.x + normalizedX * radius,
                y: node.y + normalizedY * radius,
            };
        }

        const halfWidth = this.RECT_WIDTH / 2;
        const halfHeight = this.RECT_HEIGHT / 2;

        const xIntercept = Math.abs(normalizedX) > 0 ? halfWidth / Math.abs(normalizedX) : Infinity;
        const yIntercept = Math.abs(normalizedY) > 0 ? halfHeight / Math.abs(normalizedY) : Infinity;
        const intercept = Math.min(xIntercept, yIntercept);

        return {
            x: node.x + normalizedX * intercept,
            y: node.y + normalizedY * intercept,
        };
    }
}
