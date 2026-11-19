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
import { UsuarioService } from '../../../../api/services/usuario.service';

@Component({
  imports: [ProductCard, CarruselDestacados, FormsModule, TiendaNav, RouterLink],
  selector: 'app-productos',
  styleUrl: '../tienda.css',
  templateUrl: './productos.html',
})
export class Productos implements OnInit {
  tiendaService = inject(TiendaService);
  auth = inject(UsuarioService);
  router = inject(Router);
  productos = signal<DatosProducto[]>([]);
  idsFavoritos = signal<Set<number>>(new Set());
  favoritosEnProceso = signal<Set<number>>(new Set());
  cargandoFavoritos = signal(false);
  errorFavoritos = signal('');
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
    this.cargarFavoritos();
  }
  cargarFavoritos() {
    if (!this.auth.isLogged()) {
      this.idsFavoritos.set(new Set());
      return;
    }
    this.cargandoFavoritos.set(true);
    this.errorFavoritos.set('');
    this.tiendaService.obtenerFavoritos().subscribe({
      next: (productos) => {
        this.idsFavoritos.set(new Set(productos.map((producto) => producto.id)));
        this.cargandoFavoritos.set(false);
      },
      error: (error) => {
        this.cargandoFavoritos.set(false);
        if (error.status === 401) {
          this.router.navigate(['/bienvenido/login'], {
            queryParams: { returnUrl: this.router.url },
          });
          return;
        }
        this.errorFavoritos.set(
          error.error?.mensaje || 'No pudimos cargar tus favoritos. Intentá de nuevo.',
        );
      },
    });
  }
  cambiarFavorito(productoId: number) {
    if (!this.auth.isLogged()) {
      this.router.navigate(['/bienvenido/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    if (this.favoritosEnProceso().has(productoId)) return;

    this.errorFavoritos.set('');
    this.favoritosEnProceso.update((ids) => new Set(ids).add(productoId));
    const solicitud = this.idsFavoritos().has(productoId)
      ? this.tiendaService.eliminarFavorito(productoId)
      : this.tiendaService.agregarFavorito(productoId);
    solicitud.subscribe({
      next: (respuesta) => {
        this.idsFavoritos.update((ids) => {
          const actualizados = new Set(ids);
          if (respuesta.favorito) actualizados.add(productoId);
          else actualizados.delete(productoId);
          return actualizados;
        });
        this.liberarFavorito(productoId);
      },
      error: (error) => {
        this.liberarFavorito(productoId);
        if (error.status === 401) {
          this.router.navigate(['/bienvenido/login'], {
            queryParams: { returnUrl: this.router.url },
          });
          return;
        }
        this.errorFavoritos.set(
          error.error?.mensaje || 'No pudimos actualizar tus favoritos. Intentá de nuevo.',
        );
      },
    });
  }
  private liberarFavorito(productoId: number) {
    this.favoritosEnProceso.update((ids) => {
      const actualizados = new Set(ids);
      actualizados.delete(productoId);
      return actualizados;
    });
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
