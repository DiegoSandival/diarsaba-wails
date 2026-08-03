/* ── EL SHELL · EL AISLAMIENTO ──────────────────────────────────────────────
   Correr un átomo que no es de fiar. Aquí es un Web Worker con un reloj
   encima; en la app puede ser workerd o el sandbox que el anfitrión ofrezca.
   El universo sólo ve el verbo host.worker(fuente, args, ms) y un veredicto.
   ────────────────────────────────────────────────────────────────────────── */

export const aislamiento = {
    /* ── EL AISLAMIENTO (worker) ───────────────────────────────────────────
       Correr un átomo que NO es de fiar: puede colgarse, reventar o intentar
       tocar lo que no es suyo. Vive en un worker, que es un mundo aparte —sin
       document, sin el Map, sin nada de aquí—, y con un reloj encima: si no
       contesta a tiempo se le termina y ya está. Aquí es un Web Worker; en la
       app (Go/Wails) el mismo verbo lo cumple workerd.

       Lo que vuelve son DATOS. Si el átomo quiere dibujar, devuelve una lista
       de acciones y las pinta el universo de casa: nada del sandbox llega al
       DOM, ni siquiera indirectamente.                                       */

    // El único código que se le confía al worker: recibe una fuente, la
    // compila allí dentro y devuelve lo que salga —o el error.
    _sandbox: `
self.onmessage = (e) => {
    const { src, args } = e.data;
    try {
        const f = (new Function("return (" + src + ")"))();
        if (typeof f !== "function") { self.postMessage({ ok: false, motivo: "no es función" }); return; }
        const valor = f.apply(null, args || []);
        // Sólo lo estructurable cruza de vuelta: una función o un elemento
        // no pueden viajar por un postMessage, y eso es una garantía, no un
        // límite.
        self.postMessage({ ok: true, valor: JSON.parse(JSON.stringify(valor ?? null)) });
    } catch (err) {
        self.postMessage({ ok: false, motivo: "reventó", error: String((err && err.message) || err) });
    }
};`,

    // Corre una fuente aislada y resuelve SIEMPRE, con un veredicto:
    //   { ok:true, valor }                        · contestó
    //   { ok:false, motivo:"colgada" }            · se le terminó el tiempo
    //   { ok:false, motivo:"reventó", error }     · lanzó
    //   { ok:false, motivo:"sin aislamiento" }    · no hay worker: NO se ejecuta
    // Nunca lanza y nunca se queda esperando: por eso un while(true) no se
    // lleva por delante la página.
    async worker(src, args = [], ms = 800) {
        // El reloj se pone en marcha DESPUÉS de tener el worker: arrancarlo cuesta
        // unos milisegundos que no son del átomo. Aun así lo que se mide es tiempo
        // de pared, así que un "colgada" puede pasarse del plazo: el aviso llega
        // cuando el hilo de casa vuelve a mirar.
        let t0 = performance.now();
        const tiempo = () => Math.round(performance.now() - t0);
        let w = null, url = null;
        try {
            url = URL.createObjectURL(new Blob([this._sandbox], { type: "text/javascript" }));
            w = new Worker(url);
        } catch (e) {
            // Sin sandbox no se ejecuta NADA. Correr en el hilo principal algo
            // que puede no terminar sería exactamente lo que se quiere evitar.
            if (url) URL.revokeObjectURL(url);
            return { ok: false, motivo: "sin aislamiento", error: String(e.message || e), ms: tiempo() };
        }
        t0 = performance.now();
        return new Promise((resolve) => {
            let cerrado = false;
            const cerrar = (r) => {
                if (cerrado) return;
                cerrado = true;
                clearTimeout(reloj);
                w.terminate();                 // esto es lo que mata un bucle infinito
                URL.revokeObjectURL(url);
                resolve({ ...r, ms: tiempo() });
            };
            const reloj = setTimeout(() => cerrar({ ok: false, motivo: "colgada" }), ms);
            w.onmessage = (e) => cerrar(e.data);
            w.onerror = (e) => {
                if (e.preventDefault) e.preventDefault();
                cerrar({ ok: false, motivo: "reventó", error: e.message || "error en el worker" });
            };
            w.postMessage({ src, args });
        });
    },
};
