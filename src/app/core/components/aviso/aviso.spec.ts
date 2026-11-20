import { TestBed } from '@angular/core/testing';
import { Aviso } from './aviso';
import { AvisoService } from '../../services/aviso.service';

describe('Aviso de confirmación', () => {
  it('muestra el mensaje y permite cerrarlo', () => {
    TestBed.configureTestingModule({ imports: [Aviso] });
    const fixture = TestBed.createComponent(Aviso);
    const avisos = TestBed.inject(AvisoService);

    avisos.mostrar('La prenda se agregó a tus favoritos.');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('La prenda se agregó a tus favoritos.');

    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });
});
