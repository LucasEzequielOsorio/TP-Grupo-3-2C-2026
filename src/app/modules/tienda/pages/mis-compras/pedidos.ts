import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, of, catchError, tap, Observable } from 'rxjs';
import { TiendaNav } from '../../components/tienda-nav';
import {
  TiendaService,
  PedidoDetalle,
  PedidoResumen,
} from '../../../../api/services/tienda.service';
@Component({
  selector: 'app-pedidos',
  imports: [TiendaNav, RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './pedidos.html',
  styleUrls: ['../tienda.css', '../carrito/carrito.css'],
})
export class Pedidos {
  private tienda = inject(TiendaService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  pedidos = signal<PedidoResumen[]>([]);
  detalle = signal<PedidoDetalle | null>(null);
  cargando = signal(true);
  error = signal('');
  procesando = signal(false);
  errorPago = signal('');
  private retornoConsultado = false;
  pagoTexto(estado: string | undefined) {
    return (
      (
        {
          pendiente: 'Pendiente de pago',
          aprobado: 'Pago aprobado',
          rechazado: 'Pago rechazado · podés reintentar',
          cancelado: 'Pago cancelado',
          vencido: 'Reserva vencida',
          revision: 'Pago en revisión · contactá a la tienda',
          sin_pago: 'Sin pago online registrado',
        } as Record<string, string>
      )[estado || 'sin_pago'] || 'Verificando pago'
    );
  }
  vigente() {
    const p = this.detalle();
    return (
      p?.estado === 'pendiente' &&
      p.pago_estado !== 'revision' &&
      !!p.reserva_hasta &&
      new Date(p.reserva_hasta).getTime() > Date.now()
    );
  }
  pagar() {
    const p = this.detalle();
    if (!p || this.procesando() || !this.vigente()) return;
    this.procesando.set(true);
    this.errorPago.set('');
    this.tienda.iniciarPago(p.id).subscribe({
      next: (r) => {
        try {
          const u = new URL(r.checkout_url);
          if (
            u.protocol !== 'https:' ||
            ![
              'www.mercadopago.com.ar',
              'sandbox.mercadopago.com.ar',
              'www.mercadopago.com',
              'sandbox.mercadopago.com',
            ].includes(u.hostname)
          )
            throw new Error();
          window.location.assign(u.href);
        } catch {
          this.procesando.set(false);
          this.errorPago.set('No pudimos abrir el medio de pago.');
        }
      },
      error: (e) => {
        this.procesando.set(false);
        this.errorPago.set(e.error?.mensaje || 'No pudimos iniciar el pago.');
      },
    });
  }
  actualizarPago() {
    const p = this.detalle();
    if (!p || this.procesando()) return;
    this.procesando.set(true);
    this.errorPago.set('');
    this.tienda.sincronizarPago(p.id).subscribe({
      next: (r) => {
        this.detalle.set(r);
        this.procesando.set(false);
      },
      error: (e) => {
        this.procesando.set(false);
        this.errorPago.set(e.error?.mensaje || 'No pudimos verificar el pago.');
      },
    });
  }
  cancelar() {
    const p = this.detalle();
    if (
      !p ||
      this.procesando() ||
      !window.confirm('¿Cancelar este pedido y liberar las prendas reservadas?')
    )
      return;
    this.procesando.set(true);
    this.errorPago.set('');
    this.tienda.cancelarPedido(p.id).subscribe({
      next: (r) => {
        this.detalle.set(r);
        this.procesando.set(false);
      },
      error: (e) => {
        this.procesando.set(false);
        this.errorPago.set(e.error?.mensaje || 'No pudimos cancelar el pedido.');
      },
    });
  }
  constructor() {
    this.route.paramMap
      .pipe(
        tap(() => {
          this.cargando.set(true);
          this.error.set('');
          this.detalle.set(null);
        }),
        switchMap((params) => {
          const id = params.get('id');
          const request: Observable<PedidoDetalle | PedidoResumen[]> = id
            ? this.tienda.getPedido(Number(id))
            : this.tienda.getPedidos();
          return request.pipe(
            catchError((e) => {
              this.error.set(e.error?.mensaje || 'No pudimos cargar tus pedidos.');
              if (e.status === 401)
                this.router.navigate(['/bienvenido/login'], {
                  queryParams: { returnUrl: this.router.url },
                });
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (Array.isArray(result)) this.pedidos.set(result);
        else if (result) {
          this.detalle.set(result);
          if (!this.retornoConsultado && this.route.snapshot.queryParamMap.has('payment_id')) {
            this.retornoConsultado = true;
            this.actualizarPago();
          }
        }
        this.cargando.set(false);
      });
  }
}
