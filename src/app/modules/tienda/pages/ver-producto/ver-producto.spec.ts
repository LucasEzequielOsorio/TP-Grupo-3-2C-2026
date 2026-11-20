import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { TiendaService } from '../../../../api/services/tienda.service';
import { UsuarioService } from '../../../../api/services/usuario.service';
import { VerProducto } from './ver-producto';

describe('Detalle de producto', () => {
  const producto = {
    id: 8,
    nombre: 'Buzo',
    descripcion: 'Buzo de prueba',
    precio: 120,
    stock: 0,
    variantes: [],
  };
  let sesionActiva: ReturnType<typeof signal<boolean>>;
  let servicio: {
    getProducto: ReturnType<typeof vi.fn>;
    obtenerFavoritos: ReturnType<typeof vi.fn>;
    agregarFavorito: ReturnType<typeof vi.fn>;
    eliminarFavorito: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    sesionActiva = signal(true);
    servicio = {
      getProducto: vi.fn(() => of(producto)),
      obtenerFavoritos: vi.fn(() => of([])),
      agregarFavorito: vi.fn(() => of({ producto_id: producto.id, favorito: true })),
      eliminarFavorito: vi.fn(() => of({ producto_id: producto.id, favorito: false })),
    };
    TestBed.configureTestingModule({
      imports: [VerProducto],
      providers: [
        provideRouter([]),
        { provide: TiendaService, useValue: servicio },
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
  });

  it('carga el estado y permite agregar y quitar el favorito', async () => {
    const fixture = TestBed.createComponent(VerProducto);
    fixture.componentRef.setInput('id', producto.id);
    fixture.detectChanges();
    await fixture.whenStable();

    const componente = fixture.componentInstance;
    expect(servicio.obtenerFavoritos).toHaveBeenCalledOnce();
    expect(componente.esFavorito()).toBe(false);

    componente.cambiarFavorito();
    expect(servicio.agregarFavorito).toHaveBeenCalledWith(producto.id);
    expect(componente.esFavorito()).toBe(true);

    componente.cambiarFavorito();
    expect(servicio.eliminarFavorito).toHaveBeenCalledWith(producto.id);
    expect(componente.esFavorito()).toBe(false);
  });

  it('redirige al login conservando la página cuando no hay sesión', async () => {
    sesionActiva.set(false);
    const fixture = TestBed.createComponent(VerProducto);
    fixture.componentRef.setInput('id', producto.id);
    fixture.detectChanges();
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.cambiarFavorito();

    expect(navegar).toHaveBeenCalledWith(['/bienvenido/login'], {
      queryParams: { returnUrl: router.url },
    });
    expect(servicio.agregarFavorito).not.toHaveBeenCalled();
  });

  it('vacía el corazón cuando se cierra la sesión', async () => {
    const fixture = TestBed.createComponent(VerProducto);
    fixture.componentRef.setInput('id', producto.id);
    fixture.detectChanges();
    await fixture.whenStable();
    const componente = fixture.componentInstance;
    componente.esFavorito.set(true);

    sesionActiva.set(false);
    fixture.detectChanges();

    expect(componente.esFavorito()).toBe(false);
  });
});
