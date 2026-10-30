import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin-guard';
import { ProductosAdmin } from './pages/productos-admin';
import { ProductoEditor } from './pages/producto-editor';
import { InventarioAdmin } from './pages/inventario-admin';
import { CatalogosAdmin } from './pages/catalogos-admin';
import { pendientesGuard } from './pendientes-guard';
import { UbicacionesAdmin } from './pages/ubicaciones-admin';
import { TransferenciasAdmin } from './pages/transferencias-admin';
import { UbicacionResumen } from './pages/ubicacion-resumen';

export const routes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'productos', pathMatch: 'full' },
      { path: 'productos', component: ProductosAdmin },
      { path: 'productos/nuevo', component: ProductoEditor, canDeactivate: [pendientesGuard] },
      { path: 'productos/:id/editar', component: ProductoEditor, canDeactivate: [pendientesGuard] },
      { path: 'alertas', component: InventarioAdmin, data: { modo: 'alertas' } },
      { path: 'movimientos', component: InventarioAdmin, data: { modo: 'movimientos' } },
      { path: 'catalogos', component: CatalogosAdmin, canDeactivate: [pendientesGuard] },
      { path: 'ubicaciones', component: UbicacionesAdmin, canDeactivate: [pendientesGuard] },
      { path: 'ubicaciones/:id', component: UbicacionResumen },
      { path: 'transferencias', component: TransferenciasAdmin, canDeactivate: [pendientesGuard] },
    ],
  },
];
