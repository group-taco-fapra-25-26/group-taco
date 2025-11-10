export interface ToastData {
    type: 'success' | 'info' | 'warning' | 'error';
    heading: string;
    message: string;
}

export type ToastType = 'success' | 'info' | 'warning' | 'error';
