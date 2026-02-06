import { DisplayableEdge, DisplayableGraph, DisplayableNode } from '../displayable-graph.interface';
import { Connection, DrawnElement } from './drawn-element';
import { Signal } from '@angular/core';

export class CanvasDiagram implements DisplayableGraph {
    constructor(
        private readonly elementsSignal: Signal<DrawnElement[]>,
        private readonly connectionsSignal: Signal<Connection[]>,
    ) {}

    getNodes(): DisplayableNode[] {
        return this.elementsSignal().map((e) => e.node);
    }

    getEdges(): DisplayableEdge[] {
        return this.connectionsSignal().map((c) => ({
            id: c.id,
            source: c.aId,
            target: c.bId,
            displayLabel: c.weight > 1 ? c.weight.toString() : '',
            bendPoints: [],
        }));
    }
}
