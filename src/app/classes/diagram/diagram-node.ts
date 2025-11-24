import { DisplayableNode } from '../displayable-graph.interface';
import { signal, Signal } from '@angular/core';

export abstract class DiagramNode implements DisplayableNode {
    private readonly _id: string;
    private _x: number;
    private _y: number;
    private _svgElement: SVGElement | undefined;

    protected constructor(id: string) {
        this._id = id;
        this._x = 0;
        this._y = 0;
    }

    get id(): string {
        return this._id;
    }

    get x(): number {
        return this._x;
    }

    set x(value: number) {
        this._x = value;
    }

    get y(): number {
        return this._y;
    }

    set y(value: number) {
        this._y = value;
    }

    abstract get shape(): SHAPE.CIRCLE | SHAPE.RECT;

    // eslint-disable-next-line @typescript-eslint/class-literal-property-style
    get tokenCount(): Signal<number> {
        return signal(0);
    }

    get displayLabel(): string {
        return this._id;
    }

    public registerSvg(svg: SVGElement) {
        this._svgElement = svg;
        this._svgElement.onmousedown = (event) => {
            this.processMouseDown(event);
        };
        this._svgElement.onmouseup = (event) => {
            this.processMouseUp(event);
        };
    }

    private processMouseDown(event: MouseEvent) {
        if (this._svgElement === undefined) {
            return;
        }
        this._svgElement.setAttribute('fill', 'red');
    }

    private processMouseUp(event: MouseEvent) {
        if (this._svgElement === undefined) {
            return;
        }
        this._svgElement.setAttribute('fill', 'black');
    }
}

export enum SHAPE {
    CIRCLE = 'circle',
    RECT = 'rect',
}
