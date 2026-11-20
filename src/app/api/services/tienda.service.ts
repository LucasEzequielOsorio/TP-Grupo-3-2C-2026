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
export interface CatalogoRespuesta {
  items: DatosProducto[];
  total: number;
  pagina: number;
  paginas: number;
  por_pagina: number;
  categorias: string[];
}
export interface PedidoResumen {
  id: number;
  estado: string;
  pago_estado?: string;
  reserva_hasta?: string | null;
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
export interface RespuestaFavorito {
  producto_id: number;
  favorito: boolean;
  creado?: boolean;
}
@Service()
export class TiendaService {
  obtenerFavoritos() {
    return this.http.get<DatosProducto[]>('/api/favoritos');
  }
  agregarFavorito(productoId: number) {
    return this.http.post<RespuestaFavorito>('/api/favoritos/' + productoId, {});
  }
  eliminarFavorito(productoId: number) {
    return this.http.delete<RespuestaFavorito>('/api/favoritos/' + productoId);
  }
  iniciarPago(id: number) {
    return this.http.post<{ checkout_url: string }>('/api/pedidos/' + id + '/pagar', {});
  }
  sincronizarPago(id: number) {
    return this.http.post<PedidoDetalle>('/api/pedidos/' + id + '/sincronizar', {});
  }
  cancelarPedido(id: number) {
    return this.http.post<PedidoDetalle>('/api/pedidos/' + id + '/cancelar', {});
  }
  pagosRevision() {
    return this.http.get<{ id: number; email: string; pago_estado: string; total: number }[]>(
      '/api/admin/pagos-revision',
    );
  }
  getPedidos() {
    return this.http.get<PedidoResumen[]>('/api/pedidos');
  }
  getPedido(id: number) {
    return this.http.get<PedidoDetalle>('/api/pedidos/' + id);
  }
  getEntrega() {
    return this.http.get<{ direccion: string }>('/api/pedidos/entrega');
  }
  confirmarPedido(clave: string, items: LineaCarrito[]) {
    return this.http.post<PedidoDetalle>('/api/pedidos', {
      clave,
      items: items.map((i) => ({
        variante_id: i.variante_id,
        cantidad: i.cantidad,
        precio: i.precio,
      })),
    });
  }
  private http = inject(HttpClient);
  getCompras() {
    return of<DatosCompra[]>([]);
  }
  getProductos(params: {
    pagina: number;
    buscar: string;
    categoria: string;
    orden: string;
    solo_stock: string;
  }) {
    return this.http.get<CatalogoRespuesta>('/api/productos', { params });
  }
  getProducto(id: number) {
    return this.http.get<DatosProducto>('/api/productos/' + id);
  }
  agregarAlCarrito(varianteId: number, cantidad: number) {
    return this.http.post<CarritoRespuesta>('/api/carrito/items/' + varianteId, { cantidad });
  }
  getCarrito() {
    return this.http.get<CarritoRespuesta>('/api/carrito');
  }
  actualizarCantidad(id: number, cantidad: number) {
    return this.http.put<CarritoRespuesta>('/api/carrito/items/' + id, { cantidad });
  }
  eliminarDelCarrito(id: number) {
    return this.http.delete<CarritoRespuesta>('/api/carrito/items/' + id);
  }
}
