import { authenticateToken } from '../services/auth.service.js';
import { httpError } from '../validation.js';

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
