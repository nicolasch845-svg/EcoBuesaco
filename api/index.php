<?php
declare(strict_types=1);

require_once __DIR__ . '/../app/helpers.php';

/* Registro de módulos permitidos (lista blanca: nada fuera de aquí se puede cargar) */
const MODULOS = ['auth', 'destinos', 'guias', 'comunidad', 'favoritos', 'admin'];

try {
    $modulo = $_GET['r'] ?? '';
    $accion = $_GET['accion'] ?? '';

    // Entrega el token CSRF y el usuario actual al arrancar la aplicación
    if ($modulo === 'sesion') {
        $todas = array_map(fn(array $c) => [
            'slug'   => $c['slug'],
            'nombre' => $c['nombre'],
            'icono'  => $c['icono'],
            'color'  => $c['color'],
            'activa' => (bool) $c['activa'],
        ], db()->query('SELECT slug, nombre, icono, color, activa FROM categorias ORDER BY orden, id')->fetchAll());

        exito([
            'csrf'             => token_csrf(),
            'usuario'          => usuario_actual(),
            'categorias'       => array_values(array_filter($todas, fn(array $c) => $c['activa'])),   // las que se pueden elegir
            'categorias_todas' => $todas,                                                            // para dibujar iconos y colores de todas
            'config'           => [
                'edad_minima'  => EDAD_MINIMA,
                'fotos_max'    => FOTOS_MAX_POR_DESTINO,
                'fotos_max_mb' => FOTOS_MAX_BYTES / 1024 / 1024,
            ],
        ]);
    }

    if (!is_string($modulo) || !in_array($modulo, MODULOS, true)) {
        fallo('Recurso no encontrado.', 404);
    }
    if (!is_string($accion) || !preg_match('/^[a-z_]{1,30}$/', $accion)) {
        fallo('Acción no válida.', 400);
    }

    // Toda petición que no sea de lectura exige el token CSRF
    if (metodo() !== 'GET') {
        exigir_csrf();
    }

    require __DIR__ . "/$modulo.php";   // cada módulo define su función manejar($accion)
    manejar($accion);

    fallo('Acción no encontrada.', 404);

} catch (PDOException $e) {
    error_log('EcoBuesaco · BD: ' . $e->getMessage());
    fallo('Error interno del servidor.', 500);
} catch (Throwable $e) {
    error_log('EcoBuesaco · ' . $e->getMessage());
    fallo('Error interno del servidor.', 500);
}