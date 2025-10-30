import { Component, inject } from '@angular/core';
import { MatTabChangeEvent, MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { TabStateService } from '../../services/tab-state.service';
import { DrawComponent } from '../tab-toolbar/draw/draw.component';
import { PlayComponent } from '../tab-toolbar/play/play.component';
import { ReachabilityGraphComponent } from '../tab-toolbar/reachability-graph/reachability-graph.component';
import { ProcessNetComponent } from '../tab-toolbar/process-net/process-net.component';
import { Tab } from '../../models/tab';

@Component({
    selector: 'app-main-tab',
    standalone: true,
    imports: [
        MatTabsModule,
        MatIconModule,
        DrawComponent,
        PlayComponent,
        ReachabilityGraphComponent,
        ProcessNetComponent,
    ],
    templateUrl: './main-tab.component.html',
    styleUrl: './main-tab.component.css',
})
export class MainTabComponent {
    private _tabStateService = inject(TabStateService);
    private readonly _tabs: Tab[] = [Tab.DRAW, Tab.PLAY, Tab.REACHABILITY_GRAPH, Tab.PROCESS_NET];

    onTabChange(event: MatTabChangeEvent) {
        this._tabStateService.switchTo(this._tabs[event.index]);
    }
}
