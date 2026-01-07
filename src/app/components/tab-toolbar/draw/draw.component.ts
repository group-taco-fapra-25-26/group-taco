import { AfterViewInit, Component, OnDestroy, ViewChild, ElementRef, OnInit, inject } from '@angular/core';
import { SvgNodeComponent } from '../../display/svg-node/svg-node.component';
import { PanningService } from '../../../services/panning.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DrawService, DrawnElement } from '../../../services/draw.service';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
    selector: 'app-draw',
    standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule, SvgNodeComponent, MatDialogModule],
    templateUrl: './draw.component.html',
    styleUrl: './draw.component.css',
    providers: [PanningService, DrawService],
})
export class DrawComponent implements AfterViewInit, OnDestroy, OnInit {
    @ViewChild('drawingArea') drawingArea!: ElementRef<SVGGraphicsElement>;

    draw = inject(DrawService);

    readonly drawnElements = this.draw.drawnElements;
    readonly isDragOver = this.draw.isDragOver;
    readonly selectedElementId = this.draw.selectedElementId;
    readonly hoveredElementId = this.draw.hoveredElementId;
    readonly hoveredConnectionId = this.draw.hoveredConnectionId;
    readonly connectionLines = this.draw.connectionLines;
    readonly tuplePreview = this.draw.tuplePreview;

    get tupleString() {
        return this.draw.tupleString();
    }
    set tupleString(value: string) {
        this.draw.setTupleString(value);
    }

    readonly viewBox = this.draw.viewBox;
    readonly viewBoxObj = this.draw.viewBoxObj;
    readonly isExamMode = this.draw.isExamMode;

    ngOnInit(): void {
        this.draw.init();
    }

    ngAfterViewInit() {
        this.draw.setDrawingArea(this.drawingArea);
    }

    ngOnDestroy(): void {
        this.draw.destroy();
    }

    // Palette drag helpers
    startPaletteDrag(event: DragEvent, type: 'place' | 'transition') {
        this.draw.startPaletteDrag(event, type);
    }

    endPaletteDrag() {
        this.draw.endPaletteDrag();
    }

    onDragOver(event: DragEvent) {
        this.draw.onDragOver(event);
    }

    onDragLeave() {
        this.draw.onDragLeave();
    }

    onDrop(event: DragEvent) {
        this.draw.onDrop(event);
    }

    onCanvasPanStart(event: MouseEvent) {
        this.draw.onCanvasPanStart(event);
    }

    onCanvasPan(event: MouseEvent) {
        this.draw.onCanvasPan(event);
    }

    onCanvasPanEnd() {
        this.draw.onCanvasPanEnd();
    }

    onCanvasWheel(event: WheelEvent) {
        this.draw.onCanvasWheel(event);
    }

    preventContext(event: MouseEvent) {
        this.draw.preventContext(event);
    }

    onTupleButtonClick(): void {
        this.draw.onTupleButtonClick();
    }

    onElementMouseDown(event: MouseEvent, element: DrawnElement) {
        this.draw.onElementMouseDown(event, element);
    }

    onElementRightClick(event: MouseEvent, element: DrawnElement) {
        this.draw.onElementRightClick(event, element);
    }

    onConnectionMouseDown(event: MouseEvent, connectionId: string) {
        this.draw.onConnectionMouseDown(event, connectionId);
    }

    onConnectionWheel(event: WheelEvent, connectionId: string) {
        this.draw.onConnectionWheel(event, connectionId);
    }

    onElementDoubleClick(event: MouseEvent, element: DrawnElement) {
        this.draw.onElementDoubleClick(event, element);
    }

    onElementWheel(event: WheelEvent, element: DrawnElement) {
        this.draw.onElementWheel(event, element);
    }

    clearTupleHover() {
        this.draw.setHoveredElementId(null);
        this.draw.setHoveredConnectionId(null);
    }

    onTupleEditorInput(event: Event) {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        const text = target.innerText ?? '';
        this.tupleString = text;
    }

    onTupleEditorBlur(event: Event) {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        // Ensure editor reflects normalized tuple string (e.g., after parsing/generation)
        if (target.innerText !== this.tupleString) {
            target.innerText = this.tupleString;
        }
    }

    trackLineById = (_: number, line: { id: string }) => line.id;
    trackElementById = (_: number, element: DrawnElement) => element.id;
}
