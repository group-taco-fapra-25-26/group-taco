import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PetriNetSavingService } from '../../../services/petri-net-saving.service';

@Component({
    selector: 'app-save',
    imports: [MatIcon, MatButton],
    templateUrl: './save.component.html',
    styleUrl: './save.component.css',
})
export class SaveComponent {
    private _petriNetSavingService = inject(PetriNetSavingService);

    protected onSave() {
        this._petriNetSavingService.savePetriNet();
    }
}
