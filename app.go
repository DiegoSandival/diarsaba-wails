package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// SavePredefinedFunctions guarda el JSON en el directorio del proyecto
// y versiona el archivo anterior si ya existe.
func (a *App) SavePredefinedFunctions(jsonData string) (string, error) {
	// Obtiene el directorio actual (raíz del proyecto en 'wails dev')
	dir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("error obteniendo directorio: %w", err)
	}

	// --- CAMBIO PRINCIPAL: Definir la ruta a la carpeta "frontend" ---
	frontendDir := filepath.Join(dir, "frontend")

	// Asegurarse de que la carpeta frontend exista (buena práctica)
	if err := os.MkdirAll(frontendDir, 0755); err != nil {
		return "", fmt.Errorf("error al verificar/crear carpeta frontend: %w", err)
	}

	baseName := "predefined_functions"
	ext := ".json"

	// El archivo objetivo ahora está dentro de frontendDir
	targetPath := filepath.Join(frontendDir, baseName+ext)

	// Verificar si el archivo base ya existe para versionarlo
	if _, err := os.Stat(targetPath); err == nil {
		version := 1
		for {
			versionedName := fmt.Sprintf("%s_v%d%s", baseName, version, ext)
			// Buscamos el archivo versionado DENTRO de la carpeta frontend
			versionedPath := filepath.Join(frontendDir, versionedName)

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

	// Escribimos el nuevo archivo en la carpeta frontend
	err = os.WriteFile(targetPath, []byte(jsonData), 0644)
	if err != nil {
		return "", fmt.Errorf("error guardando archivo: %w", err)
	}

	absPath, _ := filepath.Abs(targetPath)
	return absPath, nil
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
