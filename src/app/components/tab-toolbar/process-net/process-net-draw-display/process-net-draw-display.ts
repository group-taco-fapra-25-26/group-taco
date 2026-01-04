import {
    ChangeDetectorRef,
    Component,
    computed,
    ElementRef,
    inject,
    OnDestroy,
    OnInit,
    signal,
    ViewChild,
    AfterViewInit,
} from '@angular/core';
import { SvgNodeComponent } from '../../../display/svg-node/svg-node.component';
import { DiagramNode, SHAPE } from '../../../../classes/diagram/diagram-node';
import { DiagramPlace, DiagramPlaceLabelPlacement } from '../../../../classes/diagram/diagram-place';
import { DiagramTransition, DiagramTransitionOptions } from '../../../../classes/diagram/diagram-transition';
import { DisplayService } from '../../../../services/display.service';
import {
    type PetriNet,
    type ProcessConnection,
    type ProcessElement,
    validateProcessNet,
} from '../../../../services/validation.service';
import { ToasterNotificationService } from '../../../../services/toaster-notification.service';
import { PanningService } from '../../../../services/panning.service';
import { TOAST_POSITIONS, ToastList } from '../../../../classes/toast';
import { TranslateModule } from '@ngx-translate/core';

interface DrawnElement {
    node: DiagramNode;
    id: string;
}

interface Connection {
    id: string;
    aId: string; // source element id (first clicked)
    bId: string; // target element id (second clicked)
    weight: number; // arc weight, >= 1
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
    selector: 'app-process-net-draw-display',
    standalone: true,
    imports: [SvgNodeComponent, TranslateModule],
    templateUrl: './process-net-draw-display.html',
    providers: [PanningService],
    styleUrls: ['./process-net-draw-display.css'],
})
export class ProcessNetDrawDisplayComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('drawingArea') drawingArea!: ElementRef<SVGGraphicsElement>;
    readonly drawnElements = signal<DrawnElement[]>([]);
    readonly isDragOver = signal<boolean>(false);
    // Connections between nodes (directed: from aId -> bId)
    readonly connections = signal<Connection[]>([]);
    // Derived lines with coordinates for rendering
    readonly connectionLines = computed(() => {
        return this.connections()
            .map((c) => {
                const a = this.getElementById(c.aId);
                const b = this.getElementById(c.bId);
                if (!a || !b) return null;

                // Compute trimmed endpoints so the line starts/ends at shape boundaries
                const { x1, y1, x2, y2 } = this.computeTrimmedLine(a, b);
                return { id: c.id, x1, y1, x2, y2, weight: c.weight };
            })
            .filter(
                (v): v is { id: string; x1: number; y1: number; x2: number; y2: number; weight: number } => v !== null,
            );
    });
    // Currently selected element for making a connection (highlighted)
    readonly selectedElementId = signal<string | null>(null);

    private elementIdCounter = 0;
    private connectionIdCounter = 0;
    private bLabelCounter = 0;
    private eLabelCounter = 0;
    private draggedElement: DrawnElement | null = null;
    private dragOffset = { x: 0, y: 0 };
    private svgElement: SVGSVGElement | null = null;
    private isDraggingElement = false;
    private elementRef = inject(ElementRef);
    private cdr = inject(ChangeDetectorRef);
    private customDropListener: ((event: Event) => void) | null = null;
    private displayService = inject(DisplayService);
    private toaster = inject(ToasterNotificationService);
    private panningService = inject(PanningService);
    readonly viewBox = this.panningService.viewBoxAsString;

    // Dimensions consistent with SvgNodeComponent
    private readonly PLACE_RADIUS = 25;
    private readonly TRANSITION_HALF_W = 25; // RECT_WIDTH/2
    private readonly TRANSITION_HALF_H = 15; // RECT_HEIGHT/2

    ngOnInit() {
        // Listen for custom drop events
        const canvas = this.elementRef.nativeElement.querySelector('.drawing-canvas');
        if (canvas) {
            this.customDropListener = (event: Event) => {
                this.handleCustomDrop(event as CustomEvent);
            };
            canvas.addEventListener('customDrop', this.customDropListener);

            // Add mousedown listener with capture phase to intercept before child elements
            canvas.addEventListener('mousedown', this.handleCanvasMouseDown, true);
        }
    }

    ngAfterViewInit() {
        this.svgElement = (this.drawingArea?.nativeElement as SVGSVGElement) ?? null;
    }

    ngOnDestroy() {
        // Clean up event listener
        const canvas = this.elementRef.nativeElement.querySelector('.drawing-canvas');
        if (canvas && this.customDropListener) {
            canvas.removeEventListener('customDrop', this.customDropListener);
            canvas.removeEventListener('mousedown', this.handleCanvasMouseDown, true);
        }
    }

    private handleCanvasMouseDown = (event: MouseEvent) => {
        // Only handle left clicks for dragging/moving
        if (event.button !== 0) return;

        // Check if this is the drag overlay rect (which has its own handler)
        const target = event.target as Element;
        if (target.classList.contains('drag-overlay')) {
            return;
        }

        // Find if we clicked on an element wrapper
        const wrapper = target.closest('.element-wrapper');

        if (wrapper) {
            const elementId = wrapper.getAttribute('data-element-id');
            if (elementId) {
                const element = this.drawnElements().find((e) => e.id === elementId);
                if (element) {
                    this.onElementMouseDown(event, element);
                }
            }
        }
    };

    private handleCustomDrop(event: CustomEvent) {
        const detail = event.detail;
        if (!detail) {
            return;
        }

        const svgPoint = this.getSvgCoordinatesFromClient(detail.clientX, detail.clientY);
        if (!svgPoint) {
            return;
        }

        let newNode: DiagramNode;
        // Always create a unique ID for the drawing area, based on the source element
        const uniqueId = `drawn-${detail.elementId}-${++this.elementIdCounter}`;
        const elementLabel = detail.elementLabel || detail.elementId;
        const elementTokens = detail.elementTokens ?? 0;

        if (detail.elementType === 'place') {
            newNode = this.buildPlace(uniqueId, detail.elementId, elementTokens, {
                isStartPlace: this.shouldMarkAsStart(detail.elementId),
            });
        } else if (detail.elementType === 'transition') {
            newNode = this.buildTransition(uniqueId, elementLabel);
        } else {
            return;
        }

        newNode.x = svgPoint.x;
        newNode.y = svgPoint.y;

        const newElement: DrawnElement = {
            node: newNode,
            id: uniqueId,
        };

        this.drawnElements.update((elements) => [...elements, newElement]);
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
        this.isDragOver.set(true);
    }

    onDragLeave(_event: DragEvent) {
        this.isDragOver.set(false);
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        this.isDragOver.set(false);

        // Check for drag data from the global window object (custom drag)
        const dragData = window.__dragData;
        if (dragData) {
            const svgPoint = this.getSvgCoordinates(event);
            if (!svgPoint) {
                return;
            }

            let newNode: DiagramNode;
            // Always create a unique ID for the drawing area
            const uniqueId = `drawn-${dragData.elementId || 'element'}-${++this.elementIdCounter}`;
            const elementLabel = dragData.elementLabel || dragData.elementId;
            const elementTokens = dragData.elementTokens ?? 0;

            if (dragData.elementType === 'place') {
                newNode = this.buildPlace(uniqueId, dragData.elementId, elementTokens, {
                    isStartPlace: this.shouldMarkAsStart(dragData.elementId),
                });
            } else if (dragData.elementType === 'transition') {
                newNode = this.buildTransition(uniqueId, elementLabel);
            } else {
                return;
            }

            newNode.x = svgPoint.x;
            newNode.y = svgPoint.y;

            const newElement: DrawnElement = {
                node: newNode,
                id: uniqueId,
            };

            this.drawnElements.update((elements) => [...elements, newElement]);

            // Clear the global drag data
            delete window.__dragData;
            return;
        }

        // Fallback to standard drag and drop (for files, etc.)
        const elementType = event.dataTransfer?.getData('element-type');
        if (!elementType) {
            return;
        }

        const svgPoint = this.getSvgCoordinates(event);
        if (!svgPoint) {
            return;
        }

        let newNode: DiagramNode;
        const uniqueId = `drawn-element-${++this.elementIdCounter}`;

        if (elementType === 'place') {
            newNode = this.buildPlace(uniqueId, undefined, 0);
        } else if (elementType === 'transition') {
            newNode = this.buildTransition(uniqueId, uniqueId);
        } else {
            return;
        }

        newNode.x = svgPoint.x;
        newNode.y = svgPoint.y;

        const newElement: DrawnElement = {
            node: newNode,
            id: uniqueId,
        };

        this.drawnElements.update((elements) => [...elements, newElement]);
    }

    onElementMouseDown(event: MouseEvent, element: DrawnElement) {
        // Middle click (button 1) deletes the element and its connections
        if (event.button === 1) {
            event.stopImmediatePropagation();
            event.preventDefault();
            this.deleteElement(element);
            return;
        }

        // Only start dragging for left mouse button
        if (event.button !== 0) {
            return;
        }

        // Stop the event from reaching svg-node component's handlers
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
        // Right-click selection and connection logic
        event.preventDefault();
        event.stopImmediatePropagation();

        const currentSelectedId = this.selectedElementId();
        if (!currentSelectedId) {
            // Nothing selected yet -> select this one
            this.selectedElementId.set(element.id);
            return;
        }

        if (currentSelectedId === element.id) {
            // Toggle off selection if clicking the same element
            this.selectedElementId.set(null);
            return;
        }

        const first = this.drawnElements().find((e) => e.id === currentSelectedId);
        const second = element;
        if (!first) {
            // Safety: reset selection
            this.selectedElementId.set(null);
            return;
        }

        const firstIsPlace = first.node instanceof DiagramPlace;
        const firstIsTransition = first.node instanceof DiagramTransition;
        const secondIsPlace = second.node instanceof DiagramPlace;
        const secondIsTransition = second.node instanceof DiagramTransition;

        // Only connect if exactly one is place and one is transition
        if ((firstIsPlace && secondIsTransition) || (firstIsTransition && secondIsPlace)) {
            // Remove any existing connection between these two nodes (either direction)
            this.connections.update((cs) =>
                cs.filter(
                    (c) =>
                        !((c.aId === first.id && c.bId === second.id) || (c.aId === second.id && c.bId === first.id)),
                ),
            );
            // Add new directed connection first -> second
            const newConn: Connection = {
                id: `conn-${++this.connectionIdCounter}`,
                aId: first.id,
                bId: second.id,
                weight: 1,
            };
            this.connections.update((cs) => [...cs, newConn]);
            // Clear selection after connecting
            this.selectedElementId.set(null);
        } else {
            // If types don't match, replace selection with the newly clicked element
            this.selectedElementId.set(element.id);
        }
    }

    // Increment connection weight (used by left click)
    onConnectionMouseDown(event: MouseEvent, connectionId: string) {
        // Middle click deletes connection
        if (event.button === 1) {
            event.stopImmediatePropagation();
            event.preventDefault();
            this.deleteConnection(connectionId);
            return;
        }
    }

    onCanvasPanStart(event: MouseEvent) {
        if (this.isDraggingElement) return;
        const target = event.target as Element | null;
        const isOnElement = target?.closest('.element-wrapper') || target?.classList.contains('drag-overlay');
        if (isOnElement) {
            return;
        }
        this.panningService.startPan(event, this.displayService.diagram, this.drawingArea);
    }

    onCanvasPan(event: MouseEvent) {
        if (this.isDraggingElement) return;
        this.panningService.pan(event, this.drawingArea);
    }

    onCanvasPanEnd() {
        this.panningService.endPan(this.drawingArea);
    }

    onCanvasWheel(event: WheelEvent) {
        this.panningService.zoom(event, this.drawingArea, this.displayService.diagram);
    }

    private onDocumentMouseMove = (event: MouseEvent) => {
        if (!this.draggedElement || !this.isDraggingElement) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        const svgPoint = this.getSvgCoordinates(event);
        if (svgPoint) {
            const newX = svgPoint.x - this.dragOffset.x;
            const newY = svgPoint.y - this.dragOffset.y;

            let updatedElement: DrawnElement | null = null;
            this.drawnElements.update((elements) =>
                elements.map((el) => {
                    if (el.id !== this.draggedElement?.id) return el;

                    // Recreate node instance to trigger SvgNodeComponent re-render
                    let newNode: DiagramNode;
                    if (el.node instanceof DiagramPlace) {
                        const tokens = (el.node as DiagramPlace).tokenCount() ?? 0;
                        const originalLabel = el.node.label ?? el.node.displayLabel;
                        newNode = this.buildPlace(el.node.id, originalLabel, tokens, {
                            innerLabel: el.node.innerLabel,
                            hideTokens: el.node.hideTokens,
                            labelPlacement: el.node.labelPlacement,
                            isStartPlace: el.node.isStartPlace,
                        });
                    } else if (el.node instanceof DiagramTransition) {
                        const label = (el.node as DiagramTransition).displayLabel ?? el.node.id;
                        newNode = this.buildTransition(el.node.id, label, {
                            innerLabel: el.node.innerLabel,
                        });
                    } else {
                        // Fallback: keep same reference (should not happen)
                        newNode = el.node;
                    }
                    newNode.x = newX;
                    newNode.y = newY;

                    const newEl: DrawnElement = { ...el, node: newNode };
                    updatedElement = newEl;
                    return newEl;
                }),
            );

            if (updatedElement) {
                this.draggedElement = updatedElement;
            }

            // Force Angular to detect the changes just in case
            this.cdr.detectChanges();
        }
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

    private getSvgCoordinates(event: MouseEvent | DragEvent): { x: number; y: number } | null {
        return this.getSvgCoordinatesFromClient(event.clientX, event.clientY);
    }

    private getSvgCoordinatesFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
        if (!this.svgElement) {
            this.svgElement =
                (this.drawingArea?.nativeElement as SVGSVGElement) ??
                ((document.querySelector('.drawing-canvas') as SVGSVGElement) || null);
        }

        if (!this.svgElement) {
            return null;
        }

        const point = this.svgElement.createSVGPoint();
        point.x = clientX;
        point.y = clientY;

        const ctm = this.svgElement.getScreenCTM();
        if (!ctm) {
            return null;
        }

        const svgPoint = point.matrixTransform(ctm.inverse());
        return { x: svgPoint.x, y: svgPoint.y };
    }

    // Compute trimmed line from center of a to center of b, shortened by shape radii/half-sizes
    private computeTrimmedLine(a: DrawnElement, b: DrawnElement): { x1: number; y1: number; x2: number; y2: number } {
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

    clearDrawing() {
        this.drawnElements.set([]);
        this.connections.set([]);
        this.selectedElementId.set(null);
        this.elementIdCounter = 0;
        this.connectionIdCounter = 0;
        this.bLabelCounter = 0;
        this.eLabelCounter = 0;
    }

    deleteElement(element: DrawnElement) {
        // Remove the element
        this.drawnElements.update((elements) => elements.filter((e) => e.id !== element.id));
        // Remove any connections referencing this element
        this.connections.update((cs) => cs.filter((c) => c.aId !== element.id && c.bId !== element.id));
        // Clear selection if it was this element
        if (this.selectedElementId() === element.id) {
            this.selectedElementId.set(null);
        }
    }

    private deleteConnection(connectionId: string) {
        this.connections.update((cs) => cs.filter((c) => c.id !== connectionId));
    }

    // Suppress browser context menu on the drawing canvas (right click still used for interactions)
    preventContext(event: MouseEvent) {
        event.preventDefault();
    }

    // Trigger validation of the drawn process net against the loaded Petri net
    onValidate() {
        const base = this.displayService.diagram;
        if (!base) {
            this.toaster.showError('TOASTER.HEADER.VALIDATION', 'TOASTER.BODY.VALIDATION_ERROR', {
                duration: 0,
                toastPosition: TOAST_POSITIONS.TOP_CENTER,
            });

            return;
        }
        const nodes = base.getNodes();
        const edges = base.getEdges();
        const petri: PetriNet = {
            places: nodes.filter((n) => n.shape === 'circle').map((n) => n.id),
            transitions: nodes.filter((n) => n.shape === 'rect').map((n) => n.id),
            arcs: Object.fromEntries(
                edges.map((e) => [
                    `${e.source},${e.target}`,
                    ((e as unknown as { weight?: number }).weight ?? 1) as number,
                ]),
            ),
            labels: Object.fromEntries(nodes.filter((n) => n.shape === 'rect').map((n) => [n.id, n.displayLabel])),
            marking: Object.fromEntries(
                nodes
                    .filter((n) => n.shape === 'circle')
                    .map((place) => {
                        const tokens = place.tokenCount();
                        return [place.id, tokens] as [string, number];
                    })
                    .filter(([, tokens]) => tokens > 0),
            ),
        };
        const elements: ProcessElement[] = this.drawnElements().map((el) => {
            const isPlace = el.node instanceof DiagramPlace;
            const isTrans = el.node instanceof DiagramTransition;
            return {
                id: el.id,
                type: isPlace ? 'Place' : isTrans ? 'Transition' : 'Place',
                label: el.node.displayLabel,
                isStartPlace: isPlace ? (el.node as DiagramPlace).isStartPlace : undefined,
            };
        });
        const connections: ProcessConnection[] = this.connections().map((c) => ({
            from: c.aId,
            to: c.bId,
            weight: c.weight,
        }));
        const startPlaces = this.drawnElements()
            .filter(
                (el): el is DrawnElement & { node: DiagramPlace } =>
                    el.node instanceof DiagramPlace && el.node.isStartPlace,
            )
            .map((el) => el.node.label ?? el.node.displayLabel);
        const result = validateProcessNet({ ...petri, startPlaces }, elements, connections);
        // result contains success flag and could contain error and info messages. If success and no messages, show a generic success message.
        if (result.valid && result.infos.length == 0) {
            this.toaster.showSuccess('TOASTER.HEADER.VALIDATION', 'TOASTER.BODY.VALIDATION_VALID_MAXIMAL', {
                duration: 0,
                toastPosition: TOAST_POSITIONS.TOP_CENTER,
            });
        } else if (result.valid && result.infos.length > 0) {
            const infos = result.infos.map((info): ToastList => ({ message: info.key, messageParams: info.params }));
            this.toaster.showInfo('TOASTER.HEADER.VALIDATION', 'TOASTER.BODY.VALIDATION_VALID_WITH_INFOS', {
                duration: 0,
                toastPosition: TOAST_POSITIONS.TOP_CENTER,
                list: infos,
            });
        } else {
            const errors = result.errors.map(
                (error): ToastList => ({ message: error.key, messageParams: error.params }),
            );
            this.toaster.showError('TOASTER.HEADER.VALIDATION', 'TOASTER.BODY.VALIDATION_INVALID', {
                duration: 0,
                toastPosition: TOAST_POSITIONS.TOP_CENTER,
                list: errors,
            });
        }
    }

    // Helpers for template
    getElementById(id: string): DrawnElement | undefined {
        return this.drawnElements().find((e) => e.id === id);
    }

    onCreateStartPosition() {
        const diagram = this.displayService.diagram;
        if (!diagram) {
            this.toaster.showError('TOASTER.HEADER.START_POSITION', 'TOASTER.BODY.LOAD_NET_FIRST', {
                duration: 0,
                toastPosition: TOAST_POSITIONS.TOP_CENTER,
            });
            return;
        }

        const nodes = diagram.getNodes();
        const markedPlaces = nodes.filter((node) => node.shape === SHAPE.CIRCLE && node.tokenCount() > 0);
        if (markedPlaces.length === 0) {
            this.toaster.showInfo('TOASTER.HEADER.START_POSITION', 'TOASTER.BODY.NO_MARKED_PLACES_FOUND', {
                duration: 0,
                toastPosition: TOAST_POSITIONS.TOP_CENTER,
            });
            return;
        }

        const tokenInstances = markedPlaces.flatMap((place) =>
            Array.from({ length: Math.max(0, Math.floor(place.tokenCount())) }, () => place),
        );
        if (tokenInstances.length === 0) {
            this.toaster.showInfo('TOASTER.HEADER.START_POSITION', 'TOASTER.BODY.NO_MARKED_PLACES_FOUND', {
                duration: 0,
                toastPosition: TOAST_POSITIONS.TOP_CENTER,
            });
            return;
        }

        this.clearDrawing();
        this.panningService.resetViewBox(this.drawingArea);

        const viewBox = this.panningService.INITIAL_VIEWBOX;
        const padding = 40;
        const availableHeight = viewBox.height - padding * 2;
        const minSpacing = this.PLACE_RADIUS * 2 + 20;
        const spacing = tokenInstances.length > 0 ? Math.max(availableHeight / tokenInstances.length, minSpacing) : 0;

        const newElements: DrawnElement[] = [];
        const startX = viewBox.minX + viewBox.width * 0.25;
        tokenInstances.forEach((place, index) => {
            const innerLabel = this.getNextInnerLabel();
            const uniqueId = `start-${innerLabel}-${place.id}-${index}`;
            const newPlace = this.buildPlace(uniqueId, place.displayLabel, 0, {
                innerLabel,
                hideTokens: true,
                labelPlacement: 'below',
                isStartPlace: true,
            });
            newPlace.x = startX;
            newPlace.y = viewBox.minY + padding + spacing * index + spacing / 2;
            newElements.push({ id: uniqueId, node: newPlace });
        });

        this.drawnElements.set(newElements);
        this.toaster.showSuccess('TOASTER.HEADER.START_POSITION', 'TOASTER.BODY.START_PLACES_CREATED', {
            duration: 0,
            toastPosition: TOAST_POSITIONS.TOP_CENTER,
            messageParams: { count: newElements.length },
        });
    }

    private getNextInnerLabel(): string {
        return `b${++this.bLabelCounter}`;
    }

    private getNextTransitionInnerLabel(): string {
        return `e${++this.eLabelCounter}`;
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
            innerLabel: options?.innerLabel ?? this.getNextInnerLabel(),
            hideTokens: options?.hideTokens ?? true,
            labelPlacement: options?.labelPlacement ?? 'below',
            isStartPlace: options?.isStartPlace ?? false,
        });
    }

    private buildTransition(id: string, label: string, options?: DiagramTransitionOptions): DiagramTransition {
        const innerLabel = options?.innerLabel ?? this.getNextTransitionInnerLabel();
        return new DiagramTransition(id, label, [], [], [], [], { innerLabel });
    }

    private isMarkedPlaceId(placeId: string): boolean {
        return this.getRequiredStartPlaceCount(placeId) > 0;
    }

    private getRequiredStartPlaceCount(placeId: string): number {
        const base = this.displayService.diagram;
        if (!base) {
            return 0;
        }
        const node = base.getNodes().find((n) => n.id === placeId && n.shape === SHAPE.CIRCLE);
        if (!node) {
            return 0;
        }
        const tokens = node.tokenCount();
        return Math.max(0, Math.floor(tokens));
    }

    private getCurrentStartPlaceCount(placeId: string): number {
        return this.drawnElements().filter((el) => {
            if (!(el.node instanceof DiagramPlace) || !el.node.isStartPlace) {
                return false;
            }
            const label = el.node.label ?? el.node.displayLabel;
            return label === placeId;
        }).length;
    }

    private shouldMarkAsStart(placeId: string): boolean {
        if (!this.isMarkedPlaceId(placeId)) {
            return false;
        }
        return this.getCurrentStartPlaceCount(placeId) < this.getRequiredStartPlaceCount(placeId);
    }
}
