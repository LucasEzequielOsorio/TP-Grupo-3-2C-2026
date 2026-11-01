import { Component, inject, signal, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import {
  TiendaService,
  CarritoRespuesta,
  LineaCarrito,
} from '../../../../api/services/tienda.service';
import { TiendaNav } from '../../components/tienda-nav';
import { Observable } from 'rxjs';
@Component({
  imports: [CurrencyPipe, RouterLink, TiendaNav],
  selector: 'app-carrito',
  styleUrls: ['../tienda.css', './carrito.css'],
  templateUrl: './carrito.html',
})
export class Carrito {
  private tienda = inject(TiendaService);
  private router = inject(Router);
  carrito = signal<CarritoRespuesta>({ items: [], total: 0, unidades: 0 });
  cargando = signal(true);
  ocupado = signal(false);
  error = signal('');
  direccion = signal('');
  revisando = signal(false);
  private clave = crypto.randomUUID();
  abrirConfirmacion() {
    this.error.set('');
    this.ocupado.set(true);
    this.tienda.getEntrega().subscribe({
      next: (r) => {
        this.direccion.set(r.direccion);
        this.revisando.set(true);
        this.ocupado.set(false);
      },
      error: () => {
        this.error.set('No pudimos obtener la dirección de entrega. Intentá nuevamente.');
        this.ocupado.set(false);
      },
    });
  }
  confirmar() {
    if (this.ocupado() || !this.revisando()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.tienda.confirmarPedido(this.clave, this.carrito().items).subscribe({
      next: (pedido) => {
        this.ocupado.set(false);
        this.router.navigate(['/tienda/pedidos', pedido.id]);
      },
      error: (e) => {
        this.ocupado.set(false);
        this.revisando.set(false);
        this.error.set(
          e.error?.mensaje || 'No pudimos confirmar el pedido. Podés reintentar sin duplicarlo.',
        );
        if (e.status === 401)
          this.router.navigate(['/bienvenido/login'], {
            queryParams: { returnUrl: '/tienda/carrito' },
          });
      },
    });
  }
  cambiosStock = computed(() =>
    this.carrito().items.some((i) => !i.activo || i.cantidad > i.stock),
  );
  constructor() {
    this.cargar();
  }
  cargar() {
    this.cargando.set(true);
    this.ejecutar(this.tienda.getCarrito());
  }
  private ejecutar(request: Observable<CarritoRespuesta>) {
    this.revisando.set(false);
    this.ocupado.set(true);
    this.error.set('');
    request.subscribe({
      next: (res) => {
        this.carrito.set(res);
        this.cargando.set(false);
        this.ocupado.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.ocupado.set(false);
        this.error.set(e.error?.mensaje || 'No pudimos actualizar tu pedido. Intentá de nuevo.');
        if (e.status === 401)
          this.router.navigate(['/bienvenido/login'], {
            queryParams: { returnUrl: '/tienda/carrito' },
          });
      },
    });
  }
  cambiar(item: LineaCarrito, event: Event) {
    const input = event.target as HTMLInputElement;
    const cantidad = Number(input.value);
    input.value = String(item.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > Math.min(999, item.stock)) {
      this.error.set('La cantidad debe ser un entero entre 1 y el stock disponible.');
      return;
    }
    this.ejecutar(this.tienda.actualizarCantidad(item.variante_id, cantidad));
  }
  eliminar(item: LineaCarrito) {
    this.ejecutar(this.tienda.eliminarDelCarrito(item.variante_id));
  }
  revisar() {
    this.ejecutar(this.tienda.getCarrito());
  }
}
