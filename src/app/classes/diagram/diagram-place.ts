import { DiagramNode, SHAPE } from './diagram-node';
import { Signal, signal } from '@angular/core';

export class DiagramPlace extends DiagramNode {
    private _tokens = signal<number>(0);
    private _label?: string; // original label (place id) for display

    constructor(id: string, initialTokens = 0, label?: string) {
        super(id);
        this._tokens.set(initialTokens);
        this._label = label;
    }

    override get tokenCount(): Signal<number> {
        return this._tokens;
    }

    set tokens(value: number) {
        this._tokens.set(value);
    }

    override get shape(): SHAPE {
        return SHAPE.CIRCLE;
    }

    // Expose original label (place id) if available
    get label(): string | undefined {
        return this._label;
    }

    override get displayLabel(): string {
        return this._label ?? this.id;
    }
}
