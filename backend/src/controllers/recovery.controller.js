import { Router } from 'express';
import { z } from 'zod';
import { loginSchema, passwordSchema } from '../validation.js';
import {
  recoveryNoStore,
  recoveryRequestLimiter,
  recoveryResetLimiter,
  recoveryVerificationLimiter,
} from '../middlewares/recovery.middleware.js';
import {
  requestAccountRecovery,
  resetAccountPassword,
  verifyRecoveryToken,
} from '../services/recovery.service.js';

const generic =
  'Si existe una cuenta activa con ese email, recibirás un enlace para restablecer la contraseña.';
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const recoveryRouter = Router();
recoveryRouter.use(recoveryNoStore);

recoveryRouter.post('/recuperar', recoveryRequestLimiter, async (req, res) => {
  const { email } = z.object({ email: loginSchema.shape.email }).strict().parse(req.body);
  await requestAccountRecovery(email);
  res.status(202).json({ mensaje: generic });
});

recoveryRouter.post('/verificar-recuperacion', recoveryVerificationLimiter, async (req, res) => {
  const { token } = z.object({ token: tokenSchema }).strict().parse(req.body);
  await verifyRecoveryToken(token);
  res.json({ valido: true });
});

recoveryRouter.post('/restablecer', recoveryResetLimiter, async (req, res) => {
  const { token, password } = z
    .object({ token: tokenSchema, password: passwordSchema })
    .strict()
    .parse(req.body);
  await resetAccountPassword(token, password);
  res.json({ mensaje: 'Tu contraseña se actualizó. Volvé a iniciar sesión.' });
});
