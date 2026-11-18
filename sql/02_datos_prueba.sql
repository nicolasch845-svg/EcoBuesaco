-- =====================================================================
-- EcoBuesaco · Datos de prueba (DEMO)
-- Requiere haber ejecutado antes 01_estructura.sql
-- Todo el contenido es ficticio y sirve solo para desarrollo.
-- =====================================================================

USE ecobuesaco;
SET NAMES utf8mb4;

-- Limpieza de datos de prueba (conserva la estructura y las categorías).
-- Se usa DELETE en lugar de TRUNCATE porque TRUNCATE falla con claves foráneas.
DELETE FROM me_gusta;
DELETE FROM favoritos;
DELETE FROM publicaciones;
DELETE FROM guias;
DELETE FROM destino_fotos;
DELETE FROM destinos;
DELETE FROM usuarios;

-- Reinicia los contadores para que los ids vuelvan a empezar en 1
ALTER TABLE publicaciones AUTO_INCREMENT = 1;
ALTER TABLE guias         AUTO_INCREMENT = 1;
ALTER TABLE destino_fotos AUTO_INCREMENT = 1;
ALTER TABLE destinos      AUTO_INCREMENT = 1;
ALTER TABLE usuarios      AUTO_INCREMENT = 1;
-- ---------------------------------------------------------------------
-- Usuarios de demostración.
-- password_hash = '!' nunca coincide con ninguna contraseña, así que estas
-- cuentas NO permiten iniciar sesión. Sirven solo para firmar publicaciones.
-- Para entrar a la app, regístrate desde la interfaz con tu propio usuario.
-- ---------------------------------------------------------------------
INSERT INTO usuarios (nombres, apellidos, usuario, correo, fecha_nacimiento, password_hash, rol) VALUES
  ('Camila', 'Rojas (demo)',  'camila_demo', 'camila.demo@example.com', '1995-03-14', '!', 'usuario'),
  ('Andrés', 'Mora (demo)',   'andres_demo', 'andres.demo@example.com', '1992-08-02', '!', 'usuario'),
  ('Lucía',  'Pérez (demo)',  'lucia_demo',  'lucia.demo@example.com',  '1998-11-27', '!', 'usuario');

-- ---------------------------------------------------------------------
-- Destinos publicados (usuario_id NULL = contenido del equipo)
-- ---------------------------------------------------------------------
INSERT INTO destinos
  (categoria_id, usuario_id, nombre, descripcion, ubicacion, dificultad, duracion, mejor_epoca, recomendaciones, destacado, estado)
VALUES
  ((SELECT id FROM categorias WHERE slug='senderismo'), NULL,
   'Sendero Camino del Café',
   'Caminata entre cafetales y bosque con vistas al valle. Información de demostración.',
   'Zona rural de Buesaco (dato de ejemplo)', 'Moderada', '3 horas', 'Mañanas secas',
   'Lleva agua y calzado cerrado\nProtector solar', 1, 'publicado'),

  ((SELECT id FROM categorias WHERE slug='cascadas'), NULL,
   'Cascada La Esperanza',
   'Caída de agua rodeada de vegetación. Ejemplo para probar la interfaz.',
   'Zona rural de Buesaco (dato de ejemplo)', 'Fácil', '1.5 horas', 'Temporada de lluvias moderadas',
   'Lleva ropa de repuesto\nNo dejes residuos', 1, 'publicado'),

  ((SELECT id FROM categorias WHERE slug='miradores'), NULL,
   'Mirador Alto del Viento',
   'Punto panorámico ideal para el amanecer. Texto de demostración.',
   'Zona rural de Buesaco (dato de ejemplo)', 'Fácil', '1 hora', 'Amanecer',
   'Lleva abrigo ligero', 1, 'publicado'),

  ((SELECT id FROM categorias WHERE slug='cafe'), NULL,
   'Ruta Cafetera Los Nogales',
   'Recorrido por una finca cafetera con degustación. Datos ficticios.',
   'Zona rural de Buesaco (dato de ejemplo)', 'Fácil', '2 horas', 'Todo el año',
   'Reserva con anticipación', 1, 'publicado'),

  ((SELECT id FROM categorias WHERE slug='senderismo'), NULL,
   'Sendero Cañón del Río',
   'Ruta junto al río con tramos de piedra. Ejemplo de demostración.',
   'Zona rural de Buesaco (dato de ejemplo)', 'Exigente', '5 horas', 'Época seca',
   'Ve acompañado\nInforma tu ruta', 0, 'publicado'),

  ((SELECT id FROM categorias WHERE slug='cascadas'), NULL,
   'Cascada Los Helechos',
   'Cascada alta y estrecha, ideal para fotografía vertical. Ejemplo.',
   'Zona rural de Buesaco (dato de ejemplo)', 'Moderada', '2.5 horas', 'Mañana',
   'Calzado antideslizante', 0, 'publicado'),

  ((SELECT id FROM categorias WHERE slug='miradores'), NULL,
   'Mirador del Atardecer',
   'Mirador con vista abierta hacia las montañas. Texto de ejemplo.',
   'Zona rural de Buesaco (dato de ejemplo)', 'Fácil', '45 min', 'Tarde',
   'Linterna para el regreso', 0, 'publicado'),

  ((SELECT id FROM categorias WHERE slug='cafe'), NULL,
   'Casa de Cultura y Tertulia',
   'Espacio cultural con café y música local. Información ficticia.',
   'Zona rural de Buesaco (dato de ejemplo)', 'Fácil', '1.5 horas', 'Fines de semana',
   'Consulta la programación', 0, 'publicado');

-- Una propuesta pendiente: sirve para probar que NO aparece en la parte pública
INSERT INTO destinos
  (categoria_id, usuario_id, nombre, descripcion, ubicacion, dificultad, duracion, estado)
VALUES
  ((SELECT id FROM categorias WHERE slug='cascadas'),
   (SELECT id FROM usuarios WHERE usuario='camila_demo'),
   'Poza Escondida (propuesta de prueba)',
   'Propuesta pendiente de revisión, no debe verse públicamente.',
   'Vereda de ejemplo', 'Moderada', '2 horas', 'pendiente');

-- ---------------------------------------------------------------------
-- Guías
-- ---------------------------------------------------------------------
INSERT INTO guias (titulo, resumen, autor, minutos_lectura, pasos) VALUES
  ('Cómo preparar tu primera caminata',
   'Lista básica de equipo, hidratación y seguridad.',
   'Equipo EcoBuesaco (demo)', 4,
   'Revisa el clima antes de salir\nLleva agua, snacks y botiquín básico\nAvisa a alguien tu ruta y hora de regreso\nRegresa con tu basura'),
  ('Turismo responsable en cascadas',
   'Cómo disfrutar el agua sin dañar el entorno.',
   'Equipo EcoBuesaco (demo)', 3,
   'No uses jabones ni bloqueador dentro del agua\nRespeta los senderos marcados\nNo extraigas plantas ni piedras'),
  ('Ruta del café: qué esperar',
   'Etapas del café, de la semilla a la taza.',
   'Guía invitado (demo)', 5,
   'Reserva la visita\nPregunta por el proceso de beneficio\nCompra directo al productor');

-- ---------------------------------------------------------------------
-- Publicaciones de la comunidad y algunos me gusta
-- ---------------------------------------------------------------------
INSERT INTO publicaciones (usuario_id, destino_id, texto, creado_en) VALUES
  ((SELECT id FROM usuarios WHERE usuario='camila_demo'),
   (SELECT id FROM destinos WHERE nombre='Cascada La Esperanza'),
   'Una caminata corta y muy agradable. Recomiendo ir temprano.', NOW() - INTERVAL 2 DAY),
  ((SELECT id FROM usuarios WHERE usuario='andres_demo'),
   (SELECT id FROM destinos WHERE nombre='Mirador Alto del Viento'),
   'El amanecer desde el mirador vale la pena. Lleven abrigo.', NOW() - INTERVAL 4 DAY),
  ((SELECT id FROM usuarios WHERE usuario='lucia_demo'),
   (SELECT id FROM destinos WHERE nombre='Ruta Cafetera Los Nogales'),
   'Aprendimos mucho sobre el proceso del café. Excelente atención.', NOW() - INTERVAL 7 DAY);

INSERT INTO me_gusta (usuario_id, publicacion_id)
SELECT u.id, p.id
FROM usuarios u
JOIN publicaciones p ON p.usuario_id <> u.id;

-- ---------------------------------------------------------------------
-- Nota: no se insertan fotos. Los destinos no tienen archivos reales aún;
-- la interfaz mostrará una imagen de reemplazo hasta que se suban fotos.
-- ---------------------------------------------------------------------