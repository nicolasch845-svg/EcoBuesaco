<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

/* ===================== Respuestas JSON ===================== */

function responder(array $datos, int $codigo = 200): never
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function exito(array $datos = [], int $codigo = 200): never
{
    responder(['ok' => true] + $datos, $codigo);
}

/** $campos: errores por campo, p. ej. ['correo' => 'Correo no válido.'] */
function fallo(string $mensaje, int $codigo = 400, array $campos = []): never
{
    $r = ['ok' => false, 'error' => $mensaje];
    if ($campos) {
        $r['campos'] = $campos;
    }
    responder($r, $codigo);
}

/* ===================== Sesión y CSRF ===================== */

function iniciar_sesion(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name(SESION_NOMBRE);
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => !empty($_SERVER['HTTPS']),
        'httponly' => true,           // el JavaScript no puede leer la cookie
        'samesite' => 'Lax',
    ]);
    session_start();
}

function usuario_actual(): ?array
{
    iniciar_sesion();
    if (empty($_SESSION['usuario_id'])) {
        return null;
    }
    static $cache = null;
    if ($cache !== null && $cache['id'] === (int) $_SESSION['usuario_id']) {
        return $cache;
    }
    $st = db()->prepare(
        'SELECT id, nombres, apellidos, usuario, correo, rol
         FROM usuarios WHERE id = ? AND activo = 1'
    );
    $st->execute([(int) $_SESSION['usuario_id']]);
    $u = $st->fetch();
    if (!$u) {
        unset($_SESSION['usuario_id']);
        return null;
    }
    $u['id'] = (int) $u['id'];
    return $cache = $u;
}

function exigir_usuario(): array
{
    return usuario_actual() ?? fallo('Debes iniciar sesión.', 401);
}

function exigir_rol(string ...$roles): array
{
    $u = exigir_usuario();
    if (!in_array($u['rol'], $roles, true)) {
        fallo('No tienes permiso para esta acción.', 403);
    }
    return $u;
}

function token_csrf(): string
{
    iniciar_sesion();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

/** Toda petición que modifica datos debe traer el token en la cabecera X-CSRF-Token. */
function exigir_csrf(): void
{
    $enviado = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($enviado) || !hash_equals(token_csrf(), $enviado)) {
        fallo('Sesión de seguridad inválida. Recarga la página.', 419);
    }
}

/* ===================== Entrada de datos ===================== */

function metodo(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

/** Cuerpo JSON de la petición, como arreglo. */
function cuerpo_json(): array
{
    $crudo = file_get_contents('php://input');
    if ($crudo === false || $crudo === '') {
        return [];
    }
    $datos = json_decode($crudo, true);
    if (!is_array($datos)) {
        fallo('El cuerpo de la petición no es un JSON válido.');
    }
    return $datos;
}

function texto(mixed $valor): string
{
    return is_string($valor) ? trim(preg_replace('/\s+/u', ' ', $valor) ?? '') : '';
}

/** Igual que texto() pero conserva los saltos de línea (descripciones largas). */
function texto_largo(mixed $valor): string
{
    return is_string($valor) ? trim(str_replace("\r\n", "\n", $valor)) : '';
}

function largo(string $s): int
{
    return mb_strlen($s, 'UTF-8');
}

/* ===================== Validaciones ===================== */

function correo_valido(string $c): bool
{
    return filter_var($c, FILTER_VALIDATE_EMAIL) !== false && largo($c) <= 150;
}

function edad_desde(string $fechaIso): int
{
    $f = DateTime::createFromFormat('!Y-m-d', $fechaIso);
    if (!$f || $f->format('Y-m-d') !== $fechaIso || $f > new DateTime('today')) {
        return -1;
    }
    return $f->diff(new DateTime('today'))->y;
}

function contrasena_valida(string $c): bool
{
    return strlen($c) >= 8 && strlen($c) <= 72          // 72 es el límite de bcrypt
        && preg_match('/[A-Za-z]/', $c) === 1
        && preg_match('/\d/', $c) === 1;
}

/* ===================== Datos de dominio ===================== */

function categoria_id_por_slug(string $slug): ?int
{
    $st = db()->prepare('SELECT id FROM categorias WHERE slug = ? AND activa = 1');
    $st->execute([$slug]);
    $id = $st->fetchColumn();
    return $id === false ? null : (int) $id;
}

/** Convierte "una línea por elemento" en lista. */
function lineas_a_lista(?string $t): array
{
    if ($t === null || trim($t) === '') {
        return [];
    }
    return array_values(array_filter(array_map('trim', explode("\n", $t)), 'strlen'));
}

function hace_tiempo(string $fecha): string
{
    $seg = max(0, time() - (strtotime($fecha) ?: time()));
    if ($seg < 3600)   { $n = max(1, intdiv($seg, 60));      return "hace $n min"; }
    if ($seg < 86400)  { $n = intdiv($seg, 3600);            return "hace $n h"; }
    if ($seg < 604800) { $n = intdiv($seg, 86400);           return $n === 1 ? 'hace 1 día' : "hace $n días"; }
    $n = intdiv($seg, 604800);
    return $n === 1 ? 'hace 1 semana' : "hace $n semanas";
}