import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin-guard';

export const routes: Routes = [{
  path: '',
  canActivate: [adminGuard],
  children:[
  {

  }]
}
];
