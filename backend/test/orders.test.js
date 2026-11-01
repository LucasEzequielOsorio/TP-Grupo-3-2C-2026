import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';
import { config } from '../src/config.js';

test('Pedidos: stock atómico, reintentos, aislamiento, precios y copia histórica', async () => {
  const prefix = 'ORDER-' + randomUUID();
  const users = [],
    locations = [];
  let product, variant;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/pedidos';
  const token = (id) =>
    jwt.sign({}, config.jwtSecret, {
      subject: String(id),
      expiresIn: '1h',
      issuer: 'tienda-ropa',
      audience: 'tienda-angular',
      algorithm: 'HS256',
    });
  async function call(path = '', method = 'GET', body, user = users[0]) {
    const r = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(user ? { Authorization: 'Bearer ' + token(user) } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json() };
  }
  try {
    for (let i = 0; i < 2; i++) {
      const [u] = await pool.execute(
        "INSERT INTO usuarios(email,password_hash,nombre,apellido,direccion) VALUES (?,'unused','Test','Temporal','Dirección original')",
        [prefix + i + '@example.invalid'],
      );
      users.push(u.insertId);
    }
    const [[category]] = await pool.query('SELECT id FROM categorias LIMIT 1');
    const [[size]] = await pool.query('SELECT id FROM talles LIMIT 1');
    const [[color]] = await pool.query('SELECT id FROM colores LIMIT 1');
    const [p] = await pool.execute(
      'INSERT INTO productos(categoria_id,nombre,descripcion,precio) VALUES (?,?,?,10.50)',
      [category.id, prefix, 'Temporal'],
    );
    product = p.insertId;
    const [v] = await pool.execute(
      'INSERT INTO variantes_producto(producto_id,talle_id,color_id,sku) VALUES (?,?,?,?)',
      [product, size.id, color.id, prefix],
    );
    variant = v.insertId;
    for (let i = 0; i < 2; i++) {
      const [l] = await pool.execute(
        "INSERT INTO ubicaciones(nombre,tipo,direccion) VALUES (?,'deposito','Temporal')",
        [prefix + i],
      );
      locations.push(l.insertId);
      await pool.execute(
        'INSERT INTO existencias(variante_id,ubicacion_id,cantidad) VALUES (?,?,1)',
        [variant, l.insertId],
      );
    }
    for (const u of users)
      await pool.execute(
        'INSERT INTO carrito_items(usuario_id,variante_id,cantidad) VALUES (?,?,2)',
        [u, variant],
      );
    const body = {
      clave: randomUUID(),
      items: [{ variante_id: variant, cantidad: 2, precio: 10.5 }],
    };
    assert.equal((await call('', 'POST', body, null)).status, 401);
    assert.equal(
      (await call('', 'POST', { ...body, items: [{ ...body.items[0], precio: 1 }] })).status,
      409,
    );
    const [none] = await pool.execute('SELECT id FROM pedidos WHERE usuario_id=?', [users[0]]);
    assert.equal(none.length, 0);
    const otherBody = { ...body, clave: randomUUID() };
    const race = await Promise.all([
      call('', 'POST', body),
      call('', 'POST', body),
      call('', 'POST', otherBody, users[1]),
    ]);
    const success = race.find((r) => r.status === 201);
    assert.ok(success, JSON.stringify(race));
    const [orders] = await pool.execute('SELECT * FROM pedidos WHERE usuario_id IN (?,?)', users);
    assert.equal(orders.length, 1, 'Solo un carrito puede consumir las últimas unidades');
    const order = orders[0],
      owner = order.usuario_id,
      other = users.find((u) => u !== owner);
    const ownResponses = race.filter((r) => r.status === 201);
    assert.ok(
      ownResponses.every((r) => r.body.id === order.id),
      'Reintentos no generan más pedidos',
    );
    assert.equal((await call('/' + order.id, 'GET', undefined, other)).status, 404);
    assert.equal((await call('', 'GET', undefined, other)).body.length, 0);
    const [stock] = await pool.execute(
      'SELECT SUM(cantidad) AS cantidad FROM existencias WHERE variante_id=?',
      [variant],
    );
    assert.equal(Number(stock[0].cantidad), 0);
    const [moves] = await pool.execute(
      "SELECT SUM(cantidad) AS cantidad,COUNT(*) AS filas FROM movimientos_stock WHERE pedido_id=? AND motivo='venta'",
      [order.id],
    );
    assert.equal(Number(moves[0].cantidad), -2);
    assert.equal(moves[0].filas, 2);
    const [cart] = await pool.execute('SELECT * FROM carrito_items WHERE usuario_id=?', [owner]);
    assert.equal(cart.length, 0);
    await pool.execute('UPDATE productos SET nombre=?,precio=99 WHERE id=?', [
      prefix + '-editado',
      product,
    ]);
    await pool.execute("UPDATE usuarios SET direccion='Otra dirección' WHERE id=?", [owner]);
    const historical = await call('/' + order.id, 'GET', undefined, owner);
    assert.equal(historical.body.total, 21);
    assert.equal(historical.body.items[0].nombre, prefix);
    assert.equal(historical.body.direccion_entrega, 'Dirección original');
    assert.equal((await call('', 'POST', owner === users[0] ? body : otherBody, owner)).body.id, order.id);
    const [remaining] = await pool.execute(
      'SELECT cantidad FROM carrito_items WHERE usuario_id=?',
      [other],
    );
    assert.equal(remaining[0].cantidad, 2);
  } finally {
    for (const u of users) {
      await pool.execute('DELETE FROM carrito_items WHERE usuario_id=?', [u]);
      await pool.execute('DELETE FROM movimientos_stock WHERE usuario_id=?', [u]);
      await pool.execute(
        'DELETE d FROM pedido_detalles d JOIN pedido_items i ON i.id=d.item_id JOIN pedidos p ON p.id=i.pedido_id WHERE p.usuario_id=?',
        [u],
      );
      await pool.execute(
        'DELETE i FROM pedido_items i JOIN pedidos p ON p.id=i.pedido_id WHERE p.usuario_id=?',
        [u],
      );
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
