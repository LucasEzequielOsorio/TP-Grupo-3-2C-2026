import { pool } from '../db.js';

export async function findActiveRecoveryUserByEmail(db, email) {
  const [rows] = await db.execute(
    'SELECT id,email,auth_version FROM usuarios WHERE email=? AND activo=1 FOR UPDATE',
    [email],
  );
  return rows[0] ?? null;
}

export async function findRecoveryMailCounts(db, userId) {
  const [rows] = await db.execute(
    "SELECT COUNT(*) AS total,COALESCE(SUM(creado_en>UTC_TIMESTAMP()-INTERVAL 1 MINUTE),0) AS reciente FROM correos_cuenta WHERE usuario_id=? AND tipo='recuperacion' AND creado_en>UTC_TIMESTAMP()-INTERVAL 1 HOUR",
    [userId],
  );
  return rows[0];
}

export async function enqueueAccountMail(db, user) {
  await db.execute('INSERT INTO correos_cuenta(usuario_id,email,auth_version) VALUES (?,?,?)', [
    user.id,
    user.email,
    user.auth_version,
  ]);
}

export async function findValidRecoveryToken(db, tokenHash) {
  const [rows] = await db.execute(
    `SELECT t.usuario_id FROM recuperacion_tokens t
    JOIN usuarios u ON u.id=t.usuario_id
    WHERE t.token_hash=? AND t.vence_en>UTC_TIMESTAMP() AND u.activo=1
    AND t.email=u.email AND t.auth_version=u.auth_version`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function findRecoveryTokenOwner(db, tokenHash) {
  const [rows] = await db.execute(
    'SELECT usuario_id FROM recuperacion_tokens WHERE token_hash=? AND vence_en>UTC_TIMESTAMP()',
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function findAccountMailUserForUpdate(db, userId) {
  const [rows] = await db.execute(
    'SELECT id,email,auth_version,activo FROM usuarios WHERE id=? FOR UPDATE',
    [userId],
  );
  return rows[0] ?? null;
}

export async function findRecoveryTokenForUpdate(db, userId, tokenHash) {
  const [rows] = await db.execute(
    'SELECT * FROM recuperacion_tokens WHERE usuario_id=? AND token_hash=? AND vence_en>UTC_TIMESTAMP() FOR UPDATE',
    [userId, tokenHash],
  );
  return rows[0] ?? null;
}

export async function updateAccountPassword(db, userId, passwordHash) {
  await db.execute(
    'UPDATE usuarios SET password_hash=?,auth_version=auth_version+1 WHERE id=?',
    [passwordHash, userId],
  );
  await db.execute('DELETE FROM recuperacion_tokens WHERE usuario_id=?', [userId]);
}

export async function enqueuePasswordChangedNotice(db, user) {
  await db.execute(
    "INSERT INTO correos_cuenta(usuario_id,email,auth_version,tipo) VALUES (?,?,?,'aviso')",
    [user.id, user.email, user.auth_version + 1],
  );
}

export async function claimAccountMailJob(db, onlyUserId) {
  const [rows] = await db.execute(
    "SELECT *, (creado_en>UTC_TIMESTAMP()-INTERVAL 15 MINUTE) AS vigente FROM correos_cuenta WHERE intentos<3 AND ((estado='pendiente' AND disponible_en<=UTC_TIMESTAMP()) OR (estado='procesando' AND actualizado_en<UTC_TIMESTAMP()-INTERVAL 5 MINUTE))" +
      (onlyUserId ? ' AND usuario_id=?' : '') +
      ' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED',
    onlyUserId ? [onlyUserId] : [],
  );
  const row = rows[0];
  if (!row) return null;
  await db.execute(
    "UPDATE correos_cuenta SET estado='procesando',intentos=intentos+1,actualizado_en=UTC_TIMESTAMP() WHERE id=?",
    [row.id],
  );
  return { ...row, intentos: row.intentos + 1 };
}

export async function saveRecoveryToken(db, user, tokenHash) {
  await db.execute(
    'INSERT INTO recuperacion_tokens(usuario_id,token_hash,email,auth_version,vence_en) VALUES (?,?,?,?,UTC_TIMESTAMP()+INTERVAL 15 MINUTE) ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),email=VALUES(email),auth_version=VALUES(auth_version),vence_en=VALUES(vence_en)',
    [user.id, tokenHash, user.email, user.auth_version],
  );
}

export async function markAccountMailDiscarded(db, jobId) {
  await db.execute("UPDATE correos_cuenta SET estado='descartado' WHERE id=?", [jobId]);
}

export async function markAccountMailSent(db, jobId) {
  await db.execute(
    "UPDATE correos_cuenta SET estado='enviado',actualizado_en=UTC_TIMESTAMP() WHERE id=?",
    [jobId],
  );
}

export async function deleteRecoveryToken(db, userId, tokenHash) {
  await db.execute('DELETE FROM recuperacion_tokens WHERE usuario_id=? AND token_hash=?', [
    userId,
    tokenHash,
  ]);
}

export async function markAccountMailFailedOrPending(db, jobId, attempts) {
  await db.execute(
    "UPDATE correos_cuenta SET estado=?,disponible_en=UTC_TIMESTAMP()+INTERVAL 1 MINUTE,actualizado_en=UTC_TIMESTAMP() WHERE id=?",
    [attempts >= 3 ? 'fallido' : 'pendiente', jobId],
  );
}

export async function deleteExpiredRecoveryTokens(db) {
  await db.execute('DELETE FROM recuperacion_tokens WHERE vence_en<UTC_TIMESTAMP()');
}

export async function removeExhaustedAccountMailJobs(db) {
  await db.execute(
    "UPDATE correos_cuenta SET estado='fallido' WHERE estado='procesando' AND intentos>=3 AND actualizado_en<UTC_TIMESTAMP()-INTERVAL 5 MINUTE",
  );
}

export async function deleteOldAccountMailJobs(db) {
  await db.execute(
    'DELETE FROM correos_cuenta WHERE creado_en<UTC_TIMESTAMP()-INTERVAL 7 DAY LIMIT 1000',
  );
}
