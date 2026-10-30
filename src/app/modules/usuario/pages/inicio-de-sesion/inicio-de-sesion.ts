import { Component, inject, signal} from '@angular/core';
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
          this.router.navigate([res.usuario.rol === 'admin' ? '/admin/productos' : '/tienda']);
        },
        error: (err)=>
        {
          this.errorMessage.set(err?.error?.mensaje || 'No se pudo iniciar sesión. Comprobá que el backend esté funcionando.');
          this.waitingForResponse.set(false);
        }
      });
  }
}
