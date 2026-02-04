import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { Tab } from '../../../../classes/tabs';
import { DrawService } from '../../../../services/draw.service';
import { ReachabilityGraphService } from '../../../../reachability-graph.service';
import { ProcessNetFiringService } from '../../../../services/process-net-firing.service';
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
import { StateNode } from 'src/app/classes/reachability-graph.model';

export interface ConfirmUserMarkingDialogData {
    title: string;
    userInputMarking: Record<string, number>;
    expectedCorrectMarking: Record<string, number>;
    // tab: Tab;
    message: string;
}
@Component({
    selector: 'app-rg-marking-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        TranslateModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconButton,
        MatIcon,
        MatSliderModule,
        MatExpansionModule,
        KeyValuePipe,
    ],
    templateUrl: './rg-marking-dialog.component.html',
    styleUrl: './rg-marking-dialog.component.css',
})
export class RgMarkingDialogComponent {
    private _displayService = inject(DisplayService);
    private _reachabilityGraphService = inject(ReachabilityGraphService);
    data = inject<ConfirmUserMarkingDialogData>(MAT_DIALOG_DATA);
    private _dialogRef = inject(MatDialogRef<RgMarkingDialogComponent>);

    private readonly drawService = inject(DrawService);
    protected currentDialogMarking: Record<string, number> = this.data.userInputMarking;
    private correctDialogMarking: Record<string, number> = this.data.expectedCorrectMarking;

    incrementMarking(dialogUserMarking: Record<string, number>, placeId: string): Record<string, number> {
        const newMarking = { ...dialogUserMarking };
        newMarking[placeId] = (newMarking[placeId] || 0) + 1;
        dialogUserMarking = newMarking;
        this.currentDialogMarking = newMarking;
        return dialogUserMarking;
    }

    decrementMarking(dialogUserMarking: Record<string, number>, placeId: string): Record<string, number> {
        if ((dialogUserMarking[placeId] || 0) > 0) {
            const newMarking = { ...dialogUserMarking };
            newMarking[placeId] = (newMarking[placeId] || 0) - 1;
            dialogUserMarking = newMarking;
            this.currentDialogMarking = newMarking;
        }
        return dialogUserMarking;
    }

    keep() {
        this._dialogRef.close(this.currentDialogMarking);
    }

    discard() {
        this._dialogRef.close(this.correctDialogMarking);
    }
}
