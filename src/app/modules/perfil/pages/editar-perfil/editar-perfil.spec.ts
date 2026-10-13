import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditarPerfil } from './editar-perfil';

describe('EditarPerfil', () => {
  let component: EditarPerfil;
  let fixture: ComponentFixture<EditarPerfil>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditarPerfil],
    }).compileComponents();

    fixture = TestBed.createComponent(EditarPerfil);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
