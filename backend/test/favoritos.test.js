import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';
import { config } from '../src/config.js';

test('Favoritos: autenticación, persistencia, aislamiento y toggles simultáneos', async () => {
  const prefix = 'FAV-' + randomUUID();
  const users = [];
  let product;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/favoritos';
  const token = (id) =>
    jwt.sign({}, config.jwtSecret, {
      subject: String(id),
      expiresIn: '1h',
      issuer: 'tienda-ropa',
      audience: 'tienda-angular',
      algorithm: 'HS256',
    });
  async function call(path = '/ids', method = 'GET', user = users[0]) {
    const response = await fetch(base + path, {
      method,
      headers: user ? { Authorization: 'Bearer ' + token(user) } : {},
    });
    return { status: response.status, body: await response.json() };
  }

  try {
    for (let i = 0; i < 2; i++) {
      const [result] = await pool.execute(
        "INSERT INTO usuarios(email,password_hash,nombre,apellido,direccion) VALUES (?,'unused','Test','Favorite','Temporal')",
        [prefix + i + '@example.invalid'],
      );
      users.push(result.insertId);
    }

    const [categories] = await pool.query('SELECT id FROM categorias LIMIT 1');
    const [created] = await pool.execute(
      'INSERT INTO productos(categoria_id,nombre,descripcion,precio) VALUES (?,?,?,12.35)',
      [categories[0].id, prefix, 'Temporal'],
    );
    product = created.insertId;

    assert.equal((await call('/ids', 'GET', null)).status, 401);
    assert.deepEqual((await call()).body, { ids: [] });
    assert.equal((await call('/toggle/invalid', 'POST')).status, 400);
    assert.equal((await call('/toggle/4294967295', 'POST')).status, 404);

    assert.deepEqual((await call('/toggle/' + product, 'POST')).body, {
      productoId: product,
      esFavorito: true,
    });
    assert.deepEqual((await call()).body, { ids: [product] });
    assert.deepEqual((await call('/ids', 'GET', users[1])).body, { ids: [] });
    assert.deepEqual((await call('/toggle/' + product, 'POST')).body, {
      productoId: product,
      esFavorito: false,
    });

    const concurrent = await Promise.all([
      call('/toggle/' + product, 'POST'),
      call('/toggle/' + product, 'POST'),
    ]);
    assert.ok(concurrent.every((result) => result.status === 200));
    assert.deepEqual((await call()).body, { ids: [] });

    await pool.execute('UPDATE productos SET activo=0 WHERE id=?', [product]);
    assert.equal((await call('/toggle/' + product, 'POST')).status, 404);
  } finally {
    if (product) await pool.execute('DELETE FROM productos WHERE id=?', [product]);
    for (const id of users) await pool.execute('DELETE FROM usuarios WHERE id=?', [id]);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
