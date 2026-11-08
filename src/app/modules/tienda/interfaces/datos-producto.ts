export interface DatosProducto {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  clasificacion?: string;
  imagen_url?: string;
  imagenes?: string[];
  fotos?: { url: string; color_id: number | null }[];
  variantes?: VarianteTienda[];
}
export interface VarianteTienda {
  id: number;
  talle_id: number;
  color_id: number;
  talle: string;
  color: string;
  hexadecimal: string | null;
  existencias: { ubicacion_id: number; cantidad: number }[];
}
