import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { UsuarioService } from '../../api/services/usuario.service';

export const profileGuard: CanActivateFn = (route, state) => {
  const usuarioService = inject(UsuarioService)
  return true;
};
