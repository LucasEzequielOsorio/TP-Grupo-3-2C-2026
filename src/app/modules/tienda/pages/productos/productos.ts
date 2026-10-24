import { Component, inject, OnInit, signal } from '@angular/core';
import { DatosProducto } from '../../interfaces/datos-producto';
import { finalize} from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { ProductCard } from '../../components/product-card/product-card';
import { TiendaService } from '../../../../api/services/tienda.service';
import { Router } from '@angular/router';

@Component({
  imports: [ProductCard],
  selector: 'app-productos',
  styleUrl: './productos.css',
  templateUrl: './productos.html',
})
export class Productos implements OnInit {
  tiendaService = inject(TiendaService);
  router = inject(Router);
  productos= signal<DatosProducto[]>([]);

  ngOnInit()
  {
    this.tiendaService.getProductos().subscribe({
      next: (res:DatosProducto[])=>
      {
        this.productos.set(res);
      }
    });
  }

  AgregarAlCarrito(id:number, card:ProductCard)
  {
    this.tiendaService.agregarAlCarrito(id).pipe(finalize(()=>{
      card.finalizarCarritoEvent()
    })).subscribe({
      next: (res)=>
      {

      }
    });
  }
  VerProducto(id:number)
  {
    this.router.navigate(['tienda/producto/' + id])
  }
}
