import { pool } from '../src/db.js';
import { readFile } from 'node:fs/promises';

try {
  const additions = [
    ['existencias', 'reservada', 'INT NOT NULL DEFAULT 0'],
    ['pedidos', 'pago_estado', "VARCHAR(30) NOT NULL DEFAULT 'sin_pago'"],
    ['pedidos', 'reserva_hasta', 'DATETIME NULL'],
    ['pedidos', 'pago_id', 'VARCHAR(100) NULL'],
  ];
  for (const [table, column, type] of additions) {
    const [found] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
    if (!found.length) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
  const [constraints] = await pool.execute(
    "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='existencias' AND CONSTRAINT_NAME='ck_stock_reservado'",
  );
  if (!constraints.length)
    await pool.query(
      'ALTER TABLE existencias ADD CONSTRAINT ck_stock_reservado CHECK (reservada>=0 AND reservada<=cantidad)',
    );
  const [authColumns] = await pool.execute("SHOW COLUMNS FROM usuarios LIKE 'auth_version'");
  if (!authColumns.length)
    await pool.execute(
      'ALTER TABLE usuarios ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 0',
    );
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
  const cartSql = await readFile(new URL('../sql/004-carrito.sql', import.meta.url), 'utf8');
  await pool.query(cartSql);
  const ordersSql = await readFile(new URL('../sql/005-pedidos.sql', import.meta.url), 'utf8');
  for (const statement of ordersSql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    await pool.query(statement);
  const recoverySql = await readFile(
    new URL('../sql/006-recuperacion.sql', import.meta.url),
    'utf8',
  );
  for (const statement of recoverySql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    await pool.query(statement);
  const paymentSql = await readFile(new URL('../sql/007-pagos.sql', import.meta.url), 'utf8');
  for (const statement of paymentSql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    await pool.query(statement);
  const [reviewColumn] = await pool.query("SHOW COLUMNS FROM checkout_pedidos LIKE 'revisado_en'");
  if (!reviewColumn.length)
    await pool.query('ALTER TABLE checkout_pedidos ADD COLUMN revisado_en DATETIME NULL');
  console.log('Esquema actualizado: cuentas, inventario, recuperación, reservas y pagos.');
} finally {
  await pool.end();
}
