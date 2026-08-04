/* ── EL SHELL · EL LIENZO DE UN PLACE ───────────────────────────────────────
   Aquí ya no hay formas. El shell no sabe qué es un círculo, ni un trazo, ni un
   texto: recibe HTML —que el universo arma con sus átomos "<"— y lo mete en el
   lienzo. Dos verbos, y ninguno menciona un color, una clase ni un estilo.

   Lo único que se queda es lo que no puede ser un átomo: qué nodo del documento
   es el lienzo, y cuánto hay que escalarlo para que quepa en ESTA ventana. Eso
   no es forma, es la ventana — y la ventana es del anfitrión.
   ────────────────────────────────────────────────────────────────────────── */

export const lienzo = {

    _lienzo() { return document.getElementById("lienzo"); },

    // El escenario mide 200×200 y se escala a la ventana: así una escena escrita
    // en % y px se ve igual en cualquier pantalla. El 200 vive en el CSS —en
    // «estilo del lienzo {»—; aquí sólo se lee la ventana, que el universo no ve.
    _escalar() {
        const escala = Math.min(innerWidth, innerHeight) * 0.86 / 200;
        document.documentElement.style.setProperty("--escala", escala.toFixed(3));
    },

    // Vaciar el lienzo. Es lo primero que pasa al viajar a un place.
    limpiarLienzo(nombre = "") {
        const el = this._lienzo();
        if (el) el.innerHTML = "";
        this._escalar();
        document.getElementById("place-nombre").textContent = nombre;
    },

    // EL VERBO: añade HTML al lienzo. Lo que llega viene ya escapado por quien lo
    // armó —"plantilla ƒ" escapa cada valor salvo que se pida crudo—; el shell no
    // puede saber qué parte de un HTML es dato y qué parte es marcado, así que no
    // finge protegerlo. Insertar marcado es exactamente lo que dice el nombre.
    //
    // Un solo verbo para las tres formas de la escena y para las que añadas
    // mañana: dibujar algo nuevo es escribir un átomo "<", no tocar el shell.
    pintar(html) {
        const el = this._lienzo();
        if (!el) return false;
        el.insertAdjacentHTML("beforeend", String(html));
        return true;
    },
};
