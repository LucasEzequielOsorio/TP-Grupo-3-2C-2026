import { Component, input, output } from '@angular/core';
import { DatosProducto } from '../../interfaces/datos-producto';
import { CurrencyPipe } from '@angular/common';

@Component({
  imports: [CurrencyPipe],
  selector: 'app-product-card',
  styleUrl: './product-card.css',
  templateUrl: './product-card.html',
})
export class ProductCard {
  producto = input<DatosProducto>();
  carritoEvent = output();
  productoEvent = output();
  agregarAlCarrito()
  {
    this.carritoEvent.emit();
  }
  verProducto()
  {
    this.productoEvent.emit();
  }
}
