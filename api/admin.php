<?php
declare(strict_types=1);

/**
 * Administración y moderación.
 * Moderador y admin: resumen, pendientes, publicados, revisar, destacar, retirar.
 * Solo admin: usuarios, cambiar_rol, cambiar_activo.
 */

function manejar(string $accion): void
{
    match ($accion) {
        'resumen'            => admin_resumen(),
        'pendientes'         => admin_pendientes(),
        'publicados'         => admin_publicados(),
        'revisar'            => admin_revisar(),
        'destacar'           => admin_destacar(),
        'retirar'            => admin_retirar(),
        'usuarios'           => admin_usuarios(),
        'cambiar_rol'        => admin_cambiar_rol(),
        'cambiar_activo'     => admin_cambiar_activo(),
        'categorias'         => admin_categorias(),
        'crear_categoria'    => admin_crear_categoria(),
        'editar_categoria'   => admin_editar_categoria(),
        'activar_categoria'  => admin_activar_categoria(),
        'eliminar_categoria' => admin_eliminar_categoria(),
        default              => fallo('Acción no encontrada.', 404),
    };
}

/* ===================== Utilidades ===================== */

function admin_fotos_de(array $ids): array
{
    if (!$ids) {
        return [];
    }
    $marcas = implode(',', array_fill(0, count($ids), '?'));
    $st = db()->prepare(
        "SELECT destino_id, archivo, ancho, alto, orientacion FROM destino_fotos
         WHERE destino_id IN ($marcas) ORDER BY destino_id, es_portada DESC, orden ASC"
    );
    $st->execute(array_values($ids));
    $por = [];
    foreach ($st->fetchAll() as $f) {
        $por[(int) $f['destino_id']][] = [
            'src' => FOTOS_URL_BASE . $f['archivo'],
            'w'   => (int) $f['ancho'],
            'h'   => (int) $f['alto'],
            'orientacion' => $f['orientacion'],
        ];
    }
    return $por;
}

function admin_motivo(array $d): string
{
    $motivo = texto($d['motivo'] ?? '');
    if (largo($motivo) < 5 || largo($motivo) > 255) {
        fallo('Revisa los campos marcados.', 422, ['motivo' => 'Escribe un motivo de 5 a 255 caracteres.']);
    }
    return $motivo;
}

function admin_destino(int $id): array
{
    $st = db()->prepare('SELECT id, estado FROM destinos WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: fallo('Destino no encontrado.', 404);
}

/* ===================== Moderación ===================== */

/* GET ?r=admin&accion=resumen */
function admin_resumen(): void
{
    exigir_rol('moderador', 'admin');
    $r = db()->query(
        "SELECT
           (SELECT COUNT(*) FROM destinos WHERE estado = 'pendiente') AS pendientes,
           (SELECT COUNT(*) FROM destinos WHERE estado = 'publicado') AS publicados,
           (SELECT COUNT(*) FROM destinos WHERE estado = 'rechazado') AS rechazados,
           (SELECT COUNT(*) FROM usuarios WHERE activo = 1)           AS usuarios"
    )->fetch();
    exito(['resumen' => array_map('intval', $r)]);
}

/* GET ?r=admin&accion=pendientes  (las más antiguas primero) */
function admin_pendientes(): void
{
    exigir_rol('moderador', 'admin');
    $filas = db()->query(
        "SELECT d.id, d.nombre, d.descripcion, d.ubicacion, d.dificultad, d.duracion,
                d.mejor_epoca, d.recomendaciones, d.creado_en, d.latitud, d.longitud,
                c.slug AS categoria, c.nombre AS categoria_nombre,
                u.usuario AS proponente, CONCAT(u.nombres, ' ', u.apellidos) AS proponente_nombre
         FROM destinos d
         JOIN categorias c ON c.id = d.categoria_id
         LEFT JOIN usuarios u ON u.id = d.usuario_id
         WHERE d.estado = 'pendiente'
         ORDER BY d.creado_en ASC LIMIT 100"
    )->fetchAll();
    $fotos = admin_fotos_de(array_map('intval', array_column($filas, 'id')));

    exito(['propuestas' => array_map(fn(array $r) => [
        'id'               => (int) $r['id'],
        'nombre'           => $r['nombre'],
        'descripcion'      => $r['descripcion'],
        'ubicacion'        => $r['ubicacion'],
        'lat'              => $r['latitud'] !== null ? (float) $r['latitud'] : null,
        'lng'              => $r['longitud'] !== null ? (float) $r['longitud'] : null,
        'dificultad'       => $r['dificultad'],
        'duracion'         => $r['duracion'],
        'mejor_epoca'      => $r['mejor_epoca'],
        'recomendaciones'  => lineas_a_lista($r['recomendaciones']),
        'categoria'        => $r['categoria'],
        'categoria_nombre' => $r['categoria_nombre'],
        'proponente'       => $r['proponente'],
        'proponente_nombre'=> $r['proponente_nombre'],
        'creado'           => hace_tiempo($r['creado_en']),
        'fotos'            => $fotos[(int) $r['id']] ?? [],
    ], $filas)]);
}

/* GET ?r=admin&accion=publicados */
function admin_publicados(): void
{
    exigir_rol('moderador', 'admin');
    $filas = db()->query(
        "SELECT d.id, d.nombre, d.ubicacion, d.destacado, c.nombre AS categoria_nombre
         FROM destinos d JOIN categorias c ON c.id = d.categoria_id
         WHERE d.estado = 'publicado'
         ORDER BY d.destacado DESC, d.nombre ASC LIMIT 200"
    )->fetchAll();
    exito(['destinos' => array_map(fn(array $r) => [
        'id'               => (int) $r['id'],
        'nombre'           => $r['nombre'],
        'ubicacion'        => $r['ubicacion'],
        'destacado'        => (bool) $r['destacado'],
        'categoria_nombre' => $r['categoria_nombre'],
    ], $filas)]);
}

/* POST ?r=admin&accion=revisar   JSON: { id, decision: 'aprobar'|'rechazar', motivo?, destacado? } */
function admin_revisar(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    $yo = exigir_rol('moderador', 'admin');
    $d  = cuerpo_json();
    $id = (int) ($d['id'] ?? 0);
    $decision = texto($d['decision'] ?? '');

    $dest = admin_destino($id);
    if (!in_array($dest['estado'], ['pendiente', 'rechazado'], true)) {
        fallo('Este destino ya está publicado.', 409);
    }

    if ($decision === 'aprobar') {
        db()->prepare(
            "UPDATE destinos SET estado = 'publicado', motivo_rechazo = NULL, destacado = ?,
                    moderado_por = ?, moderado_en = NOW() WHERE id = ?"
        )->execute([!empty($d['destacado']) ? 1 : 0, $yo['id'], $id]);
        exito(['mensaje' => 'Destino aprobado y publicado.']);
    }

    if ($decision === 'rechazar') {
        db()->prepare(
            "UPDATE destinos SET estado = 'rechazado', motivo_rechazo = ?, destacado = 0,
                    moderado_por = ?, moderado_en = NOW() WHERE id = ?"
        )->execute([admin_motivo($d), $yo['id'], $id]);
        exito(['mensaje' => 'Propuesta rechazada.']);
    }

    fallo('Decisión no válida.', 422);
}

/* POST ?r=admin&accion=destacar   JSON: { id, destacado: bool } */
function admin_destacar(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    $yo = exigir_rol('moderador', 'admin');
    $d  = cuerpo_json();
    $id = (int) ($d['id'] ?? 0);

    if (admin_destino($id)['estado'] !== 'publicado') {
        fallo('Solo se pueden destacar destinos publicados.', 409);
    }
    db()->prepare('UPDATE destinos SET destacado = ?, moderado_por = ?, moderado_en = NOW() WHERE id = ?')
        ->execute([!empty($d['destacado']) ? 1 : 0, $yo['id'], $id]);
    exito(['destacado' => !empty($d['destacado'])]);
}

/* POST ?r=admin&accion=retirar   JSON: { id, motivo }  (deja de ser público) */
function admin_retirar(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    $yo = exigir_rol('moderador', 'admin');
    $d  = cuerpo_json();
    $id = (int) ($d['id'] ?? 0);

    if (admin_destino($id)['estado'] !== 'publicado') {
        fallo('Este destino no está publicado.', 409);
    }
    db()->prepare(
        "UPDATE destinos SET estado = 'rechazado', motivo_rechazo = ?, destacado = 0,
                moderado_por = ?, moderado_en = NOW() WHERE id = ?"
    )->execute([admin_motivo($d), $yo['id'], $id]);
    exito(['mensaje' => 'Destino retirado de la parte pública.']);
}

/* ===================== Usuarios (solo admin) ===================== */

/* GET ?r=admin&accion=usuarios */
function admin_usuarios(): void
{
    $yo = exigir_rol('admin');
    $filas = db()->query(
        'SELECT id, nombres, apellidos, usuario, correo, rol, activo, creado_en
         FROM usuarios ORDER BY creado_en DESC, id DESC LIMIT 200'
    )->fetchAll();
    exito(['usuarios' => array_map(fn(array $r) => [
        'id'      => (int) $r['id'],
        'nombre'  => trim($r['nombres'] . ' ' . $r['apellidos']),
        'usuario' => $r['usuario'],
        'correo'  => $r['correo'],
        'rol'     => $r['rol'],
        'activo'  => (bool) $r['activo'],
        'creado'  => hace_tiempo($r['creado_en']),
        'es_yo'   => (int) $r['id'] === $yo['id'],
    ], $filas)]);
}

function admin_usuario_existe(int $id): void
{
    $st = db()->prepare('SELECT COUNT(*) FROM usuarios WHERE id = ?');
    $st->execute([$id]);
    if (!(int) $st->fetchColumn()) {
        fallo('Usuario no encontrado.', 404);
    }
}

/* POST ?r=admin&accion=cambiar_rol   JSON: { id, rol } */
function admin_cambiar_rol(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    $yo  = exigir_rol('admin');
    $d   = cuerpo_json();
    $id  = (int) ($d['id'] ?? 0);
    $rol = texto($d['rol'] ?? '');

    if (!in_array($rol, ['usuario', 'moderador', 'admin'], true)) fallo('Rol no válido.', 422);
    // Evita quedarse sin administradores: nadie cambia su propio rol
    if ($id === $yo['id']) fallo('No puedes cambiar tu propio rol.', 403);
    admin_usuario_existe($id);

    db()->prepare('UPDATE usuarios SET rol = ? WHERE id = ?')->execute([$rol, $id]);
    exito(['mensaje' => 'Rol actualizado.']);
}

/* POST ?r=admin&accion=cambiar_activo   JSON: { id, activo: bool } */
function admin_cambiar_activo(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    $yo = exigir_rol('admin');
    $d  = cuerpo_json();
    $id = (int) ($d['id'] ?? 0);

    if ($id === $yo['id']) fallo('No puedes desactivar tu propia cuenta.', 403);
    admin_usuario_existe($id);

    db()->prepare('UPDATE usuarios SET activo = ? WHERE id = ?')->execute([!empty($d['activo']) ? 1 : 0, $id]);
    exito(['mensaje' => !empty($d['activo']) ? 'Cuenta activada.' : 'Cuenta desactivada.']);
}

/* ===================== Categorías (solo admin) ===================== */

const CATEGORIAS_MAX = 12;

/** Identificador interno a partir del nombre: "Café y Cultura" -> "cafe-y-cultura". No cambia al editar. */
function admin_cat_slug(string $nombre): string
{
    $s = mb_strtolower($nombre, 'UTF-8');
    $s = strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
    $s = trim(preg_replace('/[^a-z0-9]+/', '-', $s) ?? '', '-');
    return substr($s, 0, 30);
}

/** Valida nombre, icono y color. Devuelve [nombre, icono, color] o responde 422 con los errores por campo. */
function admin_cat_datos(array $d): array
{
    $nombre = texto($d['nombre'] ?? '');
    $icono  = texto($d['icono'] ?? '');
    $color  = strtolower(texto($d['color'] ?? ''));

    $e = [];
    if (largo($nombre) < 3 || largo($nombre) > 40) {
        $e['nombre'] = 'El nombre debe tener entre 3 y 40 caracteres.';
    } elseif (admin_cat_slug($nombre) === '') {
        $e['nombre'] = 'Usa letras o números en el nombre.';
    }
    // El icono debe ser un emoji o símbolo: sin letras, números ni caracteres de HTML
    if ($icono === '' || largo($icono) > 8 || preg_match('/[\p{L}\p{N}<>&"\']/u', $icono)) {
        $e['icono'] = 'Elige un emoji (por ejemplo 🌿).';
    }
    if (!preg_match('/^#[0-9a-f]{6}$/', $color)) {
        $e['color'] = 'Elige un color válido.';
    }
    if ($e) {
        fallo('Revisa los campos marcados.', 422, $e);
    }
    return [$nombre, $icono, $color];
}

function admin_cat_existe(int $id): array
{
    $st = db()->prepare('SELECT id, activa FROM categorias WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: fallo('Categoría no encontrada.', 404);
}

/** ¿Queda otra categoría activa además de esta? Siempre debe haber al menos una. */
function admin_cat_hay_otra_activa(int $id): bool
{
    $st = db()->prepare('SELECT COUNT(*) FROM categorias WHERE activa = 1 AND id <> ?');
    $st->execute([$id]);
    return (int) $st->fetchColumn() > 0;
}

/* GET ?r=admin&accion=categorias */
function admin_categorias(): void
{
    exigir_rol('admin');
    $filas = db()->query(
        'SELECT c.id, c.slug, c.nombre, c.icono, c.color, c.activa,
                (SELECT COUNT(*) FROM destinos d WHERE d.categoria_id = c.id) AS destinos
         FROM categorias c ORDER BY c.orden, c.id'
    )->fetchAll();
    exito(['categorias' => array_map(fn(array $r) => [
        'id'       => (int) $r['id'],
        'slug'     => $r['slug'],
        'nombre'   => $r['nombre'],
        'icono'    => $r['icono'],
        'color'    => $r['color'],
        'activa'   => (bool) $r['activa'],
        'destinos' => (int) $r['destinos'],
    ], $filas)]);
}

/* POST ?r=admin&accion=crear_categoria   JSON: { nombre, icono, color } */
function admin_crear_categoria(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    exigir_rol('admin');
    [$nombre, $icono, $color] = admin_cat_datos(cuerpo_json());
    $slug = admin_cat_slug($nombre);

    if ((int) db()->query('SELECT COUNT(*) FROM categorias')->fetchColumn() >= CATEGORIAS_MAX) {
        fallo('Se alcanzó el máximo de ' . CATEGORIAS_MAX . ' categorías.', 409);
    }
    $st = db()->prepare('SELECT COUNT(*) FROM categorias WHERE slug = ? OR nombre = ?');
    $st->execute([$slug, $nombre]);
    if ((int) $st->fetchColumn()) {
        fallo('Revisa los campos marcados.', 409, ['nombre' => 'Ya existe una categoría con ese nombre.']);
    }

    $orden = (int) db()->query('SELECT COALESCE(MAX(orden), 0) + 1 FROM categorias')->fetchColumn();
    db()->prepare('INSERT INTO categorias (slug, nombre, icono, color, orden) VALUES (?, ?, ?, ?, ?)')
        ->execute([$slug, $nombre, $icono, $color, min($orden, 255)]);
    exito(['mensaje' => 'Categoría creada.'], 201);
}

/* POST ?r=admin&accion=editar_categoria   JSON: { id, nombre, icono, color } */
function admin_editar_categoria(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    exigir_rol('admin');
    $d  = cuerpo_json();
    $id = (int) ($d['id'] ?? 0);
    admin_cat_existe($id);
    [$nombre, $icono, $color] = admin_cat_datos($d);

    $st = db()->prepare('SELECT COUNT(*) FROM categorias WHERE nombre = ? AND id <> ?');
    $st->execute([$nombre, $id]);
    if ((int) $st->fetchColumn()) {
        fallo('Revisa los campos marcados.', 409, ['nombre' => 'Ya existe una categoría con ese nombre.']);
    }
    db()->prepare('UPDATE categorias SET nombre = ?, icono = ?, color = ? WHERE id = ?')
        ->execute([$nombre, $icono, $color, $id]);
    exito(['mensaje' => 'Categoría actualizada.']);
}

/* POST ?r=admin&accion=activar_categoria   JSON: { id, activa: bool } */
function admin_activar_categoria(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    exigir_rol('admin');
    $d      = cuerpo_json();
    $id     = (int) ($d['id'] ?? 0);
    $activa = !empty($d['activa']);
    admin_cat_existe($id);

    if (!$activa && !admin_cat_hay_otra_activa($id)) {
        fallo('Debe quedar al menos una categoría activa.', 409);
    }
    db()->prepare('UPDATE categorias SET activa = ? WHERE id = ?')->execute([$activa ? 1 : 0, $id]);
    exito(['mensaje' => $activa ? 'Categoría activada.' : 'Categoría desactivada.']);
}

/* POST ?r=admin&accion=eliminar_categoria   JSON: { id }  (solo si no tiene destinos) */
function admin_eliminar_categoria(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    exigir_rol('admin');
    $id = (int) (cuerpo_json()['id'] ?? 0);
    admin_cat_existe($id);

    $st = db()->prepare('SELECT COUNT(*) FROM destinos WHERE categoria_id = ?');
    $st->execute([$id]);
    $n = (int) $st->fetchColumn();
    if ($n > 0) {
        fallo("Tiene $n destino(s). Desactívala en lugar de eliminarla.", 409);
    }
    if (!admin_cat_hay_otra_activa($id)) {
        fallo('Debe quedar al menos una categoría activa.', 409);
    }
    db()->prepare('DELETE FROM categorias WHERE id = ?')->execute([$id]);
    exito(['mensaje' => 'Categoría eliminada.']);
}