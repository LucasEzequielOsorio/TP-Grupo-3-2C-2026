import { Component, HostListener, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminProductosService,
  Catalogos,
  Opcion,
} from '../../../api/services/admin-productos.service';
import { AdminNav } from './admin-nav';

@Component({
  selector: 'app-catalogos-admin',
  imports: [AdminNav, FormsModule],
  templateUrl: './catalogos-admin.html',
  styleUrl: './tools.css',
})
export class CatalogosAdmin implements OnInit {
  private api = inject(AdminProductosService);
  catalogos = signal<Catalogos>({ categorias: [], talles: [], colores: [], ubicaciones: [] });
  tipo: 'categorias' | 'talles' | 'colores' = 'categorias';
  id?: number;
  nombre = '';
  orden = 0;
  hexadecimal = '#000000';
  cargando = signal(false);
  guardando = signal(false);
  error = signal('');
  mensaje = signal('');
  private original = this.snapshot();
  ngOnInit() {
    this.cargar();
  }
  snapshot() {
    return JSON.stringify([this.nombre, this.orden, this.hexadecimal]);
  }
  tieneCambios() {
    return this.snapshot() !== this.original;
  }
  enProceso() {
    return this.guardando();
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(e: BeforeUnloadEvent) {
    if (this.tieneCambios() || this.enProceso()) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
  private permitir() {
    return (
      !this.tieneCambios() || window.confirm('Tenés cambios sin guardar. ¿Querés descartarlos?')
    );
  }
  cargar() {
    this.cargando.set(true);
    this.api.catalogos().subscribe({
      next: (c) => {
        this.catalogos.set(c);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(e.error?.mensaje || 'No se pudieron cargar los catálogos');
        this.cargando.set(false);
      },
    });
  }
  cambiar(tipo: 'categorias' | 'talles' | 'colores') {
    if (this.guardando() || !this.permitir()) return;
    this.tipo = tipo;
    this.reset();
  }
  editar(item: Opcion) {
    if (this.guardando() || !this.permitir()) return;
    this.id = item.id;
    this.nombre = item.nombre;
    this.orden = item.orden || 0;
    this.hexadecimal = item.hexadecimal || '#000000';
    this.original = this.snapshot();
    this.mensaje.set('');
    this.error.set('');
  }
  cancelar() {
    if (!this.guardando() && this.permitir()) this.reset();
  }
  private reset() {
    this.id = undefined;
    this.nombre = '';
    this.orden = 0;
    this.hexadecimal = '#000000';
    this.original = this.snapshot();
    this.error.set('');
  }
  guardar() {
    if (this.guardando() || !this.nombre.trim()) return;
    this.error.set('');
    this.mensaje.set('');
    this.guardando.set(true);
    const data = {
      nombre: this.nombre.trim(),
      ...(this.tipo === 'talles' ? { orden: this.orden } : {}),
      ...(this.tipo === 'colores' ? { hexadecimal: this.hexadecimal } : {}),
    };
    this.api.guardarCatalogo(this.tipo, data, this.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.reset();
        this.mensaje.set('Cambios guardados. Ya podés usar este dato al cargar productos.');
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.error.set(e.error?.mensaje || 'No se pudo guardar');
      },
    });
  }
}
