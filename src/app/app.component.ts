import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ExampleButtonComponent } from './components/example-button/example-button.component';
import { ExampleFileComponent } from './components/example-file/example-file.component';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { FooterComponent } from './components/footer/footer.component';
import { MainTabComponent } from './components/main-tab/main-tab.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SourcePetriNetService } from './services/source-petri-net.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    imports: [
        ExampleButtonComponent,
        ExampleFileComponent,
        MatFormField,
        MatLabel,
        MatInput,
        CdkTextareaAutosize,
        ReactiveFormsModule,
        FooterComponent,
        MainTabComponent,
    ],
})
export class AppComponent {
    public textareaFc: FormControl;
    public buttonClickCount = signal(0);
    private _sourcePetriNetService = inject(SourcePetriNetService);

    constructor() {
        this.textareaFc = new FormControl();
        this.textareaFc.disable();
        this.initializeContent();
    }

    private initializeContent() {
        this._sourcePetriNetService.sourceText$.pipe(takeUntilDestroyed()).subscribe((source) => {
            this.textareaFc.setValue(source);
        });
    }

    public processButtonClick() {
        this.buttonClickCount.set(this.buttonClickCount() + 1);
    }
}
