package main

import (
	"embed"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Arrancada con --tray (autostart desde Windows): ir directo a la bandeja,
	// sin abrir la ventana. Un arranque manual (sin flag) sí muestra la ventana.
	startHidden := false
	for _, arg := range os.Args[1:] {
		if arg == "--tray" {
			startHidden = true
		}
	}

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "diarsaba-wails",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		// Cerrar la ventana esconde la app (sigue en la bandeja); ver beforeClose.
		OnBeforeClose: app.beforeClose,
		StartHidden:   startHidden,
		// Una sola instancia: relanzar el .exe (o el autostart con la app ya
		// abierta) muestra la ventana existente en vez de chocar con el lock de
		// bbolt.
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "diarsaba-single-instance",
			OnSecondInstanceLaunch: func(options.SecondInstanceData) {
				wruntime.WindowShow(app.ctx)
			},
		},
		Bind: []interface{}{
			app,
		},
		EnableDefaultContextMenu: true,
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
