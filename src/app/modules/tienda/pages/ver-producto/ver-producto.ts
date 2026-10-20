import { Component, numberAttribute, OnInit, input, effect, inject, signal } from '@angular/core';
import { DatosProducto } from '../../interfaces/datos-producto';
import { TiendaService } from '../../../../api/services/tienda.service';
import { CurrencyPipe } from '@angular/common';

@Component({
  imports: [CurrencyPipe],
  selector: 'app-ver-producto',
  styleUrl: './ver-producto.css',
  templateUrl: './ver-producto.html',
})
export class VerProducto{
  tiendaService = inject(TiendaService);
  id = input<number, string | number | undefined>(undefined, { transform: numberAttribute });
  producto = signal<DatosProducto | null>(null);
  constructor()
  {
    effect(()=>{
      const productoId = this.id();
      if(productoId !== undefined && productoId !== null && !isNaN(productoId))
      this.tiendaService.getProducto(productoId).subscribe({
      next: (res:DatosProducto)=>
      {
        this.producto.set(res);
      }
    });
    });
  }


}
