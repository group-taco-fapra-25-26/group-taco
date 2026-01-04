import { signal } from '@angular/core';
import { DiagramArc } from './diagram-arc';
import { DiagramNode, SHAPE } from './diagram-node';
import { DiagramPlace } from './diagram-place';

export interface DiagramTransitionOptions {
    innerLabel?: string;
}

export class DiagramTransition extends DiagramNode {
    private readonly _label: string;
    private readonly _inputPlaces: DiagramPlace[];
    private readonly _outputPlaces: DiagramPlace[];
    private readonly _inputArcs: DiagramArc[];
    private readonly _outputArcs: DiagramArc[];
    private readonly _innerLabel?: string;

    isFiring = signal<boolean>(false);

    constructor(
        id: string,
        label: string,
        inputPlaces: DiagramPlace[] = [],
        outputPlaces: DiagramPlace[] = [],
        inputArcs: DiagramArc[] = [],
        outputArcs: DiagramArc[] = [],
        options?: DiagramTransitionOptions,
    ) {
        super(id);
        this._label = label || id;
        this._inputPlaces = inputPlaces;
        this._outputPlaces = outputPlaces;
        this._inputArcs = inputArcs;
        this._outputArcs = outputArcs;
        this._innerLabel = options?.innerLabel;
    }

    get label(): string {
        return this._label;
    }

    get innerLabel(): string | undefined {
        return this._innerLabel;
    }

    override get shape(): SHAPE {
        return SHAPE.RECT;
    }

    override get displayLabel(): string {
        return this._label;
    }

    public isActivated(): boolean {
        return this._inputPlaces.every((place, index) => place.tokenCount() >= this._inputArcs[index].weight);
    }

    public fire(displayFiring: boolean): void {
        this._inputArcs.forEach((arc, i) => {
            const place = this._inputPlaces[i];
            place.tokens = place.tokenCount() - arc.weight;
        });
        this._outputArcs.forEach((arc, i) => {
            const place = this._outputPlaces[i];
            place.tokens = place.tokenCount() + arc.weight;
        });
        if (displayFiring) {
            this.isFiring.set(true);
            setTimeout(() => this.isFiring.set(false), 300);
        }
    }
}
