import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Aviso } from './core/components/aviso/aviso';

@Component({
  imports: [RouterOutlet, Aviso],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('TP-Grupo-3-2C-2026');
}
