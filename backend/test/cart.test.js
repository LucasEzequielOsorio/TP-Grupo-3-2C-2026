import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';
import { config } from '../src/config.js';

test('Carrito: persistencia, variantes, aislamiento, concurrencia y stock actual', async () => {
  const prefix = 'CART-' + randomUUID();
  const users = [];
  let product, location;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/carrito';
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
      const [r] = await pool.execute(
        "INSERT INTO usuarios(email,password_hash,nombre,apellido,direccion) VALUES (?,'unused','Test','Cart','Temporal')",
        [prefix + i + '@example.invalid'],
      );
      users.push(r.insertId);
    }
    const [categories] = await pool.query('SELECT id FROM categorias LIMIT 1');
    const [sizes] = await pool.query('SELECT id FROM talles ORDER BY id LIMIT 2');
    const [colors] = await pool.query('SELECT id FROM colores LIMIT 1');
    const [p] = await pool.execute(
      'INSERT INTO productos(categoria_id,nombre,descripcion,precio) VALUES (?,?,?,12.35)',
      [categories[0].id, prefix, 'Temporal'],
    );
    product = p.insertId;
    const [u] = await pool.execute(
      "INSERT INTO ubicaciones(nombre,tipo,direccion) VALUES (?,'deposito','Temporal')",
      [prefix],
    );
    location = u.insertId;
    const variants = [];
    for (const size of sizes) {
      const [v] = await pool.execute(
        'INSERT INTO variantes_producto(producto_id,talle_id,color_id,sku) VALUES (?,?,?,?)',
        [product, size.id, colors[0].id, prefix + size.id],
      );
      variants.push(v.insertId);
      await pool.execute(
        'INSERT INTO existencias(variante_id,ubicacion_id,cantidad) VALUES (?,?,5)',
        [v.insertId, location],
      );
    }
    const path = '/items/' + variants[0];
    assert.equal((await call('', 'GET', undefined, null)).status, 401);
    assert.equal((await call(path, 'POST', { cantidad: 0 })).status, 400);
    assert.equal((await call(path, 'POST', { cantidad: 1.5 })).status, 400);
    assert.equal((await call(path, 'POST', { cantidad: 6, precio: 0 })).status, 409);
    const parallel = await Promise.all([
      call(path, 'POST', { cantidad: 2 }),
      call(path, 'POST', { cantidad: 2 }),
    ]);
    assert.ok(parallel.every((r) => r.status === 200));
    let cart = (await call()).body;
    assert.equal(cart.items[0].cantidad, 4);
    assert.equal(cart.total, 49.4);
    assert.equal((await call('', 'GET', undefined, users[1])).body.items.length, 0);
    assert.equal((await call(path, 'POST', { cantidad: 2 })).status, 409);
    assert.equal((await call(path, 'PUT', { cantidad: 2 })).body.total, 24.7);
    if (variants[1])
      assert.equal(
        (await call('/items/' + variants[1], 'POST', { cantidad: 1 })).body.items.length,
        2,
      );
    await pool.execute('UPDATE productos SET precio=20 WHERE id=?', [product]);
    cart = (await call()).body;
    assert.equal(cart.items[0].precio, 20);
    await pool.execute('UPDATE existencias SET cantidad=1 WHERE variante_id=?', [variants[0]]);
    assert.equal((await call()).body.items[0].stock, 1);
    assert.equal((await call(path, 'PUT', { cantidad: 2 })).status, 409);
    await pool.execute('UPDATE productos SET activo=0 WHERE id=?', [product]);
    assert.equal((await call()).body.items[0].stock, 0);
    assert.equal((await call(path, 'POST', { cantidad: 1 })).status, 404);
    await call(path, 'DELETE');
    assert.ok(!(await call()).body.items.some((i) => i.variante_id === variants[0]));
    const [stock] = await pool.execute('SELECT cantidad FROM existencias WHERE variante_id=?', [
      variants[0],
    ]);
    assert.equal(stock[0].cantidad, 1, 'El carrito no descuenta stock');
  } finally {
    for (const id of users)
      await pool.execute('DELETE FROM carrito_items WHERE usuario_id=?', [id]);
    if (product) {
      await pool.execute(
        'DELETE e FROM existencias e JOIN variantes_producto v ON v.id=e.variante_id WHERE v.producto_id=?',
        [product],
      );
      await pool.execute('DELETE FROM variantes_producto WHERE producto_id=?', [product]);
      await pool.execute('DELETE FROM productos WHERE id=?', [product]);
    }
    if (location) await pool.execute('DELETE FROM ubicaciones WHERE id=?', [location]);
    for (const id of users) await pool.execute('DELETE FROM usuarios WHERE id=?', [id]);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
