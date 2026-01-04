import { Component, computed, inject, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { SpringEmbedderService } from '../../services/spring-embedder.service';
import { TranslateModule } from '@ngx-translate/core';
import { DisplayService } from '../../services/display.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
    selector: 'app-layout-button',
    imports: [MatIcon, MatIconButton, MatTooltip, TranslateModule],
    templateUrl: './layout-button.component.html',
    styleUrl: './layout-button.component.css',
})
export class LayoutButtonComponent {
    private _springEmbedderService = inject(SpringEmbedderService);
    private _displayService = inject(DisplayService);

    private _diagramSignal = toSignal(this._displayService.diagram$);
    private _isCalculating = signal(false);

    public isDisabled = computed(
        () =>
            !this._diagramSignal() || this._isCalculating() || this._springEmbedderService.isOptimalLayoutCalculated(),
    );

    calculateLayout() {
        this._isCalculating.set(true);
        this._springEmbedderService
            .calculateLayout()
            .then(() => this._isCalculating.set(false))
            .catch((error) => {
                this._isCalculating.set(false);
                console.error('Error during layout calculation:', error);
            });
    }
}
