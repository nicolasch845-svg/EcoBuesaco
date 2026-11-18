<?php
declare(strict_types=1);

function manejar(string $accion): void
{
    match ($accion) {
        'listar'    => comunidad_listar(),
        'publicar'  => comunidad_publicar(),
        'me_gusta'  => comunidad_me_gusta(),
        'eliminar'  => comunidad_eliminar(),
        default     => fallo('Acción no encontrada.', 404),
    };
}

function comunidad_formatear(array $p): array
{
    return [
        'id'          => (int) $p['id'],
        'autor'       => trim($p['nombres'] . ' ' . $p['apellidos']),
        'usuario'     => $p['usuario'],
        'texto'       => $p['texto'],
        'cuando'      => hace_tiempo($p['creado_en']),
        'destino_id'  => $p['destino_id'] !== null ? (int) $p['destino_id'] : null,
        'destino'     => $p['destino_nombre'],
        'me_gusta'    => (int) $p['total_likes'],
        'di_me_gusta' => (bool) $p['di_like'],
        'es_mia'      => (bool) $p['es_mia'],
    ];
}

/* GET ?r=comunidad&accion=listar&limite=20&pagina=1 */
function comunidad_listar(): void
{
    $uid    = usuario_actual()['id'] ?? 0;
    $limite = max(1, min(50, (int) ($_GET['limite'] ?? 20)));
    $pagina = max(1, (int) ($_GET['pagina'] ?? 1));

    $st = db()->prepare(
        "SELECT p.id, p.texto, p.creado_en, p.destino_id,
                u.nombres, u.apellidos, u.usuario,
                d.nombre AS destino_nombre,
                (SELECT COUNT(*) FROM me_gusta m WHERE m.publicacion_id = p.id) AS total_likes,
                (SELECT COUNT(*) FROM me_gusta m WHERE m.publicacion_id = p.id AND m.usuario_id = :uid1) AS di_like,
                (p.usuario_id = :uid2) AS es_mia
         FROM publicaciones p
         JOIN usuarios u ON u.id = p.usuario_id
         LEFT JOIN destinos d ON d.id = p.destino_id AND d.estado = 'publicado'
         WHERE p.visible = 1
         ORDER BY p.creado_en DESC, p.id DESC
         LIMIT :lim OFFSET :off"
    );
    $st->bindValue(':uid1', $uid, PDO::PARAM_INT);
    $st->bindValue(':uid2', $uid, PDO::PARAM_INT);
    $st->bindValue(':lim', $limite, PDO::PARAM_INT);
    $st->bindValue(':off', ($pagina - 1) * $limite, PDO::PARAM_INT);
    $st->execute();

    exito(['publicaciones' => array_map('comunidad_formatear', $st->fetchAll())]);
}

/* POST ?r=comunidad&accion=publicar   JSON: { texto, destino_id? } */
function comunidad_publicar(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    $u = exigir_usuario();

    // Máximo 10 publicaciones por hora por usuario
    $st = db()->prepare('SELECT COUNT(*) FROM publicaciones WHERE usuario_id = ? AND creado_en > NOW() - INTERVAL 1 HOUR');
    $st->execute([$u['id']]);
    if ((int) $st->fetchColumn() >= 10) {
        fallo('Has publicado muchas veces seguidas. Inténtalo más tarde.', 429);
    }

    $d     = cuerpo_json();
    $texto = texto_largo($d['texto'] ?? '');
    $dest  = isset($d['destino_id']) && $d['destino_id'] !== '' ? (int) $d['destino_id'] : null;

    $e = [];
    if (largo($texto) < 3 || largo($texto) > 1000) {
        $e['texto'] = 'La publicación debe tener entre 3 y 1000 caracteres.';
    }
    if ($dest !== null) {
        $st = db()->prepare("SELECT COUNT(*) FROM destinos WHERE id = ? AND estado = 'publicado'");
        $st->execute([$dest]);
        if (!(int) $st->fetchColumn()) {
            $e['destino_id'] = 'El destino seleccionado no existe.';
        }
    }
    if ($e) fallo('Revisa los campos marcados.', 422, $e);

    db()->prepare('INSERT INTO publicaciones (usuario_id, destino_id, texto) VALUES (?, ?, ?)')
        ->execute([$u['id'], $dest, $texto]);

    exito(['id' => (int) db()->lastInsertId(), 'mensaje' => 'Publicación creada.'], 201);
}

/* POST ?r=comunidad&accion=me_gusta   JSON: { id }  (alterna: da o quita el me gusta) */
function comunidad_me_gusta(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    $u  = exigir_usuario();
    $id = (int) (cuerpo_json()['id'] ?? 0);

    $st = db()->prepare('SELECT COUNT(*) FROM publicaciones WHERE id = ? AND visible = 1');
    $st->execute([$id]);
    if (!(int) $st->fetchColumn()) fallo('Publicación no encontrada.', 404);

    $st = db()->prepare('DELETE FROM me_gusta WHERE usuario_id = ? AND publicacion_id = ?');
    $st->execute([$u['id'], $id]);
    $activo = $st->rowCount() === 0;                 // no existía: se agrega
    if ($activo) {
        db()->prepare('INSERT IGNORE INTO me_gusta (usuario_id, publicacion_id) VALUES (?, ?)')
            ->execute([$u['id'], $id]);
    }

    $st = db()->prepare('SELECT COUNT(*) FROM me_gusta WHERE publicacion_id = ?');
    $st->execute([$id]);
    exito(['di_me_gusta' => $activo, 'me_gusta' => (int) $st->fetchColumn()]);
}

/* POST ?r=comunidad&accion=eliminar   JSON: { id }  (dueño o moderador) */
function comunidad_eliminar(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    $u  = exigir_usuario();
    $id = (int) (cuerpo_json()['id'] ?? 0);

    $st = db()->prepare('SELECT usuario_id FROM publicaciones WHERE id = ? AND visible = 1');
    $st->execute([$id]);
    $dueno = $st->fetchColumn();
    if ($dueno === false) fallo('Publicación no encontrada.', 404);

    if ((int) $dueno !== $u['id'] && !in_array($u['rol'], ['moderador', 'admin'], true)) {
        fallo('No tienes permiso para eliminar esta publicación.', 403);
    }
    db()->prepare('UPDATE publicaciones SET visible = 0 WHERE id = ?')->execute([$id]);
    exito(['mensaje' => 'Publicación eliminada.']);
}