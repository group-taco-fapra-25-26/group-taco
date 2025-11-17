import { Component, effect, inject, output } from '@angular/core';
import { DisplayComponent } from '../../display/display.component';
import { DisplayService } from '../../../services/display.service';
import { ClearNetButtonComponent } from '../../clear-net-button/clear-net-button.component';
import { UploadComponent } from '../upload/upload.component';
import { Tab } from '../../../classes/tabs';
import { TabStateService } from '../../../services/tab-state.service';
import { SourcePetriNetService } from '../../../services/source-petri-net.service';
import { SaveComponent } from '../save/save.component';

@Component({
    selector: 'app-draw',
    standalone: true,
    imports: [DisplayComponent, ClearNetButtonComponent, UploadComponent, SaveComponent],
    templateUrl: './draw.component.html',
    styleUrl: './draw.component.css',
})
export class DrawComponent {
    readonly clearAll = output<void>();
    private _tabStateService = inject(TabStateService);
    private _sourceNetService = inject(SourcePetriNetService);
    private _displayService = inject(DisplayService);

    constructor() {
        this.initializeTabEffect();
    }

    private initializeTabEffect() {
        effect(() => {
            const currentTab = this._tabStateService.currentTab();
            if (currentTab === Tab.DRAW) {
                console.log('DrawComponent: Switched to Draw tab');
                const sourceNet = this._sourceNetService.getCurrentSourceNet();

                if (sourceNet) {
                    this._displayService.display(sourceNet);
                } else {
                    this._displayService.clear();
                }
            }
        });
    }

    public onNetCleared() {
        console.log('DrawComponent: Net cleared from button');
        this._displayService.clear();
    }

    public onClearAll() {
        this.clearAll.emit();
        console.log('DrawComponent: Clear all event emitted');
    }
}
