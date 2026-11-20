-- Usuarios de demo para pruebas de la tienda y la defensa (admin y cliente).
-- Es idempotente: si ya existen, no falla ni altera cuentas preexistentes.
SET NAMES utf8mb4;

INSERT IGNORE INTO usuarios (email, password_hash, auth_version, nombre, apellido, direccion, rol, activo)
VALUES 
  ('admin@trama.com', '$2b$12$e2NSetf9o/U4dX2vQoWvvu8QCkkM2HXc8B4HluJB9RvonF.cGrGTO', 0, 'Administrador', 'TRAMA', 'Av. de Mayo 1000', 'admin', 1),
  ('cliente@trama.com', '$2b$12$9WpothMjOMz9QvYfeGzDFeVdHSESv3bqVKQ83sdQb7Ld0sIllq0Au', 0, 'Cliente', 'Demo', 'San Martín 500', 'cliente', 1);
