<?php
declare(strict_types=1);

/**
 * Destinos: listar, detalle, proponer y mis_propuestas.
 * El enrutador (api/index.php) ya validó el módulo y el token CSRF.
 */

function manejar(string $accion): void
{
    match ($accion) {
        'listar'         => destinos_listar(),
        'detalle'        => destinos_detalle(),
        'proponer'       => destinos_proponer(),
        'mis_propuestas' => destinos_mis_propuestas(),
        default          => fallo('Acción no encontrada.', 404),
    };
}

/* ===================== Utilidades del módulo ===================== */

function destinos_foto_a_array(array $f): array
{
    return [
        'src'         => FOTOS_URL_BASE . $f['archivo'],
        'w'           => (int) $f['ancho'],
        'h'           => (int) $f['alto'],
        'orientacion' => $f['orientacion'],
    ];
}

/** Escapa % y _ para que el texto buscado se trate literalmente en LIKE. */
function destinos_escapar_like(string $s): string
{
    return addcslashes($s, '%_\\');
}

/* ===================== Listar ===================== */
/* GET ?r=destinos&accion=listar&categoria=cascadas&q=cafe&destacado=1&pagina=1&limite=50 */

function destinos_listar(): void
{
    $uid     = usuario_actual()['id'] ?? 0;
    $slug    = texto($_GET['categoria'] ?? '');
    $q       = texto($_GET['q'] ?? '');
    $soloDes = ($_GET['destacado'] ?? '') === '1';
    $limite  = max(1, min(100, (int) ($_GET['limite'] ?? 50)));
    $pagina  = max(1, (int) ($_GET['pagina'] ?? 1));

    $donde  = ["d.estado = 'publicado'"];
    $params = [];

    if ($slug !== '' && $slug !== 'all') {
        $donde[] = 'c.slug = :slug';
        $params[':slug'] = $slug;
    }
    if ($soloDes) {
        $donde[] = 'd.destacado = 1';
    }
    if ($q !== '') {
        // La colación utf8mb4_unicode_ci ignora tildes y mayúsculas
        $donde[] = '(d.nombre LIKE :q1 OR d.descripcion LIKE :q2 OR d.ubicacion LIKE :q3 OR c.nombre LIKE :q4)';
        $patron = '%' . destinos_escapar_like(mb_substr($q, 0, 80)) . '%';
        foreach ([':q1', ':q2', ':q3', ':q4'] as $k) {
            $params[$k] = $patron;
        }
    }
    $where = implode(' AND ', $donde);

    $st = db()->prepare("SELECT COUNT(*) FROM destinos d JOIN categorias c ON c.id = d.categoria_id WHERE $where");
    $st->execute($params);
    $total = (int) $st->fetchColumn();

    $sql = "SELECT d.id, d.nombre, d.descripcion, d.ubicacion, d.latitud, d.longitud,
                   d.dificultad, d.duracion, d.destacado,
                   c.slug AS categoria, c.nombre AS categoria_nombre,
                   f.archivo, f.ancho, f.alto, f.orientacion,
                   (fv.destino_id IS NOT NULL) AS es_favorito
            FROM destinos d
            JOIN categorias c ON c.id = d.categoria_id
            LEFT JOIN destino_fotos f ON f.destino_id = d.id AND f.es_portada = 1
            LEFT JOIN favoritos fv ON fv.destino_id = d.id AND fv.usuario_id = :uid
            WHERE $where
            ORDER BY d.destacado DESC, d.nombre ASC
            LIMIT :lim OFFSET :off";
    $st = db()->prepare($sql);
    foreach ($params as $k => $v) {
        $st->bindValue($k, $v);
    }
    $st->bindValue(':uid', $uid, PDO::PARAM_INT);
    $st->bindValue(':lim', $limite, PDO::PARAM_INT);
    $st->bindValue(':off', ($pagina - 1) * $limite, PDO::PARAM_INT);
    $st->execute();

    $items = array_map(fn(array $r) => [
        'id'               => (int) $r['id'],
        'nombre'           => $r['nombre'],
        'descripcion'      => $r['descripcion'],
        'ubicacion'        => $r['ubicacion'],
        'lat'              => $r['latitud'] !== null ? (float) $r['latitud'] : null,
        'lng'              => $r['longitud'] !== null ? (float) $r['longitud'] : null,
        'dificultad'       => $r['dificultad'],
        'duracion'         => $r['duracion'],
        'destacado'        => (bool) $r['destacado'],
        'categoria'        => $r['categoria'],
        'categoria_nombre' => $r['categoria_nombre'],
        'es_favorito'      => (bool) $r['es_favorito'],
        'imagen'           => $r['archivo'] !== null ? destinos_foto_a_array($r) : null,
    ], $st->fetchAll());

    exito(['destinos' => $items, 'total' => $total, 'pagina' => $pagina, 'limite' => $limite]);
}

/* ===================== Detalle ===================== */
/* GET ?r=destinos&accion=detalle&id=3 */

function destinos_detalle(): void
{
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        fallo('Destino no válido.', 400);
    }
    $u = usuario_actual();

    $st = db()->prepare(
        'SELECT d.*, c.slug AS categoria, c.nombre AS categoria_nombre,
                (SELECT COUNT(*) FROM favoritos WHERE destino_id = d.id AND usuario_id = ?) AS es_favorito
         FROM destinos d JOIN categorias c ON c.id = d.categoria_id
         WHERE d.id = ?'
    );
    $st->execute([$u['id'] ?? 0, $id]);
    $d = $st->fetch();

    // Lo no publicado solo lo ve quien lo propuso o un moderador
    $puedeVer = $d && (
        $d['estado'] === 'publicado'
        || ($u && ((int) $d['usuario_id'] === $u['id'] || in_array($u['rol'], ['moderador', 'admin'], true)))
    );
    if (!$puedeVer) {
        fallo('Destino no encontrado.', 404);
    }

    $st = db()->prepare(
        'SELECT archivo, ancho, alto, orientacion FROM destino_fotos
         WHERE destino_id = ? ORDER BY es_portada DESC, orden ASC'
    );
    $st->execute([$id]);
    $fotos = array_map('destinos_foto_a_array', $st->fetchAll());

    exito(['destino' => [
        'id'               => (int) $d['id'],
        'nombre'           => $d['nombre'],
        'descripcion'      => $d['descripcion'],
        'ubicacion'        => $d['ubicacion'],
        'lat'              => $d['latitud'] !== null ? (float) $d['latitud'] : null,
        'lng'              => $d['longitud'] !== null ? (float) $d['longitud'] : null,
        'dificultad'       => $d['dificultad'],
        'duracion'         => $d['duracion'],
        'mejor_epoca'      => $d['mejor_epoca'],
        'recomendaciones'  => lineas_a_lista($d['recomendaciones']),
        'categoria'        => $d['categoria'],
        'categoria_nombre' => $d['categoria_nombre'],
        'estado'           => $d['estado'],
        'es_favorito'      => (bool) $d['es_favorito'],
        'fotos'            => $fotos,
        'imagen'           => $fotos[0] ?? null,
    ]]);
}

/* ===================== Mis propuestas ===================== */
/* GET ?r=destinos&accion=mis_propuestas */

function destinos_mis_propuestas(): void
{
    $u = exigir_usuario();
    $st = db()->prepare(
        'SELECT d.id, d.nombre, d.ubicacion, d.estado, d.motivo_rechazo, d.creado_en,
                c.slug AS categoria, c.nombre AS categoria_nombre,
                f.archivo, f.ancho, f.alto, f.orientacion,
                (SELECT COUNT(*) FROM destino_fotos WHERE destino_id = d.id) AS total_fotos
         FROM destinos d
         JOIN categorias c ON c.id = d.categoria_id
         LEFT JOIN destino_fotos f ON f.destino_id = d.id AND f.es_portada = 1
         WHERE d.usuario_id = ? ORDER BY d.creado_en DESC'
    );
    $st->execute([$u['id']]);

    $items = array_map(fn(array $r) => [
        'id'               => (int) $r['id'],
        'nombre'           => $r['nombre'],
        'ubicacion'        => $r['ubicacion'],
        'estado'           => $r['estado'],
        'motivo_rechazo'   => $r['motivo_rechazo'],
        'categoria'        => $r['categoria'],
        'categoria_nombre' => $r['categoria_nombre'],
        'total_fotos'      => (int) $r['total_fotos'],
        'creado'           => hace_tiempo($r['creado_en']),
        'imagen'           => $r['archivo'] !== null ? destinos_foto_a_array($r) : null,
    ], $st->fetchAll());

    exito(['propuestas' => $items]);
}

/* ===================== Proponer destino ===================== */
/* POST multipart/form-data (no JSON, porque lleva fotos):
   nombre, descripcion, categoria (slug), ubicacion, dificultad, duracion,
   mejor_epoca?, recomendaciones?, latitud?, longitud?, fotos[] (1 a 5)      */

/** Convierte $_FILES['fotos'] (formato anidado de PHP) en una lista simple. */
function destinos_normalizar_archivos(?array $f): array
{
    if (!$f || !is_array($f['name'])) {
        return [];
    }
    $lista = [];
    foreach (array_keys($f['name']) as $i) {
        if ($f['error'][$i] === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        $lista[] = [
            'name' => (string) $f['name'][$i], 'tmp_name' => (string) $f['tmp_name'][$i],
            'size' => (int) $f['size'][$i],    'error'    => (int) $f['error'][$i],
        ];
    }
    return $lista;
}

/** Valida una foto por su contenido real (no por su extensión). Devuelve datos o un mensaje de error. */
function destinos_validar_foto(array $a): array|string
{
    $nombre = mb_substr($a['name'], 0, 60);
    if ($a['error'] === UPLOAD_ERR_INI_SIZE || $a['error'] === UPLOAD_ERR_FORM_SIZE) {
        return "“$nombre” es demasiado pesada.";
    }
    if ($a['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($a['tmp_name'])) {
        return "No se pudo recibir “$nombre”.";
    }
    if ($a['size'] > FOTOS_MAX_BYTES) {
        return "“$nombre” supera " . (FOTOS_MAX_BYTES / 1024 / 1024) . ' MB.';
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($a['tmp_name']);
    if (!in_array($mime, FOTOS_TIPOS, true)) {
        return "“$nombre” no es JPG, PNG o WebP.";
    }
    $info = @getimagesize($a['tmp_name']);
    if (!$info || $info['mime'] !== $mime) {
        return "“$nombre” no es una imagen válida.";
    }
    [$w, $h] = $info;
    if ($w < 200 || $h < 200 || $w > 12000 || $h > 12000) {
        return "“$nombre” debe medir entre 200 y 12000 píxeles por lado.";
    }
    $ratio = $w / $h;
    return [
        'tmp'  => $a['tmp_name'], 'w' => $w, 'h' => $h,
        'ext'  => ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime],
        'orientacion' => $ratio > 1.05 ? 'horizontal' : ($ratio < 0.95 ? 'vertical' : 'cuadrada'),
    ];
}

function destinos_proponer(): void
{
    if (metodo() !== 'POST') {
        fallo('Método no permitido.', 405);
    }
    $u = exigir_usuario();

    $st = db()->prepare("SELECT COUNT(*) FROM destinos WHERE usuario_id = ? AND estado = 'pendiente'");
    $st->execute([$u['id']]);
    if ((int) $st->fetchColumn() >= 10) {
        fallo('Tienes demasiadas propuestas pendientes. Espera a que se revisen.', 429);
    }

    $nombre      = texto($_POST['nombre'] ?? '');
    $descripcion = texto_largo($_POST['descripcion'] ?? '');
    $slug        = texto($_POST['categoria'] ?? '');
    $ubicacion   = texto($_POST['ubicacion'] ?? '');
    $dificultad  = texto($_POST['dificultad'] ?? '');
    $duracion    = texto($_POST['duracion'] ?? '');
    $epoca       = texto($_POST['mejor_epoca'] ?? '');
    $recom       = texto_largo($_POST['recomendaciones'] ?? '');
    $latRaw      = texto($_POST['latitud'] ?? '');
    $lngRaw      = texto($_POST['longitud'] ?? '');

    $e = [];
    if (largo($nombre) < 3 || largo($nombre) > 120)           $e['nombre']      = 'El nombre debe tener entre 3 y 120 caracteres.';
    if (largo($descripcion) < 20 || largo($descripcion) > 2000) $e['descripcion'] = 'La descripción debe tener entre 20 y 2000 caracteres.';
    $categoriaId = $slug !== '' ? categoria_id_por_slug($slug) : null;
    if ($categoriaId === null)                                $e['categoria']   = 'Selecciona una categoría válida.';
    if (largo($ubicacion) < 3 || largo($ubicacion) > 160)     $e['ubicacion']   = 'Indica la ubicación (3 a 160 caracteres).';
    if (!in_array($dificultad, ['Fácil', 'Moderada', 'Exigente'], true)) $e['dificultad'] = 'Selecciona la dificultad.';
    if ($duracion === '' || largo($duracion) > 40)            $e['duracion']    = 'Indica la duración aproximada (máx. 40 caracteres).';
    if (largo($epoca) > 120)                                  $e['mejor_epoca'] = 'Máximo 120 caracteres.';
    if (largo($recom) > 600)                                  $e['recomendaciones'] = 'Máximo 600 caracteres.';

    // Coordenadas opcionales (se usarán con Google Maps)
    $lat = $lng = null;
    if ($latRaw !== '' || $lngRaw !== '') {
        if (!is_numeric($latRaw) || !is_numeric($lngRaw) || abs((float) $latRaw) > 90 || abs((float) $lngRaw) > 180) {
            $e['latitud'] = 'Coordenadas no válidas.';
        } else {
            $lat = round((float) $latRaw, 6);
            $lng = round((float) $lngRaw, 6);
        }
    }

    // Fotografías: validar todas antes de guardar cualquiera
    $archivos = destinos_normalizar_archivos($_FILES['fotos'] ?? null);
    $fotos = [];
    if (!$archivos) {
        $e['fotos'] = 'Agrega al menos una fotografía.';
    } elseif (count($archivos) > FOTOS_MAX_POR_DESTINO) {
        $e['fotos'] = 'Máximo ' . FOTOS_MAX_POR_DESTINO . ' fotografías.';
    } else {
        foreach ($archivos as $a) {
            $r = destinos_validar_foto($a);
            if (is_string($r)) { $e['fotos'] = $r; break; }
            $fotos[] = $r;
        }
    }
    if ($e) {
        fallo('Revisa los campos marcados.', 422, $e);
    }

    // Guardado atómico: si algo falla se borran los archivos y se revierte la base
    if (!is_dir(FOTOS_DIRECTORIO) && !mkdir(FOTOS_DIRECTORIO, 0755, true)) {
        error_log('EcoBuesaco · no se pudo crear ' . FOTOS_DIRECTORIO);
        fallo('No se pudieron guardar las fotografías.', 500);
    }
    $guardados = [];
    $pdo = db();
    try {
        $pdo->beginTransaction();
        $pdo->prepare(
            "INSERT INTO destinos (categoria_id, usuario_id, nombre, descripcion, ubicacion, latitud, longitud,
                                   dificultad, duracion, mejor_epoca, recomendaciones, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')"
        )->execute([$categoriaId, $u['id'], $nombre, $descripcion, $ubicacion, $lat, $lng,
                    $dificultad, $duracion, $epoca, $recom !== '' ? $recom : null]);
        $destinoId = (int) $pdo->lastInsertId();

        $insFoto = $pdo->prepare(
            'INSERT INTO destino_fotos (destino_id, archivo, ancho, alto, orientacion, es_portada, orden)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($fotos as $i => $f) {
            $archivo = bin2hex(random_bytes(16)) . '.' . $f['ext'];   // nombre aleatorio: nunca el original
            $ruta = FOTOS_DIRECTORIO . '/' . $archivo;
            if (!move_uploaded_file($f['tmp'], $ruta)) {
                throw new RuntimeException('No se pudo mover la fotografía.');
            }
            $guardados[] = $ruta;
            $insFoto->execute([$destinoId, $archivo, $f['w'], $f['h'], $f['orientacion'], $i === 0 ? 1 : 0, $i]);
        }
        $pdo->commit();
    } catch (Throwable $ex) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        foreach ($guardados as $ruta) {
            @unlink($ruta);
        }
        throw $ex;   // el enrutador lo registra y responde 500
    }

    exito([
        'destino' => ['id' => $destinoId, 'estado' => 'pendiente'],
        'mensaje' => 'Propuesta enviada. Un moderador la revisará antes de publicarla.',
    ], 201);
}