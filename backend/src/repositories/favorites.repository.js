import { pool } from '../db.js';

export async function listFavoriteIds(userId, db = pool) {
  const [rows] = await db.execute(
    'SELECT producto_id FROM favoritos WHERE usuario_id = ? ORDER BY creado_en DESC, id DESC',
    [userId],
  );
  return rows.map((row) => Number(row.producto_id));
}

export async function lockFavoriteOwner(db, userId) {
  await db.execute('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [userId]);
}

export async function findActiveFavoriteProduct(db, productId) {
  const [rows] = await db.execute(
    'SELECT id FROM productos WHERE id = ? AND activo = 1',
    [productId],
  );
  return rows[0] ?? null;
}

export async function hasFavorite(db, userId, productId) {
  const [rows] = await db.execute(
    'SELECT id FROM favoritos WHERE usuario_id = ? AND producto_id = ?',
    [userId, productId],
  );
  return rows.length > 0;
}

export async function addFavorite(db, userId, productId) {
  await db.execute('INSERT INTO favoritos (usuario_id, producto_id) VALUES (?, ?)', [
    userId,
    productId,
  ]);
}

export async function removeFavorite(db, userId, productId) {
  await db.execute('DELETE FROM favoritos WHERE usuario_id = ? AND producto_id = ?', [
    userId,
    productId,
  ]);
}
