import { Component, effect, inject } from '@angular/core';
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

    protected sliderValue = 0;

    constructor() {
        this._matIconRegistry.addSvgIcon(
            'spicy-taco',
            this._domSanitizer.bypassSecurityTrustResourceUrl('assets/images/spicy-taco.svg'),
        );
        this._matIconRegistry.addSvgIcon(
            'taco',
            this._domSanitizer.bypassSecurityTrustResourceUrl('assets/images/taco.svg'),
        );

        effect(() => {
            const currentTab = this._tabStateService.currentTab();
            this.sliderValue = this._modeService.isExamMode(currentTab) ? 1 : 0;
        });
    }

    protected onSliderChange() {
        const currentTab = this._tabStateService.currentTab();
        if (this.sliderValue > 0.5) {
            this.sliderValue = 1;
            if (!this._modeService.isExamMode(currentTab)) {
                this._modeService.toggleMode(currentTab);
            }
        } else {
            this.sliderValue = 0;
            if (this._modeService.isExamMode(currentTab)) {
                this._modeService.toggleMode(currentTab);
            }
        }
    }

    protected get isExamActive(): boolean {
        return this.sliderValue > 0.5;
    }

    protected modeText(): string {
        const currentTab = this._tabStateService.currentTab();
        return this._modeService.isExamMode(currentTab) ? 'SWITCH_TO_LEARNING_MODE' : 'SWITCH_TO_EXAM_MODE';
    }
}
