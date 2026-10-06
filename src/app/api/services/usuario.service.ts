import { inject, Service } from '@angular/core';
import { DatosFormularioUsuario } from '../../modules/usuario/interfaces/datos-formulario-usuario';
import { delay, Observable, of, switchMap, throwError, timer } from 'rxjs';
import { HttpClient, HttpStatusCode } from '@angular/common/http';

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
@Service()
export class UsuarioService {
  isAdmin() {
    return localStorage.getItem('user_role') === 'admin';
  }

  private http = inject(HttpClient);
  registrarUsuario(usuario:DatosFormularioUsuario):Observable<RespuestaAuth>
  {
    //return this.http.post<RespuestaAuth>('${this.apiUrl}/registro', usuario); algo así sería al final (a chequear)

    //para probar caso feliz:
    /*return of({
      token: '12323.123123.12123',
      usuario:{
        id:'1',
        email:'a@a.com',
        rol:'client'
      }
    }).pipe(delay(1500));*/


    //para probar el cataclismo
    return timer(1500).pipe(
      switchMap(() => throwError(()=> new Error('rompiste todo amiguito')))
    )
  }

  iniciarSesion(usuario:DatosFormularioUsuario):Observable<RespuestaAuth>
  {

    //De nuevo: caso bien:
      /*return of({
        token:'123.123.123',
        usuario:{
          id:'1',
          email:'a@a.com'
          rol:'client'
        }
      }).pipe(delay(1500));*/

      //Caso tragedia:
      return timer(1500).pipe(
        switchMap(() => throwError(()=> new Error('rompiste todo amiguito')))
    )
  }



}
