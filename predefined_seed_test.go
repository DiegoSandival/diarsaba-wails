package main

import (
	"os"
	"path/filepath"
	"testing"
)

// enProd apunta predefinedPath() a un directorio temporal simulando producción:
// se cambia el cwd para que NO encuentre frontend/predefined_functions.json (lo
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

// TestSiembraCuandoNoExiste: primer arranque en una máquina limpia.
func TestSiembraCuandoNoExiste(t *testing.T) {
	path := enProd(t)
	app := NewApp()

	got, err := app.LoadPredefinedFunctions()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got != string(defaultPredefined) {
		t.Error("no devolvió el embebido")
	}
	enDisco, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("no sembró el archivo: %v", err)
	}
	if string(enDisco) != string(defaultPredefined) {
		t.Error("lo sembrado no coincide con el embebido")
	}
}

// TestReemplazaCopiaVieja: el caso que motivó todo esto — una copia desfasada
// se actualiza, y lo que había queda respaldado.
func TestReemplazaCopiaVieja(t *testing.T) {
	path := enProd(t)
	viejo := `{"algo viejo §":"de una versión anterior"}`
	if err := os.WriteFile(path, []byte(viejo), 0644); err != nil {
		t.Fatal(err)
	}

	app := NewApp()
	got, err := app.LoadPredefinedFunctions()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got != string(defaultPredefined) {
		t.Error("devolvió la copia vieja en vez del embebido")
	}

	enDisco, _ := os.ReadFile(path)
	if string(enDisco) != string(defaultPredefined) {
		t.Error("no reemplazó el archivo en disco")
	}

	respaldo := filepath.Join(filepath.Dir(path), "backups", "predefined_functions_v1.json")
	b, err := os.ReadFile(respaldo)
	if err != nil {
		t.Fatalf("no respaldó lo que había: %v", err)
	}
	if string(b) != viejo {
		t.Errorf("el respaldo no es lo que había: %s", b)
	}
}

// TestNoTocaSiYaEstaAlDia: sin esto, tres aperturas gastarían los tres slots de
// backup y tirarían el respaldo con las ediciones del usuario.
func TestNoTocaSiYaEstaAlDia(t *testing.T) {
	path := enProd(t)
	if err := os.WriteFile(path, defaultPredefined, 0644); err != nil {
		t.Fatal(err)
	}
	antes, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}

	app := NewApp()
	for i := 0; i < 3; i++ {
		if _, err := app.LoadPredefinedFunctions(); err != nil {
			t.Fatalf("Load: %v", err)
		}
	}

	despues, _ := os.Stat(path)
	if !antes.ModTime().Equal(despues.ModTime()) {
		t.Error("reescribió un archivo que ya estaba al día")
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(path), "backups")); !os.IsNotExist(err) {
		t.Error("creó backups sin haber nada que respaldar")
	}
}

// TestDevNoSePisa: en dev el archivo del repo manda; pisarlo con el embebido
// borraría el trabajo en curso.
func TestDevNoSePisa(t *testing.T) {
	prev, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	tmp := t.TempDir()
	if err := os.MkdirAll(filepath.Join(tmp, "frontend"), 0755); err != nil {
		t.Fatal(err)
	}
	enCurso := `{"trabajo en curso §":"no me pises"}`
	repoFile := filepath.Join(tmp, "frontend", "predefined_functions.json")
	if err := os.WriteFile(repoFile, []byte(enCurso), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(tmp); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(prev) })

	if _, isDev, _ := predefinedPath(); !isDev {
		t.Fatal("no se resolvió como dev")
	}

	app := NewApp()
	got, err := app.LoadPredefinedFunctions()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if got != enCurso {
		t.Error("en dev devolvió el embebido en vez del archivo del repo")
	}
	enDisco, _ := os.ReadFile(repoFile)
	if string(enDisco) != enCurso {
		t.Error("en dev PISÓ el archivo del repo")
	}
}
