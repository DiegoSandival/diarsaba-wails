package main

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// App struct
type App struct {
	ctx context.Context

	// p2p es el nodo de la red y sus streams vivos. Ver p2p.go: se construye
	// vacío y el nodo real arranca la primera vez que el frontend lo usa.
	p2p *p2pBridge

	// store es la base de átomos (bbolt). Ver store.go. Se abre perezosamente
	// con ensureStore().
	store     *atomStore
	storeErr  error
	storeOnce sync.Once

	// reallyQuit distingue "cerrar la ventana" (esconder a la bandeja, el nodo
	// sigue vivo) de "Salir" del menú (cerrar de verdad). Ver beforeClose.
	reallyQuit bool
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		p2p: &p2pBridge{streams: make(map[string]*p2pStream)},
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.startTray() // icono de bandeja + menú (no bloquea; ver background_*.go)
}

// defaultPredefined es el JSON base (semilla) embebido en el binario. Se usa en
// producción para sembrar la copia editable en el primer arranque.
//
//go:embed frontend/predefined_functions.json
var defaultPredefined []byte

// predefinedPath resuelve dónde vive el JSON editable, y si estamos en dev.
//   - Dev ('wails dev'): el archivo del repo (frontend/predefined_functions.json),
//     versionado en git y editado en vivo.
//   - Prod (.exe): una copia escribible en el directorio de configuración del
//     usuario, ya que los assets embebidos son de solo lectura.
func predefinedPath() (path string, isDev bool, err error) {
	if cwd, e := os.Getwd(); e == nil {
		devPath := filepath.Join(cwd, "frontend", "predefined_functions.json")
		if _, statErr := os.Stat(devPath); statErr == nil {
			return devPath, true, nil
		}
	}

	dir, e := os.UserConfigDir()
	if e != nil {
		return "", false, fmt.Errorf("error obteniendo directorio de configuración: %w", e)
	}
	appDir := filepath.Join(dir, "diarsaba")
	if e := os.MkdirAll(appDir, 0755); e != nil {
		return "", false, fmt.Errorf("error creando carpeta de datos: %w", e)
	}
	return filepath.Join(appDir, "predefined_functions.json"), false, nil
}

// storePath resuelve dónde vive la base de átomos.
//
// En dev va junto al repo (y fuera de git): experimentar con 'wails dev' no
// debe tocar los átomos de la app que tengas instalada, y al revés.
func storePath() (string, error) {
	if _, isDev, err := predefinedPath(); err == nil && isDev {
		if cwd, e := os.Getwd(); e == nil {
			return filepath.Join(cwd, "atoms.db"), nil
		}
	}
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("error obteniendo directorio de configuración: %w", err)
	}
	appDir := filepath.Join(dir, "diarsaba")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return "", fmt.Errorf("error creando carpeta de datos: %w", err)
	}
	return filepath.Join(appDir, "atoms.db"), nil
}

// ensureStore abre la base la primera vez que hace falta, ya sembrada y
// sincronizada. Perezoso y no en startup a propósito: así un fallo al abrir se
// puede devolver al frontend como error visible en vez de reventar el arranque,
// y las pruebas no necesitan un contexto de Wails.
func (a *App) ensureStore() (*atomStore, error) {
	a.storeOnce.Do(func() {
		a.store, a.storeErr = prepareStore()
	})
	return a.store, a.storeErr
}

// prepareStore abre la base y la deja lista:
//   - En dev, reimporta el JSON del repo si cambió por fuera (git pull, cambio
//     de rama, edición a mano). Ver atomStore.syncFromFile.
//   - En prod, si el binario trae un programa distinto al que sembró la base
//     (otro build), lo reimporta. Sin esto, actualizar el .exe no cambiaba
//     nada: la base vieja escondía los arreglos. Ver reseedFromEmbedded.
//   - Si tras eso sigue vacía (primer arranque), la siembra con el embebido.
func prepareStore() (*atomStore, error) {
	dbPath, err := storePath()
	if err != nil {
		return nil, err
	}
	s, err := openAtomStore(dbPath)
	if err != nil {
		return nil, err
	}

	fallo := func(err error) (*atomStore, error) {
		s.Close()
		return nil, err
	}

	jsonPath, isDev, perr := predefinedPath()
	switch {
	case perr == nil && isDev:
		// Dev: el JSON del repo manda. Es lo que editas en vivo y versionas.
		if _, err := s.syncFromFile(jsonPath); err != nil {
			return fallo(fmt.Errorf("no se pudo importar %s: %w", jsonPath, err))
		}
	default:
		// Prod: el programa embebido en el binario manda.
		if err := reseedFromEmbedded(s, filepath.Dir(dbPath)); err != nil {
			return fallo(err)
		}
	}

	vacia, err := s.isEmpty()
	if err != nil {
		return fallo(err)
	}
	if vacia {
		if err := s.importJSON(defaultPredefined); err != nil {
			return fallo(fmt.Errorf("no se pudo sembrar la base: %w", err))
		}
		if err := s.setSeedHash(hashBytes(defaultPredefined)); err != nil {
			return fallo(err)
		}
		// Guardar la semilla como base del primer merge de 3 vías.
		if err := s.setSeedContent(defaultPredefined); err != nil {
			return fallo(err)
		}
	}
	return s, nil
}

// reseedFromEmbedded actualiza la base al programa embebido en el binario CUANDO
// difiere del que la sembró. Es lo que hace que, al instalar un .exe nuevo, sus
// arreglos ganen a la copia vieja — igual que antes hacía el JSON externo, y que
// se perdió al migrar a bbolt.
//
// El mismo binario reabierto tiene el mismo hash embebido, así que NO reimporta:
// lo que el usuario haya autoguardado en prod sobrevive entre arranques. Solo un
// binario con otro programa dispara la reimportación, y antes de pisar se
// respalda lo que había, por si tenía ediciones de producción.
func reseedFromEmbedded(s *atomStore, dir string) error {
	embHash := hashBytes(defaultPredefined)
	stored, err := s.seedHash()
	if err != nil {
		return err
	}
	if stored == embHash {
		return nil
	}

	// Respaldar antes de pisar. La decisión de si hay algo que guardar la toma
	// backupBeforeReseed según si la base está vacía — no según el seedHash: una
	// base de un build ANTERIOR a que existiera el seedHash lo tiene vacío pero
	// SÍ contiene un programa que merece respaldo. (Confundir ambos casos dejaba
	// justo la actualización desde build viejo sin copia de seguridad.)
	if err := backupBeforeReseed(s, dir); err != nil {
		return fmt.Errorf("no se pudo respaldar antes de actualizar: %w", err)
	}

	// Merge de 3 vías: la base es el programa del binario ANTERIOR. Preserva tus
	// ediciones de prod a átomos que el binario nuevo no tocó, sin listarlas;
	// "protegidos #" sigue blindando lo que quieras explícitamente. Ver
	// reseedMerge. (Sin base guardada aún, degrada a upsert.)
	base, err := s.seedContent()
	if err != nil {
		return err
	}
	if err := s.reseedMerge(defaultPredefined, base); err != nil {
		return fmt.Errorf("no se pudo actualizar la base al programa del binario: %w", err)
	}
	if err := s.setSeedHash(embHash); err != nil {
		return err
	}
	// La semilla de este binario es la base del PRÓXIMO merge.
	return s.setSeedContent(defaultPredefined)
}

// backupBeforeReseed guarda el programa actual antes de que el binario lo
// reemplace, para no perder sin rastro lo que se hubiera autoguardado en
// producción. Base vacía = nada que respaldar.
func backupBeforeReseed(s *atomStore, dir string) error {
	vacia, err := s.isEmpty()
	if err != nil || vacia {
		return err
	}
	data, err := s.exportJSON()
	if err != nil {
		return err
	}
	backupDir := filepath.Join(dir, "backups")
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return err
	}
	name := fmt.Sprintf("pre-seed-%s.json", time.Now().Format("20060102-150405"))
	return os.WriteFile(filepath.Join(backupDir, name), data, 0644)
}

// LoadPredefinedFunctions devuelve el JSON con el que arranca el frontend,
// reconstruido desde la base de átomos. La firma no cambia: el frontend sigue
// recibiendo el mapa completo y no se entera de que detrás hay una BD.
func (a *App) LoadPredefinedFunctions() (string, error) {
	s, err := a.ensureStore()
	if err != nil {
		return "", err
	}
	data, err := s.exportJSON()
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// SavePredefinedFunctions guarda el JSON en la ubicación resuelta (repo en dev,
// config del usuario en prod) y versiona el archivo anterior si ya existe.
// maxBackups es cuántas copias anteriores se conservan en <dir>/backups.
const maxBackups = 3

// rotateBackups corre los backups un lugar (_v1→_v2→_v3), descarta el más viejo
// y deja libre el slot _v1 para la copia que está por hacerse.
func rotateBackups(backupDir, baseName, ext string) error {
	path := func(n int) string {
		return filepath.Join(backupDir, fmt.Sprintf("%s_v%d%s", baseName, n, ext))
	}

	// El más antiguo se descarta.
	if err := os.Remove(path(maxBackups)); err != nil && !os.IsNotExist(err) {
		return err
	}

	// Se corren hacia atrás para no pisar el siguiente.
	for n := maxBackups - 1; n >= 1; n-- {
		if _, err := os.Stat(path(n)); os.IsNotExist(err) {
			continue
		}
		if err := os.Rename(path(n), path(n+1)); err != nil {
			return err
		}
	}
	return nil
}

// backupPredefined mueve el archivo actual a <dir>/backups como _v1, rotando
// los anteriores. Si el archivo no existe no hay nada que respaldar y no es un
// error. Lo usan el guardado y la actualización desde el embebido.
func backupPredefined(targetPath string) error {
	if _, err := os.Stat(targetPath); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	backupDir := filepath.Join(filepath.Dir(targetPath), "backups")
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return fmt.Errorf("error creando carpeta de backups: %w", err)
	}

	const baseName, ext = "predefined_functions", ".json"
	if err := rotateBackups(backupDir, baseName, ext); err != nil {
		return fmt.Errorf("error rotando backups: %w", err)
	}
	newest := filepath.Join(backupDir, fmt.Sprintf("%s_v1%s", baseName, ext))
	if err := os.Rename(targetPath, newest); err != nil {
		return fmt.Errorf("error respaldando archivo anterior: %w", err)
	}
	return nil
}

// SavePredefinedFunctions guarda el mapa completo en la base, en una sola
// transacción y escribiendo solo los átomos que cambiaron (ver importJSON).
//
// En DEV, además, refresca el JSON del repo: es lo que se revisa en git, y
// dejarlo desfasado respecto a lo que corre convertiría cada commit en una
// sorpresa. En producción no hay repo que refrescar y la base es la verdad.
func (a *App) SavePredefinedFunctions(jsonData string) (string, error) {
	s, err := a.ensureStore()
	if err != nil {
		return "", err
	}
	if err := s.importJSON([]byte(jsonData)); err != nil {
		return "", err
	}

	if jsonPath, isDev, err := predefinedPath(); err == nil && isDev {
		if err := s.exportToFile(jsonPath); err != nil {
			return "", err
		}
		abs, _ := filepath.Abs(jsonPath)
		return abs, nil
	}

	dbPath, _ := storePath()
	abs, _ := filepath.Abs(dbPath)
	return abs, nil
}

// SetAtom escribe UN átomo. valueJSON es el valor ya serializado a JSON.
// Es la operación granular que justifica la BD: no reescribe el resto.
func (a *App) SetAtom(name string, valueJSON string) error {
	s, err := a.ensureStore()
	if err != nil {
		return err
	}
	return s.putAtom(name, json.RawMessage(valueJSON))
}

// DeleteAtom borra un átomo de la base.
func (a *App) DeleteAtom(name string) error {
	s, err := a.ensureStore()
	if err != nil {
		return err
	}
	return s.deleteAtom(name)
}

// AtomHistory devuelve el JSON de las versiones anteriores de un átomo, de la
// más reciente a la más antigua: [{"seq":N,"value":...}, ...]. Es la red de
// seguridad del autosave — con esto se puede recuperar lo que había antes de
// que al cerrar el editor se persistiera algo roto.
func (a *App) AtomHistory(name string) (string, error) {
	s, err := a.ensureStore()
	if err != nil {
		return "", err
	}
	versiones, err := s.history(name)
	if err != nil {
		return "", err
	}
	if versiones == nil {
		versiones = []atomVersion{}
	}
	out, err := json.Marshal(versiones)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// RestoreAtomVersion devuelve un átomo al valor de una de sus versiones
// históricas (por su seq). El valor actual se versiona antes, así que
// restaurar también se puede deshacer.
func (a *App) RestoreAtomVersion(name string, seq uint64) error {
	s, err := a.ensureStore()
	if err != nil {
		return err
	}
	return s.restoreVersion(name, seq)
}

// ExportAtoms vuelca la base a predefined_functions.json y devuelve la ruta.
// Es el puente con git: la BD es la verdad viva, el JSON es la versión que se
// revisa, se commitea y viaja a otra instancia. Respalda el anterior antes de
// pisarlo, rotando en <dir>/backups.
//
// Si el archivo ya tiene exactamente ese contenido no se toca. En dev el
// guardado normal ya refresca el JSON, así que sin esta comparación cada
// export haría un respaldo de un archivo idéntico y en tres exports habría
// tirado los maxBackups slots — justo el respaldo que sí valía la pena.
func (a *App) ExportAtoms() (string, error) {
	s, err := a.ensureStore()
	if err != nil {
		return "", err
	}
	target, _, err := predefinedPath()
	if err != nil {
		return "", err
	}
	abs, _ := filepath.Abs(target)

	nuevo, err := s.exportJSON()
	if err != nil {
		return "", err
	}
	if actual, err := os.ReadFile(target); err == nil && bytes.Equal(actual, nuevo) {
		// Ya coincide: registrar el hash igual, por si se llegó aquí sin pasar
		// por exportToFile (p. ej. un archivo puesto a mano que ya cuadraba).
		if err := s.setFileHash(hashBytes(nuevo)); err != nil {
			return "", err
		}
		return abs, nil
	}

	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return "", fmt.Errorf("error al verificar/crear carpeta: %w", err)
	}
	if err := backupPredefined(target); err != nil {
		return "", err
	}
	if err := s.exportToFile(target); err != nil {
		return "", err
	}
	return abs, nil
}

// =====================================================================
// Integración de IA
//
// Toda la configuración sensible (incluida la API key) vive AQUÍ, en el
// backend, en un archivo FUERA del repositorio (UserConfigDir/diarsaba/
// ai_config.json). El frontend nunca ve la key en claro y las llamadas al
// proveedor salen desde Go, así que no hay problemas de CORS.
// =====================================================================

// AIConfig es la configuración del proveedor de IA elegida por el usuario.
// BaseURL permite apuntar a cualquier proveedor compatible con el formato
// OpenAI (OpenAI, Groq, OpenRouter, DeepSeek, Together, Ollama local, etc.).
type AIConfig struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	BaseURL  string `json:"baseURL"`
	APIKey   string `json:"apiKey"`
}

// aiConfigPath devuelve la ruta del archivo de configuración, fuera del repo.
func aiConfigPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("error obteniendo directorio de configuración: %w", err)
	}
	appDir := filepath.Join(dir, "diarsaba")
	if err := os.MkdirAll(appDir, 0700); err != nil {
		return "", fmt.Errorf("error creando carpeta de configuración: %w", err)
	}
	return filepath.Join(appDir, "ai_config.json"), nil
}

// loadAIConfig lee la configuración. Si no existe, devuelve una vacía.
func loadAIConfig() (AIConfig, error) {
	var cfg AIConfig
	path, err := aiConfigPath()
	if err != nil {
		return cfg, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return cfg, err
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("configuración corrupta: %w", err)
	}
	return cfg, nil
}

// maskKey enmascara la API key para poder mostrarla en la interfaz sin filtrarla.
func maskKey(k string) string {
	if k == "" {
		return ""
	}
	if len(k) <= 8 {
		return "****"
	}
	return k[:4] + "..." + k[len(k)-4:]
}

// GetAIConfig devuelve la configuración actual (con la API key ENMASCARADA) y
// la RUTA del archivo, para mostrarla de solo lectura. Ya no hay forma de
// escribirla desde el frontend: la config vive en Go y se edita en ese archivo,
// fuera del alcance de los átomos. Ver AIEditAtom.
func (a *App) GetAIConfig() (string, error) {
	cfg, err := loadAIConfig()
	if err != nil {
		return "", err
	}
	path, _ := aiConfigPath()
	out, _ := json.MarshalIndent(map[string]string{
		"provider": cfg.Provider,
		"model":    cfg.Model,
		"baseURL":  cfg.BaseURL,
		"apiKey":   maskKey(cfg.APIKey),
		"path":     path,
	}, "", "  ")
	return string(out), nil
}

// chatCompletion es el ÚNICO punto que sale a la red por la IA. El destino y la
// key vienen de la config del archivo (loadAIConfig), NO del frontend, así que
// un átomo no puede redirigir la llamada ni meter su propia key. Ahí está el
// candado: aunque código inyectado llame a AIEditAtom, no exfiltra.
func chatCompletion(cfg AIConfig, messages []map[string]string) (string, error) {
	baseURL := strings.TrimRight(cfg.BaseURL, "/")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	bodyBytes, _ := json.Marshal(map[string]interface{}{
		"model":    cfg.Model,
		"messages": messages,
	})

	req, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("error de red hacia el proveedor: %w", err)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("el proveedor respondió %d: %s", resp.StatusCode, string(respBytes))
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBytes, &parsed); err != nil {
		return "", fmt.Errorf("respuesta no parseable: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("el proveedor no devolvió ninguna respuesta")
	}
	return parsed.Choices[0].Message.Content, nil
}

// AIEditAtom es el binding CON PROPÓSITO que reemplaza al AIChat genérico: su
// único trabajo es ayudar a editar UN átomo de código. El frontend pasa el
// código actual, el lenguaje, la instrucción y un system opcional (el átomo
// "ai system §"); Go arma la conversación —system + un solo mensaje de usuario—
// y llama al proveedor con la config FIJA. No acepta mensajes arbitrarios ni
// permite cambiar el destino, así que ni siquiera un átomo malicioso lo puede
// usar como canal de exfiltración.
func (a *App) AIEditAtom(code, language, instruction, system string) (string, error) {
	cfg, err := loadAIConfig()
	if err != nil {
		return "", err
	}
	if cfg.APIKey == "" {
		path, _ := aiConfigPath()
		return "", fmt.Errorf("falta la API key: configúrala en %s", path)
	}

	sys := strings.TrimSpace(system)
	if sys == "" {
		sys = fmt.Sprintf("Eres un asistente de programación integrado en un editor de código. Estás editando un único átomo de código en lenguaje %q. Devuelve ÚNICAMENTE el código resultante, sin explicaciones y sin envolverlo en bloques markdown (nada de ```). Conserva el estilo y las convenciones del código existente.", language)
	}
	if strings.TrimSpace(code) == "" {
		code = "(vacío)"
	}

	messages := []map[string]string{
		{"role": "system", "content": sys},
		{"role": "user", "content": fmt.Sprintf("Código actual:\n\n%s\n\nInstrucción: %s", code, instruction)},
	}
	return chatCompletion(cfg, messages)
}
