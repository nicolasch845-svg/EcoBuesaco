<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Devuelve una única conexión PDO reutilizable.
 * Todas las consultas del proyecto usan parámetros preparados.
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, DB_PUERTO, DB_NOMBRE);

    try {
        $pdo = new PDO($dsn, DB_USUARIO, DB_CLAVE, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,   // preparación real: protege contra inyección SQL
        ]);
    } catch (PDOException $e) {
        error_log('EcoBuesaco · fallo de conexión: ' . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'No se pudo conectar con la base de datos.']);
        exit;
    }

    return $pdo;
}