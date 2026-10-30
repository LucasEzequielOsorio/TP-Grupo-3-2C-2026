import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { UsuarioService } from '../../api/services/usuario.service';
import { loggedGuard } from './logged-guard';

describe('loggedGuard', () => {
  const session = { isLogged: vi.fn() };
  const executeGuard = () =>
    TestBed.runInInjectionContext(() =>
      loggedGuard({} as ActivatedRouteSnapshot, { url: '/tienda/carrito' } as RouterStateSnapshot),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: UsuarioService, useValue: session }],
    });
  });

  it('conserva el destino privado cuando el visitante debe iniciar sesión', () => {
    session.isLogged.mockReturnValue(false);
    const result = executeGuard() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toContain('/bienvenido/login');
    expect(result.queryParams['returnUrl']).toBe('/tienda/carrito');
  });
  it('permite una cuenta autenticada', () => {
    session.isLogged.mockReturnValue(true);
    expect(executeGuard()).toBe(true);
  });
});
