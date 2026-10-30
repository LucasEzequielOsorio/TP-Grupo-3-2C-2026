import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin-guard';
import { ProductosAdmin } from './pages/productos-admin';
import { ProductoEditor } from './pages/producto-editor';

export const routes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'productos', pathMatch: 'full' },
      { path: 'productos', component: ProductosAdmin },
      { path: 'productos/nuevo', component: ProductoEditor },
      { path: 'productos/:id/editar', component: ProductoEditor },
    ],
  },
];
