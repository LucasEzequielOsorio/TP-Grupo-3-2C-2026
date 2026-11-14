import { Router } from 'express';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { pool, transaction } from './db.js';
import { authenticate, requireAdmin } from './middlewares/auth.middleware.js';
import { httpError, parseId } from './validation.js';
import { getOrderDetail } from './services/orders.service.js';
import { finishReservation } from './reservations.js';
import { mercadoPago, checkoutUrl } from './mercadopago.js';

const cents = (v) => Math.round(Number(v) * 100);
export function validSignature(req, secret) {
  const id = req.query['data.id'],
    rid = req.headers['x-request-id'],
    raw = req.headers['x-signature'];
  if (
    typeof id !== 'string' ||
    !/^\d{1,100}$/.test(id) ||
    typeof rid !== 'string' ||
    rid.length > 200 ||
    !rid ||
    typeof raw !== 'string' ||
    !secret
  )
    return false;
  const entries = raw.split(',').map((s) => s.trim().split('='));
  const ts = entries.find((p) => p[0] === 'ts')?.[1],
    v1 = entries.find((p) => p[0] === 'v1')?.[1];
  if (!/^\d{10,13}$/.test(ts || '') || !/^[a-f0-9]{64}$/i.test(v1 || '')) return false;
  const time = ts.length <= 10 ? Number(ts) * 1000 : Number(ts);
  if (Math.abs(Date.now() - time) > 15 * 60 * 1000) return false;
  if (req.body?.data?.id !== undefined && String(req.body.data.id) !== id) return false;
  const expected = createHmac('sha256', secret)
    .update('id:' + id + ';request-id:' + rid + ';ts:' + ts + ';')
    .digest();
  return timingSafeEqual(expected, Buffer.from(v1, 'hex'));
}
export function createPaymentService(provider = mercadoPago) {
  const router = Router(),
    webhook = Router(),
    admin = Router();
  router.use(
    authenticate,
    rateLimit({
      windowMs: 60 * 1000,
      limit: 25,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { mensaje: 'Esperá un momento antes de volver a consultar el pago.' },
    }),
  );
  admin.use(authenticate, requireAdmin);
  async function applyPayment(payment) {
    if (!/^\d{1,100}$/.test(String(payment.id)) || !payment.external_reference)
      throw httpError(422, 'Pago sin referencia válida');
    // Checkout Pro con cuentas test puede devolver live_mode=true.
    // Verificar el vendedor con la API autenticada fuera del bloqueo SQL.
    const testAccount =
      payment.live_mode === true &&
      typeof provider.isTestSeller === 'function' &&
      (await provider.isTestSeller(payment.collector_id));
    return transaction(async (db) => {
      const [[ref]] = await db.execute(
        'SELECT pedido_id FROM checkout_pedidos WHERE referencia=?',
        [payment.external_reference],
      );
      if (!ref) return null; // Otro producto o aplicación del mismo vendedor.
      const [[order]] = await db.execute('SELECT * FROM pedidos WHERE id=? FOR UPDATE', [
        ref.pedido_id,
      ]);
      const [[sum]] = await db.execute(
        'SELECT SUM(cantidad*precio_unitario) AS total FROM pedido_items WHERE pedido_id=?',
        [order.id],
      );
      if (
        payment.currency_id !== 'ARS' ||
        cents(payment.transaction_amount) !== cents(sum.total) ||
        String(payment.collector_id) !== String(provider.collector) ||
        !(payment.live_mode === false || testAccount)
      )
        throw httpError(
          422,
          'El pago no coincide con el importe, moneda o vendedor de prueba del pedido',
        );
      const updated = new Date(payment.date_last_updated || payment.date_created);
      if (!Number.isFinite(updated.getTime())) throw httpError(422, 'Fecha de pago inválida');
      const [[previous]] = await db.execute(
        'SELECT * FROM pagos_mp WHERE payment_id=? FOR UPDATE',
        [String(payment.id)],
      );
      if (previous && previous.pedido_id !== order.id)
        throw httpError(422, 'El pago pertenece a otro pedido');
      if (previous && new Date(previous.actualizado_mp) > updated) return order;
      await db.execute(
        'INSERT INTO pagos_mp(payment_id,pedido_id,estado,importe,actualizado_mp) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE estado=VALUES(estado),actualizado_mp=VALUES(actualizado_mp)',
        [String(payment.id), order.id, payment.status, payment.transaction_amount, updated],
      );
      const adverse =
        ['refunded', 'charged_back'].includes(payment.status) ||
        Number(payment.transaction_amount_refunded || 0) > 0;
      if (adverse) {
        await db.execute("UPDATE pedidos SET pago_estado='revision' WHERE id=?", [order.id]);
        return order;
      }
      if (payment.status === 'approved') {
        if (order.pago_id === String(payment.id)) return order; // Repetición sin doble baja.
        if (order.pago_id || order.estado !== 'pendiente' || order.pago_estado === 'revision') {
          await db.execute("UPDATE pedidos SET pago_estado='revision' WHERE id=?", [order.id]);
          return order; // Pago duplicado o tardío: requiere revisión, nunca vender sin stock.
        }
        const consumed = await finishReservation(db, order, true);
        if (!consumed) {
          await db.execute("UPDATE pedidos SET pago_estado='revision' WHERE id=?", [order.id]);
          return order;
        }
        await db.execute(
          "UPDATE pedidos SET estado='confirmado',pago_estado='aprobado',pago_id=? WHERE id=?",
          [String(payment.id), order.id],
        );
      } else if (
        order.estado === 'pendiente' &&
        !order.pago_id &&
        order.pago_estado !== 'revision'
      ) {
        const status = payment.status === 'rejected' ? 'rechazado' : 'pendiente';
        await db.execute('UPDATE pedidos SET pago_estado=? WHERE id=?', [status, order.id]);
      }
      return order;
    });
  }
  async function syncOrder(id) {
    const [[checkout]] = await pool.execute('SELECT * FROM checkout_pedidos WHERE pedido_id=?', [
      id,
    ]);
    if (!checkout) return;
    if (!provider.configured())
      throw httpError(503, 'El servicio de pagos no está disponible en este momento');
    const results = await provider.findPayments(checkout.referencia);
    for (const p of results) await applyPayment(await provider.getPayment(String(p.id)));
    await pool.execute(
      'UPDATE checkout_pedidos SET revisado_en=UTC_TIMESTAMP() WHERE pedido_id=?',
      [id],
    );
  }
  async function savePreference(id, pref, reference) {
    if (
      !pref?.id ||
      !checkoutUrl(pref.init_point) ||
      pref.external_reference !== reference ||
      String(pref.collector_id) !== String(provider.collector)
    )
      throw httpError(502, 'Mercado Pago devolvió un checkout inválido');
    // Las credenciales pertenecen a un vendedor test; su flujo utiliza init_point.
    const url = pref.init_point;
    await pool.execute(
      "UPDATE checkout_pedidos SET preference_id=?,checkout_url=?,estado='listo',actualizado_en=UTC_TIMESTAMP() WHERE pedido_id=?",
      [String(pref.id), url, id],
    );
    return { checkout_url: url };
  }
  router.post('/:id/pagar', async (req, res) => {
    const id = parseId(req.params.id);
    if (!provider.configured())
      throw httpError(503, 'Mercado Pago todavía no está disponible para realizar este pago.');
    const state = await transaction(async (db) => {
      const [[o]] = await db.execute(
        'SELECT * FROM pedidos WHERE id=? AND usuario_id=? FOR UPDATE',
        [id, req.user.id],
      );
      if (!o) throw httpError(404, 'Pedido no encontrado');
      if (
        o.estado !== 'pendiente' ||
        o.pago_estado === 'revision' ||
        new Date(o.reserva_hasta) <= new Date()
      )
        throw httpError(409, 'El pedido ya no está disponible para pagar');
      await db.execute('INSERT IGNORE INTO checkout_pedidos(pedido_id,referencia) VALUES (?,?)', [
        id,
        randomUUID(),
      ]);
      const [[c]] = await db.execute(
        'SELECT * FROM checkout_pedidos WHERE pedido_id=? FOR UPDATE',
        [id],
      );
      if (c.estado !== 'nuevo') return { order: o, checkout: c, create: false };
      await db.execute(
        "UPDATE checkout_pedidos SET estado='creando',actualizado_en=UTC_TIMESTAMP() WHERE pedido_id=?",
        [id],
      );
      return { order: o, checkout: c, create: true };
    });
    if (state.checkout.estado === 'listo') {
      if (
        checkoutUrl(state.checkout.checkout_url) &&
        !new URL(state.checkout.checkout_url).hostname.startsWith('sandbox.')
      )
        return res.json({ checkout_url: state.checkout.checkout_url });
      // Recuperar la misma preferencia sin crear otro checkout ni alterar la reserva.
      return res.json(
        await savePreference(
          id,
          await provider.getPreference(state.checkout.preference_id),
          state.checkout.referencia,
        ),
      );
    }
    if (!state.create) {
      const preferences = await provider.findPreference(state.checkout.referencia);
      const found = preferences[0];
      if (found)
        return res.json(
          await savePreference(
            id,
            await provider.getPreference(found.id),
            state.checkout.referencia,
          ),
        );
      throw httpError(
        409,
        'El inicio de pago sigue verificándose. Actualizá su estado en unos momentos.',
      );
    }
    try {
      const order = await getOrderDetail(req.user.id, id, pool);
      const pref = await provider.createPreference(
        state.order,
        order.items,
        state.checkout.referencia,
      );
      res.json(await savePreference(id, pref, state.checkout.referencia));
    } catch (e) {
      await pool.execute(
        "UPDATE checkout_pedidos SET estado=?,actualizado_en=UTC_TIMESTAMP() WHERE pedido_id=? AND estado='creando'",
        [e.safeToRetry ? 'nuevo' : 'incierto', id],
      );
      throw e;
    }
  });
  router.post('/:id/sincronizar', async (req, res) => {
    const id = parseId(req.params.id);
    const order = await getOrderDetail(req.user.id, id, pool);
    await syncOrder(order.id);
    res.json(await getOrderDetail(req.user.id, id, pool));
  });
  router.post('/:id/cancelar', async (req, res) => {
    const id = parseId(req.params.id);
    const own = await getOrderDetail(req.user.id, id, pool);
    const [[checkout]] = await pool.execute(
      'SELECT pedido_id FROM checkout_pedidos WHERE pedido_id=?',
      [id],
    );
    if (checkout) await syncOrder(id); // Nunca liberar un pago aprobado por una vuelta atrasada.
    await transaction(async (db) => {
      const [[o]] = await db.execute(
        'SELECT * FROM pedidos WHERE id=? AND usuario_id=? FOR UPDATE',
        [own.id, req.user.id],
      );
      if (o.estado === 'cancelado') return;
      if (o.estado !== 'pendiente' || o.pago_estado === 'revision')
        throw httpError(409, 'Este pedido no se puede cancelar automáticamente');
      await finishReservation(db, o);
      await db.execute("UPDATE pedidos SET estado='cancelado',pago_estado='cancelado' WHERE id=?", [
        o.id,
      ]);
    });
    res.json(await getOrderDetail(req.user.id, id, pool));
  });
  webhook.post('/', async (req, res) => {
    if (!validSignature(req, provider.secret)) throw httpError(401, 'Notificación no autorizada');
    if ((req.body.type || req.query.type) !== 'payment') return res.sendStatus(200);
    const id = req.query['data.id'];
    await pool.execute(
      "INSERT INTO mp_notificaciones(payment_id) VALUES (?) ON DUPLICATE KEY UPDATE version=version+1,estado=IF(estado='procesando',estado,'pendiente'),intentos=0,disponible_en=UTC_TIMESTAMP()",
      [id],
    );
    res.sendStatus(200);
  });
  admin.get('/pagos-revision', async (req, res) => {
    const [rows] = await pool.execute(
      "SELECT p.id,p.estado,p.pago_estado,p.creado_en,u.email,(SELECT SUM(i.cantidad*i.precio_unitario) FROM pedido_items i WHERE i.pedido_id=p.id) AS total FROM pedidos p JOIN usuarios u ON u.id=p.usuario_id WHERE p.pago_estado='revision' ORDER BY p.id DESC LIMIT 100",
    );
    res.json(rows);
  });
  async function processNotification() {
    const job = await transaction(async (db) => {
      const [[r]] = await db.execute(
        "SELECT payment_id,version FROM mp_notificaciones WHERE intentos<10 AND ((estado='pendiente' AND disponible_en<=UTC_TIMESTAMP()) OR (estado='procesando' AND actualizado_en<UTC_TIMESTAMP()-INTERVAL 2 MINUTE)) ORDER BY disponible_en LIMIT 1 FOR UPDATE SKIP LOCKED",
      );
      if (!r) return;
      await db.execute(
        "UPDATE mp_notificaciones SET estado='procesando',intentos=intentos+1,actualizado_en=UTC_TIMESTAMP() WHERE payment_id=?",
        [r.payment_id],
      );
      return r;
    });
    if (!job) return false;
    try {
      await applyPayment(await provider.getPayment(job.payment_id));
      await pool.execute(
        "UPDATE mp_notificaciones SET estado=IF(version=?,'listo','pendiente'),actualizado_en=UTC_TIMESTAMP() WHERE payment_id=?",
        [job.version, job.payment_id],
      );
    } catch {
      await pool.execute(
        "UPDATE mp_notificaciones SET estado=IF(intentos>=10,'fallido','pendiente'),disponible_en=UTC_TIMESTAMP()+INTERVAL 1 MINUTE,actualizado_en=UTC_TIMESTAMP() WHERE payment_id=?",
        [job.payment_id],
      );
      console.warn(
        'No se pudo verificar una notificación de pago; revisar la cola de Mercado Pago.',
      );
    }
    return true;
  }
  async function expireOrders() {
    const [rows] = await pool.execute(
      "SELECT id FROM pedidos WHERE estado='pendiente' AND pago_estado<>'revision' AND reserva_hasta<UTC_TIMESTAMP() ORDER BY id LIMIT 25",
    );
    for (const row of rows) {
      try {
        await syncOrder(row.id);
        await transaction(async (db) => {
          const [[o]] = await db.execute('SELECT * FROM pedidos WHERE id=? FOR UPDATE', [row.id]);
          if (o.estado !== 'pendiente' || o.pago_estado === 'revision') return;
          await finishReservation(db, o);
          await db.execute(
            "UPDATE pedidos SET estado='cancelado',pago_estado='vencido' WHERE id=?",
            [o.id],
          );
        });
      } catch {
        console.warn(
          'No se pudo conciliar un pedido vencido; la reserva se conserva hasta verificarlo.',
        );
      }
    }
  }
  function startWorker() {
    let pending = null,
      stopped = false;
    const tick = () => {
      if (pending || stopped) return;
      pending = (async () => {
        if (provider.configured())
          for (let i = 0; i < 10 && !stopped; i++) if (!(await processNotification())) break;
        if (provider.configured()) {
          const [recent] = await pool.execute(
            'SELECT c.pedido_id FROM checkout_pedidos c JOIN pedidos p ON p.id=c.pedido_id WHERE p.creado_en>UTC_TIMESTAMP()-INTERVAL 7 DAY AND (c.revisado_en IS NULL OR c.revisado_en<UTC_TIMESTAMP()-INTERVAL 1 MINUTE) ORDER BY c.revisado_en,c.pedido_id LIMIT 10',
          );
          for (const row of recent) {
            try {
              await syncOrder(row.pedido_id);
            } catch {
              console.warn('No se pudo conciliar un pago reciente; se reintentará.');
            }
          }
        }
        await expireOrders();
      })()
        .catch(() => console.warn('No se pudo procesar la conciliación de pagos.'))
        .finally(() => {
          pending = null;
        });
    };
    const timer = setInterval(tick, 10000);
    timer.unref();
    tick();
    return async () => {
      stopped = true;
      clearInterval(timer);
      if (pending) await pending;
    };
  }
  return {
    router,
    webhook,
    admin,
    applyPayment,
    syncOrder,
    processNotification,
    expireOrders,
    startWorker,
  };
}
export const paymentService = createPaymentService();
