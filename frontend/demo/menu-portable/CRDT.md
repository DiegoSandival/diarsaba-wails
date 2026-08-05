# DIARSABA — el CRDT (plan)

> Documento de diseño. El **objetivo**: que los átomos —el programa entero— sean la
> **única** persistencia y el único contacto con el exterior, gestionados con un
> CRDT. Con eso el broker perdió `kv.*`, `guardar`/`cargar` y `p2p.*`: un almacén
> por clave y una red por verbos resuelven lo mismo que el CRDT resuelve de una
> vez, y tenerlos a la vez dejaba tres verdades posibles del mismo átomo (la del
> `Map`, la del `kv`, la del par remoto).
>
> Estado: **nada implementado.** Este documento es el plan. — 2026-08-05

## Los datos de partida (medidos, no supuestos)

130 átomos. El reparto por sigilo es lo que decide casi todo:

```
#  ~  !  @   54 átomos   secuencias (listas, threads, acciones, places)
ƒ  §  {  <   73 átomos   texto (código, textos, CSS, HTML)
:             3 átomos   mapas
$             0 átomos   registros
```

El peso está en el **texto**, y eso ya dice algo del orden de la fase 4: el CRDT de
texto vale más que el de lista, aunque el de lista se note antes (reordenar una
lista a la vez es más frecuente que teclear la misma función a la vez).

Quién escribe hoy en el `Map`:

```
con diarsaba.set (6):   viajar a place ƒ · lista de ƒ · editor ƒ · editar ƒ · tomar ƒ · cortar ƒ
mutando en sitio (5):   nuevo ƒ · cortar ƒ · antes ƒ · despues ƒ · eliminar ƒ
desde el SHELL:         host.log escribe «logs #» directo (widgets.js)
```

Y un observador ya existe: `installStyles` envuelve `diarsaba.set` para repintar los
átomos `{`. Prueba que la técnica funciona — y enseña su punto ciego: **las cinco
ediciones de lista mutan el array en sitio y no pasan por `set`.** Un CRDT colgado
de `set` vería los cambios de texto, de función y de mapa, y se perdería justo las
de lista, que son las que más falta hace converger.

## 1. La unidad que se fusiona

Hay dos niveles, y confundirlos es el error caro:

| nivel | qué fusiona | coste |
|---|---|---|
| **el mapa de átomos** | que existan/desaparezcan y qué vale cada uno | barato, imprescindible |
| **dentro de un átomo** | dos ediciones simultáneas del *mismo* átomo | caro, y sólo hace falta a veces |

**Decisión: empezar sólo por el primero, con LWW por átomo** — último escritor gana,
con reloj lógico (Lamport o HLC) más id de sitio para desempatar. **Nunca hora de
pared.**

Se puede porque la granularidad ya es buena: *los átomos son pequeños y tienen
nombre*. Dos personas tocando átomos distintos —el caso normal— converge perfecto.
El caso que pierde es dos personas en el mismo átomo a la vez, y la pérdida es
"gana uno", no corrupción.

Lo fino se añade después **por sigilo y sin tocar la fontanería**, porque el sigilo
ya dice qué CRDT toca: secuencia para `# ~ ! @`, texto para `ƒ § { <`, por clave
para `:`, registro para `$`. No hay que inventar la tipología — está en el último
carácter del nombre.

## 2. Dónde vive cada pieza

Primero un no: **el CRDT no puede ser un átomo.** El universo es código reescribible
por quien lo usa; si el algoritmo de convergencia vive ahí, una edición mala rompe
la convergencia de todos los pares. Y tiene que seguir funcionando cuando nadie
mira. Es exactamente lo que `CONTENEDOR.md` reserva al kernel inmutable.

```
universo (átomos)      no sabe que existe. Sólo repinta cuando algo cambió.
kernel   (JS)          el PUNTO ÚNICO DE PASO y el feed de cambios. Nada más.
shell    (Tauri/Rust)  el documento CRDT, la fusión, el disco y el cable.
```

El borde no cambia de forma: cruzan **operaciones como datos**, nunca objetos. Es la
misma exigencia de T3 (el worker), así que este trabajo y ése empujan a la vez.

## 3. El prerequisito: el punto único de paso

Sin esto no hay dónde agarrarse, y es lo único de la lista que no es opcional.

El kernel expone **verbos de intención** y cada uno emite un registro de cambio:

```
poner(nombre, valor)
insertar(nombre, indice, valor)
quitar(nombre, indice)
mover(nombre, de, a)
```

Once sitios de llamada a reconducir (los seis `set` y las cinco mutaciones de
arriba), más el `host.log` del shell. Ningún otro átomo cambia.

**Ojo, la restricción que se olvida y luego duele:** los menús abiertos guardan una
referencia **al mismo array** que el átomo — por eso repintar funciona hoy. Una
operación remota **no puede sustituir el array**: tiene que mutarlo en sitio y
después llamar a `repintar lista ƒ`. Si el CRDT devuelve objetos nuevos, los menús
abiertos se quedan mirando fantasmas.

## 4. Qué sincroniza y qué no

No es un detalle: sin esta lista, dos usuarios se pelean por el cursor.

```
NUNCA sincronizan
  logs #             la bitácora es mía (y hace decenas de unshift por sesión)
  pointer up event   un gesto, no un dato
  place actual §     dónde estoy YO
  tomado §           mi portapapeles — mi mano, no el programa
  DERIVADOS          todos # · escena usa # · pruebas usa # · «X usa #»
```

Los derivados son el caso sutil: se recalculan al abrirlos, así que si sincronizaran,
dos pares se los reescribirían mutuamente en bucle. Regla barata y automática:
**un átomo que tiene `<nombre> al abrir ƒ` es derivado, y lo derivado es local.**
Para el resto, una lista `locales #` explícita — que además es un átomo, y por tanto
se lee y se cambia desde el menú como todo lo demás.

## 5. Identidad y borrado

La identidad de un átomo **es su nombre**: así se referencian entre ellos, y
`menciones de ƒ` lo demuestra. Dos consecuencias que se aceptan a propósito:

- **Renombrar es borrar y crear.** Si alguien renombra mientras otro edita, la
  edición se pierde. La alternativa —id interno con el nombre como atributo— obliga
  a reescribir cómo se referencian *todos* los átomos. No lo vale.
- **Borrar necesita tumbas.** Sin marca de borrado, un par que no vio el borrado
  resucita el átomo. Lo trae cualquier biblioteca; el diseño del mapa no puede
  olvidarlo.

## 6. Persistencia: el documento CRDT es la verdad

El documento (log de operaciones, guardado en disco por el shell) pasa a ser **la**
verdad. Los JSON quedan en dos papeles honestos: **semilla** de un universo nuevo y
**exportación** — que es justo `broker.exportar()`, el verbo que sobrevivió.

Eso resuelve una tensión que hoy está viva: `herramientas/atomos-a-json.mjs` genera
los `.json` desde los `.mjs`. En cuanto el CRDT gestione los JSON, esos JSON son
datos vivos y regenerarlos pisaría lo que llegó de fuera. **La dirección útil se
invierte**: la importante pasa a ser `json-a-atomos.mjs`, y la de ida debería
quedarse en `--revisar` (o desaparecer).

## 7. Biblioteca

**automerge** para la primera pasada. El almacén de átomos *es* un documento JSON y
el modelo de automerge mapea 1:1 (mapa nombre → valor, y tipos de texto y de lista
por sigilo cuando lleguen); guarda binario compacto, trae historia —que le da
sentido al `host.diff` que ya existe— y tiene Rust nativo para Tauri.

**yrs/Yjs** si más adelante las listas crecen y la velocidad aprieta.

## 8. Las fases

Cada una deja la app funcionando y se puede comprobar sola.

| fase | qué | cómo se comprueba |
|---|---|---|
| **0** | el punto único de paso, todo local, sin CRDT todavía | cada edición del menú produce **un** registro de cambio; la app se comporta idéntica |
| **1** | documento automerge en el shell, un solo par; `cargar({ leer })` lee del documento y el JSON sólo siembra | editas un átomo, recargas, **sigue ahí** |
| **2** | dos ventanas en la misma máquina, un documento | editas `estilo del menú {` en una y la otra **repinta** — aquí se cobra o se paga el punto 3 |
| **3** | el cable: el p2p de Go transporta los mensajes de sync | **nada del universo cambia** |
| **4** | fusión fina por sigilo: texto para `ƒ § { <`, lista para `# ~ ! @` | dos manos en la misma función sin pisarse |

La fase 0 no necesita CRDT y paga por sí sola: un feed de cambios es lo que da
deshacer, historia y repintado automático.

## 9. Lo que el CRDT no resuelve

Converger significa que **un par puede reescribir tu `ƒ`** y tu programa la
ejecutará. El CRDT no opina sobre eso, y `CONTENEDOR.md` deja la cuarentena fuera de
su alcance a propósito.

La buena noticia es que la respuesta ya está construida: `pruebas @` corre un átomo
que no es de fiar dentro de un worker con reloj, y `dispatch item ƒ` **se niega a
ejecutar en casa** lo que está en `pruebas #`. Esa lista es el gancho natural: lo que
llega de fuera entra en cuarentena y sale cuando lo has mirado.

## 10. Lo que hay que decidir antes de escribir una línea

1. **¿Los verbos de intención van en el kernel o en un módulo aparte?** En el kernel
   los protege de ser reescritos, pero engorda lo que `CONTENEDOR.md` quiere encoger
   hacia la nada.
2. **¿`tomado §` es local?** Aquí se dice que sí —es tu mano, no el programa—, pero
   si el portapapeles fuera compartido, "toma esto y pégalo tú" sería una forma de
   pasarse código entre pares. Es una decisión de producto, no técnica.
3. **¿Un documento por universo o uno global?** `CONTENEDOR.md` (paso 5) quiere un
   store por universo. Un documento CRDT por universo encaja; uno global obligaría a
   nombres únicos entre universos, que es justo lo que un universo aislado no quiere.
