import { Component, inject, signal } from '@angular/core';
import { FormularioUsuario } from '../../components/formulario-usuario/formulario-usuario';
import { DatosFormularioUsuario } from '../../interfaces/datos-formulario-usuario';
import { RespuestaAuth, UsuarioService } from '../../../../api/services/usuario.service';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';

@Component({
  imports: [FormularioUsuario, RouterLink],
  selector: 'app-inicio-de-sesion',
  styleUrl: '../auth.css',
  templateUrl: './inicio-de-sesion.html',
})
export class InicioDeSesion {
  registrado = inject(ActivatedRoute).snapshot.queryParamMap.has('registrado');
  retorno = inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl');
  usuarioService = inject(UsuarioService);
  router = inject(Router);
  waitingForResponse = signal<boolean>(false);
  errorMessage = signal<string | null>('');
  iniciarSesion(datos: DatosFormularioUsuario) {
    this.errorMessage.set(null);
    this.waitingForResponse.set(true);
    this.usuarioService.iniciarSesion(datos).subscribe({
      next: (res: RespuestaAuth) => {
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('user_role', res.usuario.rol);
        this.waitingForResponse.set(false);
        const destino =
          this.retorno &&
          /^\/(tienda|perfil|admin)(\/|$)/.test(this.retorno) &&
          (!this.retorno.startsWith('/admin') || res.usuario.rol === 'admin')
            ? this.retorno
            : res.usuario.rol === 'admin'
              ? '/admin/productos'
              : '/tienda/productos';
        this.router.navigateByUrl(destino);
      },
      error: (err) => {
        this.errorMessage.set(
          err?.error?.mensaje ||
            'No se pudo iniciar sesión. Comprobá que el backend esté funcionando.',
        );
        this.waitingForResponse.set(false);
      },
    });
  }
}
