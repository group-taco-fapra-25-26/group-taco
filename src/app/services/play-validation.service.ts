import { inject, Injectable } from '@angular/core';

import { ToasterNotificationService } from './toaster-notification.service';
import { ModeService } from './mode.service';
import { PlayService } from './play.service';
import { Diagram } from '../classes/diagram/diagram';
import { FiringEntry } from '../classes/firing-entry';

@Injectable({ providedIn: 'root' })
export class PlayValidationService {
    // TODO: use notification service to provide user feedback, consider mode from mode service
    private _notificationService = inject(ToasterNotificationService);
    private _modeService = inject(ModeService);
    private _playService = inject(PlayService);

    /**
     * Finds valid firing sequences in a Petri net diagram beginning at its start marking,
     * respecting a maximum sequence length.
     * @param diagram The Petri net diagram for which firing sequences are to be found.
     * @param maxTransitions The maximum number of transitions in the firing sequences.
     * @param maxSequencesCount The maximum number of firing sequences to find.
     */
    findSequences(diagram: Diagram, maxTransitions: number, maxSequencesCount: number): void {
        const visitedSequences = new Map<number, Set<string>>();
        const queue: { marking: Record<string, number>; sequence: string[] }[] = [];

        diagram.resetMarking();
        const startMarking = { ...diagram.marking };
        queue.push({ marking: startMarking, sequence: [] });
        this._playService.addFiringEntry('', 0, startMarking, true);
        let foundSequencesCount = 1;

        while (queue.length > 0 && foundSequencesCount < maxSequencesCount) {
            const { marking, sequence } = queue.shift()!;
            const currentLength = sequence.length;

            if (currentLength >= maxTransitions) continue;

            for (const transition of diagram.transitions) {
                if (foundSequencesCount >= maxSequencesCount) break;
                diagram.marking = { ...marking };

                if (transition.isActivated()) {
                    transition.fire(false);
                    diagram.updateMarking();
                    const currentMarking: Record<string, number> = { ...diagram.marking };
                    const newSequence = [...sequence, transition.label || transition.id];
                    const newSequenceStr = newSequence.join(' ');

                    const sequencesOfLength = visitedSequences.get(newSequence.length) || new Set<string>();
                    if (!sequencesOfLength.has(newSequenceStr)) {
                        sequencesOfLength.add(newSequenceStr);
                        visitedSequences.set(newSequence.length, sequencesOfLength);
                        this._playService.addFiringEntry(newSequenceStr, newSequence.length, currentMarking, true);
                        foundSequencesCount++;

                        if (newSequence.length < maxTransitions) {
                            queue.push({
                                marking: currentMarking,
                                sequence: newSequence,
                            });
                        }
                    }
                }
            }
        }
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
        const hasOnlyValidTransitions: boolean = this.hasOnlyValidTransitions(diagram, entry);
        // TODO: provide user feedback if invalid transitions are present
        if (hasOnlyValidTransitions) entry.isValid = await this._playService.playSequence(diagram, entry, 0, false);
        else entry.isValid = hasOnlyValidTransitions;
    }

    /**
     * Checks if all labels correspond to existing transitions in the diagram.
     * @param diagram
     *          The diagram for which the sequence is to be checked.
     * @param entry
     *          The firing entry to be validated.
     * @returns true if all labels correnspond to existing transitions, false otherwise.
     */
    private hasOnlyValidTransitions(diagram: Diagram, entry: FiringEntry): boolean {
        const possibleTransitions: string[] = diagram.getTransitionLabels();
        const labels = entry.labels;
        if (labels.length === 0) return true;
        if (possibleTransitions.length === 0 && labels.length > 0) return false;
        entry.isValid = true;
        for (const label of labels) {
            const exactMatch = possibleTransitions.includes(label);

            if (exactMatch) {
                continue;
            } else {
                entry.isValid = false;
                break;
            }
        }
        return entry.isValid;
    }
}
