# DIARSABA — el paquete portable

Este es `frontend/demo/menu/index.html` partido en piezas para poder llevárselo a
otro anfitrión (Tauri, un navegador suelto, lo que venga). **No hay nada de Go, ni
de Wails, ni de Three.js.** Lo que hay es HTML/CSS/JS y el motor de threads.

El demo de un archivo sigue en `../menu/index.html`, intacto y funcionando: éste es
la misma cosa reorganizada, con los mismos 104 átomos.

## Las tres capas

| Capa | Qué es | Sabe del DOM | Sabe del anfitrión |
|---|---|---|---|
| **kernel** (`src/kernel.js`) | el `Map`, `createFunction`, `threads` | no | no |
| **universo** (`src/atomos/*.json`) | el programa, como datos | no | no |
| **shell** (`src/shell/*.js`) | dibuja y clasifica gestos | **sí, sólo él** | por el broker |

La regla que decide cada duda es la de `CONTENEDOR.md`: *si algo puede vivir sin
ojos que lo miren, es del universo; si sólo existe para que un humano lo vea o lo
toque, es del shell.*

## Los archivos

```
index.html              20 líneas: el lienzo, el CSS y un <script type="module">
un-archivo.html         GENERADO — el mismo programa en una pieza, abre a doble clic
herramientas/
  empaquetar.mjs        lo que genera un-archivo.html desde src/
estilo.css              todo el estilo (menús, modal, editor, lienzo)
src/
  kernel.js             Map + createFunction + threads  ← el motor de threads
  cargador.js           siembra el Map desde los JSON, compilando los "ƒ"
  arranque.js           EL ÚNICO archivo que sabe en qué anfitrión estamos
  shell/
    host.js             ensambla el shell y lo pone en window.host
    widgets.js          menús, listas, modal, scene (registro), hit() (eventos)
    lienzo.js           los tres verbos de dibujo: círculo, trazo, texto
    editor.js           Monaco (y su respaldo en textarea)
    aislamiento.js      el worker con reloj: correr algo que no es de fiar
    broker.js           kv / save / load / p2p / ai — NULO, para que lo enchufes
  atomos/
    nucleo.json         60 átomos: sigilos, despacho, menús, opciones, places
    escena.json         24 átomos: el árbol de escena.png
    pruebas.json        20 átomos: el banco de pruebas aislado
```

## Correrlo

**`index.html` necesita servidor.** Es la versión de verdad —módulos y átomos en
disco—, y es lo que usa Tauri, que sirve sus assets. Abrirlo a doble clic **no
funciona**: desde `file://` un `<script type="module">` está bloqueado por CORS
(origen `null`) y el `fetch` de los JSON también, así que no arranca nada — ni
siquiera se registra el clic derecho, y lo que sale al pulsar es el menú del
navegador. Cualquier servidor estático vale:

```bash
python -m http.server 8778 --directory frontend/demo/menu-portable
```

**`un-archivo.html` sí abre a doble clic.** Es el mismo programa sin módulos y sin
fetch, generado desde `src/`:

```bash
node herramientas/empaquetar.mjs
```

Es una **salida, no la fuente**: se regenera cuando cambias algo en `src/`. Sirve
para mirar el programa sin montar nada y para mandárselo a alguien de una pieza.
Una advertencia: desde `file://` un navegador estricto puede negarse a crear el
worker del aislamiento (un `blob:` desde un origen opaco). No se rompe nada — las
pruebas contestan `sin aislamiento`, que es justo lo que ese veredicto significa: si
no hay sandbox, no se ejecuta.

## El borde — lo que el anfitrión tiene que dar

El universo **nunca** ve un elemento, ni una función que cruce el borde, ni un
socket. Habla estos verbos y nada más. Todos devuelven datos o promesas de datos,
así que todos sobreviven a un `postMessage`.

### Widgets (humano ↔ datos)

| Verbo | Qué hace |
|---|---|
| `host.menu(list, parent, current, x, y, onPick, desde) → id` | un menú; `x/y` nulos = junto al puntero |
| `host.list(x, y, list, parent, onPick, slot)` | igual, con ítems `"[n] "` — ésa es la marca de LISTA |
| `host.modal(pre) → texto \| null` | pedir una línea |
| `host.editor(nombre, src, lang) → src' \| null` | editar un cuerpo |
| `host.notify(msg)` | un aviso |
| `host.closeMenu(id)` / `host.clearMenus(alsoModals)` | cerrar uno / barrer todo |
| `host.redrawAll(nombre, list)` | repintar donde sea que esa lista esté abierta |
| `host.listaDe(id)` / `host.itemRect(id, i)` | qué muestra un menú / dónde está un ítem |

### Escena (el lienzo del place)

| Verbo | Qué hace |
|---|---|
| `host.limpiarLienzo(nombre)` | vaciar: lo primero de un viaje |
| `host.circulo(colorCSS, tamaño, x, y, z)` | un círculo, anclado por su centro |
| `host.trazo(colorCSS, grosor, z, puntos)` | una línea continua |
| `host.texto(colorCSS, tamaño, x, y, z, txt)` | una línea de texto |

Las coordenadas son **% del place**; los tamaños, **px de un escenario de
200×200** que se escala a la ventana. El color llega **ya resuelto**: quién decide
que "verde" es `#9acd32` es el universo (`colores {`), no el shell. Otro shell con
Three.js cumpliría estos cuatro verbos y no habría que tocar un átomo.

### Eventos (shell → universo)

`host.hit(domEvent)` clasifica el clic real en un payload semántico
`{ kind: "background" | "menu" | "modal" | "other", menu, parent, name, index, titulo, button, clientX/Y }`.
Los átomos leen eso; nunca `event.target`. El reparto vive en `arranque.js`, que es
el bloque que se muda al shell cuando el universo se vaya a un worker.

### Aislamiento

`host.worker(fuente, args, ms) → veredicto`. Devuelve **siempre**, nunca lanza:
`{ ok:true, valor }`, o `{ ok:false, motivo:"colgada" | "reventó" | "sin aislamiento", error }`.
Sólo cruza la **fuente** (texto) y datos estructurables — una función no cabe en un
`postMessage`, y eso es una garantía, no un límite.

### Broker (lo de fuera) — **esto es lo que te toca rellenar**

`host.broker.{kv.set/get/delete/history/restore, exportar, guardar, cargar, p2p.*, ai, recargar, al, emitir}`.
Está en `src/shell/broker.js` con una implementación nula: cada verbo contesta
`{ ok:false, motivo:"sin anfitrión" }` y lo apunta en la bitácora. Por eso el
programa entero funciona sin backend — sólo le faltan persistencia y red.
`exportar()` sí funciona de verdad: el universo ya sabe serializarse.

## Llevarlo a Tauri

1. Copia la carpeta a `src/` (o donde sirva tu app) y apúntale el `index.html`.
2. Escribe un broker contra `invoke()` — el esqueleto y un ejemplo están en los
   comentarios de `src/shell/broker.js`. **Tu librería p2p de Go entra sólo por
   `broker.p2p.*`**: el universo no ve un socket, pide "anuncia" o "abre un stream".
3. En `src/arranque.js`, una línea:
   ```js
   const host = crearHost({ broker: brokerTauri, vs: "/vs/" });
   ```
4. Si quieres que los átomos vengan de Rust en vez de los JSON, pasa un lector:
   ```js
   await cargar({ leer: (grupo) => invoke("cargar_atomos", { grupo }) });
   ```

Ningún átomo cambia en ninguno de los cuatro pasos. Eso es lo que significa que
esté preparado.

## Lo que NO viene (a propósito)

- **Three.js, chips, cámara, panorámica, grafo**: la app real proyecta el place en
  3D; aquí el lienzo son divs y SVG. Los cuatro verbos de escena son los mismos.
- **La implementación del p2p**: es tu librería de Go, y entra por el broker.
- **El transporte worker (T3 de `CONTENEDOR.md`)**: el universo todavía corre en el
  hilo principal. Pero ya está listo para el flip — el kernel es un archivo
  independiente, ningún átomo toca el DOM, ninguno recibe elementos, ninguno pasa
  funciones por el borde, y `arranque.js` aísla la entrega de gestos. Volverlo un
  worker es mover `kernel.js` + `cargador.js` + los JSON al worker y hacer que
  `host.*` sea `postMessage`. Y el `aislamiento.js` que ya está aquí es el mismo
  patrón, en pequeño: un mundo sin DOM al otro lado de un `postMessage`.

## Los átomos de datos, uno por uno

Los comentarios de las funciones viajan dentro de su propia fuente (se ven al
abrirlas en el editor). Los de los átomos de **datos** no caben en un JSON, así que
viven aquí.

### `nucleo.json`

- **`types list #`** — los sigilos que el despacho reconoce como TIPO de átomo.
- **`sigilos lista #`** (`#`, `~`, `!`) — los que tienen naturaleza de lista: por
  dentro son un array, así que se abren, se les añade, se les quita y se les cambia
  el orden igual. Pulsarlos hace lo mismo con los tres: **abrir**. Ejecutar un
  thread o una acción es una opción de su clic derecho, no lo que pasa al tocarlos:
  mirar por dentro no debería depender de qué sigilo tiene la cosa.
- **`diarsaba #` / `sys #`** — lo que muestra un menú nacido del fondo: la puerta de
  entrada. Desde ahí se llega a todo, por temas y también en crudo.
- **`todos #`** — el programa entero tal cual está el Map **ahora**. No se guarda: se
  calcula al abrirla (`todos # al abrir ƒ`), así que no puede quedarse vieja ni
  esconder un átomo creado hace un segundo. Escribir ahí a mano no sirve de nada.
- **`borde #`** — lo único que habla con el shell. Cada uno es una línea que pide un
  dibujo o un dato.
- **`despacho #`** — qué pasa cuando pulsas algo: entra un gesto, sale una decisión.
- **`listas #` / `valores #`** — cómo se lee una lista y qué se dibuja de ella; cómo
  se lee y se escribe el valor de un átomo.
- **`places ƒ #`** — viajar de un place a otro: lo que le cambia el lienzo al programa.
- **`logs #`** — la bitácora. `host.log` escribe ahí y se lee como un submenú más: no
  hay vista aparte, la bitácora es un átomo del programa.
- **`list option [] #`** — las opciones de **un elemento** de una lista (clic derecho
  sobre el ítem). Las de cada sigilo (`list option ~ #`, `! #`, `$ #`, `§ #`, `ƒ #`,
  `@ #`, `{ #`) se **suman** a esas: ahí sólo va lo que ese tipo tiene **de más**.
  Un `~` y un `!` se abren como cualquier lista; lo que tienen de más es poder
  ponerse en marcha (`ejecutar ƒ`). Una `ƒ` tiene el editor para el cuerpo, el modal
  para un cambio de una línea, y `probar ƒ` para verla correr aislada. Un `@` no se
  abre al pulsarlo —pulsarlo es viajar—, así que lo suyo es `ver dentro ƒ`.
- **`menu acciones #`** — las del **menú** como tal (clic derecho sobre su título),
  frente a las de arriba, que son las de un elemento suyo.
- **`opciones #`** — todo eso junto, para poder abrirlo desde el menú y cambiarlo en
  vivo: quitarle una opción a un tipo es quitar un elemento de una lista.
- **`tomado §`** — lo último tomado. Un átomo como cualquier otro: se ve, se edita, se
  guarda con el programa. **No hay portapapeles escondido en el shell.**
- **`place actual §`** — el place al que se ha viajado. Un átomo, no una variable.
- **`places #`** — los places que hay. Pulsar uno viaja a él: le entrega el lienzo.

### `escena.json`

- **`escena @`** — un place es una lista de threads y el lienzo donde ocurren. Que sea
  una lista es lo que lo deja editar como todo lo demás: quitarle
  `copa del arbol ~` deja el árbol sin hojas al siguiente viaje.
- **`colores {`** — los nombres de los colores. Cambiar "verde" ahí repinta el árbol
  entero al volver a viajar: el color es un dato del programa, no una constante
  escondida. Lo que no esté en la tabla se pasa tal cual, así que `#0af` sigue
  valiendo.
- **las acciones `1 sol !` … `9 raices !`** — una función y sus argumentos. Las
  coordenadas son % del place y los tamaños px del escenario.
- **los threads `cielo ~` / `entorno ~` / `esqueleto del arbol ~` / `copa del arbol ~`** —
  la escena por capas; `escena arbolo ~` los junta en orden.

### `pruebas.json`

- **`pruebas @`** — un place donde se corren átomos **que no son de fiar**. Cada uno se
  compila y se ejecuta dentro de un worker: un mundo sin `document`, sin el `Map` y
  sin nada de aquí, con un reloj encima. Un bucle infinito deja de ser un cuelgue y
  pasa a ser un **resultado**.
- **`pruebas #`** — la lista de lo que se prueba. Un átomo que esté en ella **no se
  ejecuta en casa ni por accidente**: `dispatch item ƒ` lo mira antes de la rama `ƒ`
  y lo manda al worker. Que un átomo no sea de fiar es una propiedad del programa
  —está en una lista, editable—, no un cuidado que haya que tener al pulsar.
- **`dibujables #`** — lo único que un resultado del sandbox puede nombrar. Un átomo
  aislado que quiera dibujar devuelve una lista de **acciones** (la misma forma que un
  `!`) y las pinta el universo de casa. Sin esta lista blanca, "devolver acciones"
  sería poder nombrar cualquier función del programa, y entonces el aislamiento no
  serviría de nada.
- **`veredictos {`** — cómo se ve cada veredicto: un color por motivo. Es un dato, así
  que se cambia desde el menú.
