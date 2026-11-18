<?php
declare(strict_types=1);
require_once __DIR__ . '/../app/correo.php';

function manejar(string $accion): void
{
    match ($accion) {
        'registro'    => registrar(),
        'login'       => iniciar(),
        'logout'      => cerrar(),
        'olvide'      => olvide(),
        'restablecer' => restablecer(),
        'yo'          => exito(['usuario' => usuario_actual()]),
        default       => fallo('Acción no encontrada.', 404),
    };
}

/** Limita intentos por sesión para frenar fuerza bruta básica. */
function limitar_intentos(string $clave, int $max = 8, int $ventana = 600): void
{
    iniciar_sesion();
    $ahora = time();
    $intentos = array_filter($_SESSION['intentos'][$clave] ?? [], fn($t) => $t > $ahora - $ventana);
    if (count($intentos) >= $max) {
        fallo('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.', 429);
    }
    $intentos[] = $ahora;
    $_SESSION['intentos'][$clave] = $intentos;
}

function registrar(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    limitar_intentos('registro');
    $d = cuerpo_json();

    $nombres    = texto($d['nombres'] ?? '');
    $apellidos  = texto($d['apellidos'] ?? '');
    $usuario    = texto($d['usuario'] ?? '');
    $correo     = mb_strtolower(texto($d['correo'] ?? ''), 'UTF-8');
    $nacimiento = texto($d['nacimiento'] ?? '');
    $clave      = is_string($d['clave'] ?? null) ? $d['clave'] : '';

    $e = [];
    if (largo($nombres) < 2 || largo($nombres) > 80)     $e['nombres']   = 'Ingresa tus nombres (2 a 80 caracteres).';
    if (largo($apellidos) < 2 || largo($apellidos) > 80) $e['apellidos'] = 'Ingresa tus apellidos (2 a 80 caracteres).';
    if (!preg_match('/^[A-Za-z0-9_]{3,20}$/', $usuario)) $e['usuario']   = 'Usa 3 a 20 letras, números o guion bajo.';
    if (!correo_valido($correo))                         $e['correo']    = 'Ingresa un correo válido.';
    $edad = edad_desde($nacimiento);
    if ($nacimiento === '')            $e['nacimiento'] = 'Indica tu fecha de nacimiento.';
    elseif ($edad < 0)                 $e['nacimiento'] = 'La fecha no es válida.';
    elseif ($edad < EDAD_MINIMA)       $e['nacimiento'] = 'Debes tener al menos ' . EDAD_MINIMA . ' años.';
    elseif ($edad > 120)               $e['nacimiento'] = 'La fecha no es válida.';
    if (!contrasena_valida($clave))    $e['clave']      = 'De 8 a 72 caracteres, con letras y números.';
    if ($e) fallo('Revisa los campos marcados.', 422, $e);

    $st = db()->prepare('SELECT usuario, correo FROM usuarios WHERE usuario = ? OR correo = ?');
    $st->execute([$usuario, $correo]);
    foreach ($st->fetchAll() as $f) {
        if (strcasecmp($f['usuario'], $usuario) === 0) $e['usuario'] = 'Ese nombre de usuario ya está en uso.';
        if (strcasecmp($f['correo'], $correo) === 0)   $e['correo']  = 'Ese correo ya está registrado.';
    }
    if ($e) fallo('Revisa los campos marcados.', 409, $e);

    $st = db()->prepare(
        'INSERT INTO usuarios (nombres, apellidos, usuario, correo, fecha_nacimiento, password_hash)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $st->execute([$nombres, $apellidos, $usuario, $correo, $nacimiento, password_hash($clave, PASSWORD_DEFAULT)]);

    iniciar_sesion();
    session_regenerate_id(true);               // evita fijación de sesión
    $_SESSION['usuario_id'] = (int) db()->lastInsertId();
    exito(['usuario' => usuario_actual(), 'csrf' => token_csrf()], 201);
}

function iniciar(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    limitar_intentos('login');
    $d = cuerpo_json();

    $correo = mb_strtolower(texto($d['correo'] ?? ''), 'UTF-8');
    $clave  = is_string($d['clave'] ?? null) ? $d['clave'] : '';
    if (!correo_valido($correo) || $clave === '') {
        fallo('Ingresa tu correo y tu contraseña.', 422);
    }

    $st = db()->prepare('SELECT id, password_hash FROM usuarios WHERE correo = ? AND activo = 1');
    $st->execute([$correo]);
    $u = $st->fetch();

    // Mismo mensaje si el correo no existe o la clave es incorrecta (no revela cuentas)
    if (!$u || !password_verify($clave, $u['password_hash'])) {
        fallo('Correo o contraseña incorrectos.', 401);
    }

    if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
        db()->prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?')
            ->execute([password_hash($clave, PASSWORD_DEFAULT), $u['id']]);
    }

    iniciar_sesion();
    session_regenerate_id(true);
    unset($_SESSION['intentos']['login']);
    $_SESSION['usuario_id'] = (int) $u['id'];
    unset($_SESSION['csrf']);                  // token nuevo para la sesión nueva
    exito(['usuario' => usuario_actual(), 'csrf' => token_csrf()]);
}

function cerrar(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    iniciar_sesion();
    $_SESSION = [];
    session_destroy();
    iniciar_sesion();
    session_regenerate_id(true);
    exito(['csrf' => token_csrf()]);
}

/* POST ?r=auth&accion=olvide   JSON: { correo }
   Responde siempre igual, exista o no la cuenta, para no revelar quién está registrado. */
function olvide(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    limitar_intentos('olvide', 5, 900);

    $correo = mb_strtolower(texto(cuerpo_json()['correo'] ?? ''), 'UTF-8');
    if (!correo_valido($correo)) {
        fallo('Revisa los campos marcados.', 422, ['correo' => 'Ingresa un correo válido.']);
    }
    $respuesta = ['mensaje' => 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.'];

    db()->exec('DELETE FROM recuperaciones WHERE expira_en < NOW() - INTERVAL 1 DAY');   // limpieza

    $st = db()->prepare('SELECT id, nombres FROM usuarios WHERE correo = ? AND activo = 1');
    $st->execute([$correo]);
    $u = $st->fetch();
    if (!$u) {
        exito($respuesta);
    }

    // Máximo 2 solicitudes cada 10 minutos por cuenta (evita llenar el buzón de alguien)
    $st = db()->prepare('SELECT COUNT(*) FROM recuperaciones WHERE usuario_id = ? AND creado_en > NOW() - INTERVAL 10 MINUTE');
    $st->execute([$u['id']]);
    if ((int) $st->fetchColumn() >= 2) {
        exito($respuesta);
    }

    // Los enlaces anteriores sin usar dejan de servir
    db()->prepare('UPDATE recuperaciones SET usado_en = NOW() WHERE usuario_id = ? AND usado_en IS NULL')
        ->execute([$u['id']]);

    $token = bin2hex(random_bytes(32));   // 64 caracteres; solo viaja en el correo
    db()->prepare(
        'INSERT INTO recuperaciones (usuario_id, token_hash, expira_en)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ' . (int) RECUPERACION_MINUTOS . ' MINUTE))'
    )->execute([$u['id'], hash('sha256', $token)]);

    $enlace = rtrim(APP_URL, '/') . '/#restablecer=' . $token;
    $cuerpo = "Hola {$u['nombres']},\n\n"
        . "Recibimos una solicitud para restablecer la contraseña de tu cuenta de EcoBuesaco.\n"
        . "Abre este enlace para crear una nueva (vence en " . RECUPERACION_MINUTOS . " minutos y sirve una sola vez):\n\n"
        . "$enlace\n\n"
        . "Si no fuiste tú, ignora este mensaje: tu contraseña actual sigue funcionando.\n";

    if (!enviar_correo($correo, 'Restablecer tu contraseña de EcoBuesaco', $cuerpo)) {
        error_log('EcoBuesaco · no se pudo enviar el correo de recuperación al usuario ' . $u['id']);
    }
    exito($respuesta);
}

/* POST ?r=auth&accion=restablecer   JSON: { token, clave } */
function restablecer(): void
{
    if (metodo() !== 'POST') fallo('Método no permitido.', 405);
    limitar_intentos('restablecer', 10, 600);

    $d     = cuerpo_json();
    $token = is_string($d['token'] ?? null) ? $d['token'] : '';
    $clave = is_string($d['clave'] ?? null) ? $d['clave'] : '';

    if (!contrasena_valida($clave)) {
        fallo('Revisa los campos marcados.', 422, ['clave' => 'De 8 a 72 caracteres, con letras y números.']);
    }
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        fallo('El enlace no es válido o ya venció. Solicita uno nuevo.', 400);
    }

    $st = db()->prepare(
        'SELECT r.usuario_id FROM recuperaciones r
         JOIN usuarios u ON u.id = r.usuario_id AND u.activo = 1
         WHERE r.token_hash = ? AND r.usado_en IS NULL AND r.expira_en > NOW()'
    );
    $st->execute([hash('sha256', $token)]);
    $uid = $st->fetchColumn();
    if ($uid === false) {
        fallo('El enlace no es válido o ya venció. Solicita uno nuevo.', 400);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?')
            ->execute([password_hash($clave, PASSWORD_DEFAULT), $uid]);
        $pdo->prepare('UPDATE recuperaciones SET usado_en = NOW() WHERE usuario_id = ? AND usado_en IS NULL')
            ->execute([$uid]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    exito(['mensaje' => 'Contraseña actualizada. Ya puedes iniciar sesión.']);
}