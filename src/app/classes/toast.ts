export interface ToastData {
    type: ToastType;
    heading: string;
    message: string;
}

export type ToastType = 'success' | 'info' | 'warning' | 'error';
