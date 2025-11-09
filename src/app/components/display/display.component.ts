import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DisplayService } from '../../services/display.service';
import { Subscription } from 'rxjs';
import { ExampleFileComponent } from '../example-file/example-file.component';
import { SvgNodeComponent } from './svg-node/svg-node.component';
import { SvgArcComponent } from './svg-arc/svg-arc.component';
import { TabStateService } from '../../services/tab-state.service';
import { Tab } from '../../classes/tabs';
import { DisplayableGraph } from '../../classes/displayable-graph.interface';
import { PetriNetLoaderService } from '../../services/petri-net-loader.service';

@Component({
    selector: 'app-display',
    standalone: true,
    templateUrl: './display.component.html',
    imports: [SvgNodeComponent, SvgArcComponent],
    styleUrls: ['./display.component.css'],
})
export class DisplayComponent implements OnInit, OnDestroy {
    readonly diagram = signal<DisplayableGraph | undefined>(undefined);

    private _sub?: Subscription;

    private _displayService = inject(DisplayService);
    private _tabStateService = inject(TabStateService);
    private _loaderService = inject(PetriNetLoaderService);

    readonly isDrawingEnabled = computed(() => this._tabStateService.currentTab() === Tab.DRAW);
    readonly isPlayingEnabled = computed(() => this._tabStateService.currentTab() === Tab.PLAY);
    readonly isReachabilityGraphEnabled = computed(() => this._tabStateService.currentTab() === Tab.REACHABILITY_GRAPH);
    readonly isProcessNetEnabled = computed(() => this._tabStateService.currentTab() === Tab.PROCESS_NET);

    ngOnInit(): void {
        this._sub = this._displayService.diagram$.subscribe((diagram) => {
            console.log('new diagram');
            this.diagram.set(diagram);
        });
    }

    ngOnDestroy(): void {
        this._sub?.unsubscribe();
    }

    public processDropEvent(e: DragEvent) {
        e.preventDefault();
        const fileLocation = e.dataTransfer?.getData(ExampleFileComponent.META_DATA_CODE);

        if (fileLocation) {
            this._loaderService.loadFileFromUrl(fileLocation);
        } else if (e.dataTransfer?.files) {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this._loaderService.loadFile(files[0]);
            }
        }
    }

    public prevent(e: DragEvent) {
        e.preventDefault();
    }
}
