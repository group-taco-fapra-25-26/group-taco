import { Component, inject } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatTooltip } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { KeyValue, KeyValuePipe } from '@angular/common';
import { DisplayService } from 'src/app/services/display.service';
import { ReachabilityGraphService } from 'src/app/reachability-graph.service';

@Component({
    selector: 'app-rg-marking-dialog',
    imports: [
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconButton,
        MatIcon,
        MatSliderModule,
        MatExpansionModule,
        MatTooltip,
        KeyValuePipe,
    ],
    templateUrl: './rg-marking-dialog.component.html',
    styleUrl: './rg-marking-dialog.component.css',
})
export class RgMarkingDialogComponent {
    private _displayService = inject(DisplayService);
    private _reachabilityGraphService = inject(ReachabilityGraphService);

    incrementMarking() {}

    decrementMarking() {}
}
