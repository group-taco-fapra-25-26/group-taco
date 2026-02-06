import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { SpringEmbedderService } from '../../services/spring-embedder.service';
import { TranslateModule } from '@ngx-translate/core';
import { DisplayService } from '../../services/display.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { DrawService } from '../../services/draw.service';
import { TabStateService } from '../../services/tab-state.service';
import { Tab } from '../../classes/tabs';
import { CanvasDiagram } from '../../classes/diagram/canvas-diagram';

@Component({
    selector: 'app-layout-button',
    imports: [MatIcon, MatIconButton, MatTooltip, TranslateModule],
    templateUrl: './layout-button.component.html',
    styleUrl: './layout-button.component.css',
})
export class LayoutButtonComponent {
    private _springEmbedderService = inject(SpringEmbedderService);
    private _displayService = inject(DisplayService);
    private _drawService = inject(DrawService);
    private _tabStateService = inject(TabStateService);

    private _diagramSignal = toSignal(this._displayService.diagram$);
    private _isCalculating = signal(false);

    public isDisabled = computed(() => !this._diagramSignal() || this._isCalculating());

    constructor() {
        effect(() => {
            this._diagramSignal();
            this._isCalculating.set(false);
        });
    }

    calculateLayout() {
        this._isCalculating.set(true);
        let layoutPromise: Promise<void>;

        if (this._tabStateService.currentTab() === Tab.DRAW) {
            const drawnGraph = new CanvasDiagram(this._drawService.drawnElements, this._drawService.connections);
            this._displayService.display(drawnGraph);
            layoutPromise = this._springEmbedderService.calculateLayout(drawnGraph);
        } else {
            layoutPromise = this._springEmbedderService.calculateLayout();
        }

        layoutPromise
            .then(() => this._isCalculating.set(false))
            .catch((error) => {
                this._isCalculating.set(false);
                console.error('Error during layout calculation:', error);
            });
    }
}
