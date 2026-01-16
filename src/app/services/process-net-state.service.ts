import { Injectable } from '@angular/core';
import { Diagram } from '../classes/diagram/diagram';
import { SerializationService } from './serialization.service';
import { ParserService } from './parser.service';

@Injectable({ providedIn: 'root' })
export class ProcessNetStateService {
    private cachedJson: string | null = null;

    constructor(
        private serializationService: SerializationService,
        private parserService: ParserService,
    ) {}

    /**
     * Persist the current process-net diagram (including marking) as a serialized snapshot.
     */
    save(diagram: Diagram): void {
        try {
            const marking = diagram.marking;
            this.cachedJson = this.serializationService.serializeJson(diagram);
        } catch (err) {
            console.error('Failed to persist process net snapshot', err);
        }
    }

    /**
     * Return a deep clone of the cached snapshot or null if none is stored/parsable.
     */
    restore(): Diagram | null {
        if (!this.cachedJson) {
            return null;
        }
        try {
            const parsed = JSON.parse(this.cachedJson);
            const clone = this.parserService.parseJson(this.cachedJson);
            return clone instanceof Diagram ? clone : null;
        } catch (err) {
            console.error('Failed to restore process net snapshot', err);
            return null;
        }
    }

    clear(): void {
        this.cachedJson = null;
    }

    hasSnapshot(): boolean {
        return this.cachedJson !== null;
    }
}
