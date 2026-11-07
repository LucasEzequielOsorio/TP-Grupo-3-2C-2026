import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MiCuenta } from './mi-cuenta';
import { UsuarioService } from '../../../../api/services/usuario.service';

describe('Mi cuenta', () => {
  const usuario = {
    id: '1',
    nombre: 'Ana',
    apellido: 'Prueba',
    email: 'ana@example.invalid',
    direccion: 'Calle 123',
    rol: 'cliente',
  };
  let api: { getCuenta: ReturnType<typeof vi.fn>; actualizarCuenta: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    api = {
      getCuenta: vi.fn(() => of({ usuario })),
      actualizarCuenta: vi.fn(() => of({ usuario: { ...usuario, nombre: 'Nuevo' } })),
    };
    TestBed.configureTestingModule({
      imports: [MiCuenta],
      providers: [
        provideRouter([]),
        {
          provide: UsuarioService,
          useValue: { ...api, isLogged: () => true, isAdmin: () => false },
        },
      ],
    });
  });
  it('carga datos reales y limpia los cambios al guardar', () => {
    const c = TestBed.createComponent(MiCuenta).componentInstance;
    expect(c.datos().nombre).toBe('Ana');
    expect(c.tieneCambios()).toBe(false);
    c.editar('nombre', 'Nuevo');
    expect(c.tieneCambios()).toBe(true);
    c.guardar();
    expect(api.actualizarCuenta).toHaveBeenCalledWith({ ...c.datos() });
    expect(c.tieneCambios()).toBe(false);
    expect(c.mensaje()).toContain('correctamente');
  });
  it('exige contraseña actual para cambiar email y valida repetición y complejidad', () => {
    const c = TestBed.createComponent(MiCuenta).componentInstance;
    c.editar('email', 'otro@example.invalid');
    c.guardar();
    expect(api.actualizarCuenta).not.toHaveBeenCalled();
    c.actual.set('Anterior123$');
    c.nueva.set('corta');
    c.repeticion.set('corta');
    c.guardar();
    expect(api.actualizarCuenta).not.toHaveBeenCalled();
    c.nueva.set('Nueva123$&*+');
    c.repeticion.set('NoCoincide123$');
    expect(c.errorPassword()).toContain('no coinciden');
    c.repeticion.set('Nueva123$&*+');
    expect(c.errorPassword()).toBe('');
  });
  it('conserva los datos ante un error y permite descartarlos', () => {
    api.actualizarCuenta.mockReturnValue(
      throwError(() => ({ status: 409, error: { mensaje: 'El email ya está registrado' } })),
    );
    const c = TestBed.createComponent(MiCuenta).componentInstance;
    c.editar('nombre', 'Otro');
    c.guardar();
    expect(c.error()).toContain('registrado');
    expect(c.datos().nombre).toBe('Otro');
    expect(c.enProceso()).toBe(false);
    c.descartar();
    expect(c.datos().nombre).toBe('Ana');
    expect(c.tieneCambios()).toBe(false);
  });
});
