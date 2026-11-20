import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { UsuarioService } from './usuario.service';

describe('UsuarioService', () => {
  let service: UsuarioService;

  beforeEach(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(UsuarioService);
  });

  afterEach(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('actualiza la señal de sesión al iniciar y cerrar sesión', () => {
    const carga = (valor: string) => btoa(valor).replace(/=/g, '');
    const token = `encabezado.${carga(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.firma`;

    expect(service.sesionActiva()).toBe(false);
    service.guardarSesion(token, 'cliente');
    expect(service.sesionActiva()).toBe(true);

    service.logout();
    expect(service.sesionActiva()).toBe(false);
    expect(localStorage.getItem('auth_token')).toBeNull();
  });
});
