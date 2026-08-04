/* ═══════════════════════════════════════════════════════════════════════════
   EMPAQUETAR — el paquete entero en un archivo que abre a doble clic.

       node herramientas/empaquetar.mjs

   Escribe "un-archivo.html": el mismo programa, sin módulos y sin fetch, así
   que funciona desde file:// en cualquier navegador. Es una SALIDA, no la
   fuente: se regenera cuando cambias algo en src/.

   Por qué hace falta: un <script type="module"> desde file:// está bloqueado
   por CORS (origen "null"), y el fetch de los JSON también. Servido —o dentro
   de Tauri— no hay problema y se usa index.html, que es la versión de verdad.

   Las transformaciones son tres y se ven aquí enteras:
     · se quitan las líneas "import ..." (todo queda en un solo ámbito)
     · "export const X = " → "const X = "
     · los JSON se incrustan como un objeto, y el arranque siembra de ahí en
       vez de pedirlos por fetch
   El CSS no se toca: ya no hay hoja de estilo, son átomos "{".
   ═══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (...p) => readFileSync(join(raiz, ...p), "utf8");

// Un módulo, listo para vivir en un <script> plano.
const plano = (ruta) => leer(ruta)
    .replace(/^import[^;]*;\s*$/gm, "")           // las dependencias ya están en el ámbito
    .replace(/^export (const|function) /gm, "$1 ")
    .replace(/^export \{[^}]*\};?\s*$/gm, "")
    .trimEnd();

// El orden importa: el kernel primero (define diarsaba), luego las piezas del
// shell, y el ensamblaje al final.
const piezas = [
    "src/kernel.js",
    "src/shell/widgets.js",
    "src/shell/lienzo.js",
    "src/shell/editor.js",
    "src/shell/estilos.js",
    "src/shell/aislamiento.js",
    "src/shell/broker.js",
    "src/shell/host.js",
];

// La regla de sembrado se COPIA de cargador.js (entre las marcas ⟨sembrar⟩)
// para que no existan dos versiones de "una ƒ se compila, el resto entra tal
// cual". Si las marcas desaparecen, esto falla en vez de inventarse la regla.
const cargador = leer("src/cargador.js");
// El \r? no es adorno: en Windows basta con que un editor —o un script— deje el
// archivo en CRLF para que una marca que exija \n a secas deje de encontrarse,
// sin que nada más haya cambiado. Pasó.
const marcas = cargador.match(/\/\/ ⟨sembrar⟩\r?\n([\s\S]*?)\/\/ ⟨\/sembrar⟩/);
if (!marcas) throw new Error("no encontré las marcas ⟨sembrar⟩ en src/cargador.js");
const sembrar = marcas[1].replace(/^export /m, "").trimEnd();

const GRUPOS = ["nucleo", "estilo", "escena", "pruebas"];
const atomos = Object.assign({}, ...GRUPOS.map((g) => JSON.parse(leer("src/atomos", g + ".json"))));

// El arranque, con el fetch sustituido por los átomos ya incrustados.
const arranque = plano("src/arranque.js")
    .replace(/const sembrados = await cargar\(\);/,
        "const sembrados = sembrar(ATOMOS);   // incrustados por empaquetar.mjs");

const html = `<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <title>DIARSABA — el paquete portable (un archivo)</title>
    <!-- GENERADO por herramientas/empaquetar.mjs — no se edita a mano.
         La fuente es index.html + src/. Esto es la versión de un archivo, para
         abrir a doble clic (sin módulos y sin fetch, funciona desde file://). -->
    <!-- Sin <style>: el estilo son átomos "{" y los pone el propio programa
         (install style manager ƒ → host.installStyles). -->
</head>

<body>

    <div id="lienzo"></div>
    <span id="place-nombre"></span>

    <script>
        /* ── EL UNIVERSO, incrustado ─────────────────────────────────────────
           Los mismos ${Object.keys(atomos).length} átomos de src/atomos/*.json. Aquí van dentro del
           HTML porque un fetch desde file:// está bloqueado; en la versión
           servida son datos en disco, como en la app real. */
        const ATOMOS = ${JSON.stringify(atomos, null, 4)};
    </script>

    <script>
${piezas.map((p) => plano(p)).join("\n\n")}

${sembrar}

${arranque}
    </script>
</body>

</html>
`;

writeFileSync(join(raiz, "un-archivo.html"), html);
console.log(`un-archivo.html · ${Object.keys(atomos).length} átomos · ${(html.length / 1024).toFixed(0)} KB`);
