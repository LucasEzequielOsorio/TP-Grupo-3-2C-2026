import { Routes } from "@angular/router"
import { loggedGuard } from "./guards/logged-guard"
import { Registro } from "../usuario/pages/registro/registro"
export const tiendaRoutes:Routes = [
  {
    path: '',
    canActivate: [loggedGuard],
    component: Registro
  }
]
