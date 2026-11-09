import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { authenticate, requireAdmin } from './controllers/authController.js';
import { httpError, parseId } from './validation.js';

export const transfersRouter = Router();
transfersRouter.use(authenticate, requireAdmin);
const idSchema = z.number().int().positive().max(4294967295);
const locationSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  tipo: z.enum(['deposito', 'tienda']),
  direccion: z.string().trim().min(1).max(255),
  activo: z.boolean(),
});
const draftSchema = z
  .object({
    origen_id: idSchema,
    destino_id: idSchema,
    items: z
      .array(z.object({ variante_id: idSchema, cantidad: z.number().int().min(1).max(1000000) }))
      .min(1)
      .max(100),
  })
  .refine((d) => d.origen_id !== d.destino_id, 'El origen y el destino deben ser distintos')
  .refine(
    (d) => new Set(d.items.map((i) => i.variante_id)).size === d.items.length,
    'No repitas variantes',
  );
const marks = (values) => values.map(() => '?').join(',');

transfersRouter.get('/ubicaciones', async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT u.*, COALESCE((SELECT SUM(e.cantidad) FROM existencias e WHERE e.ubicacion_id=u.id),0) AS unidades FROM ubicaciones u ORDER BY activo DESC,nombre`,
  );
  res.json(rows.map((u) => ({ ...u, activo: Boolean(u.activo), unidades: Number(u.unidades) })));
});
transfersRouter.post('/ubicaciones', async (req, res) => {
  const data = locationSchema.parse(req.body);
  try {
    const [created] = await pool.execute(
      'INSERT INTO ubicaciones (nombre,tipo,direccion,activo) VALUES (?,?,?,?)',
      [data.nombre, data.tipo, data.direccion, data.activo],
    );
    res.status(201).json({ id: created.insertId, ...data, unidades: 0 });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw httpError(409, 'Ya existe una ubicación con ese nombre');
    throw e;
  }
});
transfersRouter.put('/ubicaciones/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const data = locationSchema.parse(req.body);
  try {
    const result = await transaction(async (db) => {
      const [rows] = await db.execute('SELECT id FROM ubicaciones WHERE id=? FOR UPDATE', [id]);
      if (!rows.length) throw httpError(404, 'Ubicación no encontrada');
      if (!data.activo) {
        const [stock] = await db.execute(
          'SELECT COALESCE(SUM(cantidad),0) AS total FROM existencias WHERE ubicacion_id=?',
          [id],
        );
        const [pending] = await db.execute(
          "SELECT id FROM transferencias WHERE (origen_id=? OR destino_id=?) AND estado IN ('borrador','en_transito') LIMIT 1",
          [id, id],
        );
        if (Number(stock[0].total) > 0 || pending.length)
          throw httpError(
            409,
            'No se puede desactivar una ubicación con stock o transferencias pendientes',
          );
      }
      await db.execute('UPDATE ubicaciones SET nombre=?,tipo=?,direccion=?,activo=? WHERE id=?', [
        data.nombre,
        data.tipo,
        data.direccion,
        data.activo,
        id,
      ]);
      return { id, ...data };
    });
    res.json(result);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw httpError(409, 'Ya existe una ubicación con ese nombre');
    throw e;
  }
});
transfersRouter.get('/ubicaciones/:id/stock', async (req, res) => {
  const id = parseId(req.params.id);
  const [locations] = await pool.execute('SELECT id FROM ubicaciones WHERE id=? AND activo=1', [
    id,
  ]);
  if (!locations.length) throw httpError(404, 'Ubicación no encontrada o inactiva');
  const [rows] = await pool.execute(
    `SELECT v.id AS variante_id,p.id AS producto_id,p.nombre AS producto,v.sku,t.nombre AS talle,c.nombre AS color,e.cantidad
    FROM existencias e JOIN variantes_producto v ON v.id=e.variante_id JOIN productos p ON p.id=v.producto_id
    JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id
    WHERE e.ubicacion_id=? AND e.cantidad>0 AND v.activo=1 AND p.activo=1 ORDER BY p.nombre,v.id`,
    [id],
  );
  res.json(rows);
});

// Mismo orden que edición de productos: producto, variante, ubicación, existencias.
async function lockResources(db, items, locations, checkActive = true) {
  const variantIds = items.map((i) => i.variante_id).sort((a, b) => a - b);
  const [refs] = await db.execute(
    `SELECT id,producto_id FROM variantes_producto WHERE id IN (${marks(variantIds)})`,
    variantIds,
  );
  if (refs.length !== items.length) throw httpError(400, 'Una variante no existe');
  const productIds = [...new Set(refs.map((v) => v.producto_id))].sort((a, b) => a - b);
  const [products] = await db.execute(
    `SELECT id,activo FROM productos WHERE id IN (${marks(productIds)}) ORDER BY id FOR UPDATE`,
    productIds,
  );
  const [variants] = await db.execute(
    `SELECT id,activo FROM variantes_producto WHERE id IN (${marks(variantIds)}) ORDER BY id FOR UPDATE`,
    variantIds,
  );
  if (checkActive && (products.some((p) => !p.activo) || variants.some((v) => !v.activo)))
    throw httpError(409, 'Solo se pueden despachar productos y variantes activos');
  const [places] = await db.execute(
    'SELECT id,activo FROM ubicaciones WHERE id IN (?,?) ORDER BY id FOR UPDATE',
    [...locations].sort((a, b) => a - b),
  );
  if (places.length !== 2 || places.some((u) => !u.activo))
    throw httpError(409, 'El origen y el destino deben estar activos');
  const [stock] = await db.execute(
    `SELECT * FROM existencias WHERE variante_id IN (${marks(variantIds)}) AND ubicacion_id IN (?,?) ORDER BY variante_id,ubicacion_id FOR UPDATE`,
    [...variantIds, ...locations],
  );
  return { stock, productIds };
}
const summaryQuery = `SELECT tr.*,o.nombre AS origen,d.nombre AS destino,CONCAT(u.nombre,' ',u.apellido) AS creado_por_nombre,
 (SELECT SUM(i.cantidad) FROM transferencia_items i WHERE i.transferencia_id=tr.id) AS unidades,
 (SELECT COUNT(*) FROM transferencia_items i WHERE i.transferencia_id=tr.id) AS variantes
 FROM transferencias tr JOIN ubicaciones o ON o.id=tr.origen_id JOIN ubicaciones d ON d.id=tr.destino_id JOIN usuarios u ON u.id=tr.creado_por`;
export async function transferDetail(id, db = pool) {
  const [rows] = await db.execute(`${summaryQuery} WHERE tr.id=?`, [id]);
  if (!rows.length) throw httpError(404, 'Transferencia no encontrada');
  const [items] = await db.execute(
    `SELECT i.*,p.nombre AS producto,v.sku,t.nombre AS talle,c.nombre AS color
    FROM transferencia_items i JOIN variantes_producto v ON v.id=i.variante_id JOIN productos p ON p.id=v.producto_id
    JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id WHERE i.transferencia_id=? ORDER BY i.variante_id`,
    [id],
  );
  return { ...rows[0], unidades: Number(rows[0].unidades), items };
}
transfersRouter.get('/transferencias', async (req, res) => {
  const query = z
    .object({
      pagina: z.coerce.number().int().min(1).max(100000).default(1),
      estado: z.enum(['borrador', 'en_transito', 'recibida', 'cancelada']).optional(),
    })
    .parse(req.query);
  const where = query.estado ? ' WHERE tr.estado=?' : '';
  const values = query.estado ? [query.estado] : [];
  const [count] = await pool.execute(
    `SELECT COUNT(*) AS total FROM transferencias tr${where}`,
    values,
  );
  const total = Number(count[0].total),
    paginas = Math.max(1, Math.ceil(total / 20)),
    pagina = Math.min(query.pagina, paginas);
  const [items] = await pool.execute(
    `${summaryQuery}${where} ORDER BY tr.id DESC LIMIT 20 OFFSET ${(pagina - 1) * 20}`,
    values,
  );
  res.json({
    items: items.map((i) => ({ ...i, unidades: Number(i.unidades) })),
    total,
    pagina,
    paginas,
  });
});
transfersRouter.get('/transferencias/:id', async (req, res) =>
  res.json(await transferDetail(parseId(req.params.id))),
);
transfersRouter.post('/transferencias', async (req, res) => {
  const data = draftSchema.parse(req.body);
  const result = await transaction(async (db) => {
    const { stock } = await lockResources(db, data.items, [data.origen_id, data.destino_id]);
    for (const item of data.items)
      if (
        (stock.find((s) => s.variante_id === item.variante_id && s.ubicacion_id === data.origen_id)
          ?.cantidad || 0) < item.cantidad
      )
        throw httpError(409, 'Stock insuficiente en el origen. Actualizá las cantidades.');
    const [created] = await db.execute(
      'INSERT INTO transferencias (origen_id,destino_id,creado_por) VALUES (?,?,?)',
      [data.origen_id, data.destino_id, req.user.id],
    );
    for (const item of [...data.items].sort((a, b) => a.variante_id - b.variante_id))
      await db.execute(
        'INSERT INTO transferencia_items (transferencia_id,variante_id,cantidad) VALUES (?,?,?)',
        [created.insertId, item.variante_id, item.cantidad],
      );
    return transferDetail(created.insertId, db);
  });
  res.status(201).json(result);
});
transfersRouter.post('/transferencias/:id/:accion', async (req, res) => {
  const id = parseId(req.params.id),
    action = z.enum(['despachar', 'recibir', 'cancelar']).parse(req.params.accion);
  const result = await transaction(async (db) => {
    const [rows] = await db.execute('SELECT * FROM transferencias WHERE id=? FOR UPDATE', [id]);
    if (!rows.length) throw httpError(404, 'Transferencia no encontrada');
    const tr = rows[0];
    if (action === 'cancelar') {
      if (tr.estado !== 'borrador')
        throw httpError(
          409,
          'Solo se puede cancelar un borrador. Para devolver mercadería despachada, recibila y creá una transferencia de regreso.',
        );
      await db.execute("UPDATE transferencias SET estado='cancelada' WHERE id=?", [id]);
      return transferDetail(id, db);
    }
    if (tr.estado !== (action === 'despachar' ? 'borrador' : 'en_transito'))
      throw httpError(409, 'La transferencia ya cambió de estado. Actualizá el listado.');
    const [items] = await db.execute(
      'SELECT * FROM transferencia_items WHERE transferencia_id=? ORDER BY variante_id',
      [id],
    );
    if (!items.length) throw httpError(409, 'La transferencia no tiene productos');
    // Una recepción permite variantes desactivadas después del despacho: la mercadería debe poder ingresar.
    const { stock, productIds } = await lockResources(
      db,
      items,
      [tr.origen_id, tr.destino_id],
      action === 'despachar',
    );
    const location = action === 'despachar' ? tr.origen_id : tr.destino_id;
    for (const item of items) {
      const previous = stock.find(
        (s) => s.variante_id === item.variante_id && s.ubicacion_id === location,
      );
      if (action === 'despachar' && (!previous || previous.cantidad < item.cantidad))
        throw httpError(
          409,
          `Stock insuficiente para una variante. No se despachó ninguna unidad.`,
        );
      const difference = action === 'despachar' ? -item.cantidad : item.cantidad;
      if (previous)
        await db.execute(
          'UPDATE existencias SET cantidad=cantidad+? WHERE variante_id=? AND ubicacion_id=?',
          [difference, item.variante_id, location],
        );
      else
        await db.execute(
          'INSERT INTO existencias (variante_id,ubicacion_id,cantidad) VALUES (?,?,?)',
          [item.variante_id, location, difference],
        );
      await db.execute(
        "INSERT INTO movimientos_stock (variante_id,ubicacion_id,cantidad,motivo,usuario_id,transferencia_id,observacion) VALUES (?,?,?,'transferencia',?,?,?)",
        [
          item.variante_id,
          location,
          difference,
          req.user.id,
          id,
          `${action === 'despachar' ? 'Despacho' : 'Recepción'} de transferencia #${id}`,
        ],
      );
    }
    // Invalida formularios de stock abiertos antes del traslado.
    await db.execute(
      `UPDATE productos SET version=version+1 WHERE id IN (${marks(productIds)})`,
      productIds,
    );
    await db.execute(
      action === 'despachar'
        ? "UPDATE transferencias SET estado='en_transito',despachado_en=CURRENT_TIMESTAMP WHERE id=?"
        : "UPDATE transferencias SET estado='recibida',recibido_en=CURRENT_TIMESTAMP WHERE id=?",
      [id],
    );
    return transferDetail(id, db);
  });
  res.json(result);
});
