import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Diagram } from '../classes/diagram/diagram';

@Injectable({
    providedIn: 'root',
})
export class SourcePetriNetService implements OnDestroy {
    private readonly _sourceNet$ = new BehaviorSubject<Diagram | null>(null);

    public readonly sourceNet$: Observable<Diagram | null> = this._sourceNet$.asObservable();

    ngOnDestroy(): void {
        this._sourceNet$.complete();
    }

    public setSourceNet(net: Diagram | null): void {
        this._sourceNet$.next(net);
    }

    public getCurrentSourceNet(): Diagram | null {
        return this._sourceNet$.getValue();
    }
}
