-- =====================================================================
-- EcoBuesaco · Destinos reales de Buesaco, Nariño
-- Fuente de los textos: turismo.narino.gov.co y buesaco.co (sitios turísticos).
-- Las coordenadas quedan vacías: se completan al final de este archivo.
-- =====================================================================
USE ecobuesaco;
SET NAMES utf8mb4;

-- Cañón del Juanambú
INSERT INTO destinos (categoria_id, usuario_id, nombre, descripcion, ubicacion, dificultad, duracion, mejor_epoca, recomendaciones, destacado, estado)
SELECT c.id, NULL, 'Cañón del Juanambú',
  'El sitio más emblemático del municipio. Ofrece un imponente paisaje verde, piscinas naturales, zonas para acampar y senderos ecológicos que recorren el escenario histórico de la Batalla de Juanambú (1814), con ruinas de antiguos puentes y cuevas.',
  'Vereda Parapetos, a unos 15 minutos del parque principal',
  'Fácil', 'Por confirmar', '',
  'Lleva ropa cómoda y calzado apto para caminar\nProtector solar\nLleva efectivo', 1, 'publicado'
FROM categorias c WHERE c.slug = 'senderismo'
  AND NOT EXISTS (SELECT 1 FROM destinos WHERE nombre = 'Cañón del Juanambú');

-- Piedra de los Monos (Negrohuaico)
INSERT INTO destinos (categoria_id, usuario_id, nombre, descripcion, ubicacion, dificultad, duracion, mejor_epoca, recomendaciones, destacado, estado)
SELECT c.id, NULL, 'Piedra de los Monos (Negrohuaico)',
  'Un valioso sitio con petroglifos conmemorativos ancestrales, ubicado en el corregimiento de Rosal del Monte.',
  'Vereda San Miguel, corregimiento de Rosal del Monte',
  'Fácil', 'Por confirmar', '',
  'Lleva ropa cómoda y calzado apto para caminar\nProtector solar\nLleva efectivo', 1, 'publicado'
FROM categorias c WHERE c.slug = 'cafe'
  AND NOT EXISTS (SELECT 1 FROM destinos WHERE nombre = 'Piedra de los Monos (Negrohuaico)');

-- Río Pajajoy
INSERT INTO destinos (categoria_id, usuario_id, nombre, descripcion, ubicacion, dificultad, duracion, mejor_epoca, recomendaciones, destacado, estado)
SELECT c.id, NULL, 'Río Pajajoy',
  'Reconocido por sus aguas frías, a las que se les atribuyen supuestos beneficios de relajación y salud. Cerca hay una pequeña capilla.',
  'Río Pajajoy, Buesaco',
  'Fácil', 'Por confirmar', '',
  'Lleva ropa cómoda y calzado apto para caminar\nProtector solar\nLleva efectivo', 1, 'publicado'
FROM categorias c WHERE c.slug = 'cascadas'
  AND NOT EXISTS (SELECT 1 FROM destinos WHERE nombre = 'Río Pajajoy');

-- Llanuras de Ortega
INSERT INTO destinos (categoria_id, usuario_id, nombre, descripcion, ubicacion, dificultad, duracion, mejor_epoca, recomendaciones, destacado, estado)
SELECT c.id, NULL, 'Llanuras de Ortega',
  'Zona de relieve accidentado y llanuras, caracterizada por sus cielos despejados. Es ideal para la observación del cielo estrellado durante el verano.',
  'Llanuras de Ortega, Buesaco',
  'Fácil', 'Por confirmar', 'Verano',
  'Lleva ropa cómoda y calzado apto para caminar\nProtector solar\nLleva efectivo', 1, 'publicado'
FROM categorias c WHERE c.slug = 'miradores'
  AND NOT EXISTS (SELECT 1 FROM destinos WHERE nombre = 'Llanuras de Ortega');

-- Ruta del café de altura
INSERT INTO destinos (categoria_id, usuario_id, nombre, descripcion, ubicacion, dificultad, duracion, mejor_epoca, recomendaciones, destacado, estado)
SELECT c.id, NULL, 'Ruta del café de altura',
  'Buesaco cultiva café de alta calidad a más de 1.800 metros de altura. Es ideal para el turismo vivencial: permite recorrer fincas cafeteras tradicionales y degustar la gastronomía y los quesos artesanales de la región.',
  'Fincas cafeteras del municipio de Buesaco',
  'Fácil', 'Por confirmar', '',
  'Lleva ropa cómoda y calzado apto para caminar\nProtector solar\nLleva efectivo', 1, 'publicado'
FROM categorias c WHERE c.slug = 'cafe'
  AND NOT EXISTS (SELECT 1 FROM destinos WHERE nombre = 'Ruta del café de altura');

-- Iglesia Municipal
INSERT INTO destinos (categoria_id, usuario_id, nombre, descripcion, ubicacion, dificultad, duracion, mejor_epoca, recomendaciones, destacado, estado)
SELECT c.id, NULL, 'Iglesia Municipal',
  'Principal templo del casco urbano, bajo la dirección parroquial local. Refleja la arquitectura de la población.',
  'Casco urbano de Buesaco',
  'Fácil', 'Por confirmar', '',
  NULL, 0, 'publicado'
FROM categorias c WHERE c.slug = 'cafe'
  AND NOT EXISTS (SELECT 1 FROM destinos WHERE nombre = 'Iglesia Municipal');

-- ---------------------------------------------------------------------
-- COORDENADAS: en Google Maps haz clic derecho sobre el lugar exacto,
-- copia los dos números, quita el "--" de la línea y reemplaza LAT y LNG
-- (primero la latitud, por ejemplo 1.3825, después la longitud, -77.1559).
-- ---------------------------------------------------------------------
-- UPDATE destinos SET latitud = LAT, longitud = LNG WHERE nombre = 'Cañón del Juanambú';
-- UPDATE destinos SET latitud = LAT, longitud = LNG WHERE nombre = 'Piedra de los Monos (Negrohuaico)';
-- UPDATE destinos SET latitud = LAT, longitud = LNG WHERE nombre = 'Río Pajajoy';
-- UPDATE destinos SET latitud = LAT, longitud = LNG WHERE nombre = 'Llanuras de Ortega';
-- UPDATE destinos SET latitud = LAT, longitud = LNG WHERE nombre = 'Ruta del café de altura';
-- UPDATE destinos SET latitud = LAT, longitud = LNG WHERE nombre = 'Iglesia Municipal';

-- Verificación
SELECT d.id, d.nombre, c.nombre AS categoria, d.destacado, d.latitud, d.longitud
FROM destinos d JOIN categorias c ON c.id = d.categoria_id ORDER BY d.id;