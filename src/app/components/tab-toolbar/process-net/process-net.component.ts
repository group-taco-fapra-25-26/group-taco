import { Component, output } from '@angular/core';
import { ProcessNetDisplayComponent } from './process-net-display/process-net-display.component';
import { ClearNetButtonComponent } from '../../clear-net-button/clear-net-button.component';

@Component({
    selector: 'app-process-net',
    standalone: true,
    imports: [ProcessNetDisplayComponent, ClearNetButtonComponent],
    templateUrl: './process-net.component.html',
    styleUrl: './process-net.component.css',
})
export class ProcessNetComponent {
    readonly clearAll = output<void>();
    readonly fileContent = output<string>();

    public onNetCleared() {
        console.log('ProcessNetComponent: Net cleared from button');
    }

    public onClearAll() {
        this.clearAll.emit();
        console.log('ProcessNetComponent: Clear all event emitted');
    }
}
