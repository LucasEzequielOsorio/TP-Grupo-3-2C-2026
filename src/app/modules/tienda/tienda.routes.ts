import { Routes } from "@angular/router"
import { loggedGuard } from "../../core/guards/logged-guard"
import { Productos } from "./pages/productos/productos"
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
        path: '',
        redirectTo: 'productos',
        pathMatch: "full"

      }
    ]
  }
]
