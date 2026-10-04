import { Component } from '@angular/core';
import { FormularioUsuario } from '../../components/formulario-usuario/formulario-usuario';
import { DatosFormularioUsuario } from '../../interfaces/datos-formulario-usuario';

@Component({
  imports: [FormularioUsuario],
  selector: 'app-registro',
  styleUrl: './registro.css',
  templateUrl: './registro.html',
})
export class Registro {
  registrar(datos:DatosFormularioUsuario)
  {

  }
}
