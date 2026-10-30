import { Service, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

export interface Opcion {
  id: number;
  nombre: string;
  orden?: number;
  hexadecimal?: string | null;
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
  stock_minimo?: number;
  id?: number;
  talle_id: number;
  color_id: number;
  sku: string;
  activo: boolean;
  existencias: Existencia[];
}
export interface ProductoAdmin {
  ajuste_stock?: { motivo: string; observacion: string };
  id?: number;
  version?: number;
  nombre: string;
  descripcion: string;
  categoria_id: number;
  precio: number;
  imagen_url: string;
  imagenes?: string[];
  fotos?: { url: string; color_id: number | null }[];
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
  guardarCatalogo(
    tipo: string,
    datos: Opcion | { nombre: string; orden?: number; hexadecimal?: string | null },
    id?: number,
  ) {
    return id
      ? this.http.put<Opcion>(`/api/admin/catalogos/${tipo}/${id}`, datos, this.options())
      : this.http.post<Opcion>(`/api/admin/catalogos/${tipo}`, datos, this.options());
  }
  alertas(ubicacion?: number) {
    return this.http.get<AlertaStock[]>('/api/admin/stock-alertas', {
      ...this.options(),
      params: ubicacion ? { ubicacion_id: ubicacion } : {},
    });
  }
  movimientos(params: Record<string, string | number>) {
    return this.http.get<Historial>('/api/admin/movimientos', { ...this.options(), params });
  }
}
export interface AlertaStock {
  producto_id: number;
  variante_id: number;
  producto: string;
  sku: string;
  talle: string;
  color: string;
  ubicacion: string;
  ubicacion_id: number;
  cantidad: number;
  stock_minimo: number;
}
export interface Movimiento {
  causa_ajuste?: string | null;
  id: number;
  creado_en: string;
  cantidad: number;
  motivo: string;
  observacion: string;
  producto: string;
  producto_id: number;
  sku: string;
  talle: string;
  color: string;
  ubicacion: string;
  usuario: string;
}
export interface Historial {
  items: Movimiento[];
  total: number;
  pagina: number;
  paginas: number;
}
