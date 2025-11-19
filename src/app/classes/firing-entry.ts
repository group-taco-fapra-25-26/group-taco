/**
 * Representing a transition firing sequence in the petri net.
 */
export interface FiringEntry {
    id: number;
    firingSequence: string;
    transitionCount: number;
    startMarking: Record<string, number>;
    endMarking: Record<string, number>;
}
