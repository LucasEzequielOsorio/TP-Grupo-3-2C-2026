import { pool } from '../db.js';

export async function getCartRowsByUser(userId, db = pool) {
  const [rows] = await db.execute(
    `SELECT ci.variante_id, ci.cantidad, v.producto_id,
    t.nombre AS talle, c.nombre AS color, p.nombre, p.precio,
    (p.activo AND v.activo) AS activo,
    COALESCE((SELECT SUM(e.cantidad-e.reservada) FROM existencias e JOIN ubicaciones u ON u.id=e.ubicacion_id
      WHERE e.variante_id=v.id AND u.activo=1),0) AS stock,
    COALESCE((SELECT i.url FROM producto_imagenes i WHERE i.producto_id=p.id
      AND (i.color_id=v.color_id OR i.color_id IS NULL)
      ORDER BY (i.color_id=v.color_id) DESC, i.orden LIMIT 1),'') AS imagen_url
    FROM carrito_items ci JOIN variantes_producto v ON v.id=ci.variante_id
    JOIN productos p ON p.id=v.producto_id JOIN talles t ON t.id=v.talle_id
    JOIN colores c ON c.id=v.color_id WHERE ci.usuario_id=? ORDER BY ci.variante_id`,
    [userId],
  );

  return rows;
}

export async function lockCartOwner(db, userId) {
  await db.execute('SELECT id FROM usuarios WHERE id=? FOR UPDATE', [userId]);
}

export async function findActiveVariant(db, variantId) {
  const [rows] = await db.execute(
    'SELECT producto_id FROM variantes_producto WHERE id=? AND activo=1',
    [variantId],
  );

  return rows[0] ?? null;
}

export async function findCartItem(db, userId, variantId) {
  const [rows] = await db.execute(
    'SELECT cantidad FROM carrito_items WHERE usuario_id=? AND variante_id=?',
    [userId, variantId],
  );

  return rows[0] ?? null;
}

export async function upsertCartItem(db, userId, variantId, cantidad) {
  await db.execute(
    'INSERT INTO carrito_items (usuario_id,variante_id,cantidad) VALUES (?,?,?) ON DUPLICATE KEY UPDATE cantidad=?',
    [userId, variantId, cantidad, cantidad],
  );
}

export async function deleteCartItem(db, userId, variantId) {
  await db.execute('DELETE FROM carrito_items WHERE usuario_id=? AND variante_id=?', [
    userId,
    variantId,
  ]);
}
