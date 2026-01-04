import { Component, inject, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { filter, Subscription, take, tap } from 'rxjs';

import { ModeService } from '../../../../services/mode.service';
import { DisplayService } from '../../../../services/display.service';
import { PlayService } from '../../../../services/play.service';
import { PlayValidationService } from '../../../../services/play-validation.service';
import { Diagram } from '../../../../classes/diagram/diagram';
import { FiringEntry } from '../../../../classes/firing-entry';

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
        TranslateModule,
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

    private _lastFiringSequence = '';
    private _diagram: Diagram | undefined;
    @Input() firingEntries: FiringEntry[] = [];

    isFindSequencesFormVisible = false;
    requiredStartMarking = signal<Record<string, number>>({});
    requiredEndMarking = signal<Record<string, number>>({});
    requiredTransitionCount = signal<number | undefined>(undefined);
    buttonColor = 'basic';

    ngOnInit(): void {
        this._sub = this._displayService.diagram$
            .pipe(
                tap((diagram) => {
                    if (!diagram) {
                        this._diagram = undefined;
                        this.requiredStartMarking.set({});
                        this.requiredEndMarking.set({});
                        this.requiredTransitionCount.set(undefined);
                    }
                }),
                filter((diagram): diagram is Diagram => !!diagram && diagram instanceof Diagram),
                tap((diagram: Diagram) => {
                    this._diagram = diagram;
                    this.requiredStartMarking.set({ ...diagram.startMarking });
                    this.requiredEndMarking.set(
                        Object.keys(diagram.startMarking).reduce(
                            (acc, key) => {
                                acc[key] = 0;
                                return acc;
                            },
                            {} as Record<string, number>,
                        ),
                    );
                    this.requiredTransitionCount.set(undefined);
                }),
            )
            .subscribe();
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
        if (!this.modeService.isExamMode()) {
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
        if (this._diagram) await this._playService.playSequence(this._diagram, entry, this._TRANSITION_TIME, true);
    }

    async onValidateSequences(): Promise<void> {
        if (!this._diagram) return;
        for (const entry of this.firingEntries) {
            await this._playValidationService.validateInput(this._diagram, entry);
        }
    }

    onFindSequences(): void {
        if (this._diagram) {
            this._diagram.marking = this.requiredStartMarking();
            this._playValidationService.findSequences(
                this._diagram,
                this.requiredStartMarking(),
                this.requiredEndMarking(),
                this.requiredTransitionCount(),
            );
        }
    }

    toggleFindSequencesForm(): void {
        this.isFindSequencesFormVisible = !this.isFindSequencesFormVisible;
        this.buttonColor = this.isFindSequencesFormVisible ? 'primary' : 'basic';
    }

    updateMarking(tokenCount: number | undefined, event: Event): void {
        const inputValue = (event.target as HTMLInputElement).value;
        tokenCount = inputValue === '' ? undefined : Number(inputValue);
    }

    updateRequiredStartMarking(key: string, event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        this.requiredStartMarking.set({
            ...this.requiredStartMarking(),
            [key]: value,
        });
    }

    updateRequiredEndMarking(key: string, event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        this.requiredEndMarking.set({
            ...this.requiredEndMarking(),
            [key]: value,
        });
    }

    updateRequiredTransitionCount(event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        this.requiredTransitionCount.set(value);
    }
}
