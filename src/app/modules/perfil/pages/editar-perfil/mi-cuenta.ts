import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  UsuarioService,
  CuentaUsuario,
  ActualizacionCuenta,
} from '../../../../api/services/usuario.service';
import { TiendaNav } from '../../../tienda/components/tienda-nav';
import { PasswordField } from '../../components/password-field';

@Component({
  selector: 'app-mi-cuenta',
  imports: [FormsModule, TiendaNav, PasswordField],
  templateUrl: './mi-cuenta.html',
  styleUrls: ['../../../tienda/pages/tienda.css', './mi-cuenta.css'],
})
export class MiCuenta {
  auth = inject(UsuarioService);
  private router = inject(Router);
  cuenta = signal<CuentaUsuario | null>(null);
  datos = signal({ nombre: '', apellido: '', email: '', direccion: '' });
  actual = signal('');
  nueva = signal('');
  repeticion = signal('');
  cargando = signal(true);
  enProceso = signal(false);
  error = signal('');
  mensaje = signal('');
  private original = '';
  requiereActual = computed(
    () => this.datos().email.trim().toLowerCase() !== this.cuenta()?.email || Boolean(this.nueva()),
  );
  errorPassword = computed(() => {
    const p = this.nueva();
    if (!p && !this.repeticion()) return '';
    if (p.length < 8 || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p))
      return 'La nueva contraseña necesita al menos 8 caracteres, una mayúscula, una minúscula y un número.';
    if (new TextEncoder().encode(p).length > 72)
      return 'La contraseña no puede superar los 72 bytes.';
    return p !== this.repeticion() ? 'Las contraseñas nuevas no coinciden.' : '';
  });
  constructor() {
    this.cargar();
  }
  cargar() {
    this.cargando.set(true);
    this.error.set('');
    this.auth.getCuenta().subscribe({
      next: (r) => {
        this.aplicar(r.usuario);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        this.fallo(e);
      },
    });
  }
  private aplicar(u: CuentaUsuario) {
    this.cuenta.set(u);
    this.datos.set({
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      direccion: u.direccion,
    });
    this.original = JSON.stringify(this.datos());
    this.actual.set('');
    this.nueva.set('');
    this.repeticion.set('');
  }
  editar(campo: 'nombre' | 'apellido' | 'email' | 'direccion', valor: string) {
    this.datos.update((d) => ({ ...d, [campo]: valor }));
    this.mensaje.set('');
  }
  tieneCambios() {
    return (
      this.original !== '' &&
      (JSON.stringify(this.datos()) !== this.original ||
        Boolean(this.actual() || this.nueva() || this.repeticion()))
    );
  }
  @HostListener('window:beforeunload', ['$event']) antesDeSalir(e: BeforeUnloadEvent) {
    if (this.tieneCambios() || this.enProceso()) e.preventDefault();
  }
  guardar() {
    if (this.enProceso() || this.errorPassword() || (this.requiereActual() && !this.actual()))
      return;
    const d = this.datos();
    if (!d.nombre.trim() || !d.apellido.trim() || !d.email.trim() || !d.direccion.trim()) return;
    const body: ActualizacionCuenta = {
      nombre: d.nombre.trim(),
      apellido: d.apellido.trim(),
      email: d.email.trim().toLowerCase(),
      direccion: d.direccion.trim(),
    };
    if (this.actual()) body.password_actual = this.actual();
    if (this.nueva()) body.password_nueva = this.nueva();
    this.enProceso.set(true);
    this.error.set('');
    this.mensaje.set('');
    this.auth.actualizarCuenta(body).subscribe({
      next: (r) => {
        this.aplicar(r.usuario);
        this.enProceso.set(false);
        this.mensaje.set('Tu cuenta se actualizó correctamente.');
      },
      error: (e) => {
        this.enProceso.set(false);
        this.fallo(e);
      },
    });
  }
  descartar() {
    const u = this.cuenta();
    if (u) this.aplicar(u);
    this.error.set('');
    this.mensaje.set('');
  }
  private fallo(e: any) {
    this.error.set(
      e.error?.errores?.map((x: any) => x.mensaje).join('. ') ||
        e.error?.mensaje ||
        'No pudimos actualizar tu cuenta. Intentá nuevamente.',
    );
    if (e.status === 401) {
      this.original = '';
      this.actual.set('');
      this.nueva.set('');
      this.repeticion.set('');
      this.auth.logout();
      this.router.navigate(['/bienvenido/login'], {
        queryParams: { returnUrl: '/perfil/mi-cuenta' },
      });
    }
  }
}
