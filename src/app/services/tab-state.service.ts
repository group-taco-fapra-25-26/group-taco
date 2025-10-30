import { Injectable, signal } from '@angular/core';
import { Tab } from '../models/tab';

@Injectable({ providedIn: 'root' })
export class TabStateService {
    readonly currentTab = signal<Tab>(Tab.DRAW);

    switchTo(tab: Tab) {
        this.currentTab.set(tab);
    }
}
