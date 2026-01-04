import { DisplayableNode } from '../displayable-graph.interface';
import { signal, Signal, WritableSignal } from '@angular/core';

export abstract class DiagramNode implements DisplayableNode {
    private readonly _id: string;
    private readonly _x: WritableSignal<number>;
    private readonly _y: WritableSignal<number>;
    private static readonly _zeroTokens = signal(0);

    protected constructor(id: string) {
        this._id = id;
        this._x = signal(0);
        this._y = signal(0);
    }

    get id(): string {
        return this._id;
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

    abstract get shape(): SHAPE.CIRCLE | SHAPE.RECT;

    get tokenCount(): Signal<number> {
        return DiagramNode._zeroTokens;
    }

    get displayLabel(): string {
        return this._id;
    }
}

export enum SHAPE {
    CIRCLE = 'circle',
    RECT = 'rect',
}
