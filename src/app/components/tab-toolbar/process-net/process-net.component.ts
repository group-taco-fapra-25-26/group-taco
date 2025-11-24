import { Component } from '@angular/core';
import { ProcessNetDisplayComponent } from './process-net-display/process-net-display.component';
import { ProcessNetDrawDisplayComponent } from './process-net-draw-display/process-net-draw-display';
import { ClearNetButtonComponent } from '../../clear-net-button/clear-net-button.component';
import { UploadComponent } from '../upload/upload.component';

@Component({
    selector: 'app-process-net',
    standalone: true,
    imports: [ProcessNetDisplayComponent, ProcessNetDrawDisplayComponent, ClearNetButtonComponent, UploadComponent],
    templateUrl: './process-net.component.html',
    styleUrl: './process-net.component.css',
})
export class ProcessNetComponent {}
