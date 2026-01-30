import { computed, inject, Injectable, signal } from '@angular/core';
import { AppMode } from '../classes/app-mode';
import { Tab } from '../classes/tabs';
import { ToasterNotificationService } from './toaster-notification.service';

@Injectable({ providedIn: 'root' })
export class ModeService {
    private _toasterService = inject(ToasterNotificationService);
    private _tabModeSignals = new Map<
        Tab,
        { mode: ReturnType<typeof signal<AppMode>>; isExamMode: ReturnType<typeof computed<boolean>> }
    >();

    constructor() {
        const tabs: Tab[] = [Tab.DRAW, Tab.PLAY, Tab.REACHABILITY_GRAPH, Tab.PROCESS_NET];
        tabs.forEach((tab) => {
            this._tabModeSignals.set(tab, {
                mode: signal<AppMode>(AppMode.LEARN),
                isExamMode: computed(() => this.getModeSignal(tab)!() === AppMode.EXAM),
            });
        });
    }

    getModeSignal(tab: Tab): ReturnType<typeof signal<AppMode>> | undefined {
        return this._tabModeSignals.get(tab)?.mode;
    }

    getIsExamModeSignal(tab: Tab): ReturnType<typeof computed<boolean>> | undefined {
        return this._tabModeSignals.get(tab)?.isExamMode;
    }

    getMode(tab: Tab): AppMode {
        return this._tabModeSignals.get(tab)?.mode() || AppMode.LEARN;
    }

    isExamMode(tab: Tab): boolean {
        return this.getMode(tab) === AppMode.EXAM;
    }

    toggleMode(tab: Tab): void {
        const tabSignals = this._tabModeSignals.get(tab);
        if (!tabSignals) return;

        const newMode = tabSignals.mode() === AppMode.LEARN ? AppMode.EXAM : AppMode.LEARN;
        tabSignals.mode.set(newMode);

        this._toasterService.showInfo(
            'TOASTER.HEADER.MODE_SWITCHED',
            newMode === AppMode.EXAM ? 'TOASTER.BODY.MODE_SWITCHED_EXAM' : 'TOASTER.BODY.MODE_SWITCHED_LEARN',
        );
    }
}
