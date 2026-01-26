import { AfterViewInit, Component, computed, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { SvgNodeComponent } from '../../display/svg-node/svg-node.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DrawnElement, DrawService } from '../../../services/draw.service';
import { MatDialogModule } from '@angular/material/dialog';
import { DisplayService } from '../../../services/display.service';
import { ImageExportService } from '../../../services/image-export.service';
import { ModeService } from '../../../services/mode.service';
import { Subscription } from 'rxjs';
import { GRAPH_FILENAMES, GRAPH_IDS } from '../../display/display.constants';
import { DrawToolbarComponent, DrawToolbarInstruction } from '../../draw-toolbar/draw-toolbar.component';
import { Tab } from '../../../classes/tabs';

@Component({
    selector: 'app-draw',
    standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule, SvgNodeComponent, MatDialogModule, DrawToolbarComponent],
    templateUrl: './draw.component.html',
    styleUrl: './draw.component.css',
    providers: [],
})
export class DrawComponent implements AfterViewInit, OnDestroy, OnInit {
    @ViewChild('drawingArea') drawingArea!: ElementRef<SVGGraphicsElement>;

    draw = inject(DrawService);
    private _elementRef = inject(ElementRef);
    private _displayService = inject(DisplayService);
    private _imageExportService = inject(ImageExportService);
    private _modeService = inject(ModeService);
    private _sub?: Subscription;

    readonly drawnElements = this.draw.drawnElements;
    readonly isDragOver = this.draw.isDragOver;
    readonly selectedElementId = this.draw.selectedElementId;
    readonly hoveredElementId = this.draw.hoveredElementId;
    readonly hoveredConnectionId = this.draw.hoveredConnectionId;
    readonly connectionLines = this.draw.connectionLines;
    readonly tuplePreview = this.draw.tuplePreview;
    readonly showTuplePreviewOnly = this.draw.showTuplePreviewOnly;

    get tupleString() {
        return this.draw.tupleString();
    }
    set tupleString(value: string) {
        this.draw.setTupleString(value);
    }

    readonly viewBox = this.draw.viewBox;
    readonly viewBoxObj = this.draw.viewBoxObj;
    protected isExamMode = computed(() => {
        return this._modeService.isExamMode(Tab.DRAW);
    });

    ngOnInit(): void {
        this.draw.init();
        this._sub = this._displayService.downloadRequest$.subscribe(({ format, target }) => {
            if (target && target !== GRAPH_IDS.PETRI_NET) {
                return;
            }
            if (this._elementRef.nativeElement.getBoundingClientRect().height === 0) {
                return;
            }
            this._imageExportService.exportImage(
                this.drawingArea.nativeElement,
                format,
                GRAPH_FILENAMES[GRAPH_IDS.PETRI_NET],
            );
        });
    }

    ngAfterViewInit() {
        this.draw.setDrawingArea(this.drawingArea);
    }

    ngOnDestroy(): void {
        this.draw.destroy();
        this._sub?.unsubscribe();
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
        this.draw.showTuplePreviewIfAvailable();
    }

    onTuplePreviewClick(): void {
        this.draw.showTupleInline();
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

    onTupleTextareaPaste(event: ClipboardEvent) {
        // Ensure pasted text goes directly into tupleString
        const text = event.clipboardData?.getData('text');
        if (text !== undefined && text !== null) {
            event.preventDefault();
            this.tupleString = text;
        }
    }

    trackLineById = (_: number, line: { id: string }) => line.id;
    trackElementById = (_: number, element: DrawnElement) => element.id;

    toolbarActions() {
        return [];
    }
    protected readonly toolbarInstructions = computed<DrawToolbarInstruction[]>(() => {
        return [
            { label: 'DRAW.INSTRUCTION.ACTION_DRAG_DROP', text: 'DRAW.INSTRUCTION.DRAG_DROP' },
            { label: 'DRAW.INSTRUCTION.MOVE', text: 'DRAW.INSTRUCTION.LEFT_CLICK_MOVE' },
            { label: 'DRAW.INSTRUCTION.CONNECT', text: 'DRAW.INSTRUCTION.RIGHT_CLICK_CONNECT' },
            { label: 'DRAW.INSTRUCTION.DELETE', text: 'DRAW.INSTRUCTION.MIDDLE_CLICK_DELETE' },
            { label: 'DRAW.INSTRUCTION.EDIT_LABEL', text: 'DRAW.INSTRUCTION.DOUBLE_CLICK_EDIT_LABEL' },
            { label: 'DRAW.INSTRUCTION.SCROLL', text: 'DRAW.INSTRUCTION.SCROLL_CHANGE_TOKENS_WEIGHT' },
        ];
    });
}
