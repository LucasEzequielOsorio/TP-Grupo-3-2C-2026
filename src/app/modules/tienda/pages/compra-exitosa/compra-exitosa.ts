import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  imports: [],
  selector: 'app-compra-exitosa',
  styleUrl: './compra-exitosa.css',
  templateUrl: './compra-exitosa.html',
})
export class CompraExitosa {
  router = inject(Router);
  IrAMisCompras()
  {
    this.router.navigate(["./mis-compras"])
  }
}
