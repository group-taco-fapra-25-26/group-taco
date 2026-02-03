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
import { MatTooltip } from '@angular/material/tooltip';
import { filter, Subscription, take, tap } from 'rxjs';

import { ModeService } from '../../../../services/mode.service';
import { ToasterNotificationService } from '../../../../services/toaster-notification.service';
import { DisplayService } from '../../../../services/display.service';
import { PlayService } from '../../../../services/play.service';
import { PlayValidationService } from '../../../../services/play-validation.service';
import { Tab } from '../../../../classes/tabs';
import { Diagram } from '../../../../classes/diagram/diagram';
import { FiringEntry } from '../../../../classes/firing-entry';
import { ToastList } from '../../../../classes/toast';

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

    modeService = inject(ModeService);
    playValidationService = inject(PlayValidationService);
    private _notificationService = inject(ToasterNotificationService);
    private _displayService = inject(DisplayService);
    private _playService = inject(PlayService);

    @Input() firingEntries: FiringEntry[] = [];
    isSequencePlaying = false;
    private readonly _TRANSITION_TIME: number = 1000;
    private _diagram: Diagram | undefined;

    // Attributes used for the "Find Sequences" functionality
    isFindSequencesFormVisible = false;
    private readonly _MAX_TRANSITIONS_DEFAULT: number = 50;
    private readonly _MAX_SEQUENCES_DEFAULT: number = 250;
    maxTransitionCount: number = this._MAX_TRANSITIONS_DEFAULT;
    maxSequenceCount: number = this._MAX_SEQUENCES_DEFAULT;

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
     * Handles changes to a firing sequence and triggers validation based on the current mode.
     *
     * - In **learning mode**, the input is validated immediately.
     * - In **exam mode**, the validity of the entry is set to `undefined` to increase difficulty.
     *
     * @param entry - The firing entry whose sequence was changed.
     * @returns A Promise that resolves when validation or processing is complete.
     */
    async onInputChange(entry: FiringEntry): Promise<void> {
        if (!this._diagram) return;
        entry.transitionCount = entry.labels.length;
        this._playService.currentFiringEntry = entry;
        if (entry.firingSequence.trim() === this._playService.currentFiringSequence.trim()) return;
        if (this.modeService.isExamMode(Tab.PLAY)) entry.setValidity(undefined, null);
        else await this.playValidationService.validateInput(this._diagram, entry);
        this._playService.currentFiringSequence = entry.firingSequence;
    }

    /**
     * Deletes a firing entry by its ID.
     * @param id - The ID of the entry to delete.
     */
    onDeleteEntry(id: number): void {
        this._playService.deleteFiringEntry(id);
    }

    /**
     * Deletes all firing entries and resets the diagram marking.
     */
    onDeleteAllEntries(): void {
        this._playService.clearFiringEntries();
        this._displayService.diagram$
            .pipe(
                take(1),
                filter((diagram) => !!diagram && diagram instanceof Diagram),
            )
            .subscribe((diagram) => {
                diagram.resetMarking();
            });
    }

    /**
     * Creates a new firing entry.
     */
    onNewEntry(): void {
        if (this._diagram) this._playService.startNewFiringSequence(this._diagram);
    }

    /**
     * Plays the firing sequence in the diagram.
     * @param entry - The firing entry to play.
     */
    async onPlaySequence(entry: FiringEntry): Promise<void> {
        if (this._diagram) {
            this.isSequencePlaying = true;
            await this._playService.playSequence(this._diagram, entry, this._TRANSITION_TIME, true);
            this.isSequencePlaying = false;
        }
    }

    /**
     * Stops the currently playing firing sequence.
     * @param entry - The firing entry to stop.
     */
    onStopPlaySequence(entry: FiringEntry): void {
        entry.isPlaying = false;
    }

    /**
     * Validates all firing sequences and shows a notification with the results.
     */
    async onValidateSequences(): Promise<void> {
        if (!this._diagram) return;
        const invalidSequences: ToastList[] = [];
        for (const entry of this.firingEntries) {
            this._playService.currentFiringEntry = entry;
            await this.playValidationService.validateInput(this._diagram, entry);
            if (!entry.isValid) invalidSequences.push({ message: entry.firingSequence });
        }
        if (invalidSequences.length === 0)
            this._notificationService.showSuccess(
                'TOASTER.HEADER.VALIDATION_COMPLETED',
                'TOASTER.BODY.VALID_SEQUENCES',
            );
        else
            this._notificationService.showWarning(
                'TOASTER.HEADER.VALIDATION_COMPLETED',
                'TOASTER.BODY.INVALID_SEQUENCES',
                { duration: 8000, list: invalidSequences },
            );
    }

    /**
     * Finds firing sequences based on the current Petri net and user-defined limits.
     */
    onFindSequences(): void {
        if (!this._diagram) return;
        this._playService.clearFiringEntries();
        this.playValidationService.findSequences(this._diagram, this.maxTransitionCount, this.maxSequenceCount);
        this._diagram.resetMarking();
        this._notificationService.showSuccess(
            'TOASTER.HEADER.SEQUENCE_GENERATION',
            'TOASTER.BODY.SEQUENCE_GENERATION',
            {
                duration: 8000,
                messageParams: { maxTransitionCount: this.maxTransitionCount, maxSequenceCount: this.maxSequenceCount },
            },
        );
    }

    /**
     * Toggles the visibility of the "Find Sequences" form.
     */
    toggleFindSequencesForm(): void {
        if (!this._diagram) return;
        this.isFindSequencesFormVisible = !this.isFindSequencesFormVisible;
    }

    /**
     * Checks if buttons should be disabled (e.g., when no Petri net is loaded or a sequence is playing).
     * @returns true if buttons should be disabled, false otherwise.
     */
    isButtonDisabled(): boolean {
        return !this._diagram || this.isSequencePlaying;
    }

    /**
     * Updates the maximum transition count based on user input.
     * @param event - The input event containing the new value.
     */
    onMaxTransitionCountChange(event: Event): void {
        const inputElement = event.target as HTMLInputElement;
        this.maxTransitionCount = Number(inputElement.value);
    }

    /**
     * Updates the maximum sequence count based on user input.
     * @param event - The input event containing the new value.
     */
    onMaxSequenceCountChange(event: Event): void {
        const inputElement = event.target as HTMLInputElement;
        this.maxSequenceCount = Number(inputElement.value);
    }

    /**
     * Adds a new firing entry when the "Add" button is clicked.
     * @param panel - The expansion panel containing the button.
     * @param event - The click event.
     */
    onAddButton(panel: MatExpansionPanel, event: Event): void {
        event.stopPropagation();
        if (!panel.expanded) panel.open();
        this.onNewEntry();
    }

    /**
     * Validates all sequences when the "Validate" button is clicked.
     * @param panel - The expansion panel containing the button.
     * @param event - The click event.
     */
    onValidateButton(panel: MatExpansionPanel, event: Event): void {
        event.stopPropagation();
        if (!panel.expanded) panel.open();
        this.onValidateSequences().catch(console.error);
    }

    /**
     * Finds sequences when the "Find" button is clicked.
     * @param panel - The expansion panel containing the button.
     * @param event - The click event.
     */
    onFindButton(panel: MatExpansionPanel, event: Event): void {
        event.stopPropagation();
        if (!panel.expanded) panel.open();
        this.onFindSequences();
    }
}
