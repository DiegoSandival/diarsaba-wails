package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// enProd apunta las rutas a un directorio temporal simulando producción: se
// cambia el cwd para que NO encuentre frontend/predefined_functions.json (lo
// que activaría el modo dev) y se redirige UserConfigDir con APPDATA.
func enProd(t *testing.T) string {
	t.Helper()
	tmp := t.TempDir()
	t.Setenv("APPDATA", tmp)

	prev, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	vacio := t.TempDir()
	if err := os.Chdir(vacio); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(prev) })

	path, isDev, err := predefinedPath()
	if err != nil {
		t.Fatalf("predefinedPath: %v", err)
	}
	if isDev {
		t.Fatal("se resolvió como dev: la prueba no estaría probando producción")
	}
	return path
}

// enDev monta un repo falso con el JSON dado y devuelve su ruta.
func enDev(t *testing.T, contenido string) string {
	t.Helper()
	prev, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	tmp := t.TempDir()
	t.Setenv("APPDATA", t.TempDir())
	if err := os.MkdirAll(filepath.Join(tmp, "frontend"), 0755); err != nil {
		t.Fatal(err)
	}
	repoFile := filepath.Join(tmp, "frontend", "predefined_functions.json")
	if err := os.WriteFile(repoFile, []byte(contenido), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(tmp); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(prev) })

	if _, isDev, _ := predefinedPath(); !isDev {
		t.Fatal("no se resolvió como dev")
	}
	return repoFile
}

// cerrar libera el lock del .db para que la siguiente app de la prueba pueda
// abrirlo sin esperar el timeout.
func cerrar(t *testing.T, a *App) {
	t.Helper()
	if a.store != nil {
		if err := a.store.Close(); err != nil {
			t.Fatalf("Close: %v", err)
		}
	}
}

// atomos parsea el JSON devuelto para comparar por CONTENIDO: desde que la
// verdad es la base, el orden de las claves lo decide bbolt y no la inserción.
func atomos(t *testing.T, s string) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal([]byte(s), &m); err != nil {
		t.Fatalf("JSON inválido: %v", err)
	}
	return m
}

// TestSiembraCuandoNoExiste: primer arranque en una máquina limpia. La base se
// crea vacía y se siembra con el JSON embebido en el binario.
func TestSiembraCuandoNoExiste(t *testing.T) {
	enProd(t)
	app := NewApp()
	defer cerrar(t, app)

	got, err := app.LoadPredefinedFunctions()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	esperado := atomos(t, string(defaultPredefined))
	if len(atomos(t, got)) != len(esperado) {
		t.Errorf("sembró %d átomos, se esperaban %d", len(atomos(t, got)), len(esperado))
	}
	if _, err := os.Stat(filepath.Join(os.Getenv("APPDATA"), "diarsaba", "atoms.db")); err != nil {
		t.Errorf("no creó la base: %v", err)
	}
}

// TestProdReimportaAlCambiarElBinario: instalar un .exe nuevo cuyo programa
// embebido difiere del que sembró la base debe actualizarla. Sin esto, la copia
// vieja escondía los arreglos y actualizar el binario no cambiaba nada — el bug
// del doble clic que se veía en dev pero no en el .exe.
func TestProdReimportaAlCambiarElBinario(t *testing.T) {
	enProd(t)

	// Primer arranque: siembra desde el embebido y registra su hash.
	app := NewApp()
	if _, err := app.LoadPredefinedFunctions(); err != nil {
		t.Fatalf("Load: %v", err)
	}
	// Simular una base sembrada por OTRO binario anterior: un átomo propio de
	// prod y un seedHash distinto al actual.
	if err := app.SetAtom("mío de prod §", `"creado aquí"`); err != nil {
		t.Fatal(err)
	}
	if err := app.store.setSeedHash("hash-de-otro-binario"); err != nil {
		t.Fatal(err)
	}
	cerrar(t, app)

	// Nuevo arranque = binario actual: refresca el programa embebido (llegan los
	// arreglos) pero conserva lo creado en prod (upsert, no reemplazo).
	otra := NewApp()
	defer cerrar(t, otra)
	m := atomos(t, mustLoad(t, otra))
	if _, hay := m["handle click ƒ"]; !hay {
		t.Error("el programa embebido no se cargó tras el cambio de binario")
	}
	if m["mío de prod §"] != "creado aquí" {
		t.Error("el reseed borró un átomo propio de prod")
	}
	// Y se respaldó lo que había antes de pisarlo.
	respaldos, _ := filepath.Glob(filepath.Join(os.Getenv("APPDATA"), "diarsaba", "backups", "pre-seed-*.json"))
	if len(respaldos) == 0 {
		t.Error("no respaldó el programa anterior antes de reimportar")
	}
}

// TestReseedConservaLoCreadoEnProd: el upsert no borra lo que el embebido no
// trae. Un átomo creado en prod (autosave) sobrevive a instalar un exe nuevo.
func TestReseedConservaLoCreadoEnProd(t *testing.T) {
	enProd(t)
	app := NewApp()
	defer cerrar(t, app)
	if _, err := app.LoadPredefinedFunctions(); err != nil {
		t.Fatal(err)
	}

	// creado en prod, no existe en el embebido
	if err := app.SetAtom("mi nota §", `"solo mía"`); err != nil {
		t.Fatal(err)
	}
	// simular binario nuevo
	if err := app.store.setSeedHash("otro-binario"); err != nil {
		t.Fatal(err)
	}
	if err := app.store.reseedMerge(defaultPredefined, nil); err != nil {
		t.Fatalf("reseedMerge: %v", err)
	}

	m := atomos(t, mustLoad(t, app))
	if m["mi nota §"] != "solo mía" {
		t.Error("el reseed borró un átomo creado en prod")
	}
	// y sí refrescó los átomos del programa
	if _, hay := m["handle click ƒ"]; !hay {
		t.Error("no refrescó el programa embebido")
	}
}

// TestReseedRespetaProtegidos: un átomo del programa editado en prod y listado
// en "protegidos #" no lo pisa el binario. Uno NO protegido sí.
func TestReseedRespetaProtegidos(t *testing.T) {
	enProd(t)
	app := NewApp()
	defer cerrar(t, app)
	if _, err := app.LoadPredefinedFunctions(); err != nil {
		t.Fatal(err)
	}

	// editar en prod dos átomos que SÍ están en el embebido
	if err := app.SetAtom("editables list #", `["mi","version"]`); err != nil {
		t.Fatal(err)
	}
	if err := app.SetAtom("types list #", `["otra"]`); err != nil {
		t.Fatal(err)
	}
	// proteger solo el primero
	if err := app.SetAtom(atomProtegidos, `["editables list #"]`); err != nil {
		t.Fatal(err)
	}

	if err := app.store.setSeedHash("otro-binario"); err != nil {
		t.Fatal(err)
	}
	if err := app.store.reseedMerge(defaultPredefined, nil); err != nil {
		t.Fatalf("reseedMerge: %v", err)
	}

	m := atomos(t, mustLoad(t, app))
	// protegido: conserva mi versión
	if prot, _ := json.Marshal(m["editables list #"]); string(prot) != `["mi","version"]` {
		t.Errorf("pisó un átomo protegido: %s", prot)
	}
	// no protegido: vuelve al del binario (no es ["otra"])
	if noProt, _ := json.Marshal(m["types list #"]); string(noProt) == `["otra"]` {
		t.Error("no refrescó un átomo NO protegido")
	}
	// la propia lista de protegidos se conserva
	if lp, _ := json.Marshal(m[atomProtegidos]); string(lp) != `["editables list #"]` {
		t.Errorf("no se autoprotegió la lista de protegidos: %s", lp)
	}
}

// merge3 monta un store en prod con el estado "mine" y corre reseedMerge con la
// base y el binario dados, devolviendo el mapa resultante.
func merge3(t *testing.T, mine, theirs, base string) map[string]any {
	t.Helper()
	enProd(t)
	app := NewApp()
	t.Cleanup(func() { cerrar(t, app) })
	s, err := app.ensureStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := s.importJSON([]byte(mine)); err != nil {
		t.Fatal(err)
	}
	var basePtr []byte
	if base != "" {
		basePtr = []byte(base)
	}
	if err := s.reseedMerge([]byte(theirs), basePtr); err != nil {
		t.Fatalf("reseedMerge: %v", err)
	}
	return atomos(t, mustLoad(t, app))
}

// TestMergePreservaMiEdicion: edité un átomo que el binario NO tocó → se conserva
// mi versión, aunque no lo haya protegido. Es lo que aporta el merge sobre el
// upsert simple.
func TestMergePreservaMiEdicion(t *testing.T) {
	base := `{"a §":"v1","b §":"v1","c §":"v1"}`
	mine := `{"a §":"v2","b §":"v1","c §":"v1"}`   // edité a
	theirs := `{"a §":"v1","b §":"v2","c §":"v1"}` // el binario tocó b
	m := merge3(t, mine, theirs, base)
	if m["a §"] != "v2" {
		t.Errorf("a: perdió mi edición que el binario no tocó: %v", m["a §"])
	}
	if m["b §"] != "v2" {
		t.Errorf("b: no tomó el cambio del binario: %v", m["b §"])
	}
	if m["c §"] != "v1" {
		t.Errorf("c: cambió algo intacto: %v", m["c §"])
	}
}

// TestMergeConflictoGanaBinario: si los dos cambiamos el mismo átomo, gana el
// binario (queda en el historial) — salvo que lo protejas.
func TestMergeConflictoGanaBinario(t *testing.T) {
	base := `{"x §":"v1"}`
	mine := `{"x §":"mío"}`
	theirs := `{"x §":"suyo"}`
	if m := merge3(t, mine, theirs, base); m["x §"] != "suyo" {
		t.Errorf("conflicto: no ganó el binario: %v", m["x §"])
	}

	// con protección, gana el mío
	mineP := `{"x §":"mío","protegidos #":["x §"]}`
	if m := merge3(t, mineP, theirs, base); m["x §"] != "mío" {
		t.Errorf("conflicto protegido: no conservó el mío: %v", m["x §"])
	}
}

// TestMergeBorraQuitadoNoEditado: un átomo que el binario ELIMINÓ se va si no lo
// edité; si lo edité, se queda (ya es mío).
func TestMergeBorraQuitadoNoEditado(t *testing.T) {
	base := `{"keep §":"v1","gone §":"v1","edited §":"v1"}`
	mine := `{"keep §":"v1","gone §":"v1","edited §":"mío"}`
	theirs := `{"keep §":"v1"}` // el binario quitó gone y edited
	m := merge3(t, mine, theirs, base)
	if _, sigue := m["gone §"]; sigue {
		t.Error("gone §: el binario lo quitó y no lo edité, debió borrarse")
	}
	if m["edited §"] != "mío" {
		t.Errorf("edited §: lo edité, debió quedarse: %v", m["edited §"])
	}
	if m["keep §"] != "v1" {
		t.Errorf("keep §: no debió cambiar: %v", m["keep §"])
	}
}

// TestMergeSinBaseDegradaAUpsert: sin base guardada, el binario gana en todo
// (comportamiento anterior), pero lo creado en prod se conserva.
func TestMergeSinBaseDegradaAUpsert(t *testing.T) {
	mine := `{"a §":"mío","solo mío §":"x"}`
	theirs := `{"a §":"suyo"}`
	m := merge3(t, mine, theirs, "") // base vacía
	if m["a §"] != "suyo" {
		t.Errorf("sin base debía ganar el binario: %v", m["a §"])
	}
	if m["solo mío §"] != "x" {
		t.Error("sin base debía conservar lo creado en prod")
	}
}

// TestProtegidoPorPrefijo: una entrada protege también lo que empieza por ella.
func TestProtegidoPorPrefijo(t *testing.T) {
	prot := []string{"config"}
	if !isProtegido("config baseURL §", prot) {
		t.Error("el prefijo no protegió a config baseURL §")
	}
	if isProtegido("handle click ƒ", prot) {
		t.Error("protegió de más")
	}
	if !isProtegido(atomProtegidos, nil) {
		t.Error("la lista de protegidos no se autoprotege")
	}
}

// TestProdNoReimportaMismoBinario: reabrir el MISMO binario no debe pisar lo que
// el usuario haya autoguardado en producción.
func TestProdNoReimportaMismoBinario(t *testing.T) {
	enProd(t)

	app := NewApp()
	if _, err := app.LoadPredefinedFunctions(); err != nil {
		t.Fatalf("Load: %v", err)
	}
	if err := app.SetAtom("mi edición §", `"hecha en prod"`); err != nil {
		t.Fatalf("SetAtom: %v", err)
	}
	cerrar(t, app)

	otra := NewApp()
	defer cerrar(t, otra)
	m := atomos(t, mustLoad(t, otra))
	if m["mi edición §"] != "hecha en prod" {
		t.Errorf("reimportó con el mismo binario y perdió la edición: %v", m["mi edición §"])
	}
}

// TestNoResiembraSiYaHayAtomos: la semilla embebida es solo para la base vacía.
// Si resembrara en cada arranque, borraría lo que el usuario haya programado.
func TestNoResiembraSiYaHayAtomos(t *testing.T) {
	enProd(t)

	app := NewApp()
	if _, err := app.SavePredefinedFunctions(`{"mio §":"lo escribí yo"}`); err != nil {
		t.Fatalf("Save: %v", err)
	}
	cerrar(t, app)

	otra := NewApp()
	defer cerrar(t, otra)
	got, err := otra.LoadPredefinedFunctions()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	m := atomos(t, got)
	if len(m) != 1 || m["mio §"] != "lo escribí yo" {
		t.Errorf("perdió lo guardado y resembró: %v", m)
	}
}

// TestGuardarBorraLosQueSobran: guardar deja la base con EXACTAMENTE lo que
// manda el frontend. Sin el borrado, un átomo eliminado reaparecería al
// reabrir, que es justo lo que pasaría con un Put a secas.
func TestGuardarBorraLosQueSobran(t *testing.T) {
	enProd(t)

	app := NewApp()
	defer cerrar(t, app)
	if _, err := app.SavePredefinedFunctions(`{"a §":"1","b §":"2"}`); err != nil {
		t.Fatalf("Save: %v", err)
	}
	if _, err := app.SavePredefinedFunctions(`{"a §":"1"}`); err != nil {
		t.Fatalf("Save: %v", err)
	}

	got, _ := app.LoadPredefinedFunctions()
	m := atomos(t, got)
	if _, sigue := m["b §"]; sigue {
		t.Error("el átomo borrado sobrevivió en la base")
	}
	if len(m) != 1 {
		t.Errorf("quedaron %d átomos, se esperaba 1", len(m))
	}
}

// TestSetYDeleteAtom: la escritura granular, que es lo que justifica la BD.
func TestSetYDeleteAtom(t *testing.T) {
	enProd(t)
	app := NewApp()
	defer cerrar(t, app)

	if _, err := app.SavePredefinedFunctions(`{"a §":"1"}`); err != nil {
		t.Fatalf("Save: %v", err)
	}
	if err := app.SetAtom("b $", "42"); err != nil {
		t.Fatalf("SetAtom: %v", err)
	}

	m := atomos(t, mustLoad(t, app))
	if m["b $"] != float64(42) {
		t.Errorf("SetAtom no escribió el valor: %v", m["b $"])
	}
	if m["a §"] != "1" {
		t.Error("SetAtom tocó otros átomos")
	}

	if err := app.DeleteAtom("b $"); err != nil {
		t.Fatalf("DeleteAtom: %v", err)
	}
	if _, sigue := atomos(t, mustLoad(t, app))["b $"]; sigue {
		t.Error("DeleteAtom no borró")
	}
}

// TestSetAtomRechazaJSONInvalido: un valor corrupto no debe entrar en la base,
// porque el export dejaría de parsear y se llevaría por delante TODO el programa.
func TestSetAtomRechazaJSONInvalido(t *testing.T) {
	enProd(t)
	app := NewApp()
	defer cerrar(t, app)

	if err := app.SetAtom("roto §", "{no es json"); err == nil {
		t.Error("aceptó un valor que no es JSON válido")
	}
}

// TestDevImportaElRepo: en dev el archivo del repo es la semilla, no el embebido.
func TestDevImportaElRepo(t *testing.T) {
	enCurso := `{"trabajo en curso §":"no me pises"}`
	enDev(t, enCurso)

	app := NewApp()
	defer cerrar(t, app)
	got, err := app.LoadPredefinedFunctions()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	m := atomos(t, got)
	if len(m) != 1 || m["trabajo en curso §"] != "no me pises" {
		t.Errorf("en dev no importó el archivo del repo: %v", m)
	}
}

// TestDevReimportaSiElArchivoCambioPorFuera: el caso git pull / cambio de rama.
// Sin esto la base y el repo se separan en silencio: verías el JSON nuevo en el
// editor y la app seguiría corriendo el programa viejo.
func TestDevReimportaSiElArchivoCambioPorFuera(t *testing.T) {
	repoFile := enDev(t, `{"v1 §":"antes"}`)

	app := NewApp()
	if _, err := app.LoadPredefinedFunctions(); err != nil {
		t.Fatalf("Load: %v", err)
	}
	cerrar(t, app)

	// Simula el git pull.
	if err := os.WriteFile(repoFile, []byte(`{"v2 §":"despues"}`), 0644); err != nil {
		t.Fatal(err)
	}

	otra := NewApp()
	defer cerrar(t, otra)
	m := atomos(t, mustLoad(t, otra))
	if _, hay := m["v2 §"]; !hay {
		t.Errorf("no reimportó el archivo cambiado por fuera: %v", m)
	}
	if _, viejo := m["v1 §"]; viejo {
		t.Error("conservó el átomo que el archivo ya no trae")
	}
}

// TestDevNoReimportaLoQueAcabaDeExportar: el export escribe el archivo, así que
// sin registrar su hash el arranque siguiente lo leería como un cambio externo
// y reimportaría en bucle.
func TestDevNoReimportaLoQueAcabaDeExportar(t *testing.T) {
	repoFile := enDev(t, `{"a §":"1"}`)

	app := NewApp()
	if _, err := app.SavePredefinedFunctions(`{"a §":"1","b §":"2"}`); err != nil {
		t.Fatalf("Save: %v", err)
	}
	cerrar(t, app)

	// Guardar en dev refresca el JSON del repo: debe traer ambos átomos.
	enDisco, err := os.ReadFile(repoFile)
	if err != nil {
		t.Fatal(err)
	}
	if len(atomos(t, string(enDisco))) != 2 {
		t.Errorf("el guardado no refrescó el JSON del repo: %s", enDisco)
	}

	otra := NewApp()
	defer cerrar(t, otra)
	if len(atomos(t, mustLoad(t, otra))) != 2 {
		t.Error("reimportó su propio export y perdió átomos")
	}
}

// TestExportRespaldaElAnterior: el export es el puente con git y no debe pisar
// sin dejar rastro de lo que había.
func TestExportRespaldaElAnterior(t *testing.T) {
	repoFile := enDev(t, `{"a §":"1"}`)

	app := NewApp()
	defer cerrar(t, app)
	if err := app.SetAtom("b $", "2"); err != nil {
		t.Fatalf("SetAtom: %v", err)
	}
	if _, err := app.ExportAtoms(); err != nil {
		t.Fatalf("ExportAtoms: %v", err)
	}

	enDisco, _ := os.ReadFile(repoFile)
	if len(atomos(t, string(enDisco))) != 2 {
		t.Errorf("el export no incluyó el átomo nuevo: %s", enDisco)
	}

	respaldo := filepath.Join(filepath.Dir(repoFile), "backups", "predefined_functions_v1.json")
	b, err := os.ReadFile(respaldo)
	if err != nil {
		t.Fatalf("no respaldó lo que había: %v", err)
	}
	if len(atomos(t, string(b))) != 1 {
		t.Errorf("el respaldo no es lo que había: %s", b)
	}
}

// TestExportRepetidoNoQuemaLosBackups: exportar sin haber cambiado nada no debe
// tocar el archivo. En dev el guardado ya refresca el JSON, así que sin esto
// tres exports seguidos rotarían los tres slots y tirarían el respaldo bueno.
func TestExportRepetidoNoQuemaLosBackups(t *testing.T) {
	repoFile := enDev(t, `{"a §":"1"}`)
	backups := filepath.Join(filepath.Dir(repoFile), "backups")

	app := NewApp()
	defer cerrar(t, app)
	if err := app.SetAtom("b $", "2"); err != nil {
		t.Fatalf("SetAtom: %v", err)
	}
	if _, err := app.ExportAtoms(); err != nil { // este sí cambia el archivo
		t.Fatalf("ExportAtoms: %v", err)
	}

	antes, err := os.Stat(repoFile)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 3; i++ {
		if _, err := app.ExportAtoms(); err != nil {
			t.Fatalf("ExportAtoms: %v", err)
		}
	}

	despues, _ := os.Stat(repoFile)
	if !antes.ModTime().Equal(despues.ModTime()) {
		t.Error("reescribió un archivo que ya estaba al día")
	}
	if _, err := os.Stat(filepath.Join(backups, "predefined_functions_v2.json")); !os.IsNotExist(err) {
		t.Error("rotó los backups sin haber cambios que respaldar")
	}
}

// TestExportNoEscapaHTML: por defecto encoding/json convierte < > & en <.
// Eso destrozaría los átomos de vista '<' y cualquier HTML dentro de una cadena.
func TestExportNoEscapaHTML(t *testing.T) {
	enProd(t)
	app := NewApp()
	defer cerrar(t, app)

	vista := `{"saludo <":"<div class=\"x\">hola &amp; adiós</div>"}`
	if _, err := app.SavePredefinedFunctions(vista); err != nil {
		t.Fatalf("Save: %v", err)
	}

	got := mustLoad(t, app)
	if !contiene(got, `<div class=\"x\">hola &amp; adiós</div>`) {
		t.Errorf("el export escapó el HTML: %s", got)
	}
}

// TestRoundTripDelProgramaReal es la prueba que de verdad importa: el programa
// entero (todos los átomos del JSON embebido, con sus ƒ, sigilos y HTML) tiene
// que salir de la base EXACTAMENTE como entró. Si esto falla, cada guardado
// corrompe el programa un poco más y no se nota hasta que algo deja de correr.
func TestRoundTripDelProgramaReal(t *testing.T) {
	enProd(t)
	app := NewApp()
	defer cerrar(t, app)

	got := mustLoad(t, app)

	var origen, vuelta map[string]any
	if err := json.Unmarshal(defaultPredefined, &origen); err != nil {
		t.Fatalf("el JSON embebido no parsea: %v", err)
	}
	if err := json.Unmarshal([]byte(got), &vuelta); err != nil {
		t.Fatalf("lo exportado no parsea: %v", err)
	}
	if !reflect.DeepEqual(origen, vuelta) {
		for k, v := range origen {
			if !reflect.DeepEqual(v, vuelta[k]) {
				t.Errorf("el átomo %q no sobrevivió el viaje", k)
			}
		}
		for k := range vuelta {
			if _, hay := origen[k]; !hay {
				t.Errorf("apareció un átomo que no estaba: %q", k)
			}
		}
	}
}

// TestHistorialVersionaAlSobrescribir: cada edición guarda la versión anterior,
// de la más reciente a la más antigua. Es la red de seguridad del autosave.
func TestHistorialVersionaAlSobrescribir(t *testing.T) {
	enProd(t)
	app := NewApp()
	defer cerrar(t, app)

	if err := app.SetAtom("f ƒ", `"v1"`); err != nil {
		t.Fatalf("SetAtom v1: %v", err)
	}
	if err := app.SetAtom("f ƒ", `"v2"`); err != nil {
		t.Fatalf("SetAtom v2: %v", err)
	}
	if err := app.SetAtom("f ƒ", `"v3"`); err != nil {
		t.Fatalf("SetAtom v3: %v", err)
	}

	raw, err := app.AtomHistory("f ƒ")
	if err != nil {
		t.Fatalf("AtomHistory: %v", err)
	}
	var vs []struct {
		Seq   uint64          `json:"seq"`
		Value json.RawMessage `json:"value"`
	}
	if err := json.Unmarshal([]byte(raw), &vs); err != nil {
		t.Fatalf("historial no parsea: %v", err)
	}
	// Dos versiones anteriores (v1 y v2); v3 es el valor actual, no historial.
	if len(vs) != 2 {
		t.Fatalf("esperaba 2 versiones, hay %d", len(vs))
	}
	if string(vs[0].Value) != `"v2"` || string(vs[1].Value) != `"v1"` {
		t.Errorf("orden/valores inesperados: %s, %s", vs[0].Value, vs[1].Value)
	}
}

// TestHistorialNoVersionaSiNoCambia: reguardar el mismo valor no debe llenar el
// historial de copias idénticas.
func TestHistorialNoVersionaSiNoCambia(t *testing.T) {
	enProd(t)
	app := NewApp()
	defer cerrar(t, app)

	for i := 0; i < 3; i++ {
		if err := app.SetAtom("f ƒ", `"igual"`); err != nil {
			t.Fatalf("SetAtom: %v", err)
		}
	}
	raw, _ := app.AtomHistory("f ƒ")
	if raw != "[]" {
		t.Errorf("versionó cambios inexistentes: %s", raw)
	}
}

// TestHistorialSeRecorta: no crece sin límite.
func TestHistorialSeRecorta(t *testing.T) {
	enProd(t)
	app := NewApp()
	defer cerrar(t, app)

	total := maxHistoryPerAtom + 10
	for i := 0; i <= total; i++ {
		if err := app.SetAtom("f ƒ", fmt.Sprintf(`"v%d"`, i)); err != nil {
			t.Fatalf("SetAtom: %v", err)
		}
	}
	raw, _ := app.AtomHistory("f ƒ")
	var vs []atomVersion
	json.Unmarshal([]byte(raw), &vs)
	if len(vs) != maxHistoryPerAtom {
		t.Errorf("historial no recortado: %d versiones", len(vs))
	}
	// La más reciente del historial debe ser el penúltimo valor escrito.
	if string(vs[0].Value) != fmt.Sprintf(`"v%d"`, total-1) {
		t.Errorf("la cima del historial no es la esperada: %s", vs[0].Value)
	}
}

// TestRestaurarVersion: recuperar una versión anterior, y que restaurar sea a su
// vez reversible (el valor que se pisa queda en el historial).
func TestRestaurarVersion(t *testing.T) {
	enProd(t)
	app := NewApp()
	defer cerrar(t, app)

	app.SetAtom("f ƒ", `"bueno"`)
	app.SetAtom("f ƒ", `"roto"`)

	raw, _ := app.AtomHistory("f ƒ")
	var vs []atomVersion
	json.Unmarshal([]byte(raw), &vs)
	if len(vs) != 1 || string(vs[0].Value) != `"bueno"` {
		t.Fatalf("historial inesperado: %s", raw)
	}

	if err := app.RestoreAtomVersion("f ƒ", vs[0].Seq); err != nil {
		t.Fatalf("RestoreAtomVersion: %v", err)
	}
	m := atomos(t, mustLoad(t, app))
	if m["f ƒ"] != "bueno" {
		t.Errorf("no restauró: %v", m["f ƒ"])
	}
	// "roto" (lo que estaba al restaurar) debe haber quedado en el historial.
	raw2, _ := app.AtomHistory("f ƒ")
	var vs2 []atomVersion
	json.Unmarshal([]byte(raw2), &vs2)
	if string(vs2[0].Value) != `"roto"` {
		t.Errorf("restaurar no versionó el valor pisado: %s", raw2)
	}
}

// TestBorrarVersiona: un borrado también se puede deshacer.
func TestBorrarVersiona(t *testing.T) {
	enProd(t)
	app := NewApp()
	defer cerrar(t, app)

	app.SetAtom("f ƒ", `"existo"`)
	if err := app.DeleteAtom("f ƒ"); err != nil {
		t.Fatalf("DeleteAtom: %v", err)
	}
	raw, _ := app.AtomHistory("f ƒ")
	var vs []atomVersion
	json.Unmarshal([]byte(raw), &vs)
	if len(vs) != 1 || string(vs[0].Value) != `"existo"` {
		t.Errorf("el borrado no dejó rastro recuperable: %s", raw)
	}
}

func mustLoad(t *testing.T, a *App) string {
	t.Helper()
	s, err := a.LoadPredefinedFunctions()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	return s
}

func contiene(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
