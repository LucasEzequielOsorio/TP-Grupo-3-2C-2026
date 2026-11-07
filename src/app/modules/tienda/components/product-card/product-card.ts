import { Component, input, output, signal } from '@angular/core';
import { DatosProducto } from '../../interfaces/datos-producto';
import { CurrencyPipe } from '@angular/common';

@Component({
  imports: [CurrencyPipe],
  selector: 'app-product-card',
  styleUrl: './product-card.css',
  templateUrl: './product-card.html',
})
export class ProductCard {
  imagenError = signal(false);
  producto = input<DatosProducto>();
  carritoEvent = output();
  productoEvent = output();
  waitingForCarritoEvent = signal<boolean>(false);
  agregarAlCarrito() {
    this.carritoEvent.emit();
    this.waitingForCarritoEvent.set(true);
  }
  verProducto() {
    this.productoEvent.emit();
  }
  finalizarCarritoEvent() {
    this.waitingForCarritoEvent.set(false);
  }
}
