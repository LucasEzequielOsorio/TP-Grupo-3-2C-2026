import { Component, inject, OnInit, signal } from '@angular/core';
import { DatosCompra } from '../../interfaces/datos-compra';
import { TiendaService } from '../../../../api/services/tienda.service';

@Component({
  imports: [],
  selector: 'app-mis-compras',
  styleUrl: './mis-compras.css',
  templateUrl: './mis-compras.html',
})
export class MisCompras implements OnInit{
  tiendaService = inject(TiendaService);
  compras = signal<DatosCompra[]>([]);

  ngOnInit(): void {
    this.tiendaService.getCompras().subscribe({
      next: (res)=>
      {
        this.compras.set(res);
      }
    })
  }
}
