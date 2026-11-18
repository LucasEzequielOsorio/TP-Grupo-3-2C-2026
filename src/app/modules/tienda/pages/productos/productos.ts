import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TiendaNav } from '../../components/tienda-nav';
import { DatosProducto } from '../../interfaces/datos-producto';
import { ProductCard } from '../../components/product-card/product-card';
import { CarruselDestacados } from '../../components/carrusel-destacados/carrusel-destacados.component';
import { TiendaService } from '../../../../api/services/tienda.service';
import { Router, RouterLink } from '@angular/router';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';

@Component({
  imports: [ProductCard, CarruselDestacados, FormsModule, TiendaNav, RouterLink],
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
  categorias = signal<string[]>(['Todas']);
  pagina = signal(1);
  paginas = signal(1);
  total = signal(0);
  private request?: Subscription;
  private cambiosBusqueda = new Subject<string>();
  constructor() {
    this.cambiosBusqueda
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => this.cargar(1));
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }
  portada = computed(() => this.productos().find((p) => p.imagen_url));
  // Angular muestra solo la página enviada por el servidor, sin filtrar el listado en memoria.
  visibles = this.productos;
  buscar(value: string) {
    this.busqueda.set(value);
    this.cambiosBusqueda.next(value);
  }
  limpiar() {
    this.busqueda.set('');
    this.categoria.set('Todas');
    this.soloStock.set(false);
    this.orden.set('nombre');
    this.cargar(1);
  }
  irColeccion(event: Event) {
    event.preventDefault();
    document.getElementById('coleccion')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }

  ngOnInit() {
    this.cargar();
  }
  cargar(pagina = 1) {
    // Cancelar la petición anterior impide que una respuesta vieja reemplace filtros recientes.
    this.request?.unsubscribe();
    this.cargando.set(true);
    this.error.set('');
    this.request = this.tiendaService
      .getProductos({
        pagina,
        buscar: this.busqueda(),
        categoria: this.categoria() === 'Todas' ? '' : this.categoria(),
        orden: this.orden(),
        solo_stock: String(this.soloStock()),
      })
      .subscribe({
        next: (res) => {
          this.productos.set(res.items);
          this.total.set(res.total);
          this.pagina.set(res.pagina);
          this.paginas.set(res.paginas);
          this.categorias.set(['Todas', ...res.categorias]);
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
