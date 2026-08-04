/* ── EL SHELL · WIDGETS ─────────────────────────────────────────────────────
   Menús, listas, modal y el registro de lo que está abierto (scene), más
   host.hit(): el clic del DOM clasificado en DATOS. Es el canal "widgets" y el
   canal "eventos" del protocolo. Nada de aquí decide: dibuja y clasifica.
   ────────────────────────────────────────────────────────────────────────── */

import { diarsaba } from "../kernel.js";

export const widgets = {
    // Posición del puntero: los widgets sin ancla se abren ahí.
    _px: 20, _py: 20,

    // Reposiciona para que el widget no se salga de la ventana. Mide en (0,0):
    // si se coloca desbordando, el ancho shrink-to-fit se comprime y la medida
    // saldría mal.
    _clamp(el) {
        const margin = 8, vw = innerWidth, vh = innerHeight;
        const dl = parseFloat(el.style.left) || 0, dt = parseFloat(el.style.top) || 0;
        el.style.left = "0px"; el.style.top = "0px";
        const w = el.offsetWidth, h = el.offsetHeight;
        let left = dl, top = dt;
        if (left + w > vw - margin) left = vw - margin - w;
        if (top + h > vh - margin) top = vh - margin - h;
        if (left < margin) left = margin;
        if (top < margin) top = margin;
        el.style.left = `${left}px`; el.style.top = `${top}px`;
    },

    /* ── EL CONTRATO DEL MARCADO ───────────────────────────────────────────
       El shell ya no construye el menú: lo recibe hecho, del átomo «menu <».
       Pero para convertir un clic en un dato tiene que reconocer dos cosas en
       ese marcado, y sólo dos:

           .menu-item[data-idx="N"]   un ítem, y qué índice tiene
           .menu-titulo               el título (pulsarlo va DEL MENÚ)

       Eso es todo lo que sabe de la forma de un menú. Cambia el marcado como
       quieras —otras etiquetas, más adornos, otro orden— y seguirá funcionando
       mientras esos dos ganchos existan. No es una forma: es dónde mirar. */

    // Entrega por DEFECTO del ítem elegido. El átomo ya no pasa una función por
    // el borde (un postMessage no puede llevarla): pasa null y el shell entrega
    // el payload. Hoy llama directo; con el worker será un postMessage.
    _deliverPick(payload) {
        const despachar = diarsaba.get("despachar menú ƒ");
        if (typeof despachar === "function") despachar(payload);
    },

    // Cablea el CLIC de un menú/lista. Al pulsar un ítem arma DATOS semánticos
    // —no el DOM— para que el universo despache sin tocar la vista.
    // stopPropagation corta el manejador global (si no, cerraría el menú antes
    // de despacharlo).
    _wirePick(div, onPick) {
        div.addEventListener("pointerup", (e) => {
            if (e.button !== 0) return;            // el clic derecho abre menú, no elige
            const item = e.target.closest && e.target.closest(".menu-item");
            if (!item || !div.contains(item)) return;
            e.stopPropagation();
            const r = item.getBoundingClientRect();
            const payload = {
                label: item.textContent,
                index: Number(item.dataset.idx),
                parent: div.dataset.parent || "",
                current: div.dataset.current || "",
                // Id del menú DONDE se pulsó, y el del menú del que ÉSE cuelga.
                // Con ellos el universo puede colgar un submenú, mandar cerrar o
                // repintar —el suyo o el de arriba— sin ver ningún elemento.
                menu: div.dataset.menu || "",
                desde: div.dataset.desde || "",
                // La caja del ítem: con ella se ancla el submenú a su derecha,
                // sin que el universo necesite ver el elemento.
                rect: {
                    left: r.left, top: r.top, right: r.right, bottom: r.bottom,
                    width: r.width, height: r.height
                },
            };
            if (onPick) onPick(payload);
            else window.host._deliverPick(payload);
        });
    },

    // Pinta los ítems dentro de un menú ya creado. El manejador de clic está
    // DELEGADO en el contenedor, así que reemplazar los ítems no lo rompe: por
    // eso repintar puede conservar el mismo menú (su id, su sitio, sus hijos).
    // Encabeza con el NOMBRE de lo que el menú muestra: con varios abiertos, es
    // lo que dice cuál es cuál — y es donde se pulsa para las acciones del menú.
    // No es un ítem, así que no altera los índices.
    // Un menú de opciones va de UN elemento (dataset.current), no de la lista.
    // Los menús ABIERTOS que están mostrando esa lista, por su id. El universo
    // pregunta "¿quién enseña «logs #»?" y recibe ids, no elementos — con eso
    // decide a quién repintar. Antes esto era redrawAll(), que además PINTABA;
    // ahora pintar es del universo y aquí sólo queda la pregunta.
    //
    // Sólo los que la MUESTRAN: un menú de opciones cuelga de una lista pero
    // enseña otra cosa, y no debe repintarse con sus datos.
    menusDe(nombre) {
        const ids = [];
        for (const [id, w] of this.scene._menu)
            if (w.el && w.el.dataset.parent === nombre && !w.el.dataset.current) ids.push(id);
        return ids;
    },

    // Cambia el contenido de un menú abierto, conservándolo: mismo id, mismo
    // sitio, mismos hijos. Es lo que hace que editar un elemento se VEA sin
    // cerrar nada. El manejador de clic está delegado en el contenedor, así que
    // reemplazar el marcado de dentro no lo rompe.
    repintar(id, html) {
        const w = this.scene._menu.get(id);
        if (!w || !w.el) return false;
        w.el.innerHTML = String(html);
        this._clamp(w.el);
        return true;
    },

    // Qué lista está mostrando un menú abierto. El universo pregunta por id y
    // recibe un nombre: no ve el elemento, y no necesita que se lo arrastren
    // por el dataset.
    listaDe(id) {
        const w = this.scene._menu.get(id);
        return (w && w.el && w.el.dataset.parent) || "";
    },

    // La caja de un ítem de un menú abierto, por su ÍNDICE. Es el ancla que el
    // universo necesita para colgar un widget de un elemento que él no ve: dice
    // "el ítem 3 del menú m9" y el shell le devuelve dónde está.
    itemRect(id, index) {
        const w = this.scene._menu.get(id);
        const item = w && w.el && w.el.querySelectorAll(".menu-item")[index];
        if (!item) return null;
        const r = item.getBoundingClientRect();
        return {
            left: r.left, top: r.top, right: r.right, bottom: r.bottom,
            width: r.width, height: r.height
        };
    },

    // Pide un nombre. Resuelve el texto (Continue) o null (Cancel).
    // Es el mismo modal de la app: el shell lo dibuja y devuelve una PROMESA,
    // así el átomo solo espera un valor — con el worker, ese await ya está.
    async modal(pre = "") {
        return new Promise((resolve) => {
            const div = document.createElement("div");
            div.className = "modal-content";
            const input = document.createElement("input");
            input.type = "text"; input.value = pre || ""; input.spellcheck = false;
            const bc = document.createElement("div");
            bc.className = "modal-buttons";
            ["Cancel", "Continue"].forEach((text) => {
                const btn = document.createElement("button");
                btn.textContent = text;
                btn.dataset.modal = text.toLowerCase();
                btn.onclick = () => { div.remove(); resolve(text === "Cancel" ? null : input.value.trim()); };
                bc.append(btn);
            });
            div.append(input, bc);
            document.body.append(div);
            input.focus();
        });
    },

    // Avisos del shell (en la app real, lo mismo).
    notify(msg) { return alert(msg); },

    // MENÚ. Recibe el HTML ya hecho —del átomo «menu <»— y se encarga de lo que
    // no es forma: darle un id, ponerlo en su sitio sin que se salga de la
    // ventana, cablear el clic y colgarlo del árbol.
    //
    // "desde": id del menú DONDE SE PULSÓ; "" = es una RAÍZ (nace del fondo).
    // El átomo nunca recibe el elemento, sólo el id de vuelta.
    //
    // Los datos (parent/current) se guardan en el dataset porque son lo que el
    // shell devuelve en el payload de un clic: no los usa para dibujar —ya no
    // dibuja—, los custodia.
    menu(html, parent = "", current = "", x = null, y = null, onPick = null, desde = "") {
        const div = document.createElement("div");
        div.className = "context-menu";
        div.style.left = `${x === null ? this._px : x}px`;
        div.style.top = `${y === null ? this._py : y}px`;
        div.dataset.parent = parent;
        div.dataset.current = current;
        div.dataset.menu = window.host.scene.nuevoId();
        div.dataset.desde = desde;
        div.innerHTML = String(html);
        // La marca "submenu" distingue lo que cuelga de otro menú de lo que
        // nació del fondo.
        if (desde) div.classList.add("submenu");
        document.body.appendChild(div);
        this._clamp(div);
        this._wirePick(div, onPick);
        window.host.scene.open(div.dataset.menu, div, desde);
        return div.dataset.menu;
    },

    // Cierra UN menú (y lo que colgara de él). Es lo que pide "cerrar ƒ".
    closeMenu(id) { this.scene.close(id); },

    // Cierra TODOS los menús. Ya no hay clic de fondo que los barra —cada menú
    // se cierra con su propia acción—, así que esto es el Esc y el cambio de
    // place.
    //
    // (Aquí había una asimetría heredada: las LISTAS iban en otro registro y
    //  sobrevivían al Esc. Ya no hay listas —todo es el árbol de menús—, así que
    //  la excepción se fue con ellas. `alsoModals` barre además los modales, y
    //  es lo que usa el cambio de place.)
    clearMenus(alsoModals) {
        this.scene.closeAll();
        if (alsoModals)
            document.querySelectorAll(".context-menu, .modal-content").forEach((el) => el.remove());
    },

    // Clasifica un evento de puntero en un payload SEMÁNTICO. El shell mira el
    // DOM UNA vez y entrega datos: los átomos no tocan event.target.
    hit(e) {
        const t = e && e.target;
        const p = {
            button: e.button ?? 0, clientX: e.clientX, clientY: e.clientY,
            kind: "other"
        };
        // El modal y el editor son su propia clase de sitio: teclear o pulsar
        // dentro no es ni fondo ni menú, así que no abre ni cierra nada.
        if (t && t.closest && t.closest(".modal-content, .editor-overlay")) { p.kind = "modal"; return p; }
        const menu = t && t.closest && t.closest(".context-menu");
        if (menu) {
            p.kind = "menu";
            p.menu = menu.dataset.menu || "";
            p.parent = menu.dataset.parent || "";     // la lista que muestra
            // Si el clic cayó sobre un ítem, va también CUÁL: es lo que necesita
            // el universo para abrir las opciones de ese elemento.
            const item = t.closest(".menu-item");
            if (item) { p.name = item.textContent; p.index = Number(item.dataset.idx); }
            // El TÍTULO no es un elemento de la lista: pulsarlo va del MENÚ.
            else if (t.closest(".menu-titulo")) p.titulo = true;
            return p;
        }
        if (!t || t.nodeName === "HTML" || t.nodeName === "BODY") p.kind = "background";
        return p;
    },

    // Registro de los widgets abiertos.
    scene: {
        // Los menús forman un ÁRBOL: cada uno guarda de qué menú cuelga
        // ("" = raíz, nacida de un clic derecho en el fondo). El id lo pone el
        // shell, así dos aperturas de la misma lista son dos menús distintos.
        _menu: new Map(),      // id → { el, desde }
        _seq: 0,
        nuevoId() { return "m" + (++this._seq); },

        // Un menú tiene como mucho UN hijo abierto: elegir otro ítem cierra lo
        // que había abierto el anterior, en vez de dibujarse encima. Las RAÍCES
        // no se estorban entre sí — por eso cada clic derecho suma un menú.
        open(id, el, desde = "") {
            if (desde) this.closeChildren(desde);
            this._menu.set(id, { el, desde });
        },

        // Cerrar un menú se lleva por delante todo lo que colgaba de él.
        close(id) {
            const w = this._menu.get(id);
            if (!w) return;
            this.closeChildren(id);
            if (w.el?.remove) w.el.remove();
            this._menu.delete(id);
        },
        closeChildren(id) {
            for (const [k, w] of [...this._menu]) if (w.desde === id) this.close(k);
        },
        closeAll() { for (const k of [...this._menu.keys()]) this.close(k); },
    },

    // (solo del DEMO) bitácora: cada línea se anota en el átomo "logs #", que
    // se abre desde el menú principal como cualquier otra lista. No hay vista
    // aparte: la propia bitácora es un átomo del programa.
    log(html) {
        const bitacora = diarsaba.get("logs #");
        if (!Array.isArray(bitacora)) return;
        bitacora.unshift(html.replace(/<[^>]+>/g, ""));   // sin marcas: es texto
        while (bitacora.length > 40) bitacora.pop();
    },
};
