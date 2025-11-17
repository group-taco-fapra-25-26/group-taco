import { inject, Injectable } from '@angular/core';
import { SourcePetriNetService } from './source-petri-net.service';
import { ToasterNotificationService } from './toaster-notification.service';

@Injectable({ providedIn: 'root' })
export class PetriNetSavingService {
    private _sourcePetriNetService = inject(SourcePetriNetService);
    private _notificationService = inject(ToasterNotificationService);

    private readonly FILE_NAME = 'petri-net.json';

    /**
     * Saves the current Petri net by triggering a download of the source text as a JSON file.
     * If no Petri net is present, a warning notification is shown.
     */
    public savePetriNet(): void {
        const textContent = this._sourcePetriNetService.getSourceText();

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
