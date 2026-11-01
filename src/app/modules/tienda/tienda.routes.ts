import { Routes } from '@angular/router';
import { loggedGuard } from '../../core/guards/logged-guard';
import { Productos } from './pages/productos/productos';
import { VerProducto } from './pages/ver-producto/ver-producto';
import { Carrito } from './pages/carrito/carrito';
import { Pedidos } from './pages/mis-compras/pedidos';
export const tiendaRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'productos',
        component: Productos,
      },
      {
        path: 'producto/:id',
        component: VerProducto,
      },
      {
        path: 'carrito',
        component: Carrito,
        canActivate: [loggedGuard],
      },
      { path: 'pedidos', component: Pedidos, canActivate: [loggedGuard] },
      { path: 'pedidos/:id', component: Pedidos, canActivate: [loggedGuard] },
      {
        path: '',
        redirectTo: 'productos',
        pathMatch: 'full',
      },
    ],
  },
];
