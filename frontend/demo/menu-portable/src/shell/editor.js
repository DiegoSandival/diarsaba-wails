/* ── EL SHELL · EL EDITOR ───────────────────────────────────────────────────
   El editor del proyecto principal, traído tal cual: Monaco con selector de
   lenguaje (HTML/JS/CSS/Python/Go/JSON/Texto), guardar, cerrar y el asistente.
   Mismo marcado y mismas clases CSS que la app, para que un átomo o un estilo
   se puedan mover de un lado al otro sin traducir nada.

   Tres cosas cambian, y todas en la misma dirección: que no dependa de nadie.
     · Monaco y Font Awesome son CONFIGURACIÓN (crearHost({ vs, iconos })), no
       rutas adivinadas. Si no están, el editor sigue abriendo.
     · Sin Monaco se edita en un <textarea>, con la misma cabecera y el mismo
       selector. Se pierde el resaltado, no el editor.
     · El asistente llama a host.broker.ai(), no a una binding de Go. Sin
       anfitrión lo dice y no pasa nada más.

   El universo sólo ve host.editor(nombre, src, lang) → texto | null, y
   host.diff(titulo, a, b, lang) → bool. Igual que en CONTENEDOR.md.
   ────────────────────────────────────────────────────────────────────────── */

// Los lenguajes que ofrece el selector. Sin 'color': los iconos heredan
// currentColor (blanco). El lenguaje ya se distingue por su glifo y por el
// nombre de al lado.
export const LENGUAJES = [
    { id: "html", name: "HTML", icon: "fab fa-html5" },
    { id: "javascript", name: "JavaScript", icon: "fab fa-js-square" },
    { id: "css", name: "CSS", icon: "fab fa-css3-alt" },
    { id: "python", name: "Python", icon: "fab fa-python" },
    { id: "go", name: "Go", icon: "fab fa-golang" },
    // JSON es el lenguaje de los átomos ":" — los que guardan una estructura.
    { id: "json", name: "JSON", icon: "fas fa-file-code" },
    { id: "plaintext", name: "Texto", icon: "fas fa-file-alt" },
];

// Los nombres cortos con que los átomos piden un lenguaje ("js", "text") y los
// largos que entiende Monaco. Es la misma tabla de la app.
export const ALIAS = {
    html: "html", js: "javascript", javascript: "javascript", css: "css",
    py: "python", python: "python", go: "go", json: "json",
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
    _crearOverlay(titulo, lenguaje, conAsistente) {
        const overlay = document.createElement("div");
        overlay.className = "editor-overlay";
        const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        overlay.innerHTML = `
        <div class="editor-modal">
            <div class="editor-header">
                <div class="editor-title">
                    <div class="language-selector">
                        <button class="language-button" type="button" title="Seleccionar lenguaje">
                            <i class="${lenguaje.icon}"></i>
                            <span class="language-name">${lenguaje.name}</span>
                        </button>
                        <div class="language-dropdown">
                            ${LENGUAJES.map((l) => `
                                <button class="dropdown-item" data-lang="${l.id}">
                                    <i class="${l.icon}"></i>
                                    <span>${l.name}</span>
                                </button>
                            `).join("")}
                        </div>
                    </div>
                    <span class="modal-title">${esc(titulo)}</span>
                </div>
                <div class="editor-controls">
                    ${conAsistente ? `<button class="ai-button" title="Asistente IA (Ctrl+I)">
                        <i class="fas fa-wand-magic-sparkles"></i>
                    </button>` : ""}
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
            ai: overlay.querySelector(".ai-button"),
        };
    },

    /* ── el asistente ─────────────────────────────────────────────────────── */

    // Quita los ``` con que un modelo suele envolver el código.
    _sinCercas(texto) {
        const t = String(texto).trim();
        const m = t.match(/^```[a-zA-Z0-9]*\s*\n([\s\S]*?)\n```$/);
        return m ? m[1] : t;
    },

    // Pide la instrucción dentro del propio editor, anclada abajo.
    _pedirInstruccion(ancla) {
        return new Promise((resolve) => {
            const wrap = document.createElement("div");
            wrap.className = "ai-prompt";
            wrap.innerHTML = `
                <input type="text" class="ai-prompt-input" placeholder="¿Qué quieres que haga la IA con este átomo?" spellcheck="false" />
                <button class="ai-prompt-send" type="button" title="Enviar (Enter)"><i class="fas fa-arrow-up"></i></button>`;
            ancla.appendChild(wrap);
            const input = wrap.querySelector(".ai-prompt-input");
            const send = wrap.querySelector(".ai-prompt-send");
            const fin = (v) => { wrap.remove(); resolve(v); };
            input.addEventListener("keydown", (e) => {
                e.stopPropagation();
                if (e.key === "Enter") fin(input.value.trim() || null);
                else if (e.key === "Escape") fin(null);
            });
            send.addEventListener("click", () => fin(input.value.trim() || null));
            input.focus();
        });
    },

    // El asistente pasa por el BROKER: aquí no hay ninguna binding de Go. El
    // "system" opcional viene del átomo "ai system §" — es un dato del
    // programa, editable desde su propio menú.
    async _asistir(leer, escribir, partes, lang) {
        if (this._aiOcupado) return;
        const instruccion = await this._pedirInstruccion(partes.modal);
        if (!instruccion) return;

        this._aiOcupado = true;
        const icono = partes.ai.querySelector("i");
        const antes = icono.className;
        icono.className = "fas fa-spinner fa-spin";
        partes.ai.disabled = true;
        try {
            const sistema = typeof window.diarsaba?.get("ai system §") === "string"
                ? window.diarsaba.get("ai system §") : "";
            const r = await window.host.broker.ai(leer(), lang, instruccion, sistema);
            // El broker nulo contesta { ok:false, motivo }. Un anfitrión de
            // verdad devuelve el texto. Se distinguen así, sin preguntar quién es.
            if (r && r.ok === false) window.host.log("· el asistente necesita anfitrión (" + r.motivo + ")");
            else escribir(this._sinCercas(typeof r === "string" ? r : (r?.valor ?? "")));
        } catch (e) {
            window.host.notify("Error de IA: " + (e?.message || e));
        } finally {
            icono.className = antes;
            partes.ai.disabled = false;
            this._aiOcupado = false;
        }
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
