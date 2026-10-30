import { Component, inject, signal } from '@angular/core';
import { FormularioUsuario } from '../../components/formulario-usuario/formulario-usuario';
import { DatosFormularioUsuario } from '../../interfaces/datos-formulario-usuario';
import { RespuestaAuth, UsuarioService } from '../../../../api/services/usuario.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

@Component({
  imports: [FormularioUsuario, RouterLink],
  selector: 'app-registro',
  styleUrl: '../auth.css',
  templateUrl: './registro.html',
})
export class Registro {
  usuarioService = inject(UsuarioService);
  router = inject(Router);
  waitingForResponse = signal(false);
  errorMessage = signal<string | null>(null);

  registrar(datos:DatosFormularioUsuario)
  {
    this.errorMessage.set(null);
    this.waitingForResponse.set(true);
    this.usuarioService.registrarUsuario(datos).subscribe({
      next: (respuesta:RespuestaAuth)=>
      {
        this.router.navigate(['/bienvenido/login'], { queryParams: { registrado: '1' } });
        this.waitingForResponse.set(false);
      },
      error: (err)=>
      {
        this.errorMessage.set(err?.error?.mensaje || 'Ocurrió un error al registrar. Intente nuevamente.');
        this.waitingForResponse.set(false);
      }
    });
  }
}
