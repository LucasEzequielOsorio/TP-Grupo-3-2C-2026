import { pool } from '../db.js';

export async function findUserByEmail(email) {
  const [rows] = await pool.execute('SELECT * FROM usuarios WHERE email = ? LIMIT 1', [email]);
  return rows[0] ?? null;
}

export async function createUser({ email, hash, nombre, apellido, direccion }) {
  const [result] = await pool.execute(
    "INSERT INTO usuarios (email, password_hash, nombre, apellido, direccion, rol) VALUES (?, ?, ?, ?, ?, 'cliente')",
    [email, hash, nombre, apellido, direccion],
  );

  return { id: result.insertId, email, rol: 'cliente' };
}

export async function findUserById(id) {
  const [rows] = await pool.execute(
    'SELECT id,email,nombre,apellido,direccion,rol,auth_version,password_hash,activo FROM usuarios WHERE id = ? LIMIT 1',
    [id],
  );

  return rows[0] ?? null;
}

export async function findActiveUserById(id) {
  const [rows] = await pool.execute(
    'SELECT id, email, rol, auth_version, nombre, apellido, direccion, password_hash, activo FROM usuarios WHERE id = ? AND activo = 1 LIMIT 1',
    [id],
  );

  return rows[0] ?? null;
}

export async function findUserForAccountUpdate(db, id) {
  const [rows] = await db.execute('SELECT * FROM usuarios WHERE id=? AND activo=1 FOR UPDATE', [id]);
  return rows[0] ?? null;
}

export async function updateUserAccount(db, { id, email, nombre, apellido, direccion, password_hash, auth_version }) {
  await db.execute(
    'UPDATE usuarios SET email=?,nombre=?,apellido=?,direccion=?,password_hash=?,auth_version=? WHERE id=?',
    [email, nombre, apellido, direccion, password_hash, auth_version, id],
  );
}
