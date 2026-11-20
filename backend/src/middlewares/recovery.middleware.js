import { rateLimit } from 'express-rate-limit';

export function recoveryNoStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

export const recoveryRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas solicitudes. Esperá 15 minutos antes de reintentar.' },
});

export const recoveryVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas comprobaciones. Esperá 15 minutos antes de reintentar.' },
});

export const recoveryResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos. Esperá 15 minutos antes de reintentar.' },
});
