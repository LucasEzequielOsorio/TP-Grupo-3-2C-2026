import { pool } from '../db.js';

const marks = (values) => values.map(() => '?').join(',');

const summaryQuery = `SELECT tr.*,o.nombre AS origen,d.nombre AS destino,CONCAT(u.nombre,' ',u.apellido) AS creado_por_nombre,
 (SELECT SUM(i.cantidad) FROM transferencia_items i WHERE i.transferencia_id=tr.id) AS unidades,
 (SELECT COUNT(*) FROM transferencia_items i WHERE i.transferencia_id=tr.id) AS variantes
 FROM transferencias tr JOIN ubicaciones o ON o.id=tr.origen_id JOIN ubicaciones d ON d.id=tr.destino_id JOIN usuarios u ON u.id=tr.creado_por`;

export async function findTransferForUpdate(db, id) {
  const [rows] = await db.execute('SELECT * FROM transferencias WHERE id=? FOR UPDATE', [id]);
  return rows[0] ?? null;
}

export async function findTransferItems(db, id) {
  const [rows] = await db.execute(
    'SELECT * FROM transferencia_items WHERE transferencia_id=? ORDER BY variante_id',
    [id],
  );
  return rows;
}

export async function lockTransferResources(db, items, locations) {
  const variantIds = items.map((item) => item.variante_id).sort((a, b) => a - b);
  const [refs] = await db.execute(
    `SELECT id,producto_id FROM variantes_producto WHERE id IN (${marks(variantIds)})`,
    variantIds,
  );
  if (refs.length !== items.length)
    return { refs, products: [], variants: [], places: [], stock: [], productIds: [] };
  const productIds = [...new Set(refs.map((variant) => variant.producto_id))].sort(
    (a, b) => a - b,
  );
  const [products] = await db.execute(
    `SELECT id,activo FROM productos WHERE id IN (${marks(productIds)}) ORDER BY id FOR UPDATE`,
    productIds,
  );
  const [variants] = await db.execute(
    `SELECT id,activo FROM variantes_producto WHERE id IN (${marks(variantIds)}) ORDER BY id FOR UPDATE`,
    variantIds,
  );
  const [places] = await db.execute(
    'SELECT id,activo FROM ubicaciones WHERE id IN (?,?) ORDER BY id FOR UPDATE',
    [...locations].sort((a, b) => a - b),
  );
  const [stock] = await db.execute(
    `SELECT * FROM existencias WHERE variante_id IN (${marks(variantIds)}) AND ubicacion_id IN (?,?) ORDER BY variante_id,ubicacion_id FOR UPDATE`,
    [...variantIds, ...locations],
  );
  return { refs, products, variants, places, stock, productIds };
}

export async function findTransferDetail(id, db = pool) {
  const [rows] = await db.execute(`${summaryQuery} WHERE tr.id=?`, [id]);
  if (!rows.length) return null;
  const [items] = await db.execute(
    `SELECT i.*,p.nombre AS producto,v.sku,t.nombre AS talle,c.nombre AS color
    FROM transferencia_items i JOIN variantes_producto v ON v.id=i.variante_id JOIN productos p ON p.id=v.producto_id
    JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id WHERE i.transferencia_id=? ORDER BY i.variante_id`,
    [id],
  );
  return { ...rows[0], unidades: Number(rows[0].unidades), items };
}

export async function countTransfers(query, db = pool) {
  const where = query.estado ? ' WHERE tr.estado=?' : '';
  const values = query.estado ? [query.estado] : [];
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total FROM transferencias tr${where}`,
    values,
  );
  return Number(rows[0].total);
}

export async function findTransfers(query, offset, db = pool) {
  const where = query.estado ? ' WHERE tr.estado=?' : '';
  const values = query.estado ? [query.estado] : [];
  const [rows] = await db.execute(
    `${summaryQuery}${where} ORDER BY tr.id DESC LIMIT 20 OFFSET ${offset}`,
    values,
  );
  return rows.map((transfer) => ({ ...transfer, unidades: Number(transfer.unidades) }));
}

export async function insertTransfer(db, { origen_id, destino_id, userId }) {
  const [created] = await db.execute(
    'INSERT INTO transferencias (origen_id,destino_id,creado_por) VALUES (?,?,?)',
    [origen_id, destino_id, userId],
  );
  return created.insertId;
}

export async function insertTransferItem(db, transferId, { variante_id, cantidad }) {
  await db.execute(
    'INSERT INTO transferencia_items (transferencia_id,variante_id,cantidad) VALUES (?,?,?)',
    [transferId, variante_id, cantidad],
  );
}

export async function updateTransferState(db, id, action) {
  if (action === 'cancelar') {
    await db.execute("UPDATE transferencias SET estado='cancelada' WHERE id=?", [id]);
  } else {
    await db.execute(
      action === 'despachar'
        ? "UPDATE transferencias SET estado='en_transito',despachado_en=CURRENT_TIMESTAMP WHERE id=?"
        : "UPDATE transferencias SET estado='recibida',recibido_en=CURRENT_TIMESTAMP WHERE id=?",
      [id],
    );
  }
}

export async function adjustLocationStock(db, variantId, locationId, previous, difference) {
  if (previous)
    await db.execute(
      'UPDATE existencias SET cantidad=cantidad+? WHERE variante_id=? AND ubicacion_id=?',
      [difference, variantId, locationId],
    );
  else
    await db.execute(
      'INSERT INTO existencias (variante_id,ubicacion_id,cantidad) VALUES (?,?,?)',
      [variantId, locationId, difference],
    );
}

export async function insertTransferStockMovement(
  db,
  { variantId, locationId, difference, userId, transferId, action },
) {
  await db.execute(
    "INSERT INTO movimientos_stock (variante_id,ubicacion_id,cantidad,motivo,usuario_id,transferencia_id,observacion) VALUES (?,?,?,'transferencia',?,?,?)",
    [
      variantId,
      locationId,
      difference,
      userId,
      transferId,
      `${action === 'despachar' ? 'Despacho' : 'Recepción'} de transferencia #${transferId}`,
    ],
  );
}

export async function incrementProductVersions(db, productIds) {
  await db.execute(
    `UPDATE productos SET version=version+1 WHERE id IN (${marks(productIds)})`,
    productIds,
  );
}
