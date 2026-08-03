/* ── EL SHELL · EL EDITOR ───────────────────────────────────────────────────
   Monaco vive aquí, en el shell, igual que en la app: el universo sólo dice
   "edítame este texto" y recibe el resultado. Si Monaco no aparece se edita en
   un textarea y el programa sigue — el editor es una comodidad del shell, no
   una dependencia del universo.
   ────────────────────────────────────────────────────────────────────────── */

export const editor = {
    /* ── EL EDITOR ─────────────────────────────────────────────────────────
       Monaco vive en el SHELL, igual que en la app: el universo solo dice
       "edítame este texto" y recibe el resultado. Se carga de la copia del
       repo (frontend/public/vs), sin CDN.                                    */

    _monaco: null,

    _cargarScript(src) {
        return new Promise((resolve) => {
            const s = document.createElement("script");
            s.src = src;
            s.onload = () => resolve(true);
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });
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
                window.require(["vs/editor/editor.main"], () => {
                    // El tema del proyecto, para que el editor no desentone.
                    window.monaco.editor.defineTheme("glass-dark", {
                        base: "vs-dark", inherit: true, rules: [],
                        colors: {
                            "editor.background": "#0b0b0b42",
                            "editorGutter.background": "#0b0b0b24",
                            "editorLineNumber.foreground": "#94a3b8",
                            "editorCursor.foreground": "#f8fafc",
                            "editor.selectionBackground": "#ffffff18",
                            "editor.lineHighlightBackground": "#ffffff08",
                            "focusBorder": "#00000000",
                            "scrollbarSlider.background": "#ffffff14",
                        },
                    });
                    resolve(window.monaco);
                }, reject);
            });
        })();
        return this._monaco;
    },

    // Abre el editor. Resuelve el texto (Guardar) o null (Cancel) — la misma
    // firma que host.editor en la app, para que el átomo sea el mismo.
    async editor(nombre, src = "", lang = "javascript") {
        const monaco = await this._cargarMonaco().catch((e) => {
            console.warn("[demo] Monaco no disponible:", e.message);
            return null;                       // se edita en un textarea y ya
        });
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "editor-overlay";
            overlay.innerHTML =
                `<div class="editor-modal">
             <div class="editor-header">
                 <span class="editor-title">${this._render(nombre)}</span>
                 <div class="modal-buttons"></div>
             </div>
             <div class="monaco-container"></div>
         </div>`;
            const cont = overlay.querySelector(".monaco-container");
            const bc = overlay.querySelector(".modal-buttons");
            document.body.append(overlay);
            // Cerrar DESTRUYE el editor: quitar el overlay no basta, Monaco
            // guarda cada instancia (y su modelo) en un registro propio, y las
            // que quedaran vivas seguirían apareciendo en monaco.editor.getEditors().
            let ed = null;
            const cerrar = (v) => { if (ed) ed.dispose(); overlay.remove(); resolve(v); };

            let leer;
            if (monaco) {
                const idioma = { js: "javascript", text: "plaintext" }[lang] || lang;
                ed = monaco.editor.create(cont, {
                    value: src, language: idioma, theme: "glass-dark",
                    automaticLayout: true, minimap: { enabled: false },
                    scrollBeyondLastLine: false, tabSize: 4, fontSize: 13,
                    fontFamily: getComputedStyle(document.body).fontFamily,
                });
                ed.addCommand(monaco.KeyCode.Escape, () => cerrar(null));
                ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => cerrar(ed.getValue()));
                leer = () => ed.getValue();
                ed.focus();
            } else {
                const ta = document.createElement("textarea");
                ta.value = src; ta.spellcheck = false;
                cont.append(ta);
                leer = () => ta.value;
                ta.focus();
            }
            // El Esc del editor no debe llegar al de la ventana (que barre menús).
            overlay.addEventListener("keydown", (e) => {
                if (e.key !== "Escape") return;
                e.stopPropagation();
                cerrar(null);
            });
            ["Cancel", "Guardar"].forEach((text) => {
                const btn = document.createElement("button");
                btn.textContent = text;
                btn.dataset.modal = text === "Guardar" ? "continue" : "cancel";
                btn.onclick = () => cerrar(text === "Cancel" ? null : leer());
                bc.append(btn);
            });
        });
    },
};
