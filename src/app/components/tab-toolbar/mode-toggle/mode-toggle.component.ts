import { Component, inject, linkedSignal } from '@angular/core';
import { ModeService } from '../../../services/mode.service';
import { TabStateService } from '../../../services/tab-state.service';
import { MatIcon, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatSlider, MatSliderThumb } from '@angular/material/slider';

@Component({
    selector: 'app-mode-toggle',
    imports: [MatIcon, MatTooltip, MatSlideToggleModule, FormsModule, TranslateModule, MatSlider, MatSliderThumb],
    templateUrl: './mode-toggle.component.html',
    styleUrl: './mode-toggle.component.css',
    standalone: true,
})
export class ModeToggleComponent {
    private _modeService = inject(ModeService);
    private _tabStateService = inject(TabStateService);
    private _matIconRegistry = inject(MatIconRegistry);
    private _domSanitizer = inject(DomSanitizer);

    protected sliderValue = linkedSignal({
        source: this._tabStateService.currentTab,
        computation: (currentTab) => (this._modeService.isExamMode(currentTab) ? 1 : 0),
    });

    constructor() {
        this._matIconRegistry.addSvgIcon(
            'spicy-taco',
            this._domSanitizer.bypassSecurityTrustResourceUrl('assets/images/spicy-taco.svg'),
        );
        this._matIconRegistry.addSvgIcon(
            'taco',
            this._domSanitizer.bypassSecurityTrustResourceUrl('assets/images/taco.svg'),
        );
    }

    protected onSliderChange() {
        const currentTab = this._tabStateService.currentTab();
        const newValue = this.sliderValue() >= 0.5 ? 1 : 0;

        // Update slider async so it does not get stuck in the middle if user drags it fast
        setTimeout(() => {
            this.sliderValue.set(newValue);
        });

        if (newValue === 1) {
            if (!this._modeService.isExamMode(currentTab)) {
                this._modeService.toggleMode(currentTab);
            }
        } else {
            if (this._modeService.isExamMode(currentTab)) {
                this._modeService.toggleMode(currentTab);
            }
        }
    }

    protected get isExamActive(): boolean {
        return this.sliderValue() > 0.5;
    }

    protected modeText(): string {
        const currentTab = this._tabStateService.currentTab();
        return this._modeService.isExamMode(currentTab) ? 'SWITCH_TO_LEARNING_MODE' : 'SWITCH_TO_EXAM_MODE';
    }
}
