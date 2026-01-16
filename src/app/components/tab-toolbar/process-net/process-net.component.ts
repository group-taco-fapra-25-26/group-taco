import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { ProcessNetDisplayComponent } from './process-net-display/process-net-display.component';
import { ProcessNetDrawDisplayComponent } from './process-net-draw-display/process-net-draw-display';
import { DisplayService } from '../../../services/display.service';
import { SourcePetriNetService } from '../../../services/source-petri-net.service';
import { SerializationService } from '../../../services/serialization.service';
import { ParserService } from '../../../services/parser.service';
import { Diagram } from '../../../classes/diagram/diagram';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
    selector: 'app-process-net',
    standalone: true,
    imports: [ProcessNetDisplayComponent, ProcessNetDrawDisplayComponent],
    templateUrl: './process-net.component.html',
    styleUrl: './process-net.component.css',
    providers: [DisplayService],
})
export class ProcessNetComponent implements OnInit {
    private displayService = inject(DisplayService);
    private sourcePetriNetService = inject(SourcePetriNetService);
    private serializationService = inject(SerializationService);
    private parserService = inject(ParserService);
    private destroyRef = inject(DestroyRef);

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
        this.pushCloneToLocalDisplay(this.sourcePetriNetService.getCurrentSourceNet());
        this.sourcePetriNetService.sourceNet$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((net) => this.pushCloneToLocalDisplay(net));
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
            console.error('Failed to clone net for Process Net tab', err);
            this.displayService.clear();
        }
    }
}
