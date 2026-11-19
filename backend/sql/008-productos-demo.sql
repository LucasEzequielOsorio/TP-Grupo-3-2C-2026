-- Productos de demo: 12 prendas y accesorios nuevos, y fotos para los 3 productos del seed original.
-- Es idempotente: no repite productos ni variantes, no pisa fotos ya cargadas y no usa ids fijos,
-- asi que se puede ejecutar sobre una base que ya tiene productos creados desde el panel de administracion.
-- Las imagenes estan en backend/demo-images y se sirven en /api/imagenes/<archivo>.webp.
SET NAMES utf8mb4;

INSERT IGNORE INTO categorias (nombre) VALUES ('Camperas'), ('Accesorios');
INSERT IGNORE INTO talles (nombre, orden) VALUES ('Único', 5);
INSERT IGNORE INTO colores (nombre, hexadecimal) VALUES
  ('Gris', '#8A8D91'),
  ('Verde', '#3F5B45'),
  ('Bordó', '#6E1F2E'),
  ('Celeste', '#8DB6D9'),
  ('Mostaza', '#C99A2E');

INSERT INTO productos (categoria_id, nombre, descripcion, precio)
SELECT c.id, v.nombre, v.descripcion, v.precio FROM (
  SELECT 'Remera oversize' AS nombre, 'Remeras' AS categoria, 'Remera de algodón peinado con calce amplio y caída suelta.' AS descripcion, 22000.00 AS precio
  UNION ALL   SELECT 'Remera manga larga' AS nombre, 'Remeras' AS categoria, 'Remera de manga larga en jersey liviano, ideal para entretiempo.' AS descripcion, 24000.00 AS precio
  UNION ALL   SELECT 'Buzo canguro' AS nombre, 'Buzos' AS categoria, 'Buzo de frisa con capucha, cordones y bolsillo canguro.' AS descripcion, 48000.00 AS precio
  UNION ALL   SELECT 'Buzo con cierre' AS nombre, 'Buzos' AS categoria, 'Campera de frisa con capucha y cierre completo al frente.' AS descripcion, 52000.00 AS precio
  UNION ALL   SELECT 'Jean recto' AS nombre, 'Pantalones' AS categoria, 'Jean de denim rígido con calce recto y cinco bolsillos.' AS descripcion, 46000.00 AS precio
  UNION ALL   SELECT 'Jogger de algodón' AS nombre, 'Pantalones' AS categoria, 'Jogger de algodón con cintura elástica, cordón y puños ajustados.' AS descripcion, 39000.00 AS precio
  UNION ALL   SELECT 'Short deportivo' AS nombre, 'Pantalones' AS categoria, 'Short liviano con cintura elástica y bolsillos laterales.' AS descripcion, 21000.00 AS precio
  UNION ALL   SELECT 'Campera rompevientos' AS nombre, 'Camperas' AS categoria, 'Campera liviana repelente al viento, con cierre y bolsillos.' AS descripcion, 65000.00 AS precio
  UNION ALL   SELECT 'Campera de jean' AS nombre, 'Camperas' AS categoria, 'Campera clásica de denim con botones y bolsillos en el pecho.' AS descripcion, 72000.00 AS precio
  UNION ALL   SELECT 'Gorra clásica' AS nombre, 'Accesorios' AS categoria, 'Gorra de gabardina con visera curva y ajuste trasero.' AS descripcion, 14000.00 AS precio
  UNION ALL   SELECT 'Gorro de lana' AS nombre, 'Accesorios' AS categoria, 'Gorro tejido con puño doble y pompón.' AS descripcion, 12000.00 AS precio
  UNION ALL   SELECT 'Bufanda tejida' AS nombre, 'Accesorios' AS categoria, 'Bufanda tejida en punto, suave y abrigada.' AS descripcion, 16000.00 AS precio
) v JOIN categorias c ON c.nombre = v.categoria
WHERE NOT EXISTS (SELECT 1 FROM productos x WHERE x.nombre = v.nombre);

INSERT IGNORE INTO variantes_producto (producto_id, talle_id, color_id, sku)
SELECT p.id, t.id, c.id, v.sku FROM (
  SELECT 'Remera oversize' AS producto, 'M' AS talle, 'Blanco' AS color, 'D-RO0-M-BLA' AS sku
  UNION ALL   SELECT 'Remera oversize' AS producto, 'L' AS talle, 'Blanco' AS color, 'D-RO1-L-BLA' AS sku
  UNION ALL   SELECT 'Remera oversize' AS producto, 'XL' AS talle, 'Blanco' AS color, 'D-RO2-XL-BLA' AS sku
  UNION ALL   SELECT 'Remera oversize' AS producto, 'M' AS talle, 'Gris' AS color, 'D-RO3-M-GRI' AS sku
  UNION ALL   SELECT 'Remera oversize' AS producto, 'L' AS talle, 'Gris' AS color, 'D-RO4-L-GRI' AS sku
  UNION ALL   SELECT 'Remera oversize' AS producto, 'XL' AS talle, 'Gris' AS color, 'D-RO5-XL-GRI' AS sku
  UNION ALL   SELECT 'Remera oversize' AS producto, 'M' AS talle, 'Verde' AS color, 'D-RO6-M-VER' AS sku
  UNION ALL   SELECT 'Remera oversize' AS producto, 'L' AS talle, 'Verde' AS color, 'D-RO0-L-VER' AS sku
  UNION ALL   SELECT 'Remera oversize' AS producto, 'XL' AS talle, 'Verde' AS color, 'D-RO1-XL-VER' AS sku
  UNION ALL   SELECT 'Remera manga larga' AS producto, 'S' AS talle, 'Negro' AS color, 'D-RML2-S-NEG' AS sku
  UNION ALL   SELECT 'Remera manga larga' AS producto, 'M' AS talle, 'Negro' AS color, 'D-RML3-M-NEG' AS sku
  UNION ALL   SELECT 'Remera manga larga' AS producto, 'L' AS talle, 'Negro' AS color, 'D-RML4-L-NEG' AS sku
  UNION ALL   SELECT 'Remera manga larga' AS producto, 'S' AS talle, 'Bordó' AS color, 'D-RML5-S-BOR' AS sku
  UNION ALL   SELECT 'Remera manga larga' AS producto, 'M' AS talle, 'Bordó' AS color, 'D-RML6-M-BOR' AS sku
  UNION ALL   SELECT 'Remera manga larga' AS producto, 'L' AS talle, 'Bordó' AS color, 'D-RML0-L-BOR' AS sku
  UNION ALL   SELECT 'Buzo canguro' AS producto, 'M' AS talle, 'Gris' AS color, 'D-BC1-M-GRI' AS sku
  UNION ALL   SELECT 'Buzo canguro' AS producto, 'L' AS talle, 'Gris' AS color, 'D-BC2-L-GRI' AS sku
  UNION ALL   SELECT 'Buzo canguro' AS producto, 'XL' AS talle, 'Gris' AS color, 'D-BC3-XL-GRI' AS sku
  UNION ALL   SELECT 'Buzo canguro' AS producto, 'M' AS talle, 'Negro' AS color, 'D-BC4-M-NEG' AS sku
  UNION ALL   SELECT 'Buzo canguro' AS producto, 'L' AS talle, 'Negro' AS color, 'D-BC5-L-NEG' AS sku
  UNION ALL   SELECT 'Buzo canguro' AS producto, 'XL' AS talle, 'Negro' AS color, 'D-BC6-XL-NEG' AS sku
  UNION ALL   SELECT 'Buzo canguro' AS producto, 'M' AS talle, 'Bordó' AS color, 'D-BC0-M-BOR' AS sku
  UNION ALL   SELECT 'Buzo canguro' AS producto, 'L' AS talle, 'Bordó' AS color, 'D-BC1-L-BOR' AS sku
  UNION ALL   SELECT 'Buzo canguro' AS producto, 'XL' AS talle, 'Bordó' AS color, 'D-BC2-XL-BOR' AS sku
  UNION ALL   SELECT 'Buzo con cierre' AS producto, 'S' AS talle, 'Verde' AS color, 'D-BCC3-S-VER' AS sku
  UNION ALL   SELECT 'Buzo con cierre' AS producto, 'M' AS talle, 'Verde' AS color, 'D-BCC4-M-VER' AS sku
  UNION ALL   SELECT 'Buzo con cierre' AS producto, 'L' AS talle, 'Verde' AS color, 'D-BCC5-L-VER' AS sku
  UNION ALL   SELECT 'Buzo con cierre' AS producto, 'S' AS talle, 'Negro' AS color, 'D-BCC6-S-NEG' AS sku
  UNION ALL   SELECT 'Buzo con cierre' AS producto, 'M' AS talle, 'Negro' AS color, 'D-BCC0-M-NEG' AS sku
  UNION ALL   SELECT 'Buzo con cierre' AS producto, 'L' AS talle, 'Negro' AS color, 'D-BCC1-L-NEG' AS sku
  UNION ALL   SELECT 'Jean recto' AS producto, 'S' AS talle, 'Azul' AS color, 'D-JR2-S-AZU' AS sku
  UNION ALL   SELECT 'Jean recto' AS producto, 'M' AS talle, 'Azul' AS color, 'D-JR3-M-AZU' AS sku
  UNION ALL   SELECT 'Jean recto' AS producto, 'L' AS talle, 'Azul' AS color, 'D-JR4-L-AZU' AS sku
  UNION ALL   SELECT 'Jean recto' AS producto, 'XL' AS talle, 'Azul' AS color, 'D-JR5-XL-AZU' AS sku
  UNION ALL   SELECT 'Jean recto' AS producto, 'S' AS talle, 'Negro' AS color, 'D-JR6-S-NEG' AS sku
  UNION ALL   SELECT 'Jean recto' AS producto, 'M' AS talle, 'Negro' AS color, 'D-JR0-M-NEG' AS sku
  UNION ALL   SELECT 'Jean recto' AS producto, 'L' AS talle, 'Negro' AS color, 'D-JR1-L-NEG' AS sku
  UNION ALL   SELECT 'Jean recto' AS producto, 'XL' AS talle, 'Negro' AS color, 'D-JR2-XL-NEG' AS sku
  UNION ALL   SELECT 'Jogger de algodón' AS producto, 'S' AS talle, 'Gris' AS color, 'D-JDA3-S-GRI' AS sku
  UNION ALL   SELECT 'Jogger de algodón' AS producto, 'M' AS talle, 'Gris' AS color, 'D-JDA4-M-GRI' AS sku
  UNION ALL   SELECT 'Jogger de algodón' AS producto, 'L' AS talle, 'Gris' AS color, 'D-JDA5-L-GRI' AS sku
  UNION ALL   SELECT 'Jogger de algodón' AS producto, 'S' AS talle, 'Negro' AS color, 'D-JDA6-S-NEG' AS sku
  UNION ALL   SELECT 'Jogger de algodón' AS producto, 'M' AS talle, 'Negro' AS color, 'D-JDA0-M-NEG' AS sku
  UNION ALL   SELECT 'Jogger de algodón' AS producto, 'L' AS talle, 'Negro' AS color, 'D-JDA1-L-NEG' AS sku
  UNION ALL   SELECT 'Jogger de algodón' AS producto, 'S' AS talle, 'Verde' AS color, 'D-JDA2-S-VER' AS sku
  UNION ALL   SELECT 'Jogger de algodón' AS producto, 'M' AS talle, 'Verde' AS color, 'D-JDA3-M-VER' AS sku
  UNION ALL   SELECT 'Jogger de algodón' AS producto, 'L' AS talle, 'Verde' AS color, 'D-JDA4-L-VER' AS sku
  UNION ALL   SELECT 'Short deportivo' AS producto, 'S' AS talle, 'Azul' AS color, 'D-SD5-S-AZU' AS sku
  UNION ALL   SELECT 'Short deportivo' AS producto, 'M' AS talle, 'Azul' AS color, 'D-SD6-M-AZU' AS sku
  UNION ALL   SELECT 'Short deportivo' AS producto, 'L' AS talle, 'Azul' AS color, 'D-SD0-L-AZU' AS sku
  UNION ALL   SELECT 'Short deportivo' AS producto, 'S' AS talle, 'Gris' AS color, 'D-SD1-S-GRI' AS sku
  UNION ALL   SELECT 'Short deportivo' AS producto, 'M' AS talle, 'Gris' AS color, 'D-SD2-M-GRI' AS sku
  UNION ALL   SELECT 'Short deportivo' AS producto, 'L' AS talle, 'Gris' AS color, 'D-SD3-L-GRI' AS sku
  UNION ALL   SELECT 'Campera rompevientos' AS producto, 'M' AS talle, 'Mostaza' AS color, 'D-CR4-M-MOS' AS sku
  UNION ALL   SELECT 'Campera rompevientos' AS producto, 'L' AS talle, 'Mostaza' AS color, 'D-CR5-L-MOS' AS sku
  UNION ALL   SELECT 'Campera rompevientos' AS producto, 'XL' AS talle, 'Mostaza' AS color, 'D-CR6-XL-MOS' AS sku
  UNION ALL   SELECT 'Campera rompevientos' AS producto, 'M' AS talle, 'Negro' AS color, 'D-CR0-M-NEG' AS sku
  UNION ALL   SELECT 'Campera rompevientos' AS producto, 'L' AS talle, 'Negro' AS color, 'D-CR1-L-NEG' AS sku
  UNION ALL   SELECT 'Campera rompevientos' AS producto, 'XL' AS talle, 'Negro' AS color, 'D-CR2-XL-NEG' AS sku
  UNION ALL   SELECT 'Campera rompevientos' AS producto, 'M' AS talle, 'Celeste' AS color, 'D-CR3-M-CEL' AS sku
  UNION ALL   SELECT 'Campera rompevientos' AS producto, 'L' AS talle, 'Celeste' AS color, 'D-CR4-L-CEL' AS sku
  UNION ALL   SELECT 'Campera rompevientos' AS producto, 'XL' AS talle, 'Celeste' AS color, 'D-CR5-XL-CEL' AS sku
  UNION ALL   SELECT 'Campera de jean' AS producto, 'S' AS talle, 'Celeste' AS color, 'D-CDJ6-S-CEL' AS sku
  UNION ALL   SELECT 'Campera de jean' AS producto, 'M' AS talle, 'Celeste' AS color, 'D-CDJ0-M-CEL' AS sku
  UNION ALL   SELECT 'Campera de jean' AS producto, 'L' AS talle, 'Celeste' AS color, 'D-CDJ1-L-CEL' AS sku
  UNION ALL   SELECT 'Campera de jean' AS producto, 'S' AS talle, 'Azul' AS color, 'D-CDJ2-S-AZU' AS sku
  UNION ALL   SELECT 'Campera de jean' AS producto, 'M' AS talle, 'Azul' AS color, 'D-CDJ3-M-AZU' AS sku
  UNION ALL   SELECT 'Campera de jean' AS producto, 'L' AS talle, 'Azul' AS color, 'D-CDJ4-L-AZU' AS sku
  UNION ALL   SELECT 'Gorra clásica' AS producto, 'Único' AS talle, 'Negro' AS color, 'D-GC5-UNI-NEG' AS sku
  UNION ALL   SELECT 'Gorra clásica' AS producto, 'Único' AS talle, 'Arena' AS color, 'D-GC6-UNI-ARE' AS sku
  UNION ALL   SELECT 'Gorra clásica' AS producto, 'Único' AS talle, 'Azul' AS color, 'D-GC0-UNI-AZU' AS sku
  UNION ALL   SELECT 'Gorro de lana' AS producto, 'Único' AS talle, 'Gris' AS color, 'D-GDL1-UNI-GRI' AS sku
  UNION ALL   SELECT 'Gorro de lana' AS producto, 'Único' AS talle, 'Bordó' AS color, 'D-GDL2-UNI-BOR' AS sku
  UNION ALL   SELECT 'Gorro de lana' AS producto, 'Único' AS talle, 'Mostaza' AS color, 'D-GDL3-UNI-MOS' AS sku
  UNION ALL   SELECT 'Bufanda tejida' AS producto, 'Único' AS talle, 'Bordó' AS color, 'D-BT4-UNI-BOR' AS sku
  UNION ALL   SELECT 'Bufanda tejida' AS producto, 'Único' AS talle, 'Gris' AS color, 'D-BT5-UNI-GRI' AS sku
  UNION ALL   SELECT 'Bufanda tejida' AS producto, 'Único' AS talle, 'Arena' AS color, 'D-BT6-UNI-ARE' AS sku
) v JOIN productos p ON p.nombre = v.producto JOIN talles t ON t.nombre = v.talle JOIN colores c ON c.nombre = v.color;

INSERT IGNORE INTO existencias (variante_id, ubicacion_id, cantidad)
SELECT vp.id, u.id, v.cantidad FROM (
  SELECT 'D-RO0-M-BLA' AS sku, 8 AS cantidad
  UNION ALL   SELECT 'D-RO1-L-BLA' AS sku, 3 AS cantidad
  UNION ALL   SELECT 'D-RO2-XL-BLA' AS sku, 10 AS cantidad
  UNION ALL   SELECT 'D-RO3-M-GRI' AS sku, 0 AS cantidad
  UNION ALL   SELECT 'D-RO4-L-GRI' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-RO5-XL-GRI' AS sku, 15 AS cantidad
  UNION ALL   SELECT 'D-RO6-M-VER' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-RO0-L-VER' AS sku, 8 AS cantidad
  UNION ALL   SELECT 'D-RO1-XL-VER' AS sku, 0 AS cantidad
  UNION ALL   SELECT 'D-RML2-S-NEG' AS sku, 15 AS cantidad
  UNION ALL   SELECT 'D-RML3-M-NEG' AS sku, 5 AS cantidad
  UNION ALL   SELECT 'D-RML4-L-NEG' AS sku, 0 AS cantidad
  UNION ALL   SELECT 'D-RML5-S-BOR' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-RML6-M-BOR' AS sku, 10 AS cantidad
  UNION ALL   SELECT 'D-RML0-L-BOR' AS sku, 10 AS cantidad
  UNION ALL   SELECT 'D-BC1-M-GRI' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-BC2-L-GRI' AS sku, 5 AS cantidad
  UNION ALL   SELECT 'D-BC3-XL-GRI' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-BC4-M-NEG' AS sku, 15 AS cantidad
  UNION ALL   SELECT 'D-BC5-L-NEG' AS sku, 10 AS cantidad
  UNION ALL   SELECT 'D-BC6-XL-NEG' AS sku, 0 AS cantidad
  UNION ALL   SELECT 'D-BC0-M-BOR' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-BC1-L-BOR' AS sku, 5 AS cantidad
  UNION ALL   SELECT 'D-BC2-XL-BOR' AS sku, 0 AS cantidad
  UNION ALL   SELECT 'D-BCC3-S-VER' AS sku, 10 AS cantidad
  UNION ALL   SELECT 'D-BCC4-M-VER' AS sku, 0 AS cantidad
  UNION ALL   SELECT 'D-BCC5-L-VER' AS sku, 5 AS cantidad
  UNION ALL   SELECT 'D-BCC6-S-NEG' AS sku, 0 AS cantidad
  UNION ALL   SELECT 'D-BCC0-M-NEG' AS sku, 15 AS cantidad
  UNION ALL   SELECT 'D-BCC1-L-NEG' AS sku, 3 AS cantidad
  UNION ALL   SELECT 'D-JR2-S-AZU' AS sku, 6 AS cantidad
  UNION ALL   SELECT 'D-JR3-M-AZU' AS sku, 10 AS cantidad
  UNION ALL   SELECT 'D-JR4-L-AZU' AS sku, 3 AS cantidad
  UNION ALL   SELECT 'D-JR5-XL-AZU' AS sku, 15 AS cantidad
  UNION ALL   SELECT 'D-JR6-S-NEG' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-JR0-M-NEG' AS sku, 6 AS cantidad
  UNION ALL   SELECT 'D-JR1-L-NEG' AS sku, 15 AS cantidad
  UNION ALL   SELECT 'D-JR2-XL-NEG' AS sku, 3 AS cantidad
  UNION ALL   SELECT 'D-JDA3-S-GRI' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-JDA4-M-GRI' AS sku, 5 AS cantidad
  UNION ALL   SELECT 'D-JDA5-L-GRI' AS sku, 8 AS cantidad
  UNION ALL   SELECT 'D-JDA6-S-NEG' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-JDA0-M-NEG' AS sku, 15 AS cantidad
  UNION ALL   SELECT 'D-JDA1-L-NEG' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-JDA2-S-VER' AS sku, 0 AS cantidad
  UNION ALL   SELECT 'D-JDA3-M-VER' AS sku, 5 AS cantidad
  UNION ALL   SELECT 'D-JDA4-L-VER' AS sku, 12 AS cantidad
  UNION ALL   SELECT 'D-SD5-S-AZU' AS sku, 15 AS cantidad
  UNION ALL   SELECT 'D-SD6-M-AZU' AS sku, 10 AS cantidad
  UNION ALL   SELECT 'D-SD0-L-AZU' AS sku, 8 AS cantidad
  UNION ALL   SELECT 'D-SD1-S-GRI' AS sku, 12 AS cantidad
  UNION ALL   SELECT 'D-SD2-M-GRI' AS sku, 12 AS cantidad
  UNION ALL   SELECT 'D-SD3-L-GRI' AS sku, 8 AS cantidad
  UNION ALL   SELECT 'D-CR4-M-MOS' AS sku, 6 AS cantidad
  UNION ALL   SELECT 'D-CR5-L-MOS' AS sku, 5 AS cantidad
  UNION ALL   SELECT 'D-CR6-XL-MOS' AS sku, 3 AS cantidad
  UNION ALL   SELECT 'D-CR0-M-NEG' AS sku, 5 AS cantidad
  UNION ALL   SELECT 'D-CR1-L-NEG' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-CR2-XL-NEG' AS sku, 6 AS cantidad
  UNION ALL   SELECT 'D-CR3-M-CEL' AS sku, 15 AS cantidad
  UNION ALL   SELECT 'D-CR4-L-CEL' AS sku, 12 AS cantidad
  UNION ALL   SELECT 'D-CR5-XL-CEL' AS sku, 8 AS cantidad
  UNION ALL   SELECT 'D-CDJ6-S-CEL' AS sku, 12 AS cantidad
  UNION ALL   SELECT 'D-CDJ0-M-CEL' AS sku, 6 AS cantidad
  UNION ALL   SELECT 'D-CDJ1-L-CEL' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-CDJ2-S-AZU' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-CDJ3-M-AZU' AS sku, 15 AS cantidad
  UNION ALL   SELECT 'D-CDJ4-L-AZU' AS sku, 10 AS cantidad
  UNION ALL   SELECT 'D-GC5-UNI-NEG' AS sku, 3 AS cantidad
  UNION ALL   SELECT 'D-GC6-UNI-ARE' AS sku, 8 AS cantidad
  UNION ALL   SELECT 'D-GC0-UNI-AZU' AS sku, 3 AS cantidad
  UNION ALL   SELECT 'D-GDL1-UNI-GRI' AS sku, 12 AS cantidad
  UNION ALL   SELECT 'D-GDL2-UNI-BOR' AS sku, 10 AS cantidad
  UNION ALL   SELECT 'D-GDL3-UNI-MOS' AS sku, 0 AS cantidad
  UNION ALL   SELECT 'D-BT4-UNI-BOR' AS sku, 2 AS cantidad
  UNION ALL   SELECT 'D-BT5-UNI-GRI' AS sku, 15 AS cantidad
  UNION ALL   SELECT 'D-BT6-UNI-ARE' AS sku, 8 AS cantidad
) v JOIN variantes_producto vp ON vp.sku = v.sku JOIN ubicaciones u ON u.nombre = 'Depósito central';

INSERT INTO movimientos_stock (variante_id, ubicacion_id, cantidad, motivo, observacion)
SELECT e.variante_id, e.ubicacion_id, e.cantidad, 'inicial', 'Carga inicial de productos de demo'
FROM existencias e JOIN variantes_producto vp ON vp.id = e.variante_id
WHERE vp.sku IN ('D-RO0-M-BLA', 'D-RO1-L-BLA', 'D-RO2-XL-BLA', 'D-RO3-M-GRI', 'D-RO4-L-GRI', 'D-RO5-XL-GRI', 'D-RO6-M-VER', 'D-RO0-L-VER', 'D-RO1-XL-VER', 'D-RML2-S-NEG', 'D-RML3-M-NEG', 'D-RML4-L-NEG', 'D-RML5-S-BOR', 'D-RML6-M-BOR', 'D-RML0-L-BOR', 'D-BC1-M-GRI', 'D-BC2-L-GRI', 'D-BC3-XL-GRI', 'D-BC4-M-NEG', 'D-BC5-L-NEG', 'D-BC6-XL-NEG', 'D-BC0-M-BOR', 'D-BC1-L-BOR', 'D-BC2-XL-BOR', 'D-BCC3-S-VER', 'D-BCC4-M-VER', 'D-BCC5-L-VER', 'D-BCC6-S-NEG', 'D-BCC0-M-NEG', 'D-BCC1-L-NEG', 'D-JR2-S-AZU', 'D-JR3-M-AZU', 'D-JR4-L-AZU', 'D-JR5-XL-AZU', 'D-JR6-S-NEG', 'D-JR0-M-NEG', 'D-JR1-L-NEG', 'D-JR2-XL-NEG', 'D-JDA3-S-GRI', 'D-JDA4-M-GRI', 'D-JDA5-L-GRI', 'D-JDA6-S-NEG', 'D-JDA0-M-NEG', 'D-JDA1-L-NEG', 'D-JDA2-S-VER', 'D-JDA3-M-VER', 'D-JDA4-L-VER', 'D-SD5-S-AZU', 'D-SD6-M-AZU', 'D-SD0-L-AZU', 'D-SD1-S-GRI', 'D-SD2-M-GRI', 'D-SD3-L-GRI', 'D-CR4-M-MOS', 'D-CR5-L-MOS', 'D-CR6-XL-MOS', 'D-CR0-M-NEG', 'D-CR1-L-NEG', 'D-CR2-XL-NEG', 'D-CR3-M-CEL', 'D-CR4-L-CEL', 'D-CR5-XL-CEL', 'D-CDJ6-S-CEL', 'D-CDJ0-M-CEL', 'D-CDJ1-L-CEL', 'D-CDJ2-S-AZU', 'D-CDJ3-M-AZU', 'D-CDJ4-L-AZU', 'D-GC5-UNI-NEG', 'D-GC6-UNI-ARE', 'D-GC0-UNI-AZU', 'D-GDL1-UNI-GRI', 'D-GDL2-UNI-BOR', 'D-GDL3-UNI-MOS', 'D-BT4-UNI-BOR', 'D-BT5-UNI-GRI', 'D-BT6-UNI-ARE') AND e.cantidad > 0
AND NOT EXISTS (SELECT 1 FROM movimientos_stock m WHERE m.variante_id = e.variante_id AND m.observacion = 'Carga inicial de productos de demo');

-- Fotos: una por color de cada producto, solo si el producto todavia no tiene fotos.
INSERT INTO producto_imagenes (producto_id, url, color_id, orden)
SELECT p.id, CONCAT('/api/imagenes/', v.archivo, '.webp'), c.id, v.orden FROM (
  SELECT 'Remera esencial' AS producto, 'Negro' AS color, 0 AS orden, '3a75b04a-9149-2a51-99bd-a424299cf16d' AS archivo
  UNION ALL   SELECT 'Remera esencial' AS producto, 'Blanco' AS color, 1 AS orden, 'a9d06b61-fd1e-3aa5-7c7f-e2e8292e3438' AS archivo
  UNION ALL   SELECT 'Buzo urbano' AS producto, 'Arena' AS color, 0 AS orden, 'dbe1a7a1-b862-04b8-6555-9ce61fe33da7' AS archivo
  UNION ALL   SELECT 'Pantalón chino' AS producto, 'Azul' AS color, 0 AS orden, '790f1adf-dba1-7076-880b-9778e21e9d90' AS archivo
  UNION ALL   SELECT 'Remera oversize' AS producto, 'Blanco' AS color, 0 AS orden, '41102a2d-d5e9-33f2-53cb-e559b7077e6d' AS archivo
  UNION ALL   SELECT 'Remera oversize' AS producto, 'Gris' AS color, 1 AS orden, '8b053c76-1536-465f-f9f0-edc7444e6949' AS archivo
  UNION ALL   SELECT 'Remera oversize' AS producto, 'Verde' AS color, 2 AS orden, '50264846-5481-7783-5bf4-130aadc94271' AS archivo
  UNION ALL   SELECT 'Remera manga larga' AS producto, 'Negro' AS color, 0 AS orden, '6543e293-c472-66bc-5cc9-5994c8f4f813' AS archivo
  UNION ALL   SELECT 'Remera manga larga' AS producto, 'Bordó' AS color, 1 AS orden, '37b003ff-04da-4ae3-e00b-49af6cf35979' AS archivo
  UNION ALL   SELECT 'Buzo canguro' AS producto, 'Gris' AS color, 0 AS orden, '48cac21a-40e0-018b-58ed-4e7ae3ee3235' AS archivo
  UNION ALL   SELECT 'Buzo canguro' AS producto, 'Negro' AS color, 1 AS orden, 'bbae009c-cb1c-7c3d-3258-5c3a594d73e6' AS archivo
  UNION ALL   SELECT 'Buzo canguro' AS producto, 'Bordó' AS color, 2 AS orden, '4a767756-5c06-0768-8b91-a082ab219bb9' AS archivo
  UNION ALL   SELECT 'Buzo con cierre' AS producto, 'Verde' AS color, 0 AS orden, 'e0b7b05b-9907-a3ce-23e2-5cb8601a78ac' AS archivo
  UNION ALL   SELECT 'Buzo con cierre' AS producto, 'Negro' AS color, 1 AS orden, 'e58d58d0-7171-dcfc-670b-04eb4eead42c' AS archivo
  UNION ALL   SELECT 'Jean recto' AS producto, 'Azul' AS color, 0 AS orden, '56d6fb0e-9612-5b53-3c40-f19bea12c83b' AS archivo
  UNION ALL   SELECT 'Jean recto' AS producto, 'Negro' AS color, 1 AS orden, '9d235db1-b0de-5e54-ebc0-9528b3a38291' AS archivo
  UNION ALL   SELECT 'Jogger de algodón' AS producto, 'Gris' AS color, 0 AS orden, 'd17a6727-80a3-5e48-cfab-c3111faeb0d0' AS archivo
  UNION ALL   SELECT 'Jogger de algodón' AS producto, 'Negro' AS color, 1 AS orden, '4b6a1b71-71bb-7b22-0e1a-ee5ec2e5f7fc' AS archivo
  UNION ALL   SELECT 'Jogger de algodón' AS producto, 'Verde' AS color, 2 AS orden, 'a52b5966-4864-578b-9623-8adc653160c3' AS archivo
  UNION ALL   SELECT 'Short deportivo' AS producto, 'Azul' AS color, 0 AS orden, '141ba65f-fac2-7e18-159d-05879d8bf9e4' AS archivo
  UNION ALL   SELECT 'Short deportivo' AS producto, 'Gris' AS color, 1 AS orden, 'c7f94b6a-4fa0-e9ca-9eed-b47b396467b0' AS archivo
  UNION ALL   SELECT 'Campera rompevientos' AS producto, 'Mostaza' AS color, 0 AS orden, 'e8edae70-bc6c-627b-475a-c400a7fd9684' AS archivo
  UNION ALL   SELECT 'Campera rompevientos' AS producto, 'Negro' AS color, 1 AS orden, '871248cc-d8cc-4e25-39cc-8a7ef6650f9c' AS archivo
  UNION ALL   SELECT 'Campera rompevientos' AS producto, 'Celeste' AS color, 2 AS orden, '9bdb1f55-4efd-71ef-4016-6628bfe8776c' AS archivo
  UNION ALL   SELECT 'Campera de jean' AS producto, 'Celeste' AS color, 0 AS orden, 'bc227f60-80d6-8beb-ef2b-505628d3805b' AS archivo
  UNION ALL   SELECT 'Campera de jean' AS producto, 'Azul' AS color, 1 AS orden, '284be08a-2534-1ee9-40c7-c35fc79f26f6' AS archivo
  UNION ALL   SELECT 'Gorra clásica' AS producto, 'Negro' AS color, 0 AS orden, 'c377e206-1946-0d05-8251-da20ca9a1164' AS archivo
  UNION ALL   SELECT 'Gorra clásica' AS producto, 'Arena' AS color, 1 AS orden, 'c1bfaff5-109c-b599-2e2d-5fe222596438' AS archivo
  UNION ALL   SELECT 'Gorra clásica' AS producto, 'Azul' AS color, 2 AS orden, 'c4001a38-cf8c-7261-9bef-e215ca206029' AS archivo
  UNION ALL   SELECT 'Gorro de lana' AS producto, 'Gris' AS color, 0 AS orden, 'ab4c2ca1-03c4-e88b-618b-6e4328d337dd' AS archivo
  UNION ALL   SELECT 'Gorro de lana' AS producto, 'Bordó' AS color, 1 AS orden, '20595f05-3c1f-a71e-2297-6a3700a13983' AS archivo
  UNION ALL   SELECT 'Gorro de lana' AS producto, 'Mostaza' AS color, 2 AS orden, '95d56191-450e-635c-a3a0-d8c7b12513c5' AS archivo
  UNION ALL   SELECT 'Bufanda tejida' AS producto, 'Bordó' AS color, 0 AS orden, '48fafd57-6fb4-e198-fe4b-4eaa81f1fb66' AS archivo
  UNION ALL   SELECT 'Bufanda tejida' AS producto, 'Gris' AS color, 1 AS orden, '53da9176-cf30-b565-2d2a-181fe4064a5d' AS archivo
  UNION ALL   SELECT 'Bufanda tejida' AS producto, 'Arena' AS color, 2 AS orden, 'c4f8d9d3-7dee-2af0-a5ac-5309379c06e8' AS archivo
) v JOIN productos p ON p.nombre = v.producto JOIN colores c ON c.nombre = v.color
WHERE NOT EXISTS (SELECT 1 FROM producto_imagenes x WHERE x.producto_id = p.id);

-- La foto principal del producto es la primera de su galeria.
UPDATE productos p JOIN producto_imagenes i ON i.producto_id = p.id AND i.orden = 0
SET p.imagen_url = i.url
WHERE (p.imagen_url IS NULL OR p.imagen_url = '')
AND p.nombre IN ('Remera esencial', 'Buzo urbano', 'Pantalón chino', 'Remera oversize', 'Remera manga larga', 'Buzo canguro', 'Buzo con cierre', 'Jean recto', 'Jogger de algodón', 'Short deportivo', 'Campera rompevientos', 'Campera de jean', 'Gorra clásica', 'Gorro de lana', 'Bufanda tejida');
