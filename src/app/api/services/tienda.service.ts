import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatosProducto } from '../../modules/tienda/interfaces/datos-producto';
import { Observable, of } from 'rxjs';
import { ItemCarrito } from '../../modules/tienda/interfaces/item-carrito';
import { DatosCompra } from '../../modules/tienda/interfaces/datos-compra';

export interface RespuestaCrearPreferencia
{
  id:string,
  init_point:string
}
export interface RespuestaAgregarAlCarrito
{
  exito:boolean
}
@Service()
export class TiendaService {
  private http = inject(HttpClient);
  getCompras():Observable<DatosCompra[]>
  {
    return of();
  }
  crearPreferencia(items:ItemCarrito[]):Observable<RespuestaCrearPreferencia>
  {
    return of();
  }
  getProductos():Observable<DatosProducto[]>
    {
      return this.http.get<DatosProducto[]>('/api/productos');
    }
  getProducto(id:number):Observable<DatosProducto>
  {
    return this.http.get<DatosProducto>(`/api/productos/${id}`);
  }
  agregarAlCarrito(id:number):Observable<RespuestaAgregarAlCarrito>
  {
    return of({
        exito:true
      });
  }
  getCarrito():Observable<ItemCarrito[]>
  {
    return of([
      {
        producto: {
        id:0,
        nombre:'producto genial',
        descripcion:'descripcion genial',
        precio:2606,
        stock:15
        },
        cantidad: 3
      }
    ]);
  }
}
