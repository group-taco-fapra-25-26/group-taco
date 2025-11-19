import { Component, input } from '@angular/core';
import { FiringEntry } from '../../../../classes/firing-entry';

@Component({
    selector: 'app-firing-table',
    standalone: true,
    imports: [],
    templateUrl: './firing-table.component.html',
    styleUrl: './firing-table.component.css',
})
export class FiringTableComponent {
    firingEntries = input<FiringEntry[]>();

    formatMarking(marking: Record<string, number>): string {
        return Object.entries(marking)
            .map(([key, value]) => `${key}:${value}`)
            .join(', ');
    }
}
