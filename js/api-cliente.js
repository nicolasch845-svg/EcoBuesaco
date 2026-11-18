/* =====================================================================
   EcoBuesaco · Cliente de la API
   Único punto de contacto con el servidor (api/index.php).
   Maneja el token CSRF, los errores y el formato de las respuestas.
   ===================================================================== */
'use strict';

const Api = (() => {
  const BASE = 'api/index.php';
  let csrf = '';

  /** Error con el mensaje del servidor y, si existen, los errores por campo. */
  class ApiError extends Error {
    constructor(mensaje, estado = 0, campos = {}) {
      super(mensaje);
      this.name = 'ApiError';
      this.estado = estado;   // código HTTP (0 = sin conexión)
      this.campos = campos;   // { correo: 'Correo no válido.', ... }
    }
  }

  function construirUrl(recurso, accion, params = {}) {
    const q = new URLSearchParams({ r: recurso });
    if (accion) q.set('accion', accion);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    }
    return `${BASE}?${q}`;
  }

  /** Ejecuta la petición y devuelve el JSON, o lanza ApiError. */
  async function pedir(url, opciones = {}, reintentarCsrf = true) {
    let resp;
    try {
      resp = await fetch(url, { credentials: 'same-origin', ...opciones });
    } catch {
      throw new ApiError('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
    }

    let datos = null;
    try { datos = await resp.json(); } catch { /* respuesta no JSON */ }

    if (resp.ok && datos && datos.ok) return datos;

    // Token vencido: se renueva una sola vez y se repite la petición
    if (resp.status === 419 && reintentarCsrf) {
      await iniciar();
      const cabeceras = { ...(opciones.headers || {}), 'X-CSRF-Token': csrf };
      return pedir(url, { ...opciones, headers: cabeceras }, false);
    }

    throw new ApiError(
      (datos && datos.error) || 'Ocurrió un error inesperado. Inténtalo de nuevo.',
      resp.status,
      (datos && datos.campos) || {}
    );
  }

  const get = (recurso, accion, params) => pedir(construirUrl(recurso, accion, params));

  const post = (recurso, accion, cuerpo = {}, params) =>
    pedir(construirUrl(recurso, accion, params), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify(cuerpo),
    });

  /** Envío con archivos (FormData). No se fija Content-Type: el navegador agrega el límite. */
  const postFormulario = (recurso, accion, formData) =>
    pedir(construirUrl(recurso, accion), {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrf },
      body: formData,
    });

  /** Arranque: obtiene token, usuario actual, categorías y límites de configuración. */
  async function iniciar() {
    const r = await get('sesion');
    csrf = r.csrf;
    return r;
  }

  return {
    ApiError,
    iniciar,

    auth: {
      registrar:   (datos) => post('auth', 'registro', datos).then(guardarToken),
      entrar:      (datos) => post('auth', 'login', datos).then(guardarToken),
      salir:       ()      => post('auth', 'logout').then(guardarToken),
      olvide:      (correo)       => post('auth', 'olvide', { correo }),
      restablecer: (token, clave) => post('auth', 'restablecer', { token, clave }),
    },

    destinos: {
      listar:        (filtros = {}) => get('destinos', 'listar', filtros),
      detalle:       (id)           => get('destinos', 'detalle', { id }),
      misPropuestas: ()             => get('destinos', 'mis_propuestas'),
      proponer:      (formData)     => postFormulario('destinos', 'proponer', formData),
    },

    guias: {
      listar:  ()   => get('guias', 'listar'),
      detalle: (id) => get('guias', 'detalle', { id }),
    },

    comunidad: {
      listar:   (params = {}) => get('comunidad', 'listar', params),
      publicar: (texto, destinoId) => post('comunidad', 'publicar', { texto, destino_id: destinoId || null }),
      meGusta:  (id) => post('comunidad', 'me_gusta', { id }),
      eliminar: (id) => post('comunidad', 'eliminar', { id }),
    },

    favoritos: {
      listar:   ()   => get('favoritos', 'listar'),
      alternar: (id) => post('favoritos', 'alternar', { destino_id: id }),
    },

    admin: {
      resumen:       ()                         => get('admin', 'resumen'),
      pendientes:    ()                         => get('admin', 'pendientes'),
      publicados:    ()                         => get('admin', 'publicados'),
      revisar:       (id, decision, extra = {}) => post('admin', 'revisar', { id, decision, ...extra }),
      destacar:      (id, destacado)            => post('admin', 'destacar', { id, destacado }),
      retirar:       (id, motivo)               => post('admin', 'retirar', { id, motivo }),
      usuarios:      ()                         => get('admin', 'usuarios'),
      cambiarRol:    (id, rol)                  => post('admin', 'cambiar_rol', { id, rol }),
      cambiarActivo: (id, activo)               => post('admin', 'cambiar_activo', { id, activo }),
      categorias:        ()            => get('admin', 'categorias'),
      crearCategoria:    (datos)       => post('admin', 'crear_categoria', datos),
      editarCategoria:   (id, datos)   => post('admin', 'editar_categoria', { id, ...datos }),
      activarCategoria:  (id, activa)  => post('admin', 'activar_categoria', { id, activa }),
      eliminarCategoria: (id)          => post('admin', 'eliminar_categoria', { id }),
    },
  };
  /** Al entrar, registrarse o salir el servidor entrega un token nuevo. */
  function guardarToken(r) {
    if (r && r.csrf) csrf = r.csrf;
    return r;
  }
})();