import { Component, inject, input } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { SourcePetriNetService } from '../../services/source-petri-net.service';
import { DisplayService } from '../../services/display.service';
import { PlayService } from '../../services/play.service';

@Component({
    selector: 'app-clear-net-button',
    standalone: true,
    imports: [MatButton, MatIcon],
    templateUrl: './clear-net-button.component.html',
    styleUrls: ['./clear-net-button.component.css'],
})
export class ClearNetButtonComponent {
    readonly title = input<string>('Clear Net');

    private _sourcePetriNetService = inject(SourcePetriNetService);
    private _playService = inject(PlayService);
    private _displayService = inject(DisplayService);

    public clearNet(): void {
        this._sourcePetriNetService.clear();
        this._playService.resetFiringEntries();
        this._displayService.clear();
    }
}
