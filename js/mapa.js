/* =====================================================================
   EcoBuesaco · Mapas (Leaflet + OpenStreetMap)
   Gratis y sin clave. Funciones reutilizables para todas las pantallas.
   Los textos que vienen del servidor se escapan con Vistas.esc().
   ===================================================================== */
'use strict';

const Mapa = (() => {
  const CENTRO = [1.3833, -77.1500];   // Buesaco, Nariño (aproximado)
  const ZOOM = 12;
  const activos = new Set();

  const esc = (s) => Vistas.esc(s);
  const disponible = () => typeof L !== 'undefined';
  const limpiarClase = (s) => String(s || '').replace(/[^a-z0-9_-]/gi, '');

  /** Coordenadas válidas (números dentro del rango geográfico). */
  const coordenadasOk = (lat, lng) =>
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  /** Libera los mapas cuyo contenedor ya no está en la página (al cambiar de pantalla). */
  function liberarHuerfanos() {
    for (const m of activos) {
      if (!m.getContainer().isConnected) { m.remove(); activos.delete(m); }
    }
  }

  /** El mapa mide mal si se crea dentro de algo oculto o animado: se recalcula el tamaño. */
  function recalcular(mapa, demora = 200) {
    setTimeout(() => { if (mapa.getContainer().isConnected) mapa.invalidateSize(); }, demora);
  }

  /** Crea el mapa base. Devuelve null (y avisa en pantalla) si Leaflet no cargó. */
  function crear(contenedor, { centro = CENTRO, zoom = ZOOM } = {}) {
    liberarHuerfanos();
    if (!disponible()) {
      contenedor.innerHTML = '<div class="mapa-error"><div><div style="font-size:2rem">🗺️</div>' +
        'No se pudo cargar el mapa. Revisa tu conexión a internet e inténtalo de nuevo.</div></div>';
      return null;
    }
    const mapa = L.map(contenedor, { center: centro, zoom, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(mapa);

    // La rueda del ratón solo hace zoom cuando el mapa tiene el foco, para no bloquear el scroll de la página
    mapa.on('focus', () => mapa.scrollWheelZoom.enable());
    mapa.on('blur', () => mapa.scrollWheelZoom.disable());

    activos.add(mapa);
    recalcular(mapa);
    return mapa;
  }

  /** Marcador redondo con el icono y el color de la categoría (vienen de la base de datos). */
  function icono(categoria) {
    const c = Vistas.infoCategoria(categoria);
    return L.divIcon({
      className: 'pin-wrap',
      html: `<div class="pin" style="background:${Vistas.colorOk(c.color)}">${esc(c.icono)}</div>`,
      iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -18],
    });
  }

  /** Contenido de la ventanita de un destino (nodo DOM, para poder enlazar el botón). */
  function ventanita(d, alAbrir) {
    const div = document.createElement('div');
    div.className = 'pop';
    div.innerHTML =
      `<strong>${esc(d.nombre)}</strong><br><small>${esc(d.categoria_nombre || '')}</small>` +
      (d.imagen ? `<img src="${esc(d.imagen.src)}" alt="" loading="lazy">` : '<br>');
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn small';
    boton.textContent = 'Ver detalle';
    boton.addEventListener('click', () => alAbrir && alAbrir(d.id));
    div.append(boton);
    return div;
  }

  /**
   * Mapa con todos los destinos que tengan coordenadas.
   * Devuelve { mapa, total } o null si Leaflet no está disponible.
   */
  function vistaGeneral(contenedor, destinos, alAbrir) {
    const mapa = crear(contenedor);
    if (!mapa) return null;
    const capa = L.featureGroup().addTo(mapa);
    let total = 0;
    for (const d of destinos) {
      if (!coordenadasOk(d.lat, d.lng)) continue;
      L.marker([d.lat, d.lng], { icon: icono(d.categoria), title: d.nombre, alt: d.nombre })
        .bindPopup(ventanita(d, alAbrir))
        .addTo(capa);
      total++;
    }
    if (total) mapa.fitBounds(capa.getBounds(), { padding: [30, 30], maxZoom: 15 });
    return { mapa, total };
  }

  /** Mapa pequeño con un solo punto (detalle del destino y panel de moderación). */
  function punto(contenedor, { lat, lng, nombre, categoria }) {
    if (!coordenadasOk(lat, lng)) return null;
    const mapa = crear(contenedor, { centro: [lat, lng], zoom: 15 });
    if (!mapa) return null;
    L.marker([lat, lng], { icon: icono(categoria), title: nombre || '', alt: nombre || 'Ubicación' }).addTo(mapa);
    return mapa;
  }

  /**
   * Mapa para ELEGIR una ubicación: tocar el mapa o arrastrar el marcador.
   * alCambiar(lat, lng) se llama con 6 decimales (≈10 cm) cada vez que cambia el punto.
   */
  function selector(contenedor, { lat = null, lng = null, categoria = '', alCambiar } = {}) {
    const inicial = coordenadasOk(lat, lng);
    const mapa = crear(contenedor, { centro: inicial ? [lat, lng] : CENTRO, zoom: inicial ? 15 : ZOOM });
    if (!mapa) return null;
    let marcador = null;

    const redondear = (n) => Number(n.toFixed(6));
    function poner(la, lo, centrar = false) {
      la = redondear(la); lo = redondear(lo);
      if (!marcador) {
        marcador = L.marker([la, lo], { icon: icono(categoria), draggable: true, title: 'Arrastra para ajustar' }).addTo(mapa);
        marcador.on('dragend', () => { const p = marcador.getLatLng(); poner(p.lat, p.lng); });
      } else {
        marcador.setLatLng([la, lo]);
      }
      if (centrar) mapa.setView([la, lo], Math.max(mapa.getZoom(), 16));
      if (alCambiar) alCambiar(la, lo);
    }
    function quitar() {
      if (marcador) { marcador.remove(); marcador = null; }
      if (alCambiar) alCambiar(null, null);
    }

    mapa.on('click', (e) => poner(e.latlng.lat, e.latlng.lng));
    if (inicial) poner(lat, lng);
    return { mapa, poner, quitar, cambiarCategoria: (c) => { categoria = c; if (marcador) marcador.setIcon(icono(c)); } };
  }

  /** Ubicación actual del dispositivo. Necesita HTTPS o localhost y el permiso de la persona. */
  function ubicacionActual() {
    return new Promise((resolver, rechazar) => {
      if (!navigator.geolocation) return rechazar(new Error('Tu navegador no permite obtener la ubicación.'));
      if (!window.isSecureContext) {
        return rechazar(new Error('La ubicación solo funciona en una conexión segura (HTTPS) o en localhost.'));
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }),
        (e) => rechazar(new Error(e.code === 1
          ? 'No diste permiso para usar la ubicación. Puedes tocar el mapa para elegir el punto.'
          : 'No se pudo obtener la ubicación. Inténtalo de nuevo o toca el mapa.')),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }

  /** Enlaces externos (no necesitan clave ni cuenta). */
  const enlaces = (lat, lng) => ({
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
    osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
  });

  return { CENTRO, disponible, coordenadasOk, crear, vistaGeneral, punto, selector, ubicacionActual, enlaces, recalcular, liberar };
    /** Destruye un mapa creado con crear() (por ejemplo, al cerrar el formulario). */
  function liberar(mapa) {
    if (mapa && activos.has(mapa)) { mapa.remove(); activos.delete(mapa); }
  }
})();