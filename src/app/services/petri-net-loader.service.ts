import { Injectable, inject } from '@angular/core';
import { FileReaderService } from './file-reader.service';
import { ParserService } from './parser.service';
import { DisplayService } from './display.service';
import { take, catchError, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { SourcePetriNetService } from './source-petri-net.service';

@Injectable({
    providedIn: 'root',
})
export class PetriNetLoaderService {
    private _fileReader = inject(FileReaderService);
    private _parser = inject(ParserService);
    private _displayService = inject(DisplayService);
    private _http = inject(HttpClient);
    private _sourcePetrinetService = inject(SourcePetriNetService);

    /**
     * Verarbeitet eine hochgeladene Datei (File-Objekt).
     * Liest, parst und lädt das Netz in den DisplayService.
     *
     * @param file Die vom Input-Feld kommende Datei
     */
    public loadFile(file: File): void {
        this._fileReader
            .readFile(file)
            .pipe(take(1))
            .subscribe((content) => {
                if (content) {
                    this.parseAndDisplay(content);
                } else {
                    //TODO: call the toaster service after it is implemented
                    console.error('Datei konnte nicht gelesen werden oder ist leer.');
                }
            });
    }

    /**
     * Verarbeitet eine Datei von einer URL (z.B. von deinen Beispielen).
     * Lädt, parst und lädt das Netz in den DisplayService.
     *
     * @param url Die URL zur Beispieldatei
     */
    public loadFileFromUrl(url: string): void {
        this._http
            .get(url, { responseType: 'text' })
            .pipe(
                catchError((err) => {
                    //TODo: call the toaster service after it is implemented
                    console.error('Error while fetching file from link', url, err);
                    return of(undefined);
                }),
                take(1),
            )
            .subscribe((content) => {
                if (content) {
                    this.parseAndDisplay(content);
                } else {
                    //TODO: call the toaster service after it is implemented
                    console.error('Kein Inhalt von URL erhalten.', url);
                }
            });
    }

    /**
     * Die zentrale Parsing- und Update-Logik.
     */
    private parseAndDisplay(content: string): void {
        try {
            const parsedNet = this._parser.parse(content);

            if (parsedNet) {
                this._sourcePetrinetService.setSourceNet(parsedNet);
                this._displayService.display(parsedNet);
                console.log('PetriNetLoaderService: Netz erfolgreich geladen.');
            } else {
                //TODO: call the toaster service after it is implemented
                console.warn('Parser-Fehler: Datei konnte nicht geparsed werden.');
            }
        } catch (error) {
            //TODO: call the toaster service after it is implemented
            console.error('Schwerer Fehler beim Parsen:', error);
        }
    }
}
