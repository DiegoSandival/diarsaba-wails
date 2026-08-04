/* ═══════════════════════════════════════════════════════════════════════════
   EL ARRANQUE — el único archivo que sabe en qué anfitrión estamos.

   Monta el shell, siembra el universo, entrega los gestos y viaja a un place.
   Todo lo demás (kernel, shell, átomos) no sabe nada de esto: para llevar el
   paquete a otro anfitrión se cambia ESTE archivo y nada más.
   ═══════════════════════════════════════════════════════════════════════════ */

import { diarsaba } from "./kernel.js";
import { crearHost } from "./shell/host.js";
import { cargar } from "./cargador.js";

// ── 1. EL SHELL ────────────────────────────────────────────────────────────
// En Tauri: crearHost({ broker: brokerTauri, vs: "/vs/" }). Ni un átomo cambia.
const host = crearHost();

// ── 2. EL UNIVERSO ─────────────────────────────────────────────────────────
const sembrados = await cargar();

// ── 3. EL ESTILO ───────────────────────────────────────────────────────────
// Lo pone el PROGRAMA, no el HTML: los átomos "{" se vuelven <style>. Y queda
// enganchado, así que editar «estilo del menú {» desde su propio menú repinta.
const estilos = diarsaba.get("install style manager ƒ")();

// ── 4. LOS GESTOS ──────────────────────────────────────────────────────────
// Entran por aquí y se entregan al universo ya CLASIFICADOS por host.hit(). En
// la app real esto vive en "on start ƒ"; con el worker, la entrega será un
// postMessage y este bloque es justo el que se muda al shell.
addEventListener("contextmenu", (e) => e.preventDefault());
// Esc barre TODO (menús + listas): es lo que hace el cambio de place con
// host.clearMenus(true). De uno en uno, cada menú se cierra con su "cerrar ƒ".
addEventListener("keydown", (e) => { if (e.key === "Escape") host.clearMenus(true); });
addEventListener("pointerup", (e) => {
    diarsaba.set("pointer up event", host.hit(e));
    if (e.button === 0) diarsaba.get("handle click ƒ")();
    if (e.button === 2) diarsaba.get("show context menu ƒ")();
});
addEventListener("pointermove", (e) => { host._px = e.clientX; host._py = e.clientY; });
// El escenario se reajusta con la ventana: la escena no se recalcula, sólo se
// escala — es la misma, más grande.
addEventListener("resize", () => host._escalar());

// ── 5. EL PLACE ────────────────────────────────────────────────────────────
// Arrancar EN un place: el programa siempre está en algún sitio. Se viaja como
// se viajaría desde el menú, con el mismo átomo.
diarsaba.get("viajar a place ƒ")("escena @");

host.log(sembrados + " átomos · " + estilos + " estilos · broker «" + host.broker.nombre + "»");
host.log("listo — clic derecho en el fondo abre un menú; sobre un ítem, sus opciones");
