# DIARSABA — el contenedor (worker por universo)

> Documento de diseño. El **objetivo**: partir DIARSABA en **shell** (hilo principal:
> DOM + Three.js + Monaco + puente a Go + el bucle de render) y **universos** (cada uno un
> **worker**: `Map` + `createFunction` + `threads` + su semilla), unidos por un **protocolo
> (el borde)**. Cada universo es un espacio de contenido aislado, sembrado solo con el núcleo,
> que crece recibiendo "códigos" de otros universos.
>
> Estado: **diseño acordado, aún no implementado.** Lo que hay hoy (Fases 1–3) es el
> "universo 0 / casa" y debe seguir funcionando idéntico durante toda la migración.

## Por qué worker y no iframe

Un **worker no tiene DOM** — y hoy DIARSABA *es* una app de DOM (`create chip ƒ` hace
`createElement`, la proyección billboard escribe `left/top`, los menús son divs, el editor es
Monaco). Aun así, worker es la elección correcta:

- **Paralelismo real de fondo.** Los iframes comparten el hilo principal; "dejar un universo
  corriendo para ver qué hace" atascaría al visible. Un worker corre en **otro hilo**.
- **Memoria a escala.** Cada iframe vivo carga su propio DOM + Three + Monaco (decenas de MB).
  Un worker de fondo es solo el heap de JS (el `Map` + lógica); lo pesado vive **una vez** en el
  shell y sirve al universo activo.
- **Alineado con el fin.** En el diagrama del proyecto, Three.js está en el *borde* (el shell),
  no dentro del universo. Dentro solo hay datos y relaciones. El worker **obliga** esa
  separación — que es la misma que el objetivo de largo plazo ("las palabras como lenguaje de
  ejecución; el render es una proyección más, no definitiva") ya pedía.

**El principio que decide cada duda:** si algo puede vivir sin ojos que lo miren, es del
**worker**; si solo existe para que un humano lo vea o lo toque, es del **shell**. Los datos y
los threads siguen vivos sin vista; la vista *interpreta* los datos y no hay vista definitiva:
cada usuario (o shell) crea la suya.

## Los dos núcleos

- **Kernel del host (`index.html`)** — inmutable, ningún universo lo reescribe: `createFunction`,
  `threads`, el `Map`, la carga, y las capacidades del borde (P2P, Three, KV, crypto). El fin de
  largo plazo es encogerlo hacia la nada y expresar cada vez más en palabras.
- **Semilla del núcleo (átomos)** — lo mínimo sembrado en un universo vacío para poder crear e
  interactuar. Es *andamiaje temporal*, no definitivo. Se elige en el Paso 5.

## Auditoría del borde (Paso 1 — hecho)

Escaneo de los 206 átomos contra cada patrón con que tocan el exterior. Resultado: **92 tocan el
exterior, pero colapsan en un puñado de operaciones repetidas.** Se reparten en tres cubetas.

### A — Lógica y datos puros → al worker sin tocar (~110)

Los 24 `ƒ` puros (`referencias de ƒ`, `padres de ƒ`, `ir a ƒ`, los `create <tipo> ƒ`,
`dispatch item ƒ`, la lógica p2p `arg`/`enviar a`/`difundir`…) **más todos los no-`ƒ`**: places,
listas, datos, mapas, estilos, threads, acciones. También los que solo usan `createFunction`,
`threads`, `new Date`, `TextEncoder`, `btoa`, `setTimeout` — todos existen en un worker.

### B — Vista pura → se va ENTERA al shell, no es de ningún universo (~15)

`3d init/proyectar/render/reset/punto en plano/controles/limpiar`, `clamp to viewport ƒ`,
`grafo init/dibujar ƒ`, `panorámica pintar/entrar ƒ`, `install mover ƒ`. Es el bucle de 60fps,
la cámara, el arrastre y el canvas. **El worker nunca la ve**; el shell la provee como renderer.

### C — Lógica que habla con el humano → worker, pero por el protocolo (~55)

Editores (`· <tipo> editor ƒ`, `open general editor`, `ver version`), menús/listas
(`create list/list menu`, `· # abrir`, `show options list`, `open submenu`), buscador, bitácora,
historial, `modal input`, ocultar/quitar/eliminar, `resaltar`/`registrar`, los 23 `alert`, la
persistencia (`persistir atomo`, `guardar`, `exportar`) y el p2p. La **lógica** es del universo;
dejan de tocar el DOM y le hablan al shell.

## El contrato — el protocolo del borde

Cuatro canales. Ningún verbo inventado: cada uno sale de un patrón que ya existe en el código.

### 1. Escena (worker → shell)

La lista de chips visibles del place activo — `{ nombre, x, y, tipo, estado }` — y sus **deltas**
(uno se movió / se ocultó / se renombró / parpadeó). Reemplaza `create chip ƒ` y el pintado de
`on double tap place ƒ`. El shell la proyecta con Three.js. **Es la única fuente de verdad del
render, y la mantiene el worker.**

### 2. Widgets (worker → shell, casi siempre esperando respuesta)

La superficie humano↔datos. Todo el layout/DOM es del shell; el worker solo da contenido y recibe
la elección del humano.

| Verbo | Reemplaza |
|---|---|
| `menu(opciones, ancla) → elección` | menús, submenús, opciones de chip |
| `list(items, ancla)` | listas efímeras (`· # abrir`, padres, referencias, historial) |
| `modal(prompt, pre) → texto` | `modal input ƒ` |
| `notify(msg)` / `confirm(msg) → bool` | los 23 `alert` |
| `editor(nombre, src, lang) → src' \| null` | Monaco (`codeEditor.open`) |
| `diff(título, a, b) → restaurar:bool` | `codeEditor.openDiff` |
| `panel(líneas)` | la bitácora |

El **`ancla`** es un nombre de chip o un punto de pantalla; el shell mide y posiciona. Ahí mueren
los 17 `getBoundingClientRect`.

### 3. Broker (worker → shell → Go)

- `kv.set/get/delete/history/restore` — enrutado al store **de este universo**
- `export()` / `save()` / `load()`
- `p2p.*` (Announce, Start, OpenStream, StreamRead/Write, …) + eventos de stream entrante
- `ai(código, lang, instrucción, system) → resultado`
- `reload()`

### 4. Eventos (shell → worker)

Clic / clic derecho sobre un chip o el fondo (con **coordenadas de mundo ya calculadas por el
shell**), tecla, resultado de un widget, y p2p entrante.

### Lo que NO cruza el borde

Cámara, proyección, arrastre, `getBoundingClientRect`, `innerWidth`, `requestAnimationFrame`.
Todo eso es del shell. **Ahí está la eficiencia:** lo de 60fps nunca toca el `postMessage`; el
borde solo lleva *cambios* de átomos (poco frecuentes) + eventos + llamadas a Go.

## Tres reencuadres que la auditoría deja claros

1. **La vista sale del universo.** El núcleo sembrado se encoge — los ~15 átomos de render dejan
   de ser semilla de nadie; los provee el shell.
2. **`create chip ƒ` se disuelve.** Un chip es un átomo en un place con `x/y`; el shell lo dibuja.
   "Crear un chip" = "añadir un átomo al place" — dato puro, worker.
3. **`getBoundingClientRect` → "ancla".** El worker dice "abre esta lista junto al chip X"; el
   shell mide y coloca. 17 llamadas de layout colapsan en un parámetro.

## Plan de implementación

Regla de oro: **el programa actual sigue funcionando como "universo 0 / casa" durante toda la
migración.** Nada se rompe; se migra por pasos verificables.

1. **Auditar el borde** — hecho (este documento).
2. **Definir el protocolo con implementación *misma-hebra*.** — **hecho para UI/editor/broker.**
   El objeto `host` vive en `index.html` (global, como `diarsaba`) y cada verbo reenvía al código
   DOM/Go actual. Cubiertos: `notify`/`confirm`, `editor`/`diff`, `kv.set/del/history/restore`,
   `save`/`export`/`load`/`ai`, `events`, `p2p`, `reload`. Faltan los canales de **escena** y
   **widgets** (`menu`/`list`/`modal`/`panel`), que no son un simple reenvío.
3. **Portar los átomos al borde.** — **hecho para UI/editor/broker** (31 átomos, 55 llamadas: todos
   los `· <tipo> editor ƒ`, `open general editor`, `ver version`, `persistir atomo`, `guardar`,
   `exportar`, `reload`, los `alert`, y el broker de Go). Cero formas crudas (`window.SetAtom`,
   `window.codeEditor`, `alert(`…) quedan en código. El port solo tocó líneas de código, no
   comentarios (la recuperación-por-consola de `· * restaurar` sigue citando las bindings crudas).
   **Pendiente:** portar los átomos de la cubeta C que usan escena/widgets (menús, listas, buscador,
   bitácora, historial-panel, modal, `create chip`, ocultar/quitar, resaltar) cuando esos verbos
   existan.
4. **Partir shell/worker: el transporte worker.** Como los átomos ya solo hablan `host.*`, se
   añade un segundo transporte: los átomos corren en un worker; `host.*` se vuelve `postMessage`.
   El shell posee el bucle de render, Three, Monaco y Go. Se voltea el universo 0 a un worker y se
   verifica que se comporta igual.
5. **Store por universo + semilla del núcleo.** El shell gestiona un bbolt por universo (Go),
   sembrado desde un `core.json` embebido (la semilla mínima) — o, para el universo 0, el programa
   actual. Aquí se define **el núcleo**: los átomos mínimos que hacen un universo vacío construible.
6. **Ciclo de vida de universos.** Crear, listar, cambiar, y correr-de-fondo. Activo = proyectado;
   de fondo = worker vivo sin proyectar. "Dejar uno corriendo para ver qué hace" sale nativo.

Los pasos 2–3 son el precio, pero es trabajo **alineado**: separan lógica de render, que es lo que
"palabras como ejecución" necesita de todos modos. Y como cada paso deja la app funcionando, no hay
un big-bang donde todo pueda romperse a la vez.

## Fuera del alcance del contenedor (a propósito)

La **cuarentena** de códigos recibidos y las **dependencias rotas** (qué necesita un código para
funcionar en otro universo) son una capa aparte, independiente del contenedor, de la que se ocupa
el autor del proyecto. El contenedor se diseña como si eso no existiera aún.
