import { Injectable, signal } from '@angular/core';
import { DiagramNode } from '../classes/diagram/diagram-node';
import { DiagramPlace, DiagramPlaceLabelPlacement } from '../classes/diagram/diagram-place';
import { DiagramTransition } from '../classes/diagram/diagram-transition';
import { Diagram } from '../classes/diagram/diagram';
import { viewBoxValues } from '../components/display/display.constants';
import { Subject } from 'rxjs';
import { AppMode } from '../classes/app-mode';

export interface DrawnElement {
    node: DiagramNode;
    id: string;
}

export interface Connection {
    id: string;
    aId: string; // source element id (first clicked)
    bId: string; // target element id (second clicked)
    weight: number; // arc weight, >= 1
}

@Injectable({ providedIn: 'root' })
export class ProcessNetStateService {
    readonly drawnElements = signal<DrawnElement[]>([]);
    readonly connections = signal<Connection[]>([]);

    private elementIdCounter = 0;
    private connectionIdCounter = 0;

    readonly viewBox = signal<{ minX: number; minY: number; width: number; height: number }>(viewBoxValues);

    private readonly _fitViewRequest$ = new Subject<void>();
    public readonly fitViewRequest$ = this._fitViewRequest$.asObservable();

    requestFitView() {
        this._fitViewRequest$.next();
    }

    updateViewBox(wb: { minX: number; minY: number; width: number; height: number }) {
        this.viewBox.set(wb);
    }

    addDrawnElement(element: DrawnElement) {
        this.drawnElements.update((el) => [...el, element]);
    }

    addConnection(connection: Connection) {
        this.connections.update((c) => [...c, connection]);
    }

    removeDrawnElement(id: string) {
        this.drawnElements.update((elements) => elements.filter((e) => e.id !== id));
        this.connections.update((connections) => connections.filter((c) => c.aId !== id && c.bId !== id));
    }

    removeConnection(id: string) {
        this.connections.update((connections) => connections.filter((c) => c.id !== id));
    }

    updateDrawnElements(updater: (elements: DrawnElement[]) => DrawnElement[]) {
        this.drawnElements.update(updater);
    }

    updateConnections(updater: (connections: Connection[]) => Connection[]) {
        this.connections.update(updater);
    }

    clear(mode?: AppMode, diagram?: Diagram) {
        this.drawnElements.set([]);
        this.connections.set([]);
        this.elementIdCounter = 0;
        this.connectionIdCounter = 0;
        if (mode === AppMode.LEARN && diagram) {
            this.createStartPositions(diagram, viewBoxValues);
        }
    }

    generateElementId(prefix: string): string {
        return `${prefix}-${++this.elementIdCounter}`;
    }

    generateConnectionId(prefix: string): string {
        return `${prefix}-${++this.connectionIdCounter}`;
    }

    getNextInnerLabel(exclude: string[] = []): string {
        const labels = this.drawnElements()
            .map((e) => (e.node instanceof DiagramPlace ? e.node.innerLabel : undefined))
            .concat(exclude);
        return this.findNextAvailableLabel(labels, 'b');
    }

    getNextTransitionInnerLabel(exclude: string[] = []): string {
        const labels = this.drawnElements()
            .map((e) => (e.node instanceof DiagramTransition ? e.node.innerLabel : undefined))
            .concat(exclude);
        return this.findNextAvailableLabel(labels, 'e');
    }

    private findNextAvailableLabel(labels: (string | undefined)[], prefix: string): string {
        const existingLabels = new Set<number>();
        const regex = new RegExp(`^${prefix}(\\d+)$`);

        labels.forEach((label) => {
            if (label) {
                const match = label.match(regex);
                if (match) {
                    existingLabels.add(parseInt(match[1], 10));
                }
            }
        });

        let counter = 1;
        while (existingLabels.has(counter)) {
            counter++;
        }
        return `${prefix}${counter}`;
    }

    buildPlace(
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

    buildTransition(id: string, label: string, innerLabel?: string): DiagramTransition {
        return new DiagramTransition(id, label, [], [], [], [], {
            innerLabel: innerLabel ?? this.getNextTransitionInnerLabel(),
        });
    }

    createStartPositions(diagram: Diagram, baseViewBox: { minX: number; minY: number; width: number; height: number }) {
        const nodes = diagram.getNodes();
        const markedPlaces = nodes.filter((node) => node.shape.toLowerCase() === 'circle' && node.tokenCount() > 0);
        if (markedPlaces.length === 0) return 0;

        const tokenInstances = markedPlaces.flatMap((place) =>
            Array.from({ length: Math.max(0, Math.floor(place.tokenCount())) }, () => place),
        );
        if (tokenInstances.length === 0) return 0;

        const padding = 40;
        const availableHeight = baseViewBox.height - padding * 2;
        const PLACE_RADIUS = 25;
        const minSpacing = PLACE_RADIUS * 2 + 30;
        const spacing = tokenInstances.length > 0 ? Math.max(availableHeight / tokenInstances.length, minSpacing) : 0;

        const newElements: DrawnElement[] = [];
        const startX = baseViewBox.minX + baseViewBox.width * 0.25;
        const reservedLabels: string[] = [];

        tokenInstances.forEach((place, index) => {
            const innerLabel = this.getNextInnerLabel(reservedLabels);
            reservedLabels.push(innerLabel);
            const uniqueId = `start-${innerLabel}-${place.id}-${index}`;
            const newPlace = this.buildPlace(uniqueId, place.displayLabel, 0, {
                innerLabel,
                hideTokens: true,
                labelPlacement: 'below',
                isStartPlace: true,
            });
            newPlace.x = startX;
            newPlace.y = baseViewBox.minY + padding + spacing * index + spacing / 2;
            newElements.push({ id: uniqueId, node: newPlace });
        });

        this.drawnElements.set(newElements);
        return newElements.length;
    }
}
