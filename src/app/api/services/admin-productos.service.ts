import { Service, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

export interface Opcion {
  id: number;
  nombre: string;
}
export interface Catalogos {
  categorias: Opcion[];
  talles: Opcion[];
  colores: Opcion[];
  ubicaciones: Opcion[];
}
export interface Existencia {
  ubicacion_id: number;
  cantidad: number;
}
export interface Variante {
  id?: number;
  talle_id: number;
  color_id: number;
  sku: string;
  activo: boolean;
  existencias: Existencia[];
}
export interface ProductoAdmin {
  id?: number;
  version?: number;
  nombre: string;
  descripcion: string;
  categoria_id: number;
  precio: number;
  imagen_url: string;
  activo: boolean;
  variantes: Variante[];
  clasificacion?: string;
  stock?: number;
  cantidad_variantes?: number;
}
@Service()
export class AdminProductosService {
  private http = inject(HttpClient);
  private options() {
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
      }),
    };
  }
  catalogos() {
    return this.http.get<Catalogos>('/api/admin/catalogos', this.options());
  }
  listar() {
    return this.http.get<ProductoAdmin[]>('/api/admin/productos', this.options());
  }
  obtener(id: number) {
    return this.http.get<ProductoAdmin>(`/api/admin/productos/${id}`, this.options());
  }
  guardar(producto: ProductoAdmin) {
    return producto.id
      ? this.http.put<ProductoAdmin>(
          `/api/admin/productos/${producto.id}`,
          producto,
          this.options(),
        )
      : this.http.post<ProductoAdmin>('/api/admin/productos', producto, this.options());
  }
  subirImagen(archivo: File) {
    return this.http.post<{ imagen_url: string }>('/api/admin/imagenes', archivo, {
      headers: this.options().headers.set('Content-Type', archivo.type),
    });
  }
}
