-- =====================================================================
-- EcoBuesaco · Categorías administrables
-- Agrega el color de cada categoría y si está activa. Ejecutar una sola vez.
-- =====================================================================
USE ecobuesaco;

ALTER TABLE categorias
  ADD COLUMN color  VARCHAR(7)  NOT NULL DEFAULT '#2f6048' AFTER icono,
  ADD COLUMN activa TINYINT(1)  NOT NULL DEFAULT 1 AFTER orden;

-- Los colores que ya tenían las 4 categorías en el CSS
UPDATE categorias SET color = '#cdb055' WHERE slug = 'senderismo';
UPDATE categorias SET color = '#52b5e0' WHERE slug = 'cascadas';
UPDATE categorias SET color = '#8bb36a' WHERE slug = 'miradores';
UPDATE categorias SET color = '#c9a05a' WHERE slug = 'cafe';

SELECT id, slug, nombre, icono, color, orden, activa FROM categorias ORDER BY orden;