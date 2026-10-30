import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { registerSchema } from '../src/validation.js';

try {
  const data = registerSchema.parse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    nombre: 'Administrador',
    apellido: 'Local',
    direccion: 'Administración local',
  });
  const [existing] = await pool.execute('SELECT id FROM usuarios WHERE email = ?', [data.email]);
  if (existing.length) throw new Error('Ese email ya existe. No se modifica su rol ni contraseña.');
  await pool.execute(
    "INSERT INTO usuarios (email, password_hash, nombre, apellido, direccion, rol) VALUES (?, ?, ?, ?, ?, 'admin')",
    [data.email, await bcrypt.hash(data.password, 12), data.nombre, data.apellido, data.direccion],
  );
  console.log('Administrador local creado. Credenciales en .env (no se versiona).');
} finally {
  await pool.end();
}
