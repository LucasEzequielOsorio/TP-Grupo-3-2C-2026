import { ItemCarrito } from "./item-carrito"

export interface DatosCompra {
  id:string,
  items:ItemCarrito[],
  fecha:string,
  estado:string
}
