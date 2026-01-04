import { Component, computed, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DisplayService } from '../../services/display.service';
import { Subscription } from 'rxjs';
import { ExampleFileComponent } from '../example-file/example-file.component';
import { SvgNodeComponent } from './svg-node/svg-node.component';
import { SvgArcComponent } from './svg-arc/svg-arc.component';
import { TabStateService } from '../../services/tab-state.service';
import { Tab } from '../../classes/tabs';
import { PetriNetLoaderService } from '../../services/petri-net-loader.service';
import { DisplayableNode } from '../../classes/displayable-graph.interface';
import { DiagramTransition } from '../../classes/diagram/diagram-transition';
import { ModeService } from '../../services/mode.service';
import { PlayService } from '../../services/play.service';
import { Diagram } from '../../classes/diagram/diagram';
import { PanningService } from '../../services/panning.service';
import { ImageExportService } from '../../services/image-export.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
    selector: 'app-display',
    standalone: true,
    templateUrl: './display.component.html',
    imports: [SvgNodeComponent, SvgArcComponent],
    providers: [PanningService],
    styleUrls: ['./display.component.css'],
})
export class DisplayComponent implements OnInit, OnDestroy {
    @ViewChild('drawingArea') drawingArea!: ElementRef<SVGGraphicsElement>;

    private _sub?: Subscription;
    private _displayService = inject(DisplayService);
    private _panningService = inject(PanningService);
    private _tabStateService = inject(TabStateService);
    private _imageExportService = inject(ImageExportService);
    private _loaderService = inject(PetriNetLoaderService);
    private _modeService = inject(ModeService);
    private _playService = inject(PlayService);
    private _elementRef = inject(ElementRef);

    readonly viewBox = this._panningService.viewBoxAsString;
    readonly diagram = toSignal(this._displayService.diagram$);
    readonly isDrawingEnabled = computed(() => this._tabStateService.currentTab() === Tab.DRAW);
    readonly isPlayingEnabled = computed(
        () =>
            this._tabStateService.currentTab() === Tab.PLAY ||
            this._tabStateService.currentTab() === Tab.REACHABILITY_GRAPH,
    );
    readonly isReachabilityGraphEnabled = computed(() => this._tabStateService.currentTab() === Tab.REACHABILITY_GRAPH);
    readonly isProcessNetEnabled = computed(() => this._tabStateService.currentTab() === Tab.PROCESS_NET);

    ngOnInit(): void {
        this._sub = this._displayService.downloadRequest$.subscribe((format) => {
            if (!this._elementRef.nativeElement.offsetParent) {
                return;
            }
            const svgElement = this.drawingArea?.nativeElement;

            if (svgElement && this.diagram()) {
                this._imageExportService.exportImage(svgElement, format);
            }
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

    public processNodeClick(node: DisplayableNode) {
        const diagram = this.diagram();
        if (this.isPlayingEnabled() && diagram && diagram instanceof Diagram && node instanceof DiagramTransition) {
            if (this._modeService.isExamMode()) {
                this._playService.updateFiringEntry(node.label, false);
            } else this._playService.processTransitionClick(diagram, node, true, true, true);
        }
    }

    public prevent(e: DragEvent) {
        e.preventDefault();
    }

    public startPan(event: MouseEvent): void {
        this._panningService.startPan(event, this.diagram(), this.drawingArea);
    }

    public pan(event: MouseEvent): void {
        this._panningService.pan(event, this.drawingArea);
    }

    public endPan(): void {
        this._panningService.endPan(this.drawingArea);
    }

    public onWheel(event: WheelEvent): void {
        this._panningService.zoom(event, this.drawingArea, this.diagram());
    }
}
