import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ParserService } from '../../services/parser.service';
import { SourcePetriNetService } from '../../services/source-petri-net.service';
import { ToasterNotificationService } from '../../services/toaster-notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { SpringEmbedderService } from '../../services/spring-embedder.service';
import { DisplayService } from '../../services/display.service';
import { DiagramNode } from '../../classes/diagram/diagram-node';
import { applyParallelOffsetsToArcs } from '../../services/arc-parallel-offset.util';
import { TabStateService } from '../../services/tab-state.service';
import { ProcessNetStateService } from '../../services/process-net-state.service';
import { ReachabilityGraphService } from '../../reachability-graph.service';
import { Tab } from '../../classes/tabs';
import { PanningService } from '../../services/panning.service';

@Component({
    selector: 'app-tuple-input',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatInputModule,
        MatFormFieldModule,
        MatDialogModule,
        TranslateModule,
    ],
    templateUrl: './tuple-input.component.html',
    styleUrls: ['./tuple-input.component.css'],
})
export class TupleInputComponent {
    tupleString = '';

    private _parserService = inject(ParserService);
    private _sourcePetriNetService = inject(SourcePetriNetService);
    private _springEmbedderService = inject(SpringEmbedderService);
    private _displayService = inject(DisplayService);
    private _toaster = inject(ToasterNotificationService);
    private _dialogRef = inject(MatDialogRef<TupleInputComponent>);
    private _tabStateService = inject(TabStateService);
    private _processNetStateService = inject(ProcessNetStateService);
    private _reachabilityGraphService = inject(ReachabilityGraphService);
    private _panningService = inject(PanningService);

    processTuple() {
        if (!this.tupleString) return;

        const diagram = this._parserService.parse(this.tupleString);
        if (diagram) {
            this._sourcePetriNetService.loadNewNet(diagram, this.tupleString);

            const currentTab = this._tabStateService.currentTab();
            if (currentTab === Tab.PROCESS_NET) {
                this._processNetStateService.clear();
                this._processNetStateService.createStartPositions(diagram, this._panningService.INITIAL_VIEWBOX);
            } else if (currentTab === Tab.REACHABILITY_GRAPH) {
                this._reachabilityGraphService.clear();
            }

            this._displayService.display(diagram);
            this._springEmbedderService.calculateLayout().catch((error) => console.error(error));
            this._toaster.showSuccess('TUPLE_INPUT.TOAST_SUCCESS_HEADER', 'TUPLE_INPUT.TOAST_SUCCESS_BODY');
            this._dialogRef.close();
            // Build node map and apply parallel offsets to arcs
            const nodeMap = new Map<string, DiagramNode>();
            diagram.allNodes.forEach((node: DiagramNode) => nodeMap.set(node.id, node));
            applyParallelOffsetsToArcs(diagram.arcs, nodeMap);
        } else {
            this._toaster.showError('TUPLE_INPUT.TOAST_ERROR_HEADER', 'TUPLE_INPUT.TOAST_ERROR_BODY');
        }
    }
}
