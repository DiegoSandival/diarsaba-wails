//go:build !windows

package main

import "context"

// En plataformas que no son Windows aún no hay bandeja ni autostart: cerrar la
// ventana cierra la app (comportamiento normal) y no se levanta ningún icono.
func (a *App) beforeClose(ctx context.Context) bool { return false }

func (a *App) startTray() {}
