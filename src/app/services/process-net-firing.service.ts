import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ProcessNetFiringFlow {
    placeId: string;
    placeLabel: string;
    weight: number;
}

export interface ProcessNetFiringEvent {
    transitionId: string;
    transitionLabel: string;
    timestamp: string;
    inputs: ProcessNetFiringFlow[];
    outputs: ProcessNetFiringFlow[];
}

@Injectable({ providedIn: 'root' })
export class ProcessNetFiringService {
    private _events$ = new Subject<ProcessNetFiringEvent>();

    get events$(): Observable<ProcessNetFiringEvent> {
        return this._events$.asObservable();
    }

    emit(event: ProcessNetFiringEvent): void {
        this._events$.next(event);
    }
}
