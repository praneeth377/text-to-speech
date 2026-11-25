import { Component } from '@angular/core';
import { HistoryComponent } from './history/history.component';
import { RecorderComponent } from './recorder/recorder.component';

@Component({
  selector: 'app-root',
  imports: [RecorderComponent, HistoryComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {}
