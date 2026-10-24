import { inject, Service } from '@angular/core';
import { DatosFormularioUsuario } from '../../modules/usuario/interfaces/datos-formulario-usuario';
import { delay, Observable, of} from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { DatosFormularioPerfil } from '../../modules/perfil/interfaces/datos-formulario-perfil';
import { DatosProducto } from '../../modules/tienda/interfaces/datos-producto';

export interface Usuario
{
  id:string;
  email:string;
  rol:string;
}
export interface RespuestaAuth{
    token:string;
    usuario:Usuario;
    mensaje?:string;
}
export interface RespuestaCargaPerfil{
  exito:boolean;
  mensaje?:string;
}
@Service()
export class UsuarioService {
  cargarPerfil(datos:DatosFormularioPerfil)
  {
    return of({
      exito:true
    });
  }
  hasProfile()
  {
    return this.isLogged()? this.getProfile() !== null : false;
  }
  getProfile():Observable<DatosFormularioPerfil>
  {
    return of({
      nombre:'Lucas',
      apellido:'Osorio',
      fechaNacimiento:'dd/mm/yyyy',
      direccion:{
        calle:'Brandsen',
        altura:805,
        localidad: 'Buenos Aires',
        codigoPostal:'C1161AAQ'
      }
    });
  }
  isLogged()
  {
    return localStorage.getItem('auth_token') !== null;
  }
  isAdmin() {
    return localStorage.getItem('user_role') === 'admin';
  }
  logout()
  {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
  }

  private http = inject(HttpClient);
  registrarUsuario(usuario:DatosFormularioUsuario):Observable<RespuestaAuth>
  {
    //return this.http.post<RespuestaAuth>('${this.apiUrl}/registro', usuario); algo así sería al final (a chequear)

    //para probar caso feliz:
    return of({
      token: '12323.123123.12123',
      usuario:{
        id:'1',
        email:'a@a.com',
        rol:'client'
      }
    }).pipe(delay(1500));


    //para probar el cataclismo
    /*return timer(1500).pipe(
      switchMap(() => throwError(()=> new Error('rompiste todo amiguito')))
    )*/
  }

  iniciarSesion(usuario:DatosFormularioUsuario):Observable<RespuestaAuth>
  {

    //De nuevo: caso bien:
      return of({
        token:'123.123.123',
        usuario:{
          id:'1',
          email:'a@a.com',
          rol:'client'
        }
      }).pipe(delay(1500));

      //Caso tragedia:
      /*return timer(1500).pipe(
        switchMap(() => throwError(()=> new Error('rompiste todo amiguito')))
    )*/
  }
}
