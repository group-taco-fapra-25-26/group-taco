import { inject, Injectable } from '@angular/core';
import { FileReaderService } from './file-reader.service';
import { ParserService } from './parser.service';
import { DisplayService } from './display.service';
import { catchError, of, take } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { SourcePetriNetService } from './source-petri-net.service';
import { ToasterNotificationService } from './toaster-notification.service';

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
                        'Lesefehler',
                        'Die ausgewählte Datei ist leer oder konnte nicht gelesen werden.',
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
                    this._toasterService.showError(
                        'Download fehlgeschlagen',
                        `Datei unter ${url} konnte nicht geladen werden.${details}`,
                    );
                    return of(undefined);
                }),
                take(1),
            )
            .subscribe((content) => {
                if (content) {
                    this.parseAndDisplay(content);
                } else {
                    this._toasterService.showWarning(
                        'Leere Antwort',
                        `Vom Server unter ${url} wurden keine Inhalte geliefert.`,
                    );
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
                this._sourcePetriNetService.loadNewNet(parsedNet, content);
                this._displayService.display(parsedNet);
                this._toasterService.showSuccess('Erfolg', 'Petri-Netz wurde erfolgreich geladen.');
            } else {
                this._toasterService.showWarning('Parserfehler', 'Die Datei konnte nicht interpretiert werden.');
            }
        } catch (error) {
            this._toasterService.showError(
                'Verarbeitungsfehler',
                'Beim Parsen der Datei ist ein kritischer Fehler aufgetreten.',
            );
        }
    }
}
