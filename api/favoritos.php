<?php
declare(strict_types=1);

function manejar(string $accion): void
{
    match ($accion) {
        'listar'   => favoritos_listar(),
        'alternar' => favoritos_alternar(),
        default    => fallo('Acción no encontrada.', 404),
    };
}

/* GET ?r=favoritos&accion=listar */
function favoritos_listar(): void
{
    $u  = exigir_usuario();
    $st = db()->prepare(
        "SELECT d.id, d.nombre, d.ubicacion, d.dificultad, d.duracion,
                c.slug AS categoria, c.nombre AS categoria_nombre,
                f.archivo, f.ancho, f.alto, f.orientacion
         FROM favoritos fv
         JOIN destinos d   ON d.id = fv.destino_id AND d.estado = 'publicado'
         JOIN categorias c ON c.id = d.categoria_id
         LEFT JOIN destino_fotos f ON f.destino_id = d.id AND f.es_portada = 1
         WHERE fv.usuario_id = ?
         ORDER BY fv.creado_en DESC"
    );
    $st->execute([$u['id']]);

    $items = array_map(fn(array $r) => [
        'id'               => (int) $r['id'],
        'nombre'           => $r['nombre'],
        'ubicacion'        => $r['ubicacion'],
        'dificultad'       => $r['dificultad'],
        'duracion'         => $r['duracion'],
        'categoria'        => $r['categoria'],
        'categoria_nombre' => $r['categoria_nombre'],
        'es_favorito'      => true,
        'imagen'           => $r['archivo'] !== null ? [
            'src' => FOTOS_URL_BASE . $r['archivo'],
            'w'   => (int) $r['ancho'], 'h' => (int) $r['alto'], 'orientacion' => $r['orientacion'],
        ] : null,
    ], $st->fetchAll());

    exito(['favoritos' => $items]);
}

/* POST ?r=favoritos&accion=alternar   JSON: { destino_id }  (agrega o quita) */
function favoritos_alternar(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    $u  = exigir_usuario();
    $id = (int) (cuerpo_json()['destino_id'] ?? 0);

    $st = db()->prepare("SELECT COUNT(*) FROM destinos WHERE id = ? AND estado = 'publicado'");
    $st->execute([$id]);
    if (!(int) $st->fetchColumn()) fallo('Destino no encontrado.', 404);

    $st = db()->prepare('DELETE FROM favoritos WHERE usuario_id = ? AND destino_id = ?');
    $st->execute([$u['id'], $id]);
    $activo = $st->rowCount() === 0;
    if ($activo) {
        db()->prepare('INSERT IGNORE INTO favoritos (usuario_id, destino_id) VALUES (?, ?)')
            ->execute([$u['id'], $id]);
    }
    exito(['es_favorito' => $activo]);
}