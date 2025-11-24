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

export interface ToastPosition {
    horizontal: 'start' | 'center' | 'end' | 'left' | 'right';
    vertical: 'top' | 'bottom';
}

export const TOAST_POSITIONS = {
    TOP_LEFT: {
        horizontal: 'left',
        vertical: 'top',
    } as ToastPosition,
    TOP_CENTER: {
        horizontal: 'center',
        vertical: 'top',
    } as ToastPosition,
    TOP_RIGHT: {
        horizontal: 'right',
        vertical: 'top',
    } as ToastPosition,
    BOTTOM_LEFT: {
        horizontal: 'left',
        vertical: 'bottom',
    } as ToastPosition,
    BOTTOM_CENTER: {
        horizontal: 'center',
        vertical: 'bottom',
    } as ToastPosition,
    BOTTOM_RIGHT: {
        horizontal: 'right',
        vertical: 'bottom',
    } as ToastPosition,
} as const;

export const DEFAULT_TOAST_POSITION: ToastPosition = TOAST_POSITIONS.TOP_RIGHT;

export enum ToastDuration {
    SHORT = 3000,
    MEDIUM = 5000,
    LONG = 10000,
}
