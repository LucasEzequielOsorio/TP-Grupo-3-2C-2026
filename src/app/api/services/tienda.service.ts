import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatosProducto } from '../../modules/tienda/interfaces/datos-producto';
import { of } from 'rxjs';
import { DatosCompra } from '../../modules/tienda/interfaces/datos-compra';

export interface LineaCarrito {
  variante_id: number;
  producto_id: number;
  nombre: string;
  talle: string;
  color: string;
  imagen_url: string;
  precio: number;
  cantidad: number;
  stock: number;
  activo: boolean;
  subtotal: number;
}
export interface PedidoResumen {
  id: number;
  estado: string;
  creado_en: string;
  total: number;
  unidades: number;
}
export interface PedidoDetalle extends PedidoResumen {
  direccion_entrega: string;
  items: {
    id: number;
    nombre: string;
    talle: string;
    color: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
}
export interface CarritoRespuesta {
  items: LineaCarrito[];
  total: number;
  unidades: number;
}
@Service()
export class TiendaService {
  getPedidos() {
    return this.http.get<PedidoResumen[]>('/api/pedidos', this.options);
  }
  getPedido(id: number) {
    return this.http.get<PedidoDetalle>('/api/pedidos/' + id, this.options);
  }
  getEntrega() {
    return this.http.get<{ direccion: string }>('/api/pedidos/entrega', this.options);
  }
  confirmarPedido(clave: string, items: LineaCarrito[]) {
    return this.http.post<PedidoDetalle>(
      '/api/pedidos',
      {
        clave,
        items: items.map((i) => ({
          variante_id: i.variante_id,
          cantidad: i.cantidad,
          precio: i.precio,
        })),
      },
      this.options,
    );
  }
  private http = inject(HttpClient);
  private get options() {
    return { headers: { Authorization: 'Bearer ' + (localStorage.getItem('auth_token') || '') } };
  }
  getCompras() {
    return of<DatosCompra[]>([]);
  }
  getProductos() {
    return this.http.get<DatosProducto[]>('/api/productos');
  }
  getProducto(id: number) {
    return this.http.get<DatosProducto>('/api/productos/' + id);
  }
  agregarAlCarrito(varianteId: number, cantidad: number) {
    return this.http.post<CarritoRespuesta>(
      '/api/carrito/items/' + varianteId,
      { cantidad },
      this.options,
    );
  }
  getCarrito() {
    return this.http.get<CarritoRespuesta>('/api/carrito', this.options);
  }
  actualizarCantidad(id: number, cantidad: number) {
    return this.http.put<CarritoRespuesta>('/api/carrito/items/' + id, { cantidad }, this.options);
  }
  eliminarDelCarrito(id: number) {
    return this.http.delete<CarritoRespuesta>('/api/carrito/items/' + id, this.options);
  }
}
