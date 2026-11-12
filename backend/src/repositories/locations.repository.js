import { pool } from '../db.js';

export async function findLocations(db = pool) {
  const [rows] = await db.execute(
    `SELECT u.*, COALESCE((SELECT SUM(e.cantidad) FROM existencias e WHERE e.ubicacion_id=u.id),0) AS unidades
    FROM ubicaciones u ORDER BY activo DESC,nombre`,
  );
  return rows;
}

export async function insertLocation(data, db = pool) {
  const [result] = await db.execute(
    'INSERT INTO ubicaciones (nombre,tipo,direccion,activo) VALUES (?,?,?,?)',
    [data.nombre, data.tipo, data.direccion, data.activo],
  );
  return result.insertId;
}

export async function lockLocation(db, id) {
  const [rows] = await db.execute('SELECT id FROM ubicaciones WHERE id=? FOR UPDATE', [id]);
  return rows[0] ?? null;
}

export async function sumLocationStock(db, id) {
  const [rows] = await db.execute(
    'SELECT COALESCE(SUM(cantidad),0) AS total FROM existencias WHERE ubicacion_id=?',
    [id],
  );
  return Number(rows[0].total);
}

export async function hasPendingLocationTransfers(db, id) {
  const [rows] = await db.execute(
    "SELECT id FROM transferencias WHERE (origen_id=? OR destino_id=?) AND estado IN ('borrador','en_transito') LIMIT 1",
    [id, id],
  );
  return rows.length > 0;
}

export async function updateLocation(db, id, data) {
  await db.execute(
    'UPDATE ubicaciones SET nombre=?,tipo=?,direccion=?,activo=? WHERE id=?',
    [data.nombre, data.tipo, data.direccion, data.activo, id],
  );
}

export async function findActiveLocation(id, db = pool) {
  const [rows] = await db.execute('SELECT id FROM ubicaciones WHERE id=? AND activo=1', [id]);
  return rows[0] ?? null;
}

export async function findLocationStock(id, db = pool) {
  const [rows] = await db.execute(
    `SELECT v.id AS variante_id,p.id AS producto_id,p.nombre AS producto,v.sku,t.nombre AS talle,c.nombre AS color,e.cantidad
    FROM existencias e JOIN variantes_producto v ON v.id=e.variante_id JOIN productos p ON p.id=v.producto_id
    JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id
    WHERE e.ubicacion_id=? AND e.cantidad>0 AND v.activo=1 AND p.activo=1 ORDER BY p.nombre,v.id`,
    [id],
  );
  return rows;
}
