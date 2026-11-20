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
  favorito = input(false);
  favoritoDeshabilitado = input(false);
  favoritoCambiado = output<number>();
  carritoEvent = output();
  productoEvent = output();
  waitingForCarritoEvent = signal<boolean>(false);
  cambiarFavorito(productoId: number) {
    if (!this.favoritoDeshabilitado()) this.favoritoCambiado.emit(productoId);
  }
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
