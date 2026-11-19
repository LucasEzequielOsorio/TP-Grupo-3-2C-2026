CREATE TABLE IF NOT EXISTS recuperacion_tokens (
 usuario_id INT UNSIGNED PRIMARY KEY,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 email VARCHAR(254) NOT NULL,
 auth_version INT UNSIGNED NOT NULL,
 vence_en DATETIME NOT NULL,
 FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS correos_cuenta (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 usuario_id INT UNSIGNED NOT NULL,
 email VARCHAR(254) NOT NULL,
 auth_version INT UNSIGNED NOT NULL,
 tipo ENUM('recuperacion','aviso') NOT NULL DEFAULT 'recuperacion',
 estado ENUM('pendiente','procesando','enviado','fallido','descartado') NOT NULL DEFAULT 'pendiente',
 intentos TINYINT UNSIGNED NOT NULL DEFAULT 0,
 disponible_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_correo_usuario_fecha(usuario_id,creado_en),
 INDEX ix_correo_pendiente(estado,disponible_en),
 FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
