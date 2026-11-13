import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { Pedidos } from './pedidos';
import { TiendaService } from '../../../../api/services/tienda.service';
import { UsuarioService } from '../../../../api/services/usuario.service';

describe('Pedidos y Mercado Pago', () => {
  const pending = {
    id: 12,
    estado: 'pendiente',
    pago_estado: 'pendiente',
    reserva_hasta: new Date(Date.now() + 1800000).toISOString(),
    creado_en: new Date().toISOString(),
    direccion_entrega: 'Calle 123',
    total: 100,
    unidades: 1,
    items: [],
  };
  let api: any;
  function setup(query: Record<string, string> = {}) {
    api = {
      getPedido: vi.fn(() => of({ ...pending })),
      getPedidos: vi.fn(() => of([])),
      iniciarPago: vi.fn(),
      sincronizarPago: vi.fn(() => of({ ...pending })),
      cancelarPedido: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [Pedidos],
      providers: [
        provideRouter([]),
        { provide: TiendaService, useValue: api },
        { provide: UsuarioService, useValue: { isLogged: () => true, isAdmin: () => false } },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: '12' })),
            snapshot: { queryParamMap: convertToParamMap(query) },
          },
        },
      ],
    });
    return TestBed.createComponent(Pedidos);
  }
  it('la URL de retorno no convierte por sí sola el pedido en pagado', () => {
    const c = setup({ status: 'approved', payment_id: '999' }).componentInstance;
    expect(api.sincronizarPago).toHaveBeenCalledWith(12);
    expect(c.detalle()?.pago_estado).toBe('pendiente');
  });
  it('bloquea doble inicio y rechaza URLs fuera de Mercado Pago', () => {
    const c = setup().componentInstance;
    const request = new Subject();
    api.iniciarPago.mockReturnValue(request);
    c.pagar();
    c.pagar();
    expect(api.iniciarPago).toHaveBeenCalledTimes(1);
    request.next({ checkout_url: 'https://sitio-ajeno.example/pay' });
    expect(c.procesando()).toBe(false);
    expect(c.errorPago()).toContain('No pudimos abrir');
  });
  it('solo permite pagar reservas vigentes y refleja el estado verificado', () => {
    const c = setup().componentInstance;
    expect(c.vigente()).toBe(true);
    api.sincronizarPago.mockReturnValue(
      of({ ...pending, estado: 'confirmado', pago_estado: 'aprobado' }),
    );
    c.actualizarPago();
    expect(c.detalle()?.pago_estado).toBe('aprobado');
    expect(c.vigente()).toBe(false);
    c.detalle.set({ ...pending, reserva_hasta: new Date(Date.now() - 1000).toISOString() });
    expect(c.vigente()).toBe(false);
  });
});
