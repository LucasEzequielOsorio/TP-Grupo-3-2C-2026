import { Router } from 'express';
import { z } from 'zod';
import { transaction } from './db.js';
import { authenticate, requireAdmin } from './auth.js';
import { httpError, parseId } from './validation.js';
export const summaryRouter = Router();
summaryRouter.use(authenticate, requireAdmin);
const schema = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  buscar: z.string().trim().max(100).default(''),
  estado: z.enum(['todos', 'con_stock', 'bajo', 'agotado', 'inactivos']).default('todos'),
});
summaryRouter.get('/ubicaciones/:id/resumen', async (req, res) => {
  const id = parseId(req.params.id),
    q = schema.parse(req.query);
  // Una instantánea coherente para ubicación, indicadores y página, sin bloquear el inventario.
  const result = await transaction(async (db) => {
    const [locations] = await db.execute('SELECT * FROM ubicaciones WHERE id=?', [id]);
    if (!locations.length) throw httpError(404, 'Ubicación no encontrada');
    const location = locations[0];
    const from = `FROM variantes_producto v JOIN productos p ON p.id=v.producto_id
    JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id
    JOIN categorias cat ON cat.id=p.categoria_id
    LEFT JOIN existencias e ON e.variante_id=v.id AND e.ubicacion_id=?`;
    const active = `p.activo=1 AND v.activo=1 AND ${location.activo ? '1=1' : '1=0'}`;
    const [stats] = await db.execute(
      `SELECT COALESCE(SUM(COALESCE(e.cantidad,0)),0) AS unidades,
    COUNT(DISTINCT CASE WHEN e.cantidad>0 THEN p.id END) AS productos_con_stock,
    COUNT(CASE WHEN e.cantidad>0 THEN 1 END) AS variantes_con_stock,
    COUNT(CASE WHEN ${active} AND COALESCE(e.cantidad,0)<=v.stock_minimo THEN 1 END) AS alertas,
    COUNT(CASE WHEN ${active} AND COALESCE(e.cantidad,0)=0 THEN 1 END) AS agotadas ${from}`,
      [id],
    );
    const where = ['1=1'],
      values = [id];
    if (q.buscar) {
      where.push(
        '(LOCATE(?,p.nombre)>0 OR LOCATE(?,v.sku)>0 OR LOCATE(?,t.nombre)>0 OR LOCATE(?,c.nombre)>0)',
      );
      values.push(...Array(4).fill(q.buscar));
    }
    if (q.estado === 'con_stock') where.push('COALESCE(e.cantidad,0)>0');
    if (q.estado === 'bajo') where.push(`${active} AND COALESCE(e.cantidad,0)<=v.stock_minimo`);
    if (q.estado === 'agotado') where.push(`${active} AND COALESCE(e.cantidad,0)=0`);
    if (q.estado === 'inactivos') where.push('(p.activo=0 OR v.activo=0)');
    const filter = `WHERE ${where.join(' AND ')}`;
    const [count] = await db.execute(`SELECT COUNT(*) AS total ${from} ${filter}`, values);
    const total = Number(count[0].total),
      paginas = Math.max(1, Math.ceil(total / 30)),
      pagina = Math.min(q.pagina, paginas);
    const [items] = await db.execute(
      `SELECT v.id AS variante_id,p.id AS producto_id,p.nombre AS producto,cat.nombre AS clasificacion,v.sku,t.nombre AS talle,c.nombre AS color,
    p.activo AS producto_activo,v.activo AS variante_activa,COALESCE(e.cantidad,0) AS cantidad,v.stock_minimo
    ${from} ${filter} ORDER BY p.nombre,v.id LIMIT 30 OFFSET ${(pagina - 1) * 30}`,
      values,
    );
    const [transit] = await db.execute(
      `SELECT COALESCE(SUM(CASE WHEN tr.origen_id=? THEN i.cantidad ELSE 0 END),0) AS saliendo,
    COALESCE(SUM(CASE WHEN tr.destino_id=? THEN i.cantidad ELSE 0 END),0) AS entrando
    FROM transferencias tr JOIN transferencia_items i ON i.transferencia_id=tr.id WHERE tr.estado='en_transito' AND (tr.origen_id=? OR tr.destino_id=?)`,
      [id, id, id, id],
    );
    return {
      ubicacion: { ...location, activo: Boolean(location.activo) },
      resumen: Object.fromEntries(
        Object.entries({ ...stats[0], ...transit[0] }).map(([key, value]) => [key, Number(value)]),
      ),
      items: items.map((i) => ({
        ...i,
        producto_activo: Boolean(i.producto_activo),
        variante_activa: Boolean(i.variante_activa),
      })),
      total,
      pagina,
      paginas,
    };
  });
  res.json(result);
});
