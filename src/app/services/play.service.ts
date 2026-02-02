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

    set startMarking(marking: Record<string, number>) {
        this._startMarking = marking;
    }

    set currentMarking(marking: Record<string, number>) {
        this._currentMarking.set(marking);
    }

    set currentFiringEntry(entry: FiringEntry | undefined) {
        this._currentFiringEntry = entry;
    }

    get currentFiringSequence(): string {
        return this._currentFiringSequence;
    }

    set currentFiringSequence(sequence: string) {
        this._currentFiringSequence = sequence;
    }

    /**
     * Clears all firing entries in the firing sequence table and deletes the last marking.
     */
    resetFiringEntries(): void {
        this.firingEntries.set([]);
        this._currentFiringEntry = undefined;
    }

    /**
     * Plays a firing sequence on a diagram.
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
        entry.setValidity(true, null);
        entry.isPlaying = true;

        const visitedLabels: string[] = [];
        for (const label of entry.labels) {
            // Check if the playback was cancelled
            if (!entry.isPlaying) {
                diagram.resetMarking();
                entry.endMarking = endMarkingCopy;
                return false;
            }
            await this.sleep(transitionTime);
            visitedLabels.push(label);
            const node: DiagramTransition | undefined = diagram.getTransitionByLabel(label);

            if (node) {
                const successfullyFired: boolean = this.processTransitionClicked(
                    diagram,
                    node,
                    false,
                    true,
                    displayFiring,
                    true,
                );
                if (!successfullyFired) {
                    entry.isPlaying = false;
                    entry.setValidity(false, ['PLAY.NOT_ACTIVATED', [label], visitedLabels]);
                    return false;
                }
                entry.endMarking = { ...diagram.marking };
            } else {
                entry.isPlaying = false;
                entry.setValidity(false, ['PLAY.NOT_PRESENT', [label], visitedLabels]);
                return false;
            }
        }
        entry.isPlaying = false;
        return true;
    }

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
     * @param diagram
     *          The diagram containing the transition.
     * @param node
     *          The transition node to be fired.
     * @param updateSequence
     *          Whether the firing sequence should be updated when firing, false when validating a sequence.
     * @param notify
     *          Whether notifications (e.g., transition not activated) should be displayed.
     * @param displayFiring
     *          Whether the color of the firing transition should be animated while firing.
     * @param isSimulation
     *          Whether the firing takes place only for simulation purposes.
     * @return true if the transition was fired successfully, otherwise false.
     */
    processTransitionClicked(
        diagram: Diagram,
        node: DiagramTransition,
        updateSequence: boolean,
        notify: boolean,
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
            if (updateSequence) {
                this._sourceNetService.updateEditedNet(diagram, { triggeredByFiring: true });
                this.updateFiringEntry(node.label, true);
            }
        } else {
            const isValid = !this._isExamMode() || isSimulation ? false : undefined;
            if (updateSequence) this.updateFiringEntry(node.label, false);
            if (notify && !this._isExamMode()) {
                this._notificationService.showWarning(
                    'TOASTER.HEADER.TRANSITION_NOT_ACTIVATED',
                    'TOASTER.BODY.TRANSITION_NOT_ACTIVATED',
                    { messageParams: { label: node.label } },
                );
                entry.setValidity(isValid, ['PLAY.NOT_ACTIVATED', [node.label], entry.labels]);
            }
        }
        this._currentFiringSequence = entry.firingSequence;
        return entry.isValid !== false;
    }

    /**
     * Checks if a transition can be fired in the current tab and state.
     * @param node
     *          The transition to be checked
     * @returns true if the transition can be fired
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
     * @param diagram
     *          The diagram for which the firing sequence is started.
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
     * @param id
     *          The ID of the firing entry that is to be deleted
     */
    deleteFiringEntry(id: number): void {
        this.firingEntries.update((entries) => entries.filter((entry) => entry.id !== id));
    }

    /**
     * Adds a predefined firing entry to the firing table.
     * @param firingSequence
     *          The firing sequence.
     * @param transitionCount
     *          The transition count.
     * @param endMarking
     *          The end marking.
     * @param isValid
     *          Indicates whether the firing entry is valid.
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
     * Appends the label of a fired transition to the current firing sequence
     * and updates transition count and optionally the end marking accordingly.
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

    private sleep(time: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, time));
    }
}
