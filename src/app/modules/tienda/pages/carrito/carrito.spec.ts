import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { Carrito } from './carrito';
import { TiendaService } from '../../../../api/services/tienda.service';
import { UsuarioService } from '../../../../api/services/usuario.service';

describe('Carrito real', () => {
  const item = {
    variante_id: 10,
    producto_id: 1,
    nombre: 'Remera',
    talle: 'M',
    color: 'Negro',
    imagen_url: '',
    precio: 100,
    cantidad: 2,
    stock: 3,
    activo: true,
    subtotal: 200,
  };
  const respuesta = { items: [item], total: 200, unidades: 2 };
  let service: {
    getCarrito: ReturnType<typeof vi.fn>;
    actualizarCantidad: ReturnType<typeof vi.fn>;
    eliminarDelCarrito: ReturnType<typeof vi.fn>;
    getEntrega: ReturnType<typeof vi.fn>;
    confirmarPedido: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    service = {
      getCarrito: vi.fn(() => of(respuesta)),
      actualizarCantidad: vi.fn(() => of(respuesta)),
      eliminarDelCarrito: vi.fn(() => of({ items: [], total: 0, unidades: 0 })),
      getEntrega: vi.fn(() => of({ direccion: 'Calle 123' })),
      confirmarPedido: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [Carrito],
      providers: [
        provideRouter([]),
        { provide: TiendaService, useValue: service },
        { provide: UsuarioService, useValue: { isLogged: () => true, isAdmin: () => false } },
      ],
    });
  });
  it('muestra la variante y el resumen recibido del servidor', () => {
    const fixture = TestBed.createComponent(Carrito);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Talle M · Negro');
    expect(fixture.componentInstance.carrito().total).toBe(200);
  });
  it('requiere revisión y bloquea la doble confirmación mientras responde el servidor', () => {
    const c = TestBed.createComponent(Carrito).componentInstance;
    const pending = new Subject();
    service.confirmarPedido.mockReturnValue(pending);
    c.confirmar();
    expect(service.confirmarPedido).not.toHaveBeenCalled();
    c.abrirConfirmacion();
    expect(c.direccion()).toBe('Calle 123');
    c.confirmar();
    c.confirmar();
    expect(service.confirmarPedido).toHaveBeenCalledTimes(1);
    expect(c.ocupado()).toBe(true);
    pending.error({ status: 409, error: { mensaje: 'Cambió el precio' } });
    expect(c.ocupado()).toBe(false);
    expect(c.error()).toBe('Cambió el precio');
    c.abrirConfirmacion();
    c.confirmar();
    expect(service.confirmarPedido.mock.calls[0][0]).toBe(service.confirmarPedido.mock.calls[1][0]);
  });
  it('rechaza cantidades inválidas sin enviar cambios', () => {
    const c = TestBed.createComponent(Carrito).componentInstance;
    c.cambiar(item, { target: { value: '4' } } as unknown as Event);
    expect(service.actualizarCantidad).not.toHaveBeenCalled();
    expect(c.error()).toContain('stock disponible');
  });
  it('actualiza por id de variante y permite eliminar la línea', () => {
    const c = TestBed.createComponent(Carrito).componentInstance;
    c.cambiar(item, { target: { value: '1' } } as unknown as Event);
    expect(service.actualizarCantidad).toHaveBeenCalledWith(10, 1);
    c.eliminar(item);
    expect(c.carrito().items.length).toBe(0);
  });
});
