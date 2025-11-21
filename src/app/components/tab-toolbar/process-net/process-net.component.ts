import { Component, effect, inject, output } from '@angular/core';
import { ProcessNetDisplayComponent } from './process-net-display/process-net-display.component';
import { ProcessNetDrawDisplayComponent } from './process-net-draw-display/process-net-draw-display';
import { ParserService } from '../../../services/parser.service';
import { DisplayService } from '../../../services/display.service';
import { ClearNetButtonComponent } from '../../clear-net-button/clear-net-button.component';
import { Tab } from '../../../classes/tabs';
import { TabStateService } from '../../../services/tab-state.service';
import { UploadComponent } from '../upload/upload.component';

@Component({
    selector: 'app-process-net',
    standalone: true,
    imports: [ProcessNetDisplayComponent, ProcessNetDrawDisplayComponent, ClearNetButtonComponent, UploadComponent],
    templateUrl: './process-net.component.html',
    styleUrl: './process-net.component.css',
})
export class ProcessNetComponent {
    readonly clearAll = output<void>();
    private _tabStateService = inject(TabStateService);
    private _parserService = inject(ParserService);
    private _displayService = inject(DisplayService);

    constructor() {
        this.initializeTabEffect();
    }

    public onNetCleared() {
        console.log('ProcessNetComponent: Net cleared from button');
    }

    public onClearAll() {
        this.clearAll.emit();
        console.log('ProcessNetComponent: Clear all event emitted');
    }

    private initializeTabEffect() {
        effect(() => {
            const currentTab = this._tabStateService.currentTab();
            if (currentTab === Tab.PROCESS_NET) {
                console.log('ProcessNetComponent: Switched to Process Net tab');
            }
        });
    }
}
