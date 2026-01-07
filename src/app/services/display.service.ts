import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { DisplayableGraph } from '../classes/displayable-graph.interface';

@Injectable({
    providedIn: 'root',
})
export class DisplayService implements OnDestroy {
    private _diagram$: BehaviorSubject<DisplayableGraph | undefined>;
    private _downloadRequest$ = new Subject<'png' | 'jpeg'>();
    private _triggeredByFiring = false;

    constructor() {
        this._diagram$ = new BehaviorSubject<DisplayableGraph | undefined>(undefined);
    }

    ngOnDestroy(): void {
        this._diagram$.complete();
        this._downloadRequest$.complete();
    }

    public get downloadRequest$(): Observable<'png' | 'jpeg'> {
        return this._downloadRequest$.asObservable();
    }

    public get diagram$(): Observable<DisplayableGraph | undefined> {
        return this._diagram$.asObservable();
    }

    public get diagram(): DisplayableGraph | undefined {
        return this._diagram$.getValue();
    }

    public consumeTriggeredByFiring(): boolean {
        const wasFiring = this._triggeredByFiring;
        this._triggeredByFiring = false;
        return wasFiring;
    }

    /**
     * Displays the given graph in the display area.
     *
     * @param graph
     *          the graph to be displayed
     */
    public display(graph: DisplayableGraph, options?: { triggeredByFiring?: boolean }) {
        this._triggeredByFiring = !!options?.triggeredByFiring;
        this._diagram$.next(graph);
    }

    /**
     * Clears the currently displayed diagram.
     */
    public clear() {
        this._triggeredByFiring = false;
        this._diagram$.next(undefined);
    }

    /**
     * Triggers a download request for the currently displayed diagram.
     *
     * @param format
     *          the image format in which the diagram should be exported.
     *
     * Supported formats are `'png'` and `'jpeg'`.
     */
    public triggerDownload(format: 'png' | 'jpeg') {
        this._downloadRequest$.next(format);
    }
}
