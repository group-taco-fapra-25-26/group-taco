import { CommonModule } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

interface LabelEditDialogData {
    title: string;
    label: string;
}

@Component({
    selector: 'app-label-edit-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        TranslateModule,
    ],
    templateUrl: './label-edit-dialog.component.html',
    styleUrls: ['./label-edit-dialog.component.css'],
})
export class LabelEditDialogComponent {
    label: string;

    private _dialogRef = inject(MatDialogRef<LabelEditDialogComponent>);

    constructor(@Inject(MAT_DIALOG_DATA) public data: LabelEditDialogData) {
        this.label = data.label ?? '';
    }

    save() {
        const trimmed = this.label?.trim();
        if (!trimmed) return;
        this._dialogRef.close(trimmed);
    }

    cancel() {
        this._dialogRef.close();
    }
}
