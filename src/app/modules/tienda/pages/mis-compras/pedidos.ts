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
        else if (result) this.detalle.set(result);
        this.cargando.set(false);
      });
  }
}
