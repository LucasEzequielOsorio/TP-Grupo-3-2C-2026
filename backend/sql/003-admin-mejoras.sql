CREATE TABLE IF NOT EXISTS producto_imagenes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id INT UNSIGNED NOT NULL,
  url VARCHAR(2048) NOT NULL,
  color_id INT UNSIGNED NULL,
  orden TINYINT UNSIGNED NOT NULL,
  UNIQUE (producto_id, orden),
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (color_id) REFERENCES colores(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Conserva la imagen anterior como primera foto al migrar una base existente.
INSERT INTO producto_imagenes (producto_id, url, orden)
SELECT p.id, p.imagen_url, 0 FROM productos p
WHERE p.imagen_url IS NOT NULL AND p.imagen_url <> ''
AND NOT EXISTS (SELECT 1 FROM producto_imagenes i WHERE i.producto_id = p.id);
