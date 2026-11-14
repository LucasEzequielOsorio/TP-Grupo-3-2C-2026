import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { loginSchema, passwordSchema, httpError } from './validation.js';
import { sendAccountMail } from './mail.js';

const digest = (token) => createHash('sha256').update(token).digest('hex');
const generic =
  'Si existe una cuenta activa con ese email, recibirás un enlace para restablecer la contraseña.';
const invalid = () =>
  httpError(400, 'El enlace ya fue utilizado, venció o no es válido. Solicitá uno nuevo.');
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const recoveryRouter = Router();
recoveryRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
recoveryRouter.post(
  '/recuperar',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { mensaje: 'Demasiadas solicitudes. Esperá 15 minutos antes de reintentar.' },
  }),
  async (req, res) => {
    const { email } = z.object({ email: loginSchema.shape.email }).strict().parse(req.body);
    await transaction(async (db) => {
      const [[u]] = await db.execute(
        'SELECT id,email,auth_version FROM usuarios WHERE email=? AND activo=1 FOR UPDATE',
        [email],
      );
      if (!u) return;
      const [[counts]] = await db.execute(
        "SELECT COUNT(*) AS total,COALESCE(SUM(creado_en>UTC_TIMESTAMP()-INTERVAL 1 MINUTE),0) AS reciente FROM correos_cuenta WHERE usuario_id=? AND tipo='recuperacion' AND creado_en>UTC_TIMESTAMP()-INTERVAL 1 HOUR",
        [u.id],
      );
      if (counts.total >= 3 || counts.reciente > 0) return;
      await db.execute('INSERT INTO correos_cuenta(usuario_id,email,auth_version) VALUES (?,?,?)', [
        u.id,
        u.email,
        u.auth_version,
      ]);
    });
    res.status(202).json({ mensaje: generic });
  },
);
recoveryRouter.post(
  '/verificar-recuperacion',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { mensaje: 'Demasiadas comprobaciones. Esperá 15 minutos antes de reintentar.' },
  }),
  async (req, res) => {
    const { token } = z.object({ token: tokenSchema }).strict().parse(req.body);
    const [[row]] = await pool.execute(
      `SELECT t.usuario_id FROM recuperacion_tokens t
      JOIN usuarios u ON u.id=t.usuario_id
      WHERE t.token_hash=? AND t.vence_en>UTC_TIMESTAMP() AND u.activo=1
      AND t.email=u.email AND t.auth_version=u.auth_version`,
      [digest(token)],
    );
    if (!row) throw invalid();
    // Comprobar nunca consume el enlace: la invalidación sucede al guardar.
    res.json({ valido: true });
  },
);
recoveryRouter.post(
  '/restablecer',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { mensaje: 'Demasiados intentos. Esperá 15 minutos antes de reintentar.' },
  }),
  async (req, res) => {
    const { token, password } = z
      .object({ token: tokenSchema, password: passwordSchema })
      .strict()
      .parse(req.body);
    const hash = digest(token);
    const [[ref]] = await pool.execute(
      'SELECT usuario_id FROM recuperacion_tokens WHERE token_hash=? AND vence_en>UTC_TIMESTAMP()',
      [hash],
    );
    if (!ref) throw invalid();
    const passwordHash = await bcrypt.hash(password, 12);
    await transaction(async (db) => {
      const [[u]] = await db.execute(
        'SELECT id,email,auth_version,activo FROM usuarios WHERE id=? FOR UPDATE',
        [ref.usuario_id],
      );
      const [[t]] = await db.execute(
        'SELECT * FROM recuperacion_tokens WHERE usuario_id=? AND token_hash=? AND vence_en>UTC_TIMESTAMP() FOR UPDATE',
        [ref.usuario_id, hash],
      );
      if (!u || !u.activo || !t || t.email !== u.email || t.auth_version !== u.auth_version)
        throw invalid();
      await db.execute(
        'UPDATE usuarios SET password_hash=?,auth_version=auth_version+1 WHERE id=?',
        [passwordHash, u.id],
      );
      await db.execute('DELETE FROM recuperacion_tokens WHERE usuario_id=?', [u.id]);
      await db.execute(
        "INSERT INTO correos_cuenta(usuario_id,email,auth_version,tipo) VALUES (?,?,?,'aviso')",
        [u.id, u.email, u.auth_version + 1],
      );
    });
    res.json({ mensaje: 'Tu contraseña se actualizó. Volvé a iniciar sesión.' });
  },
);

// La cola evita esperar al SMTP en la respuesta HTTP y sobrevive reinicios.
// El transporte se inyecta únicamente desde pruebas, nunca desde la solicitud.
export async function processAccountMail(send = sendAccountMail, onlyUserId = null) {
  const job = await transaction(async (db) => {
    const [[row]] = await db.execute(
      "SELECT *, (creado_en>UTC_TIMESTAMP()-INTERVAL 15 MINUTE) AS vigente FROM correos_cuenta WHERE intentos<3 AND ((estado='pendiente' AND disponible_en<=UTC_TIMESTAMP()) OR (estado='procesando' AND actualizado_en<UTC_TIMESTAMP()-INTERVAL 5 MINUTE))" +
        (onlyUserId ? ' AND usuario_id=?' : '') +
        ' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED',
      onlyUserId ? [onlyUserId] : [],
    );
    if (!row) return null;
    await db.execute(
      "UPDATE correos_cuenta SET estado='procesando',intentos=intentos+1,actualizado_en=UTC_TIMESTAMP() WHERE id=?",
      [row.id],
    );
    return { ...row, intentos: row.intentos + 1 };
  });
  if (!job) return false;
  let hash;
  try {
    const token = job.tipo === 'recuperacion' ? randomBytes(32).toString('hex') : undefined;
    if (token) hash = digest(token);
    const valid = await transaction(async (db) => {
      const [[u]] = await db.execute(
        'SELECT id,email,auth_version,activo FROM usuarios WHERE id=? FOR UPDATE',
        [job.usuario_id],
      );
      if (
        !u ||
        !u.activo ||
        (job.tipo === 'recuperacion' &&
          (!job.vigente || u.email !== job.email || u.auth_version !== job.auth_version))
      )
        return false;
      if (token)
        await db.execute(
          'INSERT INTO recuperacion_tokens(usuario_id,token_hash,email,auth_version,vence_en) VALUES (?,?,?,?,UTC_TIMESTAMP()+INTERVAL 15 MINUTE) ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),email=VALUES(email),auth_version=VALUES(auth_version),vence_en=VALUES(vence_en)',
          [u.id, hash, u.email, u.auth_version],
        );
      return true;
    });
    if (!valid) {
      await pool.execute("UPDATE correos_cuenta SET estado='descartado' WHERE id=?", [job.id]);
      return true;
    }
    await send(job.email, job.tipo, token);
    await pool.execute(
      "UPDATE correos_cuenta SET estado='enviado',actualizado_en=UTC_TIMESTAMP() WHERE id=?",
      [job.id],
    );
  } catch {
    // No registrar direcciones, contraseñas, tokens ni errores completos del SMTP.
    console.warn('No se pudo enviar un correo de cuenta; revisar SMTP y la cola.');
    if (hash)
      await pool.execute('DELETE FROM recuperacion_tokens WHERE usuario_id=? AND token_hash=?', [
        job.usuario_id,
        hash,
      ]);
    await pool.execute(
      'UPDATE correos_cuenta SET estado=?,disponible_en=UTC_TIMESTAMP()+INTERVAL 1 MINUTE,actualizado_en=UTC_TIMESTAMP() WHERE id=?',
      [job.intentos >= 3 ? 'fallido' : 'pendiente', job.id],
    );
  }
  return true;
}
export function startAccountMailWorker() {
  let running = null,
    stopped = false;
  let lastCleanup = 0;
  const tick = () => {
    if (running || stopped) return;
    running = (async () => {
      if (Date.now() - lastCleanup > 60 * 60 * 1000) {
        await pool.execute('DELETE FROM recuperacion_tokens WHERE vence_en<UTC_TIMESTAMP()');
        await pool.execute(
          "UPDATE correos_cuenta SET estado='fallido' WHERE estado='procesando' AND intentos>=3 AND actualizado_en<UTC_TIMESTAMP()-INTERVAL 5 MINUTE",
        );
        await pool.execute(
          'DELETE FROM correos_cuenta WHERE creado_en<UTC_TIMESTAMP()-INTERVAL 7 DAY LIMIT 1000',
        );
        lastCleanup = Date.now();
      }
      for (let i = 0; i < 10 && !stopped; i++) if (!(await processAccountMail())) break;
    })()
      .catch(() => console.warn('No se pudo procesar la cola de correos de cuenta.'))
      .finally(() => {
        running = null;
      });
  };
  const timer = setInterval(tick, 3000);
  timer.unref();
  tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    if (running) await running;
  };
}
