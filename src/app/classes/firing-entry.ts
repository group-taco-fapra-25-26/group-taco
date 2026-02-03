/**
 * Representing a transition firing sequence in the Petri net.
 */
export class FiringEntry {
    private _delimiters = /\s+|,|;|, |; /;

    constructor(
        public id: number,
        public firingSequence: string,
        public transitionCount: number,
        public endMarking: Record<string, number>,
        public isClosed: boolean,
        public isValid: boolean | undefined,
        public isPlaying = false,
        public error: FiringSequenceError | null = null,
    ) {}

    /**
     * Returns the labels of the transitions in the firing sequence as an array of strings.
     * @return The array of transition labels.
     */
    get labels(): string[] {
        return this.firingSequence
            .trim()
            .split(this._delimiters)
            .filter((label) => label.length > 0);
    }

    /**
     * Returns the formatted end marking as a string.
     * @return The formatted end marking string.
     */
    get formattedEndMarking(): string {
        return this._formatMarking(this.endMarking);
    }

    /**
     * Sets the validity of the sequence and optionally an associated error.
     * @param isValid - The validity status.
     * @param error - Error details, if the sequence is invalid.
     */
    setValidity(isValid: boolean | undefined, error: FiringSequenceError | null) {
        this.isValid = isValid;
        this.error = error;
    }

    /**
     * Formats a marking into a string representation.
     * @param marking - The marking to be formatted.
     * @returns The formatted marking string.
     */
    private _formatMarking(marking: Record<string, number | undefined>): string {
        return Object.entries(marking)
            .filter(([, value]) => value !== 0)
            .map(([key, value]) => (value === 1 ? key : `${value}*${key}`))
            .join(' + ');
    }
}

/**
 * Represents an error in a firing sequence, including the translatable error type (e.g., 'PLAY.NOT_ACTIVATED'),
 * the invalid label, and the sequence context (visited labels until the error occured).
 */
export interface FiringSequenceError {
    type: string;
    invalidLabel: string;
    visitedLabels: string[];
}
