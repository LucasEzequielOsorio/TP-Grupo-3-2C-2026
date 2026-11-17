import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool, transaction } from '../db.js';
import { httpError } from '../validation.js';
import { sendAccountMail } from '../mail.js';
import {
  claimAccountMailJob,
  deleteExpiredRecoveryTokens,
  deleteOldAccountMailJobs,
  deleteRecoveryToken,
  enqueueAccountMail,
  enqueuePasswordChangedNotice,
  findAccountMailUserForUpdate,
  findActiveRecoveryUserByEmail,
  findRecoveryMailCounts,
  findRecoveryTokenForUpdate,
  findRecoveryTokenOwner,
  findValidRecoveryToken,
  markAccountMailDiscarded,
  markAccountMailFailedOrPending,
  markAccountMailSent,
  removeExhaustedAccountMailJobs,
  saveRecoveryToken,
  updateAccountPassword,
} from '../repositories/recovery.repository.js';

const digest = (token) => createHash('sha256').update(token).digest('hex');
const invalid = () =>
  httpError(400, 'El enlace ya fue utilizado, venció o no es válido. Solicitá uno nuevo.');

export async function requestAccountRecovery(email) {
  await transaction(async (db) => {
    const user = await findActiveRecoveryUserByEmail(db, email);
    if (!user) return;
    const counts = await findRecoveryMailCounts(db, user.id);
    if (counts.total >= 3 || counts.reciente > 0) return;
    await enqueueAccountMail(db, user);
  });
}

export async function verifyRecoveryToken(token) {
  const row = await findValidRecoveryToken(pool, digest(token));
  if (!row) throw invalid();
}

export async function resetAccountPassword(token, password) {
  const hash = digest(token);
  const ref = await findRecoveryTokenOwner(pool, hash);
  if (!ref) throw invalid();
  const passwordHash = await bcrypt.hash(password, 12);

  await transaction(async (db) => {
    const user = await findAccountMailUserForUpdate(db, ref.usuario_id);
    const recoveryToken = await findRecoveryTokenForUpdate(db, ref.usuario_id, hash);
    if (
      !user ||
      !user.activo ||
      !recoveryToken ||
      recoveryToken.email !== user.email ||
      recoveryToken.auth_version !== user.auth_version
    )
      throw invalid();
    await updateAccountPassword(db, user.id, passwordHash);
    await enqueuePasswordChangedNotice(db, user);
  });
}

// The mail queue avoids waiting for SMTP in the HTTP response and survives restarts.
export async function processAccountMail(send = sendAccountMail, onlyUserId = null) {
  const job = await transaction(async (db) => claimAccountMailJob(db, onlyUserId));
  if (!job) return false;
  let hash;
  try {
    const token = job.tipo === 'recuperacion' ? randomBytes(32).toString('hex') : undefined;
    if (token) hash = digest(token);
    const valid = await transaction(async (db) => {
      const user = await findAccountMailUserForUpdate(db, job.usuario_id);
      if (
        !user ||
        !user.activo ||
        (job.tipo === 'recuperacion' &&
          (!job.vigente || user.email !== job.email || user.auth_version !== job.auth_version))
      )
        return false;
      if (token) await saveRecoveryToken(db, user, hash);
      return true;
    });
    if (!valid) {
      await markAccountMailDiscarded(pool, job.id);
      return true;
    }
    await send(job.email, job.tipo, token);
    await markAccountMailSent(pool, job.id);
  } catch (error) {
    // Do not log addresses, passwords, tokens, or complete SMTP errors.
    const code = /^[A-Z_]{2,30}$/.test(error?.code || '') ? error.code : 'DESCONOCIDO';
    const response = Number.isInteger(error?.responseCode) ? error.responseCode : 'sin respuesta';
    console.warn(`No se pudo enviar un correo de cuenta (código ${code}, SMTP ${response}); revisar SMTP y la cola.`);
    if (hash) await deleteRecoveryToken(pool, job.usuario_id, hash);
    await markAccountMailFailedOrPending(pool, job.id, job.intentos);
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
        await deleteExpiredRecoveryTokens(pool);
        await removeExhaustedAccountMailJobs(pool);
        await deleteOldAccountMailJobs(pool);
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
