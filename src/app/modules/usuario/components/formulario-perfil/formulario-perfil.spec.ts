import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormularioPerfil } from './formulario-perfil';

describe('FormularioPerfil', () => {
  let component: FormularioPerfil;
  let fixture: ComponentFixture<FormularioPerfil>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormularioPerfil],
    }).compileComponents();

    fixture = TestBed.createComponent(FormularioPerfil);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
