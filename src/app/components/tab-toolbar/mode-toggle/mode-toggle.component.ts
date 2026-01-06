import { Component, effect, inject } from '@angular/core';
import { ModeService } from '../../../services/mode.service';
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
            this.sliderValue = this._modeService.isExamMode() ? 1 : 0;
        });
    }

    protected onSliderChange() {
        if (this.sliderValue > 0.5) {
            this.sliderValue = 1;
            if (!this._modeService.isExamMode()) {
                this._modeService.toggleMode();
            }
        } else {
            this.sliderValue = 0;
            if (this._modeService.isExamMode()) {
                this._modeService.toggleMode();
            }
        }
    }

    protected get isExamActive(): boolean {
        return this.sliderValue > 0.5;
    }

    protected modeText(): string {
        return this._modeService.isExamMode() ? 'SWITCH_TO_LEARNING_MODE' : 'SWITCH_TO_EXAM_MODE';
    }
}
