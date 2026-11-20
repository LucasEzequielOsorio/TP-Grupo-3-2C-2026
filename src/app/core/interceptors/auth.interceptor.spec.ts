import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { UsuarioService } from '../../api/services/usuario.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let routerNavigateSpy: ReturnType<typeof vi.fn>;
  let usuarioService: UsuarioService;

  beforeEach(() => {
    localStorage.clear();
    routerNavigateSpy = vi.fn();
    const routerMock = {
      url: '/tienda/mis-compras',
      navigate: routerNavigateSpy,
    };

    TestBed.configureTestingModule({
      providers: [
        UsuarioService,
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerMock },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    usuarioService = TestBed.inject(UsuarioService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('adjunta el header Authorization cuando hay token y la ruta es de la API', () => {
    localStorage.setItem('auth_token', 'token-valido-123');

    http.get('/api/carrito').subscribe();

    const req = httpMock.expectOne('/api/carrito');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-valido-123');
    req.flush({});
  });

  it('no adjunta Authorization si no hay token en localStorage', () => {
    http.get('/api/productos').subscribe();

    const req = httpMock.expectOne('/api/productos');
    expect(req.request.headers.has('Authorization')).toBeFalsy();
    req.flush({});
  });

  it('no sobreescribe un header Authorization ya existente', () => {
    localStorage.setItem('auth_token', 'token-local');

    http
      .get('/api/admin/recurso', {
        headers: { Authorization: 'Bearer token-manual' },
      })
      .subscribe();

    const req = httpMock.expectOne('/api/admin/recurso');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-manual');
    req.flush({});
  });

  it('en error 401 cierra la sesion y redirige a login con returnUrl', () => {
    localStorage.setItem('auth_token', 'token-expirado');
    localStorage.setItem('user_role', 'cliente');
    const logoutSpy = vi.spyOn(usuarioService, 'logout');

    let responseError: HttpErrorResponse | null = null;
    http.get('/api/auth/cuenta').subscribe({
      next: () => {},
      error: (error: HttpErrorResponse) => {
        responseError = error;
      },
    });

    const req = httpMock.expectOne('/api/auth/cuenta');
    req.flush({ mensaje: 'Sesión expirada' }, { status: 401, statusText: 'Unauthorized' });

    expect(responseError).not.toBeNull();
    expect((responseError as unknown as HttpErrorResponse).status).toBe(401);
    expect(logoutSpy).toHaveBeenCalled();
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/bienvenido/login'], {
      queryParams: { returnUrl: '/tienda/mis-compras' },
    });
  });

  it('no redirige a login si el error 401 provino de /api/auth/login', () => {
    http.post('/api/auth/login', { email: 'a@b.com', password: '123' }).subscribe({
      next: () => {},
      error: () => {},
    });

    const req = httpMock.expectOne('/api/auth/login');
    req.flush({ mensaje: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });

    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });
});
