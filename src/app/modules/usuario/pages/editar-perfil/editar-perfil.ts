import { Component, inject, signal } from '@angular/core';
import { FormularioPerfil } from '../../components/formulario-perfil/formulario-perfil';
import { DatosFormularioPerfil } from '../../interfaces/datos-formulario-perfil';
import { UsuarioService, RespuestaCargaPerfil} from '../../../../api/services/usuario.service';

@Component({
  imports: [FormularioPerfil],
  selector: 'app-editar-perfil',
  styleUrl: './editar-perfil.css',
  templateUrl: './editar-perfil.html',
})
export class EditarPerfil {
  waitingForResponse = signal<boolean>(false);
  usuarioService = inject(UsuarioService);
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
