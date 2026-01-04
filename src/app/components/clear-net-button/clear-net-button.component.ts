import { Component, computed, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { SourcePetriNetService } from '../../services/source-petri-net.service';
import { DisplayService } from '../../services/display.service';
import { PlayService } from '../../services/play.service';
import { MatTooltip } from '@angular/material/tooltip';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-clear-net-button',
    standalone: true,
    imports: [MatIconButton, MatIcon, MatTooltip, TranslateModule],
    templateUrl: './clear-net-button.component.html',
    styleUrls: ['./clear-net-button.component.css'],
})
export class ClearNetButtonComponent {
    private _sourcePetriNetService = inject(SourcePetriNetService);
    private _playService = inject(PlayService);
    private _displayService = inject(DisplayService);
    private _diagramSignal = toSignal(this._displayService.diagram$);
    public isDisabled = computed(() => this._diagramSignal() === undefined);

    public clearNet(): void {
        this._sourcePetriNetService.clear();
        this._playService.resetFiringEntries();
        this._displayService.clear();
    }
}
