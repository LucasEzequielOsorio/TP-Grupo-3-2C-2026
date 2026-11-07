CREATE TABLE IF NOT EXISTS pedido_confirmaciones (
 usuario_id INT UNSIGNED NOT NULL, clave CHAR(36) NOT NULL, pedido_id INT UNSIGNED NOT NULL UNIQUE,
 PRIMARY KEY(usuario_id,clave), FOREIGN KEY(usuario_id) REFERENCES usuarios(id), FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
);
CREATE TABLE IF NOT EXISTS pedido_detalles (
 item_id INT UNSIGNED PRIMARY KEY, nombre VARCHAR(150) NOT NULL, talle VARCHAR(20) NOT NULL, color VARCHAR(80) NOT NULL,
 FOREIGN KEY(item_id) REFERENCES pedido_items(id)
);
