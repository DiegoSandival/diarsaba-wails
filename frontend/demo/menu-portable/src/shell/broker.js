/* ── EL SHELL · EL BROKER ───────────────────────────────────────────────────
   Lo que el universo no puede hacer solo porque vive fuera de él.

   ACABA DE ADELGAZAR, y el motivo es de diseño, no de limpieza: **la única
   persistencia y el único contacto con el exterior van a ser los JSON de los
   átomos, gestionados con CRDT**. Así que se fueron de aquí:

     · kv.set/get/delete/history/restore   un almacén por clave (era el bbolt)
     · guardar / cargar                    escribir y leer el programa
     · p2p.arrancar/anunciar/abrirStream/  la red por verbos
       escribir/leer/cerrar

   Ninguno lo usaba ningún átomo: eran costuras preparadas para un anfitrión que
   ahora no hace falta. Un almacén por clave y una red por verbos son dos formas
   de resolver lo mismo que el CRDT resuelve de una: el estado converge y lo que
   converge ES el programa. Tener las tres cosas a la vez habría dejado tres
   verdades — un átomo en el Map, otro en el kv, otro en el par remoto — y ese es
   el problema que el CRDT existe para no tener.

   Lo que queda no es persistencia ni red:
     · exportar()   el programa como datos, aquí y ahora. No escribe en ningún
                    sitio: serializa. Es, precisamente, la forma de lo que el
                    CRDT va a gestionar, así que se queda.
     · ai()         el asistente del editor. Una capacidad del anfitrión.
     · recargar()   recargar el anfitrión.
     · al/emitir    entregar al universo algo que llega DE FUERA. Hoy no llega
                    nada (p2p se fue); es el gancho por el que el CRDT entregará
                    un cambio remoto cuando exista. Si prefieres que también se
                    vaya y que el CRDT traiga el suyo, se quita en dos líneas.

   El CRDT todavía no está escrito. Cuando lo esté, es él quien entra aquí — no
   una colección de verbos, sino un almacén que converge.
   ────────────────────────────────────────────────────────────────────────── */

// Lo que devuelve un verbo que no está enchufado. No lanza: un anfitrión ausente
// es un dato, no un error — igual que un átomo que no termina.
const sinAnfitrion = (verbo) => {
    if (window.host && window.host.log) window.host.log("· sin anfitrión: <b>" + verbo + "</b>");
    return { ok: false, motivo: "sin anfitrión", verbo };
};

export const brokerNulo = {
    nombre: "nulo",

    // El programa entero, como datos. Lo único de aquí que funciona sin
    // anfitrión: el universo ya sabe serializarse. Una "ƒ" sale como su fuente,
    // que es como vive en el JSON.
    exportar: () => {
        const salida = {};
        for (const [k, v] of window.diarsaba) {
            if (typeof v === "function") salida[k] = v.toString();
            else if (typeof v !== "undefined") salida[k] = v;
        }
        return { ok: true, valor: salida };
    },

    // El asistente del editor. Un verbo, no una integración.
    ai: (codigo, lang, instruccion, system) => sinAnfitrion("ai"),

    // Recargar el anfitrión (en un navegador, la página).
    recargar: () => location.reload(),

    // Eventos que llegan de fuera. El universo registra un nombre y una función;
    // quien esté fuera la llama. Registrarse no cuesta nada, y sin nadie fuera
    // simplemente no llega nada.
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
    // Lo llama EL DE FUERA para entregar un evento. Está aquí, y no en el
    // universo, porque quien lo dispara no es el universo.
    emitir(evento, datos) {
        for (const fn of this._oyentes.get(evento) || []) {
            try { fn(datos); } catch (e) { console.warn("[broker] oyente de", evento, e); }
        }
    },
};
