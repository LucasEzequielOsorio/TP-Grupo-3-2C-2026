import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfigurarPerfil } from './configurar-perfil';

describe('ConfigurarPerfil', () => {
  let component: ConfigurarPerfil;
  let fixture: ComponentFixture<ConfigurarPerfil>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigurarPerfil],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigurarPerfil);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
