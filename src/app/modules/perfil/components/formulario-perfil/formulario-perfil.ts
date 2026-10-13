import { Component, signal, inject, input, output } from '@angular/core';
import { DatosFormularioPerfil } from '../../interfaces/datos-formulario-perfil';
import { form, FormField, required, validate } from '@angular/forms/signals';
import { UsuarioService } from '../../../../api/services/usuario.service';

@Component({
  imports: [FormField],
  selector: 'app-formulario-perfil',
  styleUrl: './formulario-perfil.css',
  templateUrl: './formulario-perfil.html',
})
export class FormularioPerfil {
  canCancel = input<Boolean>();
  sent =  input<Boolean>();
  submit = output<DatosFormularioPerfil>();
  cancel = output();
  formModel = signal<DatosFormularioPerfil>({
    nombre:'',
    apellido:'',
    fechaNacimiento: Date.now().toString(),
    direccion:{
      calle: '',
      altura: 0,
      edificio: '',
      piso: '',
      unidad: '',
      localidad: '',
      codigoPostal: ''
    }
  });

  formulario = form(this.formModel, (schemaPath)=>{
    required(schemaPath.nombre);
    required(schemaPath.apellido);
    required(schemaPath.fechaNacimiento);

    const direccionPath = schemaPath.direccion;
    required(direccionPath.calle);
    validate(direccionPath, ({ value })=> //Que haya una altura, un edificio con piso y unidad o ambos.
    {
      const dir = value();
      const alturaCompleta = dir.altura !== null;
      const edificioCompleto = Boolean(dir.edificio?.trim() && dir.piso?.trim() && dir.unidad?.trim());
      return (alturaCompleta || edificioCompleto)? null : {
        kind: 'direccionIncompleta',
        message: 'Introduzca una altura o un edificio.'
      };
    });
    required(direccionPath.localidad);
    required(direccionPath.codigoPostal);
  });

  OnSubmit(event:Event)
  {
    event.preventDefault();
    this.submit.emit(this.formModel());
  }
  OnCancel()
  {
    this.cancel.emit();
  }
}
