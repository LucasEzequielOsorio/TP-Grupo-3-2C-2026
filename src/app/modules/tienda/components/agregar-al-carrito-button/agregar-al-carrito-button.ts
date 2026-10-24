import { Component, input, output, signal } from '@angular/core';
import { DatosProducto } from '../../interfaces/datos-producto';

@Component({
  imports: [],
  selector: 'app-agregar-al-carrito-button',
  styleUrl: './agregar-al-carrito-button.css',
  templateUrl: './agregar-al-carrito-button.html',
})
export class AgregarAlCarritoButton {
  carritoEvent = output();
  producto = input<DatosProducto>();
  waitingForCarritoEvent = input<boolean>();
  agregarAlCarrito()
  {
    this.carritoEvent.emit();
  }
}
