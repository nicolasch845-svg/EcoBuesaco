/* =====================================================================
   EcoBuesaco · Formularios
   Validación en el navegador (comodidad) + errores por campo del servidor
   (la validación real y definitiva siempre ocurre en el servidor).
   ===================================================================== */
'use strict';

const Formularios = (() => {
  /* ---------- Errores por campo ---------- */
  function mostrarError(form, nombre, mensaje) {
    const caja = form.querySelector(`[data-err="${nombre}"]`);
    if (caja) caja.textContent = mensaje || '';
    const campo = form.elements[nombre];
    if (campo && campo.setAttribute) campo.setAttribute('aria-invalid', String(!!mensaje));
  }

  function limpiarErrores(form) {
    form.querySelectorAll('[data-err]').forEach((e) => (e.textContent = ''));
    form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  }

  /** Pinta los errores que devolvió el servidor ({campo: mensaje}) y enfoca el primero. */
  function aplicarErroresServidor(form, error) {
    limpiarErrores(form);
    const campos = error.campos || {};
    let primero = null;
    for (const [nombre, msg] of Object.entries(campos)) {
      mostrarError(form, nombre, msg);
      if (!primero && form.elements[nombre]) primero = form.elements[nombre];
    }
    if (Object.keys(campos).length === 0) mostrarError(form, '_general', error.message);
    if (primero && primero.focus) primero.focus();
  }

  /** Aplica reglas {campo: valor => mensaje|''}. Devuelve true si todo es válido. */
  function validar(form, reglas) {
    limpiarErrores(form);
    let ok = true, primero = null;
    for (const [nombre, regla] of Object.entries(reglas)) {
      const el = form.elements[nombre];
      if (!el) continue;
      const valor = el.type === 'password' ? el.value : String(el.value).trim();
      const msg = regla(valor);
      if (msg) {
        ok = false;
        mostrarError(form, nombre, msg);
        primero = primero || el;
      }
    }
    if (primero) primero.focus();
    return ok;
  }

  /* ---------- Reglas reutilizables ---------- */
  const minimo = (etiqueta, n) => (v) => (v.length < n ? `${etiqueta}: mínimo ${n} caracteres.` : '');
  const obligatorio = (etiqueta) => (v) => (v ? '' : `Completa: ${etiqueta}.`);
  const correoOk = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Ingresa un correo válido.');

  function edadDesde(iso) {
    const n = new Date(), b = new Date(iso + 'T00:00:00');
    if (isNaN(b) || b > n) return -1;
    let a = n.getFullYear() - b.getFullYear();
    if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
    return a;
  }

  const reglasRegistro = (edadMinima) => ({
    nombres:    minimo('Nombres', 2),
    apellidos:  minimo('Apellidos', 2),
    usuario:    (v) => (/^[A-Za-z0-9_]{3,20}$/.test(v) ? '' : 'Usa 3 a 20 letras, números o guion bajo.'),
    correo:     correoOk,
    nacimiento: (v) => {
      if (!v) return 'Indica tu fecha de nacimiento.';
      const a = edadDesde(v);
      if (a < 0 || a > 120) return 'La fecha no es válida.';
      return a < edadMinima ? `Debes tener al menos ${edadMinima} años.` : '';
    },
    clave:      (v) => (v.length < 8 || v.length > 72 || !/[A-Za-z]/.test(v) || !/\d/.test(v)
                  ? 'De 8 a 72 caracteres, con letras y números.' : ''),
  });

  const reglasLogin = {
    correo: correoOk,
    clave:  (v) => (v ? '' : 'Ingresa tu contraseña.'),
  };

  const reglasPublicacion = {
    texto: (v) => (v.length < 3 ? 'Escribe al menos 3 caracteres.' : v.length > 1000 ? 'Máximo 1000 caracteres.' : ''),
  };

  const reglasPropuesta = {
    nombre:      (v) => (v.length < 3 ? 'El nombre debe tener al menos 3 caracteres.' : ''),
    descripcion: (v) => (v.length < 20 ? 'La descripción debe tener al menos 20 caracteres.' : ''),
    categoria:   obligatorio('Categoría'),
    ubicacion:   (v) => (v.length < 3 ? 'Indica la ubicación (mínimo 3 caracteres).' : ''),
    duracion:    obligatorio('Duración aproximada'),
  };

  /* ---------- Envío con estado "procesando" ---------- */
  /** Desactiva el botón mientras se ejecuta la acción y lo restaura siempre al terminar. */
  async function conBoton(boton, textoOcupado, accion) {
    if (!boton) return accion();
    const original = boton.textContent;
    boton.disabled = true;
    boton.textContent = textoOcupado;
    try {
      return await accion();
    } finally {
      boton.disabled = false;
      boton.textContent = original;
    }
  }

  /* ---------- Fotografías ---------- */
  /**
   * Gestor de fotos para el formulario de propuestas.
   * Valida tipo, tamaño y cantidad; genera vista previa y detecta la orientación.
   */
  function crearGestorFotos({ max, maxMb, tipos = ['image/jpeg', 'image/png', 'image/webp'], alCambiar, alError }) {
    let fotos = [];   // { file, url, orientacion }

    function agregar(archivos) {
      let aviso = '';
      for (const file of archivos) {
        if (fotos.length >= max)            { aviso = `Máximo ${max} fotografías.`; break; }
        if (!tipos.includes(file.type))     { aviso = `“${file.name}” no es JPG, PNG o WebP.`; continue; }
        if (file.size > maxMb * 1048576)    { aviso = `“${file.name}” supera ${maxMb} MB.`; continue; }

        const item = { file, url: URL.createObjectURL(file), orientacion: '…' };
        fotos.push(item);

        const sonda = new Image();
        sonda.onload = () => {
          const r = sonda.naturalWidth / sonda.naturalHeight;
          item.orientacion = r > 1.05 ? 'horizontal' : r < 0.95 ? 'vertical' : 'cuadrada';
          alCambiar(fotos);
        };
        sonda.onerror = () => {   // archivo corrupto: se descarta
          quitarPorObjeto(item);
          alError(`“${file.name}” no es una imagen válida.`);
        };
        sonda.src = item.url;
      }
      alError(aviso);
      alCambiar(fotos);
    }

    function quitarPorObjeto(item) {
      const i = fotos.indexOf(item);
      if (i >= 0) { URL.revokeObjectURL(item.url); fotos.splice(i, 1); alCambiar(fotos); }
    }

    function quitar(indice) {
      if (fotos[indice]) { URL.revokeObjectURL(fotos[indice].url); fotos.splice(indice, 1); alCambiar(fotos); }
    }

    function vaciar() {
      fotos.forEach((f) => URL.revokeObjectURL(f.url));
      fotos = [];
      alCambiar(fotos);
    }

    return { agregar, quitar, vaciar, lista: () => fotos };
  }

  /** Construye el FormData de la propuesta (los archivos van como fotos[]). */
  function datosPropuesta(form, fotos) {
    const fd = new FormData();
    for (const campo of ['nombre', 'descripcion', 'categoria', 'ubicacion', 'dificultad', 'duracion', 'mejor_epoca', 'recomendaciones', 'latitud', 'longitud']) {
      if (form.elements[campo]) fd.append(campo, form.elements[campo].value.trim());
    }
    fotos.forEach((f) => fd.append('fotos[]', f.file, f.file.name));
    return fd;
  }

  /** Convierte un formulario simple en objeto (sin recortar contraseñas). */
  function aObjeto(form) {
    const o = {};
    for (const el of form.elements) {
      if (!el.name || el.type === 'submit' || el.type === 'file') continue;
      o[el.name] = el.type === 'password' ? el.value : String(el.value).trim();
    }
    return o;
  }

  return {
    validar, limpiarErrores, mostrarError, aplicarErroresServidor,
    reglasRegistro, reglasLogin, reglasPublicacion, reglasPropuesta,
    conBoton, crearGestorFotos, datosPropuesta, aObjeto,
  };
})();