import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { pool } from './db.js';
import { config } from './config.js';
import { loginSchema, registerSchema, httpError } from './validation.js';

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
  token: jwt.sign({}, config.jwtSecret, {
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
    'SELECT id, email, rol FROM usuarios WHERE id = ? AND activo = 1',
    [payload.sub],
  );
  if (!rows.length) throw httpError(401, 'Sesión inválida');
  req.user = rows[0];
  next();
}
export function requireAdmin(req, res, next) {
  if (req.user.rol !== 'admin') throw httpError(403, 'Se requiere acceso administrador');
  next();
}
