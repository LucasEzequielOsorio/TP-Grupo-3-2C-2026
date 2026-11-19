import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatosProducto } from '../../interfaces/datos-producto';
import { TiendaService } from '../../../../api/services/tienda.service';
import { TiendaNav } from '../../components/tienda-nav';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  imports: [RouterLink, TiendaNav, ProductCard],
  selector: 'app-favoritos',
  styleUrl: '../tienda.css',
  templateUrl: './favoritos.html',
})
export class Favoritos {
  private tienda = inject(TiendaService);
  private router = inject(Router);
  productos = signal<DatosProducto[]>([]);
  productosEnProceso = signal<Set<number>>(new Set());
  cargando = signal(true);
  error = signal('');

  constructor() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.error.set('');
    this.tienda.obtenerFavoritos().subscribe({
      next: (productos) => {
        this.productos.set(productos);
        this.cargando.set(false);
      },
      error: (error) => {
        this.cargando.set(false);
        if (error.status === 401) {
          this.irAlLogin();
          return;
        }
        this.error.set(error.error?.mensaje || 'No pudimos cargar tus favoritos. Intentá de nuevo.');
      },
    });
  }

  quitarFavorito(productoId: number) {
    if (this.productosEnProceso().has(productoId)) return;
    this.error.set('');
    this.productosEnProceso.update((ids) => new Set(ids).add(productoId));
    this.tienda.eliminarFavorito(productoId).subscribe({
      next: () => {
        this.productos.update((productos) => productos.filter((producto) => producto.id !== productoId));
        this.liberarProducto(productoId);
      },
      error: (error) => {
        this.liberarProducto(productoId);
        if (error.status === 401) {
          this.irAlLogin();
          return;
        }
        this.error.set(error.error?.mensaje || 'No pudimos quitar el favorito. Intentá de nuevo.');
      },
    });
  }

  verProducto(productoId: number) {
    this.router.navigate(['/tienda/producto', productoId]);
  }

  private liberarProducto(productoId: number) {
    this.productosEnProceso.update((ids) => {
      const actualizados = new Set(ids);
      actualizados.delete(productoId);
      return actualizados;
    });
  }

  private irAlLogin() {
    this.router.navigate(['/bienvenido/login'], { queryParams: { returnUrl: this.router.url } });
  }
}
