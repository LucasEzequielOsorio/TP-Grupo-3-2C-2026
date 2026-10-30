import { pool } from '../src/db.js';

try {
  // Migración incremental compatible con la base creada en el paso anterior.
  const [columns] = await pool.execute("SHOW COLUMNS FROM productos LIKE 'version'");
  if (!columns.length)
    await pool.execute('ALTER TABLE productos ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1');
  console.log('Esquema actualizado: control de versión de productos disponible.');
} finally {
  await pool.end();
}
