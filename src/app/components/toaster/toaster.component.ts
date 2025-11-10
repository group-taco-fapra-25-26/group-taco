import { Component, inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { TOAST_ICONS, ToastData } from '../../classes/toast';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-toaster',
    standalone: true,
    imports: [MatIconModule, MatButtonModule],
    templateUrl: './toaster.component.html',
    styleUrl: './toaster.component.css',
})
export class ToasterComponent {
    public data: ToastData = inject(MAT_SNACK_BAR_DATA);
    private snackBarRef = inject(MatSnackBarRef<ToasterComponent>);

    get iconName(): string {
        return TOAST_ICONS[this.data.type] ?? 'info';
    }

    closeToast() {
        this.snackBarRef.dismiss();
    }
}
