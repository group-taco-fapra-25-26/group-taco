import { inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { FiringEdge, ReachabilityGraph, StateNode } from './classes/reachability-graph.model';
import { ModeService } from './services/mode.service';
import { SourcePetriNetService } from './services/source-petri-net.service';
import { Diagram } from './classes/diagram/diagram';
import { ToasterNotificationService } from './services/toaster-notification.service';
import { Tab } from './classes/tabs';

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
        //Zustand nach Schalten / Target für Arcs
        const currentReachabilityLabel: string = Object.entries(diagram.marking)
            .map(([, value]) => `${value}`)
            .join(' ');

        const graph = this._reachabilityGraph();
        const nextNodeIndex = graph.nodes.length + 1;
        const currentRgId = 'RG' + nextNodeIndex;

        //x und y Startwert konstant festlegen
        const currentX: number = 300 + graph.nodes.length * 100;
        const currentY: number = 50 + graph.nodes.length * 100;

        //neuen StateNode erzeugen
        const previousNode = graph.nodes.find((node) => node.id === this.currentSourceRgId);
        const firingPath = previousNode ? previousNode.firingPath + ' ' + label : label;
        const currentStateNode = new StateNode(
            currentRgId,
            currentX,
            currentY,
            currentReachabilityLabel,
            { ...diagram.marking } as Record<string, number>,
            firingPath,
        );

        const nextEdgeIndex = graph.edges.length + 1;
        const currentRgEdgeId = 'Edge' + nextEdgeIndex;

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

        //change target to new source for arcs
        this.currentSourceRgId = currentRgId;

        console.log(currentReachabilityLabel);
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

            oldPetriNet.updateMarking();
            this._sourceNetService.updateEditedNet(oldPetriNet, { triggeredByFiring: false });
            console.log('Changed PN:' + oldPetriNet.currentMarking$);
            this._notificationService.showSuccess('TOASTER.HEADER.SUCCESS', 'TOASTER.BODY.SWITCHED_STATE_SUCCESSFULLY');
        }
    }
}
