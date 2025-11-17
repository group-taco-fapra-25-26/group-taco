import { Component, effect, inject, output } from '@angular/core';
import { ProcessNetDisplayComponent } from './process-net-display/process-net-display.component';
import { ClearNetButtonComponent } from '../../clear-net-button/clear-net-button.component';
import { Tab } from '../../../classes/tabs';
import { TabStateService } from '../../../services/tab-state.service';
import { UploadComponent } from '../upload/upload.component';

@Component({
    selector: 'app-process-net',
    standalone: true,
    imports: [ProcessNetDisplayComponent, ClearNetButtonComponent, UploadComponent],
    templateUrl: './process-net.component.html',
    styleUrl: './process-net.component.css',
})
export class ProcessNetComponent {
    readonly clearAll = output<void>();
    private _tabStateService = inject(TabStateService);

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
