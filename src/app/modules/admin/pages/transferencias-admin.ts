import { Component, HostListener, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  InventarioService,
  Ubicacion,
  StockUbicacion,
  BorradorTransferencia,
  Transferencia,
  ListaTransferencias,
} from '../../../api/services/inventario.service';
import { AdminNav } from './admin-nav';
@Component({
  selector: 'app-transferencias-admin',
  imports: [AdminNav, FormsModule, DatePipe, RouterLink],
  templateUrl: './transferencias-admin.html',
  styleUrl: './tools.css',
})
export class TransferenciasAdmin implements OnInit, OnDestroy {
  private api = inject(InventarioService);
  private stockRequest?: Subscription;
  private listRequest?: Subscription;
  ubicaciones = signal<Ubicacion[]>([]);
  stock = signal<StockUbicacion[]>([]);
  lista = signal<ListaTransferencias>({ items: [], pagina: 1, paginas: 1, total: 0 });
  detalle = signal<Transferencia | null>(null);
  cargando = signal(false);
  cargandoStock = signal(false);
  procesando = signal(false);
  creando = signal(false);
  error = signal('');
  mensaje = signal('');
  estado = '';
  buscar = '';
  borrador: BorradorTransferencia = { origen_id: 0, destino_id: 0, items: [] };
  private original = '';
  tieneCambios() {
    return this.creando() && JSON.stringify(this.borrador) !== this.original;
  }
  enProceso() {
    return this.procesando();
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(e: BeforeUnloadEvent) {
    if (this.tieneCambios() || this.enProceso()) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
  ngOnInit() {
    this.api
      .ubicaciones()
      .subscribe({
        next: (rows) => this.ubicaciones.set(rows.filter((u) => u.activo)),
        error: (e) => this.error.set(e.error?.mensaje || 'No se pudieron cargar las ubicaciones'),
      });
    this.cargar();
  }
  cargar(pagina = 1) {
    this.listRequest?.unsubscribe();
    this.cargando.set(true);
    this.listRequest = this.api.transferencias(pagina, this.estado).subscribe({
      next: (rows) => {
        this.lista.set(rows);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(e.error?.mensaje || 'No se pudieron cargar las transferencias');
      },
    });
  }
  nueva() {
    if (this.procesando() || !this.permitir()) return;
    this.borrador = { origen_id: 0, destino_id: 0, items: [] };
    this.original = JSON.stringify(this.borrador);
    this.stock.set([]);
    this.creando.set(true);
    this.detalle.set(null);
    this.error.set('');
    this.mensaje.set('');
  }
  cancelarFormulario() {
    if (this.procesando() || !this.permitir()) return;
    this.stockRequest?.unsubscribe();
    this.cargandoStock.set(false);
    this.creando.set(false);
    this.error.set('');
  }
  private permitir() {
    return (
      !this.tieneCambios() || window.confirm('Tenés cambios sin guardar. ¿Querés descartarlos?')
    );
  }
  cambiarOrigen() {
    this.borrador.items = [];
    this.stock.set([]);
    this.buscar = '';
    if (this.borrador.destino_id === this.borrador.origen_id) this.borrador.destino_id = 0;
    this.stockRequest?.unsubscribe();
    this.error.set('');
    if (!this.borrador.origen_id) {
      this.cargandoStock.set(false);
      return;
    }
    this.cargandoStock.set(true);
    this.stockRequest = this.api.stock(this.borrador.origen_id).subscribe({
      next: (rows) => {
        this.stock.set(rows);
        this.cargandoStock.set(false);
      },
      error: (e) => {
        this.cargandoStock.set(false);
        this.error.set(e.error?.mensaje || 'No se pudo consultar el stock del origen');
      },
    });
  }
  disponibles() {
    const q = this.buscar.trim().toLocaleLowerCase();
    return this.stock().filter((s) =>
      `${s.producto} ${s.sku} ${s.talle} ${s.color}`.toLocaleLowerCase().includes(q),
    );
  }
  item(id: number) {
    return this.borrador.items.find((i) => i.variante_id === id);
  }
  marcar(id: number, checked: boolean) {
    if (checked) {
      if (!this.item(id)) this.borrador.items.push({ variante_id: id, cantidad: 1 });
    } else this.borrador.items = this.borrador.items.filter((i) => i.variante_id !== id);
  }
  cantidad(id: number, value: number) {
    const item = this.item(id);
    if (item) item.cantidad = value;
  }
  total() {
    return this.borrador.items.reduce((sum, i) => sum + (Number(i.cantidad) || 0), 0);
  }
  guardar() {
    if (this.procesando()) return;
    this.error.set('');
    if (!this.borrador.items.length) {
      this.error.set('Seleccioná al menos una variante.');
      return;
    }
    if (
      !this.borrador.origen_id ||
      !this.borrador.destino_id ||
      this.borrador.origen_id === this.borrador.destino_id
    ) {
      this.error.set('Elegí un origen y un destino distintos.');
      return;
    }
    if (
      this.borrador.items.some(
        (i) =>
          !Number.isInteger(i.cantidad) ||
          i.cantidad < 1 ||
          i.cantidad > (this.stock().find((s) => s.variante_id === i.variante_id)?.cantidad || 0),
      )
    ) {
      this.error.set(
        'Revisá las cantidades: deben ser enteros positivos y no superar el stock del origen.',
      );
      return;
    }
    this.procesando.set(true);
    this.api.crear(this.borrador).subscribe({
      next: (t) => {
        this.procesando.set(false);
        this.creando.set(false);
        this.detalle.set(t);
        this.mensaje.set(
          `Transferencia #${t.id} creada como borrador. El stock todavía no cambió.`,
        );
        this.cargar();
      },
      error: (e) => {
        this.procesando.set(false);
        this.error.set(e.error?.mensaje || 'No se pudo crear la transferencia');
      },
    });
  }
  ver(id: number) {
    if (this.procesando()) return;
    this.error.set('');
    this.procesando.set(true);
    this.api.transferencia(id).subscribe({
      next: (t) => {
        this.detalle.set(t);
        this.procesando.set(false);
      },
      error: (e) => {
        this.procesando.set(false);
        this.error.set(e.error?.mensaje || 'No se pudo cargar el detalle');
      },
    });
  }
  accion(t: Transferencia, accion: 'despachar' | 'recibir' | 'cancelar') {
    if (this.procesando()) return;
    const text =
      accion === 'despachar'
        ? `¿Despachar ${t.unidades} unidades desde ${t.origen}? Se descontarán del origen y quedarán en tránsito.`
        : accion === 'recibir'
          ? `¿Confirmar la recepción de ${t.unidades} unidades en ${t.destino}? Se sumarán al destino.`
          : `¿Cancelar el borrador #${t.id}? No se modificará el stock.`;
    if (!window.confirm(text)) return;
    this.procesando.set(true);
    this.error.set('');
    this.mensaje.set('');
    this.api.accion(t.id, accion).subscribe({
      next: (result) => {
        this.detalle.set(result);
        this.procesando.set(false);
        this.mensaje.set(
          accion === 'despachar'
            ? 'Despacho registrado. La mercadería está en tránsito.'
            : accion === 'recibir'
              ? 'Recepción registrada. El stock ya está disponible en el destino.'
              : 'Borrador cancelado.',
        );
        this.cargar(this.lista().pagina);
      },
      error: (e) => {
        this.procesando.set(false);
        this.error.set(e.error?.mensaje || 'No se pudo completar la operación');
        this.cargar(this.lista().pagina);
      },
    });
  }
  etiqueta(estado: string) {
    return (
      (
        {
          borrador: 'Borrador',
          en_transito: 'En tránsito',
          recibida: 'Recibida',
          cancelada: 'Cancelada',
        } as Record<string, string>
      )[estado] || estado
    );
  }
  ngOnDestroy() {
    this.stockRequest?.unsubscribe();
    this.listRequest?.unsubscribe();
  }
}
