/* ── ÁTOMOS · nucleo ─────────────────────────────────────────────────────────
   LA FUENTE. Se edita aquí, como código: el editor lo colorea, node lo compila
   y los comentarios caben. El nucleo.json de al lado se GENERA de esto con
   herramientas/atomos-a-json.mjs, y es el que lee el cargador.
   ────────────────────────────────────────────────────────────────────────── */

export default {
    /* ── datos ── */

    // Los sigilos que el despacho reconoce como TIPO de átomo.
    "types list #": ["~","ƒ","!","$","§","#","[]","֎","<","{",":","@"],

    // Los que tienen NATURALEZA DE LISTA: por dentro son un array, y por tanto se
    // abren, se les añade, se les quita y se les cambia el orden IGUAL.
    //   "#" una lista · "~" un thread (sus pasos) · "!" una acción (fn + argumentos)
    //
    // Pulsarlos hace lo mismo con los tres: ABRIR. Ejecutar un thread o una acción
    // es una opción de su clic derecho ("ejecutar ƒ"), no lo que pasa al tocarlos:
    // mirar por dentro no debería depender de qué sigilo tiene la cosa.
    "sigilos lista #": ["#","~","!"],

    // Lo que muestra un menú nacido del fondo: la puerta de entrada al programa.
    // Desde aquí se llega a TODO lo que hay, por temas y también en crudo.
    "sys #": [
        "todos #",
        "sigilos #",
        "opciones #",
        "borde #",
        "despacho #",
        "listas #",
        "valores #",
        "places ƒ #",
        "logs #"
    ],

    "diarsaba #": ["sys #","estilos #","marcado #","places #","escena #","aislamiento #"],

    // Los PLACES que hay. Pulsar uno VIAJA a él: le entrega el lienzo entero.
    "places #": ["escena @","pruebas @"],

    // El programa entero, tal cual está el Map AHORA. No se guarda: se calcula al
    // abrirla (ver "todos # al abrir ƒ"), así que no puede quedarse vieja ni
    // esconder un átomo creado hace un segundo. Escribir aquí a mano no sirve de
    // nada: al volver a mirarla se rehace.
    "todos #": [],

    // Los sigilos: el vocabulario con el que el despacho lee un nombre.
    "sigilos #": ["types list #","sigilos lista #"],

    // El ESTILO del programa, en átomos "{" (CSS). Abrir uno y editarlo cambia
    // cómo se ve esto mientras lo miras: no hay hoja de estilo que recargar.
    "estilos #": [
        "estilo base {",
        "estilo del lienzo {",
        "estilo del menú {",
        "estilo del modal {",
        "estilo del editor {",
        "install style manager ƒ"
    ],

    // El BORDE: lo único que habla con el shell. Cada uno es una línea que pide
    // un dibujo o un dato; ninguno toca el DOM.
    "borde #": [
        "create list menu ƒ",
        "close menu ƒ",
        "clear menus ƒ",
        "repintar lista ƒ",
        "rect de ítem ƒ",
        "lista de menú ƒ",
        "modal input ƒ",
        "install style manager ƒ"
    ],

    // El MARCADO del programa: los átomos "<" (HTML) y lo que los rellena. Es la
    // otra mitad de "estilos #": ahí el CSS, aquí la forma.
    "marcado #": [
        "menu <",
        "menu item <",
        "circulo <",
        "trazo <",
        "texto <",
        "plantilla ƒ",
        "escapar ƒ",
        "pintar menú ƒ"
    ],

    // El DESPACHO: qué pasa cuando pulsas algo. Entra un gesto, sale una decisión.
    "despacho #": [
        "show context menu ƒ",
        "handle click ƒ",
        "despachar menú ƒ",
        "dispatch item ƒ",
        "open submenu ƒ",
        "cerrar opciones ƒ",
        "obtener index [0] ƒ"
    ],

    // Cómo se lee una lista y qué se dibuja de ella.
    "listas #": ["lista de ƒ","ítems de menú ƒ","opciones de ƒ","menciones de ƒ","usados por ƒ"],

    // Cómo se lee y se escribe el VALOR de un átomo, y dónde se guarda lo tomado.
    "valores #": ["interpretar valor ƒ","mostrar valor ƒ","tomado §","lenguajes :","ai system §"],

    // Viajar de un place a otro: lo que le cambia el lienzo al programa.
    "places ƒ #": ["viajar a place ƒ","repintar place ƒ","viajar ƒ","ver dentro ƒ","usa ƒ","place actual §"],

    // La bitácora: host.log escribe aquí, y se lee como un submenú más.
    "logs #": [],

    /* ── LO QUE OFRECE UN CLIC DERECHO ───────────────────────────────────────── */
    /* Todas son funciones con su nombre a secas y su sigilo "ƒ": nada de          */
    /* etiquetas especiales. El despacho las toma por el sigilo, como a cualquier  */
    /* otra, y el clic derecho sobre ellas ofrece "editor ƒ". Las opciones del     */
    /* programa se leen y se editan igual que el resto del programa.               */

    // Las de UN ELEMENTO de una lista (clic derecho sobre el ítem).
    "list option [] #": ["tomar ƒ","cortar ƒ","antes ƒ","despues ƒ","eliminar ƒ"],

    // Y las propias de cada SIGILO, que se SUMAN a las de arriba: aquí solo va lo
    // que ese tipo tiene DE MÁS. El menú se arma en "opciones de ƒ".
    //
    // Un thread y una acción se ABREN al pulsarlos, como cualquier lista; lo que
    // tienen de más es poder ponerse en marcha, y eso se pide desde aquí.
    "list option ~ #": ["ejecutar ƒ"],

    "list option ! #": ["ejecutar ƒ"],

    "list option $ #": ["editor ƒ","editar ƒ"],

    "list option § #": ["editor ƒ","editar ƒ"],

    // Una función: el EDITOR para el cuerpo, el modal para un cambio rápido de una
    // línea, y "probar ƒ" para verla correr AISLADA — que es la única manera de
    // ejecutar algo que no se ha leído.
    "list option ƒ #": ["editor ƒ","editar ƒ","probar ƒ"],

    // Un PLACE: pulsarlo ya es viajar, así que lo que tiene de más es poder
    // mirarse por dentro sin salir de donde estás — y viajar también desde aquí.
    "list option @ #": ["viajar ƒ","ver dentro ƒ","usa ƒ"],

    // Un "{" es un ESTILO (CSS), como en la app; la estructura JSON es ":". Los
    // dos se abren en el editor con su lenguaje, y el modal queda para el cambio
    // rápido de una línea.
    "list option { #": ["editor ƒ","editar ƒ"],

    // Las del MENÚ como tal (clic derecho sobre su título), frente a las de
    // arriba, que son las de un elemento suyo.
    "menu acciones #": ["nuevo ƒ","cerrar ƒ"],

    // Y todo eso junto, para poder abrirlo desde el menú y cambiarlo en vivo:
    // quitarle una opción a un tipo es quitar un elemento de una lista.
    "opciones #": [
        "menu acciones #",
        "list option [] #",
        "list option ~ #",
        "list option ! #",
        "list option $ #",
        "list option § #",
        "list option ƒ #",
        "list option @ #",
        "list option { #",
        "list option : #",
        "list option < #"
    ],

    // Lo último tomado. Es un átomo como cualquier otro: se ve, se edita, se
    // guarda con el programa. No hay portapapeles escondido en el shell.
    "tomado §": "",

    // El place al que se ha viajado. Un átomo, no una variable del shell.
    "place actual §": "",

    /* ── funciones (texto fuente, compilado por createFunction) ── */

    // VIAJAR: el lienzo entero pasa a ser de ese place. Barre los widgets
    // abiertos (los menús son de donde estabas), limpia y ejecuta sus threads.
    "viajar a place ƒ": `(nombre) => {
      const pasos = diarsaba.get("lista de ƒ")(nombre);
      if (!pasos) return false;
      host.clearMenus(true);
      host.limpiarLienzo(nombre);
      diarsaba.set("place actual §", nombre);
      host.log("▶ <b>viajar</b> a «" + nombre + "» (" + pasos.length + " threads)");
      for (const paso of pasos) threads(paso);
      return true;
  }`,

    // Volver a pintar el place donde ya estás: es lo que se pide después de
    // cambiar un color o un tamaño para VERLO.
    "repintar place ƒ": `() => {
      const nombre = diarsaba.get("place actual §");
      if (nombre) diarsaba.get("viajar a place ƒ")(nombre);
  }`,

    // Desde el clic derecho: viajar al place de ESTE elemento.
    "viajar ƒ": `(dataset) => {
      const sel = diarsaba.get("obtener index [0] ƒ")(dataset.current);
      diarsaba.get("viajar a place ƒ")(sel.texto);
  }`,

    // Mirar DENTRO de un place sin viajar: sus threads, como un submenú más.
    // Un "@" no se abre al pulsarlo (pulsarlo es viajar), así que abrirlo se
    // pide desde aquí.
    //
    // Cuelga de "dataset.desde" —el menú que LISTA el place—, no del menú de
    // opciones: así el resultado ocupa el sitio de las opciones (abrir un hijo
    // cierra los hermanos, que es lo que hace el árbol) y se cierra cuando se
    // cierra aquél. Con esto no hace falta nada más: título para cerrarlo, Esc
    // que lo barre y opciones sobre sus ítems salen del árbol, ya hechas.
    "ver dentro ƒ": `(dataset) => {
      const sel = diarsaba.get("obtener index [0] ƒ")(dataset.current);
      const rect = dataset.rect || { right: 40, top: 40 };
      host.log("  ↳ <b>dentro</b> de «" + sel.texto + "»");
      diarsaba.get("open submenu ƒ")(sel.texto, rect, dataset.desde);
  }`,

    // Rehace "todos #" con lo que el Map tiene AHORA. Recibe la misma lista y la
    // vacía en el sitio (no la sustituye) para que los menús abiertos sigan
    // mirando el array de siempre. Ordenada, que es para leerla.
    //
    // Es el único átomo que se mira a sí mismo, y por eso el programa no puede
    // ocultarse nada: lo que existe, sale aquí.
    "todos # al abrir ƒ": `(lista) => {
      lista.length = 0;
      for (const clave of [...diarsaba.keys()].sort()) lista.push(clave);
  }`,

    /* ── QUÉ USA UN ÁTOMO ─────────────────────────────────────────────────────
       La dirección de IDA. En la app hay "referencias de ƒ", que es la vuelta
       —quién me nombra—; esto es lo contrario: a quién nombro yo. Las dos se
       CALCULAN cada vez, por lo mismo: la verdad vive en los átomos, y un índice
       guardado habría que mantenerlo en cada tomar/quitar/eliminar y mentiría en
       cuanto alguien lo olvidara.                                                */

    // Los átomos que ESTE átomo menciona, directamente. Sólo cuentan los que
    // EXISTEN: así un argumento como "amarillo" o "10px" no se confunde con un
    // nombre, y un nombre a medio escribir no inventa una dependencia.
    //
    // El criterio es el de "referencias de ƒ" del revés: igualdad exacta donde
    // la referencia es ESTRUCTURAL (un elemento de una lista, un paso de un
    // thread, un argumento de una acción) y SUBCADENA donde es TEXTO (el código
    // de una ƒ, un §, un mapa ":"). Lo segundo puede dar algún falso positivo si
    // un nombre contiene a otro; a cambio encuentra las que se arman a mano.
    "menciones de ƒ": `(nombre) => {
      const valor = diarsaba.get(nombre);
      const dentro = [];

      // Estructural: una lista, un thread, una acción, un place.
      if (Array.isArray(valor)) {
          for (const x of valor) if (typeof x === "string" && diarsaba.has(x)) dentro.push(x);
          return [...new Set(dentro)];
      }

      // Texto: el código de una ƒ, o un dato donde un nombre puede aparecer.
      let texto = null;
      if (typeof valor === "function") texto = String(valor);
      else if (typeof valor === "string") texto = valor;
      else if (valor && typeof valor === "object") { try { texto = JSON.stringify(valor); } catch (e) {} }
      if (texto === null) return [];

      for (const clave of diarsaba.keys()) {
          if (clave === nombre || typeof clave !== "string") continue;
          if (texto.includes(clave)) dentro.push(clave);
      }
      return [...new Set(dentro)];
  }`,

    // Todo lo que hace falta para que un átomo funcione: sus menciones, las de
    // sus menciones, y así hasta que no aparezca nada nuevo. El propio átomo no
    // sale en su lista — es de lo que USA, no de lo que es.
    //
    // Con esto, "los átomos de una escena" no es una lista que alguien mantenga:
    // es una pregunta que se le hace al programa.
    "usados por ƒ": `(raiz) => {
      const vistos = new Set();
      const cola = [raiz];
      const menciones = diarsaba.get("menciones de ƒ");
      while (cola.length) {
          for (const m of menciones(cola.shift())) {
              if (vistos.has(m) || m === raiz) continue;
              vistos.add(m);
              cola.push(m);
          }
      }
      return [...vistos].sort();
  }`,

    // Desde el clic derecho de un place: los átomos que usa. La respuesta se
    // GUARDA en su lista —«escena @» → «escena usa #»— y se abre como submenú.
    //
    // Guardarla no es cachearla: es que el árbol de menús sólo sabe mostrar
    // ÁTOMOS (un menú lleva el nombre de lo que muestra, y de ahí salen su
    // título, sus opciones y su repintado). Una lista calculada al aire no
    // podía cerrarse ni ofrecer opciones justamente por no ser nadie. Al ser un
    // átomo, además se puede mirar, tomar y editar como cualquier otro.
    //
    // La lista NACE al nombrarla si no existía ("lista de ƒ" lo hace con los
    // sigilos de lista), así que esto vale igual para un place de mañana.
    "usa ƒ": `(dataset) => {
      const sel = diarsaba.get("obtener index [0] ƒ")(dataset.current);
      const nombre = sel.texto.slice(0, -2) + " usa #";      // "escena @" → "escena usa #"
      const lista = diarsaba.get("lista de ƒ")(nombre);
      lista.length = 0;
      for (const usado of diarsaba.get("usados por ƒ")(sel.texto)) lista.push(usado);
      host.log("  ↳ «" + sel.texto + "» <b>usa</b> " + lista.length + " átomos");
      diarsaba.get("open submenu ƒ")(nombre, dataset.rect || { right: 40, top: 40 }, dataset.desde);
  }`,

    // Parsea el prefijo de un ítem de LISTA: "[2] hola" → {indice:2, texto:"hola"}
    "obtener index [0] ƒ": `(texto) => {
      const regex = /^\\[(\\d+)\\]\\s*(.*)$/;
      const match = texto.match(regex);
      if (!match) throw new Error('Formato inválido. Se esperaba: "[número] texto"');
      return { indice: parseInt(match[1], 10), texto: match[2].trim() };
  }`,

    /* ══ EL MARCADO ES DEL PROGRAMA ═══════════════════════════════════════════
       Igual que el estilo son átomos "{", la FORMA es un átomo "<": HTML de
       verdad, editable desde el menú con resaltado de HTML. El shell ya no
       construye un menú — recibe el marcado hecho y sólo se ocupa de lo que no
       es forma: el id, el sitio, el clic y el árbol.

       El shell reconoce DOS ganchos en ese marcado, y nada más:
         .menu-item[data-idx="N"]   un ítem y su índice
         .menu-titulo               el título (pulsarlo va del MENÚ)
       Mientras existan, el marcado puede ser el que quieras.                  */

    // La plantilla de un menú. Se rellena con "plantilla ƒ": {{clave}} escapa el
    // valor, {{{clave}}} lo mete crudo (para lo que ya es marcado).
    //
    // El título lleva el nombre de lo que el menú muestra: con varios abiertos es
    // lo que dice cuál es cuál, y es donde se pulsa para las acciones del menú.
    // No es un ítem, así que no altera los índices.
    "menu <": `<span class="menu-titulo">{{titulo}}</span>{{{items}}}`,

    // Un ítem. Aparte de la plantilla del menú porque se repite: uno por
    // elemento, y el índice que se ve es el índice que es.
    "menu item <": `<span class="menu-item" data-idx="{{indice}}">{{texto}}</span>`,

    // Rellena una plantilla. Dos llaves escapan; tres, no. Es toda la maquinaria
    // que hace falta —no hay lenguaje de plantillas que aprender— y el escapado
    // por defecto es lo que impide que el nombre de un átomo ajeno (de un
    // programa que te llegó por la red) inyecte marcado.
    "plantilla ƒ": `(html, valores) => {
      return String(html)
          .replace(/\\{\\{\\{(\\w+)\\}\\}\\}/g, (_, k) => (valores[k] ?? ""))
          .replace(/\\{\\{(\\w+)\\}\\}/g, (_, k) => diarsaba.get("escapar ƒ")(valores[k]));
  }`,

    // Un valor, listo para meter en HTML. No-texto → JSON, y & < > " se van a sus
    // entidades. Vivía en el shell (_render); ahora es del programa, porque quien
    // arma el marcado es el programa.
    "escapar ƒ": `(v) => {
      const t = typeof v === "string" ? v : (() => {
          try { return JSON.stringify(v); } catch (e) { return String(v); }
      })();
      return t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }`,

    // El HTML de un menú: su título y sus ítems. Aquí es donde el programa decide
    // cómo se ve un menú — antes esto era "_paint" y vivía donde no se podía leer.
    "pintar menú ƒ": `(titulo, lista) => {
      const plantilla = diarsaba.get("plantilla ƒ");
      const item = diarsaba.get("menu item <");
      let items = "";
      let i = 0;
      for (const texto of lista) items += plantilla(item, { indice: i++, texto });
      return plantilla(diarsaba.get("menu <"), { titulo, items });
  }`,

    // Shims del BORDE: el átomo pide el widget, el shell lo pone.
    // onPick null = el shell entrega el payload (no cruza una función).
    //
    // Recibe la LISTA y pinta aquí el marcado: el shell recibe HTML. Un menú de
    // opciones va de UN elemento ("current"), así que su título es ése y no el de
    // la lista de la que cuelga.
    "create list menu ƒ": `(list, parent = "", current = "", x = null, y = null, onPick, desde = "") => {
      const html = diarsaba.get("pintar menú ƒ")(current || parent, list);
      return host.menu(html, parent, current, x, y, onPick ?? null, desde);
  }`,

    "close menu ƒ": `(id) => host.closeMenu(id)`,

    // El estilo del programa a la vista: cada átomo "{" se vuelve un <style>, y
    // guardar uno lo repinta al instante (el shell envuelve diarsaba.set). Lo
    // pide el universo al arrancar; el HTML no trae ninguna hoja de estilo.
    "install style manager ƒ": `() => host.installStyles()`,

    // Repinta donde sea que esa lista esté abierta. El átomo dice QUÉ lista
    // cambió, no qué menú: quién la esté mostrando es cosa del shell.
    "rect de ítem ƒ": `(id, index) => host.itemRect(id, index)`,

    "lista de menú ƒ": `(id) => host.listaDe(id)`,

    // Repinta esa lista donde sea que esté abierta. El átomo dice QUÉ lista
    // cambió; el shell dice QUIÉN la muestra, y el átomo pinta. Antes el shell
    // hacía las dos últimas cosas.
    "repintar lista ƒ": `(nombre) => {
      const html = diarsaba.get("pintar menú ƒ")(nombre, diarsaba.get("ítems de menú ƒ")(nombre));
      let n = 0;
      for (const id of host.menusDe(nombre)) if (host.repintar(id, html)) n++;
      return n;
  }`,

    // Shim del BORDE: el shell pide el nombre (host.modal). Igual que en la app.
    "modal input ƒ": `async (pre) => {
      return host.modal(pre);
  }`,

    // (Aquí estaba "create list ƒ", el segundo mecanismo: una lista suelta, con
    //  ítems "[n] ", fuera del árbol. Se fue con él — todo se abre como submenú,
    //  y por eso todo se puede cerrar y tiene opciones.)

    "clear menus ƒ": `() => host.clearMenus()`,

    /* ── qué se DIBUJA de una lista ──────────────────────────────────────────── */

    // El array que hay DENTRO de un átomo de naturaleza lista. Si el sigilo dice
    // que es una lista pero el átomo todavía no existe, NACE aquí, vacío:
    // nombrar una lista ya es tenerla. Vale igual para "#", "~" y "!".
    //
    // Sin esto, escribir un elemento nuevo "algo ~" daba un ítem muerto: no se
    // podía abrir por estar vacío, y sin abrirlo tampoco se le podía añadir nada.
    "lista de ƒ": `(nombre) => {
      if (typeof nombre !== "string") return null;
      let lista = diarsaba.get(nombre);
      if (!Array.isArray(lista) && diarsaba.get("sigilos lista #").includes(nombre.slice(-1))) {
          lista = [];
          diarsaba.set(nombre, lista);
          host.log("· <b>nace</b> «" + nombre + "», vacía");
      }
      return Array.isArray(lista) ? lista : null;
  }`,

    // Lo que un menú dibuja es la lista y NADA MÁS. Sus propias acciones no se
    // cuelan entre los datos: viven en el clic derecho sobre su título. Así todo
    // ítem de un menú es un elemento de verdad, y el índice que se ve es el índice
    // que es.
    "ítems de menú ƒ": `(nombre) => diarsaba.get("lista de ƒ")(nombre) || []`,

    // Las opciones de UN elemento: las propias de su SIGILO, si su tipo tiene
    // alguna, más las comunes a cualquier elemento. Un elemento sin tipo conocido
    // cae en las comunes y ya está.
    // (Se mira con get y no con "lista de ƒ": si "list option x #" no existe, NO
    //  debe nacer por preguntar.)
    "opciones de ƒ": `(nombre) => {
      const propias = diarsaba.get("list option " + nombre.slice(-1) + " #");
      return [...(Array.isArray(propias) ? propias : []),
              ...diarsaba.get("list option [] #")];
  }`,

    /* ── leer y escribir el VALOR de un átomo ────────────────────────────────── */

    // Un átomo se interpreta según su SIGILO: es lo que hace que "1000" sea el
    // número 1000 y no el texto "1000". Es la misma regla del bootstrap.
    "interpretar valor ƒ": `(nombre, texto) => {
      const tipo = nombre.slice(-1);
      if (tipo === "$") return Number(texto);
      if (tipo === "ƒ") return createFunction(texto);
      // Un ":" es una estructura: se guarda como objeto, no como su texto. Si el
      // JSON no vale, se queda lo que había (devolver el texto lo rompería).
      if (tipo === ":") { try { return JSON.parse(texto); } catch (e) { return diarsaba.get(nombre); } }
      return texto;
  }`,

    // Cómo se muestra un valor para editarlo. Una "ƒ" se muestra como su FUENTE:
    // createFunction guarda el texto compilado, y String() lo devuelve.
    "mostrar valor ƒ": `(valor) => {
      if (valor === undefined || valor === null) return "";
      if (typeof valor === "function") return String(valor);
      return typeof valor === "string" ? valor : JSON.stringify(valor);
  }`,

    // Abre el CUERPO de una función en el editor. Es el átomo de la app real,
    // igual: pide host.editor, y lo que vuelve se compila con createFunction y se
    // guarda. Si no compila, no se toca nada y se avisa.
    "editor ƒ": `async (dataset) => {
      const sel = diarsaba.get("obtener index [0] ƒ")(dataset.current);
      const nombre = sel.texto;
      const tipo = nombre.slice(-1);
      const lang = (diarsaba.get("lenguajes :") || {})[tipo] || "text";
      const fuente = diarsaba.get("mostrar valor ƒ")(diarsaba.get(nombre));
      // El selector del editor deja cambiar el lenguaje a mano: esto es sólo
      // con cuál se ABRE. Un átomo puede guardar HTML en un "§" y verse como
      // HTML sin que su sigilo cambie.
      const res = await host.editor(nombre, fuente, lang);
      if (res === null) return;
      if (tipo === ":") {
          try { JSON.parse(res); }
          catch (e) { host.notify(nombre + " no se guardó: el JSON no vale.\\n\\n" + e.message); return; }
      }
      try {
          diarsaba.set(nombre, diarsaba.get("interpretar valor ƒ")(nombre, res));
          host.log("▶ <b>" + nombre + "</b> guardada desde el editor (" + lang + ")");
      } catch (e) {
          host.notify('"' + nombre + '" no se guardó: ' + e.message);
      }
      diarsaba.get("cerrar opciones ƒ")(dataset);
  }`,

    // Cambiar el valor de un átomo desde el menú. El modal se abre CON el valor
    // actual dentro, así que la misma opción sirve para verlo y para cambiarlo.
    //
    // Aquí está el reparto entre modal y editor: una línea entra bien; un cuerpo
    // de varias, no — un <input> se come los saltos de línea y guardaría la
    // función destrozada. Para eso está "editor ƒ".
    "editar ƒ": `async (dataset) => {
      const sel = diarsaba.get("obtener index [0] ƒ")(dataset.current);
      const nombre = sel.texto;
      const antes = diarsaba.get(nombre);
      const fuente = diarsaba.get("mostrar valor ƒ")(antes);
      if (fuente.includes("\\n")) {
          host.log("· «" + nombre + "» tiene varias líneas: eso pide «<b>editor ƒ</b>», no el modal");
          return;
      }
      const texto = await diarsaba.get("modal input ƒ")(fuente);
      if (texto === null) return;
      diarsaba.set(nombre, diarsaba.get("interpretar valor ƒ")(nombre, texto));
      host.log("▶ <b>" + nombre + "</b> = " + texto);
      diarsaba.get("cerrar opciones ƒ")(dataset);
  }`,

    /* ── editar la lista: agregar, quitar, mover ─────────────────────────────── */
    /* Todas reciben el dataset del ítem pulsado:                                 */
    /*   parent  = la lista        current = "[i] texto" del elemento             */
    /*   menu    = el menú donde se pulsó (el de opciones)                        */
    /*   desde   = el menú del que ése cuelga (el que muestra la lista)           */

    // Poner en marcha un thread o una acción. Es lo ÚNICO que un "~" o un "!"
    // tienen de más: pulsarlos los abre, como a cualquier lista, y ejecutarlos se
    // pide aparte. Antes era al revés, y eso obligaba a un "abrir" aparte que ya
    // no hace falta — pulsar es abrir para los tres sigilos.
    "ejecutar ƒ": `(dataset) => {
      const sel = diarsaba.get("obtener index [0] ƒ")(dataset.current);
      host.log("▶ <b>ejecutar</b> «" + sel.texto + "»");
      diarsaba.get("cerrar opciones ƒ")(dataset);
      threads(sel.texto);
  }`,

    // Copia el elemento al átomo "tomado §".
    "tomar ƒ": `(dataset) => {
      const sel = diarsaba.get("obtener index [0] ƒ")(dataset.current);
      diarsaba.set("tomado §", sel.texto);
      host.log("▶ <b>tomar</b> «" + sel.texto + "»");
      diarsaba.get("cerrar opciones ƒ")(dataset);
  }`,

    // Tomar Y quitar: pegarlo luego con "antes"/"despues" es MOVER, no copiar.
    "cortar ƒ": `(dataset) => {
      const sel = diarsaba.get("obtener index [0] ƒ")(dataset.current);
      diarsaba.set("tomado §", sel.texto);
      diarsaba.get(dataset.parent).splice(sel.indice, 1);
      host.log("▶ <b>cortar</b> «" + sel.texto + "»");
      diarsaba.get("cerrar opciones ƒ")(dataset);
  }`,

    // Pegar lo tomado en el hueco de antes / de después de este elemento.
    // Sin nada tomado no hay nada que pegar: se avisa y no se toca la lista.
    "antes ƒ": `(dataset) => {
      const tomado = diarsaba.get("tomado §");
      if (!tomado) { host.log("· nada tomado todavía"); return; }
      const sel = diarsaba.get("obtener index [0] ƒ")(dataset.current);
      diarsaba.get(dataset.parent).splice(sel.indice, 0, tomado);
      host.log("▶ <b>antes</b> de «" + sel.texto + "»");
      diarsaba.get("cerrar opciones ƒ")(dataset);
  }`,

    "despues ƒ": `(dataset) => {
      const tomado = diarsaba.get("tomado §");
      if (!tomado) { host.log("· nada tomado todavía"); return; }
      const sel = diarsaba.get("obtener index [0] ƒ")(dataset.current);
      diarsaba.get(dataset.parent).splice(sel.indice + 1, 0, tomado);
      host.log("▶ <b>despues</b> de «" + sel.texto + "»");
      diarsaba.get("cerrar opciones ƒ")(dataset);
  }`,

    "eliminar ƒ": `(dataset) => {
      const sel = diarsaba.get("obtener index [0] ƒ")(dataset.current);
      diarsaba.get(dataset.parent).splice(sel.indice, 1);
      host.log("▶ <b>eliminar</b> «" + sel.texto + "»");
      diarsaba.get("cerrar opciones ƒ")(dataset);
  }`,

    // Cierra el menú de opciones y repinta la lista recién tocada donde esté
    // abierta. Con esto la edición SE VE al instante.
    "cerrar opciones ƒ": `(dataset) => {
      diarsaba.get("close menu ƒ")(dataset.menu);
      diarsaba.get("repintar lista ƒ")(dataset.parent);
  }`,

    // OJO: éstas viven en el menú del TÍTULO, que CUELGA del menú al que se
    // refieren. Por eso el menú sobre el que actúan es "dataset.desde", no
    // "dataset.menu" (que es el menú de acciones, el de usar y tirar).
    //
    // Un elemento NUEVO al final de la lista del menú de abajo.
    // "dataset.parent" es «menu acciones #» —lo que este menú muestra—, así que la
    // lista sobre la que se actúa se pide por el id del menú del que cuelga.
    // Es async porque el nombre lo pide el MODAL del shell: el átomo espera el
    // valor y no sabe cómo se dibujó (ni le importa).
    "nuevo ƒ": `async (dataset) => {
      const nombre = diarsaba.get("lista de menú ƒ")(dataset.desde);
      const lista = diarsaba.get("lista de ƒ")(nombre);
      if (!lista) return;
      const texto = await diarsaba.get("modal input ƒ")("");
      if (texto === null || texto === "") return;
      lista.push(texto);
      host.log("▶ <b>nuevo</b> «" + texto + "» en «" + nombre + "»");
      diarsaba.get("close menu ƒ")(dataset.menu);
      diarsaba.get("repintar lista ƒ")(nombre);
  }`,

    /* ══ EL CORAZÓN ═══════════════════════════════════════════════════════════ */

    // Despacha el clic sobre un ítem. Recibe DATOS del shell:
    //   p = { label, index, rect, parent, current, menu, desde }
    // "rect" es la caja del ítem: con ella se ancla el submenú a su derecha.
    // "menu" es el id del menú donde se pulsó: se pasa entero en el dataset, y así
    // un átomo como "cerrar ƒ" sabe a QUÉ menú se refiere.
    //
    // Ningún ítem cierra ya el menú al elegirlo: los menús se quedan abiertos
    // —conviven varios— hasta que se pulsa su "cerrar ƒ" (o Esc barre todos).
    //
    // (Aquí había DOS ramas: una para ítems de menú y otra para ítems de lista,
    //  con su prefijo "[n] " que había que parsear. Ya no hay listas —todo es el
    //  árbol— así que la etiqueta es siempre el nombre a secas, y queda una.)
    "despachar menú ƒ": `async (p) => {
      const content = p.label;
      const rect = p.rect;
      const dataset = { parent: p.parent, current: p.current, menu: p.menu,
                        desde: p.desde, rect: p.rect };

      host.log("· clic en «<b>" + content + "</b>»");

      const tipo = content.slice(-1);
      // Todo lo que es una lista por dentro se ABRE como submenú, colgado del
      // menú donde se pulsó. Da igual que sea una lista, un thread o una acción:
      // mirar dentro es el mismo gesto.
      if (diarsaba.get("sigilos lista #").includes(tipo)) {
          if (diarsaba.get("open submenu ƒ")(content, rect, p.menu)) return;
      } else if (diarsaba.get("types list #").includes(tipo)) {
          // Lo que no es una colección cobra vida según su sigilo.
          if (diarsaba.get("dispatch item ƒ")(content, dataset, rect)) return;
      }
      // (En la app real, aquí va la rama de los CREADORES: si existe
      //  "create <label> ƒ", pide un nombre por modal y crea el átomo.)
      //
      // Y aquí iba el atajo para etiquetas SIN sigilo —"· # eliminar" y el
      // resto de opciones—, que buscaba "<etiqueta> ƒ". Ya no hace falta:
      // ahora las opciones se llaman "eliminar ƒ" y el sigilo las despacha
      // como a cualquier función. Una regla menos, y una regla sola.
  }`,

    // Dibuja el contenido de una colección como menú, con la misma función que los
    // menús del fondo — un submenú ES un menú: sus ítems se pulsan igual, y una
    // lista dentro de otra vuelve a caer aquí, ANIDANDO SOLA.
    // Se ancla a la derecha del ítem (rect.right + 6) y a su misma altura.
    "open submenu ƒ": `(nombre, rect, desde = "") => {
      const lista = diarsaba.get("lista de ƒ")(nombre);
      if (!lista) return false;
      // Una lista puede CALCULARSE en vez de guardarse: si existe un
      // "<nombre> al abrir ƒ", se le da la palabra justo antes de dibujar. Con
      // eso "todos #" no puede quedarse vieja — se rehace cada vez que la miras.
      const alAbrir = diarsaba.get(nombre + " al abrir ƒ");
      if (typeof alAbrir === "function") alAbrir(lista);
      // "desde" = el menú del que cuelga: con eso el shell cierra el submenú que
      // ese mismo menú tuviera abierto, y no se amontonan unos sobre otros.
      diarsaba.get("create list menu ƒ")(
          diarsaba.get("ítems de menú ƒ")(nombre), nombre, "",
          rect.right + 6, rect.top, null, desde);
      // Se apunta DESPUÉS de dibujar: si no, abrir «logs #» se listaría a sí mismo.
      host.log("  ↳ <b>submenú</b> de «" + nombre + "» (" + lista.length + " ítems)");
      return true;
  }`,

    // Un ítem "cobra vida" según su SIGILO. Devuelve true si lo manejó.
    "dispatch item ƒ": `(name, dataset, rect) => {
      const type = name.slice(-1);

      // Colecciones: abrir su contenido, colgando del menú donde se pulsó. Es
      // el MISMO "open submenu ƒ" que usa el despacho de un ítem de menú: abrir
      // una colección es un solo gesto, con un solo mecanismo, venga de donde
      // venga. (Un "~" o un "!" tampoco se ejecutan al pulsarlos: para eso está
      // "ejecutar ƒ" en sus opciones.)
      if (diarsaba.get("sigilos lista #").includes(type)) {
          return diarsaba.get("open submenu ƒ")(name, rect, dataset.menu);
      }

      // Un PLACE: viajar. Cambia el lienzo ENTERO, así que no se abre como una
      // lista más — pulsarlo es irse. Para mirarlo sin viajar está "ver dentro ƒ",
      // en su clic derecho.
      if (type === "@") return diarsaba.get("viajar a place ƒ")(name);

      // Funciones: ejecutar. Salvo las del BANCO DE PRUEBAS: ésas no se ejecutan
      // aquí ni por accidente. Un clic en «renderizar agujero negro ƒ» se lleva la
      // página por delante, así que el despacho lo manda al worker y lo que se ve
      // es su veredicto. Que un átomo no sea de fiar es una propiedad del PROGRAMA
      // —está en una lista—, no un cuidado que haya que tener al pulsar.
      if (type === "ƒ") {
          if ((diarsaba.get("pruebas #") || []).includes(name)) {
              diarsaba.get("probar átomo ƒ")(name);
              return true;
          }
          const f = diarsaba.get(name);
          if (typeof f === "function") { f(dataset); return true; }
          return false;
      }

      return false;
  }`,

    // Clic derecho en el fondo: abre OTRO menú raíz, junto al puntero. No cierra
    // los que ya estén abiertos: se van sumando. El evento llega ya CLASIFICADO
    // por el shell (host.hit).
    "show context menu ƒ": `() => {
      const event = diarsaba.get("pointer up event");

      // En el fondo: otro menú raíz, con la lista de átomos.
      if (event.kind === "background") {
          const nombre = "diarsaba #";
          diarsaba.get("create list menu ƒ")(
              diarsaba.get("ítems de menú ƒ")(nombre), nombre, "", null, null, null, "");
          return;
      }
      if (event.kind !== "menu") return;

      // Sobre el TÍTULO: las acciones del MENÚ (nuevo / cerrar). Muestra SU
      // lista, «menu acciones #», no la del menú de abajo: así sus ítems son
      // elementos de verdad, con sus opciones y su editor. A qué menú se
      // refieren ya lo dice "desde".
      if (event.titulo) {
          const nombre = "menu acciones #";
          diarsaba.get("create list menu ƒ")(
              diarsaba.get("ítems de menú ƒ")(nombre), nombre, "",
              null, null, null, event.menu);
          return;
      }

      // Sobre un ÍTEM: las opciones de ESE elemento (tomar / antes / despues /
      // eliminar). El menú de opciones cuelga de aquél, así que se cierra con
      // él, y lleva en su dataset a QUÉ elemento se refiere.
      if (event.name) {
          const lista = diarsaba.get("lista de ƒ")(event.parent);
          // Que el ítem SEA de verdad ese elemento de esa lista. Un menú de
          // acciones u opciones cuelga de una lista pero no la muestra, y sus
          // ítems no son elementos: aquí es donde se quedan fuera.
          if (!Array.isArray(lista) || lista[event.index] !== event.name) return;
          diarsaba.get("create list menu ƒ")(
              diarsaba.get("opciones de ƒ")(event.name),
              event.parent,                                  // la lista
              "[" + event.index + "] " + event.name,         // el elemento
              null, null, null, event.menu);
      }
  }`,

    // Cierra el menú del que cuelga esto (y todo lo que colgara de él, incluido
    // este mismo menú de acciones). El átomo decide QUÉ cerrar por su id, sin ver
    // ningún elemento.
    "cerrar ƒ": `(dataset) => {
      host.log("▶ <b>cerrar</b> «" + diarsaba.get("lista de menú ƒ")(dataset.desde) + "»");
      diarsaba.get("close menu ƒ")(dataset.desde);
  }`,

    // Clic izquierdo en el fondo: ya NO cierra nada — los menús se cierran uno a
    // uno con su "cerrar ƒ", y Esc los barre todos. Dentro de un menú no llega
    // aquí (el _wirePick del shell hace stopPropagation y lo despacha él).
    "handle click ƒ": `() => {}`,

    "lenguajes :": {
        "ƒ": "js",
        "<": "html",
        "{": "css",
        ":": "json",
        "@": "json",
        "#": "text",
        "~": "text",
        "!": "text",
        "$": "text",
        "§": "text",
        "֎": "text"
    },

    "ai system §": "",

    "list option : #": ["editor ƒ","editar ƒ","repintar place ƒ"],

    "list option < #": ["editor ƒ","editar ƒ"],
};
