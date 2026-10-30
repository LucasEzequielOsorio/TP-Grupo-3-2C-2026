import { inject, Service } from '@angular/core';
import { DatosFormularioUsuario } from '../../modules/usuario/interfaces/datos-formulario-usuario';
import { Observable, of, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { DatosFormularioPerfil } from '../../modules/perfil/interfaces/datos-formulario-perfil';
import { DatosProducto } from '../../modules/tienda/interfaces/datos-producto';

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
export interface RespuestaCargaPerfil {
  exito: boolean;
  mensaje?: string;
}
@Service()
export class UsuarioService {
  cargarPerfil(datos: DatosFormularioPerfil) {
    return of({
      exito: true,
    });
  }
  hasProfile() {
    return this.isLogged() ? this.getProfile() !== null : false;
  }
  getProfile(): Observable<DatosFormularioPerfil> {
    return of({
      nombre: 'Lucas',
      apellido: 'Osorio',
      fechaNacimiento: 'dd/mm/yyyy',
      direccion: {
        calle: 'Brandsen',
        altura: 805,
        localidad: 'Buenos Aires',
        codigoPostal: 'C1161AAQ',
      },
    });
  }
  isLogged() {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.exp * 1000 > Date.now()) return true;
    } catch {
      /* Las sesiones simuladas anteriores no son válidas. */
    }
    this.logout();
    return false;
  }
  isAdmin() {
    return this.isLogged() && localStorage.getItem('user_role') === 'admin';
  }
  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
  }

  private http = inject(HttpClient);
  getSesion() {
    return this.http.get<{ usuario: Usuario }>('/api/auth/me', {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}` },
    });
  }
  registrarUsuario(usuario: DatosFormularioUsuario): Observable<RespuestaAuth> {
    return this.http.post<RespuestaAuth>('/api/auth/registro', usuario);
  }

  iniciarSesion(usuario: DatosFormularioUsuario): Observable<RespuestaAuth> {
    return this.http.post<RespuestaAuth>('/api/auth/login', usuario).pipe(
      tap((res) => {
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('user_role', res.usuario.rol);
      }),
    );
  }
}
