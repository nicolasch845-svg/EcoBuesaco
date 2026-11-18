# EcoBuesaco

Aplicación web de turismo ecológico y cultural de **Buesaco, Nariño**. Permite explorar destinos
(senderismo, cascadas, miradores, café y cultura) en lista y en mapa, leer guías, participar en una
comunidad y **proponer nuevos destinos con fotografías**, que un moderador revisa antes de publicar.

> Proyecto formativo del SENA · Programa: Programacion de Software· Ficha: 3147177 ·
> Aprendiz: Nicolas Chavez Quemac, Fabian Camilo Chavez Delgado, Andres Felipe Gomajoa Cordoba, Andres Felipe Ordoñez Cañares · Año: 2026

## Funcionalidades

**Para visitantes y usuarios**
- Explorar destinos con búsqueda (sin distinguir tildes ni mayúsculas) y filtros por categoría.
- Vista **Lista / Mapa** con marcadores por categoría (Leaflet + OpenStreetMap).
- Detalle del destino con galería de fotos, datos útiles, mapa y botones **Cómo llegar** (Google Maps y Waze).
- Registro e inicio de sesión (nombres, apellidos, usuario, correo, fecha de nacimiento y contraseña).
  No se solicitan documentos de identidad.
- Recuperación de contraseña por correo (enlace de un solo uso que vence en 1 hora).
- Favoritos, guías y comunidad (publicar, dar me gusta y eliminar las propias).
- **Proponer un destino**: datos, hasta 5 fotos con vista previa y ubicación elegida en el mapa.
- Diseño responsive: celular, tableta y computador, en cualquier orientación.

**Para moderadores y administradores**
- Panel de moderación: aprobar (con opción de destacar), rechazar con motivo, destacar y retirar destinos.
- Mapa y fotos de cada propuesta antes de aprobarla.
- Solo administrador: gestionar usuarios (rol y activación) y **categorías** (crear, editar con emoji y color,
  activar o desactivar y eliminar).

| Rol | Puede |
|---|---|
| `usuario` | Navegar, publicar, dar me gusta, guardar favoritos y proponer destinos |
| `moderador` | Lo anterior, más revisar propuestas y gestionar destinos |
| `admin` | Lo anterior, más usuarios y categorías |

## Tecnologías

- **Interfaz:** HTML5, CSS3 y JavaScript sin frameworks.
- **Servidor:** PHP 8.1 o superior (API JSON) con PDO.
- **Base de datos:** MySQL 8 / MariaDB 10.4 o superior.
- **Mapas:** [Leaflet](https://leafletjs.com) 1.9.4 (incluido en `libs/leaflet/`) y datos de OpenStreetMap.
- **Servidor web:** Apache (se usa `.htaccess`).

## Instalación local (Windows + XAMPP)

1. Instala [XAMPP](https://www.apachefriends.org) e inicia **Apache** y **MySQL**.
2. Clona o copia el proyecto en `C:\xampp\htdocs\EcoBuesaco`:
   ```bash
   git clone https://github.com/nicolasch845-svg/EcoBuesaco.git
   ```
3. En `http://localhost/phpmyadmin` importa los archivos de `sql/` **en este orden**:

   | Archivo | Qué hace | ¿Obligatorio? |
   |---|---|---|
   | `01_estructura.sql` | Crea la base `ecobuesaco`, las tablas y las 4 categorías | Sí |
   | `03_moderacion.sql` | Agrega columnas de moderación | Sí |
   | `04_recuperacion.sql` | Tabla de recuperación de contraseña | Sí |
   | `06_categorias.sql` | Color y estado de las categorías | Sí |
   | `07_destinos_buesaco.sql` | Destinos reales de Buesaco (solo texto) | Recomendado |
   | `02_datos_prueba.sql` | Datos ficticios de demostración | Opcional |
   | `05_coordenadas.sql` | Coordenadas aproximadas, **solo para los datos del `02`** | Opcional |

   > `01_estructura.sql` **borra las tablas** antes de crearlas. No lo vuelvas a ejecutar si ya tienes datos.
   > Si usas `02_datos_prueba.sql`, impórtalo **antes** del `07`, porque limpia las tablas.
4. Revisa `app/config.php` (usuario y contraseña de MySQL; XAMPP trae `root` sin contraseña).
5. Abre **http://localhost/EcoBuesaco/**.

### Crear el primer administrador

1. Regístrate desde la interfaz (**Perfil → Registrarse**).
2. En phpMyAdmin, pestaña SQL, ejecuta (cambia el correo por el tuyo):
   ```sql
   UPDATE usuarios SET rol = 'admin' WHERE correo = 'tu@correo.com';
   ```
3. Recarga la página. En **Perfil** aparecerá el botón **Panel de moderación**.

### Fotografías y coordenadas de los destinos

Las fotos **no están en el repositorio**: se suben desde la aplicación (**Proponer un destino**) y se aprueban en
el panel. Los destinos de `07_destinos_buesaco.sql` no traen coordenadas; se agregan con:

```sql
UPDATE destinos SET latitud = 1.3825, longitud = -77.1559 WHERE nombre = 'Nombre del destino';
```

(En Google Maps, clic derecho sobre el lugar y copia los dos números: primero la latitud y luego la longitud.)

## Estructura del proyecto

```
index.html          Interfaz (una sola página)
css/                Estilos
js/                 api-cliente · vistas · formularios · mapa · admin · app
api/                Enrutador y módulos: auth, destinos, guias, comunidad, favoritos, admin
app/                Configuración, conexión, utilidades y correo (bloqueada al navegador)
sql/                Estructura y datos (bloqueada al navegador)
libs/leaflet/       Librería de mapas (licencia BSD-2 incluida)
uploads/destinos/   Fotografías subidas (no se versionan)
```

**Capas:** `js/api-cliente.js` es el único archivo que llama al servidor; `js/vistas.js` solo dibuja HTML;
`js/formularios.js` valida; `js/app.js` coordina. En el servidor, `api/index.php` enruta con una lista blanca de módulos
y cada módulo valida el rol y los datos.

## Seguridad implementada

- Contraseñas con `password_hash` (bcrypt); inicio de sesión con el mismo mensaje exista o no el correo.
- Consultas PDO preparadas (contra inyección SQL) y escape de todo texto externo en el navegador (contra XSS).
- Token **CSRF** en toda petición que modifica datos; cookie de sesión `HttpOnly`, `SameSite=Lax` y `Secure` bajo HTTPS.
- Roles verificados **en el servidor** en cada acción; las cuentas desactivadas pierden el acceso.
- Fotos validadas por su **contenido real** (no por la extensión), con nombre aleatorio, límites de tamaño y
  cantidad, y sin ejecución de PHP en `uploads/`.
- Recuperación de contraseña: el código se guarda solo como **hash SHA-256**, vence en 1 hora, sirve una vez y
  la respuesta es igual exista o no la cuenta.
- Límite de intentos en registro, inicio de sesión y recuperación; `app/` y `sql/` bloqueadas al navegador.

## Límites conocidos

- **El mapa necesita internet:** las imágenes del mapa vienen de OpenStreetMap. Sin conexión, la app funciona
  y el mapa queda en gris.
- **El botón "Usar mi ubicación" solo funciona en `localhost` o con HTTPS.** Desde `http://192.168…` el
  navegador lo bloquea; en ese caso se toca el mapa para elegir el punto.
- **El correo no se envía realmente en local:** en modo `archivo` el mensaje se guarda en `app/correos/`.
  Para enviar correos reales, crea `app/config.local.php` (no se versiona) con `CORREO_MODO = 'smtp'` y tus datos SMTP.
- Al cambiar la contraseña, las sesiones ya abiertas en otros dispositivos siguen activas hasta cerrarse.
- Los límites de intentos son por sesión del navegador; en un servidor público convendría sumar uno por IP.
- Las guías se crean por SQL (aún no hay panel para administrarlas) y los destinos publicados se corrigen por SQL.

## Pruebas manuales realizadas

Registro e inicio de sesión · recuperación de contraseña (enlace, reutilización y correo inexistente) ·
proponer con fotos verticales y horizontales · aprobar, rechazar con motivo, retirar y destacar · cambio de roles ·
categorías (crear, editar, desactivar, eliminar y regla de mínimo una activa) · búsqueda y filtros · mapa en
Explorar, detalle y moderación · acceso denegado (403) a la API de administración con una cuenta normal.

## Antes de publicar en internet

- `APP_ENTORNO = 'produccion'` y usuario de MySQL propio con contraseña fuerte (nunca `root` sin clave).
- Definir `APP_URL` con el dominio real, activar HTTPS y configurar un correo SMTP.
- No ejecutar `01_estructura.sql` sobre una base con datos. Revisar que `/app/config.php` y `/sql/` den **403**.
- Cargar contenido real y fotografías propias o con permiso.

## Créditos

- Información de los atractivos: [Turismo Nariño](https://turismo.narino.gov.co/municipios/buesaco/) y
  [buesaco.co](https://www.buesaco.co/sitios-turisticos/). Verifica horarios y precios antes de visitar.
- Mapas: © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright) · Librería
  [Leaflet](https://leafletjs.com) (licencia BSD-2-Clause, en `libs/leaflet/LICENSE`).
- Las fotografías de cada destino pertenecen a quien las toma; este repositorio no incluye imágenes de terceros.