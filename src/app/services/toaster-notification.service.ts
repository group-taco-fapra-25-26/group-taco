import { inject, Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import {
    DEFAULT_TOAST_POSITION,
    ToastData,
    ToastDuration,
    ToastList,
    ToastPosition,
    ToastType,
    TranslationParams,
} from '../classes/toast';
import { ToasterComponent } from '../components/toaster/toaster.component';

@Injectable({
    providedIn: 'root',
})
export class ToasterNotificationService {
    private _snackBar = inject(MatSnackBar);

    public showToast(
        type: ToastType,
        heading: string,
        message: string,
        options?: {
            duration?: ToastDuration | number;
            toastPosition?: ToastPosition;
            headingParams?: TranslationParams;
            messageParams?: TranslationParams;
            list?: ToastList[];
        },
    ) {
        const config: MatSnackBarConfig = {
            panelClass: ['custom-toast-container', `${type}-toast`],
            horizontalPosition: options?.toastPosition?.horizontal ?? DEFAULT_TOAST_POSITION.horizontal,
            verticalPosition: options?.toastPosition?.vertical ?? DEFAULT_TOAST_POSITION.vertical,
            duration: options?.duration ?? ToastDuration.MEDIUM,
        };

        const data: ToastData = {
            type,
            heading,
            message,
            headingParams: options?.headingParams,
            messageParams: options?.messageParams,
            list: options?.list,
        };

        this._snackBar.openFromComponent(ToasterComponent, { ...config, data });
    }

    showSuccess(
        heading: string,
        message: string,
        options?: {
            duration?: ToastDuration | number;
            toastPosition?: ToastPosition;
            headingParams?: TranslationParams;
            messageParams?: TranslationParams;
            list?: ToastList[];
        },
    ) {
        this.showToast('success', heading, message, options);
    }

    showInfo(
        heading: string,
        message: string,
        options?: {
            duration?: ToastDuration | number;
            toastPosition?: ToastPosition;
            headingParams?: TranslationParams;
            messageParams?: TranslationParams;
            list?: ToastList[];
        },
    ) {
        this.showToast('info', heading, message, options);
    }

    showWarning(
        heading: string,
        message: string,
        options?: {
            duration?: ToastDuration | number;
            toastPosition?: ToastPosition;
            headingParams?: TranslationParams;
            messageParams?: TranslationParams;
            list?: ToastList[];
        },
    ) {
        this.showToast('warning', heading, message, options);
    }

    showError(
        heading: string,
        message: string,
        options?: {
            duration?: ToastDuration | number;
            toastPosition?: ToastPosition;
            headingParams?: TranslationParams;
            messageParams?: TranslationParams;
            list?: ToastList[];
        },
    ) {
        this.showToast('error', heading, message, options);
    }
}
