import { Component } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatTooltip } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-rg-marking-dialog',
  imports: [
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconButton,
        MatIcon,
        MatSliderModule,
        MatExpansionModule,
        MatTooltip,],
  templateUrl: './rg-marking-dialog.component.html',
  styleUrl: './rg-marking-dialog.component.css',
})
export class RgMarkingDialogComponent {



  incrementMarking(){

  }

  decrementMarking(){
  
  }



}
