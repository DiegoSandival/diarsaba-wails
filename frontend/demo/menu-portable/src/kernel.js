/* ═══════════════════════════════════════════════════════════════════════════
   EL KERNEL — el motor de threads.

   Es lo único que no es ni shell ni universo: el Map donde vive el programa,
   la compilación de átomos "ƒ" y el despacho por sigilo. No toca el DOM, no
   sabe de Tauri ni de nadie: es JS a secas, y por eso puede mudarse tal cual
   a un worker (el "universo.js" que pide T3 de CONTENEDOR.md).
   ═══════════════════════════════════════════════════════════════════════════ */

// Los átomos "ƒ" se guardan como TEXTO fuente y se compilan al arrancar.
// Es lo que permite que el programa se reescriba a sí mismo en vivo.
const createFunction = (src) => (new Function("return (" + src + ")"))();

// El programa entero es un Map global de átomos, tipados por su SIGILO final.
const diarsaba = new Map();

// Ejecuta un átomo por su SIGILO:
//   "~" thread → una SECUENCIA de nombres; cada paso se vuelve a despachar aquí,
//                así que un thread puede contener acciones y OTROS threads.
//   "!" acción → una lista [nombreDeFunción, ...argumentos].
// (La versión real envuelve cada paso en try/catch y lo apunta en la bitácora.)
function threads(name) {
    const seq = diarsaba.get(name);
    if (!Array.isArray(seq)) return;
    if (name.endsWith("~")) { for (const paso of seq) threads(paso); return; }
    const [fnName, ...args] = seq;
    const f = diarsaba.get(fnName);
    if (typeof f === "function") return f.apply(null, args);
}

// El kernel se expone también como global porque los átomos son TEXTO que se
// compila con new Function: su ámbito es el global, no este módulo. Un átomo
// que dice diarsaba.get(...) sólo puede verlo así. Es la misma razón por la
// que en la app real todo esto vive en un <script> plano.
window.diarsaba = diarsaba;
window.createFunction = createFunction;
window.threads = threads;

export { diarsaba, createFunction, threads };
