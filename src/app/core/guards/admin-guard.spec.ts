import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { of, throwError, isObservable, firstValueFrom } from 'rxjs';
import { UsuarioService } from '../../api/services/usuario.service';
import { adminGuard } from './admin-guard';

describe('adminGuard', () => {
  const session = { isLogged: vi.fn(), getSesion: vi.fn(), logout: vi.fn() };
  async function executeGuard() {
    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url: '/admin/productos' } as RouterStateSnapshot),
    );
    return isObservable(result) ? await firstValueFrom(result) : await result;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UsuarioService, useValue: session }],
    });
  });

  it('pide login a un visitante y conserva el destino', async () => {
    session.isLogged.mockReturnValue(false);
    const result = (await executeGuard()) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toContain('/bienvenido/login');
    expect(result.queryParams['returnUrl']).toBe('/admin/productos');
    expect(session.getSesion).not.toHaveBeenCalled();
  });
  it('rechaza el rol admin adulterado en el navegador si el servidor informa cliente', async () => {
    localStorage.setItem('user_role', 'admin');
    session.isLogged.mockReturnValue(true);
    session.getSesion.mockReturnValue(
      of({ usuario: { id: '1', email: 'cliente@example.invalid', rol: 'cliente' } }),
    );
    expect(TestBed.inject(Router).serializeUrl((await executeGuard()) as UrlTree)).toBe(
      '/tienda/productos',
    );
    expect(localStorage.getItem('user_role')).toBe('cliente');
  });
  it('permite el administrador confirmado por el servidor', async () => {
    session.isLogged.mockReturnValue(true);
    session.getSesion.mockReturnValue(
      of({ usuario: { id: '1', email: 'admin@example.invalid', rol: 'admin' } }),
    );
    expect(await executeGuard()).toBe(true);
  });
  it('descarta una sesión vencida', async () => {
    session.isLogged.mockReturnValue(true);
    session.getSesion.mockReturnValue(throwError(() => ({ status: 401 })));
    const result = (await executeGuard()) as UrlTree;
    expect(session.logout).toHaveBeenCalled();
    expect(TestBed.inject(Router).serializeUrl(result)).toContain('/bienvenido/login');
  });
});
