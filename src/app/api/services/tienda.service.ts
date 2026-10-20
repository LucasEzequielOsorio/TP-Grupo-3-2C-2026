import { Service } from '@angular/core';
import { DatosProducto } from '../../modules/tienda/interfaces/datos-producto';
import { Observable, of } from 'rxjs';

@Service()
export class TiendaService {
  getProductos():Observable<DatosProducto[]>
    {
      return of([
        {
          id:0,
          nombre:'producto genial',
          descripcion:'descripcion genial',
          precio:2606,
          stock:1
        }
      ]);
    }
  getProducto(id:number):Observable<DatosProducto>
  {
    return of({
        id:0,
        nombre:'producto genial',
        descripcion:'descripcion genial',
        precio:2606,
        stock:1
      });
  }
}
