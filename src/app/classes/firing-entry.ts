/**
 * Representing a transition firing sequence in the petri net.
 */
export class FiringEntry {
    private _delimiters = /\s+|,|;|, |; |,/;

    constructor(
        public id: number,
        public firingSequence: string,
        public transitionCount: number,
        public startMarking: Record<string, number>,
        public endMarking: Record<string, number | undefined>,
        public isClosed: boolean,
        public isValid: boolean | undefined,
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
     * Returns the formatted start marking as a string.
     * @return The formatted start marking string.
     */
    get formattedStartMarking(): string {
        return this.formatMarking(this.startMarking);
    }

    /**
     * Returns the formatted end marking as a string.
     * @return The formatted end marking string.
     */
    get formattedEndMarking(): string {
        return this.formatMarking(this.endMarking);
    }

    /**
     * Replaces every token count of the end marking with undefined.
     * Used for invalid firing entries or input in exam mode (corresponds to empty input fields).
     */
    maskEndMarking(): void {
        Object.keys(this.endMarking).forEach((key) => {
            this.endMarking[key] = undefined;
        });
    }

    /**
     * Formats a marking into a string representation.
     * @param marking
     *          The marking to be formatted.
     * @returns The formatted marking string.
     */
    private formatMarking(marking: Record<string, number | undefined>): string {
        return Object.entries(marking)
            .map(([key, value]) => `${key}: ${value === undefined ? '?' : value}`)
            .join(', ');
    }
}
