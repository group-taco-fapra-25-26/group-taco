import { Component } from '@angular/core';
import { DisplayComponent } from '../../display/display.component';
import { ClearNetButtonComponent } from '../../clear-net-button/clear-net-button.component';
import { UploadComponent } from '../upload/upload.component';
import { SaveComponent } from '../save/save.component';

@Component({
    selector: 'app-draw',
    standalone: true,
    imports: [DisplayComponent, ClearNetButtonComponent, UploadComponent, SaveComponent],
    templateUrl: './draw.component.html',
    styleUrl: './draw.component.css',
})
export class DrawComponent {}
