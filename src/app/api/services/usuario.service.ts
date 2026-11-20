import { inject, Service, signal } from '@angular/core';
import { DatosFormularioUsuario } from '../../modules/usuario/interfaces/datos-formulario-usuario';
import { Observable, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface Usuario {
  id: string;
  email: string;
  rol: string;
}
export interface RespuestaAuth {
  token: string;
  usuario: Usuario;
  mensaje?: string;
}
export interface CuentaUsuario extends Usuario {
  nombre: string;
  apellido: string;
  direccion: string;
}
export interface ActualizacionCuenta {
  email: string;
  nombre: string;
  apellido: string;
  direccion: string;
  password_actual?: string;
  password_nueva?: string;
}
@Service()
export class UsuarioService {
  private readonly estadoSesion = signal(this.tokenVigente());
  readonly sesionActiva = this.estadoSesion.asReadonly();

  verificarRecuperacion(token: string) {
    return this.http.post<{ valido: boolean }>('/api/auth/verificar-recuperacion', { token });
  }
  solicitarRecuperacion(email: string) {
    return this.http.post<{ mensaje: string }>('/api/auth/recuperar', { email });
  }
  restablecerPassword(token: string, password: string) {
    return this.http.post<{ mensaje: string }>('/api/auth/restablecer', { token, password });
  }
  getCuenta() {
    return this.http.get<{ usuario: CuentaUsuario }>('/api/auth/cuenta');
  }
  actualizarCuenta(datos: ActualizacionCuenta) {
    return this.http
      .put<RespuestaAuth & { usuario: CuentaUsuario }>('/api/auth/cuenta', datos)
      .pipe(
        tap((res) => {
          this.guardarSesion(res.token, res.usuario.rol);
        }),
      );
  }
  isLogged() {
    return this.estadoSesion() && this.tokenVigente();
  }
  isAdmin() {
    return this.isLogged() && localStorage.getItem('user_role') === 'admin';
  }
  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    this.estadoSesion.set(false);
  }
  guardarSesion(token: string, rol?: string | null) {
    localStorage.setItem('auth_token', token);
    if (rol) localStorage.setItem('user_role', rol);
    else localStorage.removeItem('user_role');
    this.estadoSesion.set(this.tokenVigente(token));
  }
  private tokenVigente(token = localStorage.getItem('auth_token')) {
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  private http = inject(HttpClient);
  getSesion() {
    return this.http.get<{ usuario: Usuario }>('/api/auth/me');
  }
  registrarUsuario(usuario: DatosFormularioUsuario): Observable<RespuestaAuth> {
    return this.http.post<RespuestaAuth>('/api/auth/registro', usuario);
  }

  iniciarSesion(usuario: DatosFormularioUsuario): Observable<RespuestaAuth> {
    return this.http.post<RespuestaAuth>('/api/auth/login', usuario).pipe(
      tap((res) => {
        this.guardarSesion(res.token, res.usuario.rol);
      }),
    );
  }
}
