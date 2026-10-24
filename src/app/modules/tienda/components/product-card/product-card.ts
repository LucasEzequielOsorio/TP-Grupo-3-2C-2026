import { Component, input, output, signal } from '@angular/core';
import { DatosProducto } from '../../interfaces/datos-producto';
import { CurrencyPipe } from '@angular/common';
import { AgregarAlCarritoButton } from '../agregar-al-carrito-button/agregar-al-carrito-button';

@Component({
  imports: [CurrencyPipe, AgregarAlCarritoButton],
  selector: 'app-product-card',
  styleUrl: './product-card.css',
  templateUrl: './product-card.html',
})
export class ProductCard {
  producto = input<DatosProducto>();
  carritoEvent = output();
  productoEvent = output();
  waitingForCarritoEvent = signal<boolean>(false);
  agregarAlCarrito()
  {
    this.carritoEvent.emit();
    this.waitingForCarritoEvent.set(true);
  }
  verProducto()
  {
    this.productoEvent.emit();
  }
  finalizarCarritoEvent()
  {
    this.waitingForCarritoEvent.set(false);
  }
}
