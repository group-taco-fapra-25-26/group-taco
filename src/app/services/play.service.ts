import { inject, Injectable, signal } from '@angular/core';

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
    private _currentMarking = signal<Record<string, number>>(this._startMarking);
    private _currentFiringEntry: FiringEntry | undefined;
    private _lastMarking: Record<string, number> | undefined;
    private _idCounter = 0;

    firingEntries = signal<FiringEntry[]>([]);

    set startMarking(marking: Record<string, number>) {
        this._startMarking = marking;
    }

    set currentMarking(marking: Record<string, number>) {
        this._currentMarking.set(marking);
    }

    /**
     * Recovers the marking of the diagram from the last marking stored in the service.
     * @param diagram
     *          The diagram to recover the marking for.
     */
    recoverLastMarking(diagram: Diagram): void {
        if (this._lastMarking) diagram.marking = this._lastMarking;
    }

    /**
     * Clears all firing entries in the firing sequence table and deletes the last marking.
     */
    resetFiringEntries(): void {
        this.firingEntries.set([]);
        this._lastMarking = undefined;
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
        this._currentFiringEntry = entry;
        let isEntryValid = true;
        diagram.marking = { ...entry.startMarking };

        for (const label of entry.labels) {
            await this.sleep(transitionTime);
            const node: DiagramTransition | undefined = diagram.getTransitionByLabel(label);

            if (node) {
                const successfullyFired: boolean = this.processTransitionClick(
                    diagram,
                    node,
                    false,
                    true,
                    displayFiring,
                );
                if (!successfullyFired) {
                    isEntryValid = false;
                    return isEntryValid;
                }
                entry.endMarking = { ...diagram.marking };
            }
        }
        return isEntryValid;
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
     *          Whether notifications (e. g., transition not activated) should be displayed.
     * @param displayFiring
     *          Whether the color of the firing transition should be animated while firing.
     * @return true if the transition was fired successfully, otherwise false.
     */
    processTransitionClick(
        diagram: Diagram,
        node: DiagramTransition,
        updateSequence: boolean,
        notify: boolean,
        displayFiring: boolean,
    ): boolean {
        if (node.isActivated()) {
            node.fire(displayFiring);
            diagram.updateMarking();
            this._lastMarking = diagram.marking;
            if (updateSequence) {
                this._sourceNetService.updateEditedNet(diagram);
                const updateEndMarking = !this._modeService.isExamMode();
                this.updateFiringEntry(node.label, updateEndMarking);
            }
            this._setValidStatus(true);
            return true;
        } else if (notify) {
            this._notificationService.showWarning(
                'TOASTER.HEADER.TRANSITION_NOT_ACTIVATED',
                'TOASTER.BODY.TRANSITION_NOT_ACTIVATED',
                { messageParams: { label: node.label } },
            );
        }
        if (updateSequence) this.updateFiringEntry(node.label, false);
        this._setValidStatus(false);
        this._currentFiringEntry?.maskEndMarking();
        return false;
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
                this._tabStateService.currentTab() === Tab.REACHABILITY_GRAPH) &&
            node.isActivated()
        );
    }

    /**
     * Starts a new, empty firing sequence.
     * @param diagram
     *          The diagram for which the firing sequence is started.
     */
    startNewFiringSequence(diagram: Diagram): void {
        diagram.marking = this._startMarking;
        this._lastMarking = this._startMarking;
        this.closeCurrentFiringEntry();
        this._getEmptyFiringEntry();
        setTimeout(() => {
            document.getElementById('firing-sequence-input')?.focus();
        }, 0);
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
     * @param startMarking
     *          The start marking.
     * @param endMarking
     *          The end marking.
     * @param isValid
     *          Indicates whether the firing entry is valid.
     */
    addFiringEntry(
        firingSequence: string,
        transitionCount: number,
        startMarking: Record<string, number>,
        endMarking: Record<string, number>,
        isValid: boolean | undefined,
    ) {
        this.closeCurrentFiringEntry();
        const newEntry = new FiringEntry(
            this.getNewId(),
            firingSequence,
            transitionCount,
            startMarking,
            endMarking,
            true,
            isValid,
        );
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
        const entry = this._currentFiringEntry || this._getEmptyFiringEntry();
        entry.firingSequence += ` ${label}`;
        entry.transitionCount += 1;
        if (updateEndMarking) entry.endMarking = this._currentMarking();
    }

    /**
     * Sets the isValid attribute of the current firing sequence.
     * @param isValid
     *          Indicates whether the current firing entry is valid.
     */
    private _setValidStatus(isValid: boolean): void {
        if (this._currentFiringEntry) this._currentFiringEntry.isValid = isValid;
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
    }

    /**
     * Creates a new empty firing entry with start values.
     * @returns A firing entry with an empty sequence.
     */
    private _getEmptyFiringEntry(): FiringEntry {
        const endMarking = { ...this._startMarking };
        const newFiringEntry = new FiringEntry(
            this.getNewId(),
            '',
            0,
            { ...this._startMarking },
            endMarking,
            false,
            undefined,
        );
        if (this._modeService.isExamMode()) newFiringEntry.maskEndMarking();
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
