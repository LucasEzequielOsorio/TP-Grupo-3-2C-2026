import { pool } from '../db.js';

const listQuery = `SELECT p.*, c.nombre AS clasificacion,
  COALESCE((SELECT SUM(e.cantidad) FROM variantes_producto v
    JOIN existencias e ON e.variante_id = v.id
    JOIN ubicaciones u ON u.id = e.ubicacion_id
    WHERE v.producto_id = p.id AND v.activo = 1 AND u.activo = 1), 0) AS stock,
    COALESCE((SELECT SUM(e.cantidad-e.reservada) FROM variantes_producto v JOIN existencias e ON e.variante_id=v.id JOIN ubicaciones u ON u.id=e.ubicacion_id WHERE v.producto_id=p.id AND v.activo=1 AND u.activo=1),0) AS stock_disponible,
  (SELECT COUNT(*) FROM variantes_producto v WHERE v.producto_id = p.id) AS cantidad_variantes
  FROM productos p JOIN categorias c ON c.id = p.categoria_id`;

export async function findProducts({ admin = false, db = pool } = {}) {
  const [rows] = await db.execute(
    `${listQuery} ${admin ? '' : 'WHERE p.activo = 1'} ORDER BY p.id DESC`,
  );
  return rows;
}

export async function findProductDetails(id, admin = false, db = pool) {
  const [products] = await db.execute(
    `${listQuery} WHERE p.id = ? ${admin ? '' : 'AND p.activo = 1'}`,
    [id],
  );
  if (!products.length) return null;

  const [images] = await db.execute(
    'SELECT url,color_id FROM producto_imagenes WHERE producto_id = ? ORDER BY orden',
    [id],
  );
  const [variants] = await db.execute(
    `SELECT v.*, t.nombre AS talle, c.nombre AS color, c.hexadecimal
    FROM variantes_producto v JOIN talles t ON t.id = v.talle_id JOIN colores c ON c.id = v.color_id
    WHERE v.producto_id = ? ${admin ? '' : 'AND v.activo = 1'} ORDER BY v.id`,
    [id],
  );
  const [stock] = await db.execute(
    `SELECT e.* FROM existencias e
    JOIN variantes_producto v ON v.id = e.variante_id JOIN ubicaciones u ON u.id = e.ubicacion_id
    WHERE v.producto_id = ? ${admin ? '' : 'AND u.activo = 1 AND v.activo = 1'} ORDER BY e.ubicacion_id`,
    [id],
  );

  return { product: products[0], images, variants, stock };
}

export async function findCatalogs(db = pool) {
  const [categorias] = await db.execute('SELECT * FROM categorias ORDER BY nombre');
  const [talles] = await db.execute('SELECT * FROM talles ORDER BY orden, id');
  const [colores] = await db.execute('SELECT * FROM colores ORDER BY nombre');
  const [ubicaciones] = await db.execute(
    'SELECT * FROM ubicaciones WHERE activo = 1 ORDER BY id',
  );
  return { categorias, talles, colores, ubicaciones };
}

export async function findProductVersionForUpdate(db, id) {
  const [rows] = await db.execute('SELECT version FROM productos WHERE id = ? FOR UPDATE', [id]);
  return rows[0] ?? null;
}

export async function findProductReferences(db, categoriaId) {
  const [categories] = await db.execute('SELECT id FROM categorias WHERE id = ?', [categoriaId]);
  const [sizes] = await db.execute('SELECT id FROM talles');
  const [colors] = await db.execute('SELECT id FROM colores');
  const [locations] = await db.execute(
    'SELECT id FROM ubicaciones WHERE activo = 1 ORDER BY id FOR SHARE',
  );
  return { categories, sizes, colors, locations };
}

export async function createProduct(db, fields) {
  const [created] = await db.execute(
    'INSERT INTO productos (nombre, descripcion, categoria_id, precio, imagen_url, activo) VALUES (?, ?, ?, ?, ?, ?)',
    fields,
  );
  return created.insertId;
}

export async function updateProduct(db, fields, id) {
  await db.execute(
    'UPDATE productos SET nombre=?, descripcion=?, categoria_id=?, precio=?, imagen_url=?, activo=?, version=version+1 WHERE id=?',
    [...fields, id],
  );
}

export async function findProductVariantsForUpdate(db, productId) {
  const [rows] = await db.execute(
    'SELECT * FROM variantes_producto WHERE producto_id = ? ORDER BY id FOR UPDATE',
    [productId],
  );
  return rows;
}

export async function updateProductVariant(db, { sku, activo, stock_minimo, id }) {
  await db.execute(
    'UPDATE variantes_producto SET sku=?, activo=?, stock_minimo=? WHERE id=?',
    [sku, activo, stock_minimo, id],
  );
}

export async function createProductVariant(db, { productId, talle_id, color_id, sku, activo, stock_minimo }) {
  const [created] = await db.execute(
    'INSERT INTO variantes_producto (producto_id, talle_id, color_id, sku, activo, stock_minimo) VALUES (?, ?, ?, ?, ?, ?)',
    [productId, talle_id, color_id, sku, activo, stock_minimo],
  );
  return created.insertId;
}

export async function findVariantStockForUpdate(db, variantId) {
  const [rows] = await db.execute(
    'SELECT * FROM existencias WHERE variante_id = ? ORDER BY ubicacion_id FOR UPDATE',
    [variantId],
  );
  return rows;
}

export async function createStock(db, { variantId, locationId, cantidad }) {
  await db.execute(
    'INSERT INTO existencias (variante_id, ubicacion_id, cantidad) VALUES (?, ?, ?)',
    [variantId, locationId, cantidad],
  );
}

export async function updateStock(db, { variantId, locationId, cantidad }) {
  await db.execute(
    'UPDATE existencias SET cantidad=? WHERE variante_id=? AND ubicacion_id=?',
    [cantidad, variantId, locationId],
  );
}

export async function createStockMovement(
  db,
  { variantId, locationId, difference, reason, userId, observation, adjustmentCause },
) {
  await db.execute(
    'INSERT INTO movimientos_stock (variante_id, ubicacion_id, cantidad, motivo, usuario_id, observacion, causa_ajuste) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [variantId, locationId, difference, reason, userId, observation, adjustmentCause],
  );
}

export async function findProductPhotos(db, productId) {
  const [rows] = await db.execute(
    'SELECT url,color_id FROM producto_imagenes WHERE producto_id=? ORDER BY orden',
    [productId],
  );
  return rows;
}

export async function replaceProductPhotos(db, productId, photos) {
  await db.execute('DELETE FROM producto_imagenes WHERE producto_id = ?', [productId]);
  for (const [order, photo] of photos.entries())
    await db.execute(
      'INSERT INTO producto_imagenes (producto_id, url, orden,color_id) VALUES (?, ?, ?, ?)',
      [productId, photo.url, order, photo.color_id],
    );
}
