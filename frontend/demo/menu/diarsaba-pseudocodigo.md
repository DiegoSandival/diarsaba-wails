# DIARSABA — cómo funciona (pseudocódigo sintetizado)

Resumen del sistema en `index.html`: un programa entero vive como datos en un `Map` (`diarsaba`), cada átomo tiene un **sigilo** (`#`, `~`, `!`, `ƒ`, `$`, `§`...) que dice su tipo, y un **shell** (`host`) es lo único que toca el DOM. El **universo** (funciones `ATOMOS`) solo decide y le habla al shell.

```js
// ── 1. EL PROGRAMA ES DATOS ──────────────────────────────────────────
// Todo átomo vive en un Map global, con nombre = "etiqueta <sigilo>"
const diarsaba = new Map();
// ej: "todos #" → array, "cerrar ƒ" → función, "tomado §" → string

// Las funciones se guardan como TEXTO y se compilan al vuelo:
// esto permite reescribir el programa en caliente desde el editor.
const createFunction = (src) => (new Function("return (" + src + ")"))();


// ── 2. DESPACHO POR SIGILO ────────────────────────────────────────────
// threads() ejecuta un átomo por nombre, según su sigilo final:
//   "~" (thread)  → secuencia de nombres, cada uno se despacha de nuevo
//   "!" (acción)  → [nombreDeFunción, ...args]
function threads(name) {
  const seq = diarsaba.get(name);
  if (!Array.isArray(seq)) return;
  if (name.endsWith("~")) {
    for (const paso of seq) threads(paso);   // un thread puede contener otros threads
    return;
  }
  const [fnName, ...args] = seq;
  const f = diarsaba.get(fnName);
  if (typeof f === "function") f.apply(null, args);
}


// ── 3. EL SHELL (host) — único que toca el DOM ────────────────────────
// El universo le pide widgets por verbos; nunca ve un elemento del DOM.
const host = {
  menu(list, parent, current, x, y, onPick, desde) {
    // crea <div class="context-menu">, la pinta con _paint(),
    // la registra en scene (árbol de menús), devuelve su id
  },
  list(x, y, list, parent, onPick, slot) {
    // igual que menu(), pero los ítems llevan prefijo "[n] "
    // → eso es lo que marca semántica de LISTA en vez de MENÚ
  },
  async modal(preValue) {
    // pide un texto de una línea, resuelve string o null
  },
  async editor(nombre, src, lang) {
    // abre Monaco (o textarea de respaldo), resuelve el texto guardado o null
  },
  hit(domEvent) {
    // clasifica el clic real del DOM en un payload SEMÁNTICO:
    // { kind: "background" | "menu" | "modal", menu, parent, name, index, titulo }
    // — el universo solo recibe estos datos, nunca el elemento
  },
  scene: {
    // árbol de menús abiertos: cada uno sabe "desde" qué menú cuelga.
    // cerrar un menú se lleva por delante a todos sus hijos (closeChildren)
  },
};


// ── 4. EL UNIVERSO (ATOMOS) — decide, no dibuja ───────────────────────

// Clic derecho en el fondo → abre menú raíz con el catálogo del programa.
// Clic derecho sobre el TÍTULO de un menú → opciones del menú (nuevo/cerrar).
// Clic derecho sobre un ÍTEM → opciones de ESE elemento (tomar/cortar/eliminar...).
function showContextMenu() {
  const event = diarsaba.get("pointer up event");   // ya clasificado por host.hit()

  if (event.kind === "background") {
    abrirMenu("diarsaba #");                          // catálogo raíz
    return;
  }
  if (event.titulo) {
    abrirMenu("menu acciones #", colgandoDe: event.menu);
    return;
  }
  if (event.name) {
    const lista = diarsaba.get("lista de ƒ")(event.parent);
    if (lista[event.index] !== event.name) return;    // valida que sigue siendo ese elemento
    abrirMenu(opcionesDe(event.name), colgandoDe: event.menu, etiqueta: event.name);
  }
}

// Clic IZQUIERDO sobre un ítem de menú/lista → despachar según su sigilo.
async function despacharMenu(payload) {
  const { label, rect, parent, current, menu, desde } = payload;

  if (!esItemDeLista(label)) {
    // ítem de MENÚ (sin prefijo "[n] "): mira el sigilo final
    const tipo = ultimoCaracter(label);
    if (esTipoLista(tipo)) {
      abrirSubmenu(label, rect, desde);       // # / ~ / ! → se abren como submenú
    } else if (esTipoConocido(tipo)) {
      dispatchItem(label, { parent, current, menu, desde }, rect);
    }
    return;
  }

  // ítem de LISTA "[n] texto": parsear índice y despachar limpio
  const { indice, texto } = parseIndice(label);       // "[2] hola" → {indice:2, texto:"hola"}
  const manejado = dispatchItem(texto, { parent, current, menu, desde }, rect);
  if (!manejado) {
    const fn = diarsaba.get(texto + " ƒ");
    if (fn) fn({ parent, current, menu, desde });
  }
}

// Un ítem "cobra vida" según su sigilo.
function dispatchItem(name, dataset, rect) {
  const tipo = ultimoCaracter(name);

  if (esTipoLista(tipo)) {          // "#", "~", "!" → colecciones: abrir como SUBLISTA
    const lista = diarsaba.get("lista de ƒ")(name);
    if (!lista) return false;
    host.list(rect.right + 6, rect.top, lista, name, null, name);
    return true;
  }

  if (tipo === "ƒ") {               // función → ejecutar directo
    const f = diarsaba.get(name);
    if (typeof f === "function") { f(dataset); return true; }
  }

  return false;
}


// ── 5. EDITAR EL PROGRAMA DESDE SU PROPIO MENÚ ────────────────────────

// Una línea → modal; un cuerpo de función con saltos de línea → editor (Monaco).
async function editar(dataset) {
  const { indice, texto: nombre } = parseIndice(dataset.current);
  const valorActual = diarsaba.get(nombre);
  const fuente = mostrarValor(valorActual);

  if (fuente.includes("\n")) return; // pide "editor ƒ" en vez de esto

  const nuevoTexto = await host.modal(fuente);
  if (nuevoTexto === null) return;
  diarsaba.set(nombre, interpretarValor(nombre, nuevoTexto)); // $ → Number, ƒ → compilar, resto → texto
  cerrarOpciones(dataset);   // cierra el menú y repinta la lista en vivo
}

async function editorFn(dataset) {
  const { texto: nombre } = parseIndice(dataset.current);
  const actual = diarsaba.get(nombre);
  const resultado = await host.editor(nombre, actual?.toString() ?? "()=>{}", "js");
  if (resultado == null || resultado.trim() === "") return;
  try {
    diarsaba.set(nombre, createFunction(resultado));   // recompila en caliente
  } catch (e) {
    host.notify(`"${nombre}" no se guardó: no compila.`);
  }
  cerrarOpciones(dataset);
}


// ── 6. CORTAR / PEGAR ENTRE LISTAS (un solo "portapapeles" visible) ───

let tomado = "";   // vive como átomo "tomado §" — se ve y se edita como cualquier otro

function tomar(dataset)  { tomado = elementoSeleccionado(dataset); }
function cortar(dataset) {
  tomado = elementoSeleccionado(dataset);
  quitarDeLista(dataset.parent, dataset.current);
}
function antes(dataset)   { if (tomado) insertarEn(dataset.parent, indiceDe(dataset.current), tomado); }
function despues(dataset) { if (tomado) insertarEn(dataset.parent, indiceDe(dataset.current) + 1, tomado); }
function eliminar(dataset){ quitarDeLista(dataset.parent, dataset.current); }
```

## La idea central

1. **Todo es dato.** El programa completo —menús, funciones, listas, valores— vive en un `Map`. No hay estado escondido en el DOM.
2. **El sigilo es el tipo.** El carácter final del nombre (`#`, `~`, `!`, `ƒ`, `$`, `§`) decide cómo se interpreta, se dibuja y se edita un átomo.
3. **El shell nunca decide, solo dibuja.** Recibe verbos (`menu`, `list`, `modal`, `editor`) y devuelve datos clasificados (`hit()`), nunca elementos del DOM.
4. **El universo nunca toca el DOM.** Solo lee/escribe el `Map` y le pide cosas al shell.
5. **Autoedición en vivo.** Como las funciones se guardan como texto fuente y se recompilan con `createFunction`, el programa puede reescribirse a sí mismo desde su propio menú contextual, sin recargar la página.
