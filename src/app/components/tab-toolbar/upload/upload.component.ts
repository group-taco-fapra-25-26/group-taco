import { Component, inject } from '@angular/core';
import { PetriNetLoaderService } from '../../../services/petri-net-loader.service';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-upload',
    imports: [MatIcon, MatIconButton, MatTooltip, TranslateModule],
    templateUrl: './upload.component.html',
    styleUrl: './upload.component.css',
})
export class UploadComponent {
    private _loaderService = inject(PetriNetLoaderService);

    public onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;

        if (!input.files || input.files.length === 0) {
            return;
        }

        const file = input.files[0];

        this._loaderService.loadFile(file);

        input.value = '';
    }
}
