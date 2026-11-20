import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { UsuarioService } from '../../api/services/usuario.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('auth_token');
  const router = inject(Router);
  const injector = inject(Injector);

  let authReq = req;

  // Adjunta el token de autenticación a peticiones internas de la API si no tienen encabezado explícito
  if (
    token &&
    (req.url.startsWith('/api') || req.url.startsWith('api/')) &&
    !req.headers.has('Authorization')
  ) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !req.url.includes('/api/auth/login')
      ) {
        try {
          const usuarioService = injector.get(UsuarioService);
          usuarioService.logout();
        } catch {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_role');
        }

        const returnUrl = router.url;
        if (!router.url.includes('/bienvenido/login')) {
          router.navigate(['/bienvenido/login'], {
            queryParams: returnUrl && returnUrl !== '/' ? { returnUrl } : undefined,
          });
        }
      }
      return throwError(() => error);
    }),
  );
};
