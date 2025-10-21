import { Component } from '@angular/core';
import {MatTabChangeEvent, MatTabsModule} from '@angular/material/tabs';
import {MatIconModule} from '@angular/material/icon';
import {DrawingStateService} from "../../services/drawing.state.service";
import {DrawComponent} from "../tab-toolbar/draw/draw.component";
import {PlayComponent} from "../tab-toolbar/play/play.component";
import {ReachabilityGraphComponent} from "../tab-toolbar/reachability-graph/reachability-graph.component";
import {ProcessNetComponent} from "../tab-toolbar/process-net/process-net.component";
import {Tab} from "../../classes/tabs";

@Component({
  selector: 'app-main-tab',
  standalone: true,
    imports: [
        MatTabsModule,
        MatIconModule,
        DrawComponent,
        PlayComponent,
        ReachabilityGraphComponent,
        ProcessNetComponent
    ],
  templateUrl: './main-tab.component.html',
  styleUrl: './main-tab.component.css'
})
export class MainTabComponent {

    constructor(private drawingStateService: DrawingStateService) {}

    onTabChange(event: MatTabChangeEvent) {
        this.drawingStateService.set(event.index == Tab.DRAW)
    }
}
