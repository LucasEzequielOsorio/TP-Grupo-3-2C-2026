import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Location } from '@angular/common';
import { of, Subject, throwError } from 'rxjs';
import { Recuperacion } from './recuperacion';
import { UsuarioService } from '../../../../api/services/usuario.service';
describe('Recuperación de contraseña', () => {
  let api: {
    solicitarRecuperacion: ReturnType<typeof vi.fn>;
    restablecerPassword: ReturnType<typeof vi.fn>;
    verificarRecuperacion: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  function setup(
    restablecer = false,
    token = 'a'.repeat(64),
    verification: any = of({ valido: true }),
  ) {
    api = {
      solicitarRecuperacion: vi.fn(() =>
        of({ mensaje: 'Si existe una cuenta recibirás un correo.' }),
      ),
      restablecerPassword: vi.fn(() => of({ mensaje: 'Contraseña actualizada.' })),
      verificarRecuperacion: vi.fn(() => verification),
      logout: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [Recuperacion],
      providers: [
        provideRouter([]),
        { provide: UsuarioService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { restablecer }, fragment: token ? 'token=' + token : null },
          },
        },
        { provide: Location, useValue: { replaceState: vi.fn() } },
      ],
    });
    return TestBed.createComponent(Recuperacion);
  }
  it('solicita el enlace normalizando el email y muestra la respuesta neutra', () => {
    const c = setup().componentInstance;
    c.email.set(' CLIENTE@EXAMPLE.COM ');
    c.solicitar();
    expect(api.solicitarRecuperacion).toHaveBeenCalledWith('cliente@example.com');
    expect(c.mensaje()).toContain('Si existe');
    expect(c.ocupado()).toBe(false);
  });
  it('quita el token de la URL y exige coincidencia y complejidad', () => {
    const c = setup(true).componentInstance;
    expect(TestBed.inject(Location).replaceState).toHaveBeenCalledWith('/bienvenido/restablecer');
    c.password.set('debil');
    c.repeticion.set('debil');
    c.guardar();
    expect(api.restablecerPassword).not.toHaveBeenCalled();
    c.password.set('Nueva2026$&*+');
    c.repeticion.set('Distinta2026!');
    c.guardar();
    expect(api.restablecerPassword).not.toHaveBeenCalled();
    c.repeticion.set(c.password());
    c.guardar();
    expect(api.restablecerPassword).toHaveBeenCalledWith('a'.repeat(64), 'Nueva2026$&*+');
    expect(api.logout).toHaveBeenCalled();
    expect(c.password()).toBe('');
    expect(c.completo()).toBe(true);
  });
  it('no envía una contraseña cuando falta el token', () => {
    const c = setup(true, '').componentInstance;
    c.password.set('Nueva2026!');
    c.repeticion.set('Nueva2026!');
    c.guardar();
    expect(c.enlaceValido()).toBe(false);
    expect(api.restablecerPassword).not.toHaveBeenCalled();
    expect(api.verificarRecuperacion).not.toHaveBeenCalled();
  });
  it('oculta el formulario y bloquea el guardado mientras verifica el enlace', () => {
    const pending = new Subject();
    const fixture = setup(true, 'a'.repeat(64), pending);
    const c = fixture.componentInstance;
    fixture.detectChanges();
    expect(c.verificando()).toBe(true);
    expect(fixture.nativeElement.querySelector('#recuperacion-password')).toBeNull();
    c.password.set('Nueva2026!');
    c.repeticion.set('Nueva2026!');
    c.guardar();
    expect(api.restablecerPassword).not.toHaveBeenCalled();
    pending.next({ valido: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#recuperacion-password')).not.toBeNull();
  });
  it('al reabrir un enlace usado muestra el aviso sin campos de contraseña', () => {
    const fixture = setup(
      true,
      'a'.repeat(64),
      throwError(() => ({
        status: 400,
        error: { mensaje: 'El enlace ya fue utilizado, venció o no es válido.' },
      })),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ya fue utilizado');
    expect(fixture.nativeElement.querySelector('#recuperacion-password')).toBeNull();
    expect(api.restablecerPassword).not.toHaveBeenCalled();
  });
  it('permite reintentar si la comprobación falla por conexión', () => {
    const c = setup(
      true,
      'a'.repeat(64),
      throwError(() => ({ status: 0 })),
    ).componentInstance;
    expect(c.falloVerificacion()).toBe(true);
    api.verificarRecuperacion.mockReturnValue(of({ valido: true }));
    c.verificar();
    expect(c.falloVerificacion()).toBe(false);
    expect(c.enlaceValido()).toBe(true);
  });
  it('bloquea doble envío y muestra el error de un enlace vencido', () => {
    const c = setup(true).componentInstance;
    const pending = new Subject();
    api.restablecerPassword.mockReturnValue(pending);
    c.password.set('Nueva2026!');
    c.repeticion.set('Nueva2026!');
    c.guardar();
    c.guardar();
    expect(api.restablecerPassword).toHaveBeenCalledTimes(1);
    pending.error({ status: 400, error: { mensaje: 'El enlace es inválido o venció.' } });
    expect(c.enlaceValido()).toBe(false);
    expect(c.ocupado()).toBe(false);
  });
});
