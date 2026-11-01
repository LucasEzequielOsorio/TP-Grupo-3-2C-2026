import { Component, input, output, signal } from '@angular/core';
@Component({
  selector: 'app-password-field',
  template:
    '<div class="field"><input [id]="fieldId()" [type]="visible() ? \'text\' : \'password\'" [value]="value()" (input)="valueChange.emit($any($event.target).value)" [disabled]="disabled()" [attr.autocomplete]="autocomplete()" /><button type="button" (click)="visible.set(!visible())" [disabled]="disabled()" [attr.aria-label]="(visible() ? \'Ocultar \' : \'Mostrar \') + label()" [attr.aria-pressed]="visible()" [attr.aria-controls]="fieldId()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>@if(visible()){<path d="m3 3 18 18"/>}</svg></button></div>',
  styles: [
    '.field{position:relative}input{box-sizing:border-box;width:100%;padding:13px 52px 13px 12px;border:1px solid #dce3d4;border-radius:6px;color:#324a31;font:inherit;background:white}button{position:absolute;right:3px;top:3px;bottom:3px;width:42px;border:0;background:transparent;color:#45623e;cursor:pointer;border-radius:5px}button:hover{background:#eef3e9}svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round}input:focus-visible,button:focus-visible{outline:2px solid #9bb78a;outline-offset:2px}',
  ],
})
export class PasswordField {
  fieldId = input.required<string>();
  label = input('contraseña');
  value = input('');
  valueChange = output<string>();
  disabled = input(false);
  autocomplete = input('new-password');
  visible = signal(false);
}
