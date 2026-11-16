import { pool, transaction } from '../db.js';

export function withPaymentTransaction(work) {
  return transaction(work);
}

export async function findCheckoutByPedidoId(db = pool, pedidoId) {
  const [rows] = await db.execute('SELECT * FROM checkout_pedidos WHERE pedido_id=?', [pedidoId]);
  return rows[0] ?? null;
}

export async function findCheckoutByPedidoIdForUpdate(db, pedidoId) {
  const [rows] = await db.execute(
    'SELECT * FROM checkout_pedidos WHERE pedido_id=? FOR UPDATE',
    [pedidoId],
  );
  return rows[0] ?? null;
}

export async function findCheckoutByReference(db, reference) {
  const [rows] = await db.execute('SELECT pedido_id FROM checkout_pedidos WHERE referencia=?', [
    reference,
  ]);
  return rows[0] ?? null;
}

export async function findOrderByIdForUpdate(db, orderId) {
  const [rows] = await db.execute('SELECT * FROM pedidos WHERE id=? FOR UPDATE', [orderId]);
  return rows[0] ?? null;
}

export async function findOrderByIdAndUserForUpdate(db, orderId, userId) {
  const [rows] = await db.execute(
    'SELECT * FROM pedidos WHERE id=? AND usuario_id=? FOR UPDATE',
    [orderId, userId],
  );
  return rows[0] ?? null;
}

export async function findPaymentByIdForUpdate(db, paymentId) {
  const [rows] = await db.execute('SELECT * FROM pagos_mp WHERE payment_id=? FOR UPDATE', [
    String(paymentId),
  ]);
  return rows[0] ?? null;
}

export async function getOrderTotal(db, orderId) {
  const [rows] = await db.execute(
    'SELECT SUM(cantidad*precio_unitario) AS total FROM pedido_items WHERE pedido_id=?',
    [orderId],
  );
  return rows[0]?.total ?? null;
}

export async function createCheckout(db, orderId, reference) {
  await db.execute('INSERT IGNORE INTO checkout_pedidos(pedido_id,referencia) VALUES (?,?)', [
    orderId,
    reference,
  ]);
}

export async function updateCheckoutState(db, orderId, state) {
  await db.execute(
    'UPDATE checkout_pedidos SET estado=?,actualizado_en=UTC_TIMESTAMP() WHERE pedido_id=?',
    [state, orderId],
  );
}

export async function updateCheckoutRetryState(db, orderId, state) {
  await db.execute(
    "UPDATE checkout_pedidos SET estado=?,actualizado_en=UTC_TIMESTAMP() WHERE pedido_id=? AND estado='creando'",
    [state, orderId],
  );
}

export async function saveCheckoutPreference(db, orderId, preferenceId, url) {
  await db.execute(
    "UPDATE checkout_pedidos SET preference_id=?,checkout_url=?,estado='listo',actualizado_en=UTC_TIMESTAMP() WHERE pedido_id=?",
    [String(preferenceId), url, orderId],
  );
}

export async function markCheckoutReviewed(db, orderId) {
  await db.execute('UPDATE checkout_pedidos SET revisado_en=UTC_TIMESTAMP() WHERE pedido_id=?', [
    orderId,
  ]);
}

export async function savePaymentRecord(db, { paymentId, orderId, status, amount, updatedAt }) {
  await db.execute(
    'INSERT INTO pagos_mp(payment_id,pedido_id,estado,importe,actualizado_mp) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE estado=VALUES(estado),actualizado_mp=VALUES(actualizado_mp)',
    [String(paymentId), orderId, status, amount, updatedAt],
  );
}

export async function setOrderPaymentStatus(db, orderId, paymentStatus) {
  await db.execute('UPDATE pedidos SET pago_estado=? WHERE id=?', [paymentStatus, orderId]);
}

export async function confirmOrderPayment(db, orderId, paymentId) {
  await db.execute(
    "UPDATE pedidos SET estado='confirmado',pago_estado='aprobado',pago_id=? WHERE id=?",
    [String(paymentId), orderId],
  );
}

export async function setOrderPaymentReview(db, orderId) {
  await db.execute("UPDATE pedidos SET pago_estado='revision' WHERE id=?", [orderId]);
}

export async function cancelOrder(db, orderId) {
  await db.execute("UPDATE pedidos SET estado='cancelado',pago_estado='cancelado' WHERE id=?", [
    orderId,
  ]);
}

export async function expireOrder(db, orderId) {
  await db.execute("UPDATE pedidos SET estado='cancelado',pago_estado='vencido' WHERE id=?", [
    orderId,
  ]);
}

export async function enqueuePaymentNotification(db, paymentId) {
  await db.execute(
    "INSERT INTO mp_notificaciones(payment_id) VALUES (?) ON DUPLICATE KEY UPDATE version=version+1,estado=IF(estado='procesando',estado,'pendiente'),intentos=0,disponible_en=UTC_TIMESTAMP()",
    [paymentId],
  );
}

export async function findNextPaymentNotification(db) {
  const [rows] = await db.execute(
    "SELECT payment_id,version FROM mp_notificaciones WHERE intentos<10 AND ((estado='pendiente' AND disponible_en<=UTC_TIMESTAMP()) OR (estado='procesando' AND actualizado_en<UTC_TIMESTAMP()-INTERVAL 2 MINUTE)) ORDER BY disponible_en LIMIT 1 FOR UPDATE SKIP LOCKED",
  );
  return rows[0] ?? null;
}

export async function markPaymentNotificationProcessing(db, paymentId) {
  await db.execute(
    "UPDATE mp_notificaciones SET estado='procesando',intentos=intentos+1,actualizado_en=UTC_TIMESTAMP() WHERE payment_id=?",
    [paymentId],
  );
}

export async function completePaymentNotification(db, paymentId, version) {
  await db.execute(
    "UPDATE mp_notificaciones SET estado=IF(version=?,'listo','pendiente'),actualizado_en=UTC_TIMESTAMP() WHERE payment_id=?",
    [version, paymentId],
  );
}

export async function retryPaymentNotification(db, paymentId) {
  await db.execute(
    "UPDATE mp_notificaciones SET estado=IF(intentos>=10,'fallido','pendiente'),disponible_en=UTC_TIMESTAMP()+INTERVAL 1 MINUTE,actualizado_en=UTC_TIMESTAMP() WHERE payment_id=?",
    [paymentId],
  );
}

export async function listPaymentsNeedingReview(db = pool) {
  const [rows] = await db.execute(
    "SELECT p.id,p.estado,p.pago_estado,p.creado_en,u.email,(SELECT SUM(i.cantidad*i.precio_unitario) FROM pedido_items i WHERE i.pedido_id=p.id) AS total FROM pedidos p JOIN usuarios u ON u.id=p.usuario_id WHERE p.pago_estado='revision' ORDER BY p.id DESC LIMIT 100",
  );
  return rows;
}

export async function listExpiredOrders(db = pool) {
  const [rows] = await db.execute(
    "SELECT id FROM pedidos WHERE estado='pendiente' AND pago_estado<>'revision' AND reserva_hasta<UTC_TIMESTAMP() ORDER BY id LIMIT 25",
  );
  return rows;
}

export async function listRecentCheckouts(db = pool) {
  const [rows] = await db.execute(
    'SELECT c.pedido_id FROM checkout_pedidos c JOIN pedidos p ON p.id=c.pedido_id WHERE p.creado_en>UTC_TIMESTAMP()-INTERVAL 7 DAY AND (c.revisado_en IS NULL OR c.revisado_en<UTC_TIMESTAMP()-INTERVAL 1 MINUTE) ORDER BY c.revisado_en,c.pedido_id LIMIT 10',
  );
  return rows;
}
