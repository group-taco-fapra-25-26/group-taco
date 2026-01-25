import { inject, Injectable } from '@angular/core';
import { FileReaderService } from './file-reader.service';
import { ParserService } from './parser.service';
import { DisplayService } from './display.service';
import { catchError, of, take } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ModeService } from './mode.service';
import { SourcePetriNetService } from './source-petri-net.service';
import { ToasterNotificationService } from './toaster-notification.service';
import { TabStateService } from './tab-state.service';
import { Tab } from '../classes/tabs';
import { SerializationService } from './serialization.service';
import { ProcessNetStateService } from './process-net-state.service';
import { PanningService } from './panning.service';

@Injectable({
    providedIn: 'root',
})
export class PetriNetLoaderService {
    private _fileReader = inject(FileReaderService);
    private _toasterService = inject(ToasterNotificationService);
    private _parser = inject(ParserService);
    private _displayService = inject(DisplayService);
    private _http = inject(HttpClient);
    private _sourcePetriNetService = inject(SourcePetriNetService);
    private _modeService = inject(ModeService);
    private _tabStateService = inject(TabStateService);
    private _serializationService = inject(SerializationService);
    private _processNetSateService = inject(ProcessNetStateService);
    private _panningService = inject(PanningService);

    /**
     * Processes an uploaded file (File object).
     * Reads, parses and loads the net into the DisplayService.
     *
     * @param file The file coming from the input field
     */
    public loadFile(file: File): void {
        this._fileReader
            .readFile(file)
            .pipe(take(1))
            .subscribe((content) => {
                if (content) {
                    this.parseAndDisplay(content);
                } else {
                    this._toasterService.showWarning(
                        'TOASTER.HEADER.READ_ERROR',
                        'TOASTER.BODY.FILE_EMPTY_OR_UNREADABLE',
                    );
                }
            });
    }

    /**
     * Processes a file from a URL
     * Fetches, parses and loads the net into the DisplayService.
     *
     * @param url The URL to the file
     */
    public loadFileFromUrl(url: string): void {
        this._http
            .get(url, { responseType: 'text' })
            .pipe(
                catchError((err) => {
                    const details = err?.message ? ` Grund: ${err.message}` : '';
                    this._toasterService.showError('TOASTER.HEADER.DOWNLOAD_FAILED', 'TOASTER.BODY.DOWNLOAD_FAILED', {
                        messageParams: { url, details },
                    });
                    return of(undefined);
                }),
                take(1),
            )
            .subscribe((content) => {
                if (content) {
                    this.parseAndDisplay(content);
                } else {
                    this._toasterService.showWarning('TOASTER.HEADER.EMPTY_RESPONSE', 'TOASTER.BODY.EMPTY_RESPONSE', {
                        messageParams: { url },
                    });
                }
            });
    }

    /**
     * Central parsing and update logic.
     */
    private parseAndDisplay(content: string): void {
        try {
            const parsedNet = this._parser.parse(content);

            if (parsedNet) {
                this._processNetSateService.clear();
                const inDrawTab = this._tabStateService.currentTab() === Tab.DRAW;
                if (this._modeService.isExamMode(Tab.DRAW) && inDrawTab) {
                    const tuple = this._serializationService.serializeTuple(parsedNet) ?? content;
                    this._sourcePetriNetService.setSourceText(tuple);
                    this._toasterService.showSuccess('TOASTER.HEADER.SUCCESS', 'TOASTER.BODY.NET_LOADED_SUCCESSFULLY');
                    return;
                }
                this._sourcePetriNetService.loadNewNet(parsedNet, content);
                this._tabStateService.setAllLastMarkings(parsedNet.marking);
                this._displayService.display(parsedNet, { triggeredByFiring: false });
                if (this._tabStateService.currentTab() === Tab.PROCESS_NET) {
                    this._processNetSateService.createStartPositions(parsedNet, this._panningService.INITIAL_VIEWBOX);
                }
                this._toasterService.showSuccess('TOASTER.HEADER.SUCCESS', 'TOASTER.BODY.NET_LOADED_SUCCESSFULLY');
            } else {
                this._toasterService.showWarning('TOASTER.HEADER.PARSER_ERROR', 'TOASTER.BODY.FILE_NOT_INTERPRETABLE');
            }
        } catch (error) {
            this._toasterService.showError('TOASTER.HEADER.PROCESSING_ERROR', 'TOASTER.BODY.CRITICAL_PARSING_ERROR');
        }
    }
}
