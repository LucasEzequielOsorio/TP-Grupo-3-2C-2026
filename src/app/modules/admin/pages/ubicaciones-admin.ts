import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InventarioService, Ubicacion } from '../../../api/services/inventario.service';
import { AdminNav } from './admin-nav';
@Component({
  selector: 'app-ubicaciones-admin',
  imports: [AdminNav, FormsModule, RouterLink],
  templateUrl: './ubicaciones-admin.html',
  styleUrl: './tools.css',
})
export class UbicacionesAdmin implements OnInit {
  private api = inject(InventarioService);
  ubicaciones = signal<Ubicacion[]>([]);
  cargando = signal(false);
  guardando = signal(false);
  error = signal('');
  mensaje = signal('');
  formulario: Ubicacion = this.nueva();
  private original = JSON.stringify(this.formulario);
  private nueva(): Ubicacion {
    return { nombre: '', tipo: 'deposito', direccion: '', activo: true };
  }
  tieneCambios() {
    return JSON.stringify(this.formulario) !== this.original;
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
  ngOnInit() {
    this.cargar();
  }
  cargar() {
    this.cargando.set(true);
    this.api.ubicaciones().subscribe({
      next: (rows) => {
        this.ubicaciones.set(rows);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(e.error?.mensaje || 'No se pudieron cargar las ubicaciones');
        this.cargando.set(false);
      },
    });
  }
  private permitir() {
    return (
      !this.tieneCambios() || window.confirm('Tenés cambios sin guardar. ¿Querés descartarlos?')
    );
  }
  editar(u: Ubicacion) {
    if (this.guardando() || !this.permitir()) return;
    this.formulario = { ...u };
    this.original = JSON.stringify(this.formulario);
    this.error.set('');
    this.mensaje.set('');
  }
  cancelar() {
    if (!this.guardando() && this.permitir()) this.reset();
  }
  private reset() {
    this.formulario = this.nueva();
    this.original = JSON.stringify(this.formulario);
  }
  guardar() {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.error.set('');
    this.mensaje.set('');
    this.api.guardarUbicacion(this.formulario).subscribe({
      next: () => {
        this.guardando.set(false);
        this.reset();
        this.mensaje.set(
          'Ubicación guardada. Ya está disponible para administrar sus existencias.',
        );
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.error.set(e.error?.mensaje || 'No se pudo guardar la ubicación');
      },
    });
  }
}
