import { Coords } from '../json-petri-net';
import { DisplayableEdge } from '../displayable-graph.interface';

export class DiagramArc implements DisplayableEdge {
    private readonly _id: string;
    private readonly _source: string;
    private readonly _target: string;
    private readonly _weight: number;
    private _bendPoints: Coords[];

    constructor(id: string, source: string, target: string, weight = 1, bendPoints: Coords[] = []) {
        this._id = id;
        this._source = source;
        this._target = target;
        this._weight = weight;
        this._bendPoints = bendPoints;
    }

    get id(): string {
        return this._id;
    }

    get source(): string {
        return this._source;
    }

    get target(): string {
        return this._target;
    }

    get weight(): number {
        return this._weight;
    }

    get displayLabel(): string {
        return this.weight > 1 ? `${this.weight}` : '';
    }

    get bendPoints(): Coords[] {
        return this._bendPoints;
    }

    set bendPoints(bendPoints: Coords[]) {
        this._bendPoints = bendPoints;
    }
}
