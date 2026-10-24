import { Routes } from "@angular/router"
import { loggedGuard } from "../../core/guards/logged-guard"
import { Productos } from "./pages/productos/productos"
import { VerProducto } from "./pages/ver-producto/ver-producto"
import { Carrito } from "./pages/carrito/carrito"
export const tiendaRoutes:Routes = [
  {
    path: '',
    canActivate: [loggedGuard],
    children:[
      {
        path: 'productos',
        component: Productos
      },
      {
        path: 'producto/:id',
        component: VerProducto
      },
      {
        path: 'carrito',
        component: Carrito
      },
      {
        path: '',
        redirectTo: 'productos',
        pathMatch: "full"
      }
    ]
  }
]
