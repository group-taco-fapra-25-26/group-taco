import {
    AfterViewInit,
    Component,
    computed,
    ElementRef,
    OnDestroy,
    signal,
    ViewChild,
    inject,
    OnInit,
} from '@angular/core';
import { SvgNodeComponent } from '../../display/svg-node/svg-node.component';
import { DiagramNode } from '../../../classes/diagram/diagram-node';
import { DiagramPlace, DiagramPlaceLabelPlacement } from '../../../classes/diagram/diagram-place';
import { DiagramTransition, DiagramTransitionOptions } from '../../../classes/diagram/diagram-transition';
import { PanningService } from '../../../services/panning.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ParserService } from '../../../services/parser.service';
import { SourcePetriNetService } from '../../../services/source-petri-net.service';
import { SpringEmbedderService } from '../../../services/spring-embedder.service';
import { DisplayService } from '../../../services/display.service';
import { ToasterNotificationService } from '../../../services/toaster-notification.service';
import { Diagram } from '../../../classes/diagram/diagram';
import { Subscription } from 'rxjs';

interface DrawnElement {
    node: DiagramNode;
    id: string;
}

interface Connection {
    id: string;
    aId: string;
    bId: string;
    weight: number;
}

interface GlobalDragData {
    elementType: 'place' | 'transition';
    elementId: string;
    elementLabel: string;
    elementTokens?: number;
    clientX: number;
    clientY: number;
}

declare global {
    interface Window {
        __dragData?: GlobalDragData;
    }
}

@Component({
    selector: 'app-draw',
    standalone: true,
    imports: [CommonModule, FormsModule, TranslateModule, SvgNodeComponent],
    templateUrl: './draw.component.html',
    styleUrl: './draw.component.css',
    providers: [PanningService],
})
export class DrawComponent implements AfterViewInit, OnDestroy, OnInit {
    @ViewChild('drawingArea') drawingArea!: ElementRef<SVGGraphicsElement>;

    readonly drawnElements = signal<DrawnElement[]>([]);
    readonly connections = signal<Connection[]>([]);
    readonly isDragOver = signal(false);
    readonly selectedElementId = signal<string | null>(null);

    readonly connectionLines = computed(() => {
        return this.connections()
            .map((c) => {
                const a = this.getElementById(c.aId);
                const b = this.getElementById(c.bId);
                if (!a || !b) return null;
                const { x1, y1, x2, y2 } = this.computeTrimmedLine(a, b);
                return { id: c.id, x1, y1, x2, y2, weight: c.weight };
            })
            .filter(
                (v): v is { id: string; x1: number; y1: number; x2: number; y2: number; weight: number } => v !== null,
            );
    });

    readonly viewBox = this.panning.viewBoxAsString;
    readonly viewBoxObj = this.panning.viewBox;

    tupleString = '';

    private elementIdCounter = 0;
    private connectionIdCounter = 0;
    private placeLabelCounter = 0;
    private transitionLabelCounter = 0;
    private draggedElement: DrawnElement | null = null;
    private dragOffset = { x: 0, y: 0 };
    private svgElement: SVGSVGElement | null = null;
    private isDraggingElement = false;

    private readonly PLACE_RADIUS = 25;
    private readonly TRANSITION_HALF_W = 25;
    private readonly TRANSITION_HALF_H = 15;

    private _parserService = inject(ParserService);
    private _sourcePetriNetService = inject(SourcePetriNetService);
    private _springEmbedderService = inject(SpringEmbedderService);
    private _displayService = inject(DisplayService);
    private _toaster = inject(ToasterNotificationService);

    private sourceNetSub?: Subscription;

    constructor(private panning: PanningService) {}

    ngOnInit(): void {
        this.sourceNetSub = this._sourcePetriNetService.sourceNet$.subscribe((diagram) => {
            if (diagram) {
                this.loadDiagramIntoCanvas(diagram);
                this.resetViewIfReady();
            } else {
                this.clearCanvas();
            }
        });
    }

    ngAfterViewInit() {
        this.svgElement = (this.drawingArea?.nativeElement as SVGSVGElement) ?? null;
        this.resetViewIfReady();
    }

    ngOnDestroy(): void {
        document.removeEventListener('mousemove', this.onDocumentMouseMove, true);
        document.removeEventListener('mouseup', this.onDocumentMouseUp, true);
        this.sourceNetSub?.unsubscribe();
    }

    // Palette drag helpers
    startPaletteDrag(event: DragEvent, type: 'place' | 'transition') {
        const label = type === 'place' ? this.getNextPlaceLabel() : this.getNextTransitionLabel();
        const id = `${type}-${Date.now()}`;
        if (event.dataTransfer) {
            event.dataTransfer.setData('element-type', type);
            event.dataTransfer.effectAllowed = 'copy';
        }
        window.__dragData = {
            elementType: type,
            elementId: id,
            elementLabel: label,
            clientX: 0,
            clientY: 0,
        };
    }

    endPaletteDrag() {
        delete window.__dragData;
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        event.dataTransfer && (event.dataTransfer.dropEffect = 'copy');
        this.isDragOver.set(true);
    }

    onDragLeave() {
        this.isDragOver.set(false);
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        this.isDragOver.set(false);

        const dragData = window.__dragData;
        if (dragData) {
            this.placeElementAtClient(dragData.elementType, dragData.elementLabel, event.clientX, event.clientY);
            delete window.__dragData;
            return;
        }

        const elementType = event.dataTransfer?.getData('element-type');
        if (elementType === 'place' || elementType === 'transition') {
            const label = elementType === 'place' ? this.getNextPlaceLabel() : this.getNextTransitionLabel();
            this.placeElement(event, elementType, label);
        }
    }

    onCanvasPanStart(event: MouseEvent) {
        if (this.isDraggingElement) return;
        const target = event.target as Element | null;
        const isOnElement = target?.closest('.element-wrapper') || target?.classList.contains('drag-overlay');
        if (isOnElement) return;
        this.panning.startPan(event, undefined, this.drawingArea);
    }

    onCanvasPan(event: MouseEvent) {
        if (this.isDraggingElement) return;
        this.panning.pan(event, this.drawingArea);
    }

    onCanvasPanEnd() {
        this.panning.endPan(this.drawingArea);
    }

    onCanvasWheel(event: WheelEvent) {
        this.panning.zoom(event, this.drawingArea, undefined);
    }

    preventContext(event: MouseEvent) {
        event.preventDefault();
    }

    clearCanvas() {
        this.drawnElements.set([]);
        this.connections.set([]);
        this.selectedElementId.set(null);
        this.elementIdCounter = 0;
        this.connectionIdCounter = 0;
        this.placeLabelCounter = 0;
        this.transitionLabelCounter = 0;
        this.panning.resetViewBox(this.drawingArea);
    }

    private resetViewIfReady() {
        if (this.drawingArea) {
            this.panning.resetViewBox(this.drawingArea);
        }
    }

    generateNetFromInput() {
        const input = this.tupleString.trim();
        if (!input) return;

        const diagram = this._parserService.parse(input);
        if (diagram) {
            this._sourcePetriNetService.loadNewNet(diagram, input);
            this._displayService.display(diagram);
            this.loadDiagramIntoCanvas(diagram);
            this._springEmbedderService.calculateLayout().catch((error) => console.error(error));
            this._toaster.showSuccess('TUPLE_INPUT.TOAST_SUCCESS_HEADER', 'TUPLE_INPUT.TOAST_SUCCESS_BODY');
        } else {
            this._toaster.showError('TUPLE_INPUT.TOAST_ERROR_HEADER', 'TUPLE_INPUT.TOAST_ERROR_BODY');
        }
    }

    onElementMouseDown(event: MouseEvent, element: DrawnElement) {
        if (event.button === 1) {
            event.stopImmediatePropagation();
            event.preventDefault();
            this.deleteElement(element);
            return;
        }
        if (event.button !== 0) return;

        event.stopImmediatePropagation();
        event.preventDefault();
        this.isDraggingElement = true;
        this.draggedElement = element;

        const svgPoint = this.getSvgCoordinates(event);
        if (svgPoint) {
            this.dragOffset.x = svgPoint.x - element.node.x;
            this.dragOffset.y = svgPoint.y - element.node.y;
        }

        document.addEventListener('mousemove', this.onDocumentMouseMove, true);
        document.addEventListener('mouseup', this.onDocumentMouseUp, true);
    }

    onElementRightClick(event: MouseEvent, element: DrawnElement) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const currentSelected = this.selectedElementId();
        if (!currentSelected) {
            this.selectedElementId.set(element.id);
            return;
        }
        if (currentSelected === element.id) {
            this.selectedElementId.set(null);
            return;
        }
        const first = this.getElementById(currentSelected);
        const second = element;
        if (!first) {
            this.selectedElementId.set(null);
            return;
        }
        const firstIsPlace = first.node instanceof DiagramPlace;
        const firstIsTransition = first.node instanceof DiagramTransition;
        const secondIsPlace = second.node instanceof DiagramPlace;
        const secondIsTransition = second.node instanceof DiagramTransition;

        if ((firstIsPlace && secondIsTransition) || (firstIsTransition && secondIsPlace)) {
            this.connections.update((cs) =>
                cs.filter(
                    (c) =>
                        !((c.aId === first.id && c.bId === second.id) || (c.aId === second.id && c.bId === first.id)),
                ),
            );
            const newConn: Connection = {
                id: `conn-${++this.connectionIdCounter}`,
                aId: first.id,
                bId: second.id,
                weight: 1,
            };
            this.connections.update((cs) => [...cs, newConn]);
            this.selectedElementId.set(null);
        } else {
            this.selectedElementId.set(element.id);
        }
    }

    onConnectionMouseDown(event: MouseEvent, connectionId: string) {
        if (event.button === 1) {
            event.stopImmediatePropagation();
            event.preventDefault();
            this.deleteConnection(connectionId);
        }
    }

    onConnectionWheel(event: WheelEvent, connectionId: string) {
        event.preventDefault();
        event.stopPropagation();
        const delta = Math.sign(event.deltaY) || 0;
        if (delta === 0) return;
        this.connections.update((cs) =>
            cs.map((c) => {
                if (c.id !== connectionId) return c;
                const newWeight = Math.max(1, c.weight - delta); // scroll up (negative deltaY) increases weight
                return { ...c, weight: newWeight };
            }),
        );
    }

    onElementDoubleClick(event: MouseEvent, element: DrawnElement) {
        event.stopImmediatePropagation();
        event.preventDefault();
        if (element.node instanceof DiagramTransition) {
            const currentLabel = element.node.displayLabel ?? element.node.id;
            const newLabel = window.prompt('Edit transition label', currentLabel)?.trim();
            if (!newLabel || newLabel === currentLabel) return;

            this.drawnElements.update((elements) =>
                elements.map((el) => {
                    if (el.id !== element.id) return el;
                    const updated = this.buildTransition(el.node.id, newLabel, { innerLabel: newLabel });
                    updated.x = el.node.x;
                    updated.y = el.node.y;
                    return { ...el, node: updated };
                }),
            );
            return;
        }

        if (element.node instanceof DiagramPlace) {
            const currentLabel = element.node.label ?? element.node.displayLabel;
            const newLabel = window.prompt('Edit place label', currentLabel)?.trim();
            if (!newLabel || newLabel === currentLabel) return;

            this.drawnElements.update((elements) =>
                elements.map((el) => {
                    if (el.id !== element.id) return el;
                    const updated = this.buildPlace(el.node.id, newLabel, el.node.tokenCount(), {
                        // hideTokens: el.node.hideTokens,
                        labelPlacement: 'below',
                        // isStartPlace: el.node.isStartPlace,
                    });
                    updated.x = el.node.x;
                    updated.y = el.node.y;
                    return { ...el, node: updated };
                }),
            );
        }
    }

    onElementWheel(event: WheelEvent, element: DrawnElement) {
        event.preventDefault();
        event.stopPropagation();
        if (element.node instanceof DiagramPlace) {
            const delta = Math.sign(event.deltaY) || 0;
            if (delta === 0) return;
            this.drawnElements.update((elements) =>
                elements.map((el) => {
                    if (el.id !== element.id || !(el.node instanceof DiagramPlace)) return el;
                    const currentTokens = el.node.tokenCount();
                    const newTokens = Math.max(0, currentTokens - delta); // scroll up adds tokens, down removes
                    const updated = this.buildPlace(el.node.id, el.node.label ?? el.node.displayLabel, newTokens, {
                        hideTokens: el.node.hideTokens,
                        labelPlacement: el.node.labelPlacement,
                        isStartPlace: el.node.isStartPlace,
                    });
                    updated.x = el.node.x;
                    updated.y = el.node.y;
                    return { ...el, node: updated };
                }),
            );
        }
    }

    private onDocumentMouseMove = (event: MouseEvent) => {
        if (!this.draggedElement || !this.isDraggingElement) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const svgPoint = this.getSvgCoordinates(event);
        if (!svgPoint) return;

        const newX = svgPoint.x - this.dragOffset.x;
        const newY = svgPoint.y - this.dragOffset.y;

        this.drawnElements.update((elements) =>
            elements.map((el) => {
                if (el.id !== this.draggedElement?.id) return el;
                let newNode: DiagramNode;
                if (el.node instanceof DiagramPlace) {
                    const tokens = (el.node as DiagramPlace).tokenCount() ?? 0;
                    const originalLabel = el.node.label ?? el.node.displayLabel;
                    newNode = this.buildPlace(el.node.id, originalLabel, tokens, {
                        innerLabel: undefined,
                        hideTokens: el.node.hideTokens,
                        labelPlacement: 'below',
                        isStartPlace: el.node.isStartPlace,
                    });
                } else if (el.node instanceof DiagramTransition) {
                    const label = (el.node as DiagramTransition).displayLabel ?? el.node.id;
                    newNode = this.buildTransition(el.node.id, label, { innerLabel: label });
                } else {
                    newNode = el.node;
                }
                newNode.x = newX;
                newNode.y = newY;
                return { ...el, node: newNode };
            }),
        );
    };

    private onDocumentMouseUp = (event: MouseEvent) => {
        if (this.isDraggingElement) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
        this.draggedElement = null;
        this.isDraggingElement = false;
        document.removeEventListener('mousemove', this.onDocumentMouseMove, true);
        document.removeEventListener('mouseup', this.onDocumentMouseUp, true);
    };

    private placeElement(event: DragEvent, type: 'place' | 'transition', label: string) {
        const svgPoint = this.getSvgCoordinates(event);
        if (!svgPoint) return;
        this.addElement(type, label, svgPoint.x, svgPoint.y);
    }

    private placeElementAtClient(type: 'place' | 'transition', label: string, clientX: number, clientY: number) {
        const svgPoint = this.getSvgCoordinatesFromClient(clientX, clientY);
        if (!svgPoint) return;
        this.addElement(type, label, svgPoint.x, svgPoint.y);
    }

    private addElement(type: 'place' | 'transition', label: string, x: number, y: number) {
        let newNode: DiagramNode;
        const uniqueId = `draw-${type}-${++this.elementIdCounter}`;
        if (type === 'place') {
            newNode = this.buildPlace(uniqueId, label, 0, {
                labelPlacement: 'below',
                innerLabel: undefined,
                hideTokens: false,
            });
        } else {
            newNode = this.buildTransition(uniqueId, label, { innerLabel: label });
        }
        newNode.x = x;
        newNode.y = y;
        this.drawnElements.update((elements) => [...elements, { id: uniqueId, node: newNode }]);
    }

    private loadDiagramIntoCanvas(diagram: Diagram) {
        this.connectionIdCounter = 0;
        this.elementIdCounter = 0;
        this.placeLabelCounter = diagram.places.length;
        this.transitionLabelCounter = diagram.transitions.length;

        const elements: DrawnElement[] = [];
        diagram.places.forEach((place) => {
            elements.push({ id: place.id, node: place });
            this.elementIdCounter++;
        });
        diagram.transitions.forEach((transition) => {
            elements.push({ id: transition.id, node: transition });
            this.elementIdCounter++;
        });

        const conns: Connection[] = [];
        diagram.arcs.forEach((arc) => {
            conns.push({
                id: `conn-${++this.connectionIdCounter}`,
                aId: arc.source,
                bId: arc.target,
                weight: arc.weight,
            });
        });

        this.drawnElements.set(elements);
        this.connections.set(conns);
        this.selectedElementId.set(null);
    }

    private deleteElement(element: DrawnElement) {
        this.drawnElements.update((els) => els.filter((e) => e.id !== element.id));
        this.connections.update((cs) => cs.filter((c) => c.aId !== element.id && c.bId !== element.id));
        if (this.selectedElementId() === element.id) {
            this.selectedElementId.set(null);
        }
    }

    private deleteConnection(connectionId: string) {
        this.connections.update((cs) => cs.filter((c) => c.id !== connectionId));
    }

    private getElementById(id: string): DrawnElement | undefined {
        return this.drawnElements().find((e) => e.id === id);
    }

    private getSvgCoordinates(event: MouseEvent | DragEvent): { x: number; y: number } | null {
        return this.getSvgCoordinatesFromClient(event.clientX, event.clientY);
    }

    private getSvgCoordinatesFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
        if (!this.svgElement) {
            this.svgElement = (this.drawingArea?.nativeElement as SVGSVGElement) ?? null;
        }
        if (!this.svgElement) return null;
        const point = this.svgElement.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const ctm = this.svgElement.getScreenCTM();
        if (!ctm) return null;
        const svgPoint = point.matrixTransform(ctm.inverse());
        return { x: svgPoint.x, y: svgPoint.y };
    }

    private computeTrimmedLine(a: DrawnElement, b: DrawnElement) {
        const ax = a.node.x;
        const ay = a.node.y;
        const bx = b.node.x;
        const by = b.node.y;
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;

        const aOffset =
            a.node instanceof DiagramPlace
                ? this.PLACE_RADIUS
                : Math.min(this.TRANSITION_HALF_W, this.TRANSITION_HALF_H);
        const bOffset =
            b.node instanceof DiagramPlace
                ? this.PLACE_RADIUS
                : Math.min(this.TRANSITION_HALF_W, this.TRANSITION_HALF_H);

        const x1 = ax + ux * aOffset;
        const y1 = ay + uy * aOffset;
        const x2 = bx - ux * bOffset;
        const y2 = by - uy * bOffset;
        return { x1, y1, x2, y2 };
    }

    private buildPlace(
        id: string,
        label?: string,
        initialTokens = 0,
        options?: {
            innerLabel?: string;
            hideTokens?: boolean;
            labelPlacement?: DiagramPlaceLabelPlacement;
            isStartPlace?: boolean;
        },
    ): DiagramPlace {
        return new DiagramPlace(id, initialTokens, label, {
            innerLabel: options?.innerLabel ?? undefined,
            hideTokens: options?.hideTokens ?? false,
            labelPlacement: options?.labelPlacement ?? 'below',
            isStartPlace: options?.isStartPlace ?? false,
        });
    }

    private buildTransition(id: string, label: string, options?: DiagramTransitionOptions): DiagramTransition {
        return new DiagramTransition(id, label, [], [], [], [], {
            innerLabel: options?.innerLabel ?? label,
        });
    }

    private getNextPlaceLabel() {
        return `p${++this.placeLabelCounter}`;
    }

    private getNextTransitionLabel() {
        return `t${++this.transitionLabelCounter}`;
    }
}
