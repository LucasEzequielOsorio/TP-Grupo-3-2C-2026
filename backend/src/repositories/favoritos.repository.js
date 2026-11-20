import { pool } from '../db.js';
import { listQuery as consultaProductos } from './products.repository.js';

export async function buscarProductosFavoritos(usuarioId, db = pool) {
  const [filas] = await db.execute(
    `SELECT catalogo.*, favoritos.creado_en AS favorito_creado_en
    FROM (${consultaProductos}) catalogo
    JOIN favoritos ON favoritos.producto_id = catalogo.id
    WHERE favoritos.usuario_id = ? AND catalogo.activo = 1
    ORDER BY favoritos.creado_en DESC, favoritos.id DESC`,
    [usuarioId],
  );
  return filas;
}

export async function bloquearUsuarioFavoritos(db, usuarioId) {
  await db.execute('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [usuarioId]);
}

export async function buscarProductoActivo(db, productoId) {
  const [filas] = await db.execute(
    'SELECT id FROM productos WHERE id = ? AND activo = 1 FOR SHARE',
    [productoId],
  );
  return filas[0] ?? null;
}

export async function buscarFavorito(db, usuarioId, productoId) {
  const [filas] = await db.execute(
    'SELECT id FROM favoritos WHERE usuario_id = ? AND producto_id = ?',
    [usuarioId, productoId],
  );
  return filas[0] ?? null;
}

export async function insertarFavorito(db, usuarioId, productoId) {
  await db.execute('INSERT INTO favoritos (usuario_id, producto_id) VALUES (?, ?)', [
    usuarioId,
    productoId,
  ]);
}

export async function eliminarFavorito(db, usuarioId, productoId) {
  await db.execute('DELETE FROM favoritos WHERE usuario_id = ? AND producto_id = ?', [
    usuarioId,
    productoId,
  ]);
}
