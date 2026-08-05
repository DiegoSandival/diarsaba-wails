/* ═══════════════════════════════════════════════════════════════════════════
   LA SHELL MÍNIMA — sólo presta librerías externas. No es un intermediario.

   El universo dibuja, mide y escucha por su cuenta (document.… a mano, en
   átomos). Lo único que no puede fabricar es una librería externa: Monaco hoy,
   three/sodium mañana. Esta shell las CARGA y las deja como globales
   (window.monaco…) para que el universo las consuma directo — sin un host.editor
   de por medio. Cargar la librería es "prestar la capacidad"; usarla es del
   universo.

   Lo único que vive aquí es el EDITOR (Monaco) y el broker de la IA que sólo el
   editor usa: Monaco es una librería externa —la clase de cosa que esta shell
   mínima presta a propósito—, y el universo la consume. El lienzo, los menús,
   los estilos, el aislamiento y el arranque ya se fueron enteros a átomos; el
   universo dibuja, mide, escucha y se arranca solo. Esto es el préstamo, no un
   intermediario que decida.
   ═══════════════════════════════════════════════════════════════════════════ */

import { editor } from "./editor.js";
import { brokerNulo } from "./broker.js";

export function crearHost({ broker = brokerNulo, vs = null, iconos = null } = {}) {
    const host = {
        ...editor,
        broker,
        // Dónde están Monaco y los iconos. Si se pasan, se usan; si no, el editor
        // prueba las rutas de siempre y, si no hay, cae a un textarea.
        _vs: vs,
        _iconos: iconos,
    };

    // Global a propósito: los átomos son TEXTO compilado con new Function, así que
    // su ámbito es el global. Un átomo que dice host.editor(...) sólo lo ve aquí.
    window.host = host;
    return host;
}
