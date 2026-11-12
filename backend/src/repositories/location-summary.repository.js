import { pool } from '../db.js';

const inventoryFrom = `FROM variantes_producto v JOIN productos p ON p.id=v.producto_id
  JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id
  JOIN categorias cat ON cat.id=p.categoria_id
  LEFT JOIN existencias e ON e.variante_id=v.id AND e.ubicacion_id=?`;

function activeCondition(locationActive) {
  return `p.activo=1 AND v.activo=1 AND ${locationActive ? '1=1' : '1=0'}`;
}

function inventoryFilter(query, locationActive) {
  const where = ['1=1'];
  const values = [query.locationId];
  if (query.buscar) {
    where.push(
      '(LOCATE(?,p.nombre)>0 OR LOCATE(?,v.sku)>0 OR LOCATE(?,t.nombre)>0 OR LOCATE(?,c.nombre)>0)',
    );
    values.push(...Array(4).fill(query.buscar));
  }
  if (query.estado === 'con_stock') where.push('COALESCE(e.cantidad,0)>0');
  if (query.estado === 'bajo')
    where.push(`${activeCondition(locationActive)} AND COALESCE(e.cantidad,0)<=v.stock_minimo`);
  if (query.estado === 'agotado')
    where.push(`${activeCondition(locationActive)} AND COALESCE(e.cantidad,0)=0`);
  if (query.estado === 'inactivos') where.push('(p.activo=0 OR v.activo=0)');

  return { where: `WHERE ${where.join(' AND ')}`, values };
}

export async function findLocationById(db, id) {
  const [rows] = await db.execute('SELECT * FROM ubicaciones WHERE id=?', [id]);
  return rows[0] ?? null;
}

export async function findLocationStockStats(db, id, locationActive) {
  const active = activeCondition(locationActive);
  const [rows] = await db.execute(
    `SELECT COALESCE(SUM(COALESCE(e.cantidad,0)),0) AS unidades,
    COUNT(DISTINCT CASE WHEN e.cantidad>0 THEN p.id END) AS productos_con_stock,
    COUNT(CASE WHEN e.cantidad>0 THEN 1 END) AS variantes_con_stock,
    COUNT(CASE WHEN ${active} AND COALESCE(e.cantidad,0)<=v.stock_minimo THEN 1 END) AS alertas,
    COUNT(CASE WHEN ${active} AND COALESCE(e.cantidad,0)=0 THEN 1 END) AS agotadas
    ${inventoryFrom}`,
    [id],
  );
  return rows[0];
}

export async function countLocationInventory(db, query, locationActive) {
  const filter = inventoryFilter(query, locationActive);
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total ${inventoryFrom} ${filter.where}`,
    filter.values,
  );
  return Number(rows[0].total);
}

export async function findLocationInventory(db, query, locationActive, offset, limit = 30) {
  const filter = inventoryFilter(query, locationActive);
  const [rows] = await db.execute(
    `SELECT v.id AS variante_id,p.id AS producto_id,p.nombre AS producto,cat.nombre AS clasificacion,v.sku,t.nombre AS talle,c.nombre AS color,
    p.activo AS producto_activo,v.activo AS variante_activa,COALESCE(e.cantidad,0) AS cantidad,v.stock_minimo
    ${inventoryFrom} ${filter.where} ORDER BY p.nombre,v.id LIMIT ${limit} OFFSET ${offset}`,
    filter.values,
  );
  return rows;
}

export async function findLocationTransitTotals(db, id) {
  const [rows] = await db.execute(
    `SELECT COALESCE(SUM(CASE WHEN tr.origen_id=? THEN i.cantidad ELSE 0 END),0) AS saliendo,
    COALESCE(SUM(CASE WHEN tr.destino_id=? THEN i.cantidad ELSE 0 END),0) AS entrando
    FROM transferencias tr JOIN transferencia_items i ON i.transferencia_id=tr.id
    WHERE tr.estado='en_transito' AND (tr.origen_id=? OR tr.destino_id=?)`,
    [id, id, id, id],
  );
  return rows[0];
}
