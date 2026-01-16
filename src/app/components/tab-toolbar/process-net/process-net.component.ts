import { Component, OnInit, inject, DestroyRef, OnDestroy, effect, ViewChild } from '@angular/core';
import { ProcessNetDisplayComponent } from './process-net-display/process-net-display.component';
import { ProcessNetDrawDisplayComponent } from './process-net-draw-display/process-net-draw-display';
import { DisplayService } from '../../../services/display.service';
import { SourcePetriNetService } from '../../../services/source-petri-net.service';
import { SerializationService } from '../../../services/serialization.service';
import { ParserService } from '../../../services/parser.service';
import { Diagram } from '../../../classes/diagram/diagram';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TabStateService } from '../../../services/tab-state.service';
import { Tab } from '../../../classes/tabs';
import { ProcessNetStateService } from '../../../services/process-net-state.service';
import { ModeService } from '../../../services/mode.service';

@Component({
    selector: 'app-process-net',
    standalone: true,
    imports: [ProcessNetDisplayComponent, ProcessNetDrawDisplayComponent],
    templateUrl: './process-net.component.html',
    styleUrl: './process-net.component.css',
    providers: [DisplayService],
})
export class ProcessNetComponent implements OnInit, OnDestroy {
    private displayService = inject(DisplayService);
    private sourcePetriNetService = inject(SourcePetriNetService);
    private serializationService = inject(SerializationService);
    private parserService = inject(ParserService);
    private destroyRef = inject(DestroyRef);
    private tabState = inject(TabStateService);
    private processNetState = inject(ProcessNetStateService);
    private modeService = inject(ModeService);
    private lastSourceNetRef: Diagram | null = null;

    @ViewChild(ProcessNetDrawDisplayComponent)
    private drawDisplayComponent?: ProcessNetDrawDisplayComponent;

    private tabSwitchEffect = effect(() => {
        const tab = this.tabState.currentTab();
        if (tab === Tab.PROCESS_NET) {
            const restored = this.processNetState.restore();
            if (restored) {
                this.displayService.display(restored);
                return;
            }
            this.pushCloneToLocalDisplay(this.sourcePetriNetService.getCurrentSourceNet());
        } else {
            // no-op: only persist markings when firing transitions
        }
    });

    private modeResetEffect = (() => {
        let initialized = false;
        return effect(() => {
            this.modeService.currentMode();
            if (!initialized) {
                initialized = true;
                return;
            }
            this.resetToDefaultMarking();
        });
    })();

    //this is only needed because of the download from the global toolbar and because this component provides its own DisplayService
    //maybe we can find a better way to do this in the future

    private globalDisplayService = inject(DisplayService, { skipSelf: true, optional: true });

    constructor() {
        if (this.globalDisplayService) {
            this.globalDisplayService.downloadRequest$
                .pipe(takeUntilDestroyed())
                .subscribe((req) => this.displayService.triggerDownload(req.format, req.target));
        }
    }

    ngOnInit(): void {
        // attempt to restore cached process net when entering tab initially
        const cached = this.processNetState.restore();
        if (cached) {
            this.displayService.display(cached);
        } else {
            this.pushCloneToLocalDisplay(this.sourcePetriNetService.getCurrentSourceNet());
        }

        this.sourcePetriNetService.sourceNet$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((net) => {
            if (net !== this.lastSourceNetRef) {
                this.lastSourceNetRef = net;
                this.drawDisplayComponent?.clearDrawing();
            }
            if (this.tabState.currentTab() !== Tab.PROCESS_NET) {
                return;
            }
            this.pushCloneToLocalDisplay(net);
        });

        // listen for tab switches to persist/restore
        // handled by tabSwitchEffect, which runs in injection context
    }

    ngOnDestroy(): void {
        // cleanup signal effect when component is destroyed
        this.tabSwitchEffect.destroy();
        this.modeResetEffect.destroy();
        // do not clear cached state here so markings persist across component re-creation
    }

    private pushCloneToLocalDisplay(net: Diagram | null): void {
        if (!net) {
            this.displayService.clear();
            return;
        }
        try {
            const json = this.serializationService.serializeJson(net);
            const clone = this.parserService.parseJson(json);
            if (clone) {
                const triggeredByFiring = this.sourcePetriNetService.consumeChangeTriggeredByFiring();
                this.displayService.display(clone, { triggeredByFiring });
            } else {
                this.displayService.clear();
            }
        } catch (err) {
            this.displayService.clear();
        }
    }

    private resetToDefaultMarking(): void {
        const source = this.sourcePetriNetService.getCurrentSourceNet();
        if (!source) {
            return;
        }
        try {
            const json = this.serializationService.serializeJson(source);
            const clone = this.parserService.parseJson(json);
            if (clone) {
                clone.resetMarking();
                this.processNetState.clear();
                this.processNetState.save(clone);
                this.displayService.display(clone);
            }
        } catch (err) {
            // swallow reset errors
        }
    }
}
