import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormularioUsuario } from './formulario-usuario';

describe('FormularioUsuario', () => {
  let component: FormularioUsuario;
  let fixture: ComponentFixture<FormularioUsuario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormularioUsuario],
    }).compileComponents();

    fixture = TestBed.createComponent(FormularioUsuario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('acepta símbolos sin una lista restringida y mantiene la complejidad', () => {
    fixture.componentRef.setInput('action', 'registrarse');
    fixture.detectChanges();
    for (const symbol of ['$', '&', '*', '+', '=', '/', '!', '¿', '🔒']) {
      component.formModel.set({email: 'test@example.com', password: 'Prueba123' + symbol});
      fixture.detectChanges();
      expect(component.formulario.password().valid()).toBe(true);
    }
    for (const password of ['corta', 'sinmayuscula123$', 'SINMINUSCULA123$', 'SinNumero$']) {
      component.formModel.set({email: 'test@example.com', password});
      fixture.detectChanges();
      expect(component.formulario.password().invalid()).toBe(true);
    }
  });
  it('rechaza contraseñas de más de 72 bytes', () => {
    fixture.componentRef.setInput('action', 'registrarse');
    component.formModel.set({email: 'test@example.com', password: 'Prueba123' + '🔒'.repeat(17)});
    fixture.detectChanges();
    expect(component.formulario.password().invalid()).toBe(true);
  });
  it('muestra y oculta ambos campos independientemente sin enviar el formulario', () => {
    fixture.componentRef.setInput('action', 'registrarse');
    component.formModel.set({email: 'test@example.com', password: 'Prueba123$'});
    component.repeatPassword.set('Prueba123$');
    fixture.detectChanges();
    const spy = vi.spyOn(component.submit, 'emit');
    const buttons = fixture.nativeElement.querySelectorAll('.password-toggle') as NodeListOf<HTMLButtonElement>;
    buttons[0].click(); fixture.detectChanges();
    const password = fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    const repeat = fixture.nativeElement.querySelector('#passwordRepeat') as HTMLInputElement;
    expect(password.type).toBe('text');
    expect(password.value).toBe('Prueba123$');
    expect(repeat.type).toBe('password');
    buttons[1].click(); fixture.detectChanges();
    expect(repeat.type).toBe('text');
    buttons[0].click(); fixture.detectChanges();
    expect(password.type).toBe('password');
    expect(spy).not.toHaveBeenCalled();
  });
});
