import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { httpError, loginSchema, registerSchema } from '../validation.js';
import {
  authenticateToken,
  getAccount,
  loginUser,
  registerUser,
  updateAccount,
} from '../services/authService.js';

export const authRouter = Router();

authRouter.use(
  ['/login', '/registro'],
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { mensaje: 'Demasiados intentos. Intentá de nuevo más tarde.' },
  }),
);

const accountSchema = z
  .object({
    email: loginSchema.shape.email,
    nombre: registerSchema.shape.nombre,
    apellido: registerSchema.shape.apellido,
    direccion: registerSchema.shape.direccion,
    password_actual: z.string().min(1).max(200).optional(),
    password_nueva: z.string().min(8).max(72).optional(),
  })
  .strict();

authRouter.post('/login', async (req, res) => {
  const data = loginSchema.parse(req.body);
  const result = await loginUser(data);
  res.json(result);
});

authRouter.post('/registro', async (req, res) => {
  const data = registerSchema.parse(req.body);
  const result = await registerUser(data);
  res.status(201).json(result);
});

export async function authenticate(req, res, next) {
  const result = await authenticateToken(req.headers.authorization || '');
  req.user = result.user;
  req.authVersion = result.authVersion;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user.rol !== 'admin') {
    throw httpError(403, 'Se requiere acceso administrador');
  }

  next();
}

authRouter.get('/cuenta', authenticate, async (req, res) => {
  const result = await getAccount(req.user.id);
  res.json(result);
});

authRouter.put(
  '/cuenta',
  authenticate,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { mensaje: 'Demasiados intentos de actualización. Intentá más tarde.' },
  }),
  async (req, res) => {
    const data = accountSchema.parse(req.body);
    const result = await updateAccount({ userId: req.user.id, authVersion: req.authVersion, data });
    res.json(result);
  },
);

authRouter.get('/me', authenticate, (req, res) => {
  res.json({ usuario: req.user });
});
