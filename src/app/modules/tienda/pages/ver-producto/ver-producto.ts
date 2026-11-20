import { Component, numberAttribute, input, effect, inject, signal, computed } from '@angular/core';
import { DatosProducto } from '../../interfaces/datos-producto';
import { TiendaService } from '../../../../api/services/tienda.service';
import { CurrencyPipe } from '@angular/common';
import { TiendaNav } from '../../components/tienda-nav';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UsuarioService } from '../../../../api/services/usuario.service';
import { VarianteTienda } from '../../interfaces/datos-producto';
import { AvisoService } from '../../../../core/services/aviso.service';

@Component({
  imports: [CurrencyPipe, TiendaNav, RouterLink, FormsModule],
  selector: 'app-ver-producto',
  styleUrl: '../tienda.css',
  templateUrl: './ver-producto.html',
})
export class VerProducto {
  tiendaService = inject(TiendaService);
  private avisos = inject(AvisoService);
  auth = inject(UsuarioService);
  router = inject(Router);
  cantidad = signal(1);
  errorCarrito = signal('');
  esFavorito = signal(false);
  cargandoFavorito = signal(false);
  guardandoFavorito = signal(false);
  errorFavorito = signal('');
  id = input<number, string | number | undefined>(undefined, { transform: numberAttribute });
  producto = signal<DatosProducto>({ id: -1, nombre: '', descripcion: '', precio: 0, stock: -1 });
  waitingForCarritoEvent = signal<boolean>(false);
  imagenSeleccionada = signal('');
  imagenError = signal(false);
  cargando = signal(true);
  error = signal('');
  colorSeleccionado = signal(0);
  fotosVisibles = computed(() => {
    const p = this.producto();
    const fotos =
      p.fotos ??
      (p.imagenes || (p.imagen_url ? [p.imagen_url] : [])).map((url) => ({ url, color_id: null }));
    return [
      ...fotos.filter((f) => f.color_id === this.colorSeleccionado()),
      ...fotos.filter((f) => f.color_id === null),
    ].map((f) => f.url);
  });
  talleSeleccionado = signal(0);
  colores = computed(() => [
    ...new Map(
      (this.producto().variantes || []).map(
        (v) =>
          [v.color_id, { id: v.color_id, nombre: v.color, hexadecimal: v.hexadecimal }] as const,
      ),
    ).values(),
  ]);
  talles = computed(() =>
    (this.producto().variantes || []).filter((v) => v.color_id === this.colorSeleccionado()),
  );
  variante = computed(() => this.talles().find((v) => v.talle_id === this.talleSeleccionado()));
  stockVariante = computed(() => this.unidades(this.variante()));
  unidades(v: VarianteTienda | undefined) {
    return v?.existencias.reduce((sum, e) => sum + e.cantidad, 0) || 0;
  }
  elegirColor(id: number) {
    this.errorCarrito.set('');
    this.cantidad.set(1);
    this.colorSeleccionado.set(id);
    this.elegirFoto(this.fotosVisibles()[0] || '');
    const variantes = this.talles();
    this.talleSeleccionado.set(
      (variantes.find((v) => this.unidades(v) > 0) || variantes[0])?.talle_id || 0,
    );
  }
  elegirFoto(foto: string) {
    this.imagenSeleccionada.set(foto);
    this.imagenError.set(false);
  }
  constructor() {
    effect((onCleanup) => {
      const productoId = this.id();
      this.cargando.set(true);
      this.error.set('');
      if (productoId === undefined || !Number.isInteger(productoId) || productoId <= 0) {
        this.cargando.set(false);
        this.error.set('La prenda que buscás no está disponible.');
        return;
      }
      const subscription = this.tiendaService.getProducto(productoId).subscribe({
        next: (res: DatosProducto) => {
          this.producto.set(res);
          this.elegirFoto(res.imagenes?.[0] || res.imagen_url || '');
          const variantes = res.variantes || [];
          this.elegirColor(
            (variantes.find((v) => this.unidades(v) > 0) || variantes[0])?.color_id || 0,
          );
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.error.set('No pudimos encontrar esta prenda. Puede que ya no esté disponible.');
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
    effect((onCleanup) => {
      const autenticada = this.auth.sesionActiva();
      const productoId = this.producto().id;
      if (!autenticada || productoId <= 0) {
        this.esFavorito.set(false);
        this.cargandoFavorito.set(false);
        this.guardandoFavorito.set(false);
        return;
      }

      this.cargandoFavorito.set(true);
      this.errorFavorito.set('');
      const solicitud = this.tiendaService.obtenerFavoritos().subscribe({
        next: (favoritos) => {
          this.esFavorito.set(favoritos.some((producto) => producto.id === productoId));
          this.cargandoFavorito.set(false);
        },
        error: (error) => {
          this.cargandoFavorito.set(false);
          this.esFavorito.set(false);
          if (error.status === 401) {
            this.irAlLogin();
            return;
          }
          this.errorFavorito.set(
            error.error?.mensaje || 'No pudimos consultar tus favoritos. Intentá de nuevo.',
          );
        },
      });
      onCleanup(() => solicitud.unsubscribe());
    });
  }
  disponible = computed(() => {
    return this.producto() && this.producto()!.stock > 0;
  });

  agregarAlCarrito() {
    if (!this.auth.isLogged()) {
      this.router.navigate(['/bienvenido/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const v = this.variante();
    if (!v || this.waitingForCarritoEvent()) return;
    this.errorCarrito.set('');
    if (
      !Number.isInteger(this.cantidad()) ||
      this.cantidad() < 1 ||
      this.cantidad() > Math.min(999, this.stockVariante())
    ) {
      this.errorCarrito.set('Elegí una cantidad válida dentro del stock disponible.');
      return;
    }
    this.waitingForCarritoEvent.set(true);
    this.tiendaService.agregarAlCarrito(v.id, this.cantidad()).subscribe({
      next: () => {
        this.waitingForCarritoEvent.set(false);
        this.avisos.mostrar('La prenda se agregó a tu carrito.');
      },
      error: (e) => {
        this.waitingForCarritoEvent.set(false);
        if (e.status === 401)
          this.router.navigate(['/bienvenido/login'], {
            queryParams: { returnUrl: this.router.url },
          });
        this.errorCarrito.set(
          e.error?.mensaje || 'No pudimos agregar la prenda. Intentá de nuevo.',
        );
      },
    });
  }
  cambiarFavorito() {
    if (!this.auth.isLogged()) {
      this.irAlLogin();
      return;
    }
    if (this.guardandoFavorito() || this.cargandoFavorito()) return;
    this.guardandoFavorito.set(true);
    this.errorFavorito.set('');
    const solicitud = this.esFavorito()
      ? this.tiendaService.eliminarFavorito(this.producto().id)
      : this.tiendaService.agregarFavorito(this.producto().id);
    solicitud.subscribe({
      next: (respuesta) => {
        if (!this.auth.sesionActiva()) {
          this.esFavorito.set(false);
          this.guardandoFavorito.set(false);
          return;
        }
        this.esFavorito.set(respuesta.favorito);
        this.guardandoFavorito.set(false);
        this.avisos.mostrar(
          respuesta.favorito ? 'Agregaste la prenda a tus favoritos.' : 'Quitaste la prenda de favoritos.',
        );
      },
      error: (error) => {
        this.guardandoFavorito.set(false);
        if (error.status === 401) {
          this.irAlLogin();
          return;
        }
        this.errorFavorito.set(
          error.error?.mensaje || 'No pudimos actualizar tus favoritos. Intentá de nuevo.',
        );
      },
    });
  }
  private irAlLogin() {
    this.router.navigate(['/bienvenido/login'], { queryParams: { returnUrl: this.router.url } });
  }
}
