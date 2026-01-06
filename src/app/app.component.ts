import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FooterComponent } from './components/footer/footer.component';
import { MainTabComponent } from './components/main-tab/main-tab.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    imports: [ReactiveFormsModule, FooterComponent, MainTabComponent, TranslateModule],
})
export class AppComponent {}
