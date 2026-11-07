-- Datos ficticios para desarrollo. No crea usuarios ni contrasenas de prueba.
SET NAMES utf8mb4;
START TRANSACTION;
INSERT INTO categorias (id, nombre) VALUES (1, 'Remeras'), (2, 'Buzos'), (3, 'Pantalones');
INSERT INTO talles (id, nombre, orden) VALUES (1, 'S', 1), (2, 'M', 2), (3, 'L', 3), (4, 'XL', 4);
INSERT INTO colores (id, nombre, hexadecimal) VALUES
  (1, 'Negro', '#171717'), (2, 'Blanco', '#FFFFFF'), (3, 'Arena', '#C9B99A'), (4, 'Azul', '#263B63');
INSERT INTO ubicaciones (id, nombre, tipo, direccion) VALUES
  (1, 'Depósito central', 'deposito', 'Dirección de ejemplo, Buenos Aires');
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio) VALUES
  (1, 1, 'Remera esencial', 'Remera de algodón de calce clásico para todos los días.', 18000.00),
  (2, 2, 'Buzo urbano', 'Buzo de frisa con cuello redondo y calce relajado.', 42000.00),
  (3, 3, 'Pantalón chino', 'Pantalón de gabardina con bolsillos laterales.', 38000.00);
INSERT INTO variantes_producto (id, producto_id, talle_id, color_id, sku) VALUES
  (1, 1, 1, 1, 'REM-ES-S-NEG'), (2, 1, 2, 1, 'REM-ES-M-NEG'),
  (3, 1, 3, 1, 'REM-ES-L-NEG'), (4, 1, 2, 2, 'REM-ES-M-BLA'),
  (5, 2, 2, 3, 'BUZ-UR-M-ARE'), (6, 2, 3, 3, 'BUZ-UR-L-ARE'),
  (7, 3, 2, 4, 'PAN-CH-M-AZU'), (8, 3, 3, 4, 'PAN-CH-L-AZU');
INSERT INTO existencias (variante_id, ubicacion_id, cantidad) VALUES
  (1, 1, 8), (2, 1, 12), (3, 1, 6), (4, 1, 10),
  (5, 1, 5), (6, 1, 4), (7, 1, 7), (8, 1, 0);
INSERT INTO movimientos_stock (variante_id, ubicacion_id, cantidad, motivo, observacion)
SELECT variante_id, ubicacion_id, cantidad, 'inicial', 'Carga inicial de desarrollo'
FROM existencias WHERE cantidad > 0;
COMMIT;
