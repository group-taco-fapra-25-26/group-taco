import { inject, Injectable } from '@angular/core';

import { ToasterNotificationService } from './toaster-notification.service';
import { ModeService } from './mode.service';
import { PlayService } from './play.service';
import { Diagram } from '../classes/diagram/diagram';
import { FiringEntry } from '../classes/firing-entry';

@Injectable({ providedIn: 'root' })
export class PlayValidationService {
    // TODO:
    // - use notification service to provide user feedback
    private _notificationService = inject(ToasterNotificationService);
    private _modeService = inject(ModeService);
    private _playService = inject(PlayService);

    private readonly _MAX_SEQUENCES: number = 10;
    private readonly _MAX_TRANSITIONS_DEFAULT: number = 100;

    /**
     * Finds valid firing sequences in a Petri net diagram that transform the start marking to the end marking.
     * @param diagram
     *          The Petri net diagram for which firing sequences are to be found.
     * @param requiredStartMarking
     *          The required start marking obtained from the form.
     * @param requiredEndMarking
     *          The required end marking obtained from the form.
     * @param requiredTransitionCount
     *          Optional. The exact number of transitions the firing sequences should contain.
     *          If not provided, sequences with up to `_MAX_TRANSITIONS_DEFAULT` transitions are considered.
     */
    findSequences(
        diagram: Diagram,
        requiredStartMarking: Record<string, number>,
        requiredEndMarking: Record<string, number>,
        requiredTransitionCount?: number,
    ): void {
        let sequenceCount = 0;

        const isValidTransitionCount = (currentLength: number): boolean => {
            if (requiredTransitionCount !== undefined) {
                return currentLength === requiredTransitionCount;
            } else {
                return currentLength <= this._MAX_TRANSITIONS_DEFAULT;
            }
        };

        const depthFirstSearch = (
            currentMarking: Record<string, number>,
            firedTransitions: string[],
            visited: Set<string>,
        ): void => {
            if (sequenceCount >= this._MAX_SEQUENCES) return;

            if (
                this._isEquivalentMarking(currentMarking, requiredEndMarking) &&
                isValidTransitionCount(firedTransitions.length)
            ) {
                this._playService.addFiringEntry(
                    firedTransitions.join(' '),
                    firedTransitions.length,
                    requiredStartMarking,
                    requiredEndMarking,
                    true,
                );
                sequenceCount++;
            }

            if (firedTransitions.length >= (requiredTransitionCount ?? this._MAX_SEQUENCES)) return;

            // Prevent cycle formation
            const markingKey = JSON.stringify(currentMarking);
            if (visited.has(markingKey)) return;
            const newVisited = new Set(visited);
            newVisited.add(markingKey);

            for (const transition of diagram.transitions) {
                // Save old marking for the case of the current transition not firing
                const oldMarking = { ...diagram.marking };
                const successfullyFired = this._playService.processTransitionClick(
                    diagram,
                    transition,
                    false,
                    false,
                    false,
                );
                if (successfullyFired) {
                    depthFirstSearch(
                        { ...diagram.marking },
                        [...firedTransitions, transition.label || transition.id],
                        newVisited,
                    );
                    diagram.marking = { ...oldMarking };
                }
            }
        };
        depthFirstSearch(requiredStartMarking, [], new Set());
    }

    /**
     * Validates a firing entry input.
     * @param diagram
     *          The diagram on which the firing entry is to be validated.
     * @param entry
     *          The firing entry to be validated.
     * @returns A promise that returns whether the input is valid when the validation is complete.
     */
    async validateInput(diagram: Diagram, entry: FiringEntry): Promise<void> {
        let isValid = false;
        entry.transitionCount = entry.labels.length;
        const hasOnlyValidTransitions: boolean = this._hasOnlyValidTransitions(diagram, entry.labels);
        // TODO: provide user feedback if invalid transitions are present
        if (hasOnlyValidTransitions) isValid = await this._isValidFiringEntry(diagram, entry);
        console.log(entry.firingSequence, hasOnlyValidTransitions, isValid);
        entry.isValid = isValid;
    }

    /**
     * Checks if all labels correspond to (the start of) existing transitions in the diagram.
     * @param diagram
     *          The diagram for which the sequence is to be checked.
     * @param labels
     *          The labels to be validated.
     * @returns true if all labels correnspond to (the start of) existing transitions, false otherwise.
     */
    private _hasOnlyValidTransitions(diagram: Diagram, labels: string[]): boolean {
        const possibleTransitions: string[] = diagram.getTransitionLabels();
        if (labels.length === 0) return true;
        if (possibleTransitions.length === 0 && labels.length > 0) return false;
        return labels.every(
            (label) =>
                possibleTransitions.includes(label) ||
                possibleTransitions.some((transition) => transition.startsWith(label)),
        );
    }

    /**
     * Checks whether a firing entry is valid for a given diagram.
     * @param diagram
     *          The diagram on which the firing entry is to be validated.
     * @param entry
     *          The firing entry to be validated.
     * @returns A promise that returns true if the firing entry is valid, false otherwise.
     */
    private async _isValidFiringEntry(diagram: Diagram, entry: FiringEntry): Promise<boolean> {
        diagram.marking = { ...entry.startMarking };
        const givenEndMarking: Record<string, number | undefined> = { ...entry.endMarking };
        const successfullyPlayed: boolean = await this._playService.playSequence(diagram, entry, 0, false);
        const isValidEndMarking =
            !this._modeService.isExamMode() || this._isEquivalentMarking(givenEndMarking, diagram.marking);
        const isValid: boolean = successfullyPlayed && isValidEndMarking;
        if (isValid) entry.endMarking = { ...diagram.marking };
        return isValid;
        // TODO: Find error cause: When new Sequence is clicked in learn mode, then exam mode is activated and a valid entry is input
        // -> When clicking Validate Firing Table the entry is wrongly marked as invalid. isEquivalentMarking is false, so the error
        // must have occured by setting a wrong marking in the play service's playSequence method.
    }

    /**
     * Checks whether two markings are equivalent.
     * @param a
     *          The first marking.
     * @param b
     *          The second marking.
     * @returns true if the markings are equivalent, else false (undefined token counts are used as wildcards).
     */
    private _isEquivalentMarking(
        a: Record<string, number | undefined>,
        b: Record<string, number | undefined>,
    ): boolean {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) return false;
        return aKeys.every((key) => {
            const valA = a[key];
            const valB = b[key];
            if (valA === undefined || valB === undefined) return true;
            return valA === valB;
        });
    }
}
