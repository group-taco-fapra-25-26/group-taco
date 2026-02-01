import { inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { FiringEdge, ReachabilityGraph, StateNode } from './classes/reachability-graph.model';
import { ModeService } from './services/mode.service';
import { SourcePetriNetService } from './services/source-petri-net.service';
import { Diagram } from './classes/diagram/diagram';
import { DiagramTransition } from './classes/diagram/diagram-transition';
import { DiagramPlace } from './classes/diagram/diagram-place';
import { ToasterNotificationService } from './services/toaster-notification.service';
import { Tab } from './classes/tabs';
import { PanningService } from './services/panning.service';
import { ToastList } from './classes/toast';

@Injectable({
    providedIn: 'root',
})
export class ReachabilityGraphService {
    private _reachabilityGraph: WritableSignal<ReachabilityGraph> = signal(new ReachabilityGraph());
    private _completeReachabilityGraph: ReachabilityGraph = new ReachabilityGraph();
    private _modeService: ModeService = inject(ModeService);
    private _sourceNetService = inject(SourcePetriNetService);
    private _startMarkingRG: Record<string, number> = {};
    private _currentMarkingRG = signal<Record<string, number>>(this._startMarkingRG);
    private _lastProcessedDiagram: Diagram | null = null;
    private _cachedCompleteGraphDiagram: Diagram | null = null;
    private _notificationService = inject(ToasterNotificationService);
    private _panningService = inject(PanningService);
    private checkedStateNode: StateNode | undefined;

    private currentSourceRgId = 'RG1';

    set startMarkingRG(marking: Record<string, number>) {
        this._startMarkingRG = marking;
    }

    set currentMarkingRG(marking: Record<string, number>) {
        this._currentMarkingRG.set(marking);
    }

    get reachabilityGraphSignal(): Signal<ReachabilityGraph> {
        return this._reachabilityGraph.asReadonly();
    }

    /**
     * Method to initialize first StateNode of Reachability Graph
     * Extracts marking from reachability-graph-display
     * beim Initialisieren direkt den ersten Knoten anlegen
     *
     */
    initializeReachabilityGraphFirstStateNode() {
        const currentNet = this._sourceNetService.getCurrentSourceNet();
        if (!currentNet) {
            this._reachabilityGraph.set(new ReachabilityGraph());
            this._lastProcessedDiagram = null;
            return;
        }

        if (this._lastProcessedDiagram === currentNet) {
            return;
        }

        this._lastProcessedDiagram = currentNet;

        if (!this._modeService.isExamMode(Tab.REACHABILITY_GRAPH)) {
            //AUTOMATISCH StateNode erzeugen
            //Current marking auslesen
            this._startMarkingRG = currentNet.startMarking || {};
            const initialReachabilityLabel: string = Object.values(this._startMarkingRG).join(' ');
            //x und y Startwert konstant festlegen
            const initialX = 300;
            const initialY = 50;
            //neuen StateNode erzeugen
            const initialId = 'RG1';
            this.currentSourceRgId = initialId;

            const initialStateNode = new StateNode(
                initialId,
                initialX,
                initialY,
                initialReachabilityLabel,
                this._startMarkingRG,
            );
            initialStateNode.isStartingState = true;

            //TO-DO Startmarkierung hervorheben, eingehender Arc aus dem Ursprung
            // const initialEdge = new FiringEdge('Initial', 'Initial', initialId, 'Initial','Initial');

            const newGraph = new ReachabilityGraph();
            newGraph.nodes = [initialStateNode];
            newGraph.edges = [];
            this._reachabilityGraph.set(newGraph);

            console.log('initialReachabilityLabel' + initialReachabilityLabel);
        } else if (this._modeService.isExamMode(Tab.REACHABILITY_GRAPH)) {
            //nur im Hintergrund vergleichen, User gibt NodeLabel, also Marking, selbst ein und bekommt Feedback
        }
    }

    /**
     * Gets firing entry from play service
     * Converts marking to RG ID (only displays token numbers sorted ascending by place id (alphanumerical))
     *
     * @param diagram The current diagram.
     * @param label The label of the fired transition.
     */
    convertFiringEntryLabelToReachabilityGraphID(diagram: Diagram, label: string) {
        let markingExists = false;
        let connectionExists = false;

        const currentReachabilityLabel: string = Object.entries(diagram.marking)
            .map(([, value]) => `${value}`)
            .join(' ');

        const graph = this._reachabilityGraph();
        const nextNodeIndex = graph.nodes.length + 1;
        let currentRgId = 'RG' + nextNodeIndex;
        const nextEdgeIndex = graph.edges.length + 1;
        const currentRgEdgeId = 'Edge' + nextEdgeIndex;
        let compareSourceStateNode: StateNode;
        let compareTargetStateNode: StateNode;

        //prüfen, ob aktuelle Zielmarkierung bereits vorhanden
        for (const nodeElement of graph.nodes) {
            const existingNodeLabel: string = nodeElement.label;

            if (existingNodeLabel === currentReachabilityLabel) {
                markingExists = true;
                currentRgId = nodeElement.id;
                compareTargetStateNode = nodeElement;

                // Vorhandensein der Verbindung prüfen, wenn Markierung bereits existiert;
                // so wird sichergestellt, dass eine Markierung, die von einer anderen Transiion
                // erzeugt wurde, ebenfalls verbunden bzw. eingefügt wird
                //displayLabel, source und target der Verbindungen vergleichen, um Gleichheit eindeutig zu prüfen
                for (const edgeElement of graph.edges) {
                    const existingArcDisplayLabel: string = edgeElement.displayLabel;
                    const existingArcSource: string = edgeElement.source;
                    const existingArcTarget: string = edgeElement.target;

                    if (
                        existingArcDisplayLabel === label &&
                        existingArcSource === this.currentSourceRgId &&
                        existingArcTarget === currentRgId
                    ) {
                        connectionExists = true;
                    }
                }
            }
        }

        if (!markingExists && !connectionExists) {
            // neuer Knoten und neue Kante

            const viewBox = this._panningService.viewBox();
            const width = Math.max(viewBox.width, 400);
            const height = Math.max(viewBox.height, 300);
            const startX = viewBox.minX;
            const startY = viewBox.minY;

            //x und y konstant festlegen
            const currentX: number = startX + Math.random() * width;
            const currentY: number = startY + Math.random() * height;

            //neuen StateNode erzeugen
            const previousNode = graph.nodes.find((node) => node.id === this.currentSourceRgId);
            const firingPath = previousNode && previousNode.firingPath ? previousNode.firingPath + ' ' + label : label;
            const currentStateNode = new StateNode(
                currentRgId,
                currentX,
                currentY,
                currentReachabilityLabel,
                { ...diagram.marking } as Record<string, number>,
                firingPath,
            );

            const currentFiringEdge = new FiringEdge(
                currentRgEdgeId,
                this.currentSourceRgId,
                currentRgId,
                label,
                firingPath,
            );

            this._reachabilityGraph.update((graph) => {
                const newGraph = new ReachabilityGraph();
                newGraph.nodes = [...graph.nodes, currentStateNode];
                newGraph.edges = [...graph.edges, currentFiringEdge];
                return newGraph;
            });

            //add predecessors and successors to StateNodes
            for (const graphNodeElement of graph.nodes) {
                compareSourceStateNode = graphNodeElement;

                if (compareSourceStateNode.id === this.currentSourceRgId) {
                    currentStateNode.predecessors.push(compareSourceStateNode);
                    compareSourceStateNode.successors.push(currentStateNode);
                }
            }
            //check for infinity after addition of each new StateNode
            this.checkForInfinity(currentStateNode);
            if (this._reachabilityGraph().isUnlimited) {
                this._notificationService.showInfo(
                    'TOASTER.HEADER.PETRI_NET_UNLIMITED',
                    'TOASTER.BODY.PETRI_NET_UNLIMITED',
                );
            }
        }

        if (markingExists && !connectionExists) {
            // neue Kante zu vorhandenem Markierungsknoten
            const previousNode = graph.nodes.find((node) => node.id === this.currentSourceRgId);
            const firingPath = previousNode && previousNode.firingPath ? previousNode.firingPath + ' ' + label : label;
            const currentFiringEdge = new FiringEdge(
                currentRgEdgeId,
                this.currentSourceRgId,
                currentRgId,
                label,
                firingPath,
            );

            this._reachabilityGraph.update((graph) => {
                const newGraph = new ReachabilityGraph();
                newGraph.nodes = [...graph.nodes];
                newGraph.edges = [...graph.edges, currentFiringEdge];
                return newGraph;
            });

            //add predecessors and successors to StateNodes
            for (const nodeElementIterator of graph.nodes) {
                compareSourceStateNode = nodeElementIterator;

                //TO-DO check for better way than ! or check that value can never be unassigned
                if (compareSourceStateNode.id === this.currentSourceRgId) {
                    compareTargetStateNode!.predecessors.push(compareSourceStateNode);
                    compareSourceStateNode.successors.push(compareTargetStateNode!);
                }
            }

            this._notificationService.showInfo('TOASTER.HEADER.STATENODE_EXISTING', 'TOASTER.BODY.STATENODE_EXISTING');
        }

        if (markingExists && connectionExists) {
            // State wechseln, damit Hinzufügen beim nächsten Aufruf der Methode an der richtigen Stelle passiert
            //wird nach Durchlaufen aller if-Schleifen getriggert
            this._notificationService.showInfo(
                'TOASTER.HEADER.STATENODE_ARC_EXISTING',
                'TOASTER.BODY.STATENODE_ARC_EXISTING',
            );
        }

        //change target to new source for arcs
        this.currentSourceRgId = currentRgId;

        console.log(currentReachabilityLabel);
        //nur 3 Fälle, !markingExists && connectionExists kann nicht auftreten
    }

    /**
     * Changes state of the PetriNet to the State of a ReachabilityGraph StateNode, meaning the marking is adjusted.
     * Triggered by clicking a StateNode in the RG.
     * Uses the "saved" Marking of the reachability graph model where each StateNode saves it's corresponding marking.
     * @param node The clicked StateNode
     */
    switchPnStateToClickedState(node: StateNode) {
        console.log('ChangeStateMethod started.');
        console.log('StateNode ID' + node.id);
        console.log('Label' + node.label);
        console.log('Marking' + node.rGMarking);

        if (!this._sourceNetService.getCurrentSourceNet()) {
            this._notificationService.showError('TOASTER.HEADER.READ_ERROR', 'TOASTER.BODY.LOAD_NET_FIRST');
            return;
        } else {
            const oldPetriNet: Diagram | null = this._sourceNetService.getCurrentSourceNet();
            if (!oldPetriNet) {
                return;
            }

            console.log(
                'Old PN nodes:  ' + oldPetriNet.allNodes + '      ' + 'marking  ' + oldPetriNet.currentMarking$,
            );
            oldPetriNet.marking = node.rGMarking;
            //change state of net
            this.currentSourceRgId = node.id;

            oldPetriNet.updateMarking();
            this._sourceNetService.updateEditedNet(oldPetriNet, { triggeredByFiring: false });
            this._notificationService.showSuccess('TOASTER.HEADER.SUCCESS', 'TOASTER.BODY.SWITCHED_STATE_SUCCESSFULLY');
        }
    }

    /**
     * Method to check for infinity of Reachability Graph.
     * Triggered after each firing of a transition in the Petri Net.
     * Goes backward from newly added StateNode and checks if there is a Combination of StateNodes which has indefinite growth
     * Uses recursive method as well as comparison method for markings
     * checkForInfinity initializes the recursion
     */
    checkForInfinity(node: StateNode, graph?: ReachabilityGraph) {
        const targetGraph = graph ?? this._reachabilityGraph();
        console.log('CheckForInfinity');
        for (const rgStateNode of targetGraph.nodes) {
            rgStateNode.nodeVisitedStateForLimitCheck = false;
        }

        for (const rgEdge of targetGraph.edges) {
            rgEdge.isPartOfUnlimitedPath = false;
        }

        this.checkedStateNode = node;
        this.recursiveCheckForInfinity(node, targetGraph);
    }

    /**
     * Helper method for recursive check of method checkForInfinity
     */
    recursiveCheckForInfinity(node: StateNode, graph: ReachabilityGraph) {
        console.log('Recursive CheckforInfinity');
        node.nodeVisitedStateForLimitCheck = true;
        let areTokensGettingBigger = false;
        if (this.checkedStateNode) {
            console.log('Reec CheckForInfinity - If this.CheckedStateNode');
            for (const checkPredecessor of node.predecessors) {
                if (!checkPredecessor.nodeVisitedStateForLimitCheck) {
                    console.log('Rec CheckForInfinity - !checkPredecessor.nodeVisitedStateForLimitCheck');
                    areTokensGettingBigger = this.compareTwoMarkings(
                        this.checkedStateNode.rGMarking,
                        checkPredecessor.rGMarking,
                    );
                    console.log('Are tokens getting bigger - ' + areTokensGettingBigger);
                    console.log('this.checkedStateNode.tokenSum ' + this.checkedStateNode.tokenSum);
                    console.log('checkPredecessor.tokenSum' + checkPredecessor.tokenSum);

                    if (
                        this.checkedStateNode.tokenSum > checkPredecessor.tokenSum &&
                        areTokensGettingBigger &&
                        !graph.isUnlimited
                    ) {
                        console.log('Unbeschränkt');
                        graph.isUnlimited = true;
                        checkPredecessor.isMorMStrich = true;
                        //TODO unbeschraenkteMarkierungM = direkterVorgaengerMarkierung;
                        this.checkedStateNode.isMorMStrich = true;
                        //TODO unbeschraenkteMarkierungMStrich = egUnbeschraenktheitsPruefMarkierung;
                        if (checkPredecessor.isStartingState) {
                            graph.breakLoop = true;
                            return;
                        }
                        return;
                    } else {
                        if (checkPredecessor.isStartingState) {
                            this._reachabilityGraph().breakLoop = true;
                            return;
                        }
                        this.recursiveCheckForInfinity(checkPredecessor, graph);
                    }
                }
            }
        }
    }

    /**
     * Compares Marking of StateNode with Marking of previous StateNode to check for "real growth".
     * Returns "true" when current marking "bigger" than previous marking on same path.
     * Needed for InfinityCheck.
     * @param currentlyVisitedMarking
     * @param previouslyVisitedMarking
     */
    compareTwoMarkings(
        currentlyVisitedMarking: Record<string, number>,
        previouslyVisitedMarking: Record<string, number>,
    ): boolean {
        let currentMarkingHigher = true;

        const currentPlaceMarking = Object.values(currentlyVisitedMarking);
        const previousPlaceMarking = Object.values(previouslyVisitedMarking);

        for (let i = 0; i < currentPlaceMarking.length; i++) {
            if (previousPlaceMarking[i] > currentPlaceMarking[i]) currentMarkingHigher = false;
        }

        return currentMarkingHigher;
    }

    /**
     * Calculates the complete Reachability Graph for the current source Petri net.
     * Follows Algorithm 2.2.4 (Calculation of the Reachability Graph).
     * Stops if the graph becomes too large or unlimited.
     *
     * @returns The calculated Reachability Graph.
     */
    calculateCompleteReachabilityGraph(): ReachabilityGraph {
        const diagram = this._sourceNetService.getCurrentSourceNet();
        if (!diagram) {
            return new ReachabilityGraph();
        }

        if (this._cachedCompleteGraphDiagram === diagram) {
            return this._completeReachabilityGraph;
        }

        const { graph, Q, processedNodeIds, nodeByLabel, counters } = this.initializeGraphCalculation(diagram);

        while (Q.length > 0) {
            if (this.shouldStopCalculation(graph)) {
                break;
            }

            const m = Q.shift()!;

            // Q <- Q \ M is implicitly handled here by skipping if already processed
            if (processedNodeIds.has(m.id)) {
                continue;
            }

            const enabledTransitions = this.getEnabledTransitions(diagram, m.rGMarking);

            //FOR EACH t ∈ T DO && IF m --[t]--> m' THEN
            for (const transition of enabledTransitions) {
                const nextMarking = this.computeNextMarking(m.rGMarking, transition);
                const m_prime = this.getOrCreateNextNode(graph, nodeByLabel, diagram.places, nextMarking, counters);

                // Q <- Q U {m'}
                if (!Q.includes(m_prime)) {
                    Q.push(m_prime);
                }

                this.processEdge(graph, m, m_prime, transition, counters);

                if (graph.isUnlimited) break;
            }

            if (graph.isUnlimited) {
                break;
            }

            // M <- M U {m}
            processedNodeIds.add(m.id);
        }

        this._cachedCompleteGraphDiagram = diagram;
        this._completeReachabilityGraph = graph;
        return graph;
    }

    private initializeGraphCalculation(diagram: Diagram) {
        const graph = new ReachabilityGraph();
        const startMarking = diagram.startMarking;
        const places = diagram.places;
        const startLabel = places.map((p) => startMarking[p.id] ?? 0).join(' ');

        const startNode = new StateNode('RG1', 300, 50, startLabel, startMarking);
        startNode.isStartingState = true;

        graph.nodes.push(startNode);

        return {
            graph,
            Q: [startNode],
            processedNodeIds: new Set<string>(),
            nodeByLabel: new Map<string, StateNode>([[startLabel, startNode]]),
            counters: { nodeId: 1, edgeId: 0 },
        };
    }

    private shouldStopCalculation(graph: ReachabilityGraph): boolean {
        if (graph.nodes.length > 2000) {
            graph.isUnlimited = true;
            return true;
        }
        return graph.isUnlimited || graph.breakLoop;
    }

    private getEnabledTransitions(diagram: Diagram, marking: Record<string, number>): DiagramTransition[] {
        return diagram.transitions.filter((t) => {
            return t.getInputFlow().every((flow) => {
                const tokens = marking[flow.place.id] || 0;
                return tokens >= flow.weight;
            });
        });
    }

    private computeNextMarking(
        currentMarking: Record<string, number>,
        transition: DiagramTransition,
    ): Record<string, number> {
        const nextMarking = { ...currentMarking };
        transition.getInputFlow().forEach((flow) => {
            const currentTokens = nextMarking[flow.place.id] ?? 0;
            nextMarking[flow.place.id] = currentTokens - flow.weight;
        });
        transition.getOutputFlow().forEach((flow) => {
            nextMarking[flow.place.id] = (nextMarking[flow.place.id] || 0) + flow.weight;
        });
        return nextMarking;
    }

    private getOrCreateNextNode(
        graph: ReachabilityGraph,
        nodeByLabel: Map<string, StateNode>,
        places: DiagramPlace[],
        nextMarking: Record<string, number>,
        counters: { nodeId: number },
    ): StateNode {
        const nextLabel = places.map((p) => nextMarking[p.id] ?? 0).join(' ');
        let m_prime = nodeByLabel.get(nextLabel);

        if (!m_prime) {
            counters.nodeId++;
            m_prime = new StateNode(`RG${counters.nodeId}`, 300, 50, nextLabel, nextMarking);
            graph.nodes.push(m_prime);
            nodeByLabel.set(nextLabel, m_prime);
        }
        return m_prime;
    }

    private processEdge(
        graph: ReachabilityGraph,
        source: StateNode,
        target: StateNode,
        transition: DiagramTransition,
        counters: { edgeId: number },
    ): void {
        const edgeExists = graph.edges.some(
            (e) => e.source === source.id && e.target === target.id && e.displayLabel === transition.label,
        );

        if (!edgeExists) {
            counters.edgeId++;
            const edge = new FiringEdge(`Edge${counters.edgeId}`, source.id, target.id, transition.label, '');
            graph.edges.push(edge);
            target.predecessors.push(source);
            source.successors.push(target);

            this.checkForInfinity(target, graph);
        }
    }

    /**
     * Clears the current Reachability Graph and resets the last processed diagram as well as the marking.
     */
    clear() {
        this._reachabilityGraph.set(new ReachabilityGraph());
        this._lastProcessedDiagram?.resetMarking();
        this._lastProcessedDiagram = null;
        this.initializeReachabilityGraphFirstStateNode();
    }

    /**
     * Checks if the current Reachability Graph is complete compared to the calculated one.
     * Uses ToasterNotificationService to inform the user.
     */
    checkReachabilityGraphCompleteness(): void {
        this._completeReachabilityGraph = this.calculateCompleteReachabilityGraph();
        const completeGraph = this._completeReachabilityGraph;

        if (completeGraph.isUnlimited) {
            this._notificationService.showInfo(
                'TOASTER.HEADER.PETRI_NET_UNLIMITED',
                'TOASTER.BODY.PETRI_NET_UNLIMITED',
            );
            return;
        }

        const userGraph = this._reachabilityGraph();
        const missingReachableEdges: { source: StateNode; target: StateNode; edge: FiringEdge }[] = [];

        for (const cEdge of completeGraph.edges) {
            const cSource = completeGraph.nodes.find((n) => n.id === cEdge.source);
            const cTarget = completeGraph.nodes.find((n) => n.id === cEdge.target);

            if (!cSource || !cTarget) continue;

            const uSource = userGraph.nodes.find((n) => n.label === cSource.label);

            if (!uSource) continue;

            const uTarget = userGraph.nodes.find((n) => n.label === cTarget.label);

            let edgeExists = false;
            if (uTarget) {
                edgeExists = userGraph.edges.some(
                    (uEdge) =>
                        uEdge.source === uSource.id &&
                        uEdge.target === uTarget.id &&
                        uEdge.displayLabel === cEdge.displayLabel,
                );
            }

            if (!edgeExists) {
                missingReachableEdges.push({ source: cSource, target: cTarget, edge: cEdge });
            }
        }

        if (missingReachableEdges.length > 0) {
            const list: ToastList[] = missingReachableEdges.slice(0, 5).map((item) => {
                return {
                    message: `${item.source.displayLabel} -[${item.edge.displayLabel}]-> ${item.target.displayLabel}`,
                };
            });

            if (missingReachableEdges.length > 5) {
                list.push({ message: '...' });
            }

            this._notificationService.showError(
                'TOASTER.HEADER.RG_CHECK_INCOMPLETE',
                'TOASTER.BODY.RG_CHECK_MISSING_EDGES_LIST',
                { list },
            );
            return;
        }

        this._notificationService.showSuccess('TOASTER.HEADER.RG_CHECK_SUCCESS', 'TOASTER.BODY.RG_CHECK_SUCCESS');
    }
}
