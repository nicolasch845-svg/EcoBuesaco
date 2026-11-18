/* =====================================================================
   EcoBuesaco · Vistas
   Funciones puras: reciben datos y devuelven HTML. Sin fetch ni estado.
   Todo texto externo se escapa con esc() para evitar XSS.
   ===================================================================== */
'use strict';

const Vistas = (() => {
  /* ---------- Utilidades ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const iniciales = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  /* Categorías dinámicas: app.js las entrega con Vistas.configurar() al arrancar */
  let categoriasTodas = [];
  const CAT_PREDETERMINADA = { icono: '📍', color: '#2f6048' };
  const colorOk = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : CAT_PREDETERMINADA.color);
  const infoCategoria = (slug) => categoriasTodas.find((c) => c.slug === slug) || { slug, ...CAT_PREDETERMINADA };
  const iconoDe = (slug) => infoCategoria(slug).icono;
  const configurar = (lista) => { categoriasTodas = Array.isArray(lista) ? lista : []; };

  /** Texto oscuro sobre colores claros y blanco sobre colores oscuros (mantiene el aspecto actual). */
  function textoSobre(hex) {
    const h = colorOk(hex).slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1f2d26' : '#ffffff';
  }
  const estiloCategoria = (hex) => `background:${colorOk(hex)};color:${textoSobre(hex)}`;

  /** Foto con proporciones reales (width/height evitan saltos de diseño) o fondo con icono si no hay foto. */
  function imagen(img, alt, categoria) {
    if (!img) return `<div class="sin-foto" role="img" aria-label="${esc(alt)} (sin foto)">${iconoDe(categoria)}</div>`;
    return `<img src="${esc(img.src)}" width="${img.w}" height="${img.h}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  }

  /* ---------- Estados ---------- */
  const cargando = (n = 4) =>
    `<div class="grid" style="margin-top:20px" aria-busy="true" aria-label="Cargando">${'<div class="card skeleton"></div>'.repeat(n)}</div>`;

  const errorCarga = (mensaje) =>
    `<div class="state" role="alert" style="margin-top:20px"><div class="big">⚠️</div>
     <h3>No pudimos cargar la información</h3><p>${esc(mensaje)}</p>
     <button class="btn" data-accion="reintentar">Reintentar</button></div>`;

  const vacio = (icono, titulo, texto, boton = '') =>
    `<div class="state"><div class="big">${icono}</div><h3>${esc(titulo)}</h3><p>${esc(texto)}</p>${boton}</div>`;

  /* ---------- Tarjetas ---------- */
  function botonFavorito(d) {
    const on = !!d.es_favorito;
    return `<button class="fav" data-fav="${d.id}" aria-pressed="${on}"
      aria-label="${on ? 'Quitar de' : 'Guardar en'} favoritos: ${esc(d.nombre)}">${on ? '♥' : '♡'}</button>`;
  }

  const tarjetaDestacada = (d) =>
    `<article class="card feature">
      <button class="card-main" data-abrir="${d.id}" aria-label="Abrir ${esc(d.nombre)}">
        <div class="media">${imagen(d.imagen, d.nombre, d.categoria)}</div>
        <div class="overlay"><span class="tag">${esc(d.categoria_nombre)}</span><h3>${esc(d.nombre)}</h3><span class="plus" aria-hidden="true">+</span></div>
      </button>${botonFavorito(d)}</article>`;

  const tarjeta = (d) =>
    `<article class="card">
      <button class="card-main" data-abrir="${d.id}">
        <div class="media">${imagen(d.imagen, d.nombre, d.categoria)}</div>
        <div class="body"><span class="tag">${esc(d.categoria_nombre)}</span><h3>${esc(d.nombre)}</h3>
        <p>${esc(d.ubicacion)}</p></div>
      </button>${botonFavorito(d)}</article>`;

  function publicacion(p, puedeInteractuar) {
    const on = p.di_me_gusta;
    return `<article class="post">
      <div class="avatar" aria-hidden="true">${esc(iniciales(p.autor))}</div>
      <div>
        <strong>${esc(p.autor)}</strong> <small>· ${esc(p.cuando)}${p.destino ? ' · ' + esc(p.destino) : ''}</small>
        <p>${esc(p.texto)}</p>
        <div class="post-actions">
          <button class="like" data-like="${p.id}" aria-pressed="${on}" aria-label="Me gusta">♥ ${p.me_gusta}</button>
          ${p.es_mia ? `<button class="link-btn" data-eliminar-pub="${p.id}">Eliminar</button>` : ''}
        </div>
      </div></article>`;
  }

  /* ---------- Pantallas ---------- */
  function inicio({ destacados, categorias, publicaciones }) {
    return `
      <h2>Destinos destacados</h2>
      ${destacados.length
        ? `<div class="rail">${destacados.map(tarjetaDestacada).join('')}</div>`
        : vacio('🌄', 'Aún no hay destinos destacados', 'Vuelve pronto.')}
      <h2>Categorías</h2>
      <div class="cats">${categorias.map((c) =>
        `<button class="cat" style="${estiloCategoria(c.color)}" data-categoria="${esc(c.slug)}"><span class="cat-ico" aria-hidden="true">${esc(c.icono)}</span>${esc(c.nombre)}</button>`).join('')}</div>
      <h2>Comunidad</h2>
      ${publicaciones.length
        ? `<div class="stack">${publicaciones.slice(0, 2).map((p) => publicacion(p)).join('')}</div>`
        : vacio('💬', 'Todavía no hay publicaciones', 'Sé la primera persona en compartir una experiencia.')}
      <div class="btn-row"><button class="btn gold" data-accion="proponer">+ Proponer un destino</button></div>`;
  }

  function explorar({ destinos, total, categorias, categoriaActiva, consulta, modo = 'lista' }) {
    const chips = [{ slug: 'all', nombre: 'Todos' }, ...categorias]
      .map((c) => `<button class="chip" data-categoria="${esc(c.slug)}" aria-pressed="${categoriaActiva === c.slug}">${esc(c.nombre)}</button>`)
      .join('');
    const conUbicacion = destinos.filter((d) => d.lat !== null && d.lng !== null).length;
    const sinUbicacion = destinos.length - conUbicacion;
    const botonModo = (id, texto) => `<button data-modo="${id}" aria-pressed="${modo === id}">${texto}</button>`;

    let contenido;
    if (!destinos.length) {
      contenido = vacio('🔎', 'Sin resultados', 'Prueba con otra palabra o quita los filtros.',
        '<button class="btn" data-accion="limpiar">Limpiar filtros</button>');
    } else if (modo === 'mapa') {
      contenido = `<div id="mapaExplorar" class="mapa" role="region" aria-label="Mapa de destinos"></div>
        ${sinUbicacion ? `<p class="muted">${sinUbicacion} destino(s) todavía no tienen ubicación y no aparecen en el mapa.</p>` : ''}`;
    } else {
      contenido = `<div class="grid">${destinos.map(tarjeta).join('')}</div>`;
    }

    return `
      <h2>Explorar destinos</h2>
      <div class="chips" role="group" aria-label="Filtrar por categoría">${chips}</div>
      <div class="mapa-barra" style="justify-content:space-between">
        <p class="count" aria-live="polite" style="margin:0">${total} destino(s)${consulta ? ` para “${esc(consulta)}”` : ''}</p>
        <div class="seg" role="group" aria-label="Forma de verlos" style="margin:0;max-width:300px">
          ${botonModo('lista', '☰ Lista')}${botonModo('mapa', '🗺️ Mapa')}
        </div>
      </div>
      ${contenido}
      <div class="btn-row"><button class="btn gold" data-accion="proponer">+ Proponer un destino</button></div>`;
  }

  function guias({ pestana, guias: lista, publicaciones, usuario, destinos }) {
    const g = pestana === 'guias';
    let contenido;
    if (g) {
      contenido = lista.length
        ? lista.map((x) => `<button class="guide" data-guia="${x.id}"><div class="avatar" aria-hidden="true">📖</div>
            <div><h3>${esc(x.titulo)}</h3><p>${esc(x.resumen)}</p><small>${esc(x.autor)} · ${x.minutos} min de lectura</small></div></button>`).join('')
        : vacio('📖', 'No hay guías todavía', 'Pronto publicaremos nuevas guías.');
    } else {
      contenido = redactar(usuario, destinos) +
        (publicaciones.length ? publicaciones.map((p) => publicacion(p)).join('')
          : vacio('💬', 'Todavía no hay publicaciones', 'Sé la primera persona en compartir una experiencia.'));
    }
    return `
      <h2>Guías y comunidad</h2>
      <div class="seg" role="group" aria-label="Sección">
        <button data-pestana="guias" aria-pressed="${g}">Guías</button>
        <button data-pestana="comunidad" aria-pressed="${!g}">Comunidad</button>
      </div>
      <div class="stack">${contenido}</div>`;
  }

  /** Cuadro para publicar; si no hay sesión invita a entrar. */
  function redactar(usuario, destinos) {
    if (!usuario) {
      return `<div class="state">Inicia sesión para publicar y dar me gusta.
        <div class="btn-row" style="justify-content:center"><button class="btn" data-ir="perfil">Entrar o registrarme</button></div></div>`;
    }
    return `<form class="compose" id="formPublicar" novalidate>
      <label for="pub-texto" class="muted">Comparte tu experiencia</label>
      <textarea id="pub-texto" name="texto" rows="3" maxlength="1000" placeholder="¿Qué tal estuvo tu visita?"></textarea>
      <span class="err" data-err="texto"></span>
      <div class="row">
        <select name="destino_id" aria-label="Destino relacionado (opcional)">
          <option value="">Sin destino</option>
          ${destinos.map((d) => `<option value="${d.id}">${esc(d.nombre)}</option>`).join('')}
        </select>
        <button class="btn" type="submit">Publicar</button>
      </div></form>`;
  }

  function perfil({ usuario, favoritos, propuestas, modoAuth, edadMinima }) {
    if (!usuario) return autenticacion(modoAuth, edadMinima);

    const etiqueta = { pendiente: 'En revisión', publicado: 'Publicado', rechazado: 'Rechazado' };
    return `
      <div class="profile-head"><div class="avatar">${esc(iniciales(usuario.nombres + ' ' + usuario.apellidos))}</div>
        <div><h3>${esc(usuario.nombres)} ${esc(usuario.apellidos)}</h3>
        <div class="muted">@${esc(usuario.usuario)} · ${esc(usuario.correo)}</div>
        ${usuario.rol !== 'usuario' ? `<span class="tag">${usuario.rol === 'admin' ? 'Administrador' : 'Moderador'}</span>` : ''}</div></div>

      <h2>Mis favoritos</h2>
      ${favoritos.length ? `<div class="grid">${favoritos.map(tarjeta).join('')}</div>`
        : vacio('♡', 'Aún no tienes favoritos', 'Toca ♡ en cualquier destino para guardarlo.')}

      <h2>Mis propuestas</h2>
      ${propuestas.length
        ? `<div class="stack">${propuestas.map((p) => `<article class="post">
            <div class="avatar" aria-hidden="true">📍</div>
            <div><strong>${esc(p.nombre)}</strong>
              <div><span class="tag ${esc(p.estado)}">${etiqueta[p.estado] || esc(p.estado)}</span></div>
              <div class="muted">${esc(p.categoria_nombre)} · ${esc(p.ubicacion)}</div>
              <small>${esc(p.creado)} · ${p.total_fotos} foto(s)</small>
              ${p.estado === 'rechazado' && p.motivo_rechazo ? `<p class="err">Motivo: ${esc(p.motivo_rechazo)}</p>` : ''}
            </div></article>`).join('')}</div>`
        : vacio('📍', 'Todavía no has propuesto destinos', 'Conoces un lugar especial? Compártelo.')}

      <div class="btn-row">
        <button class="btn gold" data-accion="proponer">+ Proponer un destino</button>
        ${usuario.rol !== 'usuario' ? '<button class="btn" data-ir="admin">Panel de moderación</button>' : ''}
        <button class="btn ghost" data-accion="salir">Cerrar sesión</button>
      </div>`;
  }

  function autenticacion(modo, edadMinima) {
    const hoy = new Date().toISOString().slice(0, 10);
    const campo = (id, etiqueta, nombre, tipo = 'text', extra = '') =>
      `<div class="field"><label for="${id}">${etiqueta}</label>
       <input id="${id}" name="${nombre}" type="${tipo}" ${extra}><span class="err" data-err="${nombre}"></span></div>`;

    // Paso 1 de la recuperación: pedir el enlace
    if (modo === 'olvide') {
      return `
      <h2>Recuperar contraseña</h2>
      <p class="muted">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.</p>
      <form id="formOlvide" class="auth-form" novalidate style="max-width:460px">
        ${campo('o-correo', 'Correo electrónico', 'correo', 'email', 'autocomplete="email"')}
        <p class="err" data-err="_general" role="alert"></p>
        <div class="btn-row" style="margin-top:0">
          <button class="btn" type="submit">Enviar enlace</button>
          <button class="btn ghost" type="button" data-auth="login">Volver</button>
        </div>
      </form>`;
    }

    // Confirmación (misma respuesta exista o no la cuenta)
    if (modo === 'olvide_ok') {
      return `
      <h2>Revisa tu correo</h2>
      <div class="state"><div class="big">📧</div><h3>Solicitud enviada</h3>
        <p>Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Vence en 1 hora. Revisa también la carpeta de spam.</p>
        <button class="btn" data-auth="login">Volver a iniciar sesión</button></div>`;
    }

    // Paso 2: elegir la contraseña nueva (se llega desde el enlace del correo)
    if (modo === 'restablecer') {
      return `
      <h2>Nueva contraseña</h2>
      <form id="formRestablecer" class="auth-form" novalidate style="max-width:460px">
        ${campo('n-clave', 'Contraseña nueva', 'clave', 'password', 'autocomplete="new-password"')}
        ${campo('n-confirmar', 'Repite la contraseña', 'confirmar', 'password', 'autocomplete="new-password"')}
        <p class="muted" style="margin-top:0">De 8 a 72 caracteres, con letras y números.</p>
        <p class="err" data-err="_general" role="alert"></p>
        <div class="btn-row" style="margin-top:0">
          <button class="btn" type="submit">Guardar contraseña</button>
          <button class="btn ghost" type="button" data-auth="olvide">Pedir otro enlace</button>
        </div>
      </form>`;
    }

    const entrar = modo === 'login';
    return `
      <h2>Tu cuenta</h2>
      <div class="seg" role="group" aria-label="Acceso">
        <button data-auth="login" aria-pressed="${entrar}">Iniciar sesión</button>
        <button data-auth="registro" aria-pressed="${!entrar}">Registrarse</button>
      </div>
      ${entrar ? `
      <form id="formLogin" class="auth-form" novalidate style="max-width:460px">
        ${campo('l-correo', 'Correo electrónico', 'correo', 'email', 'autocomplete="email"')}
        ${campo('l-clave', 'Contraseña', 'clave', 'password', 'autocomplete="current-password"')}
        <p style="margin:0 0 12px"><button type="button" class="link-btn" style="color:var(--green)" data-auth="olvide">¿Olvidaste tu contraseña?</button></p>
        <p class="err" data-err="_general" role="alert"></p>
        <button class="btn" type="submit">Entrar</button>
      </form>` : `
      <form id="formRegistro" class="auth-form" novalidate>
        <div class="two">
          ${campo('r-nombres', 'Nombres', 'nombres', 'text', 'autocomplete="given-name" maxlength="80"')}
          ${campo('r-apellidos', 'Apellidos', 'apellidos', 'text', 'autocomplete="family-name" maxlength="80"')}
          ${campo('r-usuario', 'Nombre de usuario', 'usuario', 'text', 'autocomplete="username" maxlength="20"')}
          ${campo('r-correo', 'Correo electrónico', 'correo', 'email', 'autocomplete="email"')}
          ${campo('r-nac', 'Fecha de nacimiento', 'nacimiento', 'date', `max="${hoy}" autocomplete="bday"`)}
          ${campo('r-clave', 'Contraseña', 'clave', 'password', 'autocomplete="new-password"')}
        </div>
        <p class="muted" style="margin-top:0">Debes tener al menos ${edadMinima} años. No solicitamos documentos de identidad.</p>
        <p class="err" data-err="_general" role="alert"></p>
        <button class="btn" type="submit">Crear cuenta</button>
      </form>`}`;
  }
  /** Mapa del destino + enlaces para llegar. Si no hay coordenadas, avisa. */
  function ubicacionDestino(d) {
    const lat = Number(d.lat), lng = Number(d.lng);
    if (d.lat === null || d.lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return '<p class="notice">Este destino todavía no tiene ubicación en el mapa.</p>';
    }
    const google = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const waze = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    return `<div id="mapaDestino" class="mapa pequeno" role="region" aria-label="Ubicación de ${esc(d.nombre)}"></div>
      <div class="mapa-barra">
        <strong>Cómo llegar:</strong>
        <a class="btn small" href="${google}" target="_blank" rel="noopener">Google Maps</a>
        <a class="btn small ghost" href="${waze}" target="_blank" rel="noopener">Waze</a>
      </div>`;
  }
  /* ---------- Detalles (se muestran dentro de <dialog>) ---------- */
  function detalleDestino(d) {
    const fotos = d.fotos || [];
    const principal = fotos[0];
    const hero = principal
      ? `<img class="bg" src="${esc(principal.src)}" alt="" aria-hidden="true">
         <img class="fg" id="heroFoto" src="${esc(principal.src)}" width="${principal.w}" height="${principal.h}" alt="${esc(d.nombre)}">`
      : `<div class="sin-foto">${iconoDe(d.categoria)}</div>`;
    const miniaturas = fotos.length > 1
      ? `<div class="thumbs" role="group" aria-label="Fotografías">${fotos.map((f, i) =>
          `<button data-foto="${i}" aria-current="${i === 0}" aria-label="Foto ${i + 1}"><img src="${esc(f.src)}" alt="" loading="lazy"></button>`).join('')}</div>`
      : '';
    const on = d.es_favorito;
    const pendiente = d.estado !== 'publicado'
      ? `<p class="notice">Este destino está <strong>${d.estado === 'pendiente' ? 'en revisión' : 'rechazado'}</strong> y solo tú puedes verlo.</p>` : '';

    return `
      <div class="hero">${hero}<button class="icon-btn" data-cerrar aria-label="Cerrar">✕</button></div>
      ${miniaturas}
      <div class="dlg-body">
        <span class="tag">${esc(d.categoria_nombre)}</span>
        <h2 style="margin:6px 0 2px">${esc(d.nombre)}</h2>
        <div class="muted">📍 ${esc(d.ubicacion)}</div>
        ${pendiente}
        <p style="white-space:pre-line">${esc(d.descripcion)}</p>
        <dl>
          <dt>Dificultad</dt><dd>${esc(d.dificultad)}</dd>
          <dt>Duración</dt><dd>${esc(d.duracion)}</dd>
          ${d.mejor_epoca ? `<dt>Mejor época</dt><dd>${esc(d.mejor_epoca)}</dd>` : ''}
        </dl>
        ${d.recomendaciones.length ? `<strong>Recomendaciones</strong><ul>${d.recomendaciones.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        ${ubicacionDestino(d)}
        <div class="actions">
          ${d.estado === 'publicado' ? `<button class="btn ghost" data-fav="${d.id}" aria-pressed="${on}">${on ? '♥ Guardado' : '♡ Guardar'}</button>` : ''}
          <button class="btn" data-cerrar>Cerrar</button>
        </div>
      </div>`;
  }

  const detalleGuia = (g) =>
    `<div class="dlg-body">
      <div class="dlg-head"><h2>${esc(g.titulo)}</h2><button class="icon-btn" data-cerrar aria-label="Cerrar">✕</button></div>
      <small>${esc(g.autor)} · ${g.minutos} min</small>
      <p>${esc(g.resumen)}</p>
      <ol>${g.pasos.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="actions"><button class="btn" data-cerrar>Cerrar</button></div>
    </div>`;

  /** Etiqueta de orientación para las vistas previas de fotos. */
  const miniaturaSubida = (p, i) =>
    `<div class="photo"><img src="${esc(p.url)}" alt="Vista previa ${i + 1}" decoding="async">
      <span>${esc(p.orientacion)}</span>
      <button type="button" data-quitar-foto="${i}" aria-label="Quitar foto ${i + 1}">✕</button></div>`;

  return {
    esc, cargando, errorCarga, vacio,
    inicio, explorar, guias, perfil,
    detalleDestino, detalleGuia, miniaturaSubida,
    configurar, infoCategoria, colorOk, estiloCategoria,
  };
})();