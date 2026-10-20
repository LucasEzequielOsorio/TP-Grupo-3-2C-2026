import { Component, inject, OnInit } from '@angular/core';
import { DatosProducto } from '../../interfaces/datos-producto';
import { UsuarioService } from '../../../../api/services/usuario.service';
import { Observable, async} from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { ProductCard } from '../../components/product-card/product-card';
import { TiendaService } from '../../../../api/services/tienda.service';
import { Router } from '@angular/router';

@Component({
  imports: [AsyncPipe, ProductCard],
  selector: 'app-productos',
  styleUrl: './productos.css',
  templateUrl: './productos.html',
})
export class Productos implements OnInit {
  tiendaService = inject(TiendaService);
  router = inject(Router);
  productos!:Observable<DatosProducto[]>;

  ngOnInit()
  {
    this.productos = this.tiendaService.getProductos();
  }

  AgregarAlCarrito(id:number)
  {

  }
  VerProducto(id:number)
  {
    this.router.navigate(['tienda/producto/' + id])
  }
}
