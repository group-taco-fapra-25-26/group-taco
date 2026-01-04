import { Injectable } from '@angular/core';

import { Diagram } from '../classes/diagram/diagram';
import { DiagramNode } from '../classes/diagram/diagram-node';
import { DiagramArc } from '../classes/diagram/diagram-arc';
import { Coords, JsonPetriNet } from '../classes/json-petri-net';
import { DiagramPlace } from '../classes/diagram/diagram-place';
import { DiagramTransition } from '../classes/diagram/diagram-transition';
import { XMLParser } from 'fast-xml-parser';
import { Pnml, PnmlArc, PnmlNetContent, PnmlPlace, PnmlPtnet, PnmlTransition } from '../classes/pnml-petri-net';

@Injectable({
    providedIn: 'root',
})
export class ParserService {
    private readonly PNML_PTNET_TYPE = 'http://www.pnml.org/version-2009/grammar/ptnet';
    /**
     * Parses the given text into a Diagram object.
     * Supports PNML (XML format) and JSON format.
     * @param text
     *         the text representing the Petri net
     */
    parse(text: string): Diagram | undefined {
        const trimmedText = text.trim();
        if (trimmedText.startsWith('<')) {
            return this.parsePnml(trimmedText);
        } else if (trimmedText.startsWith('{')) {
            return this.parseJson(trimmedText);
        }
        console.error('Unknown file format');
        return undefined;
    }

    /**
     * Parses the given PNML text into a Diagram object.
     * @param text
     *         the PNML text representing the Petri net
     */
    parsePnml(text: string): Diagram | undefined {
        try {
            const alwaysArray = ['place', 'transition', 'arc'];
            const parser = new XMLParser({
                ignoreAttributes: false,
                isArray: (tagName) => alwaysArray.includes(tagName),
            });
            const pnmlObject = parser.parse(text) as Pnml;

            const net = pnmlObject.pnml?.net;
            let netContent: PnmlNetContent | undefined;
            if (net?.['@_type'] === this.PNML_PTNET_TYPE) {
                netContent = (net as PnmlPtnet).page;
            } else {
                netContent = net as PnmlNetContent;
            }

            const arcs: DiagramArc[] = this.parsePnmlArcs(netContent?.arc ?? []);
            const places: DiagramPlace[] = this.parsePnmlPlaces(netContent?.place ?? []);
            const transitions: DiagramTransition[] = this.parsePnmlTransitions(
                netContent?.transition ?? [],
                arcs,
                places,
            );

            return new Diagram(places, transitions, arcs);
        } catch (e) {
            console.error('Error while parsing PNML', e, text);
            return undefined;
        }
    }

    /**
     * Parses the given JSON text into a Diagram object.
     * @param text
     *         the JSON text representing the Petri net
     */
    parseJson(text: string): Diagram | undefined {
        try {
            const rawData = JSON.parse(text) as JsonPetriNet;

            const marking = rawData.marking || {};
            const labels = rawData.labels || {};
            const places = this.parsePlaces(rawData.places, marking, labels);
            const arcs = this.parseArcs(rawData.arcs, rawData.layout);
            const transitions = this.parseTransitions(rawData.transitions, labels, places, arcs);

            const allNodes = [...places, ...transitions];
            this.setPosition(allNodes, rawData.layout);

            return new Diagram(places, transitions, arcs);
        } catch (e) {
            console.error('Error while parsing JSON', e, text);
            return undefined;
        }
    }

    private parsePlaces(
        placeIds: string[] | undefined,
        marking: Record<string, number>,
        labels: Record<string, string>,
    ): DiagramPlace[] {
        if (!placeIds || !Array.isArray(placeIds)) {
            return [];
        }
        return placeIds.map((id) => {
            const initialTokens = marking[id] || 0;
            const label = labels[id] || id;
            return new DiagramPlace(id, initialTokens, label);
        });
    }

    private parseTransitions(
        transitionIds: string[] | undefined,
        labels: Record<string, string>,
        places: DiagramPlace[],
        arcs: DiagramArc[],
    ): DiagramTransition[] {
        if (!transitionIds || !Array.isArray(transitionIds)) {
            return [];
        }

        return transitionIds.map((id) => {
            const label = labels[id] || id;

            const { inputArcs, outputArcs, inputPlaces, outputPlaces } = this.findInAndOutput(arcs, id, places);

            return new DiagramTransition(id, label, inputPlaces, outputPlaces, inputArcs, outputArcs);
        });
    }

    private parseArcs(arcs: Record<string, number> | undefined, layout: JsonPetriNet['layout']): DiagramArc[] {
        if (!arcs) {
            return [];
        }
        const result: DiagramArc[] = [];
        for (const [arcId, weight] of Object.entries(arcs)) {
            const [source, target] = arcId.split(',');
            if (source && target) {
                const bendPoints = this.getBendPoints(arcId, layout);

                result.push(new DiagramArc(arcId, source, target, weight, bendPoints));
            }
        }
        return result;
    }

    private getBendPoints(arcId: string, layout: JsonPetriNet['layout']): Coords[] {
        if (!layout || !layout[arcId]) {
            return [];
        }

        const layoutData = layout[arcId];
        if (Array.isArray(layoutData)) {
            return layoutData;
        }

        return [];
    }

    private setPosition(elements: DiagramNode[], layout: JsonPetriNet['layout']) {
        if (layout === undefined) {
            return;
        }

        for (const el of elements) {
            const pos = layout[el.id] as Coords | undefined;
            if (pos !== undefined) {
                el.x = pos.x;
                el.y = pos.y;
            }
        }
    }

    private parsePnmlTransitions(transitions: PnmlTransition[], arcs: DiagramArc[], places: DiagramPlace[]) {
        return transitions.map((transition) => {
            const id = transition['@_id'];
            const label = transition.name?.text || id;

            const { inputArcs, outputArcs, inputPlaces, outputPlaces } = this.findInAndOutput(arcs, id, places);

            const diagramTransition = new DiagramTransition(
                id,
                label,
                inputPlaces,
                outputPlaces,
                inputArcs,
                outputArcs,
            );
            diagramTransition.x = Number(transition.graphics.position['@_x']);
            diagramTransition.y = Number(transition.graphics.position['@_y']);
            return diagramTransition;
        });
    }

    private findInAndOutput(arcs: DiagramArc[], id: string, places: DiagramPlace[]) {
        const inputArcs = arcs.filter((arc) => arc.target === id);
        const outputArcs = arcs.filter((arc) => arc.source === id);

        const inputPlaces = inputArcs
            .map((arc) => places.find((place) => place.id === arc.source))
            .filter((place): place is DiagramPlace => place !== undefined);
        const outputPlaces = outputArcs
            .map((arc) => places.find((place) => place.id === arc.target))
            .filter((place): place is DiagramPlace => place !== undefined);
        return { inputArcs, outputArcs, inputPlaces, outputPlaces };
    }

    private parsePnmlArcs(arcs: PnmlArc[]) {
        return arcs.map((arc) => {
            const id = arc['@_id'];
            const source = arc['@_source'];
            const target = arc['@_target'];
            const weight = arc.inscription && arc.inscription.text ? Number(arc.inscription.text) : 1;
            const position = arc.graphics.position;
            let bendPoints: Coords[] = [];
            if (position) {
                const positionArray = Array.isArray(position) ? position : [position];
                bendPoints = positionArray.map((pos) => {
                    return {
                        x: Number(pos['@_x']),
                        y: Number(pos['@_y']),
                    };
                });
            }
            return new DiagramArc(id, source, target, weight, bendPoints);
        });
    }

    private parsePnmlPlaces(places: PnmlPlace[]) {
        return places.map((place) => {
            const id = place['@_id'];
            const initialMarking = place.initialMarking ? Number(place.initialMarking.text) : 0;
            const label = place.name?.text || id;
            const diagramPlace = new DiagramPlace(id, initialMarking, label);
            diagramPlace.x = Number(place.graphics.position['@_x']);
            diagramPlace.y = Number(place.graphics.position['@_y']);
            return diagramPlace;
        });
    }
}
