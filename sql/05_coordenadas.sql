-- =====================================================================
-- EcoBuesaco · Coordenadas de los destinos
-- Las de demostración son APROXIMADAS (alrededor de Buesaco) y ficticias,
-- igual que los destinos. Reemplázalas por las reales cuando las tengas.
-- =====================================================================
USE ecobuesaco;

UPDATE destinos SET latitud = 1.395000, longitud = -77.141000 WHERE nombre = 'Sendero Camino del Café';
UPDATE destinos SET latitud = 1.371000, longitud = -77.163000 WHERE nombre = 'Cascada La Esperanza';
UPDATE destinos SET latitud = 1.402000, longitud = -77.158000 WHERE nombre = 'Mirador Alto del Viento';
UPDATE destinos SET latitud = 1.378000, longitud = -77.135000 WHERE nombre = 'Ruta Cafetera Los Nogales';
UPDATE destinos SET latitud = 1.362000, longitud = -77.148000 WHERE nombre = 'Sendero Cañón del Río';
UPDATE destinos SET latitud = 1.389000, longitud = -77.172000 WHERE nombre = 'Cascada Los Helechos';
UPDATE destinos SET latitud = 1.408000, longitud = -77.146000 WHERE nombre = 'Mirador del Atardecer';
UPDATE destinos SET latitud = 1.383000, longitud = -77.155000 WHERE nombre = 'Casa de Cultura y Tertulia';

-- Verificación: cuántos tienen ubicación y cuáles faltan
SELECT estado, COUNT(*) AS total, SUM(latitud IS NOT NULL) AS con_ubicacion FROM destinos GROUP BY estado;
SELECT id, nombre FROM destinos WHERE latitud IS NULL AND estado = 'publicado';