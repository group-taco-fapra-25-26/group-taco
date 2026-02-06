// Service / utility for validating a drawn process net against the original Petri net
// Based on user-provided specification, with minor fixes (e.g., producer count increment).

import { TranslationParams } from '../classes/toast';

export interface PetriNet {
    places: string[];
    transitions: string[];
    arcs: Record<string, number>; // key: "source,target" -> weight
    labels: Record<string, string>; // original transition id -> label (e.g. t1 -> A)
    marking?: Record<string, number>;
    startPlaces?: string[];
}

export interface ProcessElement {
    id: string;
    type: 'Place' | 'Transition';
    label: string; // places: original place id (e.g. p4), transitions: action label (e.g. A/B/C/...)
    isStartPlace?: boolean;
}

export interface ProcessConnection {
    from: string; // element id
    to: string; // element id
    weight: number; // arc weight in the process net (>= 1)
}

export interface ValidationMessage {
    key: string;
    params?: TranslationParams;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationMessage[];
    infos: ValidationMessage[];
}

interface OriginalNetShape {
    pre: Record<string, string[]>;
    post: Record<string, string[]>;
    preWeights: Record<string, Record<string, number>>;
    postWeights: Record<string, Record<string, number>>;
}

/**
 * Transforms the Petri net structure into a shape optimized for validation lookups.
 * Maps transitions to their preset and postset places and weights.
 *
 * @param net The Petri net to analyze.
 * @returns An object containing pre- / post-sets and weights for all transitions.
 */
function buildOriginalNetShape(net: PetriNet): OriginalNetShape {
    const shape: OriginalNetShape = {
        pre: {},
        post: {},
        preWeights: {},
        postWeights: {},
    };

    net.transitions.forEach((t) => {
        shape.pre[t] = [];
        shape.post[t] = [];
        shape.preWeights[t] = {};
        shape.postWeights[t] = {};
    });

    Object.entries(net.arcs).forEach(([arc, rawWeight]) => {
        const [from, to] = arc.split(',');
        const weight = rawWeight ?? 1;
        if (net.places.includes(from) && net.transitions.includes(to)) {
            shape.pre[to].push(from);
            shape.preWeights[to][from] = weight;
        } else if (net.transitions.includes(from) && net.places.includes(to)) {
            shape.post[from].push(to);
            shape.postWeights[from][to] = weight;
        }
    });

    return shape;
}

/**
 * Validates a process net against an underlying Petri net.
 * Checks structure consistency, causal constraints, and dynamic properties like maximality.
 *
 * @param net The original Petri net.
 * @param elements The nodes (conditions and events) of the process net.
 * @param connections The causal dependencies (arcs) between elements.
 * @returns A result object containing validation status, errors, and warnings.
 */
export function validateProcessNet(
    net: PetriNet,
    elements: ProcessElement[],
    connections: ProcessConnection[],
): ValidationResult {
    const errors: ValidationMessage[] = [];
    const infos: ValidationMessage[] = [];

    const elementMap = new Map<string, ProcessElement>(elements.map((e) => [e.id, e]));
    const placeLabelById = new Map<string, string>();
    const transitionLabelById = new Map<string, string>();
    elements.forEach((el) => {
        if (el.type === 'Place') {
            placeLabelById.set(el.id, el.label);
        } else {
            transitionLabelById.set(el.id, el.label);
        }
    });

    const connectionsByTarget: Record<string, ProcessConnection[]> = {};
    const connectionsBySource: Record<string, ProcessConnection[]> = {};
    connections.forEach((conn) => {
        (connectionsBySource[conn.from] ||= []).push(conn);
        (connectionsByTarget[conn.to] ||= []).push(conn);
    });

    const originalNetShape = buildOriginalNetShape(net);

    // It enforces exact equality between each drawn transition’s preset/postset (including arc weights) and the corresponding transition in the original Petri net.
    const errorsFromStructure = validateTransitionsForStructure(
        net,
        elements,
        connections,
        elementMap,
        originalNetShape,
    );
    errors.push(...errorsFromStructure);

    // It ensures every non-start place actually has an incoming producer; otherwise isolated conditions could appear even though the start-marking logic says they should not.
    const errorsFromPlaces = validatePlaceInputs(net, elements, connectionsByTarget);
    errors.push(...errorsFromPlaces);

    // Checks if each place has at most one producing transition, which is essential for causal semantics of process nets.
    const errorsFromProducerLimit = validateProducerUniqueness(elements, connections, elementMap);
    errors.push(...errorsFromProducerLimit);

    // Checks if each place has at most one consuming transition, to ensure no forward conflict.
    const errorsFromConsumerLimit = validateConsumerUniqueness(elements, connections, elementMap);
    errors.push(...errorsFromConsumerLimit);

    // It is the sole check that every place with tokens in the initial marking is actually drawn and explicitly marked as a start place.
    const errorsFromStartPlaces = validateStartPlacesPresence(net, elements);
    errors.push(...errorsFromStartPlaces);

    // It verifies that the drawn net is acyclic, as process nets should not contain cycles.
    const errorsFromCycles = validateAcyclicity(elements, connections);
    errors.push(...errorsFromCycles);

    // It checks whether the drawn net is maximal, i.e., no further transitions from the original net can be fired given the terminal places in the drawn net.
    const errorsFromMaximality = validateMaximality(net, elements, connectionsBySource, originalNetShape);
    infos.push(...errorsFromMaximality);

    return {
        valid: errors.length === 0,
        errors,
        infos,
    };
}

/**
 * Verifies that each event (transition occurrence) in the process net has presets and postsets
 * matching the structure of the corresponding transition in the original Petri net.
 * Includes checks for correct arc weights.
 *
 * @param net The original Petri net.
 * @param elements Process net elements.
 * @param connections Process net arcs.
 * @param elementMap Fast lookup map for process net elements by ID.
 * @param originalShape Pre-calculated structure of the original Petri net.
 * @returns Array of validation errors if structural mismatches are found.
 */
function validateTransitionsForStructure(
    net: PetriNet,
    elements: ProcessElement[],
    connections: ProcessConnection[],
    elementMap: Map<string, ProcessElement>,
    originalShape: OriginalNetShape,
): ValidationMessage[] {
    const errors: ValidationMessage[] = [];

    const mapLabelToTransition = (label: string): string | undefined =>
        Object.keys(net.labels).find((t) => net.labels[t] === label);

    const { pre: origPre, post: origPost, preWeights: origPreW, postWeights: origPostW } = originalShape;

    // --------- 3) Process net pre/post sets (by label) and weights ---------
    const procPre: Record<string, string[]> = {};
    const procPost: Record<string, string[]> = {};
    const procPreW: Record<string, Record<string, number>> = {}; // tOcc -> placeLabel -> sum weight
    const procPostW: Record<string, Record<string, number>> = {}; // tOcc -> placeLabel -> sum weight

    elements
        .filter((e) => e.type === 'Transition')
        .forEach((t) => {
            procPre[t.id] = [];
            procPost[t.id] = [];
            procPreW[t.id] = {};
            procPostW[t.id] = {};
        });

    connections.forEach((c) => {
        const src = elementMap.get(c.from);
        const tgt = elementMap.get(c.to);
        if (!src || !tgt) return;

        if (src.type === 'Place' && tgt.type === 'Transition') {
            // store original place label (already the original id)
            procPre[tgt.id].push(src.label);
            procPreW[tgt.id][src.label] = (procPreW[tgt.id][src.label] || 0) + (c.weight || 1);
        }
        if (src.type === 'Transition' && tgt.type === 'Place') {
            procPost[src.id].push(tgt.label);
            procPostW[src.id][tgt.label] = (procPostW[src.id][tgt.label] || 0) + (c.weight || 1);
        }
    });

    elements
        .filter((e) => e.type === 'Transition')
        .forEach((tOcc) => {
            const originalT = mapLabelToTransition(tOcc.label);
            if (!originalT) {
                errors.push({
                    key: 'TOASTER.VALIDATION_MESSAGES.TRANSITION_NO_MATCH',
                    params: { label: tOcc.label },
                });
                return;
            }

            const normalize = (values: string[]) => {
                const normalized = Array.from(new Set(values)).sort();
                return normalized.length > 0 ? normalized : ['∅'];
            };

            const expectedPre = origPre[originalT];
            const actualPre = procPre[tOcc.id];
            const expectedPreSet = normalize(expectedPre);
            const actualPreSet = normalize(actualPre);
            if (JSON.stringify(expectedPreSet) !== JSON.stringify(actualPreSet)) {
                errors.push({
                    key: 'TOASTER.VALIDATION_MESSAGES.PRESET_MISMATCH',
                    params: {
                        label: tOcc.label,
                        expected: expectedPreSet.join(','),
                        found: actualPreSet.join(','),
                    },
                });
            } else {
                // If structure matches, verify weights for each required place label
                expectedPreSet
                    .filter((pl) => pl !== '∅')
                    .forEach((pl) => {
                        const expW = origPreW[originalT][pl] ?? 1;
                        const actW = procPreW[tOcc.id][pl] ?? 0;
                        if (expW !== actW) {
                            errors.push({
                                key: 'TOASTER.VALIDATION_MESSAGES.PRESET_WEIGHT_MISMATCH',
                                params: {
                                    label: tOcc.label,
                                    place: pl,
                                    expected: expW,
                                    found: actW,
                                },
                            });
                        }
                    });
            }

            const expectedPost = origPost[originalT];
            const actualPost = procPost[tOcc.id];
            const expectedPostSet = normalize(expectedPost);
            const actualPostSet = normalize(actualPost);
            if (JSON.stringify(expectedPostSet) !== JSON.stringify(actualPostSet)) {
                errors.push({
                    key: 'TOASTER.VALIDATION_MESSAGES.POSTSET_MISMATCH',
                    params: {
                        label: tOcc.label,
                        expected: expectedPostSet.join(','),
                        found: actualPostSet.join(','),
                    },
                });
            } else {
                expectedPostSet
                    .filter((pl) => pl !== '∅')
                    .forEach((pl) => {
                        const expW = origPostW[originalT][pl] ?? 1;
                        const actW = procPostW[tOcc.id][pl] ?? 0;
                        if (expW !== actW) {
                            errors.push({
                                key: 'TOASTER.VALIDATION_MESSAGES.POSTSET_WEIGHT_MISMATCH',
                                params: {
                                    label: tOcc.label,
                                    place: pl,
                                    expected: expW,
                                    found: actW,
                                },
                            });
                        }
                    });
            }
        });

    return errors;
}

/**
 * Ensures that every condition (place) in the process net has an incoming causal connection,
 * unless it is explicitly designated as a start place (initial token).
 *
 * @param net The original Petri net (unused).
 * @param elements Process net elements.
 * @param connectionsByTarget Index of connections by their target ID.
 * @returns Array of errors for isolated places.
 */
function validatePlaceInputs(
    net: PetriNet,
    elements: ProcessElement[],
    connectionsByTarget: Record<string, ProcessConnection[]>,
): ValidationMessage[] {
    const errors: ValidationMessage[] = [];

    elements
        .filter((el) => el.type === 'Place')
        .forEach((place) => {
            const isStartNode = place.isStartPlace ?? false;
            const incoming = connectionsByTarget[place.id] || [];
            if (!isStartNode && incoming.length === 0) {
                errors.push({
                    key: 'TOASTER.VALIDATION_MESSAGES.PLACE_NO_INCOMING',
                    params: { label: place.label },
                });
            }
        });

    return errors;
}

/**
 * Checks the branching property of process nets: every condition must be produced by at most one event.
 * This ensures no backward conflict (places have at most one incoming arc).
 *
 * @param elements Process net elements.
 * @param connections Process net arcs.
 * @param elementMap Map for looking up element types.
 * @returns Array of errors for places with multiple producers.
 */
function validateProducerUniqueness(
    elements: ProcessElement[],
    connections: ProcessConnection[],
    elementMap: Map<string, ProcessElement>,
): ValidationMessage[] {
    const errors: ValidationMessage[] = [];
    const producerCount: Record<string, number> = {};
    connections.forEach((conn) => {
        const src = elementMap.get(conn.from);
        const tgt = elementMap.get(conn.to);
        if (src?.type === 'Transition' && tgt?.type === 'Place') {
            producerCount[tgt.id] = (producerCount[tgt.id] || 0) + 1;
        }
    });

    Object.entries(producerCount).forEach(([placeId, count]) => {
        if (count > 1) {
            const place = elementMap.get(placeId);
            const label = place ? place.label : placeId;
            errors.push({
                key: 'TOASTER.VALIDATION_MESSAGES.PLACE_MULTIPLE_PRODUCERS',
                params: { place: label },
            });
        }
    });
    return errors;
}

/**
 * Checks the branching property of process nets: every condition must be consumed by at most one event.
 * This ensures no forward conflict (places have at most one outgoing arc).
 *
 * @param elements Process net elements.
 * @param connections Process net arcs.
 * @param elementMap Map for looking up element types.
 * @returns Array of errors for places with multiple consumers.
 */
function validateConsumerUniqueness(
    elements: ProcessElement[],
    connections: ProcessConnection[],
    elementMap: Map<string, ProcessElement>,
): ValidationMessage[] {
    const errors: ValidationMessage[] = [];
    const consumerCount: Record<string, number> = {};
    connections.forEach((conn) => {
        const src = elementMap.get(conn.from);
        const tgt = elementMap.get(conn.to);
        if (src?.type === 'Place' && tgt?.type === 'Transition') {
            consumerCount[src.id] = (consumerCount[src.id] || 0) + 1;
        }
    });

    Object.entries(consumerCount).forEach(([placeId, count]) => {
        if (count > 1) {
            const place = elementMap.get(placeId);
            const label = place ? place.label : placeId;
            errors.push({
                key: 'TOASTER.VALIDATION_MESSAGES.PLACE_MULTIPLE_CONSUMERS',
                params: { place: label },
            });
        }
    });
    return errors;
}

/**
 * Validates that the process net graph contains no cycles.
 * A fundamental property of process nets is that they are acyclic directed graphs.
 *
 * @param elements Process net elements.
 * @param connections Process net arcs.
 * @returns Array containing an error if a cycle is detected.
 */
function validateAcyclicity(elements: ProcessElement[], connections: ProcessConnection[]): ValidationMessage[] {
    const errors: ValidationMessage[] = [];
    const graph: Record<string, string[]> = {};
    elements.forEach((el) => (graph[el.id] = []));
    connections.forEach((c) => graph[c.from].push(c.to));

    const visited = new Set<string>();
    const stack = new Set<string>();

    const visit = (node: string): boolean => {
        if (stack.has(node)) return true;
        if (visited.has(node)) return false;
        visited.add(node);
        stack.add(node);
        for (const nxt of graph[node]) {
            if (visit(nxt)) return true;
        }
        stack.delete(node);
        return false;
    };

    if (Object.keys(graph).some((node) => visit(node))) {
        errors.push({
            key: 'TOASTER.VALIDATION_MESSAGES.CYCLE_DETECTED',
        });
    }

    return errors;
}

/**
 * Checks if the start places in the process net correspond exactly to the initial marking
 * of the original Petri net.
 *
 * @param net The original Petri net with initial marking.
 * @param elements Process net elements.
 * @returns Array of errors if start places are missing or incorrect.
 */
function validateStartPlacesPresence(net: PetriNet, elements: ProcessElement[]): ValidationMessage[] {
    const errors: ValidationMessage[] = [];
    const requiredStartPlaces = new Set(
        Object.entries(net.marking ?? {})
            .filter(([, tokens]) => (tokens ?? 0) > 0)
            .map(([placeId]) => placeId),
    );
    if (requiredStartPlaces.size === 0) {
        return errors;
    }

    const providedStartPlaces = new Set(net.startPlaces ?? []);
    const missingProvided = [...requiredStartPlaces].filter((placeId) => !providedStartPlaces.has(placeId));
    if (missingProvided.length > 0) {
        errors.push({
            key: 'TOASTER.VALIDATION_MESSAGES.MISSING_START_PLACES',
            params: { places: missingProvided.join(', ') },
        });
    }

    const drawnPlaceLabels = new Set(elements.filter((el) => el.type === 'Place').map((el) => el.label));
    const missingDrawn = [...requiredStartPlaces].filter((placeId) => !drawnPlaceLabels.has(placeId));
    if (missingDrawn.length > 0) {
        errors.push({
            key: 'TOASTER.VALIDATION_MESSAGES.MARKED_START_PLACES_NOT_IN_NET',
            params: { places: missingDrawn.join(', ') },
        });
    }

    return errors;
}

/**
 * Checks if the process net represents a maximal run.
 * A run is maximal if no further transition event can occur from the current cut (set of terminal places).
 * This produces informational warnings rather than validation errors.
 *
 * @param net The original Petri net.
 * @param elements Process net elements.
 * @param connectionsBySource Index of connections by their source ID.
 * @param originalShape Pre-calculated structure of the original Petri net.
 * @returns Array of informational messages about enabled transitions that were not fired.
 */
function validateMaximality(
    net: PetriNet,
    elements: ProcessElement[],
    connectionsBySource: Record<string, ProcessConnection[]>,
    originalShape: OriginalNetShape,
): ValidationMessage[] {
    const infos: ValidationMessage[] = [];

    const terminalPlaces = elements.filter(
        (el) => el.type === 'Place' && (connectionsBySource[el.id] ?? []).length === 0,
    );
    if (terminalPlaces.length === 0) {
        return infos;
    }

    const terminalLabelCounts: Record<string, number> = {};
    terminalPlaces.forEach((place) => {
        terminalLabelCounts[place.label] = (terminalLabelCounts[place.label] || 0) + 1;
    });

    net.transitions.forEach((transitionId) => {
        const requiredPlaces = originalShape.pre[transitionId] || [];
        if (requiredPlaces.length === 0) {
            return;
        }

        const allPlacesSatisfied = requiredPlaces.every((placeId) => {
            const needed = originalShape.preWeights[transitionId][placeId] ?? 1;
            return (terminalLabelCounts[placeId] ?? 0) >= needed;
        });

        if (allPlacesSatisfied) {
            const transitionLabel = net.labels[transitionId] ?? transitionId;
            infos.push({
                key: 'TOASTER.VALIDATION_MESSAGES.NOT_MAXIMAL',
                params: {
                    label: transitionLabel,
                    places: requiredPlaces.join(', '),
                },
            });
        }
    });

    return infos;
}
