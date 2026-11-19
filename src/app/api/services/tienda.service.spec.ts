import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TiendaService } from './tienda.service';

describe('Servicio de tienda', () => {
  let servicio: TiendaService;
  let solicitudes: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('auth_token', 'token-de-prueba');
    TestBed.configureTestingModule({
      providers: [TiendaService, provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(TiendaService);
    solicitudes = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    solicitudes.verify();
    localStorage.removeItem('auth_token');
  });

  it('se crea', () => {
    expect(servicio).toBeTruthy();
  });

  it('envía el token al consultar, agregar y quitar favoritos', () => {
    servicio.obtenerFavoritos().subscribe();
    const consulta = solicitudes.expectOne('/api/favoritos');
    expect(consulta.request.method).toBe('GET');
    expect(consulta.request.headers.get('Authorization')).toBe('Bearer token-de-prueba');
    consulta.flush([]);

    servicio.agregarFavorito(12).subscribe();
    const alta = solicitudes.expectOne('/api/favoritos/12');
    expect(alta.request.method).toBe('POST');
    expect(alta.request.headers.get('Authorization')).toBe('Bearer token-de-prueba');
    alta.flush({ producto_id: 12, favorito: true, creado: true });

    servicio.eliminarFavorito(12).subscribe();
    const baja = solicitudes.expectOne('/api/favoritos/12');
    expect(baja.request.method).toBe('DELETE');
    expect(baja.request.headers.get('Authorization')).toBe('Bearer token-de-prueba');
    baja.flush({ producto_id: 12, favorito: false });
  });
});
