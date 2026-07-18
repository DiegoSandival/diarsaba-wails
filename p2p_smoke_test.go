package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/DiegoSandival/p2plite"
)

// TestP2PStreamRoundTrip levanta un segundo nodo (identidad y puerto propios),
// le hace anunciar una clave y comprueba el camino completo del puente:
// FindProviders -> OpenStream -> Write -> CloseWrite -> Read -> Close, con los
// bytes yendo y viniendo en base64.
func TestP2PStreamRoundTrip(t *testing.T) {
	if testing.Short() {
		t.Skip("toca la red real")
	}
	ctx := context.Background()
	key := fmt.Sprintf("diarsaba/smoke/%d", time.Now().UnixNano())

	peer, err := p2plite.New(ctx, p2plite.Config{
		DataDir:    filepath.Join(t.TempDir(), "peer"),
		ListenPort: 4102,
	})
	if err != nil {
		t.Fatalf("nodo par: %v", err)
	}
	defer peer.Close()

	// El handler va ANTES de Start: hace de eco, como el nodo de referencia.
	peer.SetStreamHandler(func(from p2plite.PeerID, s p2plite.Stream) {
		defer s.Close()
		data, _ := io.ReadAll(s)
		fmt.Fprintf(s, "recibido: %s", strings.TrimSpace(string(data)))
	})
	if err := peer.Start(ctx); err != nil {
		t.Fatalf("arrancar par: %v", err)
	}

	app := NewApp()
	defer app.P2PStop()
	if _, err := app.P2PStart(); err != nil {
		t.Fatalf("P2PStart: %v", err)
	}

	if !waitDHT(t, app) || !waitPeerDHT(t, peer) {
		t.Skip("la DHT no se pobló: sin red no hay nada que probar")
	}
	if err := peer.Announce(ctx, p2plite.ResourceID(key)); err != nil {
		t.Fatalf("announce del par: %v", err)
	}

	found, err := app.P2PFindProviders(key, 30000)
	if err != nil {
		t.Fatalf("P2PFindProviders: %v", err)
	}
	if len(found) == 0 {
		t.Fatalf("no se encontró al par que anunció %q", key)
	}
	t.Logf("proveedor: %s", found[0].ID)

	sid, err := app.P2POpenStream(found[0].ID, 30000)
	if err != nil {
		t.Fatalf("P2POpenStream: %v", err)
	}
	msg := "hola desde diarsaba"
	if err := app.P2PStreamWrite(sid, base64.StdEncoding.EncodeToString([]byte(msg))); err != nil {
		t.Fatalf("P2PStreamWrite: %v", err)
	}
	if err := app.P2PStreamCloseWrite(sid); err != nil {
		t.Fatalf("P2PStreamCloseWrite: %v", err)
	}

	var reply string
	for {
		chunk, err := app.P2PStreamRead(sid, 0, 15000)
		if err != nil {
			t.Fatalf("P2PStreamRead: %v", err)
		}
		raw, err := base64.StdEncoding.DecodeString(chunk.Data)
		if err != nil {
			t.Fatalf("respuesta no es base64: %v", err)
		}
		reply += string(raw)
		if chunk.EOF {
			break
		}
	}
	if err := app.P2PStreamClose(sid); err != nil {
		t.Fatalf("P2PStreamClose: %v", err)
	}

	want := "recibido: " + msg
	if reply != want {
		t.Fatalf("respuesta = %q, se esperaba %q", reply, want)
	}
	t.Logf("ida y vuelta ok: %q", reply)

	kind, _ := app.P2PConnKind(found[0].ID)
	ip, _ := app.P2PConnIP(found[0].ID)
	t.Logf("conexión: %s %s", kind, ip)
}

func waitDHT(t *testing.T, app *App) bool {
	t.Helper()
	deadline := time.Now().Add(45 * time.Second)
	for time.Now().Before(deadline) {
		if n, err := app.P2PRoutingTableSize(); err == nil && n > 0 {
			return true
		}
		time.Sleep(time.Second)
	}
	return false
}

func waitPeerDHT(t *testing.T, node *p2plite.Node) bool {
	t.Helper()
	deadline := time.Now().Add(45 * time.Second)
	for time.Now().Before(deadline) {
		if node.RoutingTableSize() > 0 {
			return true
		}
		time.Sleep(time.Second)
	}
	return false
}

// TestP2PSmoke ejerce el puente de verdad: arranca el nodo, pide identidad y
// direcciones, y espera a que la DHT se pueble. Toca la red real.
func TestP2PSmoke(t *testing.T) {
	if testing.Short() {
		t.Skip("toca la red real")
	}
	app := NewApp()
	defer app.P2PStop()

	id, err := app.P2PID()
	if err != nil {
		t.Fatalf("P2PID: %v", err)
	}
	t.Logf("PeerID: %s", id)

	addrs, err := app.P2PAddrs()
	if err != nil {
		t.Fatalf("P2PAddrs: %v", err)
	}
	t.Logf("Addrs: %v", addrs)

	full, err := app.P2PFullAddrs()
	if err != nil {
		t.Fatalf("P2PFullAddrs: %v", err)
	}
	t.Logf("FullAddrs: %d", len(full))

	deadline := time.Now().Add(45 * time.Second)
	for time.Now().Before(deadline) {
		n, err := app.P2PRoutingTableSize()
		if err != nil {
			t.Fatalf("P2PRoutingTableSize: %v", err)
		}
		if n > 0 {
			peers, _ := app.P2PPeers()
			t.Logf("DHT lista: %d en la tabla, %d peers conectados", n, len(peers))

			if err := app.P2PAnnounce("diarsaba/smoke"); err != nil {
				t.Fatalf("P2PAnnounce: %v", err)
			}
			t.Log("Announce ok")
			if err := app.P2PStopAnnounce("diarsaba/smoke"); err != nil {
				t.Fatalf("P2PStopAnnounce: %v", err)
			}

			found, err := app.P2PFindProviders("diarsaba/smoke", 15000)
			if err != nil {
				t.Fatalf("P2PFindProviders: %v", err)
			}
			t.Logf("FindProviders: %d proveedores", len(found))
			return
		}
		time.Sleep(time.Second)
	}
	t.Fatal("la DHT no se pobló en 45s (¿la semilla es alcanzable?)")
}
