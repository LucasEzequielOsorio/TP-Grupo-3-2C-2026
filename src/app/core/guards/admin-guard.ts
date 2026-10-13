import { CanActivateFn, Router } from '@angular/router';
import { UsuarioService } from '../../api/services/usuario.service';
import { inject } from '@angular/core';

export const adminGuard: CanActivateFn = (route, state) => {
  const usuarioService = inject(UsuarioService);
  const router = inject(Router);
  if(usuarioService.isAdmin())
    return true;

  if(usuarioService.isLogged())
    return router.createUrlTree(['/tienda']);

  return router.createUrlTree(['/bienvenido']);
};
