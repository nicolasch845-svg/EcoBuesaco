<?php
declare(strict_types=1);

function manejar(string $accion): void
{
    match ($accion) {
        'listar'  => guias_listar(),
        'detalle' => guias_detalle(),
        default   => fallo('Acción no encontrada.', 404),
    };
}

function guias_formatear(array $g, bool $conPasos): array
{
    $r = [
        'id'      => (int) $g['id'],
        'titulo'  => $g['titulo'],
        'resumen' => $g['resumen'],
        'autor'   => $g['autor'],
        'minutos' => (int) $g['minutos_lectura'],
    ];
    if ($conPasos) {
        $r['pasos'] = lineas_a_lista($g['pasos']);
    }
    return $r;
}

/* GET ?r=guias&accion=listar */
function guias_listar(): void
{
    $filas = db()->query(
        'SELECT id, titulo, resumen, autor, minutos_lectura
         FROM guias WHERE publicada = 1 ORDER BY creado_en DESC, id DESC'
    )->fetchAll();
    exito(['guias' => array_map(fn($g) => guias_formatear($g, false), $filas)]);
}

/* GET ?r=guias&accion=detalle&id=1 */
function guias_detalle(): void
{
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        fallo('Guía no válida.', 400);
    }
    $st = db()->prepare('SELECT * FROM guias WHERE id = ? AND publicada = 1');
    $st->execute([$id]);
    $g = $st->fetch();
    if (!$g) {
        fallo('Guía no encontrada.', 404);
    }
    exito(['guia' => guias_formatear($g, true)]);
}