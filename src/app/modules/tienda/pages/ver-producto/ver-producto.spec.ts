import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
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
  let autenticado: boolean;
  let servicio: {
    getProducto: ReturnType<typeof vi.fn>;
    obtenerFavoritos: ReturnType<typeof vi.fn>;
    agregarFavorito: ReturnType<typeof vi.fn>;
    eliminarFavorito: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    autenticado = true;
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
          useValue: { isLogged: () => autenticado, isAdmin: () => false },
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
    autenticado = false;
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
});
