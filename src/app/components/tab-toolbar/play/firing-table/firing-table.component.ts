import { Component, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { filter, Subscription, take, tap } from 'rxjs';

import { ModeService } from '../../../../services/mode.service';
import { DisplayService } from '../../../../services/display.service';
import { PlayService } from '../../../../services/play.service';
import { PlayValidationService } from '../../../../services/play-validation.service';
import { Diagram } from '../../../../classes/diagram/diagram';
import { FiringEntry } from '../../../../classes/firing-entry';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
    selector: 'app-firing-table',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconButton,
        MatIcon,
        MatSliderModule,
        MatExpansionModule,
        TranslateModule,
        MatTooltip,
    ],
    templateUrl: './firing-table.component.html',
    styleUrl: './firing-table.component.css',
})
export class FiringTableComponent implements OnInit, OnDestroy {
    private _sub?: Subscription;

    protected modeService = inject(ModeService);
    private _displayService = inject(DisplayService);
    private _playService = inject(PlayService);
    private _playValidationService = inject(PlayValidationService);

    private readonly _TRANSITION_TIME: number = 1000;
    private readonly _MAX_TRANSITIONS_DEFAULT: number = 50;
    private readonly _MAX_SEQUENCES_DEFAULT: number = 250;

    private _lastFiringSequence = '';
    private _diagram: Diagram | undefined;
    @Input() firingEntries: FiringEntry[] = [];

    protected isFindSequencesFormVisible = false;
    protected maxTransitionCount: number = this._MAX_TRANSITIONS_DEFAULT;
    protected maxSequenceCount: number = this._MAX_SEQUENCES_DEFAULT;
    protected buttonColor = 'basic';

    ngOnInit(): void {
        this._sub = this._displayService.diagram$
            .pipe(
                tap((_) => {
                    this._diagram = undefined;
                    this.maxTransitionCount = this._MAX_TRANSITIONS_DEFAULT;
                    this.maxSequenceCount = this._MAX_SEQUENCES_DEFAULT;
                }),
                filter((diagram): diagram is Diagram => diagram instanceof Diagram),
            )
            .subscribe((diagram: Diagram) => {
                this._diagram = diagram;
            });
    }

    ngOnDestroy(): void {
        this._sub?.unsubscribe();
    }

    /**
     * Handles input changes for a firing sequence and validates the input if not in exam mode.
     * Updates the last recorded firing sequence and triggers validation.
     * @param entry - The firing entry containing the firing sequence to validate.
     * @returns A Promise that resolves when the validation is complete.
     */
    async onInputChange(entry: FiringEntry): Promise<void> {
        if (!this._diagram) return;
        entry.transitionCount = entry.labels.length;
        this._playService.currentFiringEntry = entry;
        if (this.modeService.isExamMode()) entry.isValid = undefined;
        else {
            if (entry.firingSequence.trim() === this._lastFiringSequence.trim()) return;
            this._lastFiringSequence = entry.firingSequence;
            await this._playValidationService.validateInput(this._diagram, entry);
        }
    }

    onDeleteEntry(id: number): void {
        this._playService.deleteFiringEntry(id);
    }

    onDeleteAllEntries(): void {
        this._playService.resetFiringEntries();
        this._displayService.diagram$
            .pipe(
                take(1),
                filter((diagram) => !!diagram && diagram instanceof Diagram),
            )
            .subscribe((diagram) => {
                diagram.resetMarking();
            });
    }

    onNewEntry(): void {
        if (this._diagram) this._playService.startNewFiringSequence(this._diagram);
    }

    async onPlaySequence(entry: FiringEntry): Promise<void> {
        if (this._diagram) {
            this._playService.closeCurrentFiringEntry();
            await this._playService.playSequence(this._diagram, entry, this._TRANSITION_TIME, true);
        }
    }

    onStopPlaySequence(entry: FiringEntry): void {
        entry.isPlaying = false;
    }

    async onValidateSequences(): Promise<void> {
        if (!this._diagram) return;
        for (const entry of this.firingEntries) {
            this._playService.currentFiringEntry = entry;
            await this._playValidationService.validateInput(this._diagram, entry);
        }
    }

    onFindSequences(): void {
        if (this._diagram) {
            this._playService.resetFiringEntries();
            this._playValidationService.findSequences(this._diagram, this.maxTransitionCount, this.maxSequenceCount);
            this._diagram.resetMarking();
        }
    }

    toggleFindSequencesForm(): void {
        if (!this._diagram) return;
        this.isFindSequencesFormVisible = !this.isFindSequencesFormVisible;
        this.buttonColor = this.isFindSequencesFormVisible ? 'primary' : 'basic';
    }

    isButtonActive(): boolean {
        return !this._diagram;
    }

    onMaxTransitionCountChange(event: Event): void {
        const inputElement = event.target as HTMLInputElement;
        this.maxTransitionCount = Number(inputElement.value);
    }

    onMaxSequenceCountChange(event: Event): void {
        const inputElement = event.target as HTMLInputElement;
        this.maxSequenceCount = Number(inputElement.value);
    }

    onAddButton(panel: MatExpansionPanel, event: Event): void {
        event.stopPropagation();
        if (!panel.expanded) panel.open();
        this.onNewEntry();
    }

    onValidateButton(panel: MatExpansionPanel, event: Event): void {
        event.stopPropagation();
        if (!panel.expanded) panel.open();
        this.onValidateSequences().catch(console.error);
    }

    onFindButton(panel: MatExpansionPanel, event: Event): void {
        event.stopPropagation();
        if (!panel.expanded) panel.open();
        this.onFindSequences();
    }
}
