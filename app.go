package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
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
