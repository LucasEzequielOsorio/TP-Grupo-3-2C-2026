import { httpError } from './validation.js';
export const marks = (ids) => ids.map(() => '?').join(',');
export async function finishReservation(db, order, consume = false) {
  const [rows] = await db.execute(
    "SELECT r.*,v.producto_id FROM reservas_pedido r JOIN variantes_producto v ON v.id=r.variante_id WHERE r.pedido_id=? AND r.estado='activa' ORDER BY r.variante_id,r.ubicacion_id",
    [order.id],
  );
  if (!rows.length) return false;
  const products = [...new Set(rows.map((r) => r.producto_id))].sort((a, b) => a - b);
  const variants = [...new Set(rows.map((r) => r.variante_id))].sort((a, b) => a - b);
  const locations = [...new Set(rows.map((r) => r.ubicacion_id))].sort((a, b) => a - b);
  await db.execute(
    'SELECT id FROM productos WHERE id IN (' + marks(products) + ') ORDER BY id FOR UPDATE',
    products,
  );
  await db.execute(
    'SELECT id FROM variantes_producto WHERE id IN (' +
      marks(variants) +
      ') ORDER BY id FOR UPDATE',
    variants,
  );
  await db.execute(
    'SELECT id FROM ubicaciones WHERE id IN (' + marks(locations) + ') ORDER BY id FOR SHARE',
    locations,
  );
  await db.execute(
    'SELECT * FROM existencias WHERE variante_id IN (' +
      marks(variants) +
      ') AND ubicacion_id IN (' +
      marks(locations) +
      ') ORDER BY variante_id,ubicacion_id FOR UPDATE',
    [...variants, ...locations],
  );
  for (const r of rows) {
    const [changed] = await db.execute(
      consume
        ? 'UPDATE existencias SET cantidad=cantidad-?,reservada=reservada-? WHERE variante_id=? AND ubicacion_id=? AND reservada>=? AND cantidad>=?'
        : 'UPDATE existencias SET reservada=reservada-? WHERE variante_id=? AND ubicacion_id=? AND reservada>=?',
      consume
        ? [r.cantidad, r.cantidad, r.variante_id, r.ubicacion_id, r.cantidad, r.cantidad]
        : [r.cantidad, r.variante_id, r.ubicacion_id, r.cantidad],
    );
    if (changed.affectedRows !== 1) throw httpError(409, 'La reserva de stock requiere revisión');
    if (consume)
      await db.execute(
        "INSERT INTO movimientos_stock(variante_id,ubicacion_id,cantidad,motivo,usuario_id,pedido_id,observacion) VALUES (?,?,?,'venta',?,?,?)",
        [
          r.variante_id,
          r.ubicacion_id,
          -r.cantidad,
          order.usuario_id,
          order.id,
          'Pago verificado por Mercado Pago',
        ],
      );
  }
  await db.execute("UPDATE reservas_pedido SET estado=? WHERE pedido_id=? AND estado='activa'", [
    consume ? 'consumida' : 'liberada',
    order.id,
  ]);
  await db.execute(
    'UPDATE productos SET version=version+1 WHERE id IN (' + marks(products) + ')',
    products,
  );
  return true;
}
