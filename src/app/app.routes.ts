import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path:'tienda',
    loadChildren: () => import('./modules/tienda/tienda.routes').then(m => m.tiendaRoutes)
  },
  {
    path: 'admin',
    loadChildren: () => import('./modules/admin/admin.routes').then(m => m.routes)
  },
  {
    path: 'bienvenido',
    loadChildren: () => import('./modules/usuario/usuario.routes').then(m => m.usuarioRoutes)
  },
  {
    path: 'perfil',
    loadChildren: () => import('./modules/perfil/perfil.routes').then(m => m.perfilRoutes)
  },
  {
    path: '',
    redirectTo: 'bienvenido',
    pathMatch: 'full'
  }
];
