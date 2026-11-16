import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { pool } from '../db.js';
import { httpError, parseId } from '../validation.js';
import { getOrderDetail } from './orders.service.js';
import { finishReservation } from '../reservations.js';
import { mercadoPago, checkoutUrl } from '../mercadopago.js';
import {
  cancelOrder,
  completePaymentNotification,
  confirmOrderPayment,
  createCheckout,
  enqueuePaymentNotification,
  expireOrder,
  findCheckoutByPedidoId,
  findCheckoutByPedidoIdForUpdate,
  findCheckoutByReference,
  findNextPaymentNotification,
  findOrderByIdAndUserForUpdate,
  findOrderByIdForUpdate,
  findPaymentByIdForUpdate,
  getOrderTotal,
  listPaymentsNeedingReview,
  listExpiredOrders,
  listRecentCheckouts,
  markCheckoutReviewed,
  markPaymentNotificationProcessing,
  retryPaymentNotification,
  saveCheckoutPreference,
  savePaymentRecord,
  setOrderPaymentReview,
  setOrderPaymentStatus,
  updateCheckoutRetryState,
  updateCheckoutState,
  withPaymentTransaction,
} from '../repositories/payments.repository.js';

const cents = (value) => Math.round(Number(value) * 100);

function validSignature(req, secret) {
  const id = req.query['data.id'];
  const requestId = req.headers['x-request-id'];
  const signature = req.headers['x-signature'];
  if (
    typeof id !== 'string' ||
    !/^\d{1,100}$/.test(id) ||
    typeof requestId !== 'string' ||
    !requestId ||
    requestId.length > 200 ||
    typeof signature !== 'string' ||
    !secret
  )
    return false;

  const entries = signature.split(',').map((entry) => entry.trim().split('='));
  const timestamp = entries.find(([key]) => key === 'ts')?.[1];
  const digest = entries.find(([key]) => key === 'v1')?.[1];
  if (!/^\d{10,13}$/.test(timestamp || '') || !/^[a-f0-9]{64}$/i.test(digest || ''))
    return false;

  const signedAt = timestamp.length <= 10 ? Number(timestamp) * 1000 : Number(timestamp);
  if (Math.abs(Date.now() - signedAt) > 15 * 60 * 1000) return false;
  if (req.body?.data?.id !== undefined && String(req.body.data.id) !== id) return false;

  const expected = createHmac('sha256', secret)
    .update('id:' + id + ';request-id:' + requestId + ';ts:' + timestamp + ';')
    .digest();
  return timingSafeEqual(expected, Buffer.from(digest, 'hex'));
}

export function createPaymentService(provider = mercadoPago) {
  async function applyPayment(payment) {
    if (!/^\d{1,100}$/.test(String(payment.id)) || !payment.external_reference)
      throw httpError(422, 'Pago sin referencia válida');

    const testAccount =
      payment.live_mode === true &&
      typeof provider.isTestSeller === 'function' &&
      (await provider.isTestSeller(payment.collector_id));

    return withPaymentTransaction(async (db) => {
      const checkout = await findCheckoutByReference(db, payment.external_reference);
      if (!checkout) return null;

      const order = await findOrderByIdForUpdate(db, checkout.pedido_id);
      if (!order) return null;

      const total = await getOrderTotal(db, order.id);
      if (
        payment.currency_id !== 'ARS' ||
        cents(payment.transaction_amount) !== cents(total) ||
        String(payment.collector_id) !== String(provider.collector) ||
        !(payment.live_mode === false || testAccount)
      )
        throw httpError(
          422,
          'El pago no coincide con el importe, moneda o vendedor de prueba del pedido',
        );

      const updatedAt = new Date(payment.date_last_updated || payment.date_created);
      if (!Number.isFinite(updatedAt.getTime())) throw httpError(422, 'Fecha de pago inválida');

      const previous = await findPaymentByIdForUpdate(db, payment.id);
      if (previous && previous.pedido_id !== order.id)
        throw httpError(422, 'El pago pertenece a otro pedido');
      if (previous && new Date(previous.actualizado_mp) > updatedAt) return order;

      await savePaymentRecord(db, {
        paymentId: payment.id,
        orderId: order.id,
        status: payment.status,
        amount: payment.transaction_amount,
        updatedAt,
      });

      const adverse =
        ['refunded', 'charged_back'].includes(payment.status) ||
        Number(payment.transaction_amount_refunded || 0) > 0;
      if (adverse) {
        await setOrderPaymentReview(db, order.id);
        return order;
      }

      if (payment.status === 'approved') {
        if (order.pago_id === String(payment.id)) return order;
        if (order.pago_id || order.estado !== 'pendiente' || order.pago_estado === 'revision') {
          await setOrderPaymentReview(db, order.id);
          return order;
        }

        const consumed = await finishReservation(db, order, true);
        if (!consumed) {
          await setOrderPaymentReview(db, order.id);
          return order;
        }
        await confirmOrderPayment(db, order.id, payment.id);
      } else if (order.estado === 'pendiente' && !order.pago_id && order.pago_estado !== 'revision') {
        await setOrderPaymentStatus(
          db,
          order.id,
          payment.status === 'rejected' ? 'rechazado' : 'pendiente',
        );
      }

      return order;
    });
  }

  async function syncOrder(orderId) {
    const checkout = await findCheckoutByPedidoId(pool, orderId);
    if (!checkout) return;
    if (!provider.configured())
      throw httpError(503, 'El servicio de pagos no está disponible en este momento');

    const results = await provider.findPayments(checkout.referencia);
    for (const result of results) {
      await applyPayment(await provider.getPayment(String(result.id)));
    }
    await markCheckoutReviewed(pool, orderId);
  }

  async function savePreference(orderId, preference, reference) {
    if (
      !preference?.id ||
      !checkoutUrl(preference.init_point) ||
      preference.external_reference !== reference ||
      String(preference.collector_id) !== String(provider.collector)
    )
      throw httpError(502, 'Mercado Pago devolvió un checkout inválido');

    await saveCheckoutPreference(pool, orderId, preference.id, preference.init_point);
    return { checkout_url: preference.init_point };
  }

  async function startCheckout(userId, orderId) {
    const id = parseId(orderId);
    if (!provider.configured())
      throw httpError(503, 'Mercado Pago todavía no está disponible para realizar este pago.');

    const state = await withPaymentTransaction(async (db) => {
      const order = await findOrderByIdAndUserForUpdate(db, id, userId);
      if (!order) throw httpError(404, 'Pedido no encontrado');
      if (
        order.estado !== 'pendiente' ||
        order.pago_estado === 'revision' ||
        new Date(order.reserva_hasta) <= new Date()
      )
        throw httpError(409, 'El pedido ya no está disponible para pagar');

      await createCheckout(db, id, randomUUID());
      const checkout = await findCheckoutByPedidoIdForUpdate(db, id);
      if (!checkout) throw httpError(404, 'Pedido sin checkout');
      if (checkout.estado !== 'nuevo') return { order, checkout, create: false };

      await updateCheckoutState(db, id, 'creando');
      return { order, checkout: { ...checkout, estado: 'creando' }, create: true };
    });

    if (state.checkout.estado === 'listo') {
      if (
        checkoutUrl(state.checkout.checkout_url) &&
        !new URL(state.checkout.checkout_url).hostname.startsWith('sandbox.')
      )
        return { checkout_url: state.checkout.checkout_url };

      return savePreference(
        id,
        await provider.getPreference(state.checkout.preference_id),
        state.checkout.referencia,
      );
    }

    if (!state.create) {
      const preferences = await provider.findPreference(state.checkout.referencia);
      const found = preferences[0];
      if (found) {
        return savePreference(
          id,
          await provider.getPreference(found.id),
          state.checkout.referencia,
        );
      }
      throw httpError(
        409,
        'El inicio de pago sigue verificándose. Actualizá su estado en unos momentos.',
      );
    }

    try {
      const detail = await getOrderDetail(userId, id, pool);
      const preference = await provider.createPreference(
        state.order,
        detail.items,
        state.checkout.referencia,
      );
      return savePreference(id, preference, state.checkout.referencia);
    } catch (error) {
      await updateCheckoutRetryState(pool, id, error.safeToRetry ? 'nuevo' : 'incierto');
      throw error;
    }
  }

  async function syncOrderForUser(userId, orderId) {
    const id = parseId(orderId);
    const order = await getOrderDetail(userId, id, pool);
    await syncOrder(order.id);
    return getOrderDetail(userId, id, pool);
  }

  async function cancelOrderPayment(userId, orderId) {
    const id = parseId(orderId);
    await getOrderDetail(userId, id, pool);
    if (await findCheckoutByPedidoId(pool, id)) await syncOrder(id);

    await withPaymentTransaction(async (db) => {
      const order = await findOrderByIdAndUserForUpdate(db, id, userId);
      if (!order || order.estado === 'cancelado') return;
      if (order.estado !== 'pendiente' || order.pago_estado === 'revision')
        throw httpError(409, 'Este pedido no se puede cancelar automáticamente');

      await finishReservation(db, order);
      await cancelOrder(db, order.id);
    });

    return getOrderDetail(userId, id, pool);
  }

  function validWebhookSignature(req) {
    return validSignature(req, provider.secret);
  }

  async function enqueueWebhook(req) {
    if ((req.body.type || req.query.type) !== 'payment') return;
    await enqueuePaymentNotification(pool, req.query['data.id']);
  }

  async function processNotification() {
    const job = await withPaymentTransaction(async (db) => {
      const next = await findNextPaymentNotification(db);
      if (!next) return null;
      await markPaymentNotificationProcessing(db, next.payment_id);
      return next;
    });
    if (!job) return false;

    try {
      await applyPayment(await provider.getPayment(job.payment_id));
      await completePaymentNotification(pool, job.payment_id, job.version);
    } catch {
      await retryPaymentNotification(pool, job.payment_id);
      console.warn('No se pudo verificar una notificación de pago; revisar la cola de Mercado Pago.');
    }

    return true;
  }

  async function expireOrders() {
    const orders = await listExpiredOrders(pool);
    for (const { id } of orders) {
      try {
        await syncOrder(id);
        await withPaymentTransaction(async (db) => {
          const order = await findOrderByIdForUpdate(db, id);
          if (!order || order.estado !== 'pendiente' || order.pago_estado === 'revision') return;
          await finishReservation(db, order);
          await expireOrder(db, order.id);
        });
      } catch {
        console.warn(
          'No se pudo conciliar un pedido vencido; la reserva se conserva hasta verificarlo.',
        );
      }
    }
  }

  async function listPaymentsForReview() {
    return listPaymentsNeedingReview(pool);
  }

  function startWorker() {
    let pending = null;
    let stopped = false;

    const tick = () => {
      if (pending || stopped) return;
      pending = (async () => {
        if (provider.configured()) {
          for (let i = 0; i < 10 && !stopped; i++) {
            if (!(await processNotification())) break;
          }

          const recent = await listRecentCheckouts(pool);
          for (const checkout of recent) {
            try {
              await syncOrder(checkout.pedido_id);
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
    applyPayment,
    cancelOrderPayment,
    enqueueWebhook,
    expireOrders,
    listPaymentsForReview,
    processNotification,
    startCheckout,
    startWorker,
    syncOrder,
    syncOrderForUser,
    validWebhookSignature,
  };
}

export const paymentService = createPaymentService();
