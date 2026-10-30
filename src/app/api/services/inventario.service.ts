import { Service, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
export interface Ubicacion {
  id?: number;
  nombre: string;
  tipo: 'deposito' | 'tienda';
  direccion: string;
  activo: boolean;
  unidades?: number;
}
export interface StockUbicacion {
  variante_id: number;
  producto_id: number;
  producto: string;
  sku: string;
  talle: string;
  color: string;
  cantidad: number;
}
export interface ItemTransferencia {
  variante_id: number;
  cantidad: number;
  producto?: string;
  sku?: string;
  talle?: string;
  color?: string;
}
export interface BorradorTransferencia {
  origen_id: number;
  destino_id: number;
  items: ItemTransferencia[];
}
export interface Transferencia {
  id: number;
  origen_id: number;
  destino_id: number;
  origen: string;
  destino: string;
  estado: 'borrador' | 'en_transito' | 'recibida' | 'cancelada';
  unidades: number;
  variantes: number;
  creado_por_nombre: string;
  creado_en: string;
  despachado_en: string | null;
  recibido_en: string | null;
  items?: ItemTransferencia[];
}
export interface ListaTransferencias {
  items: Transferencia[];
  total: number;
  pagina: number;
  paginas: number;
}
@Service()
export class InventarioService {
  private http = inject(HttpClient);
  private options() {
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
      }),
    };
  }
  ubicaciones() {
    return this.http.get<Ubicacion[]>('/api/admin/ubicaciones', this.options());
  }
  guardarUbicacion(data: Ubicacion) {
    return data.id
      ? this.http.put<Ubicacion>(`/api/admin/ubicaciones/${data.id}`, data, this.options())
      : this.http.post<Ubicacion>('/api/admin/ubicaciones', data, this.options());
  }
  stock(id: number) {
    return this.http.get<StockUbicacion[]>(`/api/admin/ubicaciones/${id}/stock`, this.options());
  }
  transferencias(pagina = 1, estado = '') {
    return this.http.get<ListaTransferencias>('/api/admin/transferencias', {
      ...this.options(),
      params: { pagina, ...(estado ? { estado } : {}) },
    });
  }
  transferencia(id: number) {
    return this.http.get<Transferencia>(`/api/admin/transferencias/${id}`, this.options());
  }
  crear(data: BorradorTransferencia) {
    return this.http.post<Transferencia>('/api/admin/transferencias', data, this.options());
  }
  accion(id: number, accion: string) {
    return this.http.post<Transferencia>(
      `/api/admin/transferencias/${id}/${accion}`,
      {},
      this.options(),
    );
  }
}
