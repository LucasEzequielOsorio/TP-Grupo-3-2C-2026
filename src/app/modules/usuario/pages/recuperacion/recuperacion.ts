import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { UsuarioService } from '../../../../api/services/usuario.service';
import { PasswordField } from '../../../perfil/components/password-field';
@Component({
  selector: 'app-recuperacion',
  imports: [FormsModule, RouterLink, PasswordField],
  templateUrl: './recuperacion.html',
  styleUrls: ['../auth.css', './recuperacion.css'],
})
export class Recuperacion {
  private auth = inject(UsuarioService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  restablecer = this.route.snapshot.data['restablecer'] === true;
  private token = '';
  email = signal('');
  password = signal('');
  repeticion = signal('');
  ocupado = signal(false);
  error = signal('');
  mensaje = signal('');
  completo = signal(false);
  enlaceValido = signal(true);
  verificando = signal(false);
  falloVerificacion = signal(false);
  errorPassword = computed(() => {
    const p = this.password();
    if (!p && !this.repeticion()) return '';
    if (p.length < 8 || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p))
      return 'Usá al menos 8 caracteres, con mayúscula, minúscula y número.';
    if (new TextEncoder().encode(p).length > 72)
      return 'La contraseña no puede superar los 72 bytes.';
    return p !== this.repeticion() ? 'Las contraseñas no coinciden.' : '';
  });
  constructor() {
    if (this.restablecer) {
      this.token = new URLSearchParams(this.route.snapshot.fragment || '').get('token') || '';
      this.enlaceValido.set(/^[a-f0-9]{64}$/.test(this.token));
      // El secreto queda solo en memoria; no se conserva en URL ni localStorage.
      this.location.replaceState('/bienvenido/restablecer');
      if (this.enlaceValido()) this.verificar();
    }
  }
  verificar() {
    if (this.verificando() || !this.token) return;
    this.verificando.set(true);
    this.enlaceValido.set(false);
    this.falloVerificacion.set(false);
    this.error.set('');
    this.auth.verificarRecuperacion(this.token).subscribe({
      next: (r) => {
        this.verificando.set(false);
        this.enlaceValido.set(r.valido);
        if (!r.valido)
          this.error.set('El enlace ya fue utilizado, venció o no es válido. Solicitá uno nuevo.');
      },
      error: (e) => {
        this.verificando.set(false);
        this.falloVerificacion.set(e.status !== 400);
        this.error.set(e.error?.mensaje || 'No pudimos comprobar el enlace. Intentá nuevamente.');
      },
    });
  }
  solicitar() {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.mensaje.set('');
    this.auth.solicitarRecuperacion(this.email().trim().toLowerCase()).subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.mensaje.set(r.mensaje);
      },
      error: (e) => {
        this.ocupado.set(false);
        this.error.set(e.error?.mensaje || 'No pudimos procesar la solicitud. Intentá nuevamente.');
      },
    });
  }
  guardar() {
    if (
      this.ocupado() ||
      this.verificando() ||
      !this.enlaceValido() ||
      !this.password() ||
      this.errorPassword() ||
      this.completo()
    )
      return;
    this.ocupado.set(true);
    this.error.set('');
    this.auth.restablecerPassword(this.token, this.password()).subscribe({
      next: (r) => {
        this.auth.logout();
        this.ocupado.set(false);
        this.completo.set(true);
        this.token = '';
        this.password.set('');
        this.repeticion.set('');
        this.mensaje.set(r.mensaje);
      },
      error: (e) => {
        this.ocupado.set(false);
        this.error.set(
          e.error?.mensaje || 'No pudimos actualizar la contraseña. Intentá nuevamente.',
        );
        if (e.status === 400 && !e.error?.errores) this.enlaceValido.set(false);
      },
    });
  }
}
