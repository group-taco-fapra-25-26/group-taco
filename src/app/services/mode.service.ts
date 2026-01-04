import { computed, inject, Injectable, signal } from '@angular/core';
import { AppMode } from '../classes/app-mode';
import { ToasterNotificationService } from './toaster-notification.service';

@Injectable({ providedIn: 'root' })
export class ModeService {
    private _toasterService = inject(ToasterNotificationService);
    private _modeSignal = signal<AppMode>(AppMode.LEARN);

    /**
     * Exposes the current application mode as a read-only signal.
     */
    readonly currentMode = this._modeSignal.asReadonly();

    /**
     * Computed signal that indicates whether the application is in EXAM mode.
     */
    readonly isExamMode = computed(() => this._modeSignal() === AppMode.EXAM);

    /**
     * Toggles the application mode between LEARN and EXAM.
     */
    toggleMode(): void {
        this._modeSignal.update((current) => (current === AppMode.LEARN ? AppMode.EXAM : AppMode.LEARN));
        this._toasterService.showInfo(
            'TOASTER.HEADER.MODE_SWITCHED',
            this.isExamMode() ? 'TOASTER.BODY.MODE_SWITCHED_EXAM' : 'TOASTER.BODY.MODE_SWITCHED_LEARN',
        );
    }
}
