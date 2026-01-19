import { computed, effect, ElementRef, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { DiagramNode } from '../classes/diagram/diagram-node';
import { DiagramPlace, DiagramPlaceLabelPlacement } from '../classes/diagram/diagram-place';
import { DiagramTransition, DiagramTransitionOptions } from '../classes/diagram/diagram-transition';
import { DiagramArc } from '../classes/diagram/diagram-arc';
import { PanningService } from './panning.service';
import { ParserService } from './parser.service';
import { SourcePetriNetService } from './source-petri-net.service';
import { SpringEmbedderService } from './spring-embedder.service';
import { DisplayService } from './display.service';
import { ToasterNotificationService } from './toaster-notification.service';
import { Tab } from '../classes/tabs';
import { Diagram } from '../classes/diagram/diagram';
import { firstValueFrom, Subscription } from 'rxjs';
import { SerializationService } from './serialization.service';
import { ModeService } from './mode.service';
import { TranslateService } from '@ngx-translate/core';
import { TOAST_POSITIONS, ToastList } from '../classes/toast';
import { applyParallelOffsetsToArcs, DEFAULT_PARALLEL_OFFSET } from './arc-parallel-offset.util';
import { MatDialog } from '@angular/material/dialog';
import { LabelEditDialogComponent } from '../components/label-edit-dialog/label-edit-dialog.component';
import { PLACE_RADIUS as DISPLAY_PLACE_RADIUS, TRANSITION_SIZE } from '../components/display/display.constants';
import { TabStateService } from './tab-state.service';
import { ProcessNetStateService } from './process-net-state.service';

export interface DrawnElement {
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

export interface TuplePreview {
    places: string[];
    transitions: string[];
    arcs: { raw: string; source: string; target: string }[];
    marking: { raw: string; label: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: any;

@Injectable()
export class DrawService implements OnDestroy {
    drawnElements = signal<DrawnElement[]>([]);
    connections = signal<Connection[]>([]);
    isDragOver = signal(false);
    selectedElementId = signal<string | null>(null);
    hoveredElementId = signal<string | null>(null);
    hoveredConnectionId = signal<string | null>(null);
    showTuplePreviewOnly = signal(false);

    private _tabStateService = inject(TabStateService);
    private _processNetStateService = inject(ProcessNetStateService);

    readonly connectionLines = computed(() => {
        const nodeMap = new Map<string, DrawnElement>();
        this.drawnElements().forEach((el) => nodeMap.set(el.id, el));

        const groups = new Map<string, Connection[]>();
        this.connections().forEach((conn) => {
            if (!nodeMap.has(conn.aId) || !nodeMap.has(conn.bId)) return;
            const key = conn.aId < conn.bId ? `${conn.aId}~${conn.bId}` : `${conn.bId}~${conn.aId}`;
            const list = groups.get(key) || [];
            list.push(conn);
            groups.set(key, list);
        });

        const lines: { id: string; x1: number; y1: number; x2: number; y2: number; weight: number }[] = [];

        groups.forEach((group, key) => {
            const [aId, bId] = key.split('~');
            const nodeA = nodeMap.get(aId);
            const nodeB = nodeMap.get(bId);
            if (!nodeA || !nodeB) return;

            const baseDx = nodeB.node.x - nodeA.node.x;
            const baseDy = nodeB.node.y - nodeA.node.y;
            const baseLen = Math.hypot(baseDx, baseDy) || 1;
            const basePerpX = -baseDy / baseLen;
            const basePerpY = baseDx / baseLen;

            const forward = group
                .filter((c) => c.aId === aId && c.bId === bId)
                .sort((c1, c2) => c1.id.localeCompare(c2.id));
            const backward = group
                .filter((c) => c.aId === bId && c.bId === aId)
                .sort((c1, c2) => c1.id.localeCompare(c2.id));

            const addLines = (list: Connection[], baseShiftSign: -1 | 0 | 1, pairedExists: boolean) => {
                const centerIndex = (list.length - 1) / 2;
                list.forEach((conn, idx) => {
                    const a = nodeMap.get(conn.aId);
                    const b = nodeMap.get(conn.bId);
                    if (!a || !b) return;
                    let offset = (idx - centerIndex) * this.CONNECTION_PARALLEL_OFFSET;
                    if (baseShiftSign !== 0) {
                        offset += baseShiftSign * (this.CONNECTION_PARALLEL_OFFSET / 2);
                    }
                    if (Math.abs(offset) < 0.01 && pairedExists) {
                        offset = this.CONNECTION_PARALLEL_OFFSET / 2;
                    }
                    const { x1, y1, x2, y2 } = this.computeOffsetTrimmedLine(a, b, offset, basePerpX, basePerpY);
                    lines.push({ id: conn.id, x1, y1, x2, y2, weight: conn.weight });
                });
            };

            if (group.length === 1) {
                addLines(group, 0, false);
                return;
            }
            addLines(forward, 0, backward.length > 0);
            addLines(backward, -1, forward.length > 0);
        });

        return lines;
    });

    tupleString = signal('');
    readonly tuplePreview = computed(() => this.parseTuplePreview(this.tupleString()));

    setTupleString(value: string) {
        this.tupleString.set(value);
    }

    showTupleInline() {
        this.showTuplePreviewOnly.set(false);
    }

    showTuplePreviewIfAvailable() {
        if (this.isExamMode) return;
        const preview = this.tuplePreview();
        if (preview) {
            this.showTuplePreviewOnly.set(true);
        }
    }

    private sourceNetSub?: Subscription;
    private sourceTextSub?: Subscription;
    private suppressNextSourceLoad = false;
    private isClearing = false;

    private drawingArea?: ElementRef<SVGGraphicsElement>;
    private elementIdCounter = 0;
    private connectionIdCounter = 0;
    private placeLabelCounter = 0;
    private transitionLabelCounter = 0;
    private draggedElement: DrawnElement | null = null;
    private dragOffset = { x: 0, y: 0 };
    private svgElement: SVGSVGElement | null = null;
    private isDraggingElement = false;

    private readonly PLACE_RADIUS = DISPLAY_PLACE_RADIUS;
    private readonly TRANSITION_HALF_W = TRANSITION_SIZE / 2;
    private readonly TRANSITION_HALF_H = TRANSITION_SIZE / 2;
    private readonly CONNECTION_PARALLEL_OFFSET = DEFAULT_PARALLEL_OFFSET;

    private _parserService = inject(ParserService);
    private readonly _serializationService = inject(SerializationService);
    private _sourceNetService = inject(SourcePetriNetService);
    private _springEmbedderService = inject(SpringEmbedderService);
    private _displayService = inject(DisplayService);
    private _toaster = inject(ToasterNotificationService);
    private _modeService = inject(ModeService);
    private _translate = inject(TranslateService);
    private panning = inject(PanningService);
    private _dialog = inject(MatDialog);

    readonly viewBox = this.panning.viewBoxAsString;
    readonly viewBoxObj = this.panning.viewBox;
    readonly isExamMode = this._modeService.isExamMode(Tab.DRAW);

    private readonly _examTupleEffect = this.createExamTupleEffect();
    private readonly _examModePreviewEffect = effect(() => {
        if (this.isExamMode) {
            this.showTupleInline();
        }
    });

    init(): void {
        if (this.sourceNetSub || this.sourceTextSub) return;
        this.sourceNetSub = this._sourceNetService.sourceNet$.subscribe((diagram: Diagram | null) => {
            if (this.suppressNextSourceLoad) {
                this.suppressNextSourceLoad = false;
                return;
            }
            if (this.isExamMode) {
                this.handleExamModeSourceUpdate(diagram);
                return;
            }
            if (diagram) {
                this.loadDiagramIntoCanvas(diagram);
                this.resetViewIfReady();
                const tuple = this._serializationService.serializeTuple(diagram);
                if (tuple && !this.isExamMode) {
                    this.tupleString.set(tuple);
                }
                this.showTuplePreviewIfAvailable();
            } else {
                this.clearCanvas(true);
            }
        });

        this.sourceTextSub = this._sourceNetService.sourceText$.subscribe((text: string | null) => {
            if (this.isExamMode && text) {
                this.tupleString.set(text);
                this.showTupleInline();
            }
        });
    }

    setDrawingArea(drawingArea: ElementRef<SVGGraphicsElement> | undefined | null): void {
        if (!drawingArea) return;
        this.drawingArea = drawingArea;
        this.svgElement = (this.drawingArea?.nativeElement as SVGSVGElement) ?? null;
        this.resetViewIfReady();
    }

    ngOnDestroy(): void {
        this.destroy();
    }

    destroy(): void {
        document.removeEventListener('mousemove', this.onDocumentMouseMove, true);
        document.removeEventListener('mouseup', this.onDocumentMouseUp, true);
        this.sourceNetSub?.unsubscribe();
        this.sourceTextSub?.unsubscribe();
        this._examTupleEffect?.destroy?.();
        this._examModePreviewEffect?.destroy?.();
    }

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
        } as GlobalDragData;
    }

    endPaletteDrag() {
        delete window.__dragData;
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
        this.isDragOver.set(true);
    }

    onDragLeave() {
        this.isDragOver.set(false);
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        this.isDragOver.set(false);

        const dragData = window.__dragData as GlobalDragData | undefined;
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
        if (this.isDraggingElement || !this.drawingArea) return;
        const target = event.target as Element | null;
        const isOnElement = target?.closest('.element-wrapper') || target?.classList.contains('drag-overlay');
        if (isOnElement) return;
        this.panning.startPan(event, undefined, this.drawingArea);
    }

    onCanvasPan(event: MouseEvent) {
        if (this.isDraggingElement || !this.drawingArea) return;
        this.panning.pan(event, this.drawingArea);
    }

    onCanvasPanEnd() {
        if (!this.drawingArea) return;
        this.panning.endPan(this.drawingArea);
    }

    onCanvasWheel(event: WheelEvent) {
        if (!this.drawingArea) return;
        this.panning.zoom(event, this.drawingArea, undefined);
    }

    preventContext(event: MouseEvent) {
        event.preventDefault();
    }

    clearCanvas(triggeredByService = false) {
        if (this.isClearing) return;
        this.isClearing = true;
        this.drawnElements.set([]);
        this.connections.set([]);
        this.selectedElementId.set(null);
        this.showTupleInline();
        this.elementIdCounter = 0;
        this.connectionIdCounter = 0;
        this.placeLabelCounter = 0;
        this.transitionLabelCounter = 0;
        if (this.drawingArea) {
            this.panning.resetViewBox(this.drawingArea);
        }
        if (!triggeredByService) {
            this._sourceNetService.clear();
        }
        this._displayService.clear();
        this.isClearing = false;
    }

    generateNetFromInput() {
        const input = this.tupleString().trim();
        if (!input) return;

        const diagram = this._parserService.parse(input);
        if (diagram) {
            this._sourceNetService.loadNewNet(diagram, input);
            this._displayService.display(diagram);
            this.loadDiagramIntoCanvas(diagram);
            this._springEmbedderService.calculateLayout().catch((error) => console.error(error));
            this._toaster.showSuccess('TUPLE_INPUT.TOAST_SUCCESS_HEADER', 'TUPLE_INPUT.TOAST_SUCCESS_BODY');
            this.showTuplePreviewIfAvailable();
        } else {
            this._toaster.showError('TUPLE_INPUT.TOAST_ERROR_HEADER', 'TUPLE_INPUT.TOAST_ERROR_BODY');
        }
    }

    onTupleButtonClick(): void {
        if (this.isExamMode) {
            this.validateDrawnNetAgainstTuple();
            return;
        }
        this.generateNetFromInput();
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
            this.connections.update((cs) => cs.filter((c) => !(c.aId === first.id && c.bId === second.id)));
            const newConn: Connection = {
                id: `conn-${++this.connectionIdCounter}`,
                aId: first.id,
                bId: second.id,
                weight: 1,
            };
            this.connections.update((cs) => [...cs, newConn]);
            this.selectedElementId.set(null);
            this.syncSourceNetFromCanvas();
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
                const newWeight = Math.max(1, c.weight - delta);
                return { ...c, weight: newWeight };
            }),
        );
        this.syncSourceNetFromCanvas();
    }

    onElementWheel(event: WheelEvent, element: DrawnElement) {
        event.preventDefault();
        event.stopPropagation();
        if (!(element.node instanceof DiagramPlace)) return;
        const delta = Math.sign(event.deltaY) || 0;
        if (delta === 0) return;
        const current = element.node.tokenCount();
        element.node.tokens = Math.max(0, current - delta);
        this.syncSourceNetFromCanvas();
    }

    onElementDoubleClick(event: MouseEvent, element: DrawnElement) {
        event.stopImmediatePropagation();
        event.preventDefault();
        if (element.node instanceof DiagramTransition) {
            const currentLabel = element.node.displayLabel ?? element.node.id;
            this.promptForLabel('DRAW.PROMPT_EDIT_TRANSITION_TITLE', currentLabel).then((newLabel) => {
                if (!newLabel || newLabel === currentLabel) return;
                if (this.isLabelTaken(newLabel, element.id)) {
                    this.showDuplicateLabelError(newLabel);
                    return;
                }

                const oldId = element.id;
                this.drawnElements.update((elements) =>
                    elements.map((el) => {
                        if (el.id !== oldId) return el;
                        const updated = this.buildTransition(newLabel, newLabel, { innerLabel: newLabel });
                        updated.x = el.node.x;
                        updated.y = el.node.y;
                        return { id: newLabel, node: updated };
                    }),
                );
                this.connections.update((cs) =>
                    cs.map((c) => ({
                        ...c,
                        aId: c.aId === oldId ? newLabel : c.aId,
                        bId: c.bId === oldId ? newLabel : c.bId,
                    })),
                );
                if (this.selectedElementId() === oldId) {
                    this.selectedElementId.set(newLabel);
                }
                this.syncSourceNetFromCanvas();
            });
            return;
        }

        if (element.node instanceof DiagramPlace) {
            const currentLabel = element.node.label ?? element.node.displayLabel;
            this.promptForLabel('DRAW.PROMPT_EDIT_PLACE_TITLE', currentLabel).then((newLabel) => {
                if (!newLabel || newLabel === currentLabel) return;
                if (this.isLabelTaken(newLabel, element.id)) {
                    this.showDuplicateLabelError(newLabel);
                    return;
                }

                const oldId = element.id;
                this.drawnElements.update((elements) =>
                    elements.map((el) => {
                        if (el.id !== oldId) return el;
                        const updated = this.buildPlace(newLabel, newLabel, el.node.tokenCount(), {
                            labelPlacement: 'below',
                        });
                        updated.x = el.node.x;
                        updated.y = el.node.y;
                        return { id: newLabel, node: updated };
                    }),
                );
                this.connections.update((cs) =>
                    cs.map((c) => ({
                        ...c,
                        aId: c.aId === oldId ? newLabel : c.aId,
                        bId: c.bId === oldId ? newLabel : c.bId,
                    })),
                );
                if (this.selectedElementId() === oldId) {
                    this.selectedElementId.set(newLabel);
                }
                this.syncSourceNetFromCanvas();
            });
        }
    }

    private async promptForLabel(titleKey: string, current: string | undefined | null): Promise<string | undefined> {
        const dialogRef = this._dialog.open(LabelEditDialogComponent, {
            width: '360px',
            data: { title: titleKey, label: current ?? '' },
        });

        const result = await firstValueFrom(dialogRef.afterClosed());
        return typeof result === 'string' ? result.trim() : undefined;
    }

    private createExamTupleEffect() {
        return effect(() => {
            if (!this.isExamMode) return;
            const sourceDiagram = this._sourceNetService.getCurrentSourceNet();
            const sourceText = this._sourceNetService.getSourceText();
            if (sourceDiagram) {
                const tupleFromSource = this._serializationService.serializeTuple(sourceDiagram);
                if (tupleFromSource) {
                    this.tupleString.set(tupleFromSource);
                }
                return;
            }
            if (sourceText) {
                this.tupleString.set(sourceText);
            }
        });
    }

    private handleExamModeSourceUpdate(diagram: Diagram | null) {
        if (diagram) {
            this.clearCanvas(true);
            const tuple = this._serializationService.serializeTuple(diagram);
            if (tuple) {
                this.tupleString.set(tuple);
            } else {
                const text = this._sourceNetService.getSourceText();
                if (text) this.tupleString.set(text);
            }
            this.showTupleInline();
            return;
        }

        const text = this._sourceNetService.getSourceText();
        if (text) {
            this.tupleString.set(text);
            this.showTupleInline();
        } else {
            this.clearCanvas(true);
        }
    }

    private resetViewIfReady() {
        if (this.drawingArea) {
            this.panning.resetViewBox(this.drawingArea);
            // Nudge view down so top overlays (tuple input/preview) don't cover the net
            this.panning.nudgeViewBox(0, -70);
            // Slightly zoom out to keep bottom content visible after the nudge
            this.panning.expandViewBox(1.1);
        }
    }

    private validateDrawnNetAgainstTuple() {
        const tupleText = this.tupleString().trim();
        if (!tupleText) {
            this._toaster.showError('TUPLE_INPUT.TOAST_INVALIDATION_HEADER', 'TUPLE_INPUT.TOAST_INVALIDATION_BODY', {
                duration: 0,
                toastPosition: TOAST_POSITIONS.TOP_CENTER,
            });
            return;
        }

        const parsed = this._parserService.parse(tupleText);
        if (!parsed) {
            this._toaster.showError('TUPLE_INPUT.TOAST_INVALIDATION_HEADER', 'TUPLE_INPUT.TOAST_INVALIDATION_BODY', {
                duration: 0,
                toastPosition: TOAST_POSITIONS.TOP_CENTER,
            });
            return;
        }

        const drawnDiagram = this.buildDiagramFromCanvas();

        const placeLabel = (p: DiagramPlace) => p.label ?? p.displayLabel ?? p.id;
        const transitionLabel = (t: DiagramTransition) => t.label ?? t.displayLabel ?? t.id;

        const parsedPlaceLabelById = new Map(parsed.places.map((p) => [p.id, placeLabel(p)]));
        const parsedTransitionLabelById = new Map(parsed.transitions.map((t) => [t.id, transitionLabel(t)]));
        const drawnPlaceLabelById = new Map(drawnDiagram.places.map((p) => [p.id, placeLabel(p)]));
        const drawnTransitionLabelById = new Map(drawnDiagram.transitions.map((t) => [t.id, transitionLabel(t)]));

        const idToLabel = (id: string, placeMap: Map<string, string>, transitionMap: Map<string, string>) =>
            placeMap.get(id) ?? transitionMap.get(id) ?? id;

        const expectedPlaces = new Set(
            parsed.places.map((p) => idToLabel(p.id, parsedPlaceLabelById, parsedTransitionLabelById)),
        );
        const drawnPlaces = new Set(
            drawnDiagram.places.map((p) => idToLabel(p.id, drawnPlaceLabelById, drawnTransitionLabelById)),
        );

        const expectedTransitions = new Set(
            parsed.transitions.map((t) => idToLabel(t.id, parsedPlaceLabelById, parsedTransitionLabelById)),
        );
        const drawnTransitions = new Set(
            drawnDiagram.transitions.map((t) => idToLabel(t.id, drawnPlaceLabelById, drawnTransitionLabelById)),
        );

        const expectedArcs = new Map<string, number>(
            parsed.arcs.map((a) => {
                const srcLabel = idToLabel(a.source, parsedPlaceLabelById, parsedTransitionLabelById);
                const tgtLabel = idToLabel(a.target, parsedPlaceLabelById, parsedTransitionLabelById);
                return [`${srcLabel}->${tgtLabel}`, a.weight ?? 1];
            }),
        );
        const drawnArcs = new Map<string, number>(
            drawnDiagram.arcs.map((a) => {
                const srcLabel = idToLabel(a.source, drawnPlaceLabelById, drawnTransitionLabelById);
                const tgtLabel = idToLabel(a.target, drawnPlaceLabelById, drawnTransitionLabelById);
                return [`${srcLabel}->${tgtLabel}`, a.weight ?? 1];
            }),
        );

        const expectedTokens = new Map<string, number>(
            parsed.places.map((p) => [
                idToLabel(p.id, parsedPlaceLabelById, parsedTransitionLabelById),
                p.tokenCount(),
            ]),
        );
        const drawnTokens = new Map<string, number>(
            drawnDiagram.places.map((p) => [
                idToLabel(p.id, drawnPlaceLabelById, drawnTransitionLabelById),
                p.tokenCount(),
            ]),
        );

        const errors: string[] = [];

        const missingPlaces = [...expectedPlaces].filter((p) => !drawnPlaces.has(p));
        const extraPlaces = [...drawnPlaces].filter((p) => !expectedPlaces.has(p));
        if (missingPlaces.length)
            errors.push(
                this._translate.instant('TUPLE_INPUT.VALIDATION.MISSING_PLACES', {
                    items: missingPlaces.join(', '),
                }),
            );
        if (extraPlaces.length)
            errors.push(
                this._translate.instant('TUPLE_INPUT.VALIDATION.EXTRA_PLACES', {
                    items: extraPlaces.join(', '),
                }),
            );

        const missingTransitions = [...expectedTransitions].filter((t) => !drawnTransitions.has(t));
        const extraTransitions = [...drawnTransitions].filter((t) => !expectedTransitions.has(t));
        if (missingTransitions.length)
            errors.push(
                this._translate.instant('TUPLE_INPUT.VALIDATION.MISSING_TRANSITIONS', {
                    items: missingTransitions.join(', '),
                }),
            );
        if (extraTransitions.length)
            errors.push(
                this._translate.instant('TUPLE_INPUT.VALIDATION.EXTRA_TRANSITIONS', {
                    items: extraTransitions.join(', '),
                }),
            );

        expectedArcs.forEach((weight, key) => {
            const drawnWeight = drawnArcs.get(key);
            if (drawnWeight === undefined) {
                errors.push(
                    this._translate.instant('TUPLE_INPUT.VALIDATION.MISSING_ARC', {
                        arc: key,
                    }),
                );
            } else if (drawnWeight !== weight) {
                errors.push(
                    this._translate.instant('TUPLE_INPUT.VALIDATION.ARC_WEIGHT_MISMATCH', {
                        arc: key,
                        expected: weight,
                        found: drawnWeight,
                    }),
                );
            }
        });
        drawnArcs.forEach((weight, key) => {
            if (!expectedArcs.has(key)) {
                errors.push(
                    this._translate.instant('TUPLE_INPUT.VALIDATION.EXTRA_ARC', {
                        arc: key,
                    }),
                );
            }
        });

        expectedTokens.forEach((weight, placeId) => {
            const drawnToken = drawnTokens.get(placeId) ?? 0;
            if (drawnToken !== weight) {
                const diff = weight - drawnToken;
                errors.push(
                    diff > 0
                        ? this._translate.instant('TUPLE_INPUT.VALIDATION.TOKENS_MISSING', {
                              count: Math.abs(diff),
                              place: placeId,
                              expected: weight,
                              found: drawnToken,
                          })
                        : this._translate.instant('TUPLE_INPUT.VALIDATION.TOKENS_EXTRA', {
                              count: Math.abs(diff),
                              place: placeId,
                              expected: weight,
                              found: drawnToken,
                          }),
                );
            }
        });
        drawnTokens.forEach((weight, placeId) => {
            if (!expectedTokens.has(placeId) && weight !== 0) {
                errors.push(
                    this._translate.instant('TUPLE_INPUT.VALIDATION.TOKENS_UNEXPECTED', {
                        place: placeId,
                        found: weight,
                    }),
                );
            }
        });

        if (errors.length === 0) {
            this._toaster.showSuccess('TUPLE_INPUT.TOAST_VALIDATION_HEADER', 'TUPLE_INPUT.TOAST_VALIDATION_BODY', {
                duration: 0,
                toastPosition: TOAST_POSITIONS.TOP_CENTER,
            });
            return;
        }

        const list: ToastList[] = errors.map((message) => ({ message }));
        this._toaster.showError('TUPLE_INPUT.TOAST_INVALIDATION_HEADER', 'TUPLE_INPUT.TOAST_INVALIDATION_BODY', {
            duration: 0,
            toastPosition: TOAST_POSITIONS.TOP_CENTER,
            list,
        });
    }

    private showDuplicateLabelError(label: string) {
        this._toaster.showError('DRAW.TOAST_DUPLICATE_LABEL_HEADER', 'DRAW.TOAST_DUPLICATE_LABEL_BODY', {
            messageParams: { label },
        });
    }

    private isLabelTaken(label: string, ignoreId?: string): boolean {
        if (label === ignoreId) return false;
        return this.drawnElements().some((el) => el.id === label);
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
        this.syncSourceNetFromCanvas();
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
        const newId = label;
        if (this.isLabelTaken(newId)) {
            this.showDuplicateLabelError(newId);
            return;
        }
        let newNode: DiagramNode;
        if (type === 'place') {
            newNode = this.buildPlace(newId, label, 0, {
                labelPlacement: 'below',
                innerLabel: undefined,
                hideTokens: false,
            });
        } else {
            newNode = this.buildTransition(newId, label, { innerLabel: label });
        }
        newNode.x = x;
        newNode.y = y;
        this.drawnElements.update((elements) => [...elements, { id: newId, node: newNode }]);
        this.syncSourceNetFromCanvas();
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
        this.syncSourceNetFromCanvas();
    }

    private deleteConnection(connectionId: string) {
        this.connections.update((cs) => cs.filter((c) => c.id !== connectionId));
        this.syncSourceNetFromCanvas();
    }

    private getElementById(id: string): DrawnElement | undefined {
        return this.drawnElements().find((e) => e.id === id);
    }

    private syncSourceNetFromCanvas() {
        if (this.isExamMode) {
            return;
        }
        const diagram = this.buildDiagramFromCanvas();

        this.suppressNextSourceLoad = true;
        this._sourceNetService.updateEditedNet(diagram);
        this._tabStateService.setAllLastMarkings(diagram.marking);
        this._displayService.display(diagram);
        this._processNetStateService.clear();

        const tuple = this._serializationService.serializeTuple(diagram);
        if (tuple && !this.isExamMode) {
            this.tupleString.set(tuple);
        }
    }

    private buildDiagramFromCanvas(): Diagram {
        const places: DiagramPlace[] = [];
        const transitions: DiagramTransition[] = [];

        const placeMap = new Map<string, DiagramPlace>();
        const transitionMap = new Map<
            string,
            {
                transition: DiagramTransition;
                inputPlaces: DiagramPlace[];
                outputPlaces: DiagramPlace[];
                inputArcs: DiagramArc[];
                outputArcs: DiagramArc[];
            }
        >();

        this.drawnElements().forEach((el) => {
            if (el.node instanceof DiagramPlace) {
                const place = new DiagramPlace(
                    el.node.id,
                    el.node.tokenCount(),
                    el.node.label ?? el.node.displayLabel,
                    {
                        labelPlacement: el.node.labelPlacement,
                        hideTokens: el.node.hideTokens,
                        innerLabel: el.node.innerLabel,
                        isStartPlace: el.node.isStartPlace,
                    },
                );
                place.x = el.node.x;
                place.y = el.node.y;
                places.push(place);
                placeMap.set(place.id, place);
            } else if (el.node instanceof DiagramTransition) {
                const label = el.node.displayLabel ?? el.node.id;
                const inputPlaces: DiagramPlace[] = [];
                const outputPlaces: DiagramPlace[] = [];
                const inputArcs: DiagramArc[] = [];
                const outputArcs: DiagramArc[] = [];
                const transition = new DiagramTransition(
                    el.node.id,
                    label,
                    inputPlaces,
                    outputPlaces,
                    inputArcs,
                    outputArcs,
                    {
                        innerLabel: el.node.innerLabel ?? label,
                    },
                );
                transition.x = el.node.x;
                transition.y = el.node.y;
                transitions.push(transition);
                transitionMap.set(transition.id, {
                    transition,
                    inputPlaces,
                    outputPlaces,
                    inputArcs,
                    outputArcs,
                });
            }
        });

        const arcs: DiagramArc[] = [];
        this.connections().forEach((conn, idx) => {
            const arc = new DiagramArc(conn.id || `arc-${idx + 1}`, conn.aId, conn.bId, conn.weight);
            arcs.push(arc);

            const placeSource = placeMap.get(conn.aId);
            const placeTarget = placeMap.get(conn.bId);
            const transitionSource = transitionMap.get(conn.aId);
            const transitionTarget = transitionMap.get(conn.bId);

            if (placeSource && transitionTarget) {
                transitionTarget.inputPlaces.push(placeSource);
                transitionTarget.inputArcs.push(arc);
            } else if (transitionSource && placeTarget) {
                transitionSource.outputPlaces.push(placeTarget);
                transitionSource.outputArcs.push(arc);
            }
        });

        const nodeLookup = new Map<string, DiagramNode>();
        placeMap.forEach((p, id) => nodeLookup.set(id, p));
        transitionMap.forEach((t, id) => nodeLookup.set(id, t.transition));
        this.applyParallelOffsetsToArcs(arcs, nodeLookup);

        return new Diagram(places, transitions, arcs);
    }

    private applyParallelOffsetsToArcs(arcs: DiagramArc[], nodeMap: Map<string, DiagramNode>): void {
        applyParallelOffsetsToArcs(arcs, nodeMap, this.CONNECTION_PARALLEL_OFFSET);
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
        let candidate: string;
        do {
            candidate = `p${++this.placeLabelCounter}`;
        } while (this.isLabelTaken(candidate));
        return candidate;
    }

    private getNextTransitionLabel() {
        let candidate: string;
        do {
            candidate = `t${++this.transitionLabelCounter}`;
        } while (this.isLabelTaken(candidate));
        return candidate;
    }

    private getNodeLabel(node: DiagramNode): string {
        if (node instanceof DiagramPlace) return node.displayLabel;
        if (node instanceof DiagramTransition) return node.displayLabel;
        return node.displayLabel ?? node.id;
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

    private computeOffsetTrimmedLine(
        a: DrawnElement,
        b: DrawnElement,
        offset: number,
        basePerpX?: number,
        basePerpY?: number,
    ) {
        const ax = a.node.x;
        const ay = a.node.y;
        const bx = b.node.x;
        const by = b.node.y;
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        const perpX = basePerpX ?? -dy / len;
        const perpY = basePerpY ?? dx / len;

        const shiftedAx = ax + perpX * offset;
        const shiftedAy = ay + perpY * offset;
        const shiftedBx = bx + perpX * offset;
        const shiftedBy = by + perpY * offset;

        const start = this.trimEndpoint(a.node, shiftedAx, shiftedAy, shiftedBx, shiftedBy);
        const end = this.trimEndpoint(b.node, shiftedBx, shiftedBy, shiftedAx, shiftedAy);

        return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    }

    private trimEndpoint(
        node: DiagramNode,
        originX: number,
        originY: number,
        targetX: number,
        targetY: number,
    ): { x: number; y: number } {
        const dx = targetX - originX;
        const dy = targetY - originY;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;

        if (node instanceof DiagramPlace) {
            return { x: originX + ux * this.PLACE_RADIUS, y: originY + uy * this.PLACE_RADIUS };
        }
        if (node instanceof DiagramTransition) {
            const halfW = this.TRANSITION_HALF_W;
            const halfH = this.TRANSITION_HALF_H;
            const xIntercept = Math.abs(ux) > 0 ? halfW / Math.abs(ux) : Number.POSITIVE_INFINITY;
            const yIntercept = Math.abs(uy) > 0 ? halfH / Math.abs(uy) : Number.POSITIVE_INFINITY;
            const intercept = Math.min(xIntercept, yIntercept);
            return { x: originX + ux * intercept, y: originY + uy * intercept };
        }
        return { x: originX, y: originY };
    }

    private parseTuplePreview(text: string): TuplePreview | null {
        const cleaned = text.trim();
        if (!cleaned.startsWith('(') || !cleaned.endsWith(')')) return null;
        const inner = cleaned.slice(1, -1);
        const parts = this.splitTopLevel(inner, ',');
        if (parts.length < 4) return null;

        const placePart = parts[0].trim();
        const transitionPart = parts[1].trim();
        const arcsPart = parts[2].trim();
        const markingPart = parts.slice(3).join(',').trim();

        const places = this.parseSet(placePart);
        const transitions = this.parseSet(transitionPart);
        const arcs = this.parseArcs(arcsPart);
        const marking = this.parseMarking(markingPart);

        return { places, transitions, arcs, marking };
    }

    private parseSet(part: string): string[] {
        const match = part.match(/^\{(.+)\}$/);
        if (!match) return [];
        return match[1]
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
    }

    private parseArcs(part: string): { raw: string; source: string; target: string }[] {
        const arcs: { raw: string; source: string; target: string }[] = [];
        const regex = /(\d+\s*\*\s*)?\(\s*([^,\s]+)\s*,\s*([^,\s)]+)\s*\)/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(part))) {
            arcs.push({ raw: match[0], source: match[2], target: match[3] });
        }
        return arcs;
    }

    private parseMarking(part: string): { raw: string; label: string }[] {
        if (!part) return [];
        return part
            .split('+')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .map((raw) => {
                const match = raw.match(/\d+\s*\*\s*([^\s]+)/) || raw.match(/([^\s]+)/);
                const label = match ? match[1] : raw;
                return { raw, label };
            });
    }

    private splitTopLevel(text: string, separator: string): string[] {
        const result: string[] = [];
        let depthParens = 0;
        let depthBraces = 0;
        let start = 0;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '(') depthParens++;
            else if (ch === ')') depthParens = Math.max(0, depthParens - 1);
            else if (ch === '{') depthBraces++;
            else if (ch === '}') depthBraces = Math.max(0, depthBraces - 1);
            else if (ch === separator && depthParens === 0 && depthBraces === 0) {
                result.push(text.slice(start, i));
                start = i + 1;
            }
        }
        result.push(text.slice(start));
        return result;
    }

    setHoveredElementId(id: string | null) {
        if (this.isExamMode) {
            this.hoveredElementId.set(null);
            this.hoveredConnectionId.set(null);
            return;
        }
        this.hoveredElementId.set(id);
        if (id !== null) {
            this.hoveredConnectionId.set(null);
            if (!this.showTuplePreviewOnly()) {
                this.showTuplePreviewIfAvailable();
            }
        }
    }

    setHoveredConnectionId(id: string | null) {
        if (this.isExamMode) {
            this.hoveredElementId.set(null);
            this.hoveredConnectionId.set(null);
            return;
        }
        this.hoveredConnectionId.set(id);
        if (id !== null) {
            this.hoveredElementId.set(null);
            if (!this.showTuplePreviewOnly()) {
                this.showTuplePreviewIfAvailable();
            }
        }
    }

    setHoveredElementByLabel(label: string | null) {
        if (!label) {
            this.setHoveredElementId(null);
            return;
        }
        const id = this.getElementIdByLabel(label);
        this.setHoveredElementId(id);
    }

    setHoveredConnectionByLabels(sourceLabel: string | null, targetLabel: string | null) {
        if (!sourceLabel || !targetLabel) {
            this.setHoveredConnectionId(null);
            return;
        }
        const id = this.getConnectionIdByLabels(sourceLabel, targetLabel);
        this.setHoveredConnectionId(id);
    }

    getElementIdByLabel(label: string): string | null {
        const normalized = label.trim();
        const match = this.drawnElements().find((el) => this.getNodeLabel(el.node) === normalized);
        return match?.id ?? null;
    }

    getConnectionIdByLabels(sourceLabel: string, targetLabel: string): string | null {
        const srcId = this.getElementIdByLabel(sourceLabel);
        const tgtId = this.getElementIdByLabel(targetLabel);
        if (!srcId || !tgtId) return null;
        const conn = this.connections().find((c) => c.aId === srcId && c.bId === tgtId);
        return conn?.id ?? null;
    }
}
