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
});
