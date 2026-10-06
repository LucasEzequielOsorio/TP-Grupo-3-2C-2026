import { Routes } from '@angular/router';
import { Registro } from './modules/usuario/pages/registro/registro';
import { InicioDeSesion } from './modules/usuario/pages/inicio-de-sesion/inicio-de-sesion';

export const routes: Routes = [
  {
    path:'',
    component: Registro
  },
  {
    path:'registrarse',
    component: Registro
  },
  {
    path:'login',
    component: InicioDeSesion
  },
  {
    path: 'admin',
    loadChildren: () => import('./modules/admin/admin.routes').then(m => m.routes)
  }
];
