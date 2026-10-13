import { Routes } from "@angular/router";
import { unloggedGuard } from "./guards/unlogged-guard";
import { InicioDeSesion } from "./pages/inicio-de-sesion/inicio-de-sesion";
import { Registro } from "./pages/registro/registro";

export const usuarioRoutes:Routes = [
{
  path: '',
  canActivate: [unloggedGuard],
  children:[
    {
      path: 'login',
      component: InicioDeSesion
    },
    {
      path: 'signup',
      component: Registro
    },
    {
      path: '',
      redirectTo: 'login',
      pathMatch: 'full'
    }
  ]
}
]
