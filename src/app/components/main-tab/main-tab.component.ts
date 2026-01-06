import { Component, inject } from '@angular/core';
import { MatTabChangeEvent, MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { DrawComponent } from '../tab-toolbar/draw/draw.component';
import { PlayComponent } from '../tab-toolbar/play/play.component';
import { ReachabilityGraphComponent } from '../tab-toolbar/reachability-graph/reachability-graph.component';
import { ProcessNetComponent } from '../tab-toolbar/process-net/process-net.component';
import { Tab } from '../../classes/tabs';
import { Diagram } from '../../classes/diagram/diagram';
import { TabStateService } from '../../services/tab-state.service';
import { SourcePetriNetService } from '../../services/source-petri-net.service';
import { DisplayService } from '../../services/display.service';
import { PlayService } from '../../services/play.service';
import { SaveComponent } from '../tab-toolbar/save/save.component';
import { UploadComponent } from '../tab-toolbar/upload/upload.component';
import { ClearNetButtonComponent } from '../clear-net-button/clear-net-button.component';
import { ModeToggleComponent } from '../tab-toolbar/mode-toggle/mode-toggle.component';
import { LayoutButtonComponent } from '../layout-button/layout-button.component';
import { LanguageButtonComponent } from '../language-button/language-button.component';
import { ExampleMenuComponent } from '../example-menu/example-menu.component';
import { TranslateModule } from '@ngx-translate/core';
import { TupleInputButtonComponent } from '../tab-toolbar/tuple-input-button/tuple-input-button.component';

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
        SaveComponent,
        UploadComponent,
        ClearNetButtonComponent,
        ModeToggleComponent,
        LayoutButtonComponent,
        LanguageButtonComponent,
        ExampleMenuComponent,
        TranslateModule,
        TupleInputButtonComponent,
    ],
    templateUrl: './main-tab.component.html',
    styleUrl: './main-tab.component.css',
})
export class MainTabComponent {
    private _tabStateService: TabStateService = inject(TabStateService);
    private _sourcePetriNetService: SourcePetriNetService = inject(SourcePetriNetService);
    private _displayService: DisplayService = inject(DisplayService);
    private _playService: PlayService = inject(PlayService);
    private readonly _tabs: Tab[] = [Tab.DRAW, Tab.PLAY, Tab.REACHABILITY_GRAPH, Tab.PROCESS_NET];

    selectedIndex = Tab.DRAW; // Select which tab to show by default

    onTabChange(event: MatTabChangeEvent) {
        this._tabStateService.switchTo(this._tabs[event.index]);

        const diagram = this._displayService.diagram;
        if (!diagram || !(diagram instanceof Diagram)) return;

        if (this._tabStateService.currentTab() === Tab.DRAW || this._tabStateService.currentTab() === Tab.PROCESS_NET)
            diagram.resetMarking();
        else if (
            this._tabStateService.currentTab() === Tab.PLAY ||
            this._tabStateService.currentTab() === Tab.REACHABILITY_GRAPH
        )
            this._playService.recoverLastMarking(diagram);

        this._sourcePetriNetService.updateEditedNet(diagram);
    }
}
