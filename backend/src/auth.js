import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { pool, transaction } from './db.js';
import { z } from 'zod';
import { config } from './config.js';
import { loginSchema, registerSchema, passwordSchema, httpError } from './validation.js';

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
const publicUser = (u) => ({ id: String(u.id), email: u.email, rol: u.rol });
const response = (u) => ({
  usuario: publicUser(u),
  token: jwt.sign({ ver: u.auth_version || 0 }, config.jwtSecret, {
    subject: String(u.id),
    expiresIn: '8h',
    issuer: 'tienda-ropa',
    audience: 'tienda-angular',
    algorithm: 'HS256',
  }),
});
// Mantiene un costo de verificación similar para correos inexistentes.
const dummyHash = await bcrypt.hash('unused-dummy-password', 12);
authRouter.post('/login', async (req, res) => {
  const data = loginSchema.parse(req.body);
  const [rows] = await pool.execute('SELECT * FROM usuarios WHERE email = ? LIMIT 1', [data.email]);
  const user = rows[0];
  const valid = await bcrypt.compare(data.password, user?.password_hash || dummyHash);
  if (!user || !user.activo || !valid) throw httpError(401, 'Email o contraseña incorrectos');
  res.json(response(user));
});
authRouter.post('/registro', async (req, res) => {
  const data = registerSchema.parse(req.body);
  const hash = await bcrypt.hash(data.password, 12);
  const [result] = await pool.execute(
    "INSERT INTO usuarios (email, password_hash, nombre, apellido, direccion, rol) VALUES (?, ?, ?, ?, ?, 'cliente')",
    [data.email, hash, data.nombre, data.apellido, data.direccion],
  );
  res.status(201).json(response({ id: result.insertId, email: data.email, rol: 'cliente' }));
});
export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw httpError(401, 'Iniciá sesión para continuar');
  let payload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'tienda-ropa',
      audience: 'tienda-angular',
    });
  } catch {
    throw httpError(401, 'La sesión venció. Volvé a iniciar sesión');
  }
  const [rows] = await pool.execute(
    'SELECT id, email, rol, auth_version FROM usuarios WHERE id = ? AND activo = 1',
    [payload.sub],
  );
  if (!rows.length || (payload.ver || 0) !== rows[0].auth_version)
    throw httpError(401, 'La sesión cambió. Volvé a iniciar sesión');
  req.user = { id: rows[0].id, email: rows[0].email, rol: rows[0].rol };
  req.authVersion = rows[0].auth_version;
  next();
}
export function requireAdmin(req, res, next) {
  if (req.user.rol !== 'admin') throw httpError(403, 'Se requiere acceso administrador');
  next();
}

const accountSchema = z
  .object({
    email: loginSchema.shape.email,
    nombre: registerSchema.shape.nombre,
    apellido: registerSchema.shape.apellido,
    direccion: registerSchema.shape.direccion,
    password_actual: z.string().min(1).max(200).optional(),
    password_nueva: passwordSchema.optional(),
  })
  .strict();
const accountUser = (u) => ({
  ...publicUser(u),
  nombre: u.nombre,
  apellido: u.apellido,
  direccion: u.direccion,
});
authRouter.get('/cuenta', authenticate, async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id,email,nombre,apellido,direccion,rol FROM usuarios WHERE id=?',
    [req.user.id],
  );
  res.json({ usuario: accountUser(rows[0]) });
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
    const result = await transaction(async (db) => {
      const [rows] = await db.execute('SELECT * FROM usuarios WHERE id=? AND activo=1 FOR UPDATE', [
        req.user.id,
      ]);
      if (!rows.length) throw httpError(401, 'Sesión inválida');
      const u = rows[0];
      if (u.auth_version !== req.authVersion)
        throw httpError(401, 'La sesión cambió. Volvé a iniciar sesión');
      const credentialsChanged = data.email !== u.email || Boolean(data.password_nueva);
      if (
        credentialsChanged &&
        (!data.password_actual || !(await bcrypt.compare(data.password_actual, u.password_hash)))
      )
        throw httpError(
          400,
          'Ingresá tu contraseña actual correcta para cambiar el email o la contraseña',
        );
      const hash = data.password_nueva
        ? await bcrypt.hash(data.password_nueva, 12)
        : u.password_hash;
      const version = u.auth_version + (credentialsChanged ? 1 : 0);
      await db.execute(
        'UPDATE usuarios SET email=?,nombre=?,apellido=?,direccion=?,password_hash=?,auth_version=? WHERE id=?',
        [data.email, data.nombre, data.apellido, data.direccion, hash, version, u.id],
      );
      const updated = { ...u, ...data, auth_version: version };
      return {
        ...response(updated),
        usuario: accountUser(updated),
        mensaje: 'Tu cuenta se actualizó correctamente',
      };
    });
    res.json(result);
  },
);
