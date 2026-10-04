import { Component } from '@angular/core';
import { FormularioUsuario } from '../../components/formulario-usuario/formulario-usuario';
import { DatosFormularioUsuario } from '../../interfaces/datos-formulario-usuario';
import { Observable } from 'rxjs';

@Component({
  imports: [FormularioUsuario],
  selector: 'app-inicio-de-sesion',
  styleUrl: './inicio-de-sesion.css',
  templateUrl: './inicio-de-sesion.html',
})
export class InicioDeSesion {
  iniciarSesion(datos:DatosFormularioUsuario)
  {

  }
}
