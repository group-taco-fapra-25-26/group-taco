import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Diagram } from '../classes/diagram/diagram';

@Injectable({
    providedIn: 'root',
})
/**
 * This service is responsible for holding the current source petri net.
 * The source petri net is the petri net that is currently being edited by the user.
 * It can be set from a file upload or from a template.
 * Other services can subscribe to the sourceNet$ observable to get updates when the source net changes.
 * The other services can then use the source net to generate other artifacts, like the reachability graph.
 */
export class SourcePetriNetService {
    private readonly _sourceNet$ = new BehaviorSubject<Diagram | null>(null);

    /**
     * Observable that emits the current source Petri net diagram.
     * Can be subscribed to fetch updates when the source net changes.
     */
    public readonly sourceNet$: Observable<Diagram | null> = this._sourceNet$.asObservable();

    /**
     * Sets the current source petri net.
     * @param net The new source petri net.
     */
    public setSourceNet(net: Diagram | null): void {
        this._sourceNet$.next(net);
    }

    /**
     * Gets the current source petri net.
     * @returns The current source petri net.
     */
    public getCurrentSourceNet(): Diagram | null {
        return this._sourceNet$.getValue();
    }
}
