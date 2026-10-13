import { Routes } from "@angular/router";
import { loggedGuard } from "../../core/guards/logged-guard";
import { ConfigurarPerfil } from "./pages/configurar-perfil/configurar-perfil";
import { EditarPerfil } from "./pages/editar-perfil/editar-perfil";

export const perfilRoutes:Routes = [
  {
    path: '',
    canActivate: [loggedGuard],
    children:[
      {
        path: 'configurar-perfil',
        component: ConfigurarPerfil
      },
      {
        path: 'editar-perfil',
        component: EditarPerfil
      }
    ]
  }
]
