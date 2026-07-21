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

	if jsonPath, isDev, err := predefinedPath(); err == nil && isDev {
		if _, err := s.syncFromFile(jsonPath); err != nil {
			return fallo(fmt.Errorf("no se pudo importar %s: %w", jsonPath, err))
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
	}
	return s, nil
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

/*
func (a *App) SavePredefinedFunctions(jsonData string) (string, error) {
	// 1. Obtener la ruta del ejecutable actual
	execPath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("error obteniendo ruta del ejecutable: %w", err)
	}

	// 2. Obtener el directorio donde está el ejecutable
	execDir := filepath.Dir(execPath)

	// 3. Crear una carpeta "data" junto al ejecutable para no ensuciar la raíz
	dataDir := filepath.Join(execDir, "data")

	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return "", fmt.Errorf("error creando carpeta de datos: %w", err)
	}

	baseName := "predefined_functions"
	ext := ".json"
	targetPath := filepath.Join(dataDir, baseName+ext)

	// Lógica de versionado (usando dataDir)
	if _, err := os.Stat(targetPath); err == nil {
		version := 1
		for {
			versionedName := fmt.Sprintf("%s_v%d%s", baseName, version, ext)
			versionedPath := filepath.Join(dataDir, versionedName)

			if _, err := os.Stat(versionedPath); os.IsNotExist(err) {
				err = os.Rename(targetPath, versionedPath)
				if err != nil {
					return "", fmt.Errorf("error renombrando archivo anterior: %w", err)
				}
				break
			}
			version++
		}
	}

	err = os.WriteFile(targetPath, []byte(jsonData), 0644)
	if err != nil {
		return "", fmt.Errorf("error guardando archivo: %w", err)
	}

	absPath, _ := filepath.Abs(targetPath)
	return absPath, nil
}*/

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

// GetAIConfig devuelve la configuración actual con la API key ENMASCARADA,
// segura para mostrar en la interfaz.
func (a *App) GetAIConfig() (string, error) {
	cfg, err := loadAIConfig()
	if err != nil {
		return "", err
	}
	cfg.APIKey = maskKey(cfg.APIKey)
	out, _ := json.MarshalIndent(cfg, "", "  ")
	return string(out), nil
}

// SetAIConfig guarda la configuración fuera del repo. Si la key viene vacía o
// enmascarada (contiene "..."), se conserva la key anterior — así el usuario
// puede editar el modelo/proveedor sin volver a teclear la key.
func (a *App) SetAIConfig(jsonData string) error {
	var incoming AIConfig
	if err := json.Unmarshal([]byte(jsonData), &incoming); err != nil {
		return fmt.Errorf("JSON inválido: %w", err)
	}
	if incoming.APIKey == "" || strings.Contains(incoming.APIKey, "...") {
		current, _ := loadAIConfig()
		incoming.APIKey = current.APIKey
	}
	path, err := aiConfigPath()
	if err != nil {
		return err
	}
	out, _ := json.MarshalIndent(incoming, "", "  ")
	if err := os.WriteFile(path, out, 0600); err != nil {
		return fmt.Errorf("error guardando configuración: %w", err)
	}
	return nil
}

// AIChat envía una petición de chat compatible con OpenAI. messagesJSON es el
// array JSON de mensajes [{role, content}, ...] construido por el frontend, y
// devuelve el texto de la respuesta del asistente.
func (a *App) AIChat(messagesJSON string) (string, error) {
	cfg, err := loadAIConfig()
	if err != nil {
		return "", err
	}
	if cfg.APIKey == "" {
		return "", fmt.Errorf("falta configurar la API key (abre la configuración de IA)")
	}

	var messages []map[string]interface{}
	if err := json.Unmarshal([]byte(messagesJSON), &messages); err != nil {
		return "", fmt.Errorf("mensajes inválidos: %w", err)
	}

	baseURL := strings.TrimRight(cfg.BaseURL, "/")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	reqBody := map[string]interface{}{
		"model":    cfg.Model,
		"messages": messages,
	}
	bodyBytes, _ := json.Marshal(reqBody)

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
