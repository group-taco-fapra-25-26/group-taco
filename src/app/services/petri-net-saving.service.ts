import { inject, Injectable } from '@angular/core';
import { SourcePetriNetService } from './source-petri-net.service';
import { ToasterNotificationService } from './toaster-notification.service';
import { Diagram } from '../classes/diagram/diagram';
import { SerializationService } from './serialization.service';

@Injectable({ providedIn: 'root' })
export class PetriNetSavingService {
    private _sourcePetriNetService = inject(SourcePetriNetService);
    private _notificationService = inject(ToasterNotificationService);
    private _serializationService = inject(SerializationService);

    private readonly FILE_NAME = 'petri-net.json';

    /**
     * Saves the current Petri net by triggering a download of the source text as a JSON file.
     * If no Petri net is present, a warning notification is shown.
     */
    public savePetriNet(): void {
        const isDirty = this._sourcePetriNetService.isCurrentNetDirty();
        let textContent: string;
        let diagramToSave: Diagram | null;

        if (isDirty) {
            diagramToSave = this._sourcePetriNetService.getCurrentSourceNet();
            if (!diagramToSave) return;

            textContent = this._serializationService.serialize(diagramToSave);
            this._sourcePetriNetService.setClean(textContent, diagramToSave);
        } else {
            textContent = this._sourcePetriNetService.getSourceText();
        }

        if (!textContent) {
            this._notificationService.showWarning(
                'Speichern nicht möglich',
                'Es ist kein Petri-Netz zum Speichern vorhanden.',
            );
            return;
        }
        this.triggerDownload(textContent, this.FILE_NAME);
    }

    private triggerDownload(content: string, fileName: string): void {
        const blob = new Blob([content], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;

        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
}
