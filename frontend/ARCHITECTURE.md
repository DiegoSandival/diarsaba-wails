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

## Capa WebSocket / p2p (backend Go)

Protocolo binario hacia un backend Go: `ws opcodes :` (mapa de opcodes),
`encode frame ƒ` / `decode frame ƒ`, y funciones como `create db ƒ`, `write ƒ`, `read ƒ`,
`relay ƒ`, `dial ƒ`, `sub/pub ƒ`, firma de llaves, etc. (libp2p + una capa de DB por celdas).

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
  que los assets embebidos son de solo lectura), sembrado en el primer arranque desde el JSON
  **embebido** en el binario (`//go:embed frontend/predefined_functions.json`).

`SavePredefinedFunctions` escribe en esa misma ruta (y versiona el anterior como
`predefined_functions_vN.json`), así que editar-y-guardar **persiste tanto en dev como en el
build de producción**.
