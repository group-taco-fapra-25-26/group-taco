import { Component } from '@angular/core';
import { ProcessNetDisplayComponent } from './process-net-display/process-net-display.component';
import { ProcessNetDrawDisplayComponent } from './process-net-draw-display/process-net-draw-display';

@Component({
    selector: 'app-process-net',
    standalone: true,
    imports: [ProcessNetDisplayComponent, ProcessNetDrawDisplayComponent],
    templateUrl: './process-net.component.html',
    styleUrl: './process-net.component.css',
})
export class ProcessNetComponent {}
