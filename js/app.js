/* =====================================================================
   EcoBuesaco · Aplicación
   Une las piezas: estado, navegación, búsqueda, diálogos y eventos.
   Usa Api (servidor), Vistas (HTML) y Formularios (validación).
   ===================================================================== */
'use strict';

const App = (() => {
  const VISTAS = ['inicio', 'explorar', 'guias', 'perfil', 'admin'];

  const state = {
    vista: 'inicio',
    categoria: 'all',
    consulta: '',
    usuario: null,
    categorias: [],
    categoriasTodas: [],
    config: { edad_minima: 13, fotos_max: 5, fotos_max_mb: 5 },
    pestanaGuias: 'guias',
    modoAuth: 'login',
    modoExplorar: 'lista',
    destinosExplorar: [],
    tokenRecuperacion: '',
    iniciado: false,
    fotosDetalle: [],
    destinosSelect: null,   // caché para el selector "destino relacionado"
  };

  const $ = (s, r = document) => r.querySelector(s);
  const seccion = (v) => $('#view-' + v);
  const dlgDetalle = $('#detailDialog');
  const dlgPropuesta = $('#proposeDialog');
  const formPropuesta = $('#proposeForm');
  let gestorFotos = null;
  let contadorCargas = 0;

  /* ---------- Avisos ---------- */
  let temporizadorAviso;
  function toast(mensaje, tipo = 'info') {
    const t = $('#toast');
    t.textContent = mensaje;
    t.className = tipo === 'error' ? 'error' : '';
    t.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => (t.hidden = true), 4200);
  }

  /** Error de una acción suelta (me gusta, favoritos...). Si la sesión venció, lleva al perfil. */
  function errorAccion(e) {
    if (e.estado === 401) {
      state.usuario = null;
      cerrarDialogos();
      toast('Tu sesión no está activa. Inicia sesión para continuar.', 'error');
      ir('perfil');
      return;
    }
    toast(e.message || 'Ocurrió un error inesperado.', 'error');
  }

  /** Error dentro de un formulario: marca los campos y, si no hay campos, avisa con un toast. */
  function errorFormulario(form, e) {
    Formularios.aplicarErroresServidor(form, e);
    if (!e.campos || Object.keys(e.campos).length === 0) toast(e.message, 'error');
  }

  function cerrarDialogos() {
    if (dlgDetalle.open) dlgDetalle.close();
    if (dlgPropuesta.open) dlgPropuesta.close();
  }

  /* ---------- Carga de cada vista ---------- */
  async function destinosParaSelector() {
    if (!state.destinosSelect) {
      const r = await Api.destinos.listar({ limite: 100 });
      state.destinosSelect = r.destinos.map((d) => ({ id: d.id, nombre: d.nombre }));
    }
    return state.destinosSelect;
  }

  const cargadores = {
    async inicio() {
      const [d, c] = await Promise.all([
        Api.destinos.listar({ destacado: 1, limite: 12 }),
        Api.comunidad.listar({ limite: 2 }),
      ]);
      return Vistas.inicio({ destacados: d.destinos, categorias: state.categorias, publicaciones: c.publicaciones });
    },

    async explorar() {
      const r = await Api.destinos.listar({
        categoria: state.categoria === 'all' ? '' : state.categoria,
        q: state.consulta,
        limite: 100,
      });
      state.destinosExplorar = r.destinos;
      return Vistas.explorar({
        destinos: r.destinos, total: r.total, categorias: state.categorias,
        categoriaActiva: state.categoria, consulta: state.consulta, modo: state.modoExplorar,
      });
    },

    async guias() {
      if (state.pestanaGuias === 'guias') {
        const r = await Api.guias.listar();
        return Vistas.guias({ pestana: 'guias', guias: r.guias, publicaciones: [], usuario: state.usuario, destinos: [] });
      }
      const [p, destinos] = await Promise.all([
        Api.comunidad.listar({ limite: 30 }),
        state.usuario ? destinosParaSelector() : [],
      ]);
      return Vistas.guias({ pestana: 'comunidad', guias: [], publicaciones: p.publicaciones, usuario: state.usuario, destinos });
    },

    async perfil() {
      const base = { modoAuth: state.modoAuth, edadMinima: state.config.edad_minima };
      if (!state.usuario || state.modoAuth === 'restablecer') return Vistas.perfil({ usuario: null, favoritos: [], propuestas: [], ...base });
      const [f, p] = await Promise.all([Api.favoritos.listar(), Api.destinos.misPropuestas()]);
      return Vistas.perfil({ usuario: state.usuario, favoritos: f.favoritos, propuestas: p.propuestas, ...base });
    },

    async admin() {
      return Admin.render(state);
    },
  };
    /** Dibuja el mapa de Explorar una vez que su contenedor ya está en la página. */
  function dibujarMapaExplorar() {
    const cont = $('#mapaExplorar');
    if (cont) Mapa.vistaGeneral(cont, state.destinosExplorar, (id) => abrirDestino(id));
  }
  /** Carga y dibuja una vista. `silencioso` evita parpadear con el esqueleto de carga. */
  async function cargarVista(v, silencioso = false) {
    const mia = ++contadorCargas;
    const el = seccion(v);
    if (!silencioso) el.innerHTML = Vistas.cargando();
    el.setAttribute('aria-busy', 'true');
    try {
      const html = await cargadores[v]();
      if (mia !== contadorCargas || state.vista !== v) return;   // llegó tarde: ya hay otra carga
      el.innerHTML = html;
      if (v === 'explorar' && state.modoExplorar === 'mapa') dibujarMapaExplorar();
    } catch (e) {
      if (mia !== contadorCargas || state.vista !== v) return;
      if (e.estado === 401) state.usuario = null;
      el.innerHTML = Vistas.errorCarga(e.message);
    } finally {
      if (mia === contadorCargas) el.removeAttribute('aria-busy');
    }
  }

  function ir(v) {
    state.vista = v;
    VISTAS.forEach((x) => (seccion(x).hidden = x !== v));
    document.querySelectorAll('.nav button').forEach((b) => {
      const activa = v === 'admin' ? 'perfil' : v;
      if (b.dataset.view === activa) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0 });
    cargarVista(v);
  }

  /* ---------- Favoritos y me gusta ---------- */
  function pintarFavorito(id, activo) {
    document.querySelectorAll(`[data-fav="${Number(id)}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', String(activo));
      if (b.classList.contains('fav')) {
        b.textContent = activo ? '♥' : '♡';
        b.setAttribute('aria-label', (activo ? 'Quitar de' : 'Guardar en') + ' favoritos');
      } else {
        b.textContent = activo ? '♥ Guardado' : '♡ Guardar';
      }
    });
  }

  async function alternarFavorito(id, boton) {
    if (!state.usuario) {
      cerrarDialogos();
      toast('Inicia sesión para guardar favoritos.');
      return ir('perfil');
    }
    boton.disabled = true;
    try {
      const r = await Api.favoritos.alternar(id);
      pintarFavorito(id, r.es_favorito);
      toast(r.es_favorito ? 'Guardado en tus favoritos.' : 'Quitado de tus favoritos.');
      if (state.vista === 'perfil') cargarVista('perfil', true);
    } catch (e) {
      errorAccion(e);
    } finally {
      boton.disabled = false;
    }
  }

  async function alternarMeGusta(id, boton) {
    if (!state.usuario) {
      toast('Inicia sesión para dar me gusta.');
      return ir('perfil');
    }
    boton.disabled = true;
    try {
      const r = await Api.comunidad.meGusta(id);
      boton.setAttribute('aria-pressed', String(r.di_me_gusta));
      boton.textContent = `♥ ${r.me_gusta}`;
    } catch (e) {
      errorAccion(e);
    } finally {
      boton.disabled = false;
    }
  }

  async function eliminarPublicacion(id) {
    if (!confirm('¿Eliminar esta publicación?')) return;
    try {
      await Api.comunidad.eliminar(id);
      toast('Publicación eliminada.');
      cargarVista(state.vista, true);
    } catch (e) {
      errorAccion(e);
    }
  }

  /* ---------- Diálogos de detalle ---------- */
  const marcoCarga = () =>
    `<div class="dlg-body"><div class="dlg-head"><span class="muted">Cargando…</span>
     <button class="icon-btn" data-cerrar aria-label="Cerrar">✕</button></div>${Vistas.cargando(1)}</div>`;

  async function abrirDestino(id) {
    dlgDetalle.innerHTML = marcoCarga();
    if (!dlgDetalle.open) dlgDetalle.showModal();
    try {
      const { destino } = await Api.destinos.detalle(id);
      state.fotosDetalle = destino.fotos || [];
      dlgDetalle.innerHTML = Vistas.detalleDestino(destino);
            const contMapa = $('#mapaDestino');
      if (contMapa) {
        Mapa.punto(contMapa, { lat: destino.lat, lng: destino.lng, nombre: destino.nombre, categoria: destino.categoria });
      }
      // Punto de enganche para Google Maps en la fase siguiente
      document.dispatchEvent(new CustomEvent('ecobuesaco:destino-abierto', { detail: destino }));
    } catch (e) {
      dlgDetalle.close();
      errorAccion(e);
    }
  }

  async function abrirGuia(id) {
    dlgDetalle.innerHTML = marcoCarga();
    if (!dlgDetalle.open) dlgDetalle.showModal();
    try {
      const { guia } = await Api.guias.detalle(id);
      dlgDetalle.innerHTML = Vistas.detalleGuia(guia);
    } catch (e) {
      dlgDetalle.close();
      errorAccion(e);
    }
  }

  function cambiarFoto(i) {
    const f = state.fotosDetalle[i];
    const frente = $('#heroFoto');
    if (!f || !frente) return;
    frente.src = f.src; frente.width = f.w; frente.height = f.h;
    const fondo = $('.hero .bg', dlgDetalle);
    if (fondo) fondo.src = f.src;
    dlgDetalle.querySelectorAll('[data-foto]').forEach((b) =>
      b.setAttribute('aria-current', String(Number(b.dataset.foto) === i)));
  }
  /* ---------- Ubicación de la propuesta (mapa) ---------- */
  let selectorUbicacion = null;

  function distanciaKm(lat1, lng1, lat2, lng2) {
    const rad = (g) => (g * Math.PI) / 180;
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a));
  }

  /** Guarda las coordenadas en los campos ocultos y actualiza el texto de la barra. */
  function mostrarUbicacion(lat, lng) {
    formPropuesta.elements.latitud.value = lat === null ? '' : String(lat);
    formPropuesta.elements.longitud.value = lng === null ? '' : String(lng);
    $('#btnQuitarUbicacion').hidden = lat === null;
    Formularios.mostrarError(formPropuesta, 'latitud', '');
    const texto = $('#textoUbicacion');
    if (lat === null) { texto.textContent = 'Sin ubicación seleccionada.'; return; }
    const lejos = Mapa.CENTRO && distanciaKm(lat, lng, Mapa.CENTRO[0], Mapa.CENTRO[1]) > 40;
    texto.textContent = `✅ ${lat}, ${lng}` + (lejos ? ' · Ojo: queda lejos de Buesaco, ¿es correcto?' : '');
  }

  function liberarSelectorUbicacion() {
    if (selectorUbicacion) Mapa.liberar(selectorUbicacion.mapa);
    selectorUbicacion = null;
  }

  function iniciarSelectorUbicacion() {
    liberarSelectorUbicacion();
    selectorUbicacion = Mapa.selector($('#mapaPropuesta'), {
      categoria: formPropuesta.elements.categoria.value,
      alCambiar: mostrarUbicacion,
    });
    mostrarUbicacion(null, null);
  }

  $('#btnMiUbicacion').addEventListener('click', async (ev) => {
    if (!selectorUbicacion) return toast('El mapa no está disponible. Revisa tu conexión a internet.', 'error');
    const boton = ev.currentTarget;
    boton.disabled = true;
    $('#textoUbicacion').textContent = '⏳ Buscando tu ubicación…';
    try {
      const p = await Mapa.ubicacionActual();
      selectorUbicacion.poner(p.lat, p.lng, true);
      if (p.precision > 100) toast(`La precisión del GPS es de unos ${Math.round(p.precision)} m. Ajusta el marcador si hace falta.`);
    } catch (e) {
      const lat = formPropuesta.elements.latitud.value, lng = formPropuesta.elements.longitud.value;
      mostrarUbicacion(lat ? Number(lat) : null, lng ? Number(lng) : null);
      toast(e.message, 'error');
    } finally {
      boton.disabled = false;
    }
  });

  $('#btnQuitarUbicacion').addEventListener('click', () => { if (selectorUbicacion) selectorUbicacion.quitar(); });

  formPropuesta.elements.categoria.addEventListener('change', (ev) => {
    if (selectorUbicacion) selectorUbicacion.cambiarCategoria(ev.target.value);
  });
  /* ---------- Proponer destino ---------- */
  function abrirPropuesta() {
    if (!state.usuario) {
      toast('Inicia sesión para proponer un destino.');
      return ir('perfil');
    }
    dlgPropuesta.showModal();
    iniciarSelectorUbicacion();
  }

  async function enviarPropuesta(form) {
    const camposOk = Formularios.validar(form, Formularios.reglasPropuesta);
    const sinFotos = gestorFotos.lista().length === 0;
    if (sinFotos) Formularios.mostrarError(form, 'fotos', 'Agrega al menos una fotografía.');
    if (!camposOk || sinFotos) return;

    const boton = form.querySelector('[type=submit]');
    await Formularios.conBoton(boton, 'Enviando…', async () => {
      try {
        const r = await Api.destinos.proponer(Formularios.datosPropuesta(form, gestorFotos.lista()));
        dlgPropuesta.close();
        toast(r.mensaje || 'Propuesta enviada.');
        if (state.vista === 'perfil') cargarVista('perfil', true);
      } catch (e) {
        if (e.estado === 401) return errorAccion(e);
        errorFormulario(form, e);
      }
    });
  }

  /* ---------- Cuenta ---------- */
  async function enviarLogin(form) {
    if (!Formularios.validar(form, Formularios.reglasLogin)) return;
    await Formularios.conBoton(form.querySelector('[type=submit]'), 'Entrando…', async () => {
      try {
        const r = await Api.auth.entrar(Formularios.aObjeto(form));
        state.usuario = r.usuario;
        toast(`Bienvenido, ${r.usuario.nombres}.`);
        await cargarVista('perfil');
      } catch (e) {
        errorFormulario(form, e);
      }
    });
  }

  async function enviarRegistro(form) {
    if (!Formularios.validar(form, Formularios.reglasRegistro(state.config.edad_minima))) return;
    await Formularios.conBoton(form.querySelector('[type=submit]'), 'Creando cuenta…', async () => {
      try {
        const r = await Api.auth.registrar(Formularios.aObjeto(form));
        state.usuario = r.usuario;
        toast('Cuenta creada. ¡Bienvenido a EcoBuesaco!');
        await cargarVista('perfil');
      } catch (e) {
        errorFormulario(form, e);
      }
    });
  }
  async function enviarOlvide(form) {
    if (!Formularios.validar(form, { correo: Formularios.reglasLogin.correo })) return;
    await Formularios.conBoton(form.querySelector('[type=submit]'), 'Enviando…', async () => {
      try {
        await Api.auth.olvide(form.elements.correo.value.trim());
        state.modoAuth = 'olvide_ok';
        await cargarVista('perfil');
      } catch (e) {
        errorFormulario(form, e);
      }
    });
  }

  async function enviarRestablecer(form) {
    const reglas = {
      clave: Formularios.reglasRegistro(0).clave,
      confirmar: (v) => (v === form.elements.clave.value ? '' : 'Las contraseñas no coinciden.'),
    };
    if (!Formularios.validar(form, reglas)) return;
    await Formularios.conBoton(form.querySelector('[type=submit]'), 'Guardando…', async () => {
      try {
        await Api.auth.restablecer(state.tokenRecuperacion, form.elements.clave.value);
        state.tokenRecuperacion = '';
        state.modoAuth = 'login';
        toast('Contraseña actualizada. Ya puedes iniciar sesión.');
        await cargarVista('perfil');
      } catch (e) {
        errorFormulario(form, e);
      }
    });
  }

  async function cerrarSesion() {
    try {
      await Api.auth.salir();
      state.usuario = null;
      state.modoAuth = 'login';
      toast('Sesión cerrada.');
      cargarVista('perfil');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function enviarPublicacion(form) {
    if (!Formularios.validar(form, Formularios.reglasPublicacion)) return;
    const { texto, destino_id } = Formularios.aObjeto(form);
    await Formularios.conBoton(form.querySelector('[type=submit]'), 'Publicando…', async () => {
      try {
        await Api.comunidad.publicar(texto, destino_id ? Number(destino_id) : null);
        toast('Publicación creada.');
        await cargarVista('guias', true);
      } catch (e) {
        if (e.estado === 401) return errorAccion(e);
        errorFormulario(form, e);
      }
    });
  }

  /* ---------- Búsqueda ---------- */
  let temporizadorBusqueda;
  function aplicarBusqueda() {
    if (state.vista === 'explorar') cargarVista('explorar');
    else ir('explorar');
  }

  function limpiarFiltros() {
    state.consulta = '';
    state.categoria = 'all';
    $('#searchInput').value = '';
    cargarVista('explorar');
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest(
      '[data-view],[data-ir],[data-abrir],[data-fav],[data-categoria],[data-accion],[data-like],' +
      '[data-eliminar-pub],[data-guia],[data-pestana],[data-auth],[data-cerrar],[data-foto],[data-quitar-foto],[data-modo]');
    if (!t) return;
    const d = t.dataset;

    if (d.view)        return ir(d.view);
    if (d.ir)          return ir(d.ir);
    if (d.abrir)       return abrirDestino(Number(d.abrir));
    if (d.fav)         return alternarFavorito(Number(d.fav), t);
    if (d.like)        return alternarMeGusta(Number(d.like), t);
    if (d.eliminarPub) return eliminarPublicacion(Number(d.eliminarPub));
    if (d.guia)        return abrirGuia(Number(d.guia));
    if (d.foto !== undefined) return cambiarFoto(Number(d.foto));
    if (d.quitarFoto !== undefined) return gestorFotos.quitar(Number(d.quitarFoto));
    if (d.cerrar !== undefined) return t.closest('dialog').close();

    if (d.categoria) {
      if (state.vista === 'inicio') { state.consulta = ''; $('#searchInput').value = ''; }
      state.categoria = d.categoria;
      return state.vista === 'explorar' ? cargarVista('explorar') : ir('explorar');
    }
    if (d.pestana) { state.pestanaGuias = d.pestana; return cargarVista('guias'); }
    if (d.modo) { state.modoExplorar = d.modo; return cargarVista('explorar', true); }
    if (d.auth)    { state.modoAuth = d.auth;        return cargarVista('perfil'); }

    switch (d.accion) {
      case 'reintentar': return state.iniciado ? cargarVista(state.vista) : arrancar();
      case 'limpiar':    return limpiarFiltros();
      case 'proponer':   return abrirPropuesta();
      case 'salir':      return cerrarSesion();
    }
  });

  document.addEventListener('submit', (ev) => {
    const f = ev.target;
    const manejadores = {
      formLogin: enviarLogin, formRegistro: enviarRegistro, formPublicar: enviarPublicacion,
      formOlvide: enviarOlvide, formRestablecer: enviarRestablecer,
      proposeForm: enviarPropuesta,
      searchForm: () => { clearTimeout(temporizadorBusqueda); state.consulta = $('#searchInput').value.trim(); aplicarBusqueda(); },
    };
    const h = manejadores[f.id];
    if (!h) return;
    ev.preventDefault();
    h(f);
  });

  $('#searchInput').addEventListener('input', (ev) => {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(() => {
      state.consulta = ev.target.value.trim();
      aplicarBusqueda();
    }, 300);
  });

  // Clic en el fondo oscuro cierra el detalle (la propuesta no, para no perder lo escrito)
  dlgDetalle.addEventListener('click', (ev) => { if (ev.target === dlgDetalle) dlgDetalle.close(); });

  dlgPropuesta.addEventListener('close', () => {
    formPropuesta.reset();
    Formularios.limpiarErrores(formPropuesta);
    if (gestorFotos) gestorFotos.vaciar();
    liberarSelectorUbicacion();
    mostrarUbicacion(null, null);
  });

  $('#p-photos').addEventListener('change', (ev) => {
    if (!gestorFotos) return;
    gestorFotos.agregar(Array.from(ev.target.files));
    ev.target.value = '';   // permite elegir la misma foto otra vez
  });

    /** Guarda las categorías del servidor: las activas para elegir y todas para dibujar iconos y colores. */
  function aplicarCategorias(s) {
    state.categorias = s.categorias;
    state.categoriasTodas = s.categorias_todas || s.categorias;
    Vistas.configurar(state.categoriasTodas);
    // Si el filtro activo apunta a una categoría que ya no está disponible, se vuelve a "Todos"
    if (state.categoria !== 'all' && !state.categorias.some((c) => c.slug === state.categoria)) state.categoria = 'all';
    $('#p-cat').innerHTML = '<option value="">Selecciona…</option>' +
      s.categorias.map((c) => `<option value="${Vistas.esc(c.slug)}">${Vistas.esc(c.nombre)}</option>`).join('');
  }

  /** Vuelve a pedir las categorías (lo usa el panel de administración tras crear o cambiar una). */
  async function refrescarCategorias() {
    aplicarCategorias(await Api.iniciar());
  }
  /* ---------- Arranque ---------- */
  async function arrancar() {
    try {
      const s = await Api.iniciar();
      state.usuario = s.usuario;
      state.config = s.config;
      aplicarCategorias(s);
      $('#p-photos-label').textContent =
        `Fotografías (hasta ${s.config.fotos_max} · JPG, PNG o WebP · máx. ${s.config.fotos_max_mb} MB)`;

      if (!gestorFotos) {
        gestorFotos = Formularios.crearGestorFotos({
          max: s.config.fotos_max,
          maxMb: s.config.fotos_max_mb,
          alCambiar: (fotos) => { $('#photoPreview').innerHTML = fotos.map(Vistas.miniaturaSubida).join(''); },
          alError: (msg) => Formularios.mostrarError(formPropuesta, 'fotos', msg),
        });
      }
      state.iniciado = true;

      // Llegada desde el enlace del correo: index.html#restablecer=<código>
      const enlace = location.hash.match(/^#restablecer=([a-f0-9]{64})$/);
      if (enlace) {
        state.tokenRecuperacion = enlace[1];
        state.modoAuth = 'restablecer';
        history.replaceState(null, '', location.pathname + location.search);   // oculta el código de la barra
        return ir('perfil');
      }
      ir('inicio');
    } catch (e) {
      seccion('inicio').innerHTML = Vistas.errorCarga(e.message);
    }
  }

  arrancar();
  return { state, ir, cargarVista, toast, errorAccion, refrescarCategorias };
})();