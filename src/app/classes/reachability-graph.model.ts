import { DisplayableEdge, DisplayableGraph, DisplayableNode } from './displayable-graph.interface';
import { SHAPE } from './diagram/diagram-node';
import { Coords } from './json-petri-net';
import { signal, Signal, WritableSignal } from '@angular/core';

/**
 * A node representing a state in the reachability graph.
 */
export class StateNode implements DisplayableNode {
    id: string;
    _x: WritableSignal<number>;
    _y: WritableSignal<number>;
    label: string;
    rGMarking: Record<string, number>;
    firingPath: string;

    //To-Do: is StartNode :true -- kann aber trotzdem Vorgänger haben

    get shape(): SHAPE {
        return SHAPE.CIRCLE;
    }
    get displayLabel(): string {
        return `[${this.label}]`;
    }

    get tokenCount(): Signal<number> {
        return signal(0);
    }

    constructor(id: string, x: number, y: number, label: string, marking: Record<string, number>, firingPath = '') {
        this.id = id;
        this._x = signal(x);
        this._y = signal(y);
        this.label = label;
        this.rGMarking = marking;
        this.firingPath = firingPath;
    }

    get x(): number {
        return this._x();
    }

    set x(value: number) {
        this._x.set(value);
    }

    get y(): number {
        return this._y();
    }

    set y(value: number) {
        this._y.set(value);
    }
}

/**
 * An edge representing a transition firing in the reachability graph.
 */
export class FiringEdge implements DisplayableEdge {
    id: string;
    source: string;
    target: string;
    displayLabel: string;
    bendPoints: Coords[] = [];
    rgFiringSequencePath: string;

    constructor(id: string, source: string, target: string, transitionLabel: string, firedSequence: string) {
        this.id = id;
        this.source = source;
        this.target = target;
        this.displayLabel = transitionLabel;
        this.rgFiringSequencePath = firedSequence;
    }
}

/**
 * The reachability graph of a Petri net.
 */
export class ReachabilityGraph implements DisplayableGraph {
    nodes: StateNode[] = [];
    edges: FiringEdge[] = [];

    getNodes(): DisplayableNode[] {
        return this.nodes;
    }
    getEdges(): DisplayableEdge[] {
        return this.edges;
    }
}
