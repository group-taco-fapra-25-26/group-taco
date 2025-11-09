import { Component, output } from '@angular/core';
import { DisplayComponent } from '../../display/display.component';
import { ClearNetButtonComponent } from '../../clear-net-button/clear-net-button.component';

@Component({
    selector: 'app-reachability-graph',
    standalone: true,
    imports: [DisplayComponent, ClearNetButtonComponent],
    templateUrl: './reachability-graph.component.html',
    styleUrl: './reachability-graph.component.css',
})
export class ReachabilityGraphComponent {
    readonly clearAll = output<void>();
    readonly fileContent = output<string>();

    public onNetCleared() {
        console.log('ReachabilityGraphComponent: Net cleared from button');
    }

    public onClearAll() {
        this.clearAll.emit();
        console.log('ReachabilityGraphComponent: Clear all event emitted');
    }
}
