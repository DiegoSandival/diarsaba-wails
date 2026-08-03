/* ── EL SHELL · EL LIENZO DE UN PLACE ───────────────────────────────────────
   Tres verbos de dibujo y nada más: círculo, trazo, texto. El shell no sabe
   qué es un árbol; recibe un color CSS ya resuelto, coordenadas en % y un z.
   Aquí es DOM+SVG; en otro shell serían Three.js o un canvas, con los mismos
   tres verbos — es el canal "escena" del protocolo.
   ────────────────────────────────────────────────────────────────────────── */

export const lienzo = {
    /* ── EL LIENZO ─────────────────────────────────────────────────────────
       Tres verbos y nada más: borrar el lienzo, poner un círculo, poner un
       trazo. El shell no sabe qué es un árbol ni qué es el sol: recibe un
       color CSS ya resuelto, unas coordenadas en % y un z, y dibuja. Quién
       decide que "amarillo" es #ffd21e, o que el follaje son veinte círculos
       esparcidos, es el universo.                                            */

    _lienzo() { return document.getElementById("lienzo"); },

    // El escenario mide 200×200 y se escala a la ventana: así una escena
    // escrita en % y px se ve igual en cualquier pantalla.
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

    // Un círculo, anclado por su centro en (x%, y%) del lienzo.
    circulo(color, tamano, x, y, z) {
        const el = this._lienzo();
        if (!el) return;
        const d = document.createElement("div");
        d.className = "escena-circulo";
        d.style.left = `${x}%`;
        d.style.top = `${y}%`;
        d.style.width = tamano;
        d.style.height = tamano;
        d.style.background = color;
        d.style.zIndex = String(z);
        el.appendChild(d);
    },

    // Una línea continua que une los puntos [[x,y], ...], en las mismas
    // coordenadas 0..100 de la escena.
    trazo(color, grosor, z, puntos) {
        const el = this._lienzo();
        if (!el || !Array.isArray(puntos) || puntos.length < 2) return;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "escena-trazo");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("preserveAspectRatio", "none");
        svg.style.zIndex = String(z);
        const linea = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        linea.setAttribute("points", puntos.map((p) => p[0] + "," + p[1]).join(" "));
        linea.setAttribute("fill", "none");
        linea.setAttribute("stroke", color);
        linea.setAttribute("stroke-width", grosor);
        linea.setAttribute("stroke-linecap", "round");
        linea.setAttribute("stroke-linejoin", "round");
        // El grosor no se estira con el viewBox: se queda en px del escenario.
        linea.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(linea);
        el.appendChild(svg);
    },

    // Una línea de texto en el lienzo. El shell escapa lo que le llegue: un
    // texto que viene de fuera (del sandbox, por ejemplo) es un dato, no HTML.
    texto(color, tamano, x, y, z, contenido) {
        const el = this._lienzo();
        if (!el) return;
        const d = document.createElement("div");
        d.className = "escena-texto";
        d.style.left = `${x}%`;
        d.style.top = `${y}%`;
        d.style.fontSize = tamano;
        d.style.color = color;
        d.style.zIndex = String(z);
        d.textContent = String(contenido);
        el.appendChild(d);
    },
};
