import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';
import { config } from '../src/config.js';

test('Favoritos: autenticación, alta repetida, aislamiento y baja', async () => {
  const prefix = 'FAV-' + randomUUID();
  const usuarios = [];
  let producto;
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => servidor.once('listening', resolve));
  const urlBase = 'http://127.0.0.1:' + servidor.address().port + '/api/favoritos';
  const crearToken = (id) =>
    jwt.sign({}, config.jwtSecret, {
      subject: String(id),
      expiresIn: '1h',
      issuer: 'tienda-ropa',
      audience: 'tienda-angular',
      algorithm: 'HS256',
    });
  async function llamar(ruta = '', metodo = 'GET', usuario = usuarios[0]) {
    const respuesta = await fetch(urlBase + ruta, {
      method: metodo,
      headers: usuario ? { Authorization: 'Bearer ' + crearToken(usuario) } : {},
    });
    return {
      status: respuesta.status,
      body: respuesta.status === 204 ? null : await respuesta.json(),
    };
  }

  try {
    for (let i = 0; i < 2; i++) {
      const [creado] = await pool.execute(
        "INSERT INTO usuarios(email,password_hash,nombre,apellido,direccion) VALUES (?,'unused','Prueba','Favoritos','Temporal')",
        [prefix + i + '@example.invalid'],
      );
      usuarios.push(creado.insertId);
    }

    const [categorias] = await pool.query('SELECT id FROM categorias LIMIT 1');
    const [productoCreado] = await pool.execute(
      'INSERT INTO productos(categoria_id,nombre,descripcion,precio) VALUES (?,?,?,12.35)',
      [categorias[0].id, prefix, 'Temporal'],
    );
    producto = productoCreado.insertId;

    assert.equal((await llamar('', 'GET', null)).status, 401);
    assert.equal((await llamar('/0', 'POST')).status, 400);
    assert.equal((await llamar('/4294967295', 'POST')).status, 404);

    const enParalelo = await Promise.all([
      llamar('/' + producto, 'POST'),
      llamar('/' + producto, 'POST'),
    ]);
    assert.deepEqual(
      enParalelo.map((resultado) => resultado.status).sort(),
      [200, 201],
    );
    assert.equal(
      enParalelo.find((resultado) => resultado.status === 201).body.favorito,
      true,
    );

    const favoritos = await llamar();
    assert.equal(favoritos.status, 200);
    assert.equal(favoritos.body.length, 1);
    assert.equal(favoritos.body[0].id, producto);
    assert.equal(favoritos.body[0].stock, 0);
    assert.deepEqual((await llamar('', 'GET', usuarios[1])).body, []);

    await pool.execute('UPDATE productos SET activo=0 WHERE id=?', [producto]);
    assert.deepEqual((await llamar()).body, []);
    assert.equal((await llamar('/' + producto, 'POST')).status, 404);
    assert.deepEqual((await llamar('/' + producto, 'DELETE')).body, {
      producto_id: producto,
      favorito: false,
    });
  } finally {
    if (producto) await pool.execute('DELETE FROM productos WHERE id=?', [producto]);
    for (const id of usuarios) await pool.execute('DELETE FROM usuarios WHERE id=?', [id]);
    await new Promise((resolve) => servidor.close(resolve));
    await pool.end();
  }
});
