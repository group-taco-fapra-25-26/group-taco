import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormsModule } from '@angular/forms';
import { KeyValuePipe } from '@angular/common';
import { ToasterNotificationService } from '../../../../services/toaster-notification.service';

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
    private _notificationService = inject(ToasterNotificationService);
    data = inject<ConfirmUserMarkingDialogData>(MAT_DIALOG_DATA);
    private _dialogRef = inject(MatDialogRef<RgMarkingDialogComponent>);

    protected currentDialogMarking: Record<string, number> = this.data.userInputMarking;
    private correctDialogMarking: Record<string, number> = this.data.expectedCorrectMarking;

    incrementMarking(placeId: string): void {
        this.currentDialogMarking[placeId] = (this.currentDialogMarking[placeId] || 0) + 1;
    }

    decrementMarking(placeId: string): void {
        if ((this.currentDialogMarking[placeId] || 0) > 0) {
            this.currentDialogMarking[placeId] = (this.currentDialogMarking[placeId] || 0) - 1;
        }
    }

    keep() {
        let isCorrect = true;
        for (const [key, value] of Object.entries(this.correctDialogMarking)) {
            if (this.currentDialogMarking[key] !== value) {
                isCorrect = false;
                break;
            }
        }

        if (isCorrect) {
            this._dialogRef.close(this.currentDialogMarking);
        } else {
            this._notificationService.showError(
                'TOASTER.HEADER.MARKING_INPUT_WRONG',
                'TOASTER.BODY.MARKING_INPUT_WRONG',
            );
        }
    }

    discard() {
        this._dialogRef.close(this.correctDialogMarking);
    }
}
