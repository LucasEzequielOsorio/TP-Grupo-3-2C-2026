import { Component, numberAttribute, OnInit, input, effect, inject, signal, computed } from '@angular/core';
import { DatosProducto } from '../../interfaces/datos-producto';
import { TiendaService } from '../../../../api/services/tienda.service';
import { CurrencyPipe } from '@angular/common';
import { AgregarAlCarritoButton } from '../../components/agregar-al-carrito-button/agregar-al-carrito-button';

@Component({
  imports: [CurrencyPipe, AgregarAlCarritoButton],
  selector: 'app-ver-producto',
  styleUrl: './ver-producto.css',
  templateUrl: './ver-producto.html',
})
export class VerProducto{
  tiendaService = inject(TiendaService);
  id = input<number, string | number | undefined>(undefined, { transform: numberAttribute });
  producto = signal<DatosProducto>({id:-1, nombre: "", descripcion: "", precio: 0, stock: -1});
  waitingForCarritoEvent = signal<boolean>(false);
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
  disponible = computed(()=>{
    return this.producto() && this.producto()!.stock > 0;
  });

  agregarAlCarrito()
  {
    this.tiendaService.agregarAlCarrito(this.producto().id);
  }
}
