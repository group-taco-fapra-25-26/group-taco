import { inject, Injectable, signal } from '@angular/core';
import { FiringEntry } from '../classes/firing-entry';
import { ToasterNotificationService } from './toaster-notification.service';

@Injectable({ providedIn: 'root' })
export class PlayService {
    /**
     * To be implemented:
     * - get endMarking
     * - reset firingEntries when net is cleared
     * */
    firingEntries = signal<FiringEntry[]>([{ id: 1, firingSequence: '', transitionCount: 0, endMarking: '' }]);
    private _notificationService = inject(ToasterNotificationService);

    processTransitionClick(label: string, isActivated: boolean): void {
        if (isActivated) this.addTransitionToFiringSequence(label);
        else
            this._notificationService.showWarning(
                'Transition not activated',
                `The transition ${label} is not activated and cannot be fired.`,
            );
    }

    addTransitionToFiringSequence(label: string): void {
        this.firingEntries.update((entries) => {
            const lastEntry = entries[entries.length - 1];
            lastEntry.firingSequence += label;
            lastEntry.transitionCount += 1;
            return [...entries];
        });
    }
}
