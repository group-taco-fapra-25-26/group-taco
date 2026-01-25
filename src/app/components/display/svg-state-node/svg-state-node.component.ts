import { Component, computed, input, output } from '@angular/core';
import { StateNode } from '../../../classes/reachability-graph.model';
import { GeometryUtil } from '../../../utils/geometry.util';
import { VIEW_MODES, ViewMode } from '../display.constants';

@Component({
    selector: 'g[appSvgStateNode]',
    imports: [],
    templateUrl: './svg-state-node.component.html',
    styleUrl: './svg-state-node.component.css',
})
export class SvgStateNodeComponent {
    protected readonly VIEW_MODES = VIEW_MODES;
    readonly RADIUS = 7;

    readonly stateNode = input.required<StateNode>();
    readonly viewMode = input<ViewMode>(VIEW_MODES.SIMPLE);

    stateNodeClick = output<StateNode>();

    readonly x = computed(() => this.stateNode().x);
    readonly y = computed(() => this.stateNode().y);
    readonly label = computed(() => this.stateNode().displayLabel);

    readonly isStartingState = computed(() => this.stateNode().isStartingState);
    readonly isUnlimited = computed(() => this.stateNode().isMorMStrich);

    readonly fillColor = computed(() => {
        if (this.isUnlimited()) {
            return 'red';
        }
        return 'black';
    });

    readonly arrowTip = computed(() => {
        const x = this.x();
        const y = this.y();

        if (this.viewMode() === VIEW_MODES.DESCRIPTIVE) {
            // Calculate intersection for a line coming from top-left (-1, -1 direction)
            return GeometryUtil.getLabelBoundingBoxIntersection({ x, y }, { x: x - 1, y: y - 1 }, this.label());
        }

        const offset = 5;
        return { x: x - offset, y: y - offset };
    });

    readonly arrowLineEnd = computed(() => {
        const tip = this.arrowTip();
        const backOff = 3;
        return { x: tip.x - backOff, y: tip.y - backOff };
    });

    readonly arrowLineStart = computed(() => {
        const tip = this.arrowTip();
        const length = 25;
        return { x: tip.x - length, y: tip.y - length };
    });

    onClick() {
        this.stateNodeClick.emit(this.stateNode());
    }
}
