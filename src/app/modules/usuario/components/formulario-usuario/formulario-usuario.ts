import { Component, signal, input, output, computed, OnInit, Signal, effect } from '@angular/core';
import { form, applyWhen, FormField, required, email, minLength, pattern } from '@angular/forms/signals';
import { DatosFormularioUsuario } from '../../interfaces/datos-formulario-usuario';

const EMAIL_REGEX = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,}$/;

@Component({
  imports: [FormField],
  selector: 'app-formulario-usuario',
  styleUrl: './formulario-usuario.css',
  templateUrl: './formulario-usuario.html',
})
export class FormularioUsuario {
  action = input<string>('');
  submit = output<DatosFormularioUsuario>();
  repeatPassword = signal<string>('');
  sent = input<boolean>();
  formModel = signal<DatosFormularioUsuario>({
    email: '',
    password: ''
  });
  formulario = form(this.formModel, (schemaPath)=>{
    required(schemaPath.email, {message: 'el email es obligatorio.'});
    email(schemaPath.email, {message: 'Ingrese un email válido'});
    required(schemaPath.password, {message: 'Ingrese una contraseña.'});

    applyWhen(schemaPath.password, ()=> this.action() === 'registrarse',(passwordPath)=>
    {
      minLength(passwordPath, 8, {message: 'La contraseña debe tener al menos 8 caracteres.'});
      pattern(passwordPath, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {message: 'La contraseña debe tener al menos una minúscula, una mayúscula y un número.'});
      pattern(passwordPath, /^[a-zA-Z0-9!?_\-@#%.]+$/, {message: 'solo se permiten los siguientes caracteres especiales: !, ?, -, _, @, #, %, .'});
    });
  });
  errorMessage = input<string | null>('');
  nombre = signal('');
  apellido = signal('');
  direccion = signal('');
  perfilValido = computed(() => this.action() !== 'registrarse' || Boolean(this.nombre().trim() && this.apellido().trim() && this.direccion().trim()));

  passwordMatch = computed(()=>{
    return this.repeatPassword().valueOf() === this.formulario.password().value() || this.action() !== 'registrarse';
  });


  OnSubmit(event:Event)
  {
    event.preventDefault();
    event.stopPropagation();
    if (!this.formulario().valid() || !this.passwordMatch() || !this.perfilValido() || this.sent()) return;
    const credentials = this.action() === 'registrarse' ? {
      ...this.formModel(), nombre: this.nombre().trim(), apellido: this.apellido().trim(), direccion: this.direccion().trim()
    } : this.formModel();
    this.submit.emit(credentials);
  }
}
