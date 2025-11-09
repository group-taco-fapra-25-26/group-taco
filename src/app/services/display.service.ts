import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DisplayableGraph } from '../classes/displayable-graph.interface';

@Injectable({
    providedIn: 'root',
})
export class DisplayService implements OnDestroy {
    private _diagram$: BehaviorSubject<DisplayableGraph | undefined>;

    constructor() {
        this._diagram$ = new BehaviorSubject<DisplayableGraph | undefined>(undefined);
    }

    ngOnDestroy(): void {
        this._diagram$.complete();
    }

    public get diagram$(): Observable<DisplayableGraph | undefined> {
        return this._diagram$.asObservable();
    }

    public get diagram(): DisplayableGraph | undefined {
        return this._diagram$.getValue();
    }

    public display(graph: DisplayableGraph) {
        this._diagram$.next(graph);
    }

    public clear() {
        this._diagram$.next(undefined);
    }
}
