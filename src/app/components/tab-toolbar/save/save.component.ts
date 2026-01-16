import { Component, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PetriNetSavingService } from '../../../services/petri-net-saving.service';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { DisplayService } from '../../../services/display.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { TabStateService } from '../../../services/tab-state.service';
import { Tab } from '../../../classes/tabs';
import { GRAPH_IDS } from '../../display/display.constants';

@Component({
    selector: 'app-save',
    imports: [MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatIconButton, MatTooltip, TranslateModule],
    templateUrl: './save.component.html',
    styleUrl: './save.component.css',
})
export class SaveComponent {
    private _petriNetSavingService = inject(PetriNetSavingService);
    private _displayService = inject(DisplayService);
    private _tabsStateService = inject(TabStateService);
    private _diagramSignal = toSignal(this._displayService.diagram$);
    public isDisabled = computed(() => !this._diagramSignal());

    protected readonly GRAPH_IDS = GRAPH_IDS;

    protected onSave(format: 'json' | 'pnml') {
        this._petriNetSavingService.savePetriNet(format);
    }

    protected onGraphExport(graph: string, format: 'png' | 'jpeg') {
        this._displayService.triggerDownload(format, graph);
    }

    protected isGraphAvailable(graph: string) {
        const currentTab = this._tabsStateService.currentTab();
        if (graph === GRAPH_IDS.REACHABILITY) {
            return currentTab === Tab.REACHABILITY_GRAPH;
        }
        if (graph === GRAPH_IDS.PROCESS_NET) {
            return currentTab === Tab.PROCESS_NET;
        }
        return false;
    }
}
