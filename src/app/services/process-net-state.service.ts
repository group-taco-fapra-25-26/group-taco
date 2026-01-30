import { Injectable, signal } from '@angular/core';
import { DiagramNode } from '../classes/diagram/diagram-node';
import { DiagramPlace, DiagramPlaceLabelPlacement } from '../classes/diagram/diagram-place';
import { DiagramTransition } from '../classes/diagram/diagram-transition';
import { Diagram } from '../classes/diagram/diagram';
import { viewBoxValues } from '../components/display/display.constants';

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
    private bLabelCounter = 0;
    private eLabelCounter = 0;

    readonly viewBox = signal<{ minX: number; minY: number; width: number; height: number }>(viewBoxValues);

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

    clear() {
        this.drawnElements.set([]);
        this.connections.set([]);
        this.elementIdCounter = 0;
        this.connectionIdCounter = 0;
        this.bLabelCounter = 0;
        this.eLabelCounter = 0;
    }

    generateElementId(prefix: string): string {
        return `${prefix}-${++this.elementIdCounter}`;
    }

    generateConnectionId(prefix: string): string {
        return `${prefix}-${++this.connectionIdCounter}`;
    }

    getNextInnerLabel(): string {
        return `b${++this.bLabelCounter}`;
    }

    getNextTransitionInnerLabel(): string {
        return `e${++this.eLabelCounter}`;
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
        const minSpacing = PLACE_RADIUS * 2 + 20;
        const spacing = tokenInstances.length > 0 ? Math.max(availableHeight / tokenInstances.length, minSpacing) : 0;

        const newElements: DrawnElement[] = [];
        const startX = baseViewBox.minX + baseViewBox.width * 0.25;

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
            newPlace.y = baseViewBox.minY + padding + spacing * index + spacing / 2;
            newElements.push({ id: uniqueId, node: newPlace });
        });

        this.drawnElements.set(newElements);
        return newElements.length;
    }
}
