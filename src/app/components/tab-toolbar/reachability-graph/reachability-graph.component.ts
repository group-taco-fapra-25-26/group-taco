import { Component, effect, inject, output } from '@angular/core';
import { DisplayComponent } from '../../display/display.component';
import { ClearNetButtonComponent } from '../../clear-net-button/clear-net-button.component';
import { TabStateService } from '../../../services/tab-state.service';
import { Tab } from '../../../classes/tabs';
import { UploadComponent } from '../../upload/upload.component';

@Component({
    selector: 'app-reachability-graph',
    standalone: true,
    imports: [DisplayComponent, ClearNetButtonComponent, UploadComponent],
    templateUrl: './reachability-graph.component.html',
    styleUrl: './reachability-graph.component.css',
})
export class ReachabilityGraphComponent {
    readonly clearAll = output<void>();
    private _tabStateService = inject(TabStateService);

    constructor() {
        this.initializeTabEffect();
    }

    public onNetCleared() {
        console.log('ReachabilityGraphComponent: Net cleared from button');
    }

    public onClearAll() {
        this.clearAll.emit();
        console.log('ReachabilityGraphComponent: Clear all event emitted');
    }

    private initializeTabEffect() {
        effect(() => {
            const currentTab = this._tabStateService.currentTab();
            if (currentTab === Tab.REACHABILITY_GRAPH) {
                //TODO: call some method that calculates the reachability graph automatically when switching to the tab
                // by using a reachabilityGraphService or something similar
                console.log('ReachabilityGraphComponent: Switched to Reachability Graph tab');
            }
        });
    }
}
