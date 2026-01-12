import { inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { FiringEntry } from './classes/firing-entry';
import { FiringEdge, ReachabilityGraph, StateNode } from './classes/reachability-graph.model';
import { ModeService } from './services/mode.service';
import { AppMode } from './classes/app-mode';
import { SourcePetriNetService } from './services/source-petri-net.service';
import { Diagram } from './classes/diagram/diagram';
import { ToasterNotificationService } from './services/toaster-notification.service';
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

        if (this._modeService.currentMode() === AppMode.LEARN) {
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

            //TO-DO Startmarkierung hervorheben, eingehender Arc aus dem Ursprung
            // const initialEdge = new FiringEdge('Initial', 'Initial', initialId, 'Initial','Initial');

            const newGraph = new ReachabilityGraph();
            newGraph.nodes = [initialStateNode];
            newGraph.edges = [];
            this._reachabilityGraph.set(newGraph);

            console.log('initialReachabilityLabel' + initialReachabilityLabel);
        } else if (this._modeService.currentMode() === AppMode.EXAM) {
            //nur im Hintergrund vergleichen, User gibt NodeLabel, also Marking, selbst ein und bekommt Feedback
        }
    }

    /**
     * Gets firing entry from play service
     * Converts marking to RG ID (only displays token numbers sorted ascending by place id (alphanumerical))
     *
     * @param firingEntry The firing entry containing start and end markings.
     * @param label The label of the fired transition.
     */
    convertFiringEntryLabelToReachabilityGraphID(firingEntry: FiringEntry, label: string) {
        let markingExists = false;
        let connectionExists = false;

        const currentReachabilityLabel: string = Object.entries(firingEntry.endMarking)
            .map(([, value]) => `${value}`)
            .join(' ');

        const graph = this._reachabilityGraph();
        const nextNodeIndex = graph.nodes.length + 1;
        let currentRgId = 'RG' + nextNodeIndex;
        const nextEdgeIndex = graph.edges.length + 1;
        const currentRgEdgeId = 'Edge' + nextEdgeIndex;

        //prüfen, ob aktuelle Zielmarkierung bereits vorhanden
        for (let i = 0; i < graph.nodes.length; i++) {
            const existingNodeLabel: string = graph.nodes[i].label;

            if (existingNodeLabel === currentReachabilityLabel) {
                markingExists = true;
                currentRgId = graph.nodes[i].id;

                // Vorhandensein der Verbindung prüfen, wenn Markierung bereits existiert;
                // so wird sichergestellt, dass eine Markierung, die von einer anderen Transiion
                // erzeugt wurde, ebenfalls verbunden bzw. eingefügt wird
                //displayLabel, source und target der Verbindungen vergleichen, um Gleichheit eindeutig zu prüfen
                for (let j = 0; j < graph.edges.length; j++) {
                    const existingArcDisplayLabel: string = graph.edges[j].displayLabel;
                    const existingArcSource: string = graph.edges[j].source;
                    const existingArcTarget: string = graph.edges[j].target;

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

        //TO-DO Nächste 4 Zeilen Löschen nach Testung
        //Zustand nach Schalten / Target für Arcs
        // const currentReachabilityLabel: string = Object.entries(firingEntry.endMarking)
        //     .map(([, value]) => `${value}`)
        //     .join(' ');

        if (!markingExists && !connectionExists) {
            // neuer Knoten und neue Kante

            //TODO: Nächste 3 Zeilen Löschen nach Testung
            // const graph = this._reachabilityGraph();
            // const nextNodeIndex = graph.nodes.length + 1;
            // const currentRgId = 'RG' + nextNodeIndex;

            const viewBox = this._panningService.viewBox();
            const width = Math.max(viewBox.width, 400);
            const height = Math.max(viewBox.height, 300);
            const startX = viewBox.minX;
            const startY = viewBox.minY;

            //x und y konstant festlegen
            const currentX: number = startX + Math.random() * width;
            const currentY: number = startY + Math.random() * height;

            //neuen StateNode erzeugen
            const currentStateNode = new StateNode(
                currentRgId,
                currentX,
                currentY,
                currentReachabilityLabel,
                firingEntry.endMarking as Record<string, number>,
            );

            //TO-DO: Nächste 2 Zeilen Löschen nach Testung
            // const nextEdgeIndex = graph.edges.length + 1;
            // const currentRgEdgeId = 'Edge' + nextEdgeIndex;

            //neue Verbindung erzeugen
            const currentFiringEdge = new FiringEdge(
                currentRgEdgeId,
                this.currentSourceRgId,
                currentRgId,
                label,
                firingEntry.firingSequence,
            );

            this._reachabilityGraph.update((graph) => {
                const newGraph = new ReachabilityGraph();
                newGraph.nodes = [...graph.nodes, currentStateNode];
                newGraph.edges = [...graph.edges, currentFiringEdge];
                return newGraph;
            });
        }

        if (markingExists && !connectionExists) {
            // neue Kante zu vorhandenem Markierungsknoten
            const currentFiringEdge = new FiringEdge(
                currentRgEdgeId,
                this.currentSourceRgId,
                currentRgId,
                label,
                firingEntry.firingSequence,
            );

            this._reachabilityGraph.update((graph) => {
                const newGraph = new ReachabilityGraph();
                newGraph.nodes = [...graph.nodes];
                newGraph.edges = [...graph.edges, currentFiringEdge];
                return newGraph;
            });
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

        //check for infinity after addition of each StateNode
        this.checkForInfinity();
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
            // console.log('Changed PN:' + oldPetriNet.currentMarking$);
            this._notificationService.showSuccess('TOASTER.HEADER.SUCCESS', 'TOASTER.BODY.SWITCHED_STATE_SUCCESSFULLY');
        }
    }

    /**
     * Method to check for infinity of Reachability Graph.
     * Triggered after each firing of a transition in the Petri Net.
     */
    checkForInfinity() {
// Abbruch, wenn unbeschränkt oder alles Möglichkeiten geschaltet, also
		// beschränkter EG vollständig 
// Marken jeder Stelle einzeln vergleichen, um Kriterium zu
		// erfüllen, sonst ungültig!
		// Dann Kombination aus "alle StellenMarken >= und zusätzlich Summe höher bildet
		// dannd as vollstaendige Unbeschraenktheitskriterium.


		// wenn kleinere Markierung gefunden --> unbeschränkt true -->teil von
		// mundmStrich =true für hinzugefuegte und gefundene Markierung
		// --> vorabgeschaltete Transition als Teil des Pfades markieren (für alle
		// Markierungen außer die letzte, da dort null)

		// wenn nichts gefunden --> immer wieder vergleichen, bis kleinere Markierung
		// gefunden (dann wie oben markieren) oder bis keine weiteren Vorgänger

		// besucht-Status für jede Markierung, damit man beim Prüfen nicht
		// rückwärts in Kreise läuft
		// zunächst alle Markierungen auf unbesucht
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
