# DIARSABA — el paquete portable

Este es `frontend/demo/menu/index.html` partido en piezas para poder llevárselo a
otro anfitrión (Tauri, un navegador suelto, lo que venga). **No hay nada de Go, ni
de Wails, ni de Three.js.** Lo que hay es HTML/CSS/JS y el motor de threads.

El demo de un archivo sigue en `../menu/index.html`, intacto y funcionando: éste es
la misma cosa reorganizada (más el editor del proyecto principal, y el estilo y la
forma convertidos en átomos), 130 átomos.

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
index.html              20 líneas: el lienzo y un <script type="module">. Sin CSS
un-archivo.html         GENERADO — el mismo programa en una pieza, abre a doble clic
herramientas/
  atomos-a-json.mjs     átomos: la fuente .mjs → el .json que lee el cargador
  json-a-atomos.mjs     la vuelta, recuperando los comentarios
  empaquetar.mjs        lo que genera un-archivo.html desde src/
src/
  kernel.js             Map + createFunction + threads  ← el motor de threads
  cargador.js           siembra el Map desde los JSON, compilando los "ƒ"
  arranque.js           EL ÚNICO archivo que sabe en qué anfitrión estamos
  shell/
    host.js             ensambla el shell y lo pone en window.host
    widgets.js          menús (contenedor), modal, scene (árbol), hit() (eventos)
    lienzo.js           el lienzo y host.pintar(html). Sin formas
    editor.js           el editor de la app: Monaco + selector de lenguaje + ✨
    estilos.js          los átomos "{" → <style>, y repintado al guardar
    aislamiento.js      el worker con reloj: correr algo que no es de fiar
    broker.js           kv / save / load / p2p / ai — NULO, para que lo enchufes
  atomos/
    nucleo.mjs   ← FUENTE   74 átomos: sigilos, despacho, menús, opciones, places
    estilo.mjs   ← FUENTE    5 átomos: el CSS, uno por sujeto
    escena.mjs   ← FUENTE   29 átomos: el árbol de escena.png
    pruebas.mjs  ← FUENTE   22 átomos: el banco de pruebas aislado
    *.json       GENERADOS  lo que lee el cargador
```

## El estilo es del programa

No hay `estilo.css`. El CSS son **cinco átomos `{`** —`estilo base {`, `estilo del
lienzo {`, `estilo del menú {`, `estilo del modal {`, `estilo del editor {`— y el
shell les da un `<style>` a cada uno. Es el mecanismo de `install style manager` /
`host.installStyles` de la app real, donde vive `todo el estilo {`; aquí está
partido por sujeto para poder abrir el que te importa.

Lo que eso compra: **abres `estilos #` desde el menú, editas `estilo del menú {` en
el editor —con resaltado de CSS, porque `lenguajes :` dice que `{` es css— y al
guardar el menú cambia mientras lo miras.** El shell envuelve `diarsaba.set`, así
que guardar un `{` repinta su etiqueta. Sin recargar, sin tocar un archivo.

El precio, dicho claro: hasta que el cargador siembra los átomos no hay estilo, así
que hay un **parpadeo** al arrancar. Es el mismo que paga la app real por lo mismo.

## Y la forma también

Lo mismo con el HTML: los átomos **`<`** son marcado de verdad. `circulo <`,
`trazo <`, `texto <`, `menu <`, `menu item <`. El shell ya no sabe qué es un
círculo ni cómo se ve un menú: recibe HTML y lo pone.

```
circulo <   <div class="escena-circulo" style="left:{{x}}%;top:{{y}}%;…"></div>
menu <      <span class="menu-titulo">{{titulo}}</span>{{{items}}}
```

`plantilla ƒ` es toda la maquinaria: `{{clave}}` **escapa** el valor, `{{{clave}}}`
lo mete crudo. Nada de lenguaje de plantillas, y el escapado por defecto es lo que
evita que el nombre de un átomo que te llegó por la red se convierta en marcado
(`escapar ƒ` vivía en el shell como `_render`; ahora es del programa, porque quien
arma el marcado es el programa).

**El shell conserva dos ganchos, y sólo dos**, para convertir un clic en un dato:

```
.menu-item[data-idx="N"]   un ítem y su índice
.menu-titulo               el título (pulsarlo va DEL MENÚ)
```

Cambia el marcado como quieras mientras esos dos existan. La línea es: el
**contenedor** es del shell (una caja posicionada, con su id, en el árbol); el
**contenido** es del universo.

Lo que **no** se movió, y es deliberado: el modal y el editor siguen construyendo
su DOM en el shell. El editor es la envoltura de una capacidad del anfitrión
(Monaco) y el modal es el siguiente candidato natural — ya usa ganchos
(`[data-modal]`), así que un `modal <` saldría igual.

En líneas el shell no adelgazó tanto (1092 → 1032); lo que cambió es **de qué
habla**. En `lienzo.js` no queda ni un color, ni una clase, ni un estilo: sólo qué
nodo es el lienzo y cuánto escalarlo para esta ventana — que no es forma, es la
ventana, y la ventana es del anfitrión.

## Editar los átomos

**La fuente son los `.mjs`; los `.json` se generan.** Un átomo `ƒ` es código, y en
JSON vive como una cadena de una línea con todo escapado: sin resaltado, sin
comprobar sintaxis y sin comentarios, que es donde está la mitad de lo que explica
este programa. En `.mjs` es código de verdad, en un template literal, con sus saltos
de línea y sus comentarios.

```bash
node herramientas/atomos-a-json.mjs            # fuente → json
node herramientas/atomos-a-json.mjs --revisar  # sólo comprueba, no escribe
node herramientas/empaquetar.mjs               # y de ahí a un-archivo.html
```

El JSON sigue siendo el formato de **ejecución**, y eso no cambia: es lo que la
estructura atómica pide y lo que la app real guarda en `predefined_functions.json`
y en su bbolt. Lo que cambia es dónde se escribe.

**Antes de escribir nada, comprueba** —y si algo falla no toca ningún `.json`:

- que cada `ƒ` **compile** (con `new Function`, igual que el cargador);
- que ningún átomo esté **dos veces**, ni en un archivo ni entre grupos. Los del
  mismo archivo se cuentan sobre el TEXTO, porque JS —y `JSON.parse`— se quedan con
  el último y tiran el otro sin decir nada: un átomo desaparece y el programa sigue
  arrancando;
- que el **sigilo** final sea uno de los conocidos;
- que cada `.json` **coincida** con su fuente. Si no, lo editaste a mano: lo dice
  con `≠` y `--revisar` sale con error.

### La vuelta

El programa también se edita **en vivo**: abres un átomo en el editor, lo cambias, y
la verdad pasa a estar en el `Map`. Si exportas eso (`broker.exportar()`) tienes un
JSON más nuevo que tu fuente:

```bash
node herramientas/json-a-atomos.mjs            # json → fuente
```

Los comentarios se **recuperan** del `.mjs` que ya existe: para cada átomo se buscan
las líneas que tenía justo encima y se vuelven a poner. Un átomo nuevo llega sin
comentario, y uno que cambió de nombre pierde el suyo — se busca por nombre, no hay
otra pista. La primera migración se hizo así, sacándolos del demo de un archivo:

```bash
node herramientas/json-a-atomos.mjs --desde ../menu/index.html
```

La ida y la vuelta son **sin pérdida** en los datos: regenerar el JSON desde la
fuente da un archivo idéntico byte a byte.

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
| `host.menu(html, parent, current, x, y, onPick, desde) → id` | un menú, con el marcado ya hecho; `x/y` nulos = junto al puntero |
| `host.modal(pre) → texto \| null` | pedir una línea |
| `host.editor(nombre, src, lang) → src' \| null` | editar un cuerpo |
| `host.diff(titulo, a, b, lang) → bool` | comparar dos versiones (true = restaurar) |
| `host.notify(msg)` | un aviso |
| `host.installStyles()` | los átomos `{` a `<style>`, y repintado al guardar |
| `host.closeMenu(id)` / `host.clearMenus(alsoModals)` | cerrar uno / barrer todo |
| `host.menusDe(nombre)` / `host.repintar(id, html)` | quién muestra esa lista / cambiarle el contenido |
| `host.listaDe(id)` / `host.itemRect(id, i)` | qué muestra un menú / dónde está un ítem |

### Escena (el lienzo del place)

| Verbo | Qué hace |
|---|---|
| `host.limpiarLienzo(nombre)` | vaciar: lo primero de un viaje |
| `host.pintar(html)` | añade marcado al lienzo — el único verbo de dibujo |

Las coordenadas son **% del place**; los tamaños, **px de un escenario de
200×200** que se escala a la ventana. Pero eso ya no lo sabe el shell: vive en los
átomos `circulo <` / `trazo <` / `texto <` y en `estilo del lienzo {`. El shell
sólo mete marcado. Un shell con Three.js no cumpliría `pintar` sino otro verbo, y
ahí es donde harían falta otros átomos `<` — la vista web de este universo es una
vista, no *la* vista.

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

### El editor

Es el del proyecto principal, con el mismo marcado y las mismas clases CSS
(`.language-selector`, `.dropdown-item`, `.save-button`, `.ai-prompt`…), copiadas
de `todo el estilo {`. Trae el **selector de lenguaje** —HTML, JavaScript, CSS,
Python, Go, JSON, Texto—, `Ctrl+S` para guardar, `Ctrl+I` para el asistente, y
`Esc` que primero cierra la lista de lenguajes y luego el editor (sin dejar que el
`Esc` llegue al de la ventana, que barre los menús).

**Con qué lenguaje se abre lo decide el sigilo**, igual que en la app real (donde
hay un `· <tipo> editor ƒ` por tipo). Aquí es una tabla, `lenguajes :`, así que se
cambia desde el menú:

| sigilo | lenguaje | | sigilo | lenguaje |
|---|---|---|---|---|
| `ƒ` | js | | `:` `@` | json |
| `<` | html | | `#` `~` `!` `$` `§` `֎` | text |
| `{` | css | | | |

El selector cambia el resaltado a mano cuando quieras: un átomo puede guardar HTML
en un `§` y verse como HTML sin que su sigilo cambie.

Tres cosas son configuración, no dependencias:

- **Monaco** — `crearHost({ vs: "/vs/" })`. Sin él el editor abre igual, en un
  `<textarea>`, con la misma cabecera y el mismo selector: se pierde el resaltado,
  no el editor.
- **Los iconos** (Font Awesome) — `crearHost({ iconos: "/fa/css/all.min.css" })`.
  Sin ellos los `<i>` quedan vacíos y el **nombre** del lenguaje sigue visible, así
  que se elige igual. Por defecto prueba `../../public/fa/` y `/fa/`.
- **El asistente ✨** — llama a `host.broker.ai(código, lang, instrucción, system)`,
  no a una binding de Go. El `system` sale del átomo `ai system §`. Sin anfitrión lo
  dice en la bitácora y no pasa nada más.

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

Desde que la fuente es `.mjs`, los comentarios viven **junto a su átomo** — ahí es
donde hay que escribirlos. Lo de abajo se escribió cuando la fuente era el JSON y
no cabían; se mantiene porque lee de un tirón, como un mapa del programa.

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
- **`colores :`** — los nombres de los colores. Cambiar "verde" ahí repinta el árbol
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
- **`veredictos :`** — cómo se ve cada veredicto: un color por motivo. Es un dato, así
  que se cambia desde el menú.

## Un cambio de convención respecto a la primera versión

Al traer el editor salió a la luz que usaba `{` para los diccionarios, y en el
proyecto principal **`{` es un estilo (CSS)** —`todo el estilo {`— mientras que la
estructura JSON es **`:`**. Se corrigió: `colores :`, `veredictos :`, `lenguajes :`,
y `interpretar valor ƒ` parsea JSON en `:` y deja `{` como texto CSS. Si te llevas
átomos de un lado al otro, ahora los sigilos significan lo mismo en los dos.
