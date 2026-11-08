import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';

test('Mi cuenta: datos reales, roles, email único, contraseña y revocación de sesiones', async () => {
  const tag = 'ACCOUNT-' + randomUUID();
  const ids = [];
  const emails = [];
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const password = 'Cuenta2026$&*+';
  async function call(path, method = 'GET', body, token) {
    const r = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json() };
  }
  try {
    for (const rol of ['cliente', 'admin']) {
      const email = (tag + rol + '@example.invalid').toLowerCase();
      emails.push(email);
      const [u] = await pool.execute(
        'INSERT INTO usuarios(email,password_hash,nombre,apellido,direccion,rol) VALUES (?,?,?,?,?,?)',
        [email, await bcrypt.hash(password, 4), 'Nombre', 'Apellido', 'Calle original', rol],
      );
      ids.push(u.insertId);
    }
    assert.equal((await call('/auth/cuenta')).status, 401);
    for (let i = 0; i < 2; i++) {
      let login = await call('/auth/login', 'POST', { email: emails[i], password });
      let token = login.body.token;
      const profile = await call('/auth/cuenta', 'GET', undefined, token);
      assert.equal(profile.body.usuario.direccion, 'Calle original');
      assert.equal(profile.body.usuario.rol, i === 0 ? 'cliente' : 'admin');
      assert.ok(!JSON.stringify(profile.body).includes('password_hash'));
      const data = {
        email: emails[i],
        nombre: 'Nuevo nombre',
        apellido: 'Nuevo apellido',
        direccion: 'Nueva dirección',
      };
      assert.equal(
        (await call('/auth/cuenta', 'PUT', { ...data, rol: 'admin' }, token)).status,
        400,
      );
      assert.equal(
        (
          await call(
            '/auth/cuenta',
            'PUT',
            { ...data, email: emails[1 - i], password_actual: password },
            token,
          )
        ).status,
        409,
      );
      let r = await call('/auth/cuenta', 'PUT', data, token);
      assert.equal(r.status, 200);
      assert.equal(r.body.usuario.nombre, 'Nuevo nombre');
      assert.equal(r.body.usuario.rol, i === 0 ? 'cliente' : 'admin');
      assert.equal(
        (await call('/auth/cuenta', 'PUT', { ...data, password_nueva: 'Debil' }, token)).status,
        400,
      );
      const nextEmail = (tag + i + 'new@example.invalid').toLowerCase();
      assert.equal(
        (await call('/auth/cuenta', 'PUT', { ...data, email: nextEmail }, token)).status,
        400,
      );
      assert.equal(
        (
          await call(
            '/auth/cuenta',
            'PUT',
            { ...data, email: nextEmail, password_actual: 'incorrecta' },
            token,
          )
        ).status,
        400,
      );
      const nextPassword = 'Actualizada2026$&*+';
      r = await call(
        '/auth/cuenta',
        'PUT',
        { ...data, email: nextEmail, password_actual: password, password_nueva: nextPassword },
        token,
      );
      assert.equal(r.status, 200);
      assert.equal((await call('/auth/cuenta', 'GET', undefined, token)).status, 401);
      token = r.body.token;
      assert.equal(
        (await call('/auth/cuenta', 'GET', undefined, token)).body.usuario.email,
        nextEmail,
      );
      assert.equal((await call('/auth/login', 'POST', { email: emails[i], password })).status, 401);
      assert.equal((await call('/auth/login', 'POST', { email: nextEmail, password })).status, 401);
      assert.equal(
        (await call('/auth/login', 'POST', { email: nextEmail, password: nextPassword })).status,
        200,
      );
      const [[stored]] = await pool.execute('SELECT password_hash FROM usuarios WHERE id=?', [
        ids[i],
      ]);
      assert.ok(await bcrypt.compare(nextPassword, stored.password_hash));
      assert.notEqual(stored.password_hash, nextPassword);
      // Conserva emails actuales para la comprobación de duplicados del segundo usuario.
      emails[i] = nextEmail;
    }
  } finally {
    for (const id of ids) await pool.execute('DELETE FROM usuarios WHERE id=?', [id]);
    await new Promise((r) => server.close(r));
    await pool.end();
  }
});
