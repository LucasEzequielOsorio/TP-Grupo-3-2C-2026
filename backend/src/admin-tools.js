import { Router } from 'express';
import { z } from 'zod';
import { pool } from './db.js';
import { authenticate, requireAdmin } from './middlewares/auth.middleware.js';
import { httpError, parseId } from './validation.js';

export const toolsRouter = Router();
toolsRouter.use(authenticate, requireAdmin);
// Solo estos nombres constantes pueden formar parte del SQL.
const catalogs = {
  categorias: {
    schema: z.object({ nombre: z.string().trim().min(1).max(80) }),
    fields: ['nombre'],
  },
  talles: {
    schema: z.object({
      nombre: z.string().trim().min(1).max(20),
      orden: z.number().int().min(0).max(65535),
    }),
    fields: ['nombre', 'orden'],
  },
  colores: {
    schema: z.object({
      nombre: z.string().trim().min(1).max(50),
      hexadecimal: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .nullable(),
    }),
    fields: ['nombre', 'hexadecimal'],
  },
};
function catalog(type) {
  if (!Object.hasOwn(catalogs, type)) throw httpError(404, 'Catálogo no encontrado');
  return catalogs[type];
}
toolsRouter.post('/catalogos/:tipo', async (req, res) => {
  const { schema, fields } = catalog(req.params.tipo);
  const data = schema.parse(req.body);
  try {
    const [created] = await pool.execute(
      `INSERT INTO ${req.params.tipo} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
      fields.map((f) => data[f]),
    );
    res.status(201).json({ id: created.insertId, ...data });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw httpError(409, 'Ya existe un registro con ese nombre');
    throw e;
  }
});
toolsRouter.put('/catalogos/:tipo/:id', async (req, res) => {
  const { schema, fields } = catalog(req.params.tipo);
  const id = parseId(req.params.id);
  const data = schema.parse(req.body);
  try {
    const [result] = await pool.execute(
      `UPDATE ${req.params.tipo} SET ${fields.map((f) => `${f}=?`).join(',')} WHERE id=?`,
      [...fields.map((f) => data[f]), id],
    );
    if (!result.affectedRows) throw httpError(404, 'Registro no encontrado');
    res.json({ id, ...data });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw httpError(409, 'Ya existe un registro con ese nombre');
    throw e;
  }
});
toolsRouter.get('/stock-alertas', async (req, res) => {
  const location = req.query.ubicacion_id === undefined ? null : parseId(req.query.ubicacion_id);
  const [rows] = await pool.execute(
    `SELECT p.id AS producto_id, p.nombre AS producto, v.id AS variante_id, v.sku,
    t.nombre AS talle, c.nombre AS color, u.id AS ubicacion_id, u.nombre AS ubicacion,
    COALESCE(e.cantidad, 0) AS cantidad, v.stock_minimo
    FROM variantes_producto v JOIN productos p ON p.id=v.producto_id
    JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id
    CROSS JOIN ubicaciones u LEFT JOIN existencias e ON e.variante_id=v.id AND e.ubicacion_id=u.id
    WHERE p.activo=1 AND v.activo=1 AND u.activo=1
      AND COALESCE(e.cantidad, 0)<=v.stock_minimo ${location ? 'AND u.id=?' : ''}
    ORDER BY cantidad, p.nombre, v.id, u.id`,
    location ? [location] : [],
  );
  res.json(rows);
});
const historyQuery = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  producto_id: z.coerce.number().int().positive().optional(),
  ubicacion_id: z.coerce.number().int().positive().optional(),
  motivo: z.enum(['inicial', 'ajuste', 'venta', 'devolucion', 'transferencia']).optional(),
  buscar: z.string().trim().max(100).default(''),
});
toolsRouter.get('/movimientos', async (req, res) => {
  const q = historyQuery.parse(req.query);
  const filters = ['1=1'];
  const values = [];
  for (const [value, column] of [
    [q.producto_id, 'p.id'],
    [q.ubicacion_id, 'u.id'],
    [q.motivo, 'm.motivo'],
  ]) {
    if (value) {
      filters.push(`${column}=?`);
      values.push(value);
    }
  }
  if (q.buscar) {
    filters.push('(LOCATE(?, p.nombre)>0 OR LOCATE(?, v.sku)>0)');
    values.push(q.buscar, q.buscar);
  }
  const from = `FROM movimientos_stock m JOIN variantes_producto v ON v.id=m.variante_id
    JOIN productos p ON p.id=v.producto_id JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id
    JOIN ubicaciones u ON u.id=m.ubicacion_id LEFT JOIN usuarios actor ON actor.id=m.usuario_id
    WHERE ${filters.join(' AND ')}`;
  const [count] = await pool.execute(`SELECT COUNT(*) AS total ${from}`, values);
  const total = Number(count[0].total);
  const paginas = Math.max(1, Math.ceil(total / 30));
  const pagina = Math.min(q.pagina, paginas);
  const [items] = await pool.execute(
    `SELECT m.id, m.creado_en, m.cantidad, m.motivo, m.observacion, m.causa_ajuste,
    p.nombre AS producto, p.id AS producto_id, v.sku, t.nombre AS talle, c.nombre AS color,
    u.nombre AS ubicacion, COALESCE(CONCAT(actor.nombre, ' ', actor.apellido), 'Sistema') AS usuario
    ${from} ORDER BY m.id DESC LIMIT 30 OFFSET ${(pagina - 1) * 30}`,
    values,
  );
  res.json({ items, total, pagina, paginas });
});
