export interface ToastData {
    type: ToastType;
    heading: string;
    message: string;
}

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export const TOAST_ICONS: Record<ToastType, string> = {
    success: 'check',
    info: 'info',
    warning: 'warning',
    error: 'error',
};
