import { Component, signal, input, output, computed, OnInit, Signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { DatosFormularioUsuario } from '../../interfaces/datos-formulario-usuario';

const EMAIL_REGEX = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]{7,}$/;

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
  formModel = signal<DatosFormularioUsuario>({
    email: '',
    password: ''
  });

  formulario = form(this.formModel);
  campoEmailValido = computed(()=>
  {
    return EMAIL_REGEX.test(this.formModel().email.trim());
  });

  passwordMatch = computed(()=>{
    if(this.action() !== 'registrarse')
    {
      return true;
    }
    return this.formModel().password == this.repeatPassword();
  });

  passwordFuerte = computed(()=>{
    return PASSWORD_REGEX.test(this.formModel().password);
  });


  campoPasswordValido = computed(()=>{
    if(this.formModel().password.length === 0)
      return false;
    if(this.action() != 'registrarse')
      return true;
    return this.passwordMatch() && this.passwordFuerte();
  });

  OnSubmit(event:Event)
  {
    event.preventDefault();
    const credentials = this.formModel();
    console.log(credentials);
    if(this.campoEmailValido() && this.campoPasswordValido())
      this.submit.emit(credentials);
  }
}
