<?php
declare(strict_types=1);

/**
 * EcoBuesaco · Configuración central.
 * Este archivo vive en app/, que queda bloqueada al navegador por .htaccess.
 * Nunca subas credenciales reales a GitHub (el .gitignore ya lo evita).
 */

// ---- Entorno: 'desarrollo' muestra errores detallados; 'produccion' los oculta
const APP_ENTORNO = 'desarrollo';

// ---- Base de datos (valores por defecto de XAMPP)
const DB_HOST    = '127.0.0.1';
const DB_PUERTO  = 3306;
const DB_NOMBRE  = 'ecobuesaco';
const DB_USUARIO = 'root';
const DB_CLAVE   = '';          // XAMPP trae root sin contraseña; en producción usa un usuario propio

// ---- Reglas de negocio
const EDAD_MINIMA = 13;         // Edad mínima para registrarse (ajustable)

// ---- Fotografías
const FOTOS_MAX_POR_DESTINO = 5;
const FOTOS_MAX_BYTES       = 5 * 1024 * 1024;               // 5 MB por foto
const FOTOS_TIPOS           = ['image/jpeg', 'image/png', 'image/webp'];
const FOTOS_DIRECTORIO      = __DIR__ . '/../uploads/destinos';
const FOTOS_URL_BASE        = 'uploads/destinos/';           // ruta pública relativa

// ---- Sesión
const SESION_NOMBRE = 'ecobuesaco_sid';

// ---- Zona horaria y errores
date_default_timezone_set('America/Bogota');

if (APP_ENTORNO === 'desarrollo') {
    ini_set('display_errors', '0');   // Los errores van al log; la API siempre responde JSON limpio
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);
}
ini_set('log_errors', '1');

// ---- Recuperación de contraseña y correo
// Ajustes privados (SMTP, claves): van en app/config.local.php, que NO se sube a GitHub.
if (is_file(__DIR__ . '/config.local.php')) {
    require __DIR__ . '/config.local.php';
}
defined('APP_URL')              || define('APP_URL', 'http://localhost/EcoBuesaco');   // sin barra final
defined('RECUPERACION_MINUTOS') || define('RECUPERACION_MINUTOS', 60);
defined('CORREO_MODO')          || define('CORREO_MODO', 'archivo');                   // 'archivo' (pruebas) o 'smtp'
defined('CORREO_REMITENTE')     || define('CORREO_REMITENTE', 'no-responder@ecobuesaco.local');
defined('CORREO_NOMBRE')        || define('CORREO_NOMBRE', 'EcoBuesaco');
defined('SMTP_HOST')            || define('SMTP_HOST', '');
defined('SMTP_PUERTO')          || define('SMTP_PUERTO', 465);
defined('SMTP_SEGURIDAD')       || define('SMTP_SEGURIDAD', 'ssl');                    // 'ssl' (465) o 'tls' (587)
defined('SMTP_USUARIO')         || define('SMTP_USUARIO', '');
defined('SMTP_CLAVE')           || define('SMTP_CLAVE', '');