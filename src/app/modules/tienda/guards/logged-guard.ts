import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { UsuarioService } from '../../../api/services/usuario.service';

export const loggedGuard: CanActivateFn = (route, state) => {
  const usuarioService = inject(UsuarioService);
  const router = inject(Router);
  if(usuarioService.isLogged())
    return true;

  return router.createUrlTree(['/bienvenido']);
};
