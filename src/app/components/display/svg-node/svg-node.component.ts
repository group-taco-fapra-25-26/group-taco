import { Component, computed, input, output, signal, TemplateRef, untracked, viewChild } from '@angular/core';
import { Coords } from '../../../classes/json-petri-net';
import { SHAPE } from '../../../classes/diagram/diagram-node';
import { DisplayableNode } from '../../../classes/displayable-graph.interface';

@Component({
    selector: 'g[appSvgNode]',
    imports: [],
    templateUrl: './svg-node.component.html',
    styleUrl: './svg-node.component.css',
})
export class SvgNodeComponent {
    readonly RADIUS = 25;
    readonly RECT_WIDTH = 50;
    readonly RECT_HEIGHT = 30;

    readonly diagramNode = input<DisplayableNode>();
    // Mark if this node is currently selected (for connection creation)
    readonly selected = input<boolean>(false);

    clickNode = output<DisplayableNode>();

    readonly fillColor = signal('white');

    readonly transitionFillColor = computed(() => {
        return this.fillColor() === 'lightgray' ? 'gray' : 'black';
    });

    readonly placeFillColor = computed(() => {
        return this.fillColor();
    });

    readonly isTransition = computed(() => {
        return this.diagramNode()?.shape === SHAPE.RECT;
    });

    readonly isPlace = computed(() => {
        return this.diagramNode()?.shape === SHAPE.CIRCLE;
    });

    placeTemplate = viewChild('place', { read: TemplateRef });

    readonly displayLabel = computed(() => {
        return this.diagramNode()?.displayLabel || '';
    });

    readonly tokenCount = computed(() => {
        return this.diagramNode()?.tokenCount || 0;
    });

    readonly circleX = computed(() => {
        const node = this.diagramNode();
        return node ? node.x : 0;
    });

    readonly circleY = computed(() => {
        const node = this.diagramNode();
        return node ? node.y : 0;
    });

    readonly rectX = computed(() => {
        const node = this.diagramNode();
        return node ? node.x - this.RECT_WIDTH / 2 : 0;
    });

    readonly rectY = computed(() => {
        const node = this.diagramNode();
        return node ? node.y - this.RECT_HEIGHT / 2 : 0;
    });

    readonly textX = computed(() => {
        const node = this.diagramNode();
        return node ? node.x : 0;
    });

    readonly textY = computed(() => {
        const node = this.diagramNode();
        if (!node) return 0;

        // For transitions, center text inside the rectangle
        // For places, position text below the circle
        if (this.isTransition()) {
            return node.y;
        } else {
            return node.y + this.RADIUS + 15;
        }
    });

    readonly tokenPositions = computed(() => {
        const node = this.diagramNode();
        const tokens = this.tokenCount();

        if (!node || !this.isPlace() || tokens === 0) return [];

        const positions: Coords[] = [];

        if (tokens === 1) {
            // Single token in center
            positions.push({ x: node.x, y: node.y });
        } else if (tokens <= 6) {
            // Multiple tokens arranged in a circle
            const angleStep = (2 * Math.PI) / tokens;
            const tokenRadius = this.RADIUS * 0.6;

            for (let i = 0; i < tokens; i++) {
                const angle = i * angleStep;
                positions.push({
                    x: node.x + Math.cos(angle) * tokenRadius,
                    y: node.y + Math.sin(angle) * tokenRadius,
                });
            }
        } else {
            // For many tokens, just show the number
            return [];
        }

        return positions;
    });

    readonly showTokenNumber = computed(() => {
        return this.isPlace() && this.tokenCount() > 6;
    });

    // Computed values for selection highlighting
    readonly isSelected = computed(() => !!this.selected());
    readonly selectionStrokeColor = computed(() => (this.isSelected() ? 'orange' : 'transparent'));

    public mouseDown(e: MouseEvent) {
        this.fillColor.set('lightgray');
    }

    public mouseUp(e: MouseEvent) {
        this.fillColor.set('white');
    }

    public click() {
        const node = this.diagramNode();
        if (node) this.clickNode.emit(node);
    }

    protected readonly untracked = untracked;
}
