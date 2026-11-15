import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { AdminNav } from './admin-nav';
import { TiendaService } from '../../../api/services/tienda.service';
@Component({
  selector: 'app-pagos-admin',
  imports: [AdminNav, CurrencyPipe],
  template:
    '<app-admin-nav/><main class="shop-main"><span class="eyebrow">ADMINISTRACIÓN</span><h1>Pagos a revisar</h1><p>Pagos duplicados, reembolsados o recibidos después de liberar stock. Revisalos en Mercado Pago antes de preparar el envío.</p><button class="shop-button" (click)="cargar()" [disabled]="cargando()">Actualizar</button>@if(error()){<p role="alert">{{error()}}</p>}@for(p of items();track p.id){<article class="cart-item"><div class="cart-description"><h2>Pedido #{{p.id}}</h2><p>{{p.email}}</p><p>{{p.pago_estado}}</p></div><strong>{{p.total | currency:"ARS":"symbol":"1.2-2"}}</strong></article>}@empty{<div class="shop-empty">{{cargando() ? "Consultando pagos…" : "No hay pagos que requieran revisión."}}</div>}</main>',
  styleUrls: ['../../tienda/pages/tienda.css', '../../tienda/pages/carrito/carrito.css'],
})
export class PagosAdmin {
  private api = inject(TiendaService);
  items = signal<{ id: number; email: string; pago_estado: string; total: number }[]>([]);
  error = signal('');
  cargando = signal(false);
  constructor() {
    this.cargar();
  }
  cargar() {
    this.cargando.set(true);
    this.error.set('');
    this.api.pagosRevision().subscribe({
      next: (r) => {
        this.items.set(r);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos consultar los pagos.');
        this.cargando.set(false);
      },
    });
  }
}
