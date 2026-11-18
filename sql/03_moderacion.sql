-- =====================================================================
-- EcoBuesaco · Fase 1: moderación
-- Registra quién revisó cada destino y cuándo, y crea tu cuenta admin.
-- Ejecutar una sola vez.
-- =====================================================================
USE ecobuesaco;

ALTER TABLE destinos
  ADD COLUMN moderado_por INT UNSIGNED NULL AFTER motivo_rechazo,
  ADD COLUMN moderado_en  DATETIME NULL AFTER moderado_por,
  ADD CONSTRAINT fk_destinos_moderador
    FOREIGN KEY (moderado_por) REFERENCES usuarios (id) ON DELETE SET NULL;

-- Tu cuenta pasa a ser administrador
UPDATE usuarios SET rol = 'admin' WHERE correo = 'tu@correo.com';

-- Verificación: debe mostrar tu usuario con rol admin
SELECT id, usuario, correo, rol FROM usuarios WHERE rol = 'admin';