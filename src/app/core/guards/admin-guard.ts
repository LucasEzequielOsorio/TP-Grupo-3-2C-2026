import { CanActivateFn, Router } from '@angular/router';
import { UsuarioService } from '../../api/services/usuario.service';
import { inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';

export const adminGuard: CanActivateFn = (route, state) => {
  const usuarioService = inject(UsuarioService);
  const router = inject(Router);
  const login = () =>
    router.createUrlTree(['/bienvenido/login'], { queryParams: { returnUrl: state.url } });
  if (!usuarioService.isLogged()) return login();
  // El rol real se consulta al servidor; editar localStorage no concede acceso.
  return usuarioService.getSesion().pipe(
    map((res) => {
      localStorage.setItem('user_role', res.usuario.rol);
      return res.usuario.rol === 'admin' ? true : router.createUrlTree(['/tienda/productos']);
    }),
    catchError((error) => {
      if (error.status === 401) {
        usuarioService.logout();
        return of(login());
      }
      return of(router.createUrlTree(['/tienda/productos']));
    }),
  );
};
