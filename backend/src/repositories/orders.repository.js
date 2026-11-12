import { pool } from '../db.js';

const marks = (values) => values.map(() => '?').join(',');

export async function findDeliveryAddress(userId, db = pool) {
  const [rows] = await db.execute('SELECT direccion FROM usuarios WHERE id=?', [userId]);
  return rows[0].direccion;
}

export async function findOrderByUser(orderId, userId, db = pool) {
  const [rows] = await db.execute('SELECT * FROM pedidos WHERE id=? AND usuario_id=?', [
    orderId,
    userId,
  ]);
  return rows[0] ?? null;
}

export async function findOrderItems(db, orderId) {
  const [rows] = await db.execute(
    'SELECT i.*, COALESCE(d.nombre,p.nombre) AS nombre, COALESCE(d.talle,t.nombre) AS talle,COALESCE(d.color,c.nombre) AS color FROM pedido_items i JOIN variantes_producto v ON v.id=i.variante_id JOIN productos p ON p.id=v.producto_id JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id LEFT JOIN pedido_detalles d ON d.item_id=i.id WHERE i.pedido_id=? ORDER BY i.id',
    [orderId],
  );
  return rows;
}

export async function findOrdersByUser(userId, db = pool) {
  const [rows] = await db.execute(
    'SELECT p.id,p.estado,p.creado_en,SUM(i.cantidad) AS unidades,SUM(i.cantidad*i.precio_unitario) AS total FROM pedidos p JOIN pedido_items i ON i.pedido_id=p.id WHERE p.usuario_id=? GROUP BY p.id ORDER BY p.id DESC LIMIT 100',
    [userId],
  );
  return rows;
}

export async function lockOrderUser(db, userId) {
  const [rows] = await db.execute('SELECT direccion FROM usuarios WHERE id=? FOR UPDATE', [
    userId,
  ]);
  return rows[0].direccion;
}

export async function findConfirmedOrder(db, userId, key) {
  const [rows] = await db.execute(
    'SELECT pedido_id FROM pedido_confirmaciones WHERE usuario_id=? AND clave=?',
    [userId, key],
  );
  return rows[0] ?? null;
}

export async function findCartItemsForOrder(db, userId) {
  const [rows] = await db.execute(
    'SELECT ci.*,v.producto_id FROM carrito_items ci JOIN variantes_producto v ON v.id=ci.variante_id WHERE ci.usuario_id=? ORDER BY ci.variante_id',
    [userId],
  );
  return rows;
}

export async function findProductsForUpdate(db, productIds) {
  const [rows] = await db.execute(
    'SELECT id,nombre,precio,activo FROM productos WHERE id IN (' +
      marks(productIds) +
      ') ORDER BY id FOR UPDATE',
    productIds,
  );
  return rows;
}

export async function findVariantsForUpdate(db, variantIds) {
  const [rows] = await db.execute(
    'SELECT v.id,v.activo,t.nombre AS talle,c.nombre AS color FROM variantes_producto v JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id WHERE v.id IN (' +
      marks(variantIds) +
      ') ORDER BY v.id FOR UPDATE',
    variantIds,
  );
  return rows;
}

export async function findActiveLocations(db) {
  const [rows] = await db.execute(
    'SELECT id FROM ubicaciones WHERE activo=1 ORDER BY id FOR SHARE',
  );
  return rows;
}

export async function findStockForUpdate(db, variantIds, locationIds) {
  const [rows] = await db.execute(
    'SELECT * FROM existencias WHERE variante_id IN (' +
      marks(variantIds) +
      ') AND ubicacion_id IN (' +
      marks(locationIds) +
      ') ORDER BY variante_id,ubicacion_id FOR UPDATE',
    [...variantIds, ...locationIds],
  );
  return rows;
}

export async function createOrderRecord(db, userId, address) {
  const [created] = await db.execute(
    "INSERT INTO pedidos(usuario_id,estado,direccion_entrega) VALUES (?,'confirmado',?)",
    [userId, address],
  );
  return created.insertId;
}

export async function createOrderItem(db, orderId, variantId, quantity, price) {
  const [created] = await db.execute(
    'INSERT INTO pedido_items(pedido_id,variante_id,cantidad,precio_unitario) VALUES (?,?,?,?)',
    [orderId, variantId, quantity, price],
  );
  return created.insertId;
}

export async function insertOrderItemDetails(db, itemId, name, size, color) {
  await db.execute('INSERT INTO pedido_detalles(item_id,nombre,talle,color) VALUES (?,?,?,?)', [
    itemId,
    name,
    size,
    color,
  ]);
}

export async function updateOrderStock(db, variantId, locationId, quantity) {
  await db.execute(
    'UPDATE existencias SET cantidad=cantidad-? WHERE variante_id=? AND ubicacion_id=?',
    [quantity, variantId, locationId],
  );
}

export async function insertOrderStockMovement(
  db,
  variantId,
  locationId,
  quantity,
  userId,
  orderId,
) {
  await db.execute(
    "INSERT INTO movimientos_stock(variante_id,ubicacion_id,cantidad,motivo,usuario_id,pedido_id) VALUES (?,?,?,'venta',?,?)",
    [variantId, locationId, -quantity, userId, orderId],
  );
}

export async function incrementOrderProductVersions(db, productIds) {
  await db.execute(
    'UPDATE productos SET version=version+1 WHERE id IN (' + marks(productIds) + ')',
    productIds,
  );
}

export async function insertOrderConfirmation(db, userId, key, orderId) {
  await db.execute(
    'INSERT INTO pedido_confirmaciones(usuario_id,clave,pedido_id) VALUES (?,?,?)',
    [userId, key, orderId],
  );
}

export async function clearOrderCart(db, userId) {
  await db.execute('DELETE FROM carrito_items WHERE usuario_id=?', [userId]);
}
