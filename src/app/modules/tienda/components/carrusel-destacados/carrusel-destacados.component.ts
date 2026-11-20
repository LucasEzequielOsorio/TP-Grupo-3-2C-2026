import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TiendaService } from '../../../../api/services/tienda.service';
import { DatosProducto as Producto } from '../../interfaces/datos-producto';

@Component({
  selector: 'app-carrusel-destacados',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './carrusel-destacados.component.html',
  styleUrl: './carrusel-destacados.component.css',
})
export class CarruselDestacados implements OnInit {
  productos = signal<Producto[]>([]);
  indiceActual = signal(0);
  cargando = signal(true);
  error = signal('');
  imagenFallida = signal<number | null>(null);
  productoActual = computed(() => this.productos()[this.indiceActual()]);

  private tiendaService = inject(TiendaService);
  private router = inject(Router);
  private temporizador?: ReturnType<typeof setInterval>;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.temporizador !== undefined) clearInterval(this.temporizador);
    });
  }

  ngOnInit(): void {
    this.tiendaService
      .getProductos({
        pagina: 1,
        buscar: '',
        categoria: '',
        orden: 'nombre',
        solo_stock: 'true',
      })
      .subscribe({
        next: ({ items }) => {
          this.productos.set(items);
          this.cargando.set(false);
          if (items.length > 1) {
            this.temporizador = setInterval(() => this.siguiente(), 4000);
          }
        },
        error: () => {
          this.error.set('No pudimos cargar los productos destacados.');
          this.cargando.set(false);
        },
      });
  }

  siguiente(): void {
    this.mover(1);
  }

  anterior(): void {
    this.mover(-1);
  }

  irAlDetalle(id: number): void {
    void this.router.navigate(['/tienda/producto', id]);
  }

  private mover(direccion: number): void {
    const cantidad = this.productos().length;
    if (cantidad < 2) return;
    this.indiceActual.update((indice) => (indice + direccion + cantidad) % cantidad);
  }
}
