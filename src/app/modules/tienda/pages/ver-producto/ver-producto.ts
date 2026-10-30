import {
  Component,
  numberAttribute,
  OnInit,
  input,
  effect,
  inject,
  signal,
  computed,
} from '@angular/core';
import { DatosProducto } from '../../interfaces/datos-producto';
import { TiendaService } from '../../../../api/services/tienda.service';
import { CurrencyPipe } from '@angular/common';
import { AgregarAlCarritoButton } from '../../components/agregar-al-carrito-button/agregar-al-carrito-button';
import { TiendaNav } from '../../components/tienda-nav';
import { RouterLink } from '@angular/router';
import { VarianteTienda } from '../../interfaces/datos-producto';

@Component({
  imports: [CurrencyPipe, TiendaNav, RouterLink],
  selector: 'app-ver-producto',
  styleUrl: '../tienda.css',
  templateUrl: './ver-producto.html',
})
export class VerProducto {
  tiendaService = inject(TiendaService);
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
  }
  disponible = computed(() => {
    return this.producto() && this.producto()!.stock > 0;
  });

  agregarAlCarrito() {
    this.tiendaService.agregarAlCarrito(this.producto().id);
  }
}
