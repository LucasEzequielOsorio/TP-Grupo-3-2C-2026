import { Component, inject, OnInit, signal } from '@angular/core';
import { applyEach, form, min, validate, FormField } from '@angular/forms/signals';
import { TiendaService } from '../../../../api/services/tienda.service';
import { ItemCarrito } from '../../interfaces/item-carrito';
import { CurrencyPipe } from '@angular/common';

@Component({
  imports: [FormField, CurrencyPipe],
  selector: 'app-carrito',
  styleUrl: './carrito.css',
  templateUrl: './carrito.html',
})
export class Carrito implements OnInit{

  carrito = signal<{ items: ItemCarrito[]}>({items:[]});
  carritoForm = form(this.carrito, (path)=>
  {
    applyEach(path.items, (itemPath)=>{
      min(itemPath.cantidad, 1);
      validate(itemPath.cantidad, ({ value, valueOf})=>
      {
        const stock = valueOf(itemPath.producto.stock);
        if(value() > stock)
          return {
            kind: "stock",
            message: "No hay suficiente stock"
          };
          return null;
      });
    });
  });

  tiendaService = inject(TiendaService);
  ngOnInit()
  {
    this.tiendaService.getCarrito().subscribe({
      next: (res:ItemCarrito[])=>{
        this.carrito.set({items: res});
      }
    })
  }
  IniciarCompra(event:Event)
  {
    event.preventDefault();
    const itemsActuales = this.carrito().items;

    if (itemsActuales.length === 0) {
      console.warn('El carrito está vacío');
      return;
    }

    // Llamamos al servicio para crear la preferencia de pago
    this.tiendaService.crearPreferencia(itemsActuales).subscribe({
      next: (res) => {
        if (res && res.init_point) {
          window.location.href = res.init_point;
        }
      },
      error: (err) => {
        console.error('Error al iniciar el proceso de compra:', err);
      }
    });
  }
}
