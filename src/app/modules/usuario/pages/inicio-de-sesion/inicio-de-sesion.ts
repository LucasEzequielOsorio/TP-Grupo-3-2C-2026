import { Component, inject, signal} from '@angular/core';
import { FormularioUsuario } from '../../components/formulario-usuario/formulario-usuario';
import { DatosFormularioUsuario } from '../../interfaces/datos-formulario-usuario';
import { RespuestaAuth, UsuarioService } from '../../../../api/services/usuario.service';
import { Router } from '@angular/router';

@Component({
  imports: [FormularioUsuario],
  selector: 'app-inicio-de-sesion',
  styleUrl: './inicio-de-sesion.css',
  templateUrl: './inicio-de-sesion.html',
})
export class InicioDeSesion {
  usuarioService = inject(UsuarioService);
  router = inject(Router)
  waitingForResponse = signal<boolean>(false);
  errorMessage = signal<string | null>('');
  iniciarSesion(datos:DatosFormularioUsuario)
  {
      this.errorMessage.set(null);
      this.waitingForResponse.set(true);
      this.usuarioService.iniciarSesion(datos).subscribe({
        next: (res:RespuestaAuth)=>
        {
          localStorage.setItem("auth_token", res.token);
          localStorage.setItem("user_role", res.usuario.rol);
          this.waitingForResponse.set(false);
          this.router.navigate(['/tienda']);
        },
        error: (err)=>
        {
          this.errorMessage.set(err?.message || 'Ocurrió un error inesperado. Intente nuevamente.');
          this.waitingForResponse.set(false);
        }
      });
  }
}
