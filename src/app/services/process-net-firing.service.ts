import { inject, Injectable } from '@angular/core';
import { ToasterNotificationService } from './toaster-notification.service';
import { Diagram } from '../classes/diagram/diagram';
import { DiagramPlace } from '../classes/diagram/diagram-place';
import { DiagramTransition } from '../classes/diagram/diagram-transition';
import { Connection, DrawnElement, ProcessNetStateService } from './process-net-state.service';
import { PlayService } from './play.service';
import { SourcePetriNetService } from './source-petri-net.service';
import { ModeService } from './mode.service';
import { Tab } from '../classes/tabs';
import { DisplayService } from './display.service';

export interface ProcessNetFiringFlow {
    placeId: string;
    placeLabel: string;
    weight: number;
}

export interface ProcessNetFiringEvent {
    transitionId: string;
    transitionLabel: string;
    timestamp: string;
    inputs: ProcessNetFiringFlow[];
    outputs: ProcessNetFiringFlow[];
}

@Injectable({ providedIn: 'root' })
export class ProcessNetFiringService {
    private _sourceNetService = inject(SourcePetriNetService);
    private _toaster = inject(ToasterNotificationService);
    private _stateService = inject(ProcessNetStateService);
    private _modeService = inject(ModeService);
    private _displayService = inject(DisplayService);

    private autoFiringCount = 0;
    private _playService = inject(PlayService);

    /**
     * Handles the click on a transition. Checks if the transition is enabled,
     * fires it, updates the diagram marking, and adds the corresponding graphical elements
     * to the process net.
     *
     * @param diagram The Petri net diagram.
     * @param node The clicked transition.
     */
    processTransitionClicked(diagram: Diagram, node: DiagramTransition): void {
        if (this._modeService.isExamMode(Tab.PROCESS_NET)) return;
        if (node.isActivated()) {
            const timestamp = new Date().toISOString();
            const firedTransition = node.label ?? node.id;
            const inputs = node.getInputFlow().map(({ place, weight }) => ({
                placeId: place.id,
                placeLabel: place.displayLabel,
                weight,
            }));
            const outputs = node.getOutputFlow().map(({ place, weight }) => ({
                placeId: place.id,
                placeLabel: place.displayLabel,
                weight,
            }));

            this._playService.fireTransition(node, diagram, true);

            this.addFiringGraph({
                transitionId: node.id,
                transitionLabel: firedTransition,
                timestamp,
                inputs,
                outputs,
            });
            this._sourceNetService.updateEditedNet(diagram, { triggeredByFiring: true });
            this._stateService.requestFitView();
        } else {
            this._toaster.showWarning(
                'TOASTER.HEADER.TRANSITION_NOT_ACTIVATED',
                'TOASTER.BODY.TRANSITION_NOT_ACTIVATED',
                {
                    messageParams: { label: node.label },
                },
            );
        }
    }

    /**
     * Clears the process net and resets the source diagram's marking.
     */
    clear() {
        this.autoFiringCount = 0;
        this._stateService.clear();
        if (this._displayService.diagram instanceof Diagram) {
            this._displayService.diagram.resetMarking();
        }
    }

    /**
     * Adds the visual elements for a firing event to the process net.
     * Calculates position, creates the transition, and processes input/output flows.
     *
     * @param event The firing event data.
     */
    private addFiringGraph(event: ProcessNetFiringEvent): void {
        const drawnElements = this._stateService.drawnElements();
        const usedPlaces = new Set<string>();
        this._stateService.connections().forEach((connection) => usedPlaces.add(connection.aId));

        const { baseX, baseY } = this.calculateSmartPosition(event, drawnElements, usedPlaces);

        const transitionElement = this.createTransition(event.transitionLabel, baseX, baseY);

        const newElements: DrawnElement[] = [transitionElement];

        const inputConnections = this.processInputFlows(
            event.inputs,
            baseX,
            baseY,
            newElements,
            usedPlaces,
            transitionElement.id,
        );

        const outputConnections = this.processOutputFlows(
            event.outputs,
            baseX,
            baseY,
            newElements,
            transitionElement.id,
        );

        this._stateService.updateDrawnElements((elements) => [...elements, ...newElements]);
        this._stateService.updateConnections((connections) => [
            ...connections,
            ...inputConnections,
            ...outputConnections,
        ]);
        this.autoFiringCount++;
    }

    /**
     * Calculates the position for the new transition based on its input places.
     * effectively simulating token consumption to find where to place the transition.
     */
    private calculateSmartPosition(
        event: ProcessNetFiringEvent,
        drawnElements: DrawnElement[],
        currentUsedPlaces: Set<string>,
    ): { baseX: number; baseY: number } {
        const tempUsedPlaces = new Set(currentUsedPlaces);
        const matchedInputNodes: { x: number; y: number }[] = [];

        for (const flow of event.inputs) {
            for (let i = 0; i < flow.weight; i++) {
                const existing = drawnElements.find((el) => {
                    if (!(el.node instanceof DiagramPlace)) return false;
                    if (tempUsedPlaces.has(el.id)) return false;
                    const nodeLabel = el.node.label ?? el.node.displayLabel;
                    return nodeLabel === flow.placeLabel;
                });
                if (existing) {
                    matchedInputNodes.push({ x: existing.node.x, y: existing.node.y });
                    tempUsedPlaces.add(existing.id);
                }
            }
        }

        const viewBox = this._stateService.viewBox();
        let baseX: number;
        let baseY: number;

        if (matchedInputNodes.length > 0) {
            const avgY = matchedInputNodes.reduce((sum, n) => sum + n.y, 0) / matchedInputNodes.length;
            const maxX = Math.max(...matchedInputNodes.map((n) => n.x));
            baseX = maxX + 220;
            baseY = avgY;
        } else {
            const allMaxX =
                drawnElements.length > 0 ? Math.max(...drawnElements.map((e) => e.node.x)) : viewBox.minX + 50;
            baseX = allMaxX + 220;
            baseY = viewBox.minY + 200 + (this.autoFiringCount % 10) * 100;
        }

        return { baseX, baseY };
    }

    /**
     * Creates the transition element.
     */
    private createTransition(label: string, x: number, y: number): DrawnElement {
        const transition = this._stateService.buildTransition(
            this._stateService.generateElementId('fire-transition'),
            label,
        );
        transition.x = x;
        transition.y = y;
        return { node: transition, id: transition.id };
    }

    /**
     * Processes input flows: resolves places (existing or new) and creates connections.
     */
    private processInputFlows(
        inputs: ProcessNetFiringFlow[],
        baseX: number,
        baseY: number,
        newElements: DrawnElement[],
        usedPlaces: Set<string>,
        transitionId: string,
    ): Connection[] {
        const laneSpacing = 120;
        const totalInputNodes = inputs.reduce((sum, flow) => sum + flow.weight, 0);
        const inputBaseY = baseY - ((totalInputNodes - 1) * laneSpacing) / 2;
        let inputOffset = 0;

        const connections: Connection[] = [];

        for (const flow of inputs) {
            for (let i = 0; i < flow.weight; i++) {
                const { id: placeId, weight } = this.resolvePlaceForFlow(
                    flow.placeLabel,
                    baseX - 20,
                    inputBaseY + inputOffset * laneSpacing,
                    newElements,
                    1,
                    usedPlaces,
                );

                connections.push({
                    id: this._stateService.generateConnectionId('fire-in'),
                    aId: placeId,
                    bId: transitionId,
                    weight: weight,
                });

                inputOffset++;
            }
        }
        return connections;
    }

    /**
     * Processes output flows: creates new places and connections.
     */
    private processOutputFlows(
        outputs: ProcessNetFiringFlow[],
        baseX: number,
        baseY: number,
        newElements: DrawnElement[],
        transitionId: string,
    ): Connection[] {
        const laneSpacing = 120;
        const totalOutputNodes = outputs.reduce((sum, flow) => sum + flow.weight, 0) || 1;
        const outputBaseY = baseY - ((totalOutputNodes - 1) * laneSpacing) / 2;
        let outputOffset = 0;

        const connections: Connection[] = [];

        outputs.forEach((flow) => {
            for (let i = 0; i < flow.weight; i++) {
                const reservedLabels = newElements
                    .filter((e) => e.node instanceof DiagramPlace && e.node.innerLabel)
                    .map((e) => (e.node as DiagramPlace).innerLabel!);
                const innerLabel = this._stateService.getNextInnerLabel(reservedLabels);

                const place = this._stateService.buildPlace(
                    this._stateService.generateElementId('fire-place'),
                    flow.placeLabel,
                    0,
                    {
                        hideTokens: true,
                        innerLabel,
                    },
                );
                place.x = baseX + 100;
                place.y = outputBaseY + outputOffset * laneSpacing;
                outputOffset++;

                const element: DrawnElement = { node: place, id: place.id };
                newElements.push(element);

                connections.push({
                    id: this._stateService.generateConnectionId('fire-out'),
                    aId: transitionId,
                    bId: place.id,
                    weight: 1,
                });
            }
        });

        return connections;
    }

    /**
     * Finds an existing available place for a flow or creates a new one if not found.
     * Updates usedPlaces and currentStepElements.
     */
    private resolvePlaceForFlow(
        label: string,
        defaultX: number,
        defaultY: number,
        currentStepElements: DrawnElement[],
        weight: number,
        usedPlaces: Set<string>,
    ): { id: string; weight: number } {
        const existing = this._stateService.drawnElements().find((el) => {
            if (!(el.node instanceof DiagramPlace)) return false;
            if (usedPlaces.has(el.id)) return false;
            const nodeLabel = el.node.label ?? el.node.displayLabel;
            return nodeLabel === label;
        });
        if (existing) {
            usedPlaces.add(existing.id);
            return { id: existing.id, weight };
        }

        const created = currentStepElements.find((el) => {
            if (!(el.node instanceof DiagramPlace)) return false;
            if (usedPlaces.has(el.id)) return false;
            const nodeLabel = el.node.label ?? el.node.displayLabel;
            return nodeLabel === label;
        });
        if (created) {
            usedPlaces.add(created.id);
            return { id: created.id, weight };
        }

        const reservedLabels = currentStepElements
            .filter((e) => e.node instanceof DiagramPlace && e.node.innerLabel)
            .map((e) => (e.node as DiagramPlace).innerLabel!);
        const innerLabel = this._stateService.getNextInnerLabel(reservedLabels);

        const place = this._stateService.buildPlace(this._stateService.generateElementId('fire-place'), label, 0, {
            hideTokens: true,
            innerLabel,
        });
        place.x = defaultX;
        place.y = defaultY;
        const element: DrawnElement = { node: place, id: place.id };
        currentStepElements.push(element);
        usedPlaces.add(element.id);
        return { id: element.id, weight };
    }
}
