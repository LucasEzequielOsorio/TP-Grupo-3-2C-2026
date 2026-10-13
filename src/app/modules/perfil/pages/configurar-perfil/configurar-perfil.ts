import { Component, signal, inject } from '@angular/core';
import { FormularioPerfil } from '../../components/formulario-perfil/formulario-perfil';
import { DatosFormularioPerfil } from '../../interfaces/datos-formulario-perfil';
import { RespuestaCargaPerfil, UsuarioService } from '../../../../api/services/usuario.service';

@Component({
  imports: [FormularioPerfil],
  selector: 'app-configurar-perfil',
  styleUrl: './configurar-perfil.css',
  templateUrl: './configurar-perfil.html',
})
export class ConfigurarPerfil {
  usuarioService = inject(UsuarioService);
  waitingForResponse = signal<boolean>(false);
  mensajeError = signal<string | null>(null);

  OnSubmit(datos:DatosFormularioPerfil)
  {
    this.mensajeError.set(null);
    this.waitingForResponse.set(true);
    this.usuarioService.cargarPerfil(datos).subscribe({
      next: (res)=>{
        this.waitingForResponse.set(false);
      },
      error: (res:RespuestaCargaPerfil)=>
      {
        this.waitingForResponse.set(false);
        this.mensajeError.set(res.mensaje? res.mensaje : null);
      }
    });
  }
  OnCancel()
  {

  }
}
