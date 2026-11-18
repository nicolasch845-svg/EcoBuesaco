<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/** Envía un correo de texto. Devuelve false si falla (el detalle queda en el log de PHP). */
function enviar_correo(string $para, string $asunto, string $texto): bool
{
    if (!filter_var($para, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $asunto)) {
        return false;   // evita inyección de cabeceras
    }
    return CORREO_MODO === 'smtp'
        ? correo_smtp($para, $asunto, $texto)
        : correo_archivo($para, $asunto, $texto);
}

/** Modo de pruebas: guarda el correo como archivo en app/correos/ (bloqueada al navegador). */
function correo_archivo(string $para, string $asunto, string $texto): bool
{
    $dir = __DIR__ . '/correos';
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        return false;
    }
    $archivo = $dir . '/' . date('Y-m-d_His') . '_' . bin2hex(random_bytes(3)) . '.txt';
    return file_put_contents($archivo, "Para: $para\nAsunto: $asunto\n\n$texto\n") !== false;
}

/** Envío real por SMTP con cifrado (SSL en 465 o STARTTLS en 587). */
function correo_smtp(string $para, string $asunto, string $texto): bool
{
    $ssl = SMTP_SEGURIDAD === 'ssl';
    $fp = @stream_socket_client(($ssl ? 'ssl://' : 'tcp://') . SMTP_HOST . ':' . SMTP_PUERTO, $codigo, $mensajeError, 15);
    if (!$fp) {
        error_log("EcoBuesaco · SMTP sin conexión: $mensajeError");
        return false;
    }
    stream_set_timeout($fp, 15);

    // Lee la respuesta completa (las líneas con "250-" continúan hasta una con "250 ")
    $leer = function () use ($fp): string {
        $resp = '';
        while (($linea = fgets($fp, 515)) !== false) {
            $resp .= $linea;
            if (strlen($linea) < 4 || $linea[3] === ' ') {
                break;
            }
        }
        return $resp;
    };
    $cmd = function (string $comando, string $espera) use ($fp, $leer): bool {
        fwrite($fp, $comando . "\r\n");
        return str_starts_with($leer(), $espera);
    };

    try {
        if (!str_starts_with($leer(), '220'))             throw new RuntimeException('saludo rechazado');
        if (!$cmd('EHLO localhost', '250'))               throw new RuntimeException('EHLO rechazado');
        if (!$ssl) {
            if (!$cmd('STARTTLS', '220'))                 throw new RuntimeException('STARTTLS rechazado');
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('no se pudo cifrar la conexión');
            }
            if (!$cmd('EHLO localhost', '250'))           throw new RuntimeException('EHLO TLS rechazado');
        }
        if (!$cmd('AUTH LOGIN', '334') || !$cmd(base64_encode(SMTP_USUARIO), '334') || !$cmd(base64_encode(SMTP_CLAVE), '235')) {
            throw new RuntimeException('autenticación rechazada');
        }
        if (!$cmd('MAIL FROM:<' . CORREO_REMITENTE . '>', '250')) throw new RuntimeException('remitente rechazado');
        if (!$cmd("RCPT TO:<$para>", '250'))              throw new RuntimeException('destinatario rechazado');
        if (!$cmd('DATA', '354'))                         throw new RuntimeException('DATA rechazado');

        $dominio = explode('@', CORREO_REMITENTE)[1] ?? 'localhost';
        $cabeceras = implode("\r\n", [
            'From: =?UTF-8?B?' . base64_encode(CORREO_NOMBRE) . '?= <' . CORREO_REMITENTE . '>',
            "To: <$para>",
            'Subject: =?UTF-8?B?' . base64_encode($asunto) . '?=',
            'Date: ' . date('r'),
            'Message-ID: <' . bin2hex(random_bytes(8)) . "@$dominio>",
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
        ]);
        fwrite($fp, $cabeceras . "\r\n\r\n" . chunk_split(base64_encode($texto), 76, "\r\n") . "\r\n.\r\n");
        if (!str_starts_with($leer(), '250'))             throw new RuntimeException('mensaje rechazado');

        $cmd('QUIT', '221');
        return true;
    } catch (Throwable $e) {
        error_log('EcoBuesaco · SMTP: ' . $e->getMessage());
        return false;
    } finally {
        fclose($fp);
    }
}