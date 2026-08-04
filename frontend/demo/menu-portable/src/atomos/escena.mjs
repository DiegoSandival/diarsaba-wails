/* ── ÁTOMOS · escena ─────────────────────────────────────────────────────────
   LA FUENTE. Se edita aquí, como código: el editor lo colorea, node lo compila
   y los comentarios caben. El escena.json de al lado se GENERA de esto con
   herramientas/atomos-a-json.mjs, y es el que lee el cargador.
   ────────────────────────────────────────────────────────────────────────── */

export default {
    /* ══ LA ESCENA (escena.json) ══════════════════════════════════════════════ */
    /* Un dibujo escrito como programa: tres funciones que dibujan, unas cuantas  */
    /* acciones "!" que las llaman con sus argumentos, threads "~" que las juntan */
    /* por capas, y un place "@" que es el lienzo donde todo eso vive.            */
    /*                                                                            */
    /* Nada de aquí toca el DOM: las coordenadas son % del place, los tamaños px  */
    /* de su escenario, y los colores se nombran en castellano — el shell solo    */
    /* recibe un color CSS ya resuelto y lo pinta.                                 */

    // El catálogo de la escena, para poder abrirla y cambiarla en vivo.
    "escena #": [
        "escena @",
        "escena usa #",
        "colores :",
        "dibujar ƒ",
        "cielo ~",
        "entorno ~",
        "esqueleto del arbol ~",
        "copa del arbol ~",
        "circulo <",
        "circulo ƒ",
        "esparcir circulos ƒ",
        "trazo <",
        "trazo ƒ",
        "texto <",
        "texto ƒ"
    ],

    "colores :": {
        "amarillo": "#ffd21e",
        "blanco": "#ffffff",
        "verde": "#9acd32",
        "rojo": "#e03131",
        "marron": "#8a5a2b",
        "azul": "#4d9de0",
        "negro": "#000000"
    },

    /* ── las tres que dibujan ── */

    /* ── LAS FORMAS SON ÁTOMOS "<" ────────────────────────────────────────────
       Qué ES un círculo ya no vive en el shell: es este HTML. Las clases las
       define «estilo del lienzo {», que también es un átomo, así que la forma y
       su estilo se leen y se cambian los dos desde el menú. El shell sólo mete
       el marcado en el lienzo (host.pintar) y no sabe qué acaba de pintar.

       Las coordenadas son % del place; los tamaños, px del escenario de 200×200.
       Cambiar aquí "left/top" por otra cosa recoloca la escena entera.          */

    "circulo <": `<div class="escena-circulo" style="left:{{x}}%;top:{{y}}%;width:{{tamano}};height:{{tamano}};background:{{color}};z-index:{{z}}"></div>`,

    "texto <": `<div class="escena-texto" style="left:{{x}}%;top:{{y}}%;font-size:{{tamano}};color:{{color}};z-index:{{z}}">{{contenido}}</div>`,

    // El trazo es un <svg> propio en coordenadas 0..100, las mismas de la escena.
    // "non-scaling-stroke" mantiene el grosor en px del escenario aunque el
    // viewBox se estire: una línea no engorda al escalar.
    "trazo <": `<svg class="escena-trazo" viewBox="0 0 100 100" preserveAspectRatio="none" style="z-index:{{z}}"><polyline points="{{puntos}}" fill="none" stroke="{{color}}" stroke-width="{{grosor}}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`,

    // Un círculo. Resuelve el color, rellena su plantilla y se la da al shell.
    "circulo ƒ": `(color, tamano, x, y, z) => {
      host.pintar(diarsaba.get("plantilla ƒ")(diarsaba.get("circulo <"),
          { x, y, tamano, z, color: diarsaba.get("dibujar ƒ")(color) }));
  }`,

    // Traduce un nombre de color a un color CSS. Si no está en "colores {", se
    // pasa tal cual: así "#0af" o "tomato" siguen valiendo.
    "dibujar ƒ": `(color) => (diarsaba.get("colores :") || {})[color] || color`,

    // Muchos círculos alrededor de (xC, yC), dentro de un cuadrado de lado 2·radio.
    // Es lo que hace que el follaje y las flores no se dibujen a mano uno a uno.
    "esparcir circulos ƒ": `(cantidad, xC, yC, radio, color, tamano, z) => {
      const dibujar = diarsaba.get("circulo ƒ");
      for (let i = 0; i < cantidad; i++) {
          dibujar(color, tamano,
                  xC + (Math.random() * radio * 2 - radio),
                  yC + (Math.random() * radio * 2 - radio), z);
      }
  }`,

    // Una línea continua que une los puntos [[x, y], ...]. Menos de dos puntos no
    // es una línea: no se pinta nada (antes esa guarda estaba en el shell).
    "trazo ƒ": `(color, grosor, z, puntos) => {
      if (!Array.isArray(puntos) || puntos.length < 2) return;
      host.pintar(diarsaba.get("plantilla ƒ")(diarsaba.get("trazo <"), {
          z, grosor,
          color: diarsaba.get("dibujar ƒ")(color),
          puntos: puntos.map((p) => p[0] + "," + p[1]).join(" "),
      }));
  }`,

    // Una línea de texto. El tercer verbo de dibujo, y el que hace legible un
    // place que informa de algo (el banco de pruebas, por ejemplo).
    //
    // El contenido va con {{}} de dos llaves: se ESCAPA. Importa, porque aquí
    // llegan textos de fuera —el mensaje de error de un átomo aislado, por
    // ejemplo—, y un "<" suelto no puede convertirse en marcado.
    "texto ƒ": `(color, tamano, x, y, z, contenido) => {
      host.pintar(diarsaba.get("plantilla ƒ")(diarsaba.get("texto <"),
          { x, y, tamano, z, contenido, color: diarsaba.get("dibujar ƒ")(color) }));
  }`,

    /* ── las acciones: una función y sus argumentos ── */
    "1 sol !": ["circulo ƒ","amarillo","10px",10,10,0],

    "2 luna !": ["circulo ƒ","blanco","8px",90,15,0],

    "3 follaje !": ["esparcir circulos ƒ",20,50,25,15,"verde","10px",1],

    "4 manzanas !": ["esparcir circulos ƒ",5,50,25,12,"rojo","2px",2],

    "5 tronco base !": ["trazo ƒ","marron","15px",0,[[45,70],[44,55],[45,45]]],

    "5 rama izquierda !": ["trazo ƒ","marron","6px",0,[[44,55],[35,40]]],

    "5 rama derecha !": ["trazo ƒ","marron","5px",0,[[45,50],[55,38]]],

    "6 flores blancas !": ["esparcir circulos ƒ",5,25,60,10,"blanco","2px",1],

    "7 suelo !": ["circulo ƒ","verde","60px",40,70,-1],

    "8 flor amarilla !": ["circulo ƒ","amarillo","3px",32,52,1],

    "9 raices !": ["trazo ƒ","blanco","3px",0,[[45,70],[42,85],[35,95]]],

    /* ── los threads: la escena por capas ── */
    "cielo ~": ["1 sol !","2 luna !"],

    "entorno ~": ["7 suelo !","6 flores blancas !","8 flor amarilla !"],

    "esqueleto del arbol ~": ["5 tronco base !","5 rama izquierda !","5 rama derecha !","9 raices !"],

    "copa del arbol ~": ["3 follaje !","4 manzanas !"],

    "escena arbolo ~": ["cielo ~","entorno ~","esqueleto del arbol ~","copa del arbol ~"],

    /* ── EL PLACE ─────────────────────────────────────────────────────────────
       Un "@" es una lista de threads y el lienzo donde ocurren. Viajar a él
       borra el lienzo y los pone en marcha en orden. Que sea una lista es lo
       que lo deja editar como todo lo demás: quitarle "copa del arbol ~" es
       quitar un elemento, y el árbol se queda sin hojas al siguiente viaje.   */
    "escena @": ["escena arbolo ~"],

    // Todos los átomos que hacen falta para dibujar esta escena. No se mantiene a
    // mano: se rehace al abrirla, siguiendo lo que cada uno menciona desde el
    // place hacia dentro. Quitarle un thread al place cambia esta lista sola.
    "escena usa #": [],

    "escena usa # al abrir ƒ": `(lista) => {
      lista.length = 0;
      for (const nombre of diarsaba.get("usados por ƒ")("escena @")) lista.push(nombre);
  }`,
};
