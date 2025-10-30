import { Component, computed, OnDestroy, output, signal, inject, OnInit } from '@angular/core';
import { DisplayService } from '../../services/display.service';
import { catchError, of, Subscription, take } from 'rxjs';
import { Diagram } from '../../classes/diagram/diagram';
import { ExampleFileComponent } from '../example-file/example-file.component';
import { FileReaderService } from '../../services/file-reader.service';
import { HttpClient } from '@angular/common/http';
import { SvgNodeComponent } from './svg-node/svg-node.component';
import { TabStateService } from '../../services/tab-state.service';
import { Tab } from '../../models/tab';

@Component({
    selector: 'app-display',
    templateUrl: './display.component.html',
    imports: [SvgNodeComponent],
    styleUrls: ['./display.component.css'],
})
export class DisplayComponent implements OnInit, OnDestroy {
    readonly fileContent = output<string>();

    readonly diagram = signal<Diagram | undefined>(undefined);

    private _sub?: Subscription;

    private _displayService = inject(DisplayService);
    private _fileReaderService = inject(FileReaderService);
    private _tabStateService = inject(TabStateService);
    private _http = inject(HttpClient);

    readonly isDrawingEnabled = computed(() => this._tabStateService.currentTab() === Tab.DRAW);

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
            this.fetchFile(fileLocation);
        } else {
            this.readFile(e.dataTransfer?.files);
        }
    }

    public prevent(e: DragEvent) {
        // dragover must be prevented for drop to work
        e.preventDefault();
    }

    private fetchFile(link: string) {
        this._http
            .get(link, {
                responseType: 'text',
            })
            .pipe(
                catchError((err) => {
                    console.error('Error while fetching file from link', link, err);
                    return of(undefined);
                }),
                take(1),
            )
            .subscribe((content) => {
                this.emitFileContent(content);
            });
    }

    private readFile(files: FileList | undefined | null) {
        if (files === undefined || files === null || files.length === 0) {
            return;
        }
        this._fileReaderService
            .readFile(files[0])
            .pipe(take(1))
            .subscribe((content) => {
                this.emitFileContent(content);
            });
    }

    private emitFileContent(content: string | undefined) {
        if (content === undefined) {
            return;
        }
        this.fileContent.emit(content);
    }
}
