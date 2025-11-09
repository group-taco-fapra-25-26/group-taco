import { Component, inject, output } from '@angular/core';
import { DisplayComponent } from '../../display/display.component';
import { DisplayService } from '../../../services/display.service';
import { ClearNetButtonComponent } from '../../clear-net-button/clear-net-button.component';
import { UploadComponent } from '../../upload/upload.component';

@Component({
    selector: 'app-draw',
    standalone: true,
    imports: [DisplayComponent, ClearNetButtonComponent, UploadComponent],
    templateUrl: './draw.component.html',
    styleUrl: './draw.component.css',
})
export class DrawComponent {
    readonly clearAll = output<void>();
    private _displayService = inject(DisplayService);

    public onNetCleared() {
        console.log('DrawComponent: Net cleared from button');
        this._displayService.clear();
    }

    public onClearAll() {
        this.clearAll.emit();
        console.log('DrawComponent: Clear all event emitted');
    }
}
