# DIARSABA — el paquete portable

Este es `frontend/demo/menu/index.html` partido en piezas para poder llevárselo a
otro anfitrión (Tauri, un navegador suelto, lo que venga). **No hay nada de Go, ni
de Wails, ni de Three.js.** Lo que hay es HTML/CSS/JS y el motor de threads.

El demo de un archivo sigue en `../menu/index.html`, intacto y funcionando: éste es
la misma cosa, pero **con el universo soberano**: dibuja, mide, escucha y se
arranca solo. 149 átomos.

## El universo se gobierna solo

El corazón es el **universo de átomos**. Se vale por sí mismo: toca el `document`
y la ventana **a mano, desde sus propios átomos** —no hay un host que dibuje por
él ni un `host.crearCirculo()` que sepa qué es un círculo—. El HTML y el CSS viven
dentro como átomos (`<` y `{`) para construir las cosas ahí mismo.

| Capa | Qué es | Toca el DOM |
|---|---|---|
| **motor** (`src/kernel.js`) | el `Map`, `createFunction`, `threads` | no |
| **universo** (`src/atomos/*`) | el programa: datos, código, forma, estilo, y **su propio dibujo** | **sí, él mismo** |
| **shell mínima** (`src/shell/host.js`) | sólo presta librerías externas (Monaco). No decide ni dibuja | — |

La regla de este lado: *si el universo no puede tocarlo, no debe existir dentro de
su mundo.* Un nodo que el universo no puso (el viejo `<div id=lienzo>` del HTML) o
un verbo que dibuja por él (`host.pintar`) violaban su soberanía. Ya no están: el
universo crea su lienzo, sus menús y su modal, y escribe hasta el nombre del place.
Lo único que la shell le presta es lo que no puede fabricar: **Monaco** (el editor),
que consume directo. El motor (`createFunction` + `threads`) es la otra shell —la
que nombraste—; Tauri será la tercera, afuera, y al universo le da igual.

## Los archivos

```
index.html              un <body> vacío y un <script>. El universo crea lo demás
CRDT.md                 el plan del CRDT (nada implementado)
servidor/main.go        servidor mínimo en Go, sólo para desarrollar sin Tauri
herramientas/
  atomos-a-json.mjs     átomos: la fuente .mjs → el .json que lee el cargador
  json-a-atomos.mjs     la vuelta, recuperando los comentarios
src/
  kernel.js             Map + createFunction + threads  ← el motor (una shell)
  cargador.js           siembra el Map desde los JSON, compilando los "ƒ"
  arranque.js           presta el entorno y cede el control a «arrancar ƒ»
  shell/
    host.js             la shell mínima: sólo presta Monaco al universo
    editor.js           Monaco: la librería externa que el universo consume
    broker.js           ai (para el editor) / exportar. El resto se fue con el CRDT
  atomos/
    nucleo.mjs   ← FUENTE   ~95 átomos: sigilos, despacho, menús, lienzo, gestos, arranque
    estilo.mjs   ← FUENTE    5 átomos: el CSS, uno por sujeto
    escena.mjs   ← FUENTE   29 átomos: el árbol de escena.png
    pruebas.mjs  ← FUENTE   23 átomos: el banco de pruebas aislado (worker incluido)
    *.json       GENERADOS  lo que lee el cargador
```

Los `.js` de dibujo, menús, estilos y aislamiento **ya no existen**: eran del
shell, y su lógica vive ahora en átomos de `nucleo.mjs`/`pruebas.mjs`. Lo que un
átomo hace con el DOM lo hace con `document.…` directo, dentro de su propia fuente.

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

Hay **una sola versión**: `index.html` + `src/`. Necesita que alguien lo sirva,
porque los módulos ES y el `fetch` de los JSON están bloqueados en `file://`.
**Tauri lo sirve** por su propio protocolo, así que ahí no hay nada que hacer. Para
mirarlo sin Tauri, hay un servidor mínimo en Go (`servidor/main.go`, sólo la
librería estándar, sin depender del `go.mod` de la app real más que en compartir
módulo):

```bash
go run ./frontend/demo/menu-portable/servidor            # localhost:8778
go run ./frontend/demo/menu-portable/servidor -puerto 9000
```

Sirve esta carpeta **sin importar desde dónde se invoque** (resuelve su propia
ubicación en tiempo de compilación, así que `go run ./servidor` desde dentro o
`go run ./frontend/demo/menu-portable/servidor` desde la raíz del repo dan lo
mismo), fuerza los tipos MIME de `.mjs`/`.json` (el registro de Windows a veces no
los tiene, y sin `application/javascript` un `<script type="module">` no arranca),
y no cachea nada — editas un átomo, refrescas, lo ves. No es el shell de Tauri: no
tiene broker, y no sirve `vs/` ni `fa/` salvo que los copies dentro de esta carpeta
(entonces el editor los encuentra solo, por las rutas relativas que ya prueba).

Cualquier servidor estático vale igual, claro — por ejemplo:

```bash
python -m http.server 8778 --directory frontend/demo/menu-portable
```

*(Hubo un `un-archivo.html` —todo aplanado en una pieza, sin módulos ni fetch—
para poder abrirlo a doble clic. Se fue al elegir Tauri: existía sólo para el caso
que Tauri elimina, y mantener dos versiones del mismo programa es exactamente la
clase de cosa que acaba divergiendo. Con él se fueron `herramientas/empaquetar.mjs`
y las marcas `⟨sembrar⟩` del cargador, que sólo servían para copiar la regla de
sembrado al bundle.)*

## El borde — lo que el anfitrión tiene que dar

Casi nada, y ahí está el punto: **un `<body>` y Monaco cargado.** Eso es todo lo
que el universo no puede fabricar. Lo demás lo hace él.

Lo que antes eran verbos del host —`menu`, `pintar`, `hit`, `worker`, `modal`,
`notify`, `installStyles`, `clamp`…— ahora son **átomos** que tocan el `document`
y la ventana directo. Viven en `nucleo.mjs` (dibujar, menús, gestos, estilos,
arranque) y `pruebas.mjs` (el aislamiento). Se abren, se leen y se cambian desde el
menú como cualquier otro átomo; están en los catálogos `borde #`, `lienzo #`,
`estilos #`, `marcado #`, `despacho #`.

El punto de entrada es el átomo **`arrancar ƒ`**: instala los estilos, crea el
lienzo, cablea los gestos de la ventana (`pointerup`/`keydown`/`resize`…) y viaja
al primer place. `arranque.js` no hace más que compilar los átomos y llamarlo — los
listeners viven en el universo, no en el HTML ni en un shell.

- **Dibujo:** `pintar ƒ` mete marcado en `#lienzo` (un nodo que crea `crear lienzo ƒ`);
  las formas son `circulo <`/`trazo <`/`texto <`. Coordenadas en **% del place**,
  tamaños en **px de un escenario 200×200** (`estilo del lienzo {`). Otro shell con
  Three.js necesitaría otros átomos `<` — la vista web es *una* vista, no *la* vista.
- **Menús:** `create list menu ƒ` crea el `.context-menu`, `cablear menú ƒ` arma el
  payload del clic, `registro de menús ֎` lleva el árbol de abiertos. Dos ganchos
  bastan para leer un clic: `.menu-item[data-idx]` y `.menu-titulo`.
- **Gestos:** `clasificar gesto ƒ` convierte el evento del DOM en datos
  (`{ kind, menu, parent, name, index, titulo, … }`); nadie más toca `event.target`.
- **Aislamiento:** `probar aislado ƒ` crea el `Worker` desde `sandbox de pruebas §`,
  con reloj; devuelve siempre un veredicto (`ok`/`colgada`/`reventó`), nunca lanza.

### El editor — la librería que la shell presta

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

### Broker (lo de fuera) — lo que queda

`host.broker.{exportar, ai, recargar, al, emitir}`. Eso es todo.

Se quitaron `kv.*`, `guardar`, `cargar` y `p2p.*`: **la única persistencia y el
único contacto con el exterior van a ser los JSON de los átomos, gestionados con
CRDT.** Un almacén por clave y una red por verbos son dos maneras de resolver lo
mismo que el CRDT resuelve de una — y tenerlos a la vez dejaba tres verdades
posibles del mismo átomo (la del `Map`, la del `kv`, la del par remoto), que es
justo el problema del que el CRDT te saca. Ningún átomo los usaba.

De lo que queda, `exportar()` es el único que funciona sin anfitrión —serializa,
no escribe— y es la forma exacta de lo que el CRDT gestionará. `ai` y `recargar`
son capacidades del anfitrión, no persistencia. `al`/`emitir` es el gancho por
donde entrará un cambio remoto cuando el CRDT exista.

**El CRDT no está escrito.** Cuando lo esté, entra por aquí; y para que tenga
dónde agarrarse falta una cosa en el universo. El plan entero está en [CRDT.md](CRDT.md).

## Llevarlo a Tauri

1. Copia la carpeta a `src/` (o donde sirva tu app) y apúntale el `index.html`.
2. En `src/arranque.js`, una línea:
   ```js
   const host = crearHost({ broker: miBroker, vs: "/vs/", iconos: "/fa/css/all.min.css" });
   ```
3. Cuando el CRDT exista, los átomos dejarán de venir de los `.json` de disco y
   vendrán de él. El sitio ya está: `cargar({ leer })` en `src/cargador.js` recibe
   de dónde leer cada grupo, sin que ningún átomo cambie.

Ningún átomo cambia en ninguno de los tres pasos. Eso es lo que significa que esté
preparado.

## Lo que NO viene (a propósito)

- **Three.js, chips, cámara, panorámica, grafo**: la app real proyecta el place en
  3D; aquí el lienzo son divs y SVG, creados por el propio universo.
- **El CRDT**, que será la única persistencia y el único contacto con el exterior.
  Con él se fueron del broker el `kv`, el `guardar`/`cargar` y el `p2p`.
- **El worker de T3 (`CONTENEDOR.md`)**, y a propósito. Ese plan quería el universo
  SIN DOM para poder correrlo en un worker; este lado eligió lo contrario —el
  universo **toca el `document` a mano**, es soberano de su propia vista—, y un
  worker no tiene DOM. Es soberanía a cambio de separabilidad-en-worker, una
  decisión de diseño de este paquete, no un descuido. El aislamiento (`probar
  aislado ƒ`) sigue usando un worker, pero para lo que no es de fiar, no para el
  universo entero.

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

## El CRDT

El plan está en [CRDT.md](CRDT.md): qué se fusiona, dónde vive cada pieza, qué
no sincroniza nunca, las fases, y lo que le falta al programa para que tenga
dónde agarrarse (un punto único por el que pasen los cambios — hoy no existe).

Nada de eso está implementado.
