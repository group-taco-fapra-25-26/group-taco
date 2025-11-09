import { ReachabilityGraph } from '../classes/reachability-graph.model';
import { inject, Injectable } from '@angular/core';
import { SourcePetriNetService } from './source-petri-net.service';
import { DisplayService } from './display.service';
import { Diagram } from '../classes/diagram/diagram';

@Injectable({
    providedIn: 'root',
})
export class ReachabilityGraphService {
    private _sourceNetService = inject(SourcePetriNetService);
    private _displayService = inject(DisplayService);

    /**
     * Berechnet den Erreichbarkeitsgraphen aus dem aktuellen Quell-Netz
     * und zeigt ihn im DisplayService an.
     */
    public generateAndDisplay(): void {
        const sourceNet = this._sourceNetService.getCurrentSourceNet();
        if (!sourceNet) {
            console.warn('ReachabilityGraphService: Kein Quell-Netz vorhanden.');
            this._displayService.clear();
            return;
        }

        const computedGraph = this.calculateReachabilityGraph(sourceNet);

        this._displayService.display(computedGraph);
    }

    private calculateReachabilityGraph(sourceNet: Diagram): ReachabilityGraph {
        //TODO: add real calculation logic here
        return new ReachabilityGraph();
    }
}
