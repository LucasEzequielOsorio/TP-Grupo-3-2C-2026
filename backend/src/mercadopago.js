import './config.js';
import { httpError } from './validation.js';
const config = () => ({
  token: process.env.MP_ACCESS_TOKEN || '',
  secret: process.env.MP_WEBHOOK_SECRET || '',
  notification: process.env.MP_NOTIFICATION_URL || '',
  back: process.env.MP_BACK_URL || '',
  collector: process.env.MP_COLLECTOR_ID || '',
});
function httpsUrl(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !['localhost', '127.0.0.1'].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
export function paymentConfigured() {
  const c = config();
  return !!(c.token && c.secret && c.collector && httpsUrl(c.notification) && httpsUrl(c.back));
}
export function checkoutUrl(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      [
        'www.mercadopago.com.ar',
        'sandbox.mercadopago.com.ar',
        'www.mercadopago.com',
        'sandbox.mercadopago.com',
      ].includes(u.hostname) &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
async function api(path, { method = 'GET', body, key } = {}) {
  if (!paymentConfigured())
    throw httpError(503, 'Mercado Pago todavía no está configurado para pruebas.');
  try {
    const r = await fetch('https://api.mercadopago.com' + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + config().token,
        'Content-Type': 'application/json',
        ...(key ? { 'X-Idempotency-Key': key } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) {
      const error = httpError(
        502,
        'Mercado Pago no pudo completar la operación. Revisá la configuración o reintentá en unos momentos.',
      );
      error.safeToRetry = r.status >= 400 && r.status < 500;
      throw error;
    }
    return await r.json();
  } catch (error) {
    if (typeof error.safeToRetry === 'boolean') throw error;
    throw httpError(502, 'No pudimos consultar Mercado Pago. Intentá nuevamente en unos momentos.');
  }
}
export const mercadoPago = {
  configured: paymentConfigured,
  get secret() {
    return config().secret;
  },
  get collector() {
    return config().collector;
  },
  async isTestSeller(collector) {
    const me = await api('/users/me');
    return (
      String(me.id) === config().collector &&
      String(me.id) === String(collector) &&
      me.tags?.includes('test_user') === true
    );
  },
  async createPreference(order, items, reference) {
    let me;
    try {
      me = await api('/users/me');
    } catch (error) {
      error.safeToRetry = true;
      throw error;
    }
    if (String(me.id) !== config().collector || !me.tags?.includes('test_user')) {
      const error = httpError(
        503,
        'Usá las credenciales de un vendedor de prueba de Mercado Pago.',
      );
      error.safeToRetry = true;
      throw error;
    }
    const back = config().back.replace(/\/$/, '') + '/tienda/pedidos/' + order.id;
    return api('/checkout/preferences', {
      method: 'POST',
      key: reference,
      body: {
        items: items.map((i) => ({
          id: String(i.variante_id),
          title: (i.nombre + ' · ' + i.talle + ' · ' + i.color).slice(0, 200),
          quantity: i.cantidad,
          unit_price: i.precio_unitario,
          currency_id: 'ARS',
        })),
        external_reference: reference,
        metadata: { pedido_id: order.id },
        notification_url: config().notification,
        back_urls: { success: back, pending: back, failure: back },
        auto_return: 'approved',
        expires: true,
        expiration_date_from: new Date(Date.now() - 60000).toISOString(),
        expiration_date_to: new Date(order.reserva_hasta).toISOString(),
        binary_mode: true,
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }, { id: 'bank_transfer' }],
        },
      },
    });
  },
  async getPayment(id) {
    const payment = await api('/v1/payments/' + encodeURIComponent(id));
    if (String(payment.id) !== String(id))
      throw httpError(502, 'Mercado Pago devolvió un pago distinto al solicitado');
    return payment;
  },
  getPreference: (id) => api('/checkout/preferences/' + encodeURIComponent(id)),
  async findPayments(reference) {
    const r = await api(
      '/v1/payments/search?external_reference=' +
        encodeURIComponent(reference) +
        '&limit=100&sort=date_created&criteria=desc',
    );
    if ((r.paging?.total || 0) > 100)
      throw httpError(409, 'Este pedido requiere revisión de sus pagos.');
    return r.results || [];
  },
  async findPreference(reference) {
    const r = await api(
      '/checkout/preferences/search?external_reference=' + encodeURIComponent(reference),
    );
    return r.elements || [];
  },
};
