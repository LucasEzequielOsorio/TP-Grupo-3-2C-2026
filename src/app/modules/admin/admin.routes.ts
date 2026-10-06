import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin-guard';

export const routes: Routes = [{
  path: '',
  canActivate: [adminGuard],
  children:[
  {

  }]
}
];
