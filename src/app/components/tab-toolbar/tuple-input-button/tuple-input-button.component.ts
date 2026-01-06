import { Component, inject } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { TupleInputComponent } from '../../tuple-input/tuple-input.component';

@Component({
    selector: 'app-tuple-input-button',
    standalone: true,
    imports: [MatIconModule, MatButtonModule, MatTooltipModule, TranslateModule, MatDialogModule],
    templateUrl: './tuple-input-button.component.html',
    styleUrls: ['./tuple-input-button.component.css'],
})
export class TupleInputButtonComponent {
    private _dialog = inject(MatDialog);

    openDialog() {
        this._dialog.open(TupleInputComponent, {
            width: '600px',
            disableClose: true,
        });
    }
}
