/* ═══════════════════════════════════════════════════════════════════════════
   ÁTOMOS → JSON — la fuente se edita como código; el JSON se genera.

       node herramientas/atomos-a-json.mjs            escribe los .json
       node herramientas/atomos-a-json.mjs --revisar  sólo comprueba (no escribe)

   POR QUÉ. Un átomo "ƒ" es código, y en JSON vive como una cadena de una línea
   con todo escapado: sin resaltado, sin comprobar sintaxis, y sin comentarios,
   que es donde está la mitad de lo que explica este programa. Editar ahí es
   editar a ciegas — un "\n" mal escapado se convierte en un salto de línea real
   y rompe el átomo sin que nada avise.

   Así que la fuente son src/atomos/*.mjs: código de verdad, con sus comentarios,
   que el editor colorea y que node puede compilar. De ahí sale el JSON que lee
   el cargador, que es el formato de EJECUCIÓN — el mismo que la app real guarda
   en predefined_functions.json y en su bbolt. La estructura atómica no cambia:
   cambia sólo dónde se escribe.

   LO QUE SE PIERDE AL GENERAR: los comentarios de entre átomos. Van en el .mjs y
   no en el .json (que no admite comentarios). Los de DENTRO de una "ƒ" viajan en
   su propia fuente y no se pierden nunca — por eso conviene escribir ahí lo que
   explica el átomo, y no encima.

   LO QUE COMPRUEBA antes de escribir:
     · que cada "ƒ" compile (es lo que habría cazado el "\n" roto)
     · que ningún átomo esté dos veces (en el mismo archivo o entre grupos)
     · que el sigilo final sea uno de los conocidos
     · que el .json coincida con su fuente (si no, lo editaste a mano: se dice)
   ═══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const GRUPOS = ["nucleo", "estilo", "escena", "pruebas"];
const SIGILOS = ["~", "ƒ", "!", "$", "§", "#", "֎", "<", "{", ":", "@"];
const soloRevisar = process.argv.includes("--revisar");

const problemas = [];
const vistos = new Map();      // nombre → grupo donde ya salió
const salidas = [];

for (const grupo of GRUPOS) {
    const fuente = join(raiz, "src/atomos", grupo + ".mjs");
    const json = join(raiz, "src/atomos", grupo + ".json");

    // Importar el .mjs ya comprueba que el ARCHIVO es JS válido; lo que no
    // comprueba es que cada "ƒ" de dentro compile — eso se hace abajo.
    // Un archivo que no parsea se cuenta como un problema más y se dice en una
    // línea: el volcado de node con su pila no ayuda a nadie aquí.
    let atomos;
    try {
        atomos = (await import(pathToFileURL(fuente).href + "?" + Date.now())).default;
    } catch (e) {
        console.error(`NO se escribió nada:\n  ${grupo}.mjs no parsea: ${e.message}`);
        process.exit(1);
    }
    if (!atomos || typeof atomos !== "object") {
        console.error(`NO se escribió nada:\n  ${grupo}.mjs no exporta un objeto por defecto`);
        process.exit(1);
    }

    // Un átomo escrito DOS VECES en el mismo archivo no se puede ver desde el
    // objeto ya cargado: JS se queda con el último y tira el otro sin decir
    // nada (y JSON.parse hace lo mismo). Así que se cuenta sobre el TEXTO. Es el
    // fallo más caro de todos — un átomo desaparece y el programa sigue
    // arrancando— y el único que no deja rastro.
    const texto = readFileSync(fuente, "utf8");
    const cuenta = new Map();
    for (const m of texto.matchAll(/^ {4}"((?:[^"\\]|\\.)*)":/gm))
        cuenta.set(m[1], (cuenta.get(m[1]) || 0) + 1);
    for (const [nombre, veces] of cuenta)
        if (veces > 1) problemas.push(`${grupo} · «${nombre}» está escrito ${veces} veces en el mismo archivo`);

    for (const [nombre, valor] of Object.entries(atomos)) {
        const sigilo = nombre.slice(-1);
        // "list option [] #" acaba en "#": el sigilo es siempre el ÚLTIMO carácter.
        if (!SIGILOS.includes(sigilo)) problemas.push(`${grupo} · «${nombre}»: sigilo desconocido «${sigilo}»`);
        if (vistos.has(nombre)) problemas.push(`«${nombre}» está en ${vistos.get(nombre)} y en ${grupo}`);
        vistos.set(nombre, grupo);

        if (sigilo === "ƒ") {
            if (typeof valor !== "string") problemas.push(`${grupo} · «${nombre}»: una ƒ se guarda como TEXTO fuente`);
            else {
                try { new Function("return (" + valor + ")")(); }
                catch (e) { problemas.push(`${grupo} · «${nombre}» no compila: ${e.message}`); }
            }
        }
    }

    // (Aquí había un aviso por fechas —"el .json es más nuevo que su fuente"—
    //  que saltaba SIEMPRE: después de generar, el .json es lo último escrito.
    //  Lo que de verdad delata una edición a mano es que el CONTENIDO no
    //  coincida, y eso ya se dice abajo con "≠". Un aviso que salta siempre no
    //  avisa de nada.)

    salidas.push([json, JSON.stringify(atomos, null, 2) + "\n", grupo, Object.keys(atomos).length]);
}

if (problemas.length) {
    console.error("NO se escribió nada:\n  " + problemas.join("\n  "));
    process.exit(1);
}

let cambiados = 0;
for (const [json, texto, grupo, n] of salidas) {
    const antes = existsSync(json) ? readFileSync(json, "utf8") : null;
    const igual = antes === texto;
    if (!igual) cambiados++;
    if (!soloRevisar && !igual) writeFileSync(json, texto);
    console.log(`${igual ? "=" : soloRevisar ? "≠" : "→"} ${grupo}.json · ${n} átomos${igual ? " (sin cambios)" : ""}`);
}

console.log(`${vistos.size} átomos en total · todas las ƒ compilan`);
if (soloRevisar && cambiados) {
    console.error(`\n${cambiados} .json no coinciden con su fuente: corre el generador sin --revisar`);
    process.exit(1);
}
