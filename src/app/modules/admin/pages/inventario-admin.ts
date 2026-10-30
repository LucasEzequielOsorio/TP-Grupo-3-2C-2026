import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  AdminProductosService,
  AlertaStock,
  Historial,
  Opcion,
} from '../../../api/services/admin-productos.service';
import { AdminNav } from './admin-nav';

@Component({
  selector: 'app-inventario-admin',
  imports: [AdminNav, FormsModule, RouterLink, DatePipe],
  templateUrl: './inventario-admin.html',
  styleUrl: './tools.css',
})
export class InventarioAdmin implements OnInit, OnDestroy {
  private api = inject(AdminProductosService);
  private route = inject(ActivatedRoute);
  private request?: Subscription;
  modo = this.route.snapshot.data['modo'] as string;
  alertas = signal<AlertaStock[]>([]);
  historial = signal<Historial>({ items: [], total: 0, pagina: 1, paginas: 1 });
  ubicaciones = signal<Opcion[]>([]);
  cargando = signal(false);
  error = signal('');
  ubicacion = 0;
  buscar = '';
  motivo = '';
  productoId = this.route.snapshot.queryParamMap.get('producto_id') || '';
  ngOnInit() {
    this.api
      .catalogos()
      .subscribe({
        next: (c) => this.ubicaciones.set(c.ubicaciones),
        error: () => this.error.set('No se pudieron cargar las ubicaciones.'),
      });
    this.cargar();
  }
  cargar(pagina = 1) {
    this.request?.unsubscribe();
    this.cargando.set(true);
    this.error.set('');
    const fail = (e: any) => {
      this.cargando.set(false);
      this.error.set(
        e.error?.mensaje || 'No se pudo consultar el inventario. Comprobá la conexión.',
      );
    };
    if (this.modo === 'alertas')
      this.request = this.api.alertas(this.ubicacion || undefined).subscribe({
        next: (a) => {
          this.alertas.set(a);
          this.cargando.set(false);
        },
        error: fail,
      });
    else {
      const params: Record<string, string | number> = { pagina, buscar: this.buscar };
      if (this.ubicacion) params['ubicacion_id'] = this.ubicacion;
      if (this.motivo) params['motivo'] = this.motivo;
      if (this.productoId) params['producto_id'] = this.productoId;
      this.request = this.api.movimientos(params).subscribe({
        next: (h) => {
          this.historial.set(h);
          this.cargando.set(false);
        },
        error: fail,
      });
    }
  }
  limpiarProducto() {
    this.productoId = '';
    this.cargar();
  }
  ngOnDestroy() {
    this.request?.unsubscribe();
  }
}
