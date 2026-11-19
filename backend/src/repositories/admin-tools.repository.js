import { pool } from '../db.js';

const catalogFields = {
  categorias: ['nombre'],
  talles: ['nombre', 'orden'],
  colores: ['nombre', 'hexadecimal'],
};

export async function insertCatalogEntry(type, data, db = pool) {
  const fields = catalogFields[type];
  const [created] = await db.execute(
    `INSERT INTO ${type} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
    fields.map((field) => data[field]),
  );
  return created.insertId;
}

export async function updateCatalogEntry(type, id, data, db = pool) {
  const fields = catalogFields[type];
  const [result] = await db.execute(
    `UPDATE ${type} SET ${fields.map((field) => `${field}=?`).join(',')} WHERE id=?`,
    [...fields.map((field) => data[field]), id],
  );
  return result.affectedRows > 0;
}

export async function findStockAlerts(locationId, db = pool) {
  const [rows] = await db.execute(
    `SELECT p.id AS producto_id, p.nombre AS producto, v.id AS variante_id, v.sku,
    t.nombre AS talle, c.nombre AS color, u.id AS ubicacion_id, u.nombre AS ubicacion,
    COALESCE(e.cantidad, 0) AS cantidad, v.stock_minimo
    FROM variantes_producto v JOIN productos p ON p.id=v.producto_id
    JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id
    CROSS JOIN ubicaciones u LEFT JOIN existencias e ON e.variante_id=v.id AND e.ubicacion_id=u.id
    WHERE p.activo=1 AND v.activo=1 AND u.activo=1
      AND COALESCE(e.cantidad, 0)<=v.stock_minimo ${locationId ? 'AND u.id=?' : ''}
    ORDER BY cantidad, p.nombre, v.id, u.id`,
    locationId ? [locationId] : [],
  );
  return rows;
}

function stockHistoryFilter(query) {
  const filters = ['1=1'];
  const values = [];
  for (const [value, column] of [
    [query.producto_id, 'p.id'],
    [query.ubicacion_id, 'u.id'],
    [query.motivo, 'm.motivo'],
  ]) {
    if (value) {
      filters.push(`${column}=?`);
      values.push(value);
    }
  }
  if (query.buscar) {
    filters.push('(LOCATE(?, p.nombre)>0 OR LOCATE(?, v.sku)>0)');
    values.push(query.buscar, query.buscar);
  }
  return {
    from: `FROM movimientos_stock m JOIN variantes_producto v ON v.id=m.variante_id
      JOIN productos p ON p.id=v.producto_id JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id
      JOIN ubicaciones u ON u.id=m.ubicacion_id LEFT JOIN usuarios actor ON actor.id=m.usuario_id
      WHERE ${filters.join(' AND ')}`,
    values,
  };
}

export async function countStockMovements(query, db = pool) {
  const { from, values } = stockHistoryFilter(query);
  const [rows] = await db.execute(`SELECT COUNT(*) AS total ${from}`, values);
  return Number(rows[0].total);
}

export async function findStockMovements(query, offset, limit = 30, db = pool) {
  const { from, values } = stockHistoryFilter(query);
  const [rows] = await db.execute(
    `SELECT m.id, m.creado_en, m.cantidad, m.motivo, m.observacion, m.causa_ajuste,
    p.nombre AS producto, p.id AS producto_id, v.sku, t.nombre AS talle, c.nombre AS color,
    u.nombre AS ubicacion, COALESCE(CONCAT(actor.nombre, ' ', actor.apellido), 'Sistema') AS usuario
    ${from} ORDER BY m.id DESC LIMIT ${limit} OFFSET ${offset}`,
    values,
  );
  return rows;
}
