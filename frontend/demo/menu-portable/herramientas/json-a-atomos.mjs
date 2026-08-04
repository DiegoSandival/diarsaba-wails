/* ═══════════════════════════════════════════════════════════════════════════
   JSON → ÁTOMOS — la vuelta: rehace la fuente .mjs a partir del .json.

       node herramientas/json-a-atomos.mjs
       node herramientas/json-a-atomos.mjs --desde ../menu/index.html

   PARA QUÉ. El programa se edita también EN VIVO: abres un átomo en el editor,
   lo cambias, y la verdad pasa a estar en el Map. Si exportas eso (broker.exportar)
   tienes un JSON más nuevo que tu fuente. Esto lo devuelve a .mjs editable.

   LOS COMENTARIOS. Un JSON no los lleva, así que se RECUPERAN del .mjs que ya
   existe (o del archivo que digas con --desde): para cada átomo se buscan las
   líneas de comentario que tenía justo encima y se vuelven a poner. Un átomo
   nuevo llega sin comentario, y uno que desapareció se lleva el suyo. Nada se
   inventa: si no hay de dónde sacarlo, no hay comentario.

   Cuidado: lo que sí se pierde de verdad es un comentario cuyo átomo cambió de
   nombre — se busca por nombre, no hay otra pista.
   ═══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const GRUPOS = ["nucleo", "estilo", "escena", "pruebas"];
const i = process.argv.indexOf("--desde");
const refExtra = i >= 0 ? process.argv[i + 1] : null;

// Las líneas de comentario que un átomo tiene ENCIMA, en un texto cualquiera.
// No se parsea el archivo: se busca la línea que abre el átomo y se sube
// mientras haya comentarios o blancos. Es suficiente y no se equivoca con los
// corchetes de una expresión regular, que es donde un parser se rompería.
function comentariosDe(texto, nombre) {
    if (!texto) return null;
    const lineas = texto.split("\n");
    const clave = '"' + nombre + '":';
    const idx = lineas.findIndex((l) => l.trimStart().startsWith(clave));
    if (idx < 0) return null;

    const bloque = [];
    // Se sube línea a línea. Un comentario de BLOQUE se traga entero: sus líneas
    // de dentro no parecen comentarios ("quitar un elemento, y el árbol…"), y
    // quedarse con la cola dejaba texto suelto que no compila.
    let enBloque = false;
    for (let j = idx - 1; j >= 0; j--) {
        const t = lineas[j].trim();
        if (enBloque) {
            bloque.unshift(lineas[j]);
            if (t.includes("/*")) enBloque = false;      // aquí abría: bloque completo
            continue;
        }
        if (t.endsWith("*/") && !t.includes("/*")) { bloque.unshift(lineas[j]); enBloque = true; continue; }
        const esComentario = t.startsWith("//") || t.startsWith("/*");
        if (t === "" || esComentario) bloque.unshift(t === "" ? "" : lineas[j]);
        else break;
    }
    // Un bloque sin cerrar (se acabó el archivo subiendo) no se usa: mejor sin
    // comentario que con medio comentario.
    if (enBloque) return null;
    while (bloque.length && bloque[0] === "") bloque.shift();
    while (bloque.length && bloque[bloque.length - 1] === "") bloque.pop();
    if (!bloque.length) return null;

    // Se reindenta a 4 espacios, respetando la sangría RELATIVA (los banners
    // /* ── … ── */ y la continuación de un comentario de varias líneas).
    const sangrias = bloque.filter((l) => l !== "").map((l) => l.length - l.trimStart().length);
    const min = Math.min(...sangrias);
    return bloque.map((l) => (l === "" ? "" : " ".repeat(4 + (l.length - l.trimStart().length - min)) + l.trim()));
}

// Un valor, como se escribe en la fuente.
function comoFuente(nombre, valor) {
    // Una "ƒ" es CÓDIGO: va en un template literal, con sus saltos de línea de
    // verdad. Hay que escapar la barra invertida (o `\[` de una regex se
    // convertiría en `[` al compilar), el acento invertido y el `${`.
    if (nombre.endsWith("ƒ") && typeof valor === "string") {
        const esc = valor
            .replace(/\\/g, "\\\\")
            .replace(/`/g, "\\`")
            .replace(/\$\{/g, "\\${");
        return "`" + esc + "`";
    }
    const plano = JSON.stringify(valor);
    if (plano.length <= 86) return plano;
    // Lo largo se abre en varias líneas, indentado dentro del objeto.
    return JSON.stringify(valor, null, 4).split("\n").map((l, n) => (n === 0 ? l : "    " + l)).join("\n");
}

const refs = [];
if (refExtra) {
    const p = join(raiz, refExtra);
    if (!existsSync(p)) { console.error("no existe " + refExtra); process.exit(1); }
    refs.push(readFileSync(p, "utf8"));
}

for (const grupo of GRUPOS) {
    const fjs = join(raiz, "src/atomos", grupo + ".mjs");
    const atomos = JSON.parse(readFileSync(join(raiz, "src/atomos", grupo + ".json"), "utf8"));
    // El .mjs que ya existe manda sobre --desde: es el que tiene los comentarios
    // buenos, los que se han ido escribiendo aquí.
    const fuentes = [existsSync(fjs) ? readFileSync(fjs, "utf8") : null, ...refs].filter(Boolean);

    let conComentario = 0;
    const cuerpo = Object.entries(atomos).map(([nombre, valor]) => {
        let com = null;
        for (const f of fuentes) { com = comentariosDe(f, nombre); if (com) break; }
        if (com) conComentario++;
        return (com ? com.join("\n") + "\n" : "") + `    ${JSON.stringify(nombre)}: ${comoFuente(nombre, valor)},`;
    }).join("\n\n");

    const cabecera = `/* ── ÁTOMOS · ${grupo} ─────────────────────────────────────────────────────────
   LA FUENTE. Se edita aquí, como código: el editor lo colorea, node lo compila
   y los comentarios caben. El ${grupo}.json de al lado se GENERA de esto con
   herramientas/atomos-a-json.mjs, y es el que lee el cargador.
   ────────────────────────────────────────────────────────────────────────── */

export default {
`;
    writeFileSync(fjs, cabecera + cuerpo + "\n};\n");
    console.log(`→ ${grupo}.mjs · ${Object.keys(atomos).length} átomos · ${conComentario} con comentario`);
}
