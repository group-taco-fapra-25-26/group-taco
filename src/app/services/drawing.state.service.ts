import {Injectable, signal} from "@angular/core";

@Injectable({providedIn: 'root'})
export class DrawingStateService {

    readonly isDrawingEnabled = signal(true);

    enable() {
        this.isDrawingEnabled.set(true);
    }
    disable() {
        this.isDrawingEnabled.set(false);
    }
    set(enabled: boolean) {
        this.isDrawingEnabled.set(enabled);
    }

}
