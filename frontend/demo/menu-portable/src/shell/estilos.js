/* ── EL SHELL · LOS ESTILOS ─────────────────────────────────────────────────
   El estilo no es del HTML: es del PROGRAMA. Cada átomo que acaba en "{" es
   CSS, y aquí se le da un <style> propio. Esto es todo lo que el shell sabe de
   estilo — ni un selector, ni un color: sólo cómo llevar un texto al documento.

   Portado de "install style manager" / host.installStyles de la app real, con
   el mismo truco: se envuelve diarsaba.set para que GUARDAR un "{" repinte al
   instante. Por eso editar «estilo del menú {» desde su propio menú cambia el
   menú mientras lo miras, sin recargar nada.

   Y por eso el shell puede encogerse: lo que antes era un estilo.css invisible
   ahora son cinco átomos que el programa lee, abre y reescribe.
   ────────────────────────────────────────────────────────────────────────── */

import { diarsaba } from "../kernel.js";

// El id del <style> de un átomo. Del nombre («estilo del menú {») sale un id
// estable («diarsaba-estilo-estilo_del_men_»), así que volver a sembrar el mismo
// átomo reusa su etiqueta en vez de apilar otra.
const idDeAtomo = (clave) => {
    const base = String(clave).replace(/\s*\{$/, "").trim();
    return "diarsaba-style-" + base.replace(/[^\w-]/g, "_").replace(/^_+|_+$/g, "");
};

const aplicar = (clave, valor) => {
    const id = idDeAtomo(clave);
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement("style");
        el.id = id;
        document.head.appendChild(el);
    }
    el.textContent = typeof valor === "string" ? valor : "";
};

export const estilos = {
    // Sincroniza los "{" que ya hay y deja enganchado el repintado de los que
    // vengan. Lo llama el universo (por "install style manager ƒ"), no el HTML:
    // es el programa el que decide cuándo se pone su ropa.
    installStyles() {
        let n = 0;
        for (const [clave, valor] of diarsaba.entries())
            if (typeof clave === "string" && clave.endsWith("{")) { aplicar(clave, valor); n++; }

        // Una vez. Si se llamara dos veces se envolvería el envoltorio, y cada
        // set haría el trabajo dos veces.
        if (!this._enganchado) {
            const setOriginal = diarsaba.set.bind(diarsaba);
            diarsaba.set = (clave, valor) => {
                setOriginal(clave, valor);
                try {
                    if (typeof clave === "string" && clave.endsWith("{")) aplicar(clave, valor);
                } catch (e) {
                    console.error("[shell] estilo «" + clave + "»:", e);
                }
                return diarsaba;
            };
            this._enganchado = true;
        }
        return n;
    },
};
