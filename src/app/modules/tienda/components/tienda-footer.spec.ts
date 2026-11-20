import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TiendaFooter } from './tienda-footer';

describe('TiendaFooter', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiendaFooter],
      providers: [provideRouter([])],
    });
  });

  it('se crea correctamente y muestra Grupo 9 y los integrantes', () => {
    const fixture = TestBed.createComponent(TiendaFooter);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Grupo 9');
    expect(element.textContent).toContain('Alejo Gonzalez');
    expect(element.textContent).toContain('Gonzalo Amarilla');
    expect(element.textContent).toContain('Lucas Osorio');
    expect(element.textContent).toContain('Martín Videla');
    expect(element.textContent).toContain('Sebastián Ángel Díaz');
  });

  it('ejecuta scroll al hacer click en volver arriba', () => {
    const fixture = TestBed.createComponent(TiendaFooter);
    const component = fixture.componentInstance;
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    const fakeEvent = { preventDefault: vi.fn() } as unknown as Event;
    component.subir(fakeEvent);

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalled();
  });
});
