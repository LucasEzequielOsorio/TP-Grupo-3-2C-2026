import { pool, transaction } from '../db.js';
import {
  buscarFavorito,
  buscarProductoActivo,
  buscarProductosFavoritos,
  bloquearUsuarioFavoritos,
  eliminarFavorito,
  insertarFavorito,
} from '../repositories/favoritos.repository.js';
import { httpError } from '../validation.js';

export async function obtenerFavoritos(usuarioId) {
  const filas = await buscarProductosFavoritos(usuarioId);
  return filas.map((producto) => ({
    ...producto,
    imagen_url: producto.imagen_url || '',
    activo: Boolean(producto.activo),
    stock: Number(producto.stock_disponible),
    cantidad_variantes: Number(producto.cantidad_variantes),
  }));
}

export async function agregarFavorito(usuarioId, productoId) {
  return transaction(async (db) => {
    await bloquearUsuarioFavoritos(db, usuarioId);

    if (!(await buscarProductoActivo(db, productoId)))
      throw httpError(404, 'El producto no está disponible');

    const yaEsFavorito = await buscarFavorito(db, usuarioId, productoId);
    if (!yaEsFavorito) await insertarFavorito(db, usuarioId, productoId);

    return { producto_id: productoId, favorito: true, creado: !yaEsFavorito };
  });
}

export async function quitarFavorito(usuarioId, productoId) {
  return transaction(async (db) => {
    await bloquearUsuarioFavoritos(db, usuarioId);
    await eliminarFavorito(db, usuarioId, productoId);

    return { producto_id: productoId, favorito: false };
  });
}
