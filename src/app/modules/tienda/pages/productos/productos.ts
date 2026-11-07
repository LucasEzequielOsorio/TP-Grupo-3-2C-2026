import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TiendaNav } from '../../components/tienda-nav';
import { DatosProducto } from '../../interfaces/datos-producto';
import { ProductCard } from '../../components/product-card/product-card';
import { TiendaService } from '../../../../api/services/tienda.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  imports: [ProductCard, FormsModule, TiendaNav, RouterLink],
  selector: 'app-productos',
  styleUrl: '../tienda.css',
  templateUrl: './productos.html',
})
export class Productos implements OnInit {
  tiendaService = inject(TiendaService);
  router = inject(Router);
  productos = signal<DatosProducto[]>([]);
  cargando = signal(true);
  error = signal('');
  busqueda = signal('');
  categoria = signal('Todas');
  orden = signal('nombre');
  soloStock = signal(false);
  categorias = computed(() => [
    'Todas',
    ...new Set(this.productos().map((p) => p.clasificacion || 'Otros')),
  ]);
  portada = computed(() => this.productos().find((p) => p.imagen_url));
  visibles = computed(() => {
    const q = this.busqueda().trim().toLocaleLowerCase();
    const items = this.productos().filter(
      (p) =>
        (!q ||
          `${p.nombre} ${p.descripcion} ${p.clasificacion || ''}`
            .toLocaleLowerCase()
            .includes(q)) &&
        (this.categoria() === 'Todas' || (p.clasificacion || 'Otros') === this.categoria()) &&
        (!this.soloStock() || p.stock > 0),
    );
    return [...items].sort((a, b) =>
      this.orden() === 'menor'
        ? a.precio - b.precio
        : this.orden() === 'mayor'
          ? b.precio - a.precio
          : a.nombre.localeCompare(b.nombre, 'es'),
    );
  });
  limpiar() {
    this.busqueda.set('');
    this.categoria.set('Todas');
    this.soloStock.set(false);
    this.orden.set('nombre');
  }
  irColeccion(event: Event) {
    event.preventDefault();
    document
      .getElementById('coleccion')
      ?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
  }

  ngOnInit() {
    this.cargar();
  }
  cargar() {
    this.cargando.set(true);
    this.error.set('');
    this.tiendaService.getProductos().subscribe({
      next: (res: DatosProducto[]) => {
        this.productos.set(res);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No pudimos cargar la colección. Intentá de nuevo en unos minutos.');
      },
    });
  }

  VerProducto(id: number) {
    this.router.navigate(['tienda/producto/' + id]);
  }
}
