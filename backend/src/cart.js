import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { authenticate } from './auth.js';
import { getProduct } from './products.js';
import { httpError, parseId } from './validation.js';

export const cartRouter = Router();
cartRouter.use(authenticate);
const quantity = z.object({ cantidad: z.number().int().min(1).max(999) });

async function readCart(userId, db = pool) {
  const [rows] = await db.execute(
    `SELECT ci.variante_id, ci.cantidad, v.producto_id,
    t.nombre AS talle, c.nombre AS color, p.nombre, p.precio,
    (p.activo AND v.activo) AS activo,
    COALESCE((SELECT SUM(e.cantidad) FROM existencias e JOIN ubicaciones u ON u.id=e.ubicacion_id
      WHERE e.variante_id=v.id AND u.activo=1),0) AS stock,
    COALESCE((SELECT i.url FROM producto_imagenes i WHERE i.producto_id=p.id
      AND (i.color_id=v.color_id OR i.color_id IS NULL)
      ORDER BY (i.color_id=v.color_id) DESC, i.orden LIMIT 1),'') AS imagen_url
    FROM carrito_items ci JOIN variantes_producto v ON v.id=ci.variante_id
    JOIN productos p ON p.id=v.producto_id JOIN talles t ON t.id=v.talle_id
    JOIN colores c ON c.id=v.color_id WHERE ci.usuario_id=? ORDER BY ci.variante_id`,
    [userId],
  );
  const items = rows.map((r) => ({
    ...r,
    stock: r.activo ? Number(r.stock) : 0,
    activo: Boolean(r.activo),
    subtotal: (Math.round(r.precio * 100) * r.cantidad) / 100,
  }));
  return {
    items,
    total: items.reduce((sum, i) => sum + Math.round(i.subtotal * 100), 0) / 100,
    unidades: items.reduce((sum, i) => sum + i.cantidad, 0),
  };
}
cartRouter.get('/', async (req, res) => res.json(await readCart(req.user.id)));

async function save(req, res, add) {
  const id = parseId(req.params.id);
  const { cantidad } = quantity.parse(req.body);
  const result = await transaction(async (db) => {
    // Serializa cambios del mismo carrito, incluso cuando todavía está vacío.
    await db.execute('SELECT id FROM usuarios WHERE id=? FOR UPDATE', [req.user.id]);
    const [variants] = await db.execute(
      'SELECT producto_id FROM variantes_producto WHERE id=? AND activo=1',
      [id],
    );
    if (!variants.length) throw httpError(404, 'La combinación elegida ya no está disponible');
    const p = await getProduct(variants[0].producto_id, false, db);
    const v = p.variantes.find((v) => v.id === id);
    const stock = v.existencias.reduce((sum, e) => sum + e.cantidad, 0);
    const [existing] = await db.execute(
      'SELECT cantidad FROM carrito_items WHERE usuario_id=? AND variante_id=?',
      [req.user.id, id],
    );
    const next = cantidad + (add ? existing[0]?.cantidad || 0 : 0);
    if (next > stock || next > 999)
      throw httpError(409, `No hay stock suficiente. Disponible: ${stock} unidades`);
    await db.execute(
      'INSERT INTO carrito_items (usuario_id,variante_id,cantidad) VALUES (?,?,?) ON DUPLICATE KEY UPDATE cantidad=?',
      [req.user.id, id, next, next],
    );
    return readCart(req.user.id, db);
  });
  res.json(result);
}
cartRouter.post('/items/:id', (req, res) => save(req, res, true));
cartRouter.put('/items/:id', (req, res) => save(req, res, false));
cartRouter.delete('/items/:id', async (req, res) => {
  await transaction(async (db) => {
    await db.execute('SELECT id FROM usuarios WHERE id=? FOR UPDATE', [req.user.id]);
    await db.execute('DELETE FROM carrito_items WHERE usuario_id=? AND variante_id=?', [
      req.user.id,
      parseId(req.params.id),
    ]);
  });
  res.json(await readCart(req.user.id));
});
