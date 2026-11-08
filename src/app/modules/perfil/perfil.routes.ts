import { Routes } from '@angular/router';
import { loggedGuard } from '../../core/guards/logged-guard';
import { MiCuenta } from './pages/editar-perfil/mi-cuenta';
import { pendientesGuard } from '../admin/pendientes-guard';

export const perfilRoutes: Routes = [
  {
    path: '',
    canActivate: [loggedGuard],
    canActivateChild: [loggedGuard],
    children: [
      {
        path: 'configurar-perfil',
        redirectTo: 'mi-cuenta',
        pathMatch: 'full',
      },
      {
        path: 'editar-perfil',
        redirectTo: 'mi-cuenta',
        pathMatch: 'full',
      },
      { path: 'mi-cuenta', component: MiCuenta, canDeactivate: [pendientesGuard] },
      { path: '', redirectTo: 'mi-cuenta', pathMatch: 'full' },
    ],
  },
];
