/**
 * Representing a transition firing sequence in the petri net.
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
        return this.formatMarking(this.endMarking);
    }

    /**
     * Formats a marking into a string representation.
     * @param marking
     *          The marking to be formatted.
     * @returns The formatted marking string.
     */
    private formatMarking(marking: Record<string, number | undefined>): string {
        return Object.entries(marking)
            .filter(([, value]) => value !== 0)
            .map(([key, value]) => (value === 1 ? key : `${value}*${key}`))
            .join(' + ');
    }
}
