import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { DisplayComponent } from '../../display/display.component';
import { DisplayService } from '../../../services/display.service';
import { PlayService } from '../../../services/play.service';
import { ClearNetButtonComponent } from '../../clear-net-button/clear-net-button.component';
import { FiringTableComponent } from './firing-table/firing-table.component';
import { Diagram } from '../../../classes/diagram/diagram';
import { filter, Subscription, switchMap, tap } from 'rxjs';
import { UploadComponent } from '../upload/upload.component';
import { SaveComponent } from '../save/save.component';

@Component({
    selector: 'app-play',
    standalone: true,
    imports: [DisplayComponent, ClearNetButtonComponent, FiringTableComponent, UploadComponent, SaveComponent],
    templateUrl: './play.component.html',
    styleUrl: './play.component.css',
})
export class PlayComponent implements OnInit, OnDestroy {
    private _sub?: Subscription;

    private _displayService = inject(DisplayService);
    private _playService = inject(PlayService);

    firingEntries = this._playService.firingEntries;

    ngOnInit(): void {
        this._sub = this._displayService.diagram$
            .pipe(
                filter((diagram) => !!diagram && diagram instanceof Diagram),
                tap((diagram: Diagram) => {
                    this._playService.resetFiringEntries();
                    this._playService.startMarking = diagram.startMarking;
                }),
                switchMap((diagram: Diagram) => diagram.currentMarking$),
            )
            .subscribe((marking) => {
                this._playService.currentMarking = marking;
            });
    }

    ngOnDestroy(): void {
        this._sub?.unsubscribe();
    }
}
