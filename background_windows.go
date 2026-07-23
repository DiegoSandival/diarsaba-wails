//go:build windows

package main

import (
	"context"
	_ "embed"
	"os"

	"github.com/energye/systray"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/sys/windows/registry"
)

//go:embed build/windows/icon.ico
var trayIcon []byte

// runKeyPath / runValueName: la clave de autoarranque de Windows para el USUARIO
// actual (no la de todo el sistema, que pediría permisos de admin).
const (
	runKeyPath   = `Software\Microsoft\Windows\CurrentVersion\Run`
	runValueName = "diarsaba"
)

// beforeClose intercepta el cierre de la ventana: en vez de salir, la ESCONDE y
// deja la app viva en la bandeja (el nodo p2p sigue recibiendo). Solo sale de
// verdad cuando se pide "Salir" desde el menú de la bandeja.
func (a *App) beforeClose(ctx context.Context) bool {
	if a.reallyQuit {
		return false // dejar cerrar
	}
	wruntime.WindowHide(ctx)
	return true // prevenir el cierre: seguimos en segundo plano
}

// startTray levanta el icono de la bandeja y su menú, en su propia goroutine
// (systray.Run bloquea). TODO esto vive solo en Go: no es un binding, así que un
// átomo no puede tocar la bandeja ni —lo importante— el autostart, que es una
// capacidad de persistencia que no debe quedar al alcance de código compartido.
func (a *App) startTray() {
	go systray.Run(func() {
		systray.SetIcon(trayIcon)
		systray.SetTitle("diarsaba")
		systray.SetTooltip("diarsaba — nodo p2p en segundo plano")

		mOpen := systray.AddMenuItem("Abrir diarsaba", "Mostrar la ventana")
		mAuto := systray.AddMenuItemCheckbox("Iniciar con Windows", "Lanzar diarsaba al encender la computadora", autostartEnabled())
		systray.AddSeparator()
		mQuit := systray.AddMenuItem("Salir", "Cerrar diarsaba del todo (detiene el nodo)")

		show := func() { wruntime.WindowShow(a.ctx) }
		mOpen.Click(show)
		systray.SetOnClick(func(systray.IMenu) { show() }) // clic en el icono = abrir

		mAuto.Click(func() {
			if mAuto.Checked() {
				if disableAutostart() == nil {
					mAuto.Uncheck()
				}
			} else {
				if enableAutostart() == nil {
					mAuto.Check()
				}
			}
		})

		mQuit.Click(func() {
			a.reallyQuit = true
			wruntime.Quit(a.ctx)
		})
	}, func() {})
}

// autostartEnabled dice si diarsaba está registrada para arrancar con Windows.
func autostartEnabled() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, runKeyPath, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()
	_, _, err = k.GetStringValue(runValueName)
	return err == nil
}

// enableAutostart registra el .exe para arrancar con Windows. El flag --tray hace
// que en ese arranque vaya directo a la bandeja (ventana oculta); ver main.go.
func enableAutostart() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	k, _, err := registry.CreateKey(registry.CURRENT_USER, runKeyPath, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	return k.SetStringValue(runValueName, `"`+exe+`" --tray`)
}

// disableAutostart quita el registro de autoarranque.
func disableAutostart() error {
	k, err := registry.OpenKey(registry.CURRENT_USER, runKeyPath, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	return k.DeleteValue(runValueName)
}
