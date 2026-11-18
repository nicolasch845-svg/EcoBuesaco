/* =====================================================================
   EcoBuesaco · Panel de moderación
   Dibuja la pantalla, maneja sus eventos y llama a Api.admin.
   El servidor vuelve a comprobar el rol en cada acción.
   ===================================================================== */
'use strict';

const Admin = (() => {
  let pestana = 'pendientes';
  let rechazo = null;   // { id, modo: 'rechazar' | 'retirar' }

  const esc = (s) => Vistas.esc(s);
  const esMod = (u) => !!u && (u.rol === 'moderador' || u.rol === 'admin');
  const dlg = document.getElementById('rejectDialog');
  const formRechazo = document.getElementById('rejectForm');

  /* ---------- Dibujo ---------- */
  function fotos(lista) {
    if (!lista.length) return '<p class="notice">Esta propuesta no tiene fotografías.</p>';
    return `<div class="mod-fotos">${lista.map((f, i) =>
      `<a href="${esc(f.src)}" target="_blank" rel="noopener" aria-label="Ver foto ${i + 1} completa">
        <img src="${esc(f.src)}" width="${f.w}" height="${f.h}" alt="Foto ${i + 1} de la propuesta" loading="lazy"></a>`).join('')}</div>`;
  }
  /** Mapa con la ubicación propuesta, o un aviso si no la trae. */
  function ubicacion(p) {
    const lat = Number(p.lat), lng = Number(p.lng);
    if (p.lat === null || p.lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return '<p class="notice">Sin ubicación en el mapa. Verifica la dirección escrita antes de aprobar.</p>';
    }
    const enlace = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    return `<div class="mapa pequeno" data-mapa-mod="${p.id}" data-lat="${lat}" data-lng="${lng}"
                 data-categoria="${esc(p.categoria)}" data-nombre="${esc(p.nombre)}"
                 role="region" aria-label="Ubicación propuesta de ${esc(p.nombre)}"></div>
      <p class="mapa-barra"><a class="btn small ghost" href="${enlace}" target="_blank" rel="noopener">Abrir en Google Maps</a>
      <span class="muted">${lat}, ${lng}</span></p>`;
  }
  const tarjetaPendiente = (p) => `
    <article class="card mod-card"><div class="body">
      <span class="tag">${esc(p.categoria_nombre)}</span> <span class="tag pendiente">En revisión</span>
      <h3>${esc(p.nombre)}</h3>
      <div class="muted">📍 ${esc(p.ubicacion)}</div>
      <small>Propuesto por ${esc(p.proponente_nombre || 'el equipo')}${p.proponente ? ` (@${esc(p.proponente)})` : ''} · ${esc(p.creado)}</small>
      ${fotos(p.fotos)}
      ${ubicacion(p)}
      <p style="white-space:pre-line">${esc(p.descripcion)}</p>
      <dl>
        <dt>Dificultad</dt><dd>${esc(p.dificultad)}</dd>
        <dt>Duración</dt><dd>${esc(p.duracion)}</dd>
        ${p.mejor_epoca ? `<dt>Mejor época</dt><dd>${esc(p.mejor_epoca)}</dd>` : ''}
      </dl>
      ${p.recomendaciones.length ? `<ul>${p.recomendaciones.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="mod-acciones">
        <label class="check"><input type="checkbox" name="destacado"> Destacar en inicio</label>
        <button class="btn small" data-adm="aprobar" data-id="${p.id}">Aprobar y publicar</button>
        <button class="btn small ghost" data-adm="rechazar" data-id="${p.id}">Rechazar</button>
      </div>
    </div></article>`;

  const filaPublicado = (d) => `
    <div class="row-item">
      <div class="grow"><strong>${esc(d.nombre)}</strong> ${d.destacado ? '<span class="tag">★ Destacado</span>' : ''}
        <div class="muted">${esc(d.categoria_nombre)} · ${esc(d.ubicacion)}</div></div>
      <div class="mod-acciones" style="margin:0">
        <button class="btn small ghost" data-abrir="${d.id}">Ver</button>
        <button class="btn small ghost" data-adm="destacar" data-id="${d.id}" data-valor="${d.destacado ? 0 : 1}">${d.destacado ? 'Quitar destacado' : '☆ Destacar'}</button>
        <button class="btn small ghost" data-adm="retirar" data-id="${d.id}">Retirar</button>
      </div>
    </div>`;

  const filaUsuario = (u) => `
    <div class="row-item">
      <div class="grow"><strong>${esc(u.nombre)}</strong> <span class="muted">@${esc(u.usuario)}</span>
        ${u.es_yo ? '<span class="tag">Tú</span>' : ''}${u.activo ? '' : ' <span class="tag inactivo">Desactivada</span>'}
        <div class="muted">${esc(u.correo)} · ${esc(u.creado)}</div></div>
      ${u.es_yo ? '' : `<div class="mod-acciones" style="margin:0">
        <select data-adm-rol="${u.id}" aria-label="Rol de ${esc(u.usuario)}">
          ${['usuario', 'moderador', 'admin'].map((r) => `<option value="${r}" ${u.rol === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
        <button class="btn small ghost" data-adm="activo" data-id="${u.id}" data-valor="${u.activo ? 0 : 1}">${u.activo ? 'Desactivar' : 'Activar'}</button>
      </div>`}
    </div>`;
  const filaCategoria = (c) => `
    <div class="row-item">
      <div class="grow">
        <span class="cat-chip" style="${Vistas.estiloCategoria(c.color)}">${esc(c.icono)} ${esc(c.nombre)}</span>
        ${c.activa ? '' : '<span class="tag inactivo">Desactivada</span>'}
        <div class="muted">${c.destinos} destino(s) · ${esc(c.slug)}</div></div>
      <div class="mod-acciones" style="margin:0">
        <button class="btn small ghost" data-adm="cat-editar" data-id="${c.id}"
          data-nombre="${esc(c.nombre)}" data-icono="${esc(c.icono)}" data-color="${esc(c.color)}">Editar</button>
        <button class="btn small ghost" data-adm="cat-activa" data-id="${c.id}" data-valor="${c.activa ? 0 : 1}">${c.activa ? 'Desactivar' : 'Activar'}</button>
        <button class="btn small ghost" data-adm="cat-eliminar" data-id="${c.id}" data-nombre="${esc(c.nombre)}"
          ${c.destinos > 0 ? 'disabled title="Tiene destinos: desactívala en lugar de eliminarla"' : ''}>Eliminar</button>
      </div>
    </div>`;
  async function contenidoPestana() {
    if (pestana === 'pendientes') {
      const { propuestas } = await Api.admin.pendientes();
      return propuestas.length
        ? `<div class="mod-list">${propuestas.map(tarjetaPendiente).join('')}</div>`
        : Vistas.vacio('✅', 'No hay propuestas pendientes', 'Todo está al día.');
    }
    if (pestana === 'publicados') {
      const { destinos } = await Api.admin.publicados();
      return destinos.length
        ? `<div class="stack">${destinos.map(filaPublicado).join('')}</div>`
        : Vistas.vacio('🌄', 'No hay destinos publicados', 'Aprueba una propuesta para empezar.');
    }
        if (pestana === 'categorias') {
      const { categorias } = await Api.admin.categorias();
      return `<div class="mapa-barra">
          <button class="btn small" data-adm="cat-nueva">+ Nueva categoría</button>
          <span class="muted">${categorias.length} de 12 categorías</span></div>
        <div class="stack">${categorias.map(filaCategoria).join('')}</div>`;
    }
    const { usuarios } = await Api.admin.usuarios();
    return `<div class="stack">${usuarios.map(filaUsuario).join('')}</div>`;
  }
  /** Dibuja los mapas de las propuestas pendientes que estén en pantalla. */
  function dibujarMapas() {
    document.querySelectorAll('#view-admin [data-mapa-mod]').forEach((cont) => {
      if (cont.dataset.listo) return;
      cont.dataset.listo = '1';
      Mapa.punto(cont, {
        lat: Number(cont.dataset.lat), lng: Number(cont.dataset.lng),
        nombre: cont.dataset.nombre, categoria: cont.dataset.categoria,
      });
    });
  }
  async function render(state) {
    const u = state.usuario;
    if (!esMod(u)) {
      return Vistas.vacio('🔒', 'Acceso restringido', 'Esta sección es solo para moderadores.',
        '<button class="btn" data-ir="perfil">Volver</button>');
    }
    const esAdmin = u.rol === 'admin';
    if ((pestana === 'usuarios' || pestana === 'categorias') && !esAdmin) pestana = 'pendientes';

    const [{ resumen: r }, contenido] = await Promise.all([Api.admin.resumen(), contenidoPestana()]);
    const tab = (id, texto) => `<button data-adm="tab" data-tab="${id}" aria-pressed="${pestana === id}">${texto}</button>`;

    const html = `
      <p style="margin:16px 0 0"><button class="link-btn" style="color:var(--green)" data-ir="perfil">← Volver al perfil</button></p>
      <h2 style="margin-top:8px">Panel de moderación</h2>
      <div class="stats">
        <div class="stat"><strong>${r.pendientes}</strong><span>En revisión</span></div>
        <div class="stat"><strong>${r.publicados}</strong><span>Publicados</span></div>
        <div class="stat"><strong>${r.rechazados}</strong><span>Rechazados</span></div>
        <div class="stat"><strong>${r.usuarios}</strong><span>Usuarios activos</span></div>
      </div>
      <div class="seg" role="group" aria-label="Secciones del panel" style="max-width:640px">
        ${tab('pendientes', `Pendientes (${r.pendientes})`)}${tab('publicados', 'Publicados')}${esAdmin ? tab('usuarios', 'Usuarios') + tab('categorias', 'Categorías') : ''}
      </div>
      ${contenido}`;
          // Los mapas se dibujan cuando el HTML ya está en la página
    setTimeout(dibujarMapas, 0);
    return html;
  }

  /* ---------- Acciones ---------- */
  const recargar = () => App.cargarVista('admin', true);

  /** Ejecuta una acción sobre un botón: lo bloquea, avisa y recarga el panel. */
  async function ejecutar(boton, accion, mensaje) {
    boton.disabled = true;
    try {
      const r = await accion();
      App.toast(mensaje || r.mensaje || 'Hecho.');
      await recargar();
    } catch (e) {
      App.errorAccion(e);
      boton.disabled = false;
    }
  }

  function abrirRechazo(id, modo) {
    rechazo = { id, modo };
    const retirar = modo === 'retirar';
    document.getElementById('rejectTitle').textContent = retirar ? 'Retirar destino' : 'Rechazar propuesta';
    document.getElementById('rejectHelp').textContent = retirar
      ? 'El destino dejará de verse públicamente. Quedará registrado el motivo.'
      : 'Quien la propuso verá este motivo en su perfil.';
    dlg.showModal();
    formRechazo.elements.motivo.focus();
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-adm]');
    if (!t) return;
    const id = Number(t.dataset.id);

    switch (t.dataset.adm) {
      case 'tab':
        pestana = t.dataset.tab;
        return App.cargarVista('admin');
      case 'aprobar': {
        const destacado = !!t.closest('.mod-card').querySelector('[name=destacado]').checked;
        return ejecutar(t, () => Api.admin.revisar(id, 'aprobar', { destacado }), 'Destino aprobado y publicado.');
      }
      case 'rechazar': return abrirRechazo(id, 'rechazar');
      case 'retirar':  return abrirRechazo(id, 'retirar');
      case 'destacar': {
        const valor = t.dataset.valor === '1';
        return ejecutar(t, () => Api.admin.destacar(id, valor), valor ? 'Destacado en inicio.' : 'Quitado de destacados.');
      }
      case 'activo': {
        const valor = t.dataset.valor === '1';
        if (!valor && !confirm('¿Desactivar esta cuenta? No podrá iniciar sesión.')) return;
        return ejecutar(t, () => Api.admin.cambiarActivo(id, valor));
      }
            case 'cat-nueva':  return abrirCategoria(null);
      case 'cat-editar': return abrirCategoria({ id, nombre: t.dataset.nombre, icono: t.dataset.icono, color: t.dataset.color });
      case 'cat-activa': {
        const valor = t.dataset.valor === '1';
        return ejecutarCat(t, () => Api.admin.activarCategoria(id, valor));
      }
      case 'cat-eliminar':
        if (!confirm(`¿Eliminar la categoría "${t.dataset.nombre}"? Esta acción no se puede deshacer.`)) return;
        return ejecutarCat(t, () => Api.admin.eliminarCategoria(id));
    }
  });

  document.addEventListener('change', (ev) => {
    const s = ev.target.closest('[data-adm-rol]');
    if (!s) return;
    if (!confirm(`¿Cambiar el rol a "${s.value}"?`)) return recargar();
    ejecutar(s, () => Api.admin.cambiarRol(Number(s.dataset.admRol), s.value)).then(recargar);
  });

  formRechazo.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!rechazo) return;
    const ok = Formularios.validar(formRechazo, {
      motivo: (v) => (v.length < 5 ? 'Escribe un motivo de al menos 5 caracteres.' : ''),
    });
    if (!ok) return;

    const { id, modo } = rechazo;
    const motivo = formRechazo.elements.motivo.value.trim();
    await Formularios.conBoton(formRechazo.querySelector('[type=submit]'), 'Guardando…', async () => {
      try {
        const r = modo === 'retirar' ? await Api.admin.retirar(id, motivo) : await Api.admin.revisar(id, 'rechazar', { motivo });
        dlg.close();
        App.toast(r.mensaje);
        await recargar();
      } catch (e) {
        Formularios.aplicarErroresServidor(formRechazo, e);
        if (!e.campos || !Object.keys(e.campos).length) App.toast(e.message, 'error');
      }
    });
  });

  dlg.addEventListener('close', () => {
    formRechazo.reset();
    Formularios.limpiarErrores(formRechazo);
    rechazo = null;
  });
  /* ---------- Categorías ---------- */
  const dlgCat = document.getElementById('categoryDialog');
  const formCat = document.getElementById('categoryForm');
  let editandoCat = null;

  /** Como ejecutar(), pero además actualiza las categorías de toda la aplicación. */
  async function ejecutarCat(boton, accion) {
    boton.disabled = true;
    try {
      const r = await accion();
      await App.refrescarCategorias();
      App.toast(r.mensaje || 'Hecho.');
      await recargar();
    } catch (e) {
      App.errorAccion(e);
      boton.disabled = false;
    }
  }

  function vistaPreviaCat() {
    const p = document.getElementById('catPreview');
    const color = formCat.elements.color.value;
    p.style.cssText = Vistas.estiloCategoria(color);
    p.textContent = `${formCat.elements.icono.value.trim() || '📍'} ${formCat.elements.nombre.value.trim() || 'Nombre'}`;
  }

  function abrirCategoria(c) {
    editandoCat = c ? c.id : null;
    document.getElementById('categoryTitle').textContent = c ? 'Editar categoría' : 'Nueva categoría';
    formCat.elements.nombre.value = c ? c.nombre : '';
    formCat.elements.icono.value = c ? c.icono : '';
    formCat.elements.color.value = c ? Vistas.colorOk(c.color) : '#2f6048';
    Formularios.limpiarErrores(formCat);
    vistaPreviaCat();
    dlgCat.showModal();
    formCat.elements.nombre.focus();
  }

  formCat.addEventListener('input', vistaPreviaCat);

  dlgCat.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-emoji]');
    if (!b) return;
    formCat.elements.icono.value = b.dataset.emoji;
    vistaPreviaCat();
  });

  formCat.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const ok = Formularios.validar(formCat, {
      nombre: (v) => (v.length < 3 ? 'El nombre debe tener al menos 3 caracteres.' : ''),
      icono:  (v) => (v ? '' : 'Elige un emoji.'),
      color:  (v) => (/^#[0-9a-f]{6}$/i.test(v) ? '' : 'Elige un color válido.'),
    });
    if (!ok) return;

    const datos = {
      nombre: formCat.elements.nombre.value.trim(),
      icono: formCat.elements.icono.value.trim(),
      color: formCat.elements.color.value,
    };
    await Formularios.conBoton(formCat.querySelector('[type=submit]'), 'Guardando…', async () => {
      try {
        const r = editandoCat ? await Api.admin.editarCategoria(editandoCat, datos) : await Api.admin.crearCategoria(datos);
        dlgCat.close();
        await App.refrescarCategorias();
        App.toast(r.mensaje);
        await recargar();
      } catch (e) {
        Formularios.aplicarErroresServidor(formCat, e);
        if (!e.campos || !Object.keys(e.campos).length) App.toast(e.message, 'error');
      }
    });
  });

  dlgCat.addEventListener('close', () => {
    formCat.reset();
    Formularios.limpiarErrores(formCat);
    editandoCat = null;
  });
  return { render };
})();