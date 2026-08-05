/* ── EL SHELL · EL EDITOR ───────────────────────────────────────────────────
   Monaco con selector de lenguaje (HTML/JS/CSS/Python/Go/JSON/Markdown/Texto),
   guardar, cerrar y —para markdown— vista previa. Mismo marcado y clases CSS
   que el estilo del proyecto principal, así átomos y estilos son traducibles
   entre lados sin cambios.

   Configuración, no dependencias:
     · Monaco y Font Awesome (crearHost({ vs, iconos })): sin ellos el editor
       sigue abriendo — Monaco cae a un <textarea>, los iconos quedan vacíos.
     · Sin Monaco no hay resaltado, pero se puede editar y seleccionar lenguaje.

   El universo sólo ve host.editor(nombre, src, lang) → texto | null, y
   host.diff(titulo, a, b, lang) → bool.
   ────────────────────────────────────────────────────────────────────────── */

// Los lenguajes que ofrece el selector, con su color de marca. Cada icono va
// con el suyo: así los tipos se distinguen de un vistazo y el botón del selector
// pinta con el color del lenguaje activo.
export const LENGUAJES = [
    { id: "html",       name: "HTML",       icon: "fab fa-html5",       color: "#e34c26" },
    { id: "javascript", name: "JavaScript", icon: "fab fa-js-square",   color: "#f7df1e" },
    { id: "css",        name: "CSS",        icon: "fab fa-css3-alt",    color: "#264de4" },
    { id: "python",     name: "Python",     icon: "fab fa-python",      color: "#3776ab" },
    { id: "go",         name: "Go",         icon: "fab fa-golang",      color: "#00add8" },
    // JSON es el lenguaje de los átomos ":" — los que guardan una estructura.
    { id: "json",       name: "JSON",       icon: "fas fa-file-code",   color: "#8892bf" },
    // Markdown lleva su botón «ver MD» para renderizar el texto como HTML —
    // sólo aparece cuando el lenguaje activo es markdown.
    { id: "markdown",   name: "Markdown",   icon: "fab fa-markdown",    color: "#519aba" },
    { id: "plaintext",  name: "Texto",      icon: "fas fa-file-alt",    color: "#94a3b8" },
];

// Los nombres cortos con que los átomos piden un lenguaje ("js", "text", "md")
// y los largos que entiende Monaco. Es la misma tabla de la app.
export const ALIAS = {
    html: "html", js: "javascript", javascript: "javascript", css: "css",
    py: "python", python: "python", go: "go", json: "json",
    md: "markdown", markdown: "markdown",
    text: "plaintext", plaintext: "plaintext",
};

const TEMA = "glass-dark";
const TEMA_DEF = {
    base: "vs-dark", inherit: true, rules: [],
    colors: {
        "editor.background": "#0b0b0b42",
        "editorGutter.background": "#0b0b0b24",
        "editorLineNumber.foreground": "#94a3b8",
        "editorLineNumber.activeForeground": "#f8fafc",
        "editorCursor.foreground": "#f8fafc",
        "editor.selectionBackground": "#ffffff18",
        "editor.inactiveSelectionBackground": "#ffffff10",
        "editor.lineHighlightBackground": "#ffffff08",
        "editor.lineHighlightBorder": "#00000000",
        "editorIndentGuide.background1": "#ffffff12",
        "editorIndentGuide.activeBackground1": "#ffffff22",
        "focusBorder": "#00000000",
        "contrastBorder": "#00000000",
        "contrastActiveBorder": "#00000000",
        "editorWidget.border": "#ffffff12",
        "scrollbarSlider.background": "#ffffff14",
        "scrollbarSlider.hoverBackground": "#ffffff24",
        "scrollbarSlider.activeBackground": "#ffffff30",
    },
};

export const editor = {

    /* ── carga de lo de fuera: Monaco y los iconos ────────────────────────── */

    _monaco: null,
    _temaPuesto: false,
    _iconosPedidos: false,

    _cargarScript(src) {
        return new Promise((resolve) => {
            const s = document.createElement("script");
            s.src = src;
            s.onload = () => resolve(true);
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });
    },

    // Los iconos del selector. Si no aparecen, los <i> quedan vacíos y el
    // nombre del lenguaje sigue ahí: se puede elegir igual. Por eso no se
    // espera a que carguen ni se avisa dos veces.
    _cargarIconos() {
        if (this._iconosPedidos) return;
        this._iconosPedidos = true;
        const candidatos = [];
        if (this._iconos) candidatos.push(this._iconos);
        else candidatos.push("../../public/fa/css/all.min.css", "/fa/css/all.min.css");
        for (const href of candidatos) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = new URL(href, location.href).href;
            link.onerror = () => link.remove();
            document.head.appendChild(link);
        }
    },

    _cargarMonaco() {
        if (this._monaco) return this._monaco;
        this._monaco = (async () => {
            if (window.monaco) return window.monaco;
            // Dónde buscar Monaco. Si el anfitrión lo dijo al crear el host
            // (crearHost({ vs })), se usa eso y no se adivina — es lo que hará
            // Tauri, que sirve sus assets desde donde quiera. Si no, se prueban
            // las rutas de siempre: la raíz servida (donde lo pone Vite y donde
            // lo pide la app real) y public/vs del repo. Gana la primera que
            // conteste, y si no contesta ninguna se edita en un textarea.
            const bases = [];
            if (this._vs) bases.push(new URL(this._vs, location.href).href);
            if (location.protocol !== "file:") bases.push(new URL("/", location.href).href);
            bases.push(new URL("../../public/", location.href).href);
            let base = null;
            for (const b of bases) if (await this._cargarScript(b + "vs/loader.js")) { base = b; break; }
            if (!base) throw new Error("no se encontró vs/loader.js en: " + bases.join(" , "));

            const vs = base + "vs";
            window.require.config({ paths: { vs } });
            // El worker se pide por data: URL, igual que en la app. Si el
            // navegador lo bloquea, Monaco se cae solo al hilo principal y
            // sigue editando.
            window.MonacoEnvironment = {
                getWorkerUrl: () => "data:text/javascript;charset=utf-8," + encodeURIComponent(
                    `self.MonacoEnvironment={baseUrl:'${base}'};` +
                    `importScripts('${vs}/base/worker/workerMain.js');`),
            };
            return new Promise((resolve, reject) => {
                window.require(["vs/editor/editor.main"], () => resolve(window.monaco), reject);
            });
        })();
        return this._monaco;
    },

    /* ── lenguajes ────────────────────────────────────────────────────────── */

    // El lenguaje que pide un átomo, resuelto a una entrada del selector. Lo
    // que no se reconoce cae en JavaScript, como en la app.
    _lenguaje(lang) {
        const id = ALIAS[lang] || lang;
        return LENGUAJES.find((l) => l.id === id) || LENGUAJES.find((l) => l.id === "javascript");
    },
    _monacoLang(lang) { return ALIAS[lang] || lang; },

    /* ── el overlay ───────────────────────────────────────────────────────── */

    // El título es el NOMBRE del átomo. Un átomo llamado "<img onerror=...>"
    // (p. ej. de un programa compartido) inyectaría HTML aquí; se escapa. Lo
    // demás de la plantilla son constantes.
    //
    // Cada dropdown-item lleva su color inline: son de marca (HTML naranja, JS
    // amarillo, …), y así basta con leer una tabla — nada de CSS por lenguaje.
    // El botón principal del selector se pinta con el color del activo cuando se
    // crea, y se repinta al cambiar.
    _crearOverlay(titulo, lenguaje) {
        const overlay = document.createElement("div");
        overlay.className = "editor-overlay";
        const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        // El botón «ver MD» sólo tiene sentido para markdown. Se pinta siempre
        // (para que el layout no salte), pero se oculta con .hidden cuando el
        // lenguaje no lo es. Al cambiar de lenguaje se muestra/oculta.
        const oculto = lenguaje.id === "markdown" ? "" : " hidden";
        overlay.innerHTML = `
        <div class="editor-modal">
            <div class="editor-header">
                <div class="editor-title">
                    <div class="language-selector">
                        <button class="language-button" type="button" title="Seleccionar lenguaje">
                            <i class="${lenguaje.icon}" style="color:${lenguaje.color}"></i>
                            <span class="language-name">${lenguaje.name}</span>
                        </button>
                        <div class="language-dropdown">
                            ${LENGUAJES.map((l) => `
                                <button class="dropdown-item" data-lang="${l.id}">
                                    <i class="${l.icon}" style="color:${l.color}"></i>
                                    <span>${l.name}</span>
                                </button>
                            `).join("")}
                        </div>
                    </div>
                    <span class="modal-title">${esc(titulo)}</span>
                </div>
                <div class="editor-controls">
                    <button class="md-button${oculto}" title="Ver Markdown">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="save-button" title="Guardar (Ctrl+S)">
                        <i class="fas fa-save"></i>
                    </button>
                    <button class="close-button" title="Cerrar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="monaco-container" style="width:100%;height:100%;"></div>
        </div>`;
        return overlay;
    },

    _partes(overlay) {
        return {
            modal: overlay.querySelector(".editor-modal"),
            container: overlay.querySelector(".monaco-container"),
            selector: overlay.querySelector(".language-selector"),
            boton: overlay.querySelector(".language-button"),
            icono: overlay.querySelector(".language-button i"),
            nombre: overlay.querySelector(".language-name"),
            dropdown: overlay.querySelector(".language-dropdown"),
            items: overlay.querySelectorAll(".dropdown-item"),
            guardar: overlay.querySelector(".save-button"),
            cerrar: overlay.querySelector(".close-button"),
            md: overlay.querySelector(".md-button"),
        };
    },

    /* ── vista previa de Markdown ─────────────────────────────────────────── */

    // Un renderer básico: heading, párrafo, énfasis, código inline, bloque de
    // código con fences, listas (- y 1.), blockquote, enlace, imagen y hr. No es
    // CommonMark; es "suficiente para leer un README" — todo el contenido bruto
    // se escapa, así que meter <script> en el texto no lo ejecuta.
    _renderMd(md) {
        const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
        const inline = (s) => esc(s)
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            .replace(/`([^`]+)`/g, "<code>$1</code>");
        const L = String(md).split(/\r?\n/);
        let out = "", i = 0, m;
        while (i < L.length) {
            const l = L[i];
            if ((m = /^```(\w*)/.exec(l))) {                      // ``` code block
                const lang = m[1]; i++;
                let bloque = "";
                while (i < L.length && !/^```\s*$/.test(L[i])) { bloque += L[i] + "\n"; i++; }
                out += `<pre><code class="lang-${lang}">${esc(bloque.replace(/\n$/, ""))}</code></pre>`;
                if (i < L.length) i++;
                continue;
            }
            if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) {              // # heading
                out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`;
                i++; continue;
            }
            if (/^---+$/.test(l)) { out += "<hr>"; i++; continue; }
            if (/^>\s?/.test(l)) {                                // > blockquote
                let bloque = "";
                while (i < L.length && /^>\s?/.test(L[i])) { bloque += L[i].replace(/^>\s?/, "") + "\n"; i++; }
                out += `<blockquote>${inline(bloque.trim())}</blockquote>`;
                continue;
            }
            if (/^[-*]\s+/.test(l)) {                             // - lista
                out += "<ul>";
                while (i < L.length && /^[-*]\s+/.test(L[i])) {
                    out += `<li>${inline(L[i].replace(/^[-*]\s+/, ""))}</li>`; i++;
                }
                out += "</ul>"; continue;
            }
            if (/^\d+\.\s+/.test(l)) {                            // 1. lista
                out += "<ol>";
                while (i < L.length && /^\d+\.\s+/.test(L[i])) {
                    out += `<li>${inline(L[i].replace(/^\d+\.\s+/, ""))}</li>`; i++;
                }
                out += "</ol>"; continue;
            }
            if (l.trim() === "") { i++; continue; }
            // párrafo: líneas consecutivas hasta línea vacía o cambio de bloque
            let bloque = l; i++;
            while (i < L.length && L[i].trim() !== ""
                   && !/^(#{1,6}\s|>|```|[-*]\s|\d+\.\s|---+$)/.test(L[i])) {
                bloque += "\n" + L[i]; i++;
            }
            out += `<p>${inline(bloque).replace(/\n/g, "<br>")}</p>`;
        }
        return out;
    },

    /* ── EL VERBO ─────────────────────────────────────────────────────────── */

    // Abre el editor. Resuelve el texto (Guardar / Ctrl+S) o null (Cerrar /
    // Esc / clic fuera). Cancelar resuelve null y no "": vaciar a propósito y
    // cancelar no pueden ser lo mismo — un editor de lista leería "" como
    // "borra la lista".
    async editor(nombre, src = "", lang = "javascript") {
        this._cargarIconos();
        const monaco = await this._cargarMonaco().catch((e) => {
            console.warn("[shell] Monaco no disponible:", e.message);
            return null;                       // se edita en un textarea y ya
        });

        return new Promise((resolve) => {
            const inicial = this._lenguaje(lang);
            const overlay = this._crearOverlay(nombre, inicial, true);
            document.body.append(overlay);
            const partes = this._partes(overlay);
            let actual = inicial.id;

            const limpiezas = [];
            const escuchar = (donde, evento, fn) => {
                donde.addEventListener(evento, fn);
                limpiezas.push(() => donde.removeEventListener(evento, fn));
            };

            // Monaco o textarea: de aquí abajo, todo habla por leer/escribir.
            let ed = null, leer, escribir, enfocar;
            if (monaco) {
                if (!this._temaPuesto) { monaco.editor.defineTheme(TEMA, TEMA_DEF); this._temaPuesto = true; }
                ed = monaco.editor.create(partes.container, {
                    value: src, language: this._monacoLang(inicial.id), theme: TEMA,
                    automaticLayout: true, fontSize: 14,
                    fontFamily: getComputedStyle(document.body).fontFamily,
                    scrollBeyondLastLine: false, minimap: { enabled: false },
                    lineNumbers: "on", roundedSelection: false, tabSize: 4,
                });
                leer = () => ed.getValue();
                escribir = (t) => {
                    // Si hay selección, se sustituye sólo eso: es lo que hace la
                    // app, y permite pedirle a la IA un trozo y no el átomo entero.
                    const sel = ed.getSelection();
                    if (sel && !sel.isEmpty()) ed.executeEdits("ai", [{ range: sel, text: t, forceMoveMarkers: true }]);
                    else ed.setValue(t);
                };
                enfocar = () => ed.focus();
            } else {
                const ta = document.createElement("textarea");
                ta.value = src; ta.spellcheck = false;
                partes.container.append(ta);
                leer = () => ta.value;
                escribir = (t) => { ta.value = t; };
                enfocar = () => ta.focus();
            }

            const ocultarLista = () => partes.dropdown.classList.remove("show");
            const cerrar = (v) => {
                limpiezas.forEach((f) => f());
                if (ed) ed.dispose();          // Monaco guarda cada instancia en un
                overlay.remove();              // registro propio: hay que soltarla
                resolve(v);
            };

            // Cambiar de lenguaje: el botón y el resaltado. Sin Monaco sólo
            // cambia el botón — no hay resaltado que cambiar, pero la elección
            // sigue teniendo sentido para quien lo lee.
            const cambiar = (id) => {
                const nuevo = this._lenguaje(id);
                if (!nuevo || nuevo.id === actual) { ocultarLista(); return; }
                partes.icono.className = nuevo.icon;
                partes.nombre.textContent = nuevo.name;
                if (ed) monaco.editor.setModelLanguage(ed.getModel(), this._monacoLang(nuevo.id));
                actual = nuevo.id;
                ocultarLista();
            };

            escuchar(partes.guardar, "click", () => cerrar(leer()));
            escuchar(partes.cerrar, "click", () => cerrar(null));
            escuchar(partes.ai, "click", () => this._asistir(leer, escribir, partes, actual));
            escuchar(partes.boton, "click", (e) => { e.stopPropagation(); partes.dropdown.classList.toggle("show"); });
            partes.items.forEach((item) => escuchar(item, "click", (e) => {
                e.stopPropagation();
                cambiar(item.dataset.lang);
            }));
            escuchar(document, "click", (e) => { if (!partes.selector.contains(e.target)) ocultarLista(); });
            escuchar(overlay, "click", (e) => { if (e.target === overlay) cerrar(null); });

            // El Esc del editor no debe llegar al de la ventana (que barre los
            // menús): primero cierra la lista de lenguajes, luego el editor, y
            // en ningún caso sigue subiendo.
            escuchar(overlay, "keydown", (e) => {
                if (e.key !== "Escape") return;
                e.stopPropagation();
                if (partes.dropdown.classList.contains("show")) { ocultarLista(); return; }
                cerrar(null);
            });

            if (ed) {
                ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => cerrar(leer()));
                ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => this._asistir(leer, escribir, partes, actual));
                ed.addCommand(monaco.KeyCode.Escape, () => {
                    if (partes.dropdown.classList.contains("show")) { ocultarLista(); return; }
                    cerrar(null);
                });
            }
            enfocar();
        });
    },

    // Diff de sólo lectura: izquierda la versión elegida, derecha la actual.
    // Resuelve true si se pulsa restaurar, false al cerrar. Sin Monaco no se
    // finge con dos textareas: se dice que no se puede y se resuelve false.
    async diff(titulo, original = "", modificado = "", lang = "javascript") {
        const monaco = await this._cargarMonaco().catch(() => null);
        if (!monaco) {
            window.host.log("· el diff necesita Monaco; no está disponible");
            return false;
        }
        this._cargarIconos();
        return new Promise((resolve) => {
            const overlay = this._crearOverlay(titulo, this._lenguaje(lang), false);
            // Un diff no se edita: el botón de guardar pasa a ser "restaurar".
            const partes = this._partes(overlay);
            partes.guardar.title = "Restaurar esta versión";
            partes.selector.style.pointerEvents = "none";
            document.body.append(overlay);

            if (!this._temaPuesto) { monaco.editor.defineTheme(TEMA, TEMA_DEF); this._temaPuesto = true; }
            const l = this._monacoLang(lang);
            const izq = monaco.editor.createModel(original, l);
            const der = monaco.editor.createModel(modificado, l);
            const d = monaco.editor.createDiffEditor(partes.container, {
                theme: TEMA, automaticLayout: true, readOnly: true,
                renderSideBySide: true, minimap: { enabled: false }, fontSize: 13,
            });
            d.setModel({ original: izq, modified: der });

            const cerrar = (v) => {
                d.dispose(); izq.dispose(); der.dispose();
                overlay.remove(); resolve(v);
            };
            partes.guardar.addEventListener("click", () => cerrar(true));
            partes.cerrar.addEventListener("click", () => cerrar(false));
            overlay.addEventListener("keydown", (e) => {
                if (e.key !== "Escape") return;
                e.stopPropagation();
                cerrar(false);
            });
        });
    },
};
