import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogRef } from '@angular/material/dialog';
import { ParserService } from '../../services/parser.service';
import { SourcePetriNetService } from '../../services/source-petri-net.service';
import { ToasterNotificationService } from '../../services/toaster-notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { SpringEmbedderService } from '../../services/spring-embedder.service';
import { DisplayService } from '../../services/display.service';

@Component({
    selector: 'app-tuple-input',
    standalone: true,
    imports: [CommonModule, FormsModule, MatButtonModule, MatInputModule, MatFormFieldModule, TranslateModule],
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

    processTuple() {
        if (!this.tupleString) return;

        const diagram = this._parserService.parse(this.tupleString);
        if (diagram) {
            this._sourcePetriNetService.loadNewNet(diagram, this.tupleString);
            this._displayService.display(diagram);
            this._springEmbedderService.calculateLayout().catch((error) => console.error(error));
            this._toaster.showSuccess('TUPLE_INPUT.TOAST_SUCCESS_HEADER', 'TUPLE_INPUT.TOAST_SUCCESS_BODY');
            this._dialogRef.close();
        } else {
            this._toaster.showError('TUPLE_INPUT.TOAST_ERROR_HEADER', 'TUPLE_INPUT.TOAST_ERROR_BODY');
        }
    }

    cancel() {
        this._dialogRef.close();
    }
}
