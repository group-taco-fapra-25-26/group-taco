import { Component, inject } from '@angular/core';
import { ModeService } from '../../../services/mode.service';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIconButton } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-mode-toggle',
    imports: [MatIcon, MatTooltip, MatIconButton, TranslateModule],
    templateUrl: './mode-toggle.component.html',
    styleUrl: './mode-toggle.component.css',
    standalone: true,
})
export class ModeToggleComponent {
    private _modeService = inject(ModeService);

    protected modeIcon(): string {
        return this._modeService.isExamMode() ? 'school' : 'quiz';
    }

    protected modeText(): string {
        return this._modeService.isExamMode() ? 'SWITCH_TO_LEARNING_MODE' : 'SWITCH_TO_EXAM_MODE';
    }

    protected modeColor(): string {
        return this._modeService.isExamMode() ? 'primary' : 'accent';
    }

    protected toggleMode() {
        this._modeService.toggleMode();
    }
}
