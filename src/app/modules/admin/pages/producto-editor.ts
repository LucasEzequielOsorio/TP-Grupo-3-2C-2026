import { Component, inject, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, from, of, switchMap, tap, concatMap, toArray } from 'rxjs';
import {
  AdminProductosService,
  Catalogos,
  ProductoAdmin,
  Variante,
} from '../../../api/services/admin-productos.service';
import { UsuarioService } from '../../../api/services/usuario.service';

@Component({
  selector: 'app-producto-editor',
  imports: [FormsModule, RouterLink],
  templateUrl: './producto-editor.html',
  styleUrl: './admin.css',
})
export class ProductoEditor implements OnInit, OnDestroy {
  private api = inject(AdminProductosService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(UsuarioService);
  catalogos = signal<Catalogos>({ categorias: [], talles: [], colores: [], ubicaciones: [] });
  cargando = signal(true);
  guardando = signal(false);
  error = signal('');
  guardado = signal(false);
  fotos: { clave: string; url: string; archivo?: File }[] = [];
  private original = '';
  private cargado = false;
  imagenError = signal('');
  motivoAjuste = '';
  observacionAjuste = '';
  private stockOriginal = new Map<string, number>();
  cambiosStock() {
    if (!this.producto.id) return [];
    return this.producto.variantes
      .flatMap((v) =>
        v.existencias
          .filter((e) => this.ubicacionActiva(e.ubicacion_id))
          .map((e) => ({
            variante: v.sku || 'Nueva variante',
            ubicacion: this.ubicacion(e.ubicacion_id),
            antes: this.stockOriginal.get(`${v.id}:${e.ubicacion_id}`) || 0,
            despues: Number(e.cantidad),
          })),
      )
      .filter((e) => e.antes !== e.despues);
  }
  tieneCambios() {
    return this.cargado && this.snapshot() !== this.original;
  }
  enProceso() {
    return this.guardando();
  }
  private snapshot() {
    return JSON.stringify({
      producto: this.producto,
      fotos: this.fotos.map((f) => [f.clave, f.url]),
      ajuste: this.cambiosStock().length ? [this.motivoAjuste, this.observacionAjuste] : null,
    });
  }
  private aceptarCambios() {
    this.stockOriginal = new Map(
      this.producto.variantes.flatMap((v) =>
        v.existencias.map((e) => [`${v.id}:${e.ubicacion_id}`, e.cantidad] as [string, number]),
      ),
    );
    this.motivoAjuste = '';
    this.observacionAjuste = '';
    this.original = this.snapshot();
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(e: BeforeUnloadEvent) {
    if (this.tieneCambios() || this.enProceso()) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
  seleccionarImagen(event: Event) {
    const input = event.target as HTMLInputElement;
    const archivos = Array.from(input.files || []);
    if (!archivos.length) return;
    this.imagenError.set('');
    if (
      this.fotos.length + archivos.length > 8 ||
      archivos.some(
        (archivo) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) ||
          archivo.size > 5 * 1024 * 1024,
      )
    ) {
      this.imagenError.set('Podés agregar hasta 8 fotos JPG, PNG o WebP, de hasta 5 MB cada una.');
      input.value = '';
      return;
    }
    this.fotos.push(
      ...archivos.map((archivo) => ({
        clave: crypto.randomUUID(),
        url: URL.createObjectURL(archivo),
        archivo,
      })),
    );
    this.guardado.set(false);
    this.creado = false;
    input.value = '';
  }
  quitarImagen(index: number) {
    const foto = this.fotos[index];
    if (foto.archivo) URL.revokeObjectURL(foto.url);
    this.fotos.splice(index, 1);
    this.imagenError.set('');
    this.guardado.set(false);
    this.creado = false;
  }
  hacerPrincipal(index: number) {
    const [foto] = this.fotos.splice(index, 1);
    this.fotos.unshift(foto);
    this.guardado.set(false);
    this.creado = false;
  }
  ngOnDestroy() {
    this.fotos.filter((f) => f.archivo).forEach((f) => URL.revokeObjectURL(f.url));
  }
  producto: ProductoAdmin = {
    nombre: '',
    descripcion: '',
    categoria_id: 0,
    precio: 0,
    imagen_url: '',
    activo: true,
    variantes: [],
  };
  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    forkJoin({
      catalogos: this.api.catalogos(),
      producto: id ? this.api.obtener(Number(id)) : of(null),
    }).subscribe({
      next: (result) => {
        this.catalogos.set(result.catalogos);
        if (result.producto) {
          this.producto = result.producto;
          this.producto.imagen_url ||= '';
          const urls =
            result.producto.imagenes ??
            (this.producto.imagen_url ? [this.producto.imagen_url] : []);
          this.fotos = urls.map((url) => ({ clave: crypto.randomUUID(), url }));
          this.completarExistencias();
        } else {
          this.producto.categoria_id = result.catalogos.categorias[0]?.id || 0;
          this.agregarVariante();
        }
        this.cargando.set(false);
        this.cargado = true;
        this.aceptarCambios();
      },
      error: (e) => {
        this.cargando.set(false);
        this.handleError(e);
      },
    });
  }
  private completarExistencias() {
    for (const v of this.producto.variantes)
      for (const u of this.catalogos().ubicaciones) {
        if (!v.existencias.some((e) => e.ubicacion_id === u.id))
          v.existencias.push({ ubicacion_id: u.id, cantidad: 0 });
      }
  }
  agregarVariante() {
    const c = this.catalogos();
    // Elegir la primera combinación libre evita duplicar filas accidentalmente.
    for (const t of c.talles)
      for (const color of c.colores) {
        if (!this.producto.variantes.some((v) => v.talle_id === t.id && v.color_id === color.id)) {
          this.producto.variantes.push({
            talle_id: t.id,
            color_id: color.id,
            sku: '',
            activo: true,
            stock_minimo: 3,
            existencias: c.ubicaciones.map((u) => ({ ubicacion_id: u.id, cantidad: 0 })),
          });
          this.guardado.set(false);
          return;
        }
      }
    this.error.set('Ya agregaste todas las combinaciones disponibles de talle y color.');
  }
  quitarVariante(index: number) {
    if (!this.producto.variantes[index].id) this.producto.variantes.splice(index, 1);
  }
  ubicacion(id: number) {
    return this.catalogos().ubicaciones.find((u) => u.id === id)?.nombre || `Ubicación #${id}`;
  }
  ubicacionActiva(id: number) {
    return this.catalogos().ubicaciones.some((u) => u.id === id);
  }
  guardar() {
    if (this.guardando()) return;
    this.error.set('');
    this.guardado.set(false);
    const cambios = this.cambiosStock();
    if (cambios.length && !this.motivoAjuste) {
      this.error.set('Elegí el motivo del ajuste de stock antes de guardar.');
      return;
    }
    if (cambios.length && this.motivoAjuste === 'otro' && !this.observacionAjuste.trim()) {
      this.error.set('Agregá una observación para el motivo Otro.');
      return;
    }
    if (!this.producto.variantes.length) {
      this.error.set('Agregá al menos una variante.');
      return;
    }
    const combinations = this.producto.variantes.map((v) => `${v.talle_id}:${v.color_id}`);
    if (new Set(combinations).size !== combinations.length) {
      this.error.set('Cada combinación de talle y color debe ser única.');
      return;
    }
    this.guardando.set(true);
    // Ubicaciones inactivas quedan visibles para preservar el historial, sin editarse.
    const payload = {
      ...this.producto,
      ...(cambios.length
        ? {
            ajuste_stock: { motivo: this.motivoAjuste, observacion: this.observacionAjuste.trim() },
          }
        : {}),
      variantes: this.producto.variantes.map((v) => ({
        ...v,
        existencias: v.existencias.filter((e) => this.ubicacionActiva(e.ubicacion_id)),
      })),
    };
    // Sube en serie; en un reintento conserva los archivos ya subidos.
    const subida = from(this.fotos).pipe(
      concatMap((foto) =>
        foto.archivo
          ? this.api.subirImagen(foto.archivo).pipe(
              tap((res) => {
                URL.revokeObjectURL(foto.url);
                foto.url = res.imagen_url;
                foto.archivo = undefined;
              }),
            )
          : of(null),
      ),
      toArray(),
    );
    subida
      .pipe(
        switchMap(() =>
          this.api.guardar({
            ...payload,
            imagen_url: this.fotos[0]?.url || '',
            imagenes: this.fotos.map((f) => f.url),
          }),
        ),
      )
      .subscribe({
        next: (p) => {
          this.guardando.set(false);
          this.guardado.set(true);
          this.producto = p;
          this.completarExistencias();
          this.aceptarCambios();
          if (!payload.id)
            this.router.navigate(['/admin/productos', p.id, 'editar'], {
              replaceUrl: true,
              state: { creado: true },
            });
        },
        error: (e) => {
          this.guardando.set(false);
          this.handleError(e);
        },
      });
  }
  private handleError(e: any) {
    if (e.status === 401) {
      this.auth.logout();
      this.router.navigate(['/bienvenido/login']);
      return;
    }
    this.error.set(
      e.error?.errores?.map((item: any) => `${item.campo}: ${item.mensaje}`).join(' · ') ||
        e.error?.mensaje ||
        'No se pudo completar la operación. Comprobá la conexión con la API.',
    );
  }
  creado = Boolean(history.state?.creado);
}
