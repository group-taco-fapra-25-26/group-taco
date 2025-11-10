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
                    // TODO: call the toaster service after it is implemented
                    console.error('File could not be read or is empty.');
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
                    // TODO: call the toaster service after it is implemented
                    console.error('Error while fetching file from URL', url, err);
                    return of(undefined);
                }),
                take(1),
            )
            .subscribe((content) => {
                if (content) {
                    this.parseAndDisplay(content);
                } else {
                    // TODO: call the toaster service after it is implemented
                    console.error('No content received from URL.', url);
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
                this._sourcePetriNetService.setSourceNet(parsedNet);
                this._displayService.display(parsedNet);
                console.log('PetriNetLoaderService: Petri net loaded successfully.');
            } else {
                // TODO: call the toaster service after it is implemented
                console.warn('Parser error: file could not be parsed.');
            }
        } catch (error) {
            // TODO: call the toaster service after it is implemented
            console.error('Critical error while parsing:', error);
        }
    }
}
