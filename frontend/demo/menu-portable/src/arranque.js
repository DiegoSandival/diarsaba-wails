/* ═══════════════════════════════════════════════════════════════════════════
   EL ARRANQUE — la shell mínima, y nada más.

   No decide, no dibuja, no cablea gestos: eso es todo del universo, del átomo
   «arrancar ƒ». Aquí sólo se PRESTA el entorno que el universo no puede fabricar:
     1. el motor    (kernel: Map, createFunction, threads — ya global)
     2. las librerías externas (Monaco; mañana three, sodium) vía crearHost
     3. los átomos sembrados en el Map
   y se le cede el control con «arrancar ƒ». Cambiar de anfitrión (Tauri) es
   cambiar ESTE archivo; ni un átomo se entera.
   ═══════════════════════════════════════════════════════════════════════════ */

import { diarsaba } from "./kernel.js";
import { crearHost } from "./shell/host.js";
import { cargar } from "./cargador.js";

// 1+2. El entorno: el motor ya vive en el kernel; crearHost sólo deja a mano las
// librerías externas (Monaco) para que el universo las consuma directo. No es un
// intermediario: no dibuja ni decide nada. En Tauri: crearHost({ vs: "/vs/" }).
crearHost();

// 3. El universo, sembrado. De dónde vienen los átomos es cosa del anfitrión:
// hoy los .json de al lado; cuando el CRDT exista, será él.
const sembrados = await cargar();
diarsaba.get("log ƒ")(sembrados + " átomos sembrados");

// Y se le cede el control: el universo instala sus estilos, crea su lienzo,
// cablea los gestos y viaja al primer place. Todo eso vive en el átomo, no aquí.
diarsaba.get("arrancar ƒ")();
