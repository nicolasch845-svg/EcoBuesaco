-- =====================================================================
-- EcoBuesaco · Estructura de la base de datos (MySQL 8 / MariaDB 10.4+)
-- Ejecutar primero este archivo y después 02_datos_prueba.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS ecobuesaco
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ecobuesaco;

SET NAMES utf8mb4;

-- Reinicio limpio (orden inverso a las dependencias).
-- ATENCIÓN: borra los datos existentes. No ejecutar en producción.
DROP TABLE IF EXISTS me_gusta;
DROP TABLE IF EXISTS favoritos;
DROP TABLE IF EXISTS publicaciones;
DROP TABLE IF EXISTS guias;
DROP TABLE IF EXISTS destino_fotos;
DROP TABLE IF EXISTS destinos;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS usuarios;

-- ---------------------------------------------------------------------
-- usuarios: no se almacenan documentos de identidad
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombres          VARCHAR(80)  NOT NULL,
  apellidos        VARCHAR(80)  NOT NULL,
  usuario          VARCHAR(20)  NOT NULL,
  correo           VARCHAR(150) NOT NULL,
  fecha_nacimiento DATE         NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,           -- resultado de password_hash(), nunca la contraseña
  rol              ENUM('usuario','moderador','admin') NOT NULL DEFAULT 'usuario',
  activo           TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_usuario (usuario),
  UNIQUE KEY uq_usuarios_correo (correo)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- categorias: las cuatro categorías turísticas
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
  id      TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug    VARCHAR(30)  NOT NULL,                    -- usado por la interfaz: senderismo, cascadas...
  nombre  VARCHAR(50)  NOT NULL,
  icono   VARCHAR(10)  NOT NULL DEFAULT '',
  orden   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_slug (slug)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- destinos: las propuestas son filas con estado = 'pendiente'
-- ---------------------------------------------------------------------
CREATE TABLE destinos (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  categoria_id   TINYINT UNSIGNED NOT NULL,
  usuario_id     INT UNSIGNED NULL,                 -- quién lo propuso (NULL = contenido del equipo)
  nombre         VARCHAR(120) NOT NULL,
  descripcion    TEXT         NOT NULL,
  ubicacion      VARCHAR(160) NOT NULL,             -- vereda, sector o referencia
  latitud        DECIMAL(9,6) NULL,                 -- reservado para Google Maps
  longitud       DECIMAL(9,6) NULL,
  dificultad     ENUM('Fácil','Moderada','Exigente') NOT NULL DEFAULT 'Fácil',
  duracion       VARCHAR(40)  NOT NULL DEFAULT '',
  mejor_epoca    VARCHAR(120) NOT NULL DEFAULT '',
  recomendaciones TEXT        NULL,                 -- una recomendación por línea
  destacado      TINYINT(1)   NOT NULL DEFAULT 0,
  estado         ENUM('pendiente','publicado','rechazado') NOT NULL DEFAULT 'pendiente',
  motivo_rechazo VARCHAR(255) NULL,
  creado_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_destinos_estado_cat (estado, categoria_id),
  KEY idx_destinos_destacado (destacado, estado),
  FULLTEXT KEY ft_destinos_busqueda (nombre, descripcion, ubicacion),
  CONSTRAINT fk_destinos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id),
  CONSTRAINT fk_destinos_usuario   FOREIGN KEY (usuario_id)   REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT chk_destinos_lat CHECK (latitud  IS NULL OR latitud  BETWEEN -90  AND 90),
  CONSTRAINT chk_destinos_lng CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- destino_fotos: varias fotos por destino, con dimensiones y orientación
-- ---------------------------------------------------------------------
CREATE TABLE destino_fotos (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  destino_id  INT UNSIGNED NOT NULL,
  archivo     VARCHAR(255) NOT NULL,                -- ruta relativa dentro de uploads/destinos/
  ancho       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  alto        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  orientacion ENUM('horizontal','vertical','cuadrada') NOT NULL DEFAULT 'horizontal',
  es_portada  TINYINT(1) NOT NULL DEFAULT 0,
  orden       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_fotos_destino (destino_id, orden),
  CONSTRAINT fk_fotos_destino FOREIGN KEY (destino_id) REFERENCES destinos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- guias
-- ---------------------------------------------------------------------
CREATE TABLE guias (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  titulo             VARCHAR(150) NOT NULL,
  resumen            VARCHAR(255) NOT NULL,
  autor              VARCHAR(100) NOT NULL,
  minutos_lectura    TINYINT UNSIGNED NOT NULL DEFAULT 3,
  pasos              TEXT NOT NULL,                  -- un paso por línea
  publicada          TINYINT(1) NOT NULL DEFAULT 1,
  creado_en          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- publicaciones de la comunidad
-- ---------------------------------------------------------------------
CREATE TABLE publicaciones (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id  INT UNSIGNED NOT NULL,
  destino_id  INT UNSIGNED NULL,
  texto       VARCHAR(1000) NOT NULL,
  visible     TINYINT(1) NOT NULL DEFAULT 1,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_publicaciones_fecha (visible, creado_en),
  CONSTRAINT fk_pub_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_pub_destino FOREIGN KEY (destino_id) REFERENCES destinos (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- me_gusta: un usuario solo puede dar un me gusta por publicación
-- ---------------------------------------------------------------------
CREATE TABLE me_gusta (
  usuario_id      INT UNSIGNED NOT NULL,
  publicacion_id  INT UNSIGNED NOT NULL,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, publicacion_id),
  CONSTRAINT fk_mg_usuario FOREIGN KEY (usuario_id)     REFERENCES usuarios (id)      ON DELETE CASCADE,
  CONSTRAINT fk_mg_pub     FOREIGN KEY (publicacion_id) REFERENCES publicaciones (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- favoritos: destinos guardados por usuario
-- ---------------------------------------------------------------------
CREATE TABLE favoritos (
  usuario_id  INT UNSIGNED NOT NULL,
  destino_id  INT UNSIGNED NOT NULL,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, destino_id),
  CONSTRAINT fk_fav_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_destino FOREIGN KEY (destino_id) REFERENCES destinos (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Las categorías son datos fijos de la aplicación, por eso se crean aquí
-- ---------------------------------------------------------------------
INSERT INTO categorias (slug, nombre, icono, orden) VALUES
  ('senderismo', 'Senderismo',     '🥾', 1),
  ('cascadas',   'Cascadas',       '💧', 2),
  ('miradores',  'Miradores',      '⛰️', 3),
  ('cafe',       'Café y Cultura', '☕', 4);