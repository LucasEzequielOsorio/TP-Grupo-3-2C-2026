-- Ejecutar en la base seleccionada. Docker la selecciona con MYSQL_DATABASE.
SET NAMES utf8mb4;

CREATE TABLE usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  direccion VARCHAR(255) NOT NULL,
  rol ENUM('cliente', 'admin') NOT NULL DEFAULT 'cliente',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE categorias (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE talles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(20) NOT NULL UNIQUE,
  orden SMALLINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE colores (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  hexadecimal CHAR(7) NULL,
  CONSTRAINT ck_color_hex CHECK (hexadecimal IS NULL OR hexadecimal REGEXP '^#[0-9A-Fa-f]{6}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE productos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  categoria_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  imagen_url VARCHAR(2048) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT ck_producto_precio CHECK (precio > 0),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE variantes_producto (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stock_minimo INT UNSIGNED NOT NULL DEFAULT 3,
  producto_id INT UNSIGNED NOT NULL,
  talle_id INT UNSIGNED NOT NULL,
  color_id INT UNSIGNED NOT NULL,
  sku VARCHAR(64) NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (producto_id, talle_id, color_id),
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (talle_id) REFERENCES talles(id),
  FOREIGN KEY (color_id) REFERENCES colores(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ubicaciones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  tipo ENUM('deposito', 'tienda') NOT NULL,
  direccion VARCHAR(255) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE existencias (
  variante_id INT UNSIGNED NOT NULL,
  ubicacion_id INT UNSIGNED NOT NULL,
  cantidad INT NOT NULL DEFAULT 0,
  PRIMARY KEY (variante_id, ubicacion_id),
  CONSTRAINT ck_existencias_cantidad CHECK (cantidad >= 0),
  FOREIGN KEY (variante_id) REFERENCES variantes_producto(id),
  FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE transferencias (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  origen_id INT UNSIGNED NOT NULL,
  destino_id INT UNSIGNED NOT NULL,
  estado ENUM('borrador', 'en_transito', 'recibida', 'cancelada') NOT NULL DEFAULT 'borrador',
  creado_por INT UNSIGNED NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  despachado_en TIMESTAMP NULL,
  recibido_en TIMESTAMP NULL,
  CONSTRAINT ck_transferencia_ubicaciones CHECK (origen_id <> destino_id),
  FOREIGN KEY (origen_id) REFERENCES ubicaciones(id),
  FOREIGN KEY (destino_id) REFERENCES ubicaciones(id),
  FOREIGN KEY (creado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE transferencia_items (
  transferencia_id INT UNSIGNED NOT NULL,
  variante_id INT UNSIGNED NOT NULL,
  cantidad INT NOT NULL,
  PRIMARY KEY (transferencia_id, variante_id),
  CONSTRAINT ck_transferencia_cantidad CHECK (cantidad > 0),
  FOREIGN KEY (transferencia_id) REFERENCES transferencias(id),
  FOREIGN KEY (variante_id) REFERENCES variantes_producto(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pedidos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  estado ENUM('pendiente', 'confirmado', 'cancelado', 'entregado') NOT NULL DEFAULT 'pendiente',
  direccion_entrega VARCHAR(255) NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pedido_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT UNSIGNED NOT NULL,
  variante_id INT UNSIGNED NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  UNIQUE (pedido_id, variante_id),
  CONSTRAINT ck_pedido_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_pedido_precio CHECK (precio_unitario > 0),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (variante_id) REFERENCES variantes_producto(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE movimientos_stock (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  variante_id INT UNSIGNED NOT NULL,
  ubicacion_id INT UNSIGNED NOT NULL,
  cantidad INT NOT NULL COMMENT 'Positiva: ingreso. Negativa: egreso.',
  motivo ENUM('inicial', 'ajuste', 'venta', 'devolucion', 'transferencia') NOT NULL,
  usuario_id INT UNSIGNED NULL COMMENT 'NULL para inicializacion del sistema',
  transferencia_id INT UNSIGNED NULL,
  pedido_id INT UNSIGNED NULL,
  observacion VARCHAR(255) NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_movimiento_cantidad CHECK (cantidad <> 0),
  CONSTRAINT ck_movimiento_transferencia CHECK (
    (motivo = 'transferencia' AND transferencia_id IS NOT NULL AND pedido_id IS NULL)
    OR (motivo <> 'transferencia' AND transferencia_id IS NULL)
  ),
  INDEX ix_movimientos_variante_ubicacion_fecha (variante_id, ubicacion_id, creado_en),
  FOREIGN KEY (variante_id, ubicacion_id) REFERENCES existencias(variante_id, ubicacion_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (transferencia_id) REFERENCES transferencias(id),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
