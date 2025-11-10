import { inject, Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { ToastData, ToastType } from '../classes/toast';
import { ToasterComponent } from '../components/toaster/toaster.component';

@Injectable({
    providedIn: 'root',
})
export class ToasterNotificationService {
    private _snackBar = inject(MatSnackBar);

    public showToast(type: ToastType, heading: string, message: string) {
        const config: MatSnackBarConfig = {
            panelClass: ['custom-toast-container', `${type}-toast`],
            horizontalPosition: 'right',
            verticalPosition: 'top',
            duration: 5000,
        };

        const data: ToastData = { type, heading, message };

        this._snackBar.openFromComponent(ToasterComponent, { ...config, data });
    }

    showSuccess(heading: string, message: string) {
        this.showToast('success', heading, message);
    }

    showInfo(heading: string, message: string) {
        this.showToast('info', heading, message);
    }

    showWarning(heading: string, message: string) {
        this.showToast('warning', heading, message);
    }

    showError(heading: string, message: string) {
        this.showToast('error', heading, message);
    }
}
