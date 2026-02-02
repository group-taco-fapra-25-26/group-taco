import { Component, inject } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatTooltip } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { KeyValue, KeyValuePipe } from '@angular/common';
import { DisplayService } from 'src/app/services/display.service';
import { ReachabilityGraphService } from 'src/app/reachability-graph.service';

@Component({
    selector: 'app-rg-marking-dialog',
    imports: [
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconButton,
        MatIcon,
        MatSliderModule,
        MatExpansionModule,
        MatTooltip,
        KeyValuePipe,
    ],
    templateUrl: './rg-marking-dialog.component.html',
    styleUrl: './rg-marking-dialog.component.css',
})
export class RgMarkingDialogComponent {
    private _displayService = inject(DisplayService);
    private _reachabilityGraphService = inject(ReachabilityGraphService);

    incrementMarking() {}

    decrementMarking() {}
}








import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { Tab } from '../../classes/tabs';
import { DrawService } from '../../services/draw.service';
import { ReachabilityGraphService } from '../../reachability-graph.service';
import { ProcessNetFiringService } from '../../services/process-net-firing.service';

export interface ConfirmDialogData {
    title: string;
    tab: Tab;
    message: string;
}

@Component({
    selector: 'app-confirm-dialog',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatButtonModule, TranslateModule],
    templateUrl: './confirm-dialog.component.html',
    styleUrls: ['./confirm-dialog.component.css'],
})
export class ConfirmDialogComponent {
    readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
    private readonly _dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);

    private readonly processNetFiringService = inject(ProcessNetFiringService);
    private readonly reachabilityGraphService = inject(ReachabilityGraphService);
    private readonly drawService = inject(DrawService);

    keep() {
        this._dialogRef.close('keep');
    }

    discard() {
        switch (this.data.tab) {
            case Tab.DRAW:
                this.drawService.clearCanvas();
                break;
            case Tab.PROCESS_NET:
                this.processNetFiringService.clear();
                break;
            case Tab.REACHABILITY_GRAPH:
                this.reachabilityGraphService.clear();
                break;
            default:
                break;
        }
        this._dialogRef.close('discard');
    }
}
