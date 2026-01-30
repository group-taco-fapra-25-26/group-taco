import { Component, ElementRef, ViewChild } from '@angular/core';
import { DisplayComponent } from '../../../display/display.component';
import { SvgNodeComponent } from '../../../display/svg-node/svg-node.component';
import { SvgArcComponent } from '../../../display/svg-arc/svg-arc.component';
import { SHAPE } from '../../../../classes/diagram/diagram-node';
import { DisplayableNode } from '../../../../classes/displayable-graph.interface';

// Added strongly typed drag data interfaces and Window augmentation
interface BasicDragData {
    elementType: 'place' | 'transition';
    elementId: string;
    elementLabel: string;
    elementTokens?: number;
}
interface DragData extends BasicDragData {
    clientX: number;
    clientY: number;
}

declare global {
    interface Window {
        __dragData?: DragData;
    }
}

@Component({
    selector: 'app-process-net-display',
    standalone: true,
    imports: [SvgNodeComponent, SvgArcComponent],
    templateUrl: './process-net-display.component.html',
    styleUrls: ['./process-net-display.component.css'],
})
export class ProcessNetDisplayComponent extends DisplayComponent {
    @ViewChild('drawingArea') override drawingArea!: ElementRef<SVGGraphicsElement>;

    private isDragging = false;
    private dragStartPos = { x: 0, y: 0 };
    private currentDragData: BasicDragData | null = null;

    override processDropEvent(e: DragEvent) {
        super.processDropEvent(e);
    }

    override prevent(e: DragEvent) {
        super.prevent(e);
    }

    onNodeMouseDown(event: MouseEvent, node: DisplayableNode) {
        // Only start drag if left mouse button
        if (event.button !== 0) {
            return;
        }

        this.isDragging = false;
        this.dragStartPos = { x: event.clientX, y: event.clientY };

        const elementType: BasicDragData['elementType'] = node.shape === SHAPE.CIRCLE ? 'place' : 'transition';
        const elementId = node.id;
        const elementLabel = node.displayLabel;
        const elementTokens = elementType === 'place' ? node.tokenCount() : undefined;

        // Store the data for later use in drag
        const dragData: BasicDragData = {
            elementType,
            elementId,
            elementLabel,
            elementTokens,
        };

        // Add document-level listeners
        const onMouseMove = (e: MouseEvent) => {
            // Check if we've moved enough to start dragging (5px threshold)
            const dx = e.clientX - this.dragStartPos.x;
            const dy = e.clientY - this.dragStartPos.y;
            if (!this.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                this.isDragging = true;
                this.currentDragData = dragData;
                this.startDrag(e, dragData);
            }

            if (this.isDragging) {
                // Update drag data position
                window.__dragData = {
                    ...dragData,
                    clientX: e.clientX,
                    clientY: e.clientY,
                };
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (this.isDragging) {
                // Simulate drop event
                this.simulateDrop(e);
            }

            this.isDragging = false;
            this.currentDragData = null;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        event.preventDefault();
        event.stopPropagation();
    }

    private startDrag(event: MouseEvent, dragData: BasicDragData) {
        // Store data globally for the drop event
        window.__dragData = {
            ...dragData,
            clientX: event.clientX,
            clientY: event.clientY,
        };
    }

    private simulateDrop(event: MouseEvent) {
        // Find the drawing canvas element
        const drawingCanvas = document.querySelector('.drawing-canvas');
        if (!drawingCanvas) {
            delete window.__dragData;
            return;
        }

        // Check if mouse is over the drawing canvas
        const rect = drawingCanvas.getBoundingClientRect();
        const isOverCanvas =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;

        if (isOverCanvas && this.currentDragData) {
            // Trigger a custom drop event on the drawing canvas
            const dropEvent = new CustomEvent('customDrop', {
                detail: {
                    ...this.currentDragData,
                    clientX: event.clientX,
                    clientY: event.clientY,
                },
            });
            drawingCanvas.dispatchEvent(dropEvent);
        }

        // Clean up
        delete window.__dragData;
    }
}
