/* ── EL SHELL · EL BROKER ───────────────────────────────────────────────────
   El canal 3 del protocolo: lo que el universo no puede hacer solo porque
   vive fuera de él — guardar, cargar, hablar con otra máquina.

   Aquí está NULO a propósito. Cada verbo existe, contesta algo honesto y lo
   apunta en la bitácora, así que el programa entero funciona sin anfitrión: se
   abre en un navegador y no falta nada más que la persistencia y la red. Eso
   es lo que hace este lado portable — no hay un Go escondido del que dependa.

   PARA ENCHUFARLO EN TAURI: no se toca ningún átomo. Se implementa este mismo
   objeto contra invoke() y se pasa a crearHost({ broker }). Los átomos siguen
   diciendo host.broker.kv.set(...) y no se enteran de quién contesta:

       import { invoke } from "@tauri-apps/api/core";
       const brokerTauri = {
           kv: {
               set: (k, v) => invoke("kv_set", { clave: k, valor: v }),
               get: (k)    => invoke("kv_get", { clave: k }),
               ...
           },
           p2p: {                                    // tu librería de Go, aparte
               anunciar: (a)     => invoke("p2p_anunciar", a),
               abrirStream: (id) => invoke("p2p_abrir_stream", { id }),
               ...
           },
           al: (evento, cb) => escuchar(evento, cb),  // eventos entrantes
       };

   Los nombres de abajo salen del inventario del borde de CONTENEDOR.md
   (kv.set/get/delete/history/restore, export/save/load, p2p.*, ai, reload),
   con la firma mínima. Ampliar es añadir un verbo, no rediseñar nada.
   ────────────────────────────────────────────────────────────────────────── */

// Lo que devuelve un verbo que no está enchufado. No lanza: un anfitrión
// ausente es un dato, no un error — igual que un átomo que no termina.
const sinAnfitrion = (verbo) => {
    if (window.host && window.host.log) window.host.log("· sin anfitrión: <b>" + verbo + "</b>");
    return { ok: false, motivo: "sin anfitrión", verbo };
};

export const brokerNulo = {
    nombre: "nulo",

    // Almacén por clave. En la app real es un bbolt por universo; en Tauri, lo
    // que decidas (sqlite, ficheros, el store de Tauri).
    kv: {
        set: (clave, valor) => sinAnfitrion("kv.set " + clave),
        get: (clave) => sinAnfitrion("kv.get " + clave),
        delete: (clave) => sinAnfitrion("kv.delete " + clave),
        history: (clave) => sinAnfitrion("kv.history " + clave),
        restore: (clave, version) => sinAnfitrion("kv.restore " + clave),
    },

    // El programa entero, entrando y saliendo. "export" no necesita anfitrión:
    // el universo ya sabe serializarse, así que esto se puede resolver aquí y
    // es lo único del broker que funciona de verdad sin backend.
    exportar: () => {
        const salida = {};
        for (const [k, v] of window.diarsaba) {
            if (typeof v === "function") salida[k] = v.toString();
            else if (typeof v !== "undefined") salida[k] = v;
        }
        return { ok: true, valor: salida };
    },
    guardar: () => sinAnfitrion("guardar"),
    cargar: () => sinAnfitrion("cargar"),

    // La única pieza que te llevas de Go, y vive detrás de estos verbos: el
    // universo nunca ve un socket, sólo pide "anuncia" o "abre un stream".
    p2p: {
        arrancar: (opciones) => sinAnfitrion("p2p.arrancar"),
        anunciar: (anuncio) => sinAnfitrion("p2p.anunciar"),
        abrirStream: (par) => sinAnfitrion("p2p.abrirStream"),
        escribir: (id, datos) => sinAnfitrion("p2p.escribir"),
        leer: (id) => sinAnfitrion("p2p.leer"),
        cerrar: (id) => sinAnfitrion("p2p.cerrar"),
    },

    // El asistente del editor. Igual que el resto: un verbo, no una integración.
    ai: (codigo, lang, instruccion, system) => sinAnfitrion("ai"),

    // Recargar el anfitrión (en un navegador, la página).
    recargar: () => location.reload(),

    // Eventos que llegan de fuera (un stream p2p entrante, por ejemplo). El
    // universo registra un nombre y una función; el anfitrión la llama. Sin
    // anfitrión no llega nada, y registrarse no cuesta nada.
    _oyentes: new Map(),
    al(evento, fn) {
        if (!this._oyentes.has(evento)) this._oyentes.set(evento, []);
        this._oyentes.get(evento).push(fn);
        return () => {
            const l = this._oyentes.get(evento) || [];
            const i = l.indexOf(fn);
            if (i >= 0) l.splice(i, 1);
        };
    },
    // Lo llama el ANFITRIÓN para entregar un evento. Está aquí, y no en el
    // universo, porque quien lo dispara es de fuera.
    emitir(evento, datos) {
        for (const fn of this._oyentes.get(evento) || []) {
            try { fn(datos); } catch (e) { console.warn("[broker] oyente de", evento, e); }
        }
    },
};
