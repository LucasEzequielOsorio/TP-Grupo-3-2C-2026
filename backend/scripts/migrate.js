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
  const [causeColumns] = await pool.execute(
    "SHOW COLUMNS FROM movimientos_stock LIKE 'causa_ajuste'",
  );
  if (!causeColumns.length)
    await pool.execute('ALTER TABLE movimientos_stock ADD COLUMN causa_ajuste VARCHAR(30) NULL');
  const [photoColumns] = await pool.execute("SHOW COLUMNS FROM producto_imagenes LIKE 'color_id'");
  if (!photoColumns.length)
    await pool.execute(
      'ALTER TABLE producto_imagenes ADD COLUMN color_id INT UNSIGNED NULL, ADD CONSTRAINT fk_imagen_color FOREIGN KEY (color_id) REFERENCES colores(id)',
    );
  console.log('Esquema actualizado: versiones, mínimos, galería y motivos de ajustes.');
} finally {
  await pool.end();
}
