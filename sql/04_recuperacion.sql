USE ecobuesaco;

CREATE TABLE IF NOT EXISTS recuperaciones (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id  INT UNSIGNED NOT NULL,
  token_hash  CHAR(64)     NOT NULL,          -- SHA-256 del código; el código real solo va en el correo
  expira_en   DATETIME     NOT NULL,
  usado_en    DATETIME     NULL,
  creado_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_recup_token (token_hash),
  KEY idx_recup_usuario (usuario_id, creado_en),
  CONSTRAINT fk_recup_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB;