/* ── ÁTOMOS · estilo ─────────────────────────────────────────────────────────
   EL ESTILO ES DEL PROGRAMA, no del HTML. Cada átomo "{" es CSS, y el shell lo
   sincroniza a un <style> — el mismo mecanismo que "install style manager" de la
   app real, donde vive "todo el estilo {".

   Y como es un átomo, se abre desde el menú, se edita en el editor con resaltado
   de CSS ("lenguajes :" dice que "{" es css) y el cambio SE VE al guardar: el
   shell escucha los diarsaba.set de los "{". Un programa que se repinta a sí
   mismo sin recargar.

   Están partidos por SUJETO —el lienzo, el menú, el modal, el editor— y no en un
   solo "todo el estilo {": así se abre el que te importa y se lee de un tirón.
   ────────────────────────────────────────────────────────────────────────── */

export default {
    // Las variables y el reset. Es el único que no es de una cosa concreta: es el
    // aire que respiran los demás, y por eso se llama base y no "todo".
    //
    // OJO al arrancar: hasta que el cargador siembra los átomos no hay estilo, así
    // que hay un parpadeo. Es el precio de que el estilo sea del programa y no del
    // HTML — el mismo que paga la app real con "todo el estilo {".
    "estilo base {": `
:root {
    --graph-bg: #000000;
    --graph-bg-strong: rgba(0, 0, 0, 0.92);
    --graph-border: rgba(255, 255, 255, 0.14);
    --graph-border-active: rgba(255, 255, 255, 0.24);
    --graph-text: #ffffff;
    --graph-text-muted: rgba(255, 255, 255, 0.62);
    --graph-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
    --graph-font: ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    background: var(--graph-bg);
    min-height: 100vh;
    overflow: hidden;
    font-family: var(--graph-font);
    color: var(--graph-text);
}
`,

    // El lienzo de un place y las tres formas que se pintan en él. Cambiar aquí el
    // ancla de un círculo o el tamaño del escenario recoloca la escena entera sin
    // tocar un solo átomo de la escena.
    "estilo del lienzo {": `
/* ── EL LIENZO DE UN PLACE ("@") ──────────────────────────────────────
     Un place es un LIENZO entero: viajar a él lo borra y lo vuelve a pintar.
     Es un escenario de 200×200 unidades que se escala a la ventana, así que
     las coordenadas de la escena son % del place y los tamaños son px de ese
     escenario: la misma escena se ve igual en cualquier pantalla.
     z-index: 0 hace del lienzo un contexto de apilado propio, y por eso un
     "z" negativo (el suelo) queda detrás de lo demás pero delante del fondo,
     y nunca por encima de un menú. */
#lienzo {
    position: fixed;
    left: 50%;
    top: 50%;
    width: 200px;
    height: 200px;
    z-index: 0;
    transform: translate(-50%, -50%) scale(var(--escala, 3));
    pointer-events: none;
}

/* Un círculo: se ancla por su CENTRO, para que (x, y) sea el punto que
     dice la escena y no su esquina. */
.escena-circulo {
    position: absolute;
    border-radius: 50%;
    transform: translate(-50%, -50%);
}

/* Un trazo: su propio <svg> del tamaño del lienzo, en coordenadas 0..100
     (las mismas que la escena). "non-scaling-stroke" mantiene el grosor en px
     aunque el viewBox se estire, así una línea no engorda al escalar. */
.escena-trazo {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
}

/* Un texto de la escena. Se ancla por su izquierda y su medio vertical, así
     (x, y) es donde empieza la línea. */
.escena-texto {
    position: absolute;
    transform: translateY(-50%);
    white-space: nowrap;
    line-height: 1;
}

/* El nombre del place al que se ha viajado. */
#place-nombre {
    position: fixed;
    left: 12px;
    bottom: 10px;
    font-size: .7rem;
    color: rgba(255, 255, 255, .38);
    user-select: none;
    pointer-events: none;
}
`,

    // El menú, que es también la lista: son EL MISMO widget. Aquí se ve que el
    // árbol anidado no tiene estilo propio — un submenú es un menú.
    "estilo del menú {": `
/* El menú y la lista son EL MISMO widget: .context-menu con .menu-item.
     Lo que cambia es la SEMÁNTICA del despacho, no el dibujo. */
.context-menu {
    position: absolute;
    background: var(--graph-bg-strong);
    border-radius: 14px;
    box-shadow: var(--graph-shadow);
    border: 1px solid var(--graph-border);
    z-index: 1000;
    min-width: 140px;
    max-height: min(360px, 60vh);
    overflow-y: auto;
    overflow-x: hidden;
    user-select: none;
    backdrop-filter: blur(14px);
}

.context-menu::-webkit-scrollbar {
    width: 6px;
}

.context-menu::-webkit-scrollbar-track {
    background: transparent;
}

.context-menu::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, .14);
    border-radius: 999px;
}

.menu-item {
    padding: 6px 12px;
    font-size: .75rem;
    color: var(--graph-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;
    border-bottom: 1px solid rgba(255, 255, 255, .08);
}

/* El nombre del átomo que el menú muestra. No es un ítem: no se pulsa, no
     cuenta para los índices. Con varios menús abiertos, es lo que distingue
     uno de otro. */
.menu-titulo {
    display: block;
    padding: 5px 12px;
    font-size: .68rem;
    color: rgba(255, 255, 255, .38);
    border-bottom: 1px solid rgba(255, 255, 255, .16);
    user-select: none;
}

.menu-item:last-child {
    border-bottom: none;
}

.menu-item:hover {
    background: rgba(255, 255, 255, .08);
}

.menu-item:active {
    background: rgba(255, 255, 255, .12);
}
`,

    // El modal de una línea: lo que pide un nombre o un valor.
    "estilo del modal {": `
/* El MODAL que pide un nombre (copiado igual de "todo el estilo {"). */
.modal-content {
    position: absolute;
    left: 50%;
    top: 50%;
    padding: 1rem;
    border: 1px solid var(--graph-border);
    border-radius: 18px;
    background: rgba(0, 0, 0, 0.88);
    box-shadow: var(--graph-shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    transform: translate(-50%, -50%);
    z-index: 2000;
}

.modal-content button {
    font-size: 0.75rem;
    color: var(--graph-text);
    font-weight: 500;
    cursor: pointer;
    padding: 4px 12px;
    border-radius: 10px;
    transition: all 0.15s ease;
    width: fit-content;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--graph-border);
    outline: none;
    user-select: none;
}

.modal-content button:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--graph-border-active);
}

.modal-content button:active {
    background: rgba(255, 255, 255, 0.18);
    transform: scale(0.98);
}

.modal-content button[data-modal="continue"] {
    background: rgba(255, 255, 255, 0.2);
    color: var(--graph-text);
    border: 1px solid rgba(255, 255, 255, 0.38);
}

.modal-content button[data-modal="continue"]:hover {
    background: rgba(255, 255, 255, 0.3);
}

.modal-content input {
    border: 1px solid rgba(255, 255, 255, 0.1);
    outline: none;
    padding: 4px 8px;
    border-radius: 8px;
    color: var(--graph-text);
    font-family: inherit;
    font-size: 1rem;
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
}

.modal-content span {
    font-family: inherit;
    color: var(--graph-text-muted);
    font-weight: 100;
    font-size: smaller;
    font-style: italic;
}

.modal-buttons {
    display: flex;
    gap: 8px;
    justify-content: space-around;
    margin-top: 12px;
}
`,

    // El editor entero: overlay, cabecera, selector de lenguaje, botones y el
    // prompt del asistente. Es el más largo porque es la pieza más grande que el
    // shell dibuja, y ahora se puede reescribir desde su propio menú.
    "estilo del editor {": `
/* El EDITOR (Monaco vive en el shell) — también copiado del estilo real. */
.editor-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.22);
    justify-content: center;
    align-items: center;
    z-index: 3000;
    backdrop-filter: blur(1px) saturate(0.6%);
    -webkit-backdrop-filter: blur(1px) saturate(0.6%);
    display: flex;
}

.editor-modal {
    /* relative: el prompt del asistente se ancla dentro del editor. */
    position: relative;
    width: 90%;
    max-width: 900px;
    height: 80%;
    max-height: 700px;
    border-radius: 18px;
    background: rgba(0, 0, 0, 0.34);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.32);
    border: 1px solid var(--graph-border);
    backdrop-filter: blur(1px) saturate(0.6%);
    -webkit-backdrop-filter: blur(1px) saturate(0.6%);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.06);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding: 12px 16px;
    flex-shrink: 0;
}

.editor-title {
    color: var(--graph-text);
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
}

.editor-header .modal-buttons {
    margin-top: 0;
}

/* ── EL SELECTOR DE LENGUAJE y los botones del editor ───────────────────────
   Copiado de «todo el estilo {» del proyecto principal, con las mismas clases:
   así un estilo se puede mover de un lado al otro sin traducir nada.
   Los iconos son Font Awesome; si no está, los <i> quedan vacíos y el nombre
   del lenguaje sigue visible — se elige igual. */
.editor-controls {
    display: flex;
    gap: 10px;
}

.language-selector {
    position: relative;
    display: inline-block;
}

.language-button {
    background: none;
    border-radius: 10px;
    border: none;
    color: var(--graph-text);
    padding: 6px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-family: inherit;
    transition: all 0.3s ease;
}

.language-button:hover {
    background: rgba(255, 255, 255, 0.15);
}

.language-dropdown {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    background: var(--graph-bg-strong);
    border: 1px solid var(--graph-border-active);
    border-radius: 4px;
    min-width: 150px;
    z-index: 1000;
    margin-top: 5px;
    box-shadow: var(--graph-shadow);
}

.language-dropdown.show {
    display: block;
}

.dropdown-item {
    width: 100%;
    padding: 10px 15px;
    background: none;
    border: none;
    color: var(--graph-text);
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: inherit;
    transition: background 0.2s ease;
}

.dropdown-item:hover {
    background: rgba(255, 255, 255, 0.1);
}

.dropdown-item i {
    width: 20px;
    text-align: center;
}

.close-button,
.save-button,
.ai-button {
    border: 1px solid var(--graph-border);
    border-radius: 6px;
    color: var(--graph-text);
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: inherit;
}

.save-button {
    background: rgba(255, 255, 255, 0.14);
}

.save-button:hover {
    background: rgba(255, 255, 255, 0.24);
    border-color: var(--graph-border-active);
}

.close-button {
    background: transparent;
}

.close-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--graph-border-active);
}

.ai-button {
    background: rgba(255, 255, 255, 0.08);
}

.ai-button:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: var(--graph-border-active);
}

.ai-button:disabled {
    opacity: 0.6;
    cursor: default;
}

/* El prompt del asistente, anclado abajo dentro del editor. */
.ai-prompt {
    position: absolute;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    align-items: center;
    width: min(560px, 82%);
    padding: 8px;
    border-radius: 12px;
    background: var(--graph-bg-strong);
    border: 1px solid var(--graph-border);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    z-index: 10;
}

.ai-prompt-input {
    flex: 1;
    border: 1px solid rgba(255, 255, 255, 0.1);
    outline: none;
    padding: 8px 10px;
    border-radius: 8px;
    color: var(--graph-text);
    background: rgba(255, 255, 255, 0.06);
    font-family: inherit;
    font-size: 0.95rem;
}

.ai-prompt-input:focus {
    border-color: rgba(255, 255, 255, 0.55);
}

.ai-prompt-send {
    border: 1px solid rgba(255, 255, 255, 0.38);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.2);
    color: var(--graph-text);
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.2s ease;
    font-family: inherit;
}

.ai-prompt-send:hover {
    background: rgba(255, 255, 255, 0.3);
}

.monaco-container {
    flex: 1;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
}

.monaco-container .monaco-editor,
.monaco-container .monaco-editor-background,
.monaco-container .margin,
.monaco-container .monaco-scrollable-element {
    background: transparent !important;
}

/* Respaldo si Monaco no está disponible (el demo abierto suelto). */
.monaco-container textarea {
    width: 100%;
    height: 100%;
    resize: none;
    border: none;
    outline: none;
    background: transparent;
    color: var(--graph-text);
    font-family: var(--graph-font);
    font-size: .8rem;
    padding: 12px 16px;
    line-height: 1.5;
    tab-size: 4;
}
`,
};
