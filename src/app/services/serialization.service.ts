import { Injectable } from '@angular/core';
import { Diagram } from '../classes/diagram/diagram';
import { JsonPetriNet } from '../classes/json-petri-net';
import { DiagramPlace } from '../classes/diagram/diagram-place';
import { DiagramTransition } from '../classes/diagram/diagram-transition';
import { DiagramArc } from '../classes/diagram/diagram-arc';

@Injectable({
    providedIn: 'root',
})
export class SerializationService {
    /**
     * Serializes a 'Diagram'-object back into a JSON-string
     * compatible with the 'JsonPetriNet'-format.
     */
    public serialize(diagram: Diagram): string {
        const rawNet: JsonPetriNet = {
            places: [],
            transitions: [],
            arcs: {},
            marking: {},
            labels: {},
            layout: {},
        };

        this._serializePlaces(diagram.places as DiagramPlace[], rawNet);
        this._serializeTransitions(diagram.transitions, rawNet);
        this._serializeArcs(diagram.arcs, rawNet);

        return JSON.stringify(rawNet, null, 2);
    }

    /**
     * Populates places, marking, and layout data for places.
     */
    private _serializePlaces(places: DiagramPlace[], rawNet: JsonPetriNet): void {
        for (const place of places) {
            rawNet.places.push(place.id);
            rawNet.layout = rawNet.layout ?? {};
            rawNet.layout[place.id] = { x: place.x, y: place.y };

            if (place.tokenCount > 0) {
                rawNet.marking = rawNet.marking ?? {};
                rawNet.marking[place.id] = place.tokenCount;
            }
        }
    }

    /**
     * Populates transitions, labels, and layout data for transitions.
     */
    private _serializeTransitions(transitions: DiagramTransition[], rawNet: JsonPetriNet): void {
        for (const transition of transitions) {
            rawNet.transitions.push(transition.id);
            rawNet.layout = rawNet.layout ?? {};
            rawNet.layout[transition.id] = { x: transition.x, y: transition.y };

            if (transition.label !== transition.id) {
                rawNet.labels = rawNet.labels ?? {};
                rawNet.labels[transition.id] = transition.label;
            }
        }
    }

    /**
     * Populates arcs and layout data for arc bend points.
     */
    private _serializeArcs(arcs: DiagramArc[], rawNet: JsonPetriNet): void {
        if (arcs.length === 0) return;

        if (!rawNet.arcs) {
            rawNet.arcs = {};
        }

        for (const arc of arcs) {
            rawNet.arcs[arc.id] = arc.weight;

            if (arc.bendPoints && arc.bendPoints.length > 0) {
                rawNet.layout = rawNet.layout ?? {};
                rawNet.layout[arc.id] = arc.bendPoints;
            }
        }
    }
}
