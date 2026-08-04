/* ═══════════════════════════════════════════════════════════════════════════
   EL SHELL — el borde entero, en un objeto.

   El universo le habla por verbos y nunca ve un elemento del DOM. Se ensambla
   de piezas: widgets (menús/listas/modal/eventos), lienzo (los tres verbos de
   dibujo), editor (Monaco), aislamiento (el worker) y broker (lo de fuera).

   Cambiar de anfitrión es cambiar piezas, no átomos. Un shell de Tauri con
   Three.js en vez de divs sería este mismo archivo con otro lienzo.js.
   ═══════════════════════════════════════════════════════════════════════════ */

import { widgets } from "./widgets.js";
import { lienzo } from "./lienzo.js";
import { editor } from "./editor.js";
import { estilos } from "./estilos.js";
import { aislamiento } from "./aislamiento.js";
import { brokerNulo } from "./broker.js";

export function crearHost({ broker = brokerNulo, vs = null, iconos = null } = {}) {
    const host = {
        ...widgets,
        ...lienzo,
        ...editor,
        ...estilos,
        ...aislamiento,
        broker,
        // Dónde está Monaco, y dónde los iconos del selector de lenguaje. Si se
        // pasan, se usan esas rutas y no se adivina nada; si no, el editor
        // prueba las de siempre. Y si no encuentra ninguna, edita en un textarea
        // con los iconos vacíos: el editor nunca es motivo de que nada falle.
        _vs: vs,
        _iconos: iconos,
    };

    // Global a propósito: los átomos son TEXTO compilado con new Function, así
    // que su ámbito es el global. Un átomo que dice host.menu(...) sólo puede
    // verlo aquí. Es el mismo trato que el kernel.
    window.host = host;
    return host;
}
