// Service / utility for validating a drawn process net against the original Petri net
// Based on user-provided specification, with minor fixes (e.g., producer count increment).

export interface PetriNet {
    places: string[];
    transitions: string[];
    arcs: Record<string, number>; // key: "source,target" -> weight
    labels: Record<string, string>; // original transition id -> label (e.g. t1 -> A)
}

export interface ProcessElement {
    id: string;
    type: 'Place' | 'Transition';
    label: string; // places: original place id (e.g. p4), transitions: action label (e.g. A/B/C/...)
}

export interface ProcessConnection {
    from: string; // element id
    to: string; // element id
    weight: number; // arc weight in the process net (>= 1)
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateProcessNet(
    net: PetriNet,
    elements: ProcessElement[],
    connections: ProcessConnection[],
): ValidationResult {
    const errors: string[] = [];

    // --------- 1) Map Transition-Labels back to Petri-Net transitions ---------
    const mapLabelToTransition = (label: string): string | undefined =>
        Object.keys(net.labels).find((t) => net.labels[t] === label);

    // --------- 2) Original pre/post sets (by label) and weights ---------
    const origPre: Record<string, string[]> = {};
    const origPost: Record<string, string[]> = {};
    const origPreW: Record<string, Record<string, number>> = {}; // t -> place -> weight
    const origPostW: Record<string, Record<string, number>> = {}; // t -> place -> weight

    net.transitions.forEach((t) => {
        origPre[t] = [];
        origPost[t] = [];
        origPreW[t] = {};
        origPostW[t] = {};
    });

    Object.entries(net.arcs).forEach(([arc, weight]) => {
        const [from, to] = arc.split(',');
        if (net.places.includes(from) && net.transitions.includes(to)) {
            origPre[to].push(from);
            origPreW[to][from] = weight;
        } else if (net.transitions.includes(from) && net.places.includes(to)) {
            origPost[from].push(to);
            origPostW[from][to] = weight;
        }
    });

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

    const elementMap = new Map<string, ProcessElement>(elements.map((e) => [e.id, e]));

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

    // --------- 4) Structural compliance + weight checks ---------
    elements
        .filter((e) => e.type === 'Transition')
        .forEach((tOcc) => {
            const originalT = mapLabelToTransition(tOcc.label);
            if (!originalT) {
                errors.push(`❌ Transition ${tOcc.label} hat keine passende Beschriftung im Petrinetz.`);
                return;
            }

            const expectedPre = origPre[originalT].slice().sort();
            const actualPre = procPre[tOcc.id].slice().sort();
            if (JSON.stringify(expectedPre) !== JSON.stringify(actualPre)) {
                errors.push(
                    `❌ Vorbereich falsch bei ${tOcc.label}. Erwartet: ${expectedPre.join(',')} / Gefunden: ${actualPre.join(',')}`,
                );
            } else {
                // If structure matches, verify weights for each required place label
                expectedPre.forEach((pl) => {
                    const expW = origPreW[originalT][pl] ?? 1;
                    const actW = procPreW[tOcc.id][pl] ?? 0;
                    if (expW !== actW) {
                        errors.push(
                            `❌ Vorbereichsgewicht falsch bei ${tOcc.label} für Stelle ${pl}. Erwartet: ${expW} / Gefunden: ${actW}`,
                        );
                    }
                });
            }

            const expectedPost = origPost[originalT].slice().sort();
            const actualPost = procPost[tOcc.id].slice().sort();
            if (JSON.stringify(expectedPost) !== JSON.stringify(actualPost)) {
                errors.push(
                    `❌ Nachbereich falsch bei ${tOcc.label}. Erwartet: ${expectedPost.join(',')} / Gefunden: ${actualPost.join(',')}`,
                );
            } else {
                expectedPost.forEach((pl) => {
                    const expW = origPostW[originalT][pl] ?? 1;
                    const actW = procPostW[tOcc.id][pl] ?? 0;
                    if (expW !== actW) {
                        errors.push(
                            `❌ Nachbereichsgewicht falsch bei ${tOcc.label} für Stelle ${pl}. Erwartet: ${expW} / Gefunden: ${actW}`,
                        );
                    }
                });
            }
        });

    // --------- 5) Unique token origin (each place copy max 1 predecessor) ---------
    const producerCount: Record<string, number> = {};
    connections.forEach((c) => {
        const src = elementMap.get(c.from);
        const tgt = elementMap.get(c.to);
        if (src?.type === 'Transition' && tgt?.type === 'Place') {
            producerCount[tgt.id] = (producerCount[tgt.id] || 0) + 1;
        }
    });

    Object.entries(producerCount).forEach(([placeId, count]) => {
        if (count > 1) {
            errors.push(`❌ Stelle ${placeId} hat mehr als einen Produzenten – verletzt Kausalität.`);
        }
    });

    // --------- 6) Acyclicity ---------
    const graph: Record<string, string[]> = {};
    elements.forEach((el) => (graph[el.id] = []));
    connections.forEach((c) => graph[c.from].push(c.to));

    function hasCycle(): boolean {
        const visited = new Set<string>();
        const stack = new Set<string>();

        function visit(node: string): boolean {
            if (stack.has(node)) return true;
            if (visited.has(node)) return false;
            visited.add(node);
            stack.add(node);
            for (const nxt of graph[node]) {
                if (visit(nxt)) return true;
            }
            stack.delete(node);
            return false;
        }

        return Object.keys(graph).some(visit);
    }

    if (hasCycle()) {
        errors.push('❌ Prozessnetz enthält einen Zyklus – Prozessnetze müssen azyklisch sein.');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
