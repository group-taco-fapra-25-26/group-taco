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

    clear() {
        this.autoFiringCount = 0;
        this._stateService.clear();
        if (this._displayService.diagram instanceof Diagram) {
            this._displayService.diagram.resetMarking();
        }
    }

    private addFiringGraph(event: ProcessNetFiringEvent): void {
        const viewBox = this._stateService.viewBox();
        const verticalSpacing = 180;
        const rowIndex = this.autoFiringCount;
        const baseY = viewBox.minY + 120 + rowIndex * verticalSpacing;
        const baseX = viewBox.minX + viewBox.width * 0.6;

        const transition = this._stateService.buildTransition(
            this._stateService.generateElementId('fire-transition'),
            event.transitionLabel,
        );
        transition.x = baseX;
        transition.y = baseY;
        const transitionElement: DrawnElement = { node: transition, id: transition.id };

        const laneSpacing = 60;
        const inputBaseY = baseY - ((event.inputs.length - 1) * laneSpacing) / 2;
        const totalOutputNodes = event.outputs.reduce((sum, flow) => sum + flow.weight, 0) || 1;
        const outputBaseY = baseY - ((totalOutputNodes - 1) * laneSpacing) / 2;
        let outputOffset = 0;

        const newElements: DrawnElement[] = [];
        const usedPlaces = new Set<string>();

        this._stateService.connections().forEach((connection) => usedPlaces.add(connection.aId));

        const inputElements = event.inputs.map((flow, idx) =>
            this.resolvePlaceForFlow(
                flow.placeLabel,
                baseX - 160,
                inputBaseY + idx * laneSpacing,
                newElements,
                flow.weight,
                usedPlaces,
            ),
        );

        const outputElements = event.outputs.flatMap((flow) => {
            const created: { id: string; weight: number }[] = [];
            for (let i = 0; i < flow.weight; i++) {
                const place = this._stateService.buildPlace(
                    this._stateService.generateElementId('fire-place'),
                    flow.placeLabel,
                    0,
                    {
                        hideTokens: true,
                    },
                );
                place.x = baseX + 160;
                place.y = outputBaseY + outputOffset * laneSpacing;
                outputOffset++;
                const element: DrawnElement = { node: place, id: place.id };
                newElements.push(element);
                created.push({ id: element.id, weight: 1 });
            }
            return created;
        });

        newElements.push(transitionElement);
        this._stateService.updateDrawnElements((elements) => [...elements, ...newElements]);

        const newConnections: Connection[] = [];
        inputElements.forEach((input) => {
            newConnections.push({
                id: this._stateService.generateConnectionId('fire-in'),
                aId: input.id,
                bId: transitionElement.id,
                weight: input.weight,
            });
        });
        outputElements.forEach((output) => {
            newConnections.push({
                id: this._stateService.generateConnectionId('fire-out'),
                aId: transitionElement.id,
                bId: output.id,
                weight: 1,
            });
        });

        this._stateService.updateConnections((connections) => [...connections, ...newConnections]);
        this.autoFiringCount++;
    }

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

        const place = this._stateService.buildPlace(this._stateService.generateElementId('fire-place'), label, 0, {
            hideTokens: true,
        });
        place.x = defaultX;
        place.y = defaultY;
        const element: DrawnElement = { node: place, id: place.id };
        currentStepElements.push(element);
        usedPlaces.add(element.id);
        return { id: element.id, weight };
    }
}
