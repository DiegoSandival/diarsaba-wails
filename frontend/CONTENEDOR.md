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

### Estado actual (de una ojeada) — 2026-07-27

**Hecho: todo el `host` misma-hebra (Pasos 1–3).** Todo el DOM/Go de interacción pasa por el
objeto `host` en `index.html` (global, como `diarsaba`), que hoy reenvía al código actual —la app
se comporta idéntica— y mañana se volverá `postMessage` sin que los átomos cambien. Cubierto:

- **UI** (`notify`/`confirm`), **editor** (`editor`/`diff`), **broker Go** (`kv.*`, `save`/`export`/
  `load`/`ai`, `events`, `p2p`, `reload`).
- **Widgets**: `menu`/`list`/`modal`/`panel`/`palette`/`picker`, con `_clamp`, seguidor de puntero
  y `anchorRect` propios. Los átomos que los creaban son shims.
- **Despacho de menú/lista por DATOS** (`despachar menú ƒ` lee `{label,index,rect,parent,current}`,
  no el DOM).
- **Escena**: `host.scene` con el motor 3d completo (`init/project/render/reset/worldPoint/controls/
  clear/isBackground/make/installDrag`) + operaciones sobre chips (`remove*/flash/rename`); `host.grafo`
  (aristas), `host.installStyles`, `host.mode`. Los átomos `3d …ƒ`/`create chip`/`grafo …`/`install
  style manager` son shims.

**Verificado** a lo largo de 7 commits (arranque, place-switch, crear/mover/quitar/renombrar chip,
menús/submenús/listas/opciones, buscador, historial, editores, pan/zoom/órbita/reset, grafo,
panorámica). Único error en consola: p2p sin backend (esperado en el frontend suelto).

**Paso 4 arrancado: el registro `${name} ֎` ya vive en `host.scene`.** Era el bloqueo — hecho.
`host.scene` es dueño de cuatro registros privados (`_chips`/`_child`/`_list`/`_submenu`, Maps
`nombre → elemento`) con su API: `register/ref`, `openChild/child`, `openList/listRef`,
`openSubmenu`, `forgetChips`; y `remove*/flash/rename` + `anchorRect` + `grafo.draw` operan sobre
ellos. `clear()` hace `forgetChips()` (vaciar el registro en cada cambio de place). **26 átomos
funneleados**: dejaron de hacer `diarsaba.get/set(\`${name} ֎\`)` y hablan verbos de `host.scene`;
los **dos barridos de claves `֎` del Map** (`on double tap place`, `panorámica`) desaparecieron
(los sustituye `clear → forgetChips`). Consecuencia: **el `Map` ya no guarda NINGUNA ref DOM de
chip** — solo estado vivo (`3d … ֎`, `mover instalado ֎`, `grafo aristas ֎`, `p2p … conns ֎`).
Verificado en el frontend suelto: arranque, cambio de place (registro vaciado y repoblado 2→56),
lista/hijo/submenú abrir sin apilar, ocultar/renombrar.

**Pase a async — HECHO.** Las tres llamadas `host` que devuelven valor (`anchorRect`, `worldPoint`
vía `3d punto en plano ƒ`, `isBackground` vía `es fondo ƒ`) se **awaitan** en los átomos que las
usan; **13 átomos marcados `async`** (`· !/#/~/$/§/ƒ abrir`, `· */#* /֎* padre`, `· * padres/
referencias/parents`, `show context menu ƒ`; `handle click ƒ`/`· * parents` ya lo eran). Así el flip
a `postMessage` del worker es transparente: el await ya está. Los **callers síncronos de verdad**
—los manejadores de puntero del shell (`controls`/`installDrag`), que usan `preventDefault` y no
pueden esperar— se **desacoplaron**: llaman directo a `host.scene.worldPoint`/`isBackground` (sync),
así los shims `3d punto en plano ƒ`/`es fondo ƒ` quedan **solo de cara a los átomos** (serán Promise
en el worker). Verificado: los átomos devuelven Promise y resuelven; `isBackground` bien; el único
`null` de `worldPoint` es artefacto del pane oculto (`innerWidth 0`), con su fallback a pantalla.

**De-DOM del elemento devuelto — HECHO.** Los átomos que aún introspeccionaban el DOM del
elemento (`· ֎ editar`/`· ֎x guardar` leían `contentEditable`/`textContent`; `· ֎* padre`/`· #* padre`
medían `getBoundingClientRect`/`offsetWidth` y ajustaban `_obj3d`/`style.left`) ahora hablan verbos
nuevos de `host.scene`: **`editChild`** (vuelve editable + foco), **`commitChild`** (cierra y DEVUELVE
el texto — el átomo lo parsea por tipo: `Number`/`createFunction`/tal cual, y lo awaita), y
**`spawnChipLeftOf(name, "child"|"list")`** que encapsula toda la geometría (medir el ancla,
proyectar a mundo, crear, correr medio ancho, registrar). Los 8 átomos quedan sin DOM: `· ֎ editar`
es una línea void; los 5 `· ֎x guardar` son `async` (awaitan `commitChild`); `· ֎*/#* padre` vuelven
a ser void (la geometría, con su `worldPoint` interno, es del shell). Verificado: editar (editable+
foco), guardar (valor al Map, Promise), spawn (chip registrado, void).

**Canal de EVENTOS — HECHO.** `pointer up/down event` deja de ser un evento DOM crudo y pasa a ser
un **payload semántico** que el shell calcula una vez con **`host.hit(e)`**: `{ kind (chip|
background|menu|modal|other), name, type, parent, pano, button, clientX/Y, world }`. El shell mira
el DOM UNA vez y entrega DATOS; los átomos ya no tocan `event.target`. Reescritos: `handle click ƒ`
(kind en vez de `.closest`), `show context menu ƒ` (kind + `event.world`, vuelve a `sync`),
`on double tap place ƒ` (`event.name`), `show options list ƒ` (`event.parent` en vez de
`target.parentElement.dataset`/`target.dataset`). Los **setters sintéticos** (`ir a`, `dispatch
item`, `panorámica`, `panorámica entrar`, `restaurar version`) ponen `{ name }` en vez del
`{ target: { textContent } }` falso. Los listeners de `on start ƒ` envuelven el evento con
`host.hit(e)` (bridge misma-hebra; la registración de listeners se muda al shell en el transporte).
Verificado con eventos DOM REALES: `host.hit` clasifica chip/fondo/modal; clic derecho en fondo →
menú de fondo; doble clic en place → cambia de place; clic derecho en chip → menú de opciones;
`ir a` viaja.

**Limpieza final de DOM — HECHA.** Los últimos átomos que tocaban el DOM hablan verbos del shell:
`clear menus ƒ` → shim de **`host.clearMenus(alsoModals)`** (el shell rastrea el menú de fondo y el
de chip en `host._menuMain`/`_menuChip` con **`host.setMenu`/`setChipMenu`** — antes eran refs DOM
`current menu`/`current chip menu` en el Map); `on double tap place ƒ` usa `host.clearMenus(true)`
(barre menús+modales en cambio de place); `open submenu ƒ` ya no pone la clase — la pone
`host.scene.openSubmenu`; `panorámica pintar ƒ` marca sus chips con **`host.scene.tagPano`** (antes
`dataset.pano`/`classList`); `clamp to viewport ƒ` → shim de **`host._clamp`**. Y el **shell dejó de
llamar átomos** en el bucle de render: `host.scene` invoca directo `render/reset/controles/project`
y `host.grafo.draw`/`host._clamp` (antes `diarsaba.get("3d …ƒ")()` / `grafo dibujar ƒ` / `clamp to
viewport ƒ`). **Resultado: ningún átomo toca el DOM** salvo el `window.addEventListener` de bootstrap
en `on start ƒ`. Verificado con eventos reales: menú de fondo/chip (rastreo+cierre), submenú (clase),
panorámica (tagPano: 221 chips + 19 labels), bucle de render decoplado.

**El transporte worker — descubierto que son 3 sub-pasos, NO un switch.** Una auditoría al empezarlo
mostró acoplamiento que el worker no tolera: 2 átomos (`panorámica pintar`/`entrar`) usaban
`window.THREE` y la cámara directo, y el shell hace ~49 lecturas del `Map` de objetos Three/canvas
(`3d camara/escena/mira ֎`, `grafo … ֎`, `mover instalado ֎`) que son SUYOS pero viven en el `Map`.

- **T1 — panorámica → `host.scene` — HECHO.** La cámara de panorámica pasó a `host.scene.frameClusters`
  (encuadra + guarda los centros en `host.scene._panoCenters`, antes `panorámica centros ֎` en el Map)
  y `host.scene.flyToCluster(place, onArrive)` (el tween; la ENTRADA queda como lógica del universo en
  `panorámica entrar ƒ`). Los átomos ya no usan `THREE` ni leen `3d camara/mira`/`centros`. Verificado:
  panorámica pinta (221 chips + 19 labels), centros en el shell y NO en el Map, `flyToCluster` sin
  destino llama `onArrive`.
- **T2 — mudar el estado Three/canvas del `Map` a `host.scene`/`host.grafo` privados** (como el registro
  de chips): `3d escena/camara/mira/contenedor/controles/render pendiente ֎`, `grafo lienzo/aristas ֎`,
  `mover instalado ֎`. Tras T2 el `Map` queda como DATOS PUROS del universo. Ojo: `grafo aristas ֎` lo
  escribe `grafo activar ƒ` (átomo) → necesita `host.grafo.setEdges`.
- **T2 — estado Three/canvas fuera del `Map` — HECHO.** `host.scene._escena/_camara/_mira/_contenedor/
  _controlsInstalled/_renderPending/_dragInstalled` y `host.grafo._canvas/_edges` (+ `setEdges`, que
  llama el átomo `grafo activar ƒ`). ~34 accesos del shell al `Map` eliminados: **el `Map` ya no guarda
  ningún objeto vivo de vista**, es datos del universo.
- **T2.5 — ningún átomo recibe ya un ELEMENTO — HECHO.** Era el bloqueo de fondo: `create chip/list/
  list menu` DEVOLVÍAN un nodo DOM que el átomo pasaba de vuelta (`register`/`openChild`/`openList`/
  `openSubmenu`/`setMenu`), y un `postMessage` no puede llevar un nodo. Ahora el átomo dice QUÉ crear
  y en qué **ranura**: **`host.scene.spawn(text, x, y, {parent, type, slot, key, pano, label})`** con
  `slot` = `chip` | `child` | `pano` | `""`, y **`host.menu`/`host.list` toman un `slot` final**
  (`main`/`chip` = los dos menús rastreados, o un nombre = submenú/lista de ese átomo). 20 átomos
  reescritos. De paso, `new place ƒ` creaba su chip sin registrarlo (el bug que advierte
  ARCHITECTURE.md); con `spawn` queda registrado.
- **T2.6 — el `onPick` deja de cruzar el borde — HECHO.** Un `postMessage` tampoco lleva una FUNCIÓN.
  Los shims de menú/lista pasan `null` y el shell entrega el payload al universo por
  **`host._deliverPick`** (hoy llama directo a `despachar menú ƒ`; en el worker será el `postMessage`).

### T3 — el boundary del worker (lo único que resta del Paso 4)

Con T1/T2/T2.5/T2.6 el borde ya es **serializable**: ningún átomo toca el DOM (salvo el
`addEventListener` de bootstrap), ninguno recibe elementos, ninguno pasa funciones por menú/lista, y
todo lo que devuelve valor se awaita. Lo que falta:

1. **El worker** (`universo.js`): `Map` + `createFunction` + `threads` + semilla, y un `host` proxy
   cuyos verbos hagan `postMessage({id, path, args})` y devuelvan una promesa.
2. **El router del shell**: recibe `{id, path, args}`, resuelve `host.<path>(...args)`, responde
   `{id, ok, value}`. Solo puede devolver DATOS (ya se cumple).
3. **Callbacks que aún cruzan** (los pocos que quedan): `host.palette({onQuery,onPick})` —`onQuery`
   se llama por tecleo y devuelve resultados, así que el shell tendrá que **awaitarlo**—,
   `host.picker(items,{onPick})`, `host.scene.flyToCluster(place,onArrive)` y `host.events(name,cb)`
   (p2p). Patrón: registro de callbacks por id, como `_deliverPick`.
4. **Entrega de eventos**: los listeners de `on start ƒ` se mudan al shell; `host.hit(e)` ya produce
   el payload semántico, y la entrega pasa de `threads(...)` a `postMessage`.
5. **Mirror de flags**: el shell lee `current place §`, `moviendo chips §`, `panorámica activa §` y
   `grafo activo §` en sus manejadores de puntero/render; con el `Map` en el worker necesita una copia
   local que el universo actualice al cambiarlos.
6. **El kernel**: `createFunction`/`threads`/`diarsaba` son globales del `<script>` plano y hoy los usan
   tanto el shell (`registrar ejecución`, `persistir atomo`, `ai system §`, el override de
   `diarsaba.set` de `installStyles`) como los átomos. Hay que decidir qué se queda de cada lado.

⚠️ **T3 no se puede verificar en el frontend suelto** (el pane oculto no compone frames y no hay
backend Go): hay que probarlo en la app Wails real (`wails dev`).

### Pasos

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
   **Widgets — primera pasada hecha (rendering):** `host.menu`/`list`/`modal`/`panel` viven en el
   shell (con `_clamp` y un seguidor de puntero propios, sin depender del `Map`). `create list menu ƒ`,
   `create list ƒ`, `modal input ƒ` y `bitácora ƒ` son ahora **shims** sobre ellos: el DOM se movió
   al shell sin que ningún llamador cambie. El despacho por clic sigue en `handle click ƒ` leyendo
   ese DOM.
   **Menú/lista → despacho por datos, HECHO.** `host.menu`/`host.list` emiten al clic un payload
   semántico `{label, index, rect, parent, current}` (vía `onPick`, con `stopPropagation`); un
   **`despachar menú ƒ`** nuevo contiene las ramas de menú/lista que vivían en `handle click ƒ`,
   pero leyendo del payload —no del DOM—, así el despacho ya no toca la vista. `dispatch item ƒ` y
   `open submenu ƒ` reciben `rect` (dato) en vez del elemento. Los shims `create list menu ƒ`/
   `create list ƒ` cablean `despachar menú ƒ` por defecto, así que ningún llamador (show context
   menu, options, abrir, padres, referencias) cambió. `handle click ƒ` perdió las ramas de menú y
   hace early-return en `.context-menu`; conserva el doble-clic de chip y la limpieza de fondo.
   Verificado: submenús (padre se queda), acciones, viajar con `@`, opciones de chip, listas `[n]`,
   opciones `[]` (con `current`), creador vía modal, doble-clic de chip.
   **Buscador e historial — HECHO.** `host.palette({onQuery, onPick})` (el buscador: el shell lleva
   el overlay/teclado/resultados; el átomo `buscar ƒ` provee la lógica de filtrar y a dónde ir) y
   `host.picker(items, {anchor, onPick})` (el panel clicable del historial). Se añadió `host.anchorRect(name)`
   —la caja en pantalla de un chip para anclar widgets—; hoy lee la ref del chip del Map (misma-hebra),
   cuando la escena viva en el shell leerá su propio registro.
   **Canal de escena, parte 1/2 (chips EXISTENTES) — HECHO.** `host.scene.remove/removeChild/
   removeList/removeAll/flash/rename` + `host.anchorRect`. Rewireados: `· * ocultar`/`· []* ocultar`/
   `· ֎* ocultar`/`eliminar elemento del dom` (quitar), `· * quitar`/`· * eliminar` (removeAll +
   lógica de place), `resaltar chip`/`registrar ejecución` (flash), `· * renombrar` (rename del chip),
   y el anclaje de `· # abrir`/`· ! abrir`/`· * padres`/`· * referencias` (anchorRect). Hoy `host.scene`
   opera sobre las refs `${name} ֎` del Map (misma-hebra); tendrá su propio registro cuando la
   creación también viva en el shell.
   **Canal de escena, parte 2/2 (MOTOR 3d + create chip) — HECHO.** Los cuerpos de `3d init/
   proyectar/render/reset/punto en plano/controles/limpiar`, `es fondo`, `create chip` e
   `install mover` viven ahora en `host.scene` (init/project/render/reset/worldPoint/controls/clear/
   isBackground/make/installDrag); los átomos son **shims** que delegan ahí, así ningún llamador
   cambió. El estado (escena/cámara/mira) sigue en refs `3d … ֎` del Map (misma-hebra), que `init`
   pone y `host.scene`/`panorámica` leen. De paso, `init` endurece el aspecto con `|| 1` (arrancar
   OCULTO daba innerWidth 0 → aspecto NaN → matriz de proyección NaN → se caían pan y arrastre).
   Verificado: arranque/proyección, place-switch, crear chip, arrastre, pan/zoom/órbita, reset,
   grafo y panorámica.
   **Cleanup de escena — mayor parte HECHA.** Al shell: el subsistema **grafo** (`host.grafo.init/draw`,
   con `grafo init/dibujar ƒ` como shims); **`install style manager` → `host.installStyles`** (mantiene
   el override de `diarsaba.set` que sincroniza los `{` a `<style>`); las clases de MODO del body vía
   **`host.mode(cls, on)`** (`grafo ƒ`, `mover ƒ`, `panorámica ƒ`/`entrar`); y el **anclaje de chips-hijo**
   (`· $/§/ƒ abrir`, `· ~ abrir`, `· * parents` → `host.anchorRect`).
   **Registro `${name} ֎` → `host.scene` — HECHO (arranque del Paso 4).** El registro de refs DOM de
   los chips salió del `Map` a cuatro Maps privados de `host.scene` (`_chips`/`_child`/`_list`/
   `_submenu`) con API (`register/ref`, `openChild/child`, `openList/listRef`, `openSubmenu`,
   `forgetChips`); 26 átomos funneleados y los dos barridos de claves `֎` eliminados (los sustituye
   `clear → forgetChips`). El `Map` ya no guarda refs DOM de chip. Ver el bloque "Estado actual".
4. **Partir shell/worker: el transporte worker.** Como los átomos ya solo hablan `host.*`, se
   añade un segundo transporte: los átomos corren en un worker; `host.*` se vuelve `postMessage`.
   El shell posee el bucle de render, Three, Monaco y Go. Se voltea el universo 0 a un worker y se
   verifica que se comporta igual.
   **Arranque HECHO:** el registro `${name} ֎` ya vive en `host.scene` (26 átomos funneleados, el
   `Map` sin refs DOM). **Pase a async HECHO:** las 3 llamadas host que devuelven valor
   (`anchorRect`/`worldPoint`/`isBackground`) se awaitan en 13 átomos `async`; el shell (pointer
   handlers) las llama directo (sync). **De-DOM del elemento devuelto HECHO:** `· ֎ editar`/`guardar`/
   `· ֎*/#* padre` (8 átomos) hablan `host.scene.editChild`/`commitChild`/`spawnChipLeftOf`. Resta: el
   canal de EVENTOS (despacho `handle click`/`show context menu` que leen `event.target`), las marcas
   de clase de widgets + `clamp` sin escena, decoplar los átomos VOID que el shell aún llama (`grafo
   dibujar`, `3d render`), y ya el transporte worker. **Canal de EVENTOS HECHO:** `host.hit(e)`
   clasifica el clic en un payload semántico (`kind/name/type/parent/pano/world`); los 4 lectores y
   los 5 setters sintéticos ya no tocan `event.target`. **Limpieza final HECHA:** `host.clearMenus`/
   `setMenu`/`setChipMenu` (menús rastreados por el shell), `host.scene.tagPano`, `openSubmenu` marca
   la clase, `clamp` → `host._clamp`; y el shell dejó de llamar átomos en el bucle de render
   (`render/reset/project/grafo.draw` directos). Ningún átomo toca el DOM salvo el `addEventListener`
   de `on start ƒ`. **Resta solo el transporte worker** (que muda esos listeners y vuelve `host.*` en
   `postMessage`).
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
