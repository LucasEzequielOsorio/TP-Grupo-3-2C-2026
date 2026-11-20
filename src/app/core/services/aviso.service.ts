import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AvisoService {
  mensaje = signal('');
  private temporizador?: ReturnType<typeof setTimeout>;

  mostrar(mensaje: string) {
    this.mensaje.set(mensaje);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.cerrar(), 2800);
  }

  cerrar() {
    clearTimeout(this.temporizador);
    this.mensaje.set('');
  }
}
