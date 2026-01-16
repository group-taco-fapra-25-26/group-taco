import { Component, computed, signal } from '@angular/core';
import { SvgNodeComponent } from '../../../display/svg-node/svg-node.component';
import { PanningService } from 'src/app/services/panning.service';
import { DisplayComponent } from 'src/app/components/display/display.component';
import { SvgArcComponent } from 'src/app/components/display/svg-arc/svg-arc.component';
import { GRAPH_IDS } from '../../../display/display.constants';
import {
    DrawToolbarAction,
    DrawToolbarComponent,
    DrawToolbarInstruction,
} from '../../../draw-toolbar/draw-toolbar.component';
import { DisplayableNode } from '../../../../classes/displayable-graph.interface';

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

    private draggedNode: DisplayableNode | null = null;
    private dragOffset = { x: 0, y: 0 };
    private isDraggingNode = false;

    onNodeMouseDown(event: MouseEvent, node: DisplayableNode) {
        // Only start dragging for left mouse button
        if (event.button !== 0) {
            return;
        }

        // Stop the event from reaching other handlers
        event.stopImmediatePropagation();
        event.preventDefault();

        this.isDraggingNode = true;
        this.draggedNode = node;

        const svgPoint = this.getSvgCoordinates(event);
        if (svgPoint) {
            this.dragOffset.x = svgPoint.x - node.x;
            this.dragOffset.y = svgPoint.y - node.y;
        }
    }

    override startPan(event: MouseEvent): void {
        if (this.isDraggingNode) return;
        super.startPan(event);
    }

    override pan(event: MouseEvent): void {
        if (this.isDraggingNode) {
            // Handle node dragging
            if (!this.draggedNode) return;

            const svgPoint = this.getSvgCoordinates(event);
            if (svgPoint) {
                const newX = svgPoint.x - this.dragOffset.x;
                const newY = svgPoint.y - this.dragOffset.y;

                // Update node position using signals
                this.draggedNode.x = newX;
                this.draggedNode.y = newY;
            }
            return;
        }
        super.pan(event);
    }

    override endPan(): void {
        if (this.isDraggingNode) {
            // End node dragging
            this.draggedNode = null;
            this.isDraggingNode = false;
            return;
        }
        super.endPan();
    }

    /**
     * Converts mouse event client coordinates to SVG coordinates,
     * taking into account the viewBox transformation.
     * @param event The mouse event
     */
    private getSvgCoordinates(event: MouseEvent): { x: number; y: number } | null {
        const svg = this.drawingArea?.nativeElement;
        if (!svg) return null;

        const clientRect = svg.getBoundingClientRect();
        const viewBox = this.viewBoxObj();

        // Calculate position relative to SVG element (0-1 range)
        const relX = (event.clientX - clientRect.left) / clientRect.width;
        const relY = (event.clientY - clientRect.top) / clientRect.height;

        // Map to viewBox coordinates
        const x = viewBox.minX + relX * viewBox.width;
        const y = viewBox.minY + relY * viewBox.height;

        return { x, y };
    }

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
