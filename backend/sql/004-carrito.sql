CREATE TABLE IF NOT EXISTS carrito_items (
  usuario_id INT UNSIGNED NOT NULL,
  variante_id INT UNSIGNED NOT NULL,
  cantidad INT UNSIGNED NOT NULL,
  PRIMARY KEY (usuario_id, variante_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (variante_id) REFERENCES variantes_producto(id),
  CHECK (cantidad BETWEEN 1 AND 999)
);
