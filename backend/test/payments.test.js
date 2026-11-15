import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../src/db.js';
import { config } from '../src/config.js';
import { ordersRouter } from '../src/orders.js';
import { productsRouter, adminRouter } from '../src/products.js';
import { transfersRouter } from '../src/transfers.js';
import { createPaymentService } from '../src/payments.js';

test('Mercado Pago: reservas, concurrencia, firma, aprobación única, cancelación y pagos tardíos', async () => {
  const tag = 'MP-' + randomUUID(),
    users = [],
    locations = [],
    orders = [],
    paymentIds = [];
  let product,
    variant,
    created = 0,
    ambiguous = false,
    offline = false;
  const preferences = new Map(),
    payments = new Map();
  const provider = {
    configured: () => true,
    secret: 'secreto-de-prueba-de-webhook-no-real',
    collector: '1234',
    async createPreference(o, items, ref) {
      created++;
      const pref = {
        id: 'pref-' + randomUUID(),
        external_reference: ref,
        collector_id: 1234,
        init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=' + randomUUID(),
        sandbox_init_point:
          'https://sandbox.mercadopago.com/mla/checkout/pay?pref_id=' + randomUUID(),
      };
      preferences.set(pref.id, pref);
      if (ambiguous) {
        ambiguous = false;
        throw Object.assign(new Error('Timeout simulado'), { status: 502 });
      }
      return pref;
    },
    findPreference: async (ref) =>
      [...preferences.values()].filter((p) => p.external_reference === ref),
    getPreference: async (id) => preferences.get(id),
    getPayment: async (id) => payments.get(String(id)),
    findPayments: async (ref) => {
      if (offline) throw Object.assign(new Error('MP sin conexión'), { status: 502 });
      return [...payments.values()].filter((p) => p.external_reference === ref);
    },
  };
  const service = createPaymentService(provider);
  const app = express();
  app.use(express.json());
  app.use('/api/pedidos', ordersRouter);
  app.use('/api/pedidos', service.router);
  app.use('/api/productos', productsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin', transfersRouter);
  app.use('/api/admin', service.admin);
  app.use('/api/hook', service.webhook);
  app.use((e, req, res, next) => res.status(e.status || 500).json({ mensaje: e.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const token = (id) =>
    jwt.sign({}, config.jwtSecret, {
      subject: String(id),
      expiresIn: '1h',
      issuer: 'tienda-ropa',
      audience: 'tienda-angular',
      algorithm: 'HS256',
    });
  async function call(path, method = 'GET', body, user = users[0], headers = {}) {
    const r = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(user ? { Authorization: 'Bearer ' + token(user) } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    return { status: r.status, body: text === 'OK' ? {} : JSON.parse(text) };
  }
  async function order(qty) {
    await pool.execute(
      'INSERT INTO carrito_items(usuario_id,variante_id,cantidad) VALUES (?,?,?)',
      [users[0], variant, qty],
    );
    const r = await call('/pedidos', 'POST', {
      clave: randomUUID(),
      items: [{ variante_id: variant, cantidad: qty, precio: 50 }],
    });
    assert.equal(r.status, 201, JSON.stringify(r));
    orders.push(r.body.id);
    return r.body;
  }
  async function balance() {
    const [[b]] = await pool.execute(
      'SELECT SUM(cantidad) AS fisico,SUM(reservada) AS reservado FROM existencias WHERE variante_id=?',
      [variant],
    );
    return { fisico: Number(b.fisico), reservado: Number(b.reservado) };
  }
  async function payment(o, status = 'approved') {
    const [[ref]] = await pool.execute(
      'SELECT referencia FROM checkout_pedidos WHERE pedido_id=?',
      [o.id],
    );
    const id = String(Date.now()) + String(paymentIds.length);
    paymentIds.push(id);
    const p = {
      id,
      external_reference: ref.referencia,
      status,
      transaction_amount: o.total,
      currency_id: 'ARS',
      collector_id: 1234,
      live_mode: false,
      date_last_updated: new Date().toISOString(),
    };
    payments.set(id, p);
    return p;
  }
  try {
    for (const rol of ['cliente', 'cliente', 'admin']) {
      const [u] = await pool.execute(
        "INSERT INTO usuarios(email,password_hash,nombre,apellido,direccion,rol) VALUES (?,'unused','Test','Pago','Temporal',?)",
        [tag + users.length + '@example.invalid', rol],
      );
      users.push(u.insertId);
    }
    const [[c]] = await pool.query('SELECT id FROM categorias LIMIT 1'),
      [[s]] = await pool.query('SELECT id FROM talles LIMIT 1'),
      [[color]] = await pool.query('SELECT id FROM colores LIMIT 1');
    const [p] = await pool.execute(
      'INSERT INTO productos(categoria_id,nombre,descripcion,precio) VALUES (?,?,?,50)',
      [c.id, tag, 'Temporal'],
    );
    product = p.insertId;
    const [v] = await pool.execute(
      'INSERT INTO variantes_producto(producto_id,talle_id,color_id,sku) VALUES (?,?,?,?)',
      [product, s.id, color.id, tag],
    );
    variant = v.insertId;
    for (const qty of [4, 6]) {
      const [l] = await pool.execute(
        "INSERT INTO ubicaciones(nombre,tipo,direccion) VALUES (?,'deposito','Temporal')",
        [tag + qty],
      );
      locations.push(l.insertId);
      await pool.execute(
        'INSERT INTO existencias(variante_id,ubicacion_id,cantidad) VALUES (?,?,?)',
        [variant, l.insertId, qty],
      );
    }
    const first = await order(3);
    assert.deepEqual(await balance(), { fisico: 10, reservado: 3 });
    assert.equal((await call('/productos/' + product)).body.stock, 7);
    const adminProduct = (await call('/admin/productos/' + product, 'GET', undefined, users[2]))
      .body;
    adminProduct.variantes[0].existencias[0].cantidad = 0;
    assert.equal(
      (await call('/admin/productos/' + product, 'PUT', adminProduct, users[2])).status,
      409,
      'Ajustes no gastan reservas',
    );
    assert.equal(
      (
        await call(
          '/admin/transferencias',
          'POST',
          {
            origen_id: locations[0],
            destino_id: locations[1],
            items: [{ variante_id: variant, cantidad: 2 }],
          },
          users[2],
        )
      ).status,
      409,
      'Traslados no gastan reservas',
    );
    assert.equal((await call('/pedidos/' + first.id + '/pagar', 'POST', {}, users[1])).status, 404);
    const starts = await Promise.all([
      call('/pedidos/' + first.id + '/pagar', 'POST', {}),
      call('/pedidos/' + first.id + '/pagar', 'POST', {}),
    ]);
    assert.ok(starts.some((r) => r.status === 200));
    assert.equal(created, 1);
    const ready = await call('/pedidos/' + first.id + '/pagar', 'POST', {});
    assert.equal(ready.status, 200);
    assert.equal(new URL(ready.body.checkout_url).hostname, 'www.mercadopago.com.ar');
    await pool.execute('UPDATE checkout_pedidos SET checkout_url=? WHERE pedido_id=?', [
      [...preferences.values()][0].sandbox_init_point,
      first.id,
    ]);
    const recovered = await call('/pedidos/' + first.id + '/pagar', 'POST', {});
    assert.equal(recovered.status, 200);
    assert.equal(recovered.body.checkout_url, ready.body.checkout_url);
    assert.equal(created, 1);
    const approved = await payment(first);
    for (const changed of [
      { transaction_amount: 1 },
      { currency_id: 'USD' },
      { collector_id: 999 },
      { live_mode: true },
    ])
      await assert.rejects(
        () => service.applyPayment({ ...approved, ...changed }),
        (e) => e.status === 422,
      );
    provider.isTestSeller = async () => false;
    await assert.rejects(
      () => service.applyPayment({ ...approved, live_mode: true }),
      (e) => e.status === 422,
    );
    provider.isTestSeller = async (collector) => String(collector) === provider.collector;
    approved.live_mode = true;
    const ts = String(Date.now()),
      rid = randomUUID();
    const sign = createHmac('sha256', provider.secret)
      .update('id:' + approved.id + ';request-id:' + rid + ';ts:' + ts + ';')
      .digest('hex');
    const headers = { 'x-signature': 'ts=' + ts + ',v1=' + sign, 'x-request-id': rid };
    const path = '/hook?type=payment&data.id=' + approved.id,
      body = { type: 'payment', data: { id: approved.id } };
    assert.equal((await call(path, 'POST', body, null)).status, 401);
    assert.equal(
      (await call(path, 'POST', { type: 'payment', data: { id: '999' } }, null, headers)).status,
      401,
    );
    assert.equal((await call(path, 'POST', body, null, headers)).status, 200);
    await service.processNotification();
    assert.deepEqual(await balance(), { fisico: 7, reservado: 0 });
    assert.equal((await call('/pedidos/' + first.id)).body.pago_estado, 'aprobado');
    await Promise.all([service.applyPayment(approved), service.applyPayment(approved)]);
    assert.deepEqual(await balance(), { fisico: 7, reservado: 0 });
    const [[moves]] = await pool.execute(
      "SELECT SUM(cantidad) AS total FROM movimientos_stock WHERE pedido_id=? AND motivo='venta'",
      [first.id],
    );
    assert.equal(Number(moves.total), -3);
    assert.equal((await call('/pedidos/' + first.id + '/cancelar', 'POST', {})).status, 409);
    const second = await order(2);
    await call('/pedidos/' + second.id + '/pagar', 'POST', {});
    const rejected = await payment(second, 'rejected');
    await service.applyPayment(rejected);
    assert.deepEqual(await balance(), { fisico: 7, reservado: 2 });
    assert.equal((await call('/pedidos/' + second.id + '/cancelar', 'POST', {})).status, 200);
    assert.deepEqual(await balance(), { fisico: 7, reservado: 0 });
    const late = {
      ...rejected,
      status: 'approved',
      date_last_updated: new Date(Date.now() + 1000).toISOString(),
    };
    payments.set(late.id, late);
    await service.applyPayment(late);
    assert.equal((await call('/pedidos/' + second.id)).body.pago_estado, 'revision');
    assert.deepEqual(
      await balance(),
      { fisico: 7, reservado: 0 },
      'Un pago tardío no consume mercadería liberada',
    );
    assert.equal((await call('/admin/pagos-revision')).status, 403);
    assert.ok(
      (await call('/admin/pagos-revision', 'GET', undefined, users[2])).body.some(
        (p) => p.id === second.id,
      ),
    );
    const third = await order(2);
    assert.equal(
      (await call('/pedidos/' + third.id + '?status=approved&payment_id=123')).body.pago_estado,
      'pendiente',
      'La URL de retorno no confirma pagos',
    );
    await pool.execute(
      'UPDATE pedidos SET reserva_hasta=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE id=?',
      [third.id],
    );
    await service.expireOrders();
    assert.equal((await call('/pedidos/' + third.id)).body.pago_estado, 'vencido');
    assert.deepEqual(await balance(), { fisico: 7, reservado: 0 });
    const fourth = await order(1);
    ambiguous = true;
    const before = created;
    assert.equal((await call('/pedidos/' + fourth.id + '/pagar', 'POST', {})).status, 502);
    assert.equal((await call('/pedidos/' + fourth.id + '/pagar', 'POST', {})).status, 200);
    assert.equal(created, before + 1, 'Un timeout se recupera sin crear otra preferencia');
    await pool.execute(
      'UPDATE pedidos SET reserva_hasta=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE id=?',
      [fourth.id],
    );
    offline = true;
    await service.expireOrders();
    assert.deepEqual(
      await balance(),
      { fisico: 7, reservado: 1 },
      'No liberar ante incertidumbre del proveedor',
    );
    offline = false;
    await service.expireOrders();
    assert.deepEqual(await balance(), { fisico: 7, reservado: 0 });
    const duplicate = await payment(first);
    await service.applyPayment(duplicate);
    assert.equal((await call('/pedidos/' + first.id)).body.pago_estado, 'revision');
    assert.deepEqual(await balance(), { fisico: 7, reservado: 0 });
  } finally {
    for (const id of paymentIds)
      await pool.execute('DELETE FROM mp_notificaciones WHERE payment_id=?', [id]);
    for (const u of users) {
      await pool.execute('DELETE FROM carrito_items WHERE usuario_id=?', [u]);
      await pool.execute('DELETE FROM movimientos_stock WHERE usuario_id=?', [u]);
      for (const table of [
        'pagos_mp',
        'reservas_pedido',
        'checkout_pedidos',
        'pedido_detalles',
        'pedido_items',
      ]) {
        if (table === 'pedido_detalles')
          await pool.execute(
            'DELETE d FROM pedido_detalles d JOIN pedido_items i ON i.id=d.item_id JOIN pedidos p ON p.id=i.pedido_id WHERE p.usuario_id=?',
            [u],
          );
        else
          await pool.execute(
            'DELETE t FROM ' + table + ' t JOIN pedidos p ON p.id=t.pedido_id WHERE p.usuario_id=?',
            [u],
          );
      }
      await pool.execute('DELETE FROM pedido_confirmaciones WHERE usuario_id=?', [u]);
      await pool.execute('DELETE FROM pedidos WHERE usuario_id=?', [u]);
    }
    if (variant) {
      await pool.execute('DELETE FROM existencias WHERE variante_id=?', [variant]);
      await pool.execute('DELETE FROM variantes_producto WHERE id=?', [variant]);
    }
    if (product) await pool.execute('DELETE FROM productos WHERE id=?', [product]);
    for (const l of locations) await pool.execute('DELETE FROM ubicaciones WHERE id=?', [l]);
    for (const u of users) await pool.execute('DELETE FROM usuarios WHERE id=?', [u]);
    await new Promise((r) => server.close(r));
    await pool.end();
  }
});
