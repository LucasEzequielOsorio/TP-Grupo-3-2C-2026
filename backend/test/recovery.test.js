import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';
import { processAccountMail } from '../src/recovery.js';

test('Recuperación: respuesta neutra, hash, vencimiento, uso único, sesiones y reintentos SMTP', async () => {
  const email = 'reset-' + randomUUID() + '@example.invalid';
  let user;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/auth';
  async function call(path, body, token) {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      body: await response.json(),
      cache: response.headers.get('cache-control'),
    };
  }
  const oldPassword = 'Anterior2026$&*+',
    newPassword = 'Nueva2026$&*+';
  const messages = [];
  const send = async (to, tipo, token) => {
    messages.push({ to, tipo, token });
  };
  const enqueue = async () =>
    pool.execute(
      'INSERT INTO correos_cuenta(usuario_id,email,auth_version) SELECT id,email,auth_version FROM usuarios WHERE id=?',
      [user],
    );
  try {
    const [u] = await pool.execute(
      "INSERT INTO usuarios(email,password_hash,nombre,apellido,direccion) VALUES (?,?,'Prueba','Temporal','Temporal')",
      [email, await bcrypt.hash(oldPassword, 4)],
    );
    user = u.insertId;
    const login = await call('/login', { email, password: oldPassword });
    const session = login.body.token;
    const known = await call('/recuperar', { email });
    const unknown = await call('/recuperar', { email: 'missing-' + email });
    assert.equal(known.status, 202);
    assert.deepEqual(known.body, unknown.body);
    assert.equal(known.cache, 'no-store');
    assert.ok(!JSON.stringify(known.body).includes('token'));
    assert.equal((await call('/recuperar', { email })).status, 202);
    const [[count]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM correos_cuenta WHERE usuario_id=?',
      [user],
    );
    assert.equal(count.total, 1, 'Enfriamiento por cuenta');
    await processAccountMail(send, user);
    const first = messages[0].token;
    assert.equal((await call('/verificar-recuperacion', { token: first })).status, 200);
    assert.equal(
      (await call('/verificar-recuperacion', { token: first })).status,
      200,
      'Abrir no consume el enlace',
    );
    assert.match(first, /^[a-f0-9]{64}$/);
    const [[stored]] = await pool.execute('SELECT * FROM recuperacion_tokens WHERE usuario_id=?', [
      user,
    ]);
    assert.equal(stored.token_hash, createHash('sha256').update(first).digest('hex'));
    assert.notEqual(stored.token_hash, first);
    await pool.execute('UPDATE usuarios SET activo=0 WHERE id=?', [user]);
    assert.deepEqual((await call('/recuperar', { email })).body, known.body);
    await pool.execute('UPDATE usuarios SET activo=1 WHERE id=?', [user]);
    assert.equal((await call('/recuperar', { email: 'another-' + email })).status, 202);
    assert.equal((await call('/recuperar', { email })).status, 429);
    assert.equal(
      (await call('/restablecer', { token: '0'.repeat(64), password: newPassword })).status,
      400,
    );
    assert.equal((await call('/restablecer', { token: first, password: 'debil' })).status, 400);
    await pool.execute(
      'UPDATE recuperacion_tokens SET vence_en=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE usuario_id=?',
      [user],
    );
    assert.equal((await call('/restablecer', { token: first, password: newPassword })).status, 400);
    assert.equal(
      (await call('/verificar-recuperacion', { token: first })).status,
      400,
      'Rechaza al abrir un enlace vencido',
    );
    await enqueue();
    await processAccountMail(send, user);
    const second = messages.at(-1).token;
    assert.notEqual(second, first);
    assert.equal((await call('/restablecer', { token: first, password: newPassword })).status, 400);
    const race = await Promise.all([
      call('/restablecer', { token: second, password: newPassword }),
      call('/restablecer', { token: second, password: newPassword }),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [200, 400]);
    assert.ok(!race.find((r) => r.status === 200).body.token, 'No inicia sesión automáticamente');
    assert.equal(
      (await call('/verificar-recuperacion', { token: second })).status,
      400,
      'Rechaza al reabrir un enlace usado',
    );
    assert.equal(
      (await call('/restablecer', { token: second, password: 'OtraDistinta2026!' })).status,
      400,
    );
    assert.equal((await call('/me', undefined, session)).status, 401);
    assert.equal((await call('/login', { email, password: oldPassword })).status, 401);
    assert.equal((await call('/login', { email, password: newPassword })).status, 200);
    assert.equal(
      (await call('/login', { email, password: 'OtraDistinta2026!' })).status,
      401,
      'El segundo uso no cambia la contraseña',
    );
    await processAccountMail(send, user);
    assert.equal(messages.at(-1).tipo, 'aviso');
    assert.equal(messages.at(-1).token, undefined);
    await enqueue();
    await processAccountMail(send, user);
    const stale = messages.at(-1).token;
    await pool.execute('UPDATE usuarios SET auth_version=auth_version+1 WHERE id=?', [user]);
    assert.equal((await call('/verificar-recuperacion', { token: stale })).status, 400);
    assert.equal((await call('/restablecer', { token: stale, password: newPassword })).status, 400);
    await enqueue();
    const failing = async () => {
      throw new Error('Error SMTP de prueba sin registrar secretos');
    };
    for (let i = 0; i < 3; i++) {
      await pool.execute(
        "UPDATE correos_cuenta SET disponible_en=UTC_TIMESTAMP() WHERE usuario_id=? AND estado='pendiente'",
        [user],
      );
      await processAccountMail(failing, user);
    }
    const [[failed]] = await pool.execute(
      'SELECT estado,intentos FROM correos_cuenta WHERE usuario_id=? ORDER BY id DESC LIMIT 1',
      [user],
    );
    assert.equal(failed.estado, 'fallido');
    assert.equal(failed.intentos, 3);
    const [[noToken]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM recuperacion_tokens WHERE usuario_id=?',
      [user],
    );
    assert.equal(noToken.total, 0);
  } finally {
    if (user) await pool.execute('DELETE FROM usuarios WHERE id=?', [user]);
    await new Promise((r) => server.close(r));
    await pool.end();
  }
});
