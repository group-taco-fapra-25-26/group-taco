import { Component, computed, signal } from '@angular/core';
import { SvgNodeComponent } from '../../../display/svg-node/svg-node.component';
import { FiringEdge, StateNode } from 'src/app/classes/reachability-graph.model';
import { PanningService } from 'src/app/services/panning.service';
import { DisplayComponent } from 'src/app/components/display/display.component';
import { SvgArcComponent } from 'src/app/components/display/svg-arc/svg-arc.component';
import { GRAPH_IDS } from '../../../display/display.constants';
import {
    DrawToolbarAction,
    DrawToolbarComponent,
    DrawToolbarInstruction,
} from '../../../draw-toolbar/draw-toolbar.component';

@Component({
    selector: 'app-reachability-graph-draw-display',
    standalone: true,
    imports: [SvgNodeComponent, SvgArcComponent, DrawToolbarComponent],
    providers: [PanningService],
    templateUrl: './reachability-graph-draw-display.component.html',
    styleUrl: './reachability-graph-draw-display.component.css',
})
export class ReachabilityGraphDrawDisplayComponent extends DisplayComponent {
    protected override graphId = GRAPH_IDS.REACHABILITY;
    readonly reachabilityGraphDiagram = this._reachabilityGraphService.reachabilityGraphSignal;
    readonly rgNodes = signal<StateNode[]>([]);
    readonly rgEdges = signal<FiringEdge[]>([]);

    /**
     * Toolbar actions for the reachability graph drawing display.
     * Add or modify actions as needed.
     * TODO: Implement the actual functionality for clearing and validating the reachability graph and update tooltips or remove icon buttons if not needed.
     * @protected
     */
    protected readonly toolbarActions = computed<DrawToolbarAction[]>(() => [
        {
            icon: 'delete',
            tooltip: 'PROCESS_NET.BUTTON_CLEAR_DRAWING',
            color: 'warn',
            action: () => this.clearDrawing(),
        },
        {
            icon: 'checklist',
            tooltip: 'PROCESS_NET.BUTTON_VALIDATE_NET',
            color: 'primary',
            action: () => this.onValidate(),
        },
    ]);

    /**
     * Toolbar instructions for the reachability graph drawing display.
     * Add or modify instructions as needed.
     * TODO: Update instruction texts to be relevant for reachability graphs.
     * @protected
     */
    protected readonly toolbarInstructions = computed<DrawToolbarInstruction[]>(() => [
        { label: 'PROCESS_NET.ACTION_DRAG_DROP', text: 'PROCESS_NET.INSTRUCTION_DRAG_DROP' },
        { label: 'PROCESS_NET.INSTRUCTION_MOVE', text: 'PROCESS_NET.INSTRUCTION_LEFT_CLICK_MOVE' },
        { label: 'PROCESS_NET.INSTRUCTION_CONNECT', text: 'PROCESS_NET.INSTRUCTION_RIGHT_CLICK_CONNECT' },
        { label: 'PROCESS_NET.INSTRUCTION_DELETE', text: 'PROCESS_NET.INSTRUCTION_MIDDLE_CLICK_DELETE' },
        { label: 'PROCESS_NET.INSTRUCTION_DELETE_CONN', text: 'PROCESS_NET.INSTRUCTION_MIDDLE_CLICK_DELETE_CONN' },
        { label: 'PROCESS_NET.INSTRUCTION_VALIDATE', text: 'PROCESS_NET.INSTRUCTION_VALIDATE_TOAST' },
    ]);

    private clearDrawing() {
        //clear the rg net
    }

    private onValidate() {
        //maybe not validate but check for "beschränktheit" through a button?
    }
}
