import { Routes } from '@angular/router';
import { unloggedGuard } from './guards/unlogged-guard';
import { InicioDeSesion } from './pages/inicio-de-sesion/inicio-de-sesion';
import { Registro } from './pages/registro/registro';
import { Recuperacion } from './pages/recuperacion/recuperacion';

export const usuarioRoutes: Routes = [
  { path: 'recuperar', component: Recuperacion },
  { path: 'restablecer', component: Recuperacion, data: { restablecer: true } },
  {
    path: '',
    canActivate: [unloggedGuard],
    children: [
      {
        path: 'login',
        component: InicioDeSesion,
      },
      {
        path: 'signup',
        component: Registro,
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
    ],
  },
];
