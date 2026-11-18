# EcoBuesaco

Aplicación web de turismo ecológico en Buesaco, Nariño: destinos, guías,
comunidad y propuestas de nuevos lugares con fotografías.

**Tecnología:** HTML, CSS y JavaScript (sin frameworks) · PHP 8.1+ · MySQL / MariaDB.

## Instalación local (Windows + XAMPP)

1. Instala XAMPP e inicia **Apache** y **MySQL**.
2. Copia el proyecto en `C:\xampp\htdocs\EcoBuesaco`.
3. En `http://localhost/phpmyadmin` importa, en este orden:
   1. `sql/01_estructura.sql`
   2. `sql/02_datos_prueba.sql` (opcional, solo datos de demostración)
4. Revisa `app/config.php` (usuario y contraseña de MySQL).
5. Abre `http://localhost/EcoBuesaco/`.

## Estructura

```
index.html        Interfaz
css/              Estilos
js/               api-cliente · vistas · formularios · app
api/              Enrutador y módulos (auth, destinos, guias, comunidad, favoritos)
app/              Configuración, conexión y utilidades (bloqueada al navegador)
sql/              Estructura y datos de prueba (bloqueada al navegador)
uploads/          Fotografías subidas
```

## Administrador

Regístrate desde la interfaz y luego, en phpMyAdmin:

```sql
UPDATE usuarios SET rol = 'admin' WHERE correo = 'tu@correo.com';
```

Aprobar una propuesta pendiente (hasta que exista el panel de moderación):

```sql
UPDATE destinos SET estado = 'publicado' WHERE id = 9;
```

## Seguridad incluida

- Contraseñas con `password_hash`, consultas PDO preparadas y protección CSRF.
- Sesión con cookie `HttpOnly` y límite de intentos de acceso.
- Fotos validadas por su contenido real, con nombre aleatorio y sin ejecución de PHP en `uploads/`.
- Escape de todo texto externo en el navegador (contra XSS).
- No se solicitan documentos de identidad.

## Antes de publicar en internet

- En `app/config.php`: `APP_ENTORNO = 'produccion'`, usuario MySQL propio con contraseña
  y permisos solo sobre `ecobuesaco`.
- Usar HTTPS (la cookie de sesión se marca `secure` automáticamente).
- **No** ejecutar `01_estructura.sql` en producción: borra las tablas.
- Cambiar los textos de demostración por información real.

## Pendiente

- Panel de moderación de propuestas.
- Recuperación de contraseña.
- Google Maps (el evento `ecobuesaco:destino-abierto` y las columnas `latitud`/`longitud` ya están listos).