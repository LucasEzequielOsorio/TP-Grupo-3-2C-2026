export interface DatosProducto {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  clasificacion?: string;
  imagen_url?: string;
  imagenes?: string[];
}
