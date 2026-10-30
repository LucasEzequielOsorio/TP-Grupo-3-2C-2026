import { pool } from '../src/db.js';
import { readFile } from 'node:fs/promises';

try {
  // Migración incremental compatible con la base creada en el paso anterior.
  const [columns] = await pool.execute("SHOW COLUMNS FROM productos LIKE 'version'");
  if (!columns.length)
    await pool.execute('ALTER TABLE productos ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1');
  const [stockColumns] = await pool.execute(
    "SHOW COLUMNS FROM variantes_producto LIKE 'stock_minimo'",
  );
  if (!stockColumns.length)
    await pool.execute(
      'ALTER TABLE variantes_producto ADD COLUMN stock_minimo INT UNSIGNED NOT NULL DEFAULT 3',
    );
  const sql = await readFile(new URL('../sql/003-admin-mejoras.sql', import.meta.url), 'utf8');
  for (const statement of sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    await pool.query(statement);
  console.log('Esquema actualizado: versiones, mínimos de stock y galería.');
} finally {
  await pool.end();
}
