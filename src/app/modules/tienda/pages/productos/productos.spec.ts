import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { Productos } from './productos';
import { UsuarioService } from '../../../../api/services/usuario.service';

describe('Catálogo paginado desde el servidor', () => {
  let http: HttpTestingController;
  let sesionActiva: ReturnType<typeof signal<boolean>>;
  beforeEach(() => {
    sesionActiva = signal(false);
    TestBed.configureTestingModule({
      imports: [Productos],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: UsuarioService,
          useValue: {
            isLogged: () => sesionActiva(),
            isAdmin: () => false,
            sesionActiva: sesionActiva.asReadonly(),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  const response = {
    items: [],
    total: 7,
    pagina: 1,
    paginas: 2,
    por_pagina: 6,
    categorias: ['Buzos', 'Remeras'],
  };
  it('envía filtros y página al backend y conserva el total global', () => {
    const c = TestBed.createComponent(Productos).componentInstance;
    c.busqueda.set('buzo');
    c.categoria.set('Buzos');
    c.soloStock.set(true);
    c.orden.set('menor');
    c.cargar(2);
    const req = http.expectOne((r) => r.url === '/api/productos');
    expect(req.request.params.get('pagina')).toBe('2');
    expect(req.request.params.get('buscar')).toBe('buzo');
    expect(req.request.params.get('categoria')).toBe('Buzos');
    expect(req.request.params.get('solo_stock')).toBe('true');
    expect(req.request.params.get('orden')).toBe('menor');
    req.flush({ ...response, pagina: 2 });
    expect(c.total()).toBe(7);
    expect(c.pagina()).toBe(2);
    expect(c.categorias()).toEqual(['Todas', 'Buzos', 'Remeras']);
  });
  it('cancela respuestas anteriores y vuelve a la primera página al limpiar', () => {
    const c = TestBed.createComponent(Productos).componentInstance;
    c.cargar(2);
    const old = http.expectOne((r) => r.url === '/api/productos');
    c.limpiar();
    expect(old.cancelled).toBe(true);
    const current = http.expectOne((r) => r.url === '/api/productos');
    expect(current.request.params.get('pagina')).toBe('1');
    expect(current.request.params.get('categoria')).toBe('');
    current.flush(response);
  });

  it('limpia los corazones al cerrar sesión', async () => {
    const fixture = TestBed.createComponent(Productos);
    fixture.detectChanges();
    const solicitudesCatalogo = http.match((r) => r.url === '/api/productos');
    expect(solicitudesCatalogo.length).toBeGreaterThan(0);
    solicitudesCatalogo.forEach((solicitud) => solicitud.flush(response));
    const componente = fixture.componentInstance;

    sesionActiva.set(true);
    fixture.detectChanges();
    const solicitudesFavoritos = http.match('/api/favoritos');
    expect(solicitudesFavoritos.length).toBeGreaterThan(0);
    solicitudesFavoritos.forEach((solicitud) =>
      solicitud.flush([
      { id: 8, nombre: 'Buzo', descripcion: '', precio: 120, stock: 1 },
      ]),
    );
    expect(componente.idsFavoritos().has(8)).toBe(true);

    sesionActiva.set(false);
    fixture.detectChanges();
    expect(componente.idsFavoritos().size).toBe(0);
  });
});
