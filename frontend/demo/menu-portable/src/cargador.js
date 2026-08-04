/* ═══════════════════════════════════════════════════════════════════════════
   EL CARGADOR — sembrar el universo.

   Los átomos son DATOS: viven en JSON, no en el código. Aquí se leen y se
   ponen en el Map, compilando los "ƒ" al entrar — es el mismo bootstrap que la
   app real hace con predefined_functions.json.

   De dónde vienen es cosa del anfitrión, y por eso se pasa un "leer":
     · navegador  → fetch de los .json de src/atomos/  (lo de aquí)
     · Tauri      → invoke("cargar_atomos") o el fs de Tauri
     · app real   → el bbolt de ese universo, sembrado desde un core.json
   Cambiar de sitio no cambia ni un átomo.
   ═══════════════════════════════════════════════════════════════════════════ */

import { diarsaba, createFunction } from "./kernel.js";

// Los grupos que forman este universo, en orden. Son ficheros, pero también son
// la lectura del programa: el núcleo primero, y encima lo que vive en él.
export const GRUPOS = ["nucleo", "estilo", "escena", "pruebas"];

// Lector por defecto: los JSON de al lado. Necesita servidor — un fetch desde
// file:// está bloqueado, así que el paquete se abre servido (Tauri lo sirve).
export const leerDeDisco = async (grupo) => {
    const url = new URL(`./atomos/${grupo}.json`, import.meta.url);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`no se pudo leer ${grupo}.json (${r.status})`);
    return r.json();
};

// Un átomo entra al Map según su SIGILO: una "ƒ" se compila, el resto entra tal
// cual. Es la única regla del bootstrap, y es la misma de "interpretar valor ƒ".
//
// Las marcas ⟨sembrar⟩ las lee herramientas/empaquetar.mjs para copiar esta
// función al archivo único: así no hay dos versiones de la regla.
// ⟨sembrar⟩
export function sembrar(atomos) {
    let n = 0;
    for (const [nombre, valor] of Object.entries(atomos)) {
        try {
            diarsaba.set(nombre, nombre.endsWith("ƒ") ? createFunction(valor) : valor);
            n++;
        } catch (e) {
            // Un átomo que no compila no se lleva por delante a los demás: se
            // queda fuera y se dice cuál. Sembrar a medias es mejor que no
            // arrancar, porque el que falta se puede escribir desde el menú.
            console.warn(`[cargador] «${nombre}» no compila, se queda fuera:`, e.message);
        }
    }
    return n;
}
// ⟨/sembrar⟩

// Siembra el universo entero. Devuelve cuántos átomos entraron.
export async function cargar({ leer = leerDeDisco, grupos = GRUPOS } = {}) {
    let n = 0;
    for (const grupo of grupos) n += sembrar(await leer(grupo));
    return n;
}
