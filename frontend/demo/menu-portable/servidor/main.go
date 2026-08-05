// EL SERVIDOR MÍNIMO — para probar el paquete portable sin Tauri.
//
// Sirve frontend/demo/menu-portable tal cual, con los tipos MIME correctos para
// los módulos ES (.mjs) y los átomos (.json) — Go los adivina bien, pero en
// Windows a veces el registro del sistema pisa "application/json" con algo raro,
// y un módulo servido como text/plain no lo carga ningún navegador.
//
// Es sólo para desarrollar: NO es el shell de Tauri, no tiene broker, no sirve
// vs/ ni fa/ salvo que los copies dentro de esta carpeta (ver LEEME.md, "Correrlo").
//
//	go run ./servidor
//	go run ./servidor -puerto 9000
package main

import (
	"flag"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"runtime"
)

// La carpeta PADRE de este archivo — main.go vive en .../menu-portable/servidor/,
// y lo que hay que servir es .../menu-portable/, un nivel arriba. Resuelto en
// tiempo de compilación: es el default de "-dir", y es lo que evita el error
// obvio de que "." dependa de desde dónde se invoque "go run" ("go run
// ./servidor" desde la raíz del repo serviría el repo entero, no el paquete).
func carpetaDelPaquete() string {
	_, aqui, _, _ := runtime.Caller(0)
	return filepath.Dir(filepath.Dir(aqui))
}

func main() {
	puerto := flag.String("puerto", "8778", "puerto donde escuchar")
	dir := flag.String("dir", carpetaDelPaquete(), "raíz a servir (por defecto, el paquete portable, sin importar desde dónde se invoque)")
	flag.Parse()

	// El registro MIME de Windows a veces no tiene ".mjs", y sin
	// "application/javascript" un <script type="module"> no arranca.
	_ = mime.AddExtensionType(".mjs", "application/javascript")
	_ = mime.AddExtensionType(".json", "application/json")

	raiz, err := filepath.Abs(*dir)
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.Handle("/", noCache(http.FileServer(http.Dir(raiz))))

	url := "http://localhost:" + *puerto
	log.Printf("sirviendo %s en %s", raiz, url)
	log.Printf("abre %s/index.html", url)
	log.Fatal(http.ListenAndServe("localhost:"+*puerto, mux))
}

// Sin caché: al editar un átomo .mjs/.json se quiere ver el cambio en el
// siguiente refresh, no el que el navegador tenía guardado.
func noCache(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		h.ServeHTTP(w, r)
	})
}
