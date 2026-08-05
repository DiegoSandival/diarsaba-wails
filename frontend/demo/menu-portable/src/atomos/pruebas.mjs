/* ── ÁTOMOS · pruebas ─────────────────────────────────────────────────────────
   LA FUENTE. Se edita aquí, como código: el editor lo colorea, node lo compila
   y los comentarios caben. El pruebas.json de al lado se GENERA de esto con
   herramientas/atomos-a-json.mjs, y es el que lee el cargador.
   ────────────────────────────────────────────────────────────────────────── */

export default {
    // Correr un átomo sin dejarle tocar nada. El banco de pruebas es un place
    // como otro cualquiera: lo que lo hace un banco es que sus átomos se
    // ejecutan aislados.
    "aislamiento #": [
        "pruebas @",
        "pruebas usa #",
        "pruebas #",
        "probar átomo ƒ",
        "sandbox de pruebas §",
        "probar aislado ƒ",
        "probar ƒ",
        "veredicto de ƒ",
        "veredictos :",
        "pintar acciones ƒ",
        "dibujables #",
        "correr pruebas ƒ",
        "fuente de ƒ"
    ],

    /* ══ EL BANCO DE PRUEBAS — "pruebas @" ═══════════════════════════════════ */
    /* Un place donde se corren átomos QUE NO SON DE FIAR. Cada uno se compila y */
    /* se ejecuta dentro de un worker: un mundo sin document, sin el Map y sin    */
    /* nada de aquí, con un reloj encima. Si no contesta a tiempo, se le termina. */
    /* Un bucle infinito deja de ser un cuelgue y pasa a ser un RESULTADO.        */
    /*                                                                            */
    /* Y como del worker sólo vuelven DATOS, un átomo aislado que quiera dibujar   */
    /* devuelve una lista de ACCIONES —lo mismo que un "!"— y las pinta el         */
    /* universo de casa. El sandbox nunca llega al lienzo por su cuenta.           */
    "pruebas @": ["banco de pruebas ~"],

    // Igual que "escena usa #", para este place. Aquí se ve una cosa que la otra
    // lista no tiene: los cinco átomos que se PRUEBAN salen aquí, porque el place
    // los usa — aunque ninguno se ejecute en casa.
    "pruebas usa #": [],

    "pruebas usa # al abrir ƒ": `(lista) => {
      lista.length = 0;
      for (const nombre of diarsaba.get("usados por ƒ")("pruebas @")) lista.push(nombre);
  }`,

    "banco de pruebas ~": ["0 titular !","1 correr pruebas !"],

    "0 titular !": ["texto ƒ","blanco","7px",6,7,1,"pruebas @ — cada átomo corre dentro de un worker"],

    // La lista de lo que se prueba y cuánto se le espera (ms).
    "1 correr pruebas !": ["correr pruebas ƒ","pruebas #",600],

    "pruebas #": [
        "renderizar agujero negro ƒ",
        "renderizar estrella ƒ",
        "renderizar escapista ƒ",
        "renderizar roto ƒ",
        "renderizar cuentas ƒ"
    ],

    // EL CASO: no termina nunca. En casa se lleva la página por delante; aislado
    // es una fila más del informe, "colgada", y el worker se termina.
    "renderizar agujero negro ƒ": `() => { while (true) { /* cálculo infinito */ } }`,

    // Uno que se porta bien: no dibuja, DEVUELVE lo que habría dibujado. Ésa es
    // la forma de que un átomo aislado pinte sin tocar nada.
    "renderizar estrella ƒ": `() => {
      const acciones = [];
      const cx = 72, cy = 42, puntos = [];
      for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const r = i % 2 ? 6 : 15;
          puntos.push([+(cx + Math.cos(a) * r).toFixed(2), +(cy + Math.sin(a) * r).toFixed(2)]);
      }
      puntos.push(puntos[0]);
      acciones.push(["trazo ƒ", "amarillo", "1.5px", 1, puntos]);
      for (let i = 0; i < 10; i += 2)
          acciones.push(["circulo ƒ", "blanco", "2px", puntos[i][0], puntos[i][1], 2]);
      return acciones;
  }`,

    // Intenta salirse: pintar el fondo, leer el Map, mirar el disco. Ahí dentro
    // no existe ninguna de las tres, así que revienta antes de tocar nada. Es la
    // prueba de que el aislamiento no depende de portarse bien.
    "renderizar escapista ƒ": `() => {
      document.body.style.background = "red";
      return diarsaba.get("colores {");
  }`,

    // Uno que lanza: aislado no arrastra a nadie, sólo trae su mensaje.
    "renderizar roto ƒ": `() => { throw new Error("me falta un ala"); }`,

    // Uno que tarda pero acaba, y devuelve un valor a secas: no todo lo que se
    // prueba dibuja.
    "renderizar cuentas ƒ": `() => {
      let n = 0;
      for (let i = 0; i < 3e6; i++) n += i % 7;
      return n;
  }`,

    // Lo ÚNICO que un resultado del sandbox puede nombrar. Sin esto, "devolver
    // acciones" sería devolver el nombre de cualquier función del programa —y
    // entonces el aislamiento no serviría de nada.
    "dibujables #": ["circulo ƒ","trazo ƒ","texto ƒ"],

    "veredictos :": {
        "ok": "verde",
        "colgada": "rojo",
        "reventó": "amarillo",
        "sin aislamiento": "azul",
        "no es función": "azul"
    },

    /* ── CORRER ALGO AISLADO ──────────────────────────────────────────────────
       El aislamiento lo hace el propio universo: crea un Web Worker (un mundo
       sin document, sin el Map, sin nada de aquí), le pasa la fuente, le pone un
       reloj, y si no contesta a tiempo lo termina. `new Worker` y `Blob` son del
       entorno, como `document`; el universo los usa directo, sin host.          */

    // El único código que corre DENTRO del worker: recibe una fuente, la compila
    // allí y devuelve lo que salga. Es un texto (§) — cruza al worker como dato.
    // Sólo lo estructurable vuelve: una función o un elemento no caben en un
    // postMessage, y eso es una garantía, no un límite.
    "sandbox de pruebas §": `
self.onmessage = (e) => {
    const { src, args } = e.data;
    try {
        const f = (new Function("return (" + src + ")"))();
        if (typeof f !== "function") { self.postMessage({ ok: false, motivo: "no es función" }); return; }
        const valor = f.apply(null, args || []);
        self.postMessage({ ok: true, valor: JSON.parse(JSON.stringify(valor ?? null)) });
    } catch (err) {
        self.postMessage({ ok: false, motivo: "reventó", error: String((err && err.message) || err) });
    }
};`,

    // Corre una fuente aislada y resuelve SIEMPRE, con un veredicto:
    //   { ok:true, valor }                     · contestó
    //   { ok:false, motivo:"colgada" }         · se le acabó el tiempo (worker terminado)
    //   { ok:false, motivo:"reventó", error }  · lanzó
    //   { ok:false, motivo:"sin aislamiento" } · no se pudo crear el worker: NO se ejecuta
    // Nunca lanza y nunca se queda esperando: por eso un while(true) no se lleva
    // la página por delante — el reloj lo termina.
    "probar aislado ƒ": `async (fuente, args = [], ms = 600) => {
      let t0 = performance.now();
      const tiempo = () => Math.round(performance.now() - t0);
      let w = null, url = null;
      try {
          url = URL.createObjectURL(new Blob([diarsaba.get("sandbox de pruebas §")], { type: "text/javascript" }));
          w = new Worker(url);
      } catch (e) {
          if (url) URL.revokeObjectURL(url);
          return { ok: false, motivo: "sin aislamiento", error: String(e.message || e), ms: tiempo() };
      }
      t0 = performance.now();
      return new Promise((resolve) => {
          let cerrado = false;
          const cerrar = (r) => {
              if (cerrado) return;
              cerrado = true;
              clearTimeout(reloj);
              w.terminate();
              URL.revokeObjectURL(url);
              resolve({ ...r, ms: tiempo() });
          };
          const reloj = setTimeout(() => cerrar({ ok: false, motivo: "colgada" }), ms);
          w.onmessage = (e) => cerrar(e.data);
          w.onerror = (e) => {
              if (e.preventDefault) e.preventDefault();
              cerrar({ ok: false, motivo: "reventó", error: e.message || "error en el worker" });
          };
          w.postMessage({ src: fuente, args });
      });
  }`,

    // La FUENTE de un átomo: es lo único que cruza al worker. Allí se compila de
    // nuevo, en su mundo — no viaja la función, viaja su texto.
    "fuente de ƒ": `(nombre) => diarsaba.get("mostrar valor ƒ")(diarsaba.get(nombre))`,

    // Probar un átomo por su NOMBRE. Es lo que se llama desde el menú y desde el
    // banco de pruebas.
    "probar átomo ƒ": `async (nombre, ms = 600) => {
      const fuente = diarsaba.get("fuente de ƒ")(nombre);
      if (!fuente) return { ok: false, motivo: "no es función", ms: 0 };
      const r = await diarsaba.get("probar aislado ƒ")(fuente, [], ms);
      const v = diarsaba.get("veredicto de ƒ")(r);
      diarsaba.get("log ƒ")("▶ <b>probar</b> «" + nombre + "» → " + v.nota + " (" + r.ms + " ms)");
      return r;
  }`,

    // El veredicto en color y en palabras. "ok" también dice QUÉ devolvió: unas
    // acciones de dibujo, o un valor a secas.
    "veredicto de ƒ": `(r) => {
      const tabla = diarsaba.get("veredictos :") || {};
      if (r.ok) {
          const acciones = Array.isArray(r.valor);
          return { color: tabla.ok, nota: acciones ? "ok · " + r.valor.length + " acciones"
                                                   : "ok · " + JSON.stringify(r.valor) };
      }
      const motivo = r.motivo || "reventó";
      return { color: tabla[motivo] || "blanco",
               nota: motivo + (r.error ? " · " + r.error : "") };
  }`,

    // Pinta lo que devolvió un átomo aislado. Cada acción es [nombre, ...args],
    // igual que un "!" — pero sólo se aceptan los nombres de "dibujables #": lo
    // que vuelve del sandbox es un dato sospechoso, no una orden.
    "pintar acciones ƒ": `(acciones) => {
      if (!Array.isArray(acciones)) return 0;
      const permitidas = diarsaba.get("dibujables #") || [];
      let n = 0;
      for (const accion of acciones) {
          if (!Array.isArray(accion) || !permitidas.includes(accion[0])) continue;
          const f = diarsaba.get(accion[0]);
          if (typeof f === "function") { f.apply(null, accion.slice(1)); n++; }
      }
      return n;
  }`,

    // EL BANCO: corre la lista entera, una fila por átomo, y pinta lo que los que
    // contestaron hayan devuelto. Es async y se le da igual: cada prueba tiene su
    // propio reloj, así que la peor de todas cuesta "ms" y nada más.
    "correr pruebas ƒ": `async (nombreLista, ms = 600) => {
      const lista = diarsaba.get("lista de ƒ")(nombreLista) || [];
      const texto = diarsaba.get("texto ƒ");
      const circulo = diarsaba.get("circulo ƒ");
      texto("blanco", "5px", 6, 12, 1, lista.length + " átomos · se espera " + ms + " ms a cada uno");
      let y = 22;
      for (const nombre of lista) {
          texto("blanco", "5px", 12, y, 2, nombre);
          const r = await diarsaba.get("probar átomo ƒ")(nombre, ms);
          const v = diarsaba.get("veredicto de ƒ")(r);
          circulo(v.color, "4px", 8, y, 2);
          texto(v.color, "4px", 12, y + 5, 2, v.nota + " · " + r.ms + " ms");
          if (r.ok) diarsaba.get("pintar acciones ƒ")(r.valor);
          y += 14;
      }
      texto("blanco", "4px", 6, 92, 1, "ninguna se ejecutó en casa · la que no termina se termina, y la página ni se enteró");
  }`,

    // Desde el clic derecho: probar ESTE átomo, aislado, sin arriesgar la sesión.
    // Es la opción que hace seguro mirar código ajeno.
    "probar ƒ": `async (dataset) => {
      const sel = diarsaba.get("obtener index [0] ƒ")(dataset.current);
      diarsaba.get("cerrar opciones ƒ")(dataset);
      const r = await diarsaba.get("probar átomo ƒ")(sel.texto);
      const v = diarsaba.get("veredicto de ƒ")(r);
      diarsaba.get("notificar ƒ")(sel.texto + "\\n\\n" + v.nota + "\\n" + r.ms + " ms");
  }`,
};
