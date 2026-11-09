import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { authenticate } from './controllers/authController.js';
import { httpError, parseId } from './validation.js';
export const ordersRouter = Router();
ordersRouter.use(authenticate);
ordersRouter.get('/entrega', async (req, res) => {
  const [rows] = await pool.execute('SELECT direccion FROM usuarios WHERE id=?', [req.user.id]);
  res.json({ direccion: rows[0].direccion });
});
const marks = (ids) => ids.map(() => '?').join(',');
const schema = z.object({
  clave: z.uuid(),
  items: z
    .array(
      z.object({
        variante_id: z.number().int().positive(),
        cantidad: z.number().int().min(1).max(999),
        precio: z.number().positive(),
      }),
    )
    .min(1)
    .max(100),
});
async function detail(db, user, id) {
  const [orders] = await db.execute('SELECT * FROM pedidos WHERE id=? AND usuario_id=?', [
    id,
    user,
  ]);
  if (!orders.length) throw httpError(404, 'Pedido no encontrado');
  const [items] = await db.execute(
    'SELECT i.*, COALESCE(d.nombre,p.nombre) AS nombre, COALESCE(d.talle,t.nombre) AS talle,COALESCE(d.color,c.nombre) AS color FROM pedido_items i JOIN variantes_producto v ON v.id=i.variante_id JOIN productos p ON p.id=v.producto_id JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id LEFT JOIN pedido_detalles d ON d.item_id=i.id WHERE i.pedido_id=? ORDER BY i.id',
    [id],
  );
  return {
    ...orders[0],
    items: items.map((i) => ({
      ...i,
      subtotal: (Math.round(i.precio_unitario * 100) * i.cantidad) / 100,
    })),
    total:
      items.reduce((sum, i) => sum + Math.round(i.precio_unitario * 100) * i.cantidad, 0) / 100,
  };
}
ordersRouter.get('/', async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT p.id,p.estado,p.creado_en,SUM(i.cantidad) AS unidades,SUM(i.cantidad*i.precio_unitario) AS total FROM pedidos p JOIN pedido_items i ON i.pedido_id=p.id WHERE p.usuario_id=? GROUP BY p.id ORDER BY p.id DESC LIMIT 100',
    [req.user.id],
  );
  res.json(rows);
});
ordersRouter.get('/:id', async (req, res) =>
  res.json(await detail(pool, req.user.id, parseId(req.params.id))),
);
ordersRouter.post('/', async (req, res) => {
  const data = schema.parse(req.body);
  const order = await transaction(async (db) => {
    const [users] = await db.execute('SELECT direccion FROM usuarios WHERE id=? FOR UPDATE', [
      req.user.id,
    ]);
    const [done] = await db.execute(
      'SELECT pedido_id FROM pedido_confirmaciones WHERE usuario_id=? AND clave=?',
      [req.user.id, data.clave],
    );
    if (done.length) return detail(db, req.user.id, done[0].pedido_id);
    const [cart] = await db.execute(
      'SELECT ci.*,v.producto_id FROM carrito_items ci JOIN variantes_producto v ON v.id=ci.variante_id WHERE ci.usuario_id=? ORDER BY ci.variante_id',
      [req.user.id],
    );
    if (!cart.length) throw httpError(409, 'El carrito está vacío');
    if (cart.length > 100) throw httpError(400, 'El pedido admite hasta 100 combinaciones');
    const productIds = [...new Set(cart.map((i) => i.producto_id))].sort((a, b) => a - b);
    const variantIds = cart.map((i) => i.variante_id);
    const [products] = await db.execute(
      'SELECT id,nombre,precio,activo FROM productos WHERE id IN (' +
        marks(productIds) +
        ') ORDER BY id FOR UPDATE',
      productIds,
    );
    const [variants] = await db.execute(
      'SELECT v.id,v.activo,t.nombre AS talle,c.nombre AS color FROM variantes_producto v JOIN talles t ON t.id=v.talle_id JOIN colores c ON c.id=v.color_id WHERE v.id IN (' +
        marks(variantIds) +
        ') ORDER BY v.id FOR UPDATE',
      variantIds,
    );
    const [locations] = await db.execute(
      'SELECT id FROM ubicaciones WHERE activo=1 ORDER BY id FOR SHARE',
    );
    if (!locations.length) throw httpError(409, 'No hay ubicaciones disponibles');
    const ids = locations.map((l) => l.id);
    const [stock] = await db.execute(
      'SELECT * FROM existencias WHERE variante_id IN (' +
        marks(variantIds) +
        ') AND ubicacion_id IN (' +
        marks(ids) +
        ') ORDER BY variante_id,ubicacion_id FOR UPDATE',
      [...variantIds, ...ids],
    );
    if (
      data.items.length !== cart.length ||
      new Set(data.items.map((i) => i.variante_id)).size !== cart.length
    )
      throw httpError(409, 'Cambió el carrito. Actualizalo y revisá el pedido antes de confirmar');
    for (const item of cart) {
      const p = products.find((p) => p.id === item.producto_id),
        v = variants.find((v) => v.id === item.variante_id);
      const expected = data.items.find((i) => i.variante_id === item.variante_id);
      if (!expected || expected.cantidad !== item.cantidad || expected.precio !== p.precio)
        throw httpError(
          409,
          'Cambió el precio o el carrito. Actualizalo y revisá el total antes de confirmar',
        );
      if (
        !p.activo ||
        !v.activo ||
        stock.filter((s) => s.variante_id === v.id).reduce((sum, s) => sum + s.cantidad, 0) <
          item.cantidad
      )
        throw httpError(409, 'No hay stock suficiente para ' + p.nombre + '. Actualizá el carrito');
    }
    const [created] = await db.execute(
      "INSERT INTO pedidos(usuario_id,estado,direccion_entrega) VALUES (?,'confirmado',?)",
      [req.user.id, users[0].direccion],
    );
    for (const item of cart) {
      const p = products.find((p) => p.id === item.producto_id),
        v = variants.find((v) => v.id === item.variante_id);
      const [line] = await db.execute(
        'INSERT INTO pedido_items(pedido_id,variante_id,cantidad,precio_unitario) VALUES (?,?,?,?)',
        [created.insertId, v.id, item.cantidad, p.precio],
      );
      await db.execute('INSERT INTO pedido_detalles(item_id,nombre,talle,color) VALUES (?,?,?,?)', [
        line.insertId,
        p.nombre,
        v.talle,
        v.color,
      ]);
      let remaining = item.cantidad;
      // Reparte stock entre ubicaciones activas en orden de id.
      for (const s of stock.filter((s) => s.variante_id === v.id)) {
        const take = Math.min(remaining, s.cantidad);
        if (!take) continue;
        await db.execute(
          'UPDATE existencias SET cantidad=cantidad-? WHERE variante_id=? AND ubicacion_id=?',
          [take, v.id, s.ubicacion_id],
        );
        await db.execute(
          "INSERT INTO movimientos_stock(variante_id,ubicacion_id,cantidad,motivo,usuario_id,pedido_id) VALUES (?,?,?,'venta',?,?)",
          [v.id, s.ubicacion_id, -take, req.user.id, created.insertId],
        );
        remaining -= take;
        if (!remaining) break;
      }
    }
    await db.execute(
      'UPDATE productos SET version=version+1 WHERE id IN (' + marks(productIds) + ')',
      productIds,
    );
    await db.execute(
      'INSERT INTO pedido_confirmaciones(usuario_id,clave,pedido_id) VALUES (?,?,?)',
      [req.user.id, data.clave, created.insertId],
    );
    await db.execute('DELETE FROM carrito_items WHERE usuario_id=?', [req.user.id]);
    return detail(db, req.user.id, created.insertId);
  });
  res.status(201).json(order);
});
