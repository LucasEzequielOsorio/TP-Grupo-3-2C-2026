import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { transaction } from '../db.js';
import { config } from '../config.js';
import { httpError } from '../validation.js';
import {
  createUser,
  findActiveUserById,
  findUserByEmail,
  findUserById,
  findUserForAccountUpdate,
  updateUserAccount,
} from '../repositories/authRepository.js';

const publicUser = (u) => ({ id: String(u.id), email: u.email, rol: u.rol });
const accountUser = (u) => ({
  ...publicUser(u),
  nombre: u.nombre,
  apellido: u.apellido,
  direccion: u.direccion,
});

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

const dummyHash = await bcrypt.hash('unused-dummy-password', 12);

export async function loginUser({ email, password }) {
  const user = await findUserByEmail(email);
  const valid = await bcrypt.compare(password, user?.password_hash || dummyHash);

  if (!user || !user.activo || !valid) {
    throw httpError(401, 'Email o contraseña incorrectos');
  }

  return response(user);
}

export async function registerUser({ email, password, nombre, apellido, direccion }) {
  const hash = await bcrypt.hash(password, 12);
  const user = await createUser({ email, hash, nombre, apellido, direccion });

  return response({ id: user.id, email: user.email, rol: user.rol });
}

export async function authenticateToken(authorizationHeader) {
  const header = authorizationHeader || '';

  if (!header.startsWith('Bearer ')) {
    throw httpError(401, 'Iniciá sesión para continuar');
  }

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

  const user = await findActiveUserById(payload.sub);

  if (!user || (payload.ver || 0) !== user.auth_version) {
    throw httpError(401, 'La sesión cambió. Volvé a iniciar sesión');
  }

  return {
    user: { id: user.id, email: user.email, rol: user.rol },
    authVersion: user.auth_version,
  };
}

export async function getAccount(userId) {
  const user = await findUserById(userId);

  if (!user) {
    throw httpError(401, 'Sesión inválida');
  }

  return { usuario: accountUser(user) };
}

export async function updateAccount({ userId, authVersion, data }) {
  return transaction(async (db) => {
    const user = await findUserForAccountUpdate(db, userId);

    if (!user) {
      throw httpError(401, 'Sesión inválida');
    }

    if (user.auth_version !== authVersion) {
      throw httpError(401, 'La sesión cambió. Volvé a iniciar sesión');
    }

    const credentialsChanged = data.email !== user.email || Boolean(data.password_nueva);

    if (
      credentialsChanged &&
      (!data.password_actual || !(await bcrypt.compare(data.password_actual, user.password_hash)))
    ) {
      throw httpError(
        400,
        'Ingresá tu contraseña actual correcta para cambiar el email o la contraseña',
      );
    }

    const hash = data.password_nueva ? await bcrypt.hash(data.password_nueva, 12) : user.password_hash;
    const version = user.auth_version + (credentialsChanged ? 1 : 0);

    await updateUserAccount(db, {
      id: user.id,
      email: data.email,
      nombre: data.nombre,
      apellido: data.apellido,
      direccion: data.direccion,
      password_hash: hash,
      auth_version: version,
    });

    const updated = { ...user, ...data, auth_version: version, password_hash: hash };

    return {
      ...response(updated),
      usuario: accountUser(updated),
      mensaje: 'Tu cuenta se actualizó correctamente',
    };
  });
}
