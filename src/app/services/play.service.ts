import { computed, inject, Injectable, signal } from '@angular/core';

import { ModeService } from './mode.service';
import { ToasterNotificationService } from './toaster-notification.service';
import { SourcePetriNetService } from './source-petri-net.service';
import { TabStateService } from './tab-state.service';
import { Tab } from '../classes/tabs';
import { Diagram } from '../classes/diagram/diagram';
import { DiagramTransition } from '../classes/diagram/diagram-transition';
import { FiringEntry } from '../classes/firing-entry';

@Injectable({ providedIn: 'root' })
export class PlayService {
    private _modeService = inject(ModeService);
    private _notificationService = inject(ToasterNotificationService);
    private _sourceNetService = inject(SourcePetriNetService);
    private _tabStateService = inject(TabStateService);

    private _startMarking: Record<string, number> = {};
    private _currentMarking = signal<Record<string, number>>({ ...this._startMarking });
    private _currentFiringEntry: FiringEntry | undefined;
    private _currentFiringSequence = '';
    private _idCounter = 0;

    firingEntries = signal<FiringEntry[]>([]);

    private _isExamMode = computed(() => this._modeService.isExamMode(Tab.PLAY));

    /**
     * Sets the initial marking of the Petri net.
     * @param marking - The marking to set as the start marking.
     */
    set startMarking(marking: Record<string, number>) {
        this._startMarking = marking;
    }

    /**
     * Sets the current marking of the Petri net.
     * @param marking - The marking to set as the current marking.
     */
    set currentMarking(marking: Record<string, number>) {
        this._currentMarking.set(marking);
    }

    /**
     * Sets the currently active firing entry. This is used to avoid unnecessary
     * validation, e.g. when spaces are added or removed.
     * @param entry - The firing entry to set as current.
     */
    set currentFiringEntry(entry: FiringEntry | undefined) {
        this._currentFiringEntry = entry;
    }

    /**
     * Returns the current firing sequence as a string.
     * @returns The current firing sequence.
     */
    get currentFiringSequence(): string {
        return this._currentFiringSequence;
    }

    /**
     * Sets the current firing sequence.
     * @param sequence - The firing sequence to set.
     */
    set currentFiringSequence(sequence: string) {
        this._currentFiringSequence = sequence;
    }

    /**
     * Clears all firing entries in the firing sequence table.
     */
    clearFiringEntries(): void {
        this.firingEntries.set([]);
        this._currentFiringEntry = undefined;
    }

    /**
     * Plays a firing sequence on a Petri net diagram.
     * @param diagram
     *          The diagram on which the firing sequence is played.
     * @param entry
     *          The firing entry containing the sequence to be played.
     * @param transitionTime
     *          The time period between firing each transition in milliseconds.
     * @param displayFiring
     *          Indicates whether the color of the firing transition should be animated while firing.
     * @return A Promise that resolves when the sequence firing is complete.
     */
    async playSequence(
        diagram: Diagram,
        entry: FiringEntry,
        transitionTime: number,
        displayFiring: boolean,
    ): Promise<boolean> {
        const endMarkingCopy: Record<string, number> = { ...entry.endMarking };
        if (this._currentFiringEntry) this._currentFiringEntry.endMarking = { ...diagram.marking };
        diagram.resetMarking();
        this._currentFiringSequence = entry.firingSequence;
        this._currentFiringEntry = entry;
        entry.endMarking = diagram.marking;
        const isValidation = transitionTime === 0;
        if (!isValidation) entry.isPlaying = true;

        const visitedLabels: string[] = [];
        for (const label of entry.labels) {
            // Check if the playback was cancelled
            if (!entry.isPlaying && !isValidation) {
                diagram.resetMarking();
                entry.endMarking = endMarkingCopy;
                return false;
            }
            await this._sleep(transitionTime);
            visitedLabels.push(label);
            const node: DiagramTransition | undefined = diagram.getTransitionByLabel(label);

            if (node) {
                const successfullyFired: boolean = this.processTransitionClicked(
                    diagram,
                    node,
                    true,
                    displayFiring,
                    true,
                );
                if (!successfullyFired) {
                    entry.isPlaying = false;
                    entry.setValidity(false, {
                        type: 'PLAY.NOT_ACTIVATED',
                        invalidLabel: label,
                        visitedLabels: visitedLabels,
                    });
                    return false;
                }
                entry.endMarking = { ...diagram.marking };
            } else {
                entry.isPlaying = false;
                entry.setValidity(false, {
                    type: 'PLAY.NOT_PRESENT',
                    invalidLabel: label,
                    visitedLabels: visitedLabels,
                });
                return false;
            }
        }
        entry.isPlaying = false;
        return true;
    }

    /**
     * Fires a transition in the Petri net if it is activated.
     * @param node - The transition to fire.
     * @param diagram - The Petri net diagram.
     * @param displayFiring - Whether to visually highlight the firing transition.
     * @returns True if the transition was fired successfully, false otherwise.
     */
    fireTransition(node: DiagramTransition, diagram: Diagram, displayFiring: boolean): boolean {
        if (node.isActivated()) {
            node.fire(displayFiring);
            diagram.updateMarking();
            return true;
        }
        return false;
    }

    /**
     * Fires a transition if it is activated, updates the diagram
     * and optionally records the firing in the firing sequence.
     * Depending on the mode (learning mode/ exam mode), a warning toast is displayed.
     * @param diagram
     *          The diagram containing the transition.
     * @param node
     *          The transition node to be fired.
     * @param showNotification
     *          Whether notifications (e.g., transition not activated) should be displayed.
     * @param displayFiring
     *          Whether the color of the firing transition should be animated while firing.
     * @param isSimulation
     *          Whether the firing takes place only for simulation (e.g. playback) purposes.
     * @return true if the transition was fired successfully, otherwise false.
     */
    processTransitionClicked(
        diagram: Diagram,
        node: DiagramTransition,
        showNotification: boolean,
        displayFiring: boolean,
        isSimulation: boolean,
    ): boolean {
        const entry: FiringEntry =
            this._currentFiringEntry && (!this._currentFiringEntry.isClosed || isSimulation)
                ? this._currentFiringEntry
                : this.getEmptyFiringEntry();
        if (node.isActivated() && entry.isValid !== false && (!this._isExamMode() || isSimulation)) {
            this.fireTransition(node, diagram, displayFiring);
            this._currentMarking.set({ ...diagram.marking });
            entry.endMarking = { ...diagram.marking };
            entry.setValidity(true, null);
            if (!isSimulation) {
                this._sourceNetService.updateEditedNet(diagram, { triggeredByFiring: true });
                this.updateFiringEntry(node.label, true);
            }
        } else {
            const isValid = !this._isExamMode() || isSimulation ? false : undefined;
            if (!isSimulation) this.updateFiringEntry(node.label, false);
            if (showNotification && !this._isExamMode()) {
                this._notificationService.showWarning(
                    'TOASTER.HEADER.TRANSITION_NOT_ACTIVATED',
                    'TOASTER.BODY.TRANSITION_NOT_ACTIVATED',
                    { messageParams: { label: node.label } },
                );
            }
            entry.setValidity(isValid, {
                type: 'PLAY.NOT_ACTIVATED',
                invalidLabel: node.label,
                visitedLabels: entry.labels,
            });
        }
        this._currentFiringSequence = entry.firingSequence;
        return entry.isValid === true;
    }

    /**
     * Checks if a transition can be fired in the current tab and activation state.
     * @param node - The transition to be checked
     * @returns true if the transition can be fired, else false.
     */
    canBeFired(node: DiagramTransition): boolean {
        return (
            (this._tabStateService.currentTab() === Tab.PLAY ||
                this._tabStateService.currentTab() === Tab.REACHABILITY_GRAPH ||
                this._tabStateService.currentTab() === Tab.PROCESS_NET) &&
            node.isActivated()
        );
    }

    /**
     * Starts a new, empty firing sequence.
     * @param diagram - The diagram for which the firing sequence is started.
     */
    startNewFiringSequence(diagram: Diagram): void {
        diagram.resetMarking();
        if (this._currentFiringEntry) this.closeCurrentFiringEntry();
        this.getEmptyFiringEntry();
        setTimeout(() => {
            document.getElementById('firing-sequence-input')?.focus();
        }, 0);
        this._currentFiringSequence = '';
    }

    /**
     * Deletes a firing entry from the firing sequence table.
     * @param id - The ID of the firing entry that is to be deleted
     */
    deleteFiringEntry(id: number): void {
        this.firingEntries.update((entries) => entries.filter((entry) => entry.id !== id));
    }

    /**
     * Adds a predefined firing entry to the firing table.
     * @param firingSequence - The firing sequence.
     * @param transitionCount - The transition count.
     * @param endMarking - The end marking.
     * @param isValid - Indicates whether the firing entry is valid.
     */
    addFiringEntry(
        firingSequence: string,
        transitionCount: number,
        endMarking: Record<string, number>,
        isValid: boolean | undefined,
    ) {
        if (this._currentFiringEntry) this.closeCurrentFiringEntry();
        const newEntry = new FiringEntry(this.getNewId(), firingSequence, transitionCount, endMarking, true, isValid);
        this.firingEntries.update((entries) => {
            entries.push(newEntry);
            return entries;
        });
    }

    /**
     * Appends the label of a fired transition to the current firing sequence.
     * Updates the transition count and optionally the end marking accordingly.
     * @param label
     *          The label of the fired transition.
     * @param updateEndMarking
     *          Indicates whether the end marking should be updated. Is set to false in
     *          the case of an invalid input to the firing sequence.
     */
    updateFiringEntry(label: string, updateEndMarking: boolean): void {
        const entry = this._currentFiringEntry || this.getEmptyFiringEntry();
        const delimiter = entry.firingSequence.includes('; ')
            ? '; '
            : entry.firingSequence.includes(', ')
              ? ', '
              : entry.firingSequence.includes(';')
                ? ';'
                : entry.firingSequence.includes(',')
                  ? ','
                  : ' ';
        if (entry.firingSequence.length === 0) entry.firingSequence = label;
        else entry.firingSequence = entry.firingSequence.replace(/[\s,;]+$/, '') + delimiter + label;
        entry.transitionCount += 1;
        if (this._isExamMode()) entry.isValid = undefined;
        if (updateEndMarking) entry.endMarking = { ...this._currentMarking() };
    }

    /**
     * Closes the current firing entry in the firing table, preventing further updates to it.
     */
    closeCurrentFiringEntry(): void {
        if (this._currentFiringEntry)
            this.firingEntries.update((entries) => {
                this._currentFiringEntry!.isClosed = true;
                return entries;
            });
        this._currentFiringEntry = undefined;
    }

    /**
     * Creates a new empty firing entry with start values.
     * @returns A firing entry with an empty sequence.
     */
    private getEmptyFiringEntry(): FiringEntry {
        const endMarking = { ...this._startMarking };
        const isValid = this._isExamMode() ? undefined : true;
        const newFiringEntry = new FiringEntry(this.getNewId(), '', 0, endMarking, false, isValid);
        this._currentFiringEntry = newFiringEntry;
        this.firingEntries.update((entries) => {
            entries.push(newFiringEntry);
            return entries;
        });
        return newFiringEntry;
    }

    /**
     * Generates a new unique ID for a firing entry.
     * @returns The new ID
     */
    getNewId(): number {
        return this._idCounter++;
    }

    /**
     * Returns a Promise that resolves after a specified delay.
     * @param time - Delay in milliseconds.
     * @returns A Promise that resolves after the given time.
     */
    private _sleep(time: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, time));
    }
}
