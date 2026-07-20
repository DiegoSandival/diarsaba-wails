# DIARSABA — modelo mental

> Doc de contexto para retomar el proyecto (o abrir un chat nuevo con poco contexto).
> No es una app estándar: es un **entorno de programación visual y en vivo**.

## Idea central

Toda la lógica de la app vive en **`predefined_functions.json`** como un `Map` global
llamado `diarsaba`. `index.html` solo hace el *bootstrap*:

1. Carga el loader de Monaco y define `createFunction` (compila strings JS a funciones),
   `threads` (ejecuta acciones/threads) y la clase `CodeEditor`.
2. En `DOMContentLoaded` hace `fetch("predefined_functions.json")`, mete cada entrada en
   el `Map` (las que terminan en `ƒ` se compilan con `createFunction`) y ejecuta
   `on start ƒ`.

El `<body>` arranca vacío: **todo se dibuja como "chips"** (divs `.object-name`) sobre un
lienzo.

## Átomos y sigilos

Cada entrada del `Map` es un **átomo**, tipado por el **sigilo final** de su clave:

| Sigilo | Tipo | Valor almacenado |
|--------|------|------------------|
| `ƒ` | función | string JS, compilado por `createFunction` |
| `§` | texto | string |
| `$` | número | number |
| `#` | lista | array |
| `~` | thread | array de nombres (secuencia a ejecutar) |
| `!` | acción | array de nombres de función a ejecutar |
| `:` | map | objeto |
| `{` | estilo | CSS (se inyecta como `<style>` vía `install style manager ƒ`) |
| `<` | vista | HTML |
| `@` | place | lienzo espacial: `{ "nombre atom": {x, y}, ... }` |
| `֎` | chip | referencia al elemento DOM del chip |

Convención de claves derivadas: `"X ֎"` = el chip DOM de `X`; `"X # ֎"` = la lista abierta de `X`;
`"X ֎ ֎"` = el chip hijo abierto.

## Interacción (cómo se "usa" la app)

- **Click / click derecho** sobre chips → `handle click ƒ` y `show context menu ƒ` manejan todo.
- Los menús contextuales por tipo se definen en arrays `list option <tipo> #`
  (p. ej. `list option ƒ #`, `list option ! #`).
- **Editar** un átomo abre **Monaco** con `window.codeEditor.open(titulo, valor, lenguaje)`.
  Doble-click sobre un chip cuyo sigilo esté en `editables list #` abre el editor general.
- ⚠️ Un chip `ƒ` **no se ejecuta** al hacer click (se edita). Para *ejecutar* algo se usa
  `!` o `~`: click derecho → `· ! action` → `threads(nombre)` corre la lista de funciones.

Tres formas de "quitar" un chip (menú contextual), de menos a más destructiva:
- `· * ocultar` — quita solo el chip del DOM; sigue en el place y en `diarsaba` (reaparece al recargar).
- `· * quitar` — quita del place actual y del DOM; **el átomo permanece** en `diarsaba`.
- `· * eliminar` — **definitivo**: borra el átomo de `diarsaba`, sus refs y de *todos* los places.

Listas "vivas": al hacer click en un ítem de una lista abierta, `dispatch item ƒ` lo despacha
por su sigilo — `!`/`~` ejecutan (`threads`), `#` abre esa lista como sublista, `ƒ` corre la
función. Los `.context-menu` tienen `max-height` + scroll, así que sirven como widget de lista
reutilizable. Al crearse, `clamp to viewport ƒ` los reposiciona para que no se salgan de la
ventana (mide el tamaño natural en 0,0 porque el `.context-menu` es shrink-to-fit).

## Persistencia

`guardar ! ƒ` serializa **todo el `Map`** de vuelta a `predefined_functions.json`
(método Go `SavePredefinedFunctions`, que versiona el archivo anterior).

> ⚠️ Consecuencia importante: cualquier secreto guardado como átomo normal se escribiría
> al repo. Por eso los secretos (API keys) viven en el **backend Go**, no en el `Map`.

## Places (`@`) — espacios de trabajo

Un place es un objeto `{ "atom": {x, y} }`. `current place §` indica el activo.
`on start place ƒ` fija `current place` en `"diarsaba @"` y pinta sus chips.
Doble-tap sobre un chip `@` (`on double tap place ƒ`) carga los chips de ese place.
`add to place ƒ` registra la posición de lo que creas en el place actual.

> ⚠️ **Los pintores DEBEN registrar `"<nombre> ֎"`.** `create chip ƒ` devuelve el div y hay
> que guardarlo en el Map: todo lo que ancla a un chip (`· # abrir`, `· § abrir`, `· * ocultar`,
> `· ֎* padre`) lo busca ahí. Durante un tiempo los dos pintores lo tiraban, así que los chips
> *pintados* al cargar un place no tenían referencia — solo la tenían los que *creabas* en el
> momento (`handle click ƒ` sí la registraba). El síntoma era que el hijo aparecía desplazado:
> `· # abrir ƒ` cae a la posición del puntero cuando no encuentra el chip, y el puntero está
> *encima* del chip que acabas de pulsar, no a su lado. `· * ocultar` simplemente no hacía nada.
> `on double tap place ƒ` además limpia las refs antes de `replaceChildren()`, o quedarían
> apuntando a nodos ya fuera del documento.

### Mover chips

Botón `✥` (abajo a la derecha, `install mover ƒ`) que activa un **modo**: mientras está
encendido, arrastrar mueve el chip y guarda su nueva posición en el place actual. Es un modo y
no un arrastre siempre-activo para no pelearse con el clic, que abre y edita.

El clic se corta por partida doble, a propósito: los listeners van en **fase de captura** sobre
`window` (llegan antes que los de `on start ƒ`, que están en burbuja, y hacen `stopPropagation`),
y además `handle click ƒ` y `show context menu ƒ` empiezan con una guarda explícita. Lo segundo
es porque lo primero depende de un detalle sutil del orden de eventos que se rompería en
silencio si algún día reescribes `on start ƒ`.

El botón vive en el `body`, así que `replaceChildren()` lo borra al cambiar de place: por eso
`on double tap place ƒ` lo reinstala. `install mover ƒ` es idempotente en sus dos mitades (el
botón se recrea; los listeners de `window` solo se registran una vez, marcado con
`mover instalado ֎`).

## Capa WebSocket / p2p (backend Go)

Protocolo binario hacia un backend Go: `ws opcodes :` (mapa de opcodes),
`encode frame ƒ` / `decode frame ƒ`, y funciones como `create db ƒ`, `write ƒ`, `read ƒ`,
`relay ƒ`, `dial ƒ`, `sub/pub ƒ`, firma de llaves, etc. (libp2p + una capa de DB por celdas).

## Red P2P — p2plite (añadida 2026-07)

El place **`p2p @`** es la librería [`p2plite`](../../p2plite) hecha átomos: seis primitivas
(`Announce`, `StopAnnounce`, `FindProviders`, `Connect`, `OpenStream`, `SetStreamHandler`)
más diagnóstico (`ID`, `Addrs`, `FullAddrs`, `Peers`, `RoutingTableSize`, `ConnKind`, `ConnIP`).

- **Go (`p2p.go`)**: bindings `P2P*`. El nodo **arranca solo** la primera vez que se usa
  cualquier primitiva, así que el place no necesita un botón de encendido y la app no paga
  la red si nunca se toca. `OnShutdown` lo cierra limpiamente.
- **Lo que no es serializable se queda en Go.** Un `Stream` no cabe en un binding: Go
  devuelve un identificador y el frontend lo opera con `P2PStreamRead/Write/CloseWrite/Close`.
  Los bytes viajan en **base64** — para la librería son opacos y aquí siguen siéndolo.
  Un stream que nadie toque en 2 minutos se recoge solo (el frontend puede recargarse a media
  conversación y dejarlo huérfano).
- **Streams entrantes**: Go registra su handler *antes* de `Start` y emite el evento
  `p2p:stream` con `{from, stream}`. `SetStreamHandler ƒ` se suscribe una sola vez y delega en
  el átomo **`p2p on stream ƒ`** — editable como cualquier otro: ahí se decide qué se contesta.
- **Frontend (`index.html`)**: los bindings se agrupan en `window.p2p` (son 18 y todas del
  mismo tema) y se expone `window.EventsOn`.
- **Átomos de apoyo del place**: `p2p arg ƒ` / `p2p peer ƒ` (un ƒ se llama desde código con el
  valor, o con un clic — y entonces hay que preguntar), `p2p out ƒ` (deja el resultado en
  `p2p result §`), `p2p stream ƒ` (envuelve el identificador en algo con lo que hablar),
  `p2p peer §`, `p2p providers #`, `p2p announced #`.
- **El peer se hereda**: `FindProviders` deja el primer proveedor en `p2p peer §`, así que
  `Connect`/`OpenStream`/`ConnKind` funcionan con un clic. `OpenStream` con clic hace el viaje
  completo (mensaje → respuesta); llamado desde código devuelve el stream y decides tú.

### `simple p2p @` — la versión a prueba de tontos

`p2p @` expone la librería tal cual (trece ƒ, una por primitiva) y sirve para explorar.
Para *usar* la red hay un segundo place, independiente: **`simple p2p @`**. No comparte
átomos con `p2p @`, así que romper uno experimentando no rompe el otro.

Son cinco chips y un menú. **`p2p #` es el menú, no un inventario**: al abrirlo, un clic
simple en un ítem lo ejecuta (`dispatch item ƒ` corre las `!` directas), y `entradas #`
se abre como sublista. Eso evita tener que saber que ejecutar es click-derecho →
`· ! action`.

- `mi id !`, `anunciar !`, `buscar !`, `enviar !`, `dejar de anunciar !` — y `entradas #`.
- **`SetStreamHandler` no existe como concepto aquí**: `anunciar !` activa la escucha solo.
  Anunciar sin escuchar es una trampa (te encuentran y no contestas). Lo entrante se apila
  en `entradas #` con hora y remitente, y se contesta `recibido: …` automáticamente.
- Todo termina en un modal: un `§` solo se ve si lo abres, y aquí el resultado no se puede
  perder. Los mensajes entrantes NO alertan — taparían la pantalla.
- El mensaje se pide **antes** de conectar: `OpenStream` tarda hasta 30 s en rendirse, y
  preguntar después de esa espera parece que la app se colgó.
- Los errores dicen qué hacer, no qué pasó ("la otra app se cerró, vuelve a «buscar !»").

### `p2p ƒ @` y `p2p ! @` — funciones y ejecutores, separados

Un tercer par de places, pensados para **componer** en vez de para guiar. Como el Map de
diarsaba es plano (un place es solo posiciones), sus átomos van prefijados —
`p2p ƒ @ Announce ƒ` — para no pisar los de `p2p @`.

- **`p2p ƒ @`** tiene las funciones: `ID`, `Announce`, `StopAnnounce`, `FindProviders`,
  `OpenStream`, `StreamHandle`, `Reply`, más los helpers `arg ƒ`, `dice ƒ`, `stream ƒ`.
- **`p2p ! @`** tiene los ejecutores y su estado: `ID !`, `Announce !`, … y `Streams #`.

**Cómo se pasan parámetros.** Un `!` es `[ƒ, ...parámetros]`, y `threads` hace
`a.apply(null, s.slice(1))`: los elementos llegan como **strings literales**, o sea el
*nombre* del átomo, no su valor. Por eso cada ƒ los resuelve con `arg ƒ` (si el string
nombra un átomo, usa su contenido; si no, lo toma literal). Así
`["… Announce ƒ", "p2p ƒ @ anunciar §"]` funciona editando solo el `§`.

**JSON por el cable, y por qué el base64 no se va.** La carga viaja como JSON. El base64 que
se ve en `stream ƒ` **no** es el formato: es el salto Go↔JS, que es JSON por definición de los
bindings de Wails (`internal/frontend/dispatcher/calls.go`) y codifica `[]byte` en base64
quieras o no.

Los átomos de carga son **mapas `:`** (`p2p ƒ @ enviar :`, `p2p ƒ @ responder :`), no valores
sueltos, y eso es lo importante: en diarsaba un valor sin sigilo no se puede abrir, editar ni
despachar. Con `:` los edita `· : editor ƒ` — Monaco en modo `json`, que valida y rechaza el
guardado si el JSON es inválido.

> Esto empezó siendo **msgpack** (binario, tipado, compacto) y se cambió por dos razones que
> pesan más que sus ventajas: obligaba a un átomo **sin sigilo** —es decir, fuera del modelo
> del entorno—, y **aislaba el place**: ni la propia CLI de p2plite podía hablar con él, hubo
> que escribir un peer a medida solo para probarlo. `window.msgpack` sigue expuesto para
> cuando haga falta binario de verdad (archivos, chunks), que es un diseño aparte.

`leer()` intenta `JSON.parse` y, si no es JSON, **devuelve el texto tal cual** en vez de
reventar: así el place entiende también a un peer que hable texto plano.

**Streams entrantes.** `StreamHandle ƒ` se registra desde `on start ƒ` — al abrir la app ya
se escucha. Cada stream se lee hasta el final y se apila en `Streams #` como
`{id, peer, data}`, **dejándolo abierto** para contestarlo con `Reply !`. Detalles que
importan:

- Los objetos llevan un `toString()` propio: sin él, `create list ƒ` interpola y la lista
  dibujaría `[object Object]`. Con él se ve `s2 ← 3ftfsSDa: {...}` y el objeto conserva sus
  campos.
- `Streams #` está en los `skipKeys` de `guardar ! ƒ`: guarda ids de streams vivos, que al
  recargar ya no existen.
- Varios peers a la vez **no se estorban**: libp2p corre cada stream entrante en su propia
  goroutine (`swarm_conn.go`, `go func(){ … h(s) }()`). Un stream sin contestar solo hace
  esperar a *ese* peer.
- Go recoge los streams inactivos a los **15 min** (`p2pStreamIdle`), que es el margen para
  que una persona lea y conteste a mano.

> **Compilar**: p2plite pide Go **1.25.7** (`quic-go v0.60` aún no soporta 1.26). El
> `go 1.25.7` del `go.mod` no basta si tienes 1.26 instalado: `GOTOOLCHAIN=go1.25.7 wails build`.

## Integración de IA (añadida 2026-07)

Asistente **a demanda dentro del editor**, no chat ni autocompletado estilo Copilot
(los átomos son pequeños → micro-objetivos enfocados; el editor es un modal transitorio).

- **Go (`app.go`)**: `AIChat(messagesJSON)` (compatible con OpenAI, `baseURL` configurable),
  `GetAIConfig()` (key enmascarada), `SetAIConfig(json)`. La config
  (`{provider, model, baseURL, apiKey}`) se guarda en
  `UserConfigDir/diarsaba/ai_config.json` — **fuera del repo** (la key nunca se serializa y
  Go evita CORS).
- **Frontend (`index.html`)**: botón `✨` + `Ctrl+I` en la cabecera de Monaco → barra de
  instrucción → manda *código actual + instrucción* → reemplaza selección o contenido.
  System prompt sobreescribible con el átomo `ai system §`.
- **Config desde la UI**: `window.openAIConfig()` (editor JSON con la config); también hay
  un chip `ai config !` en el place `diarsaba @` (click derecho → `· ! action`).
  Si falta la key, `✨` abre la config automáticamente.
- Solo formato OpenAI por ahora; falta variante Anthropic (endpoint/headers distintos).

## Archivos clave

- `frontend/index.html` — bootstrap, `createFunction`, `threads`, `CodeEditor`, bindings.
- `frontend/predefined_functions.json` — **el programa entero** (átomos + places + estilos).
- `app.go` — backend Go: `Load/SavePredefinedFunctions`, `AIChat`, `Get/SetAIConfig`.
- `p2p.go` — puente hacia p2plite (bindings `P2P*`, handles de stream, evento `p2p:stream`).
- `p2p_smoke_test.go` — integración real contra la red (`go test -short` la salta).
- `frontend/wailsjs/go/main/App.{js,d.ts}` — bindings generados por Wails.
- `frontend/public/vs/` y `frontend/public/fa/` — Monaco y Font Awesome **vendorizados**
  (sin CDN). Vite los copia a `dist/` y Go los embebe, así que el editor y los íconos
  funcionan sin internet. `MONACO_BASE_URL = window.location.origin`.

## Carga y guardado del programa (dev vs prod)

El frontend **no** hace `fetch` del JSON: se lo pide al backend con
`window.LoadPredefinedFunctions()` (con fallback a `fetch` si se abre el frontend sin backend
Go). Go resuelve la ubicación en `predefinedPath()`:
- **Dev** (`wails dev`): `frontend/predefined_functions.json` — el archivo del repo, versionado
  en git y editado en vivo.
- **Prod** (`wails build`): `UserConfigDir/diarsaba/predefined_functions.json` (escribible, ya
  que los assets embebidos son de solo lectura), sembrado desde el JSON **embebido** en el
  binario (`//go:embed frontend/predefined_functions.json`).

`SavePredefinedFunctions` escribe en esa misma ruta (respaldando el anterior en
`<dir>/backups`), así que editar-y-guardar **persiste tanto en dev como en el build de
producción**.

### El binario manda en prod

En producción la copia externa se **reemplaza** con la embebida cuando difieren. Antes solo
se sembraba si no existía, y eso hacía que una instalación vieja nunca viera los cambios:
un `.exe` nuevo arrancaba con el JSON antiguo y los arreglos no llegaban nunca (el síntoma
concreto fue un `on start ƒ` viejo que no registraba el handler de streams).

Hoy el JSON es un **recurso de desarrollo que viaja con el binario**, así que lo que trae el
`.exe` es la verdad. Dos salvaguardas:

- Se **respalda antes de pisar** (`backupPredefined`), así lo que hubiera es recuperable.
- Se **compara antes de escribir**: sobrescribir en cada arranque gastaría los tres slots de
  backup en tres aperturas, tirando justo el respaldo con lo que hubieras editado en prod.

En **dev no se pisa nunca**: ahí el archivo del repo es el que editas en vivo.

> ⚠️ Consecuencia: **lo que edites y guardes en producción se pierde al abrir un `.exe`
> nuevo** (queda en `backups/`). Es aceptable mientras el programa del usuario y el del
> binario sean el mismo. Cuando dejen de serlo, esto tiene que volverse un merge que
> distinga lo heredado de lo editado — ver `LoadPredefinedFunctions` en `app.go`.
