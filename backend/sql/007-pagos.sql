CREATE TABLE IF NOT EXISTS reservas_pedido (
 pedido_id INT UNSIGNED NOT NULL,
 variante_id INT UNSIGNED NOT NULL,
 ubicacion_id INT UNSIGNED NOT NULL,
 cantidad INT UNSIGNED NOT NULL,
 estado ENUM('activa','consumida','liberada') NOT NULL DEFAULT 'activa',
 PRIMARY KEY(pedido_id,variante_id,ubicacion_id),
 FOREIGN KEY(pedido_id) REFERENCES pedidos(id),
 FOREIGN KEY(variante_id,ubicacion_id) REFERENCES existencias(variante_id,ubicacion_id),
 CHECK(cantidad>0)
);
CREATE TABLE IF NOT EXISTS checkout_pedidos (
 pedido_id INT UNSIGNED PRIMARY KEY,
 referencia CHAR(36) NOT NULL UNIQUE,
 preference_id VARCHAR(150) NULL UNIQUE,
 checkout_url VARCHAR(2048) NULL,
 revisado_en DATETIME NULL,
 estado ENUM('nuevo','creando','listo','incierto') NOT NULL DEFAULT 'nuevo',
 actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
);
CREATE TABLE IF NOT EXISTS pagos_mp (
 payment_id VARCHAR(100) PRIMARY KEY,
 pedido_id INT UNSIGNED NOT NULL,
 estado VARCHAR(50) NOT NULL,
 importe DECIMAL(14,2) NOT NULL,
 actualizado_mp DATETIME NOT NULL,
 FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
);
CREATE TABLE IF NOT EXISTS mp_notificaciones (
 payment_id VARCHAR(100) PRIMARY KEY,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 estado ENUM('pendiente','procesando','listo','fallido') NOT NULL DEFAULT 'pendiente',
 intentos INT UNSIGNED NOT NULL DEFAULT 0,
 disponible_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
