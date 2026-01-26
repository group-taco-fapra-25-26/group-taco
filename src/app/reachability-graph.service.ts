import { inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { FiringEdge, ReachabilityGraph, StateNode } from './classes/reachability-graph.model';
import { ModeService } from './services/mode.service';
import { SourcePetriNetService } from './services/source-petri-net.service';
import { Diagram } from './classes/diagram/diagram';
import { ToasterNotificationService } from './services/toaster-notification.service';
import { Tab } from './classes/tabs';
import { PanningService } from './services/panning.service';

@Injectable({
    providedIn: 'root',
})
export class ReachabilityGraphService {
    private _reachabilityGraph: WritableSignal<ReachabilityGraph> = signal(new ReachabilityGraph());
    private _modeService: ModeService = inject(ModeService);
    private _sourceNetService = inject(SourcePetriNetService);
    private _startMarkingRG: Record<string, number> = {};
    private _currentMarkingRG = signal<Record<string, number>>(this._startMarkingRG);
    private _lastProcessedDiagram: Diagram | null = null;
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
     * @param node: The clicked StateNode
     */
    switchPnStateToClickedState(node: StateNode) {
        console.log('ChangeStateMethod started.');
        console.log('StateNode ID' + node.id);
        console.log('Label' + node.label);
        if (node.rGMarking) {
            console.log('Marking' + node.rGMarking);
        }

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
    checkForInfinity(node: StateNode) {
        console.log('CheckForInfinity');
        for (const rgStateNode of this._reachabilityGraph().nodes) {
            rgStateNode.nodeVisitedStateForLimitCheck = false;
        }

        for (const rgEdge of this._reachabilityGraph().edges) {
            rgEdge.isPartOfUnlimitedPath = false;
        }

        this.checkedStateNode = node;
        this.recursiveCheckForInfinity(node);
    }

    /**
     * Helper method for recursive check of method checkForInfinity
     */
    recursiveCheckForInfinity(node: StateNode) {
        console.log('Recursive CheckForInfinity');
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
                        !this._reachabilityGraph().isUnlimited
                    ) {
                        console.log('Unbeschränkt');
                        this._notificationService.showInfo(
                            'TOASTER.HEADER.PETRI_NET_UNLIMITED',
                            'TOASTER.BODY.PETRI_NET_UNLIMITED',
                        );
                        this._reachabilityGraph().isUnlimited = true;
                        checkPredecessor.isMorMStrich = true;
                        //TODO unbeschraenkteMarkierungM = direkterVorgaengerMarkierung;
                        this.checkedStateNode.isMorMStrich = true;
                        //TODO unbeschraenkteMarkierungMStrich = egUnbeschraenktheitsPruefMarkierung;
                        if (checkPredecessor.isStartingState) {
                            this._reachabilityGraph().breakLoop = true;
                            return;
                        }
                        return;
                    } else {
                        if (checkPredecessor.isStartingState) {
                            this._reachabilityGraph().breakLoop = true;
                            return;
                        }
                        this.recursiveCheckForInfinity(checkPredecessor);
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
}
