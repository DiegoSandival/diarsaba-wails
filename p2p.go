package main

// =====================================================================
// Puente hacia p2plite
//
// p2plite mueve bytes y encuentra peers; nada más. Aquí se traduce esa
// superficie a algo que el frontend pueda llamar: las primitivas viajan por
// los bindings de Wails, que solo saben de JSON, así que
//
//   - los PeerID viajan como su forma textual,
//   - los bytes opacos del stream viajan en base64 (siguen siendo opacos: ni
//     esta capa ni la librería interpretan nada),
//   - un Stream, que no es serializable, se queda AQUÍ y el frontend recibe un
//     identificador con el que operarlo (P2PStreamRead/Write/Close).
//
// El nodo arranca solo la primera vez que alguien lo usa: así el place "p2p @"
// no necesita un botón de encendido y la app no paga la red si nunca se toca.
// =====================================================================

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/DiegoSandival/p2plite"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// p2pStreamEvent es el evento que recibe el frontend por cada stream ENTRANTE.
// Lleva {from, stream}: quién llama y con qué identificador atenderlo.
const p2pStreamEvent = "p2p:stream"

// Plazos por defecto, para que el frontend pueda llamar sin pasar números.
const (
	p2pStartTimeout   = 60 * time.Second
	p2pDefaultTimeout = 30 * time.Second
	// p2pStreamIdle es cuánto sobrevive un stream sin que nadie lo toque. Un
	// stream entrante que el frontend no atienda (o abandone a medias) se
	// quedaría abierto para siempre: esto lo recoge.
	//
	// Son 15 minutos porque un stream entrante puede quedarse esperando a que
	// una persona lo lea y conteste a mano (ver "Streams #" en el place
	// "p2p ! @"); con los 2 minutos de antes, el reaper cerraba la
	// conversación antes de que llegaras a mirarla.
	p2pStreamIdle = 15 * time.Minute
)

// p2pBridge es el estado vivo del lado Go: el nodo y los streams abiertos.
type p2pBridge struct {
	mu      sync.Mutex
	node    *p2plite.Node
	streams map[string]*p2pStream
	seq     atomic.Uint64
}

// p2pStream es un stream abierto y su temporizador de recogida.
type p2pStream struct {
	s    p2plite.Stream
	reap *time.Timer
}

// P2PProvider es un proveedor encontrado por FindProviders, ya serializable.
type P2PProvider struct {
	ID    string   `json:"id"`
	Addrs []string `json:"addrs"`
}

// P2PChunk es lo leído de un stream: bytes en base64 y si el remoto ya cerró.
// EOF llega como dato, no como error: que el otro lado termine de hablar es lo
// normal, no un fallo.
type P2PChunk struct {
	Data string `json:"data"`
	EOF  bool   `json:"eof"`
}

// ---- ciclo de vida ----

// ensureNode devuelve el nodo, construyéndolo y arrancándolo la primera vez.
func (a *App) ensureNode() (*p2plite.Node, error) {
	b := a.p2p
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.node != nil {
		return b.node, nil
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	node, err := p2plite.New(ctx, p2plite.Config{Logger: log.Default()})
	if err != nil {
		return nil, fmt.Errorf("no se pudo construir el nodo: %w", err)
	}

	// El handler va ANTES de Start: después, un stream entrante podría llegar
	// antes que él. Aquí solo se registra el stream y se avisa al frontend;
	// quién responde y qué responde es decisión suya.
	node.SetStreamHandler(func(from p2plite.PeerID, s p2plite.Stream) {
		id := b.track(s)
		wailsruntime.EventsEmit(ctx, p2pStreamEvent, map[string]any{
			"from":   from.String(),
			"stream": id,
		})
	})

	startCtx, cancel := context.WithTimeout(ctx, p2pStartTimeout)
	defer cancel()
	if err := node.Start(startCtx); err != nil {
		_ = node.Close()
		return nil, fmt.Errorf("no se pudo arrancar el nodo: %w", err)
	}

	b.node = node
	return node, nil
}

// P2PStart arranca el nodo explícitamente. No hace falta llamarlo —cualquier
// primitiva lo arranca sola—, pero sirve para pagar el arranque por adelantado
// y devuelve el PeerID como confirmación de que la red está en marcha.
func (a *App) P2PStart() (string, error) {
	node, err := a.ensureNode()
	if err != nil {
		return "", err
	}
	return node.ID().String(), nil
}

// P2PStop apaga el nodo y cierra los streams vivos. La siguiente llamada a
// cualquier primitiva lo vuelve a arrancar.
func (a *App) P2PStop() error {
	b := a.p2p
	b.mu.Lock()
	node := b.node
	b.node = nil
	streams := b.streams
	b.streams = make(map[string]*p2pStream)
	b.mu.Unlock()

	for _, st := range streams {
		st.reap.Stop()
		_ = st.s.Close()
	}
	if node == nil {
		return nil
	}
	return node.Close()
}

// shutdown lo llama Wails al cerrar la ventana: sin esto el nodo se llevaría por
// delante el apagado limpio (anuncios sin parar, caché de bootstrap sin volcar).
func (a *App) shutdown(ctx context.Context) {
	_ = a.P2PStop()
}

// ---- diagnóstico ----

// P2PID devuelve el PeerID de este nodo: su identidad estable en la red.
func (a *App) P2PID() (string, error) {
	node, err := a.ensureNode()
	if err != nil {
		return "", err
	}
	return node.ID().String(), nil
}

// P2PAddrs devuelve las direcciones por las que otros pueden intentar alcanzarnos.
func (a *App) P2PAddrs() ([]string, error) {
	node, err := a.ensureNode()
	if err != nil {
		return nil, err
	}
	out := []string{}
	for _, addr := range node.Addrs() {
		out = append(out, addr.String())
	}
	return out, nil
}

// P2PFullAddrs devuelve las direcciones completas (con /p2p/<id>): las que se
// pegan tal cual como semilla.
func (a *App) P2PFullAddrs() ([]string, error) {
	node, err := a.ensureNode()
	if err != nil {
		return nil, err
	}
	addrs := node.FullAddrs()
	if addrs == nil {
		addrs = []string{}
	}
	return addrs, nil
}

// P2PPeers devuelve los peers con conexión viva ahora mismo.
func (a *App) P2PPeers() ([]string, error) {
	node, err := a.ensureNode()
	if err != nil {
		return nil, err
	}
	out := []string{}
	for _, p := range node.Peers() {
		out = append(out, p.String())
	}
	return out, nil
}

// P2PRoutingTableSize devuelve cuántos peers hay en la tabla de rutas de la DHT.
// Mientras sea 0 la DHT no es usable: ni Announce ni FindProviders funcionan.
func (a *App) P2PRoutingTableSize() (int, error) {
	node, err := a.ensureNode()
	if err != nil {
		return 0, err
	}
	return node.RoutingTableSize(), nil
}

// P2PConnKind dice por qué escalón se llegó al peer: direct, hole-punched,
// relayed o none.
func (a *App) P2PConnKind(peerID string) (string, error) {
	node, p, err := a.nodeAndPeer(peerID)
	if err != nil {
		return "", err
	}
	return string(node.ConnKind(p)), nil
}

// P2PConnIP dice si la conexión directa con el peer va por ipv6 o ipv4 (vacío si
// no hay conexión directa).
func (a *App) P2PConnIP(peerID string) (string, error) {
	node, p, err := a.nodeAndPeer(peerID)
	if err != nil {
		return "", err
	}
	return node.ConnIP(p), nil
}

// ---- las primitivas ----

// P2PAnnounce publica que este nodo posee key, y lo mantiene publicado hasta
// P2PStopAnnounce o el apagado.
func (a *App) P2PAnnounce(key string) error {
	node, err := a.ensureNode()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(a.baseCtx(), 2*time.Minute)
	defer cancel()
	return node.Announce(ctx, p2plite.ResourceID(key))
}

// P2PStopAnnounce deja de publicar key. El anuncio sigue vivo en la red hasta
// que caduca solo: la DHT no tiene borrado.
func (a *App) P2PStopAnnounce(key string) error {
	node, err := a.ensureNode()
	if err != nil {
		return err
	}
	node.StopAnnounce(p2plite.ResourceID(key))
	return nil
}

// P2PFindProviders descubre quién posee key. La librería entrega los resultados
// por un canal sin límite; aquí se acotan con el plazo y se devuelven juntos,
// porque el frontend llama y espera una respuesta.
//
// Una lista vacía significa "nadie lo tiene" (o nadie contestó a tiempo); un
// error significa que el nodo no pudo ni buscar.
func (a *App) P2PFindProviders(key string, timeoutMs int) ([]P2PProvider, error) {
	node, err := a.ensureNode()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(a.baseCtx(), timeout(timeoutMs))
	defer cancel()

	ch, err := node.FindProviders(ctx, p2plite.ResourceID(key))
	if err != nil {
		return nil, err
	}

	self := node.ID()
	out := []P2PProvider{}
	for pi := range ch {
		if pi.ID == self {
			continue // nosotros mismos no somos un hallazgo
		}
		addrs := []string{}
		for _, addr := range pi.Addrs {
			addrs = append(addrs, addr.String())
		}
		out = append(out, P2PProvider{ID: pi.ID.String(), Addrs: addrs})
	}
	return out, nil
}

// P2PConnect conecta con un peer por adelantado. P2POpenStream ya conecta solo,
// así que esto solo sirve para calentar la conexión (y para ver si se puede).
func (a *App) P2PConnect(peerID string, timeoutMs int) error {
	node, p, err := a.nodeAndPeer(peerID)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(a.baseCtx(), timeout(timeoutMs))
	defer cancel()
	return node.Connect(ctx, p)
}

// P2POpenStream abre un stream hacia un peer y devuelve el identificador con el
// que operarlo. El stream queda abierto en Go hasta P2PStreamClose (o hasta que
// pase p2pStreamIdle sin tocarlo).
func (a *App) P2POpenStream(peerID string, timeoutMs int) (string, error) {
	node, p, err := a.nodeAndPeer(peerID)
	if err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(a.baseCtx(), timeout(timeoutMs))
	defer cancel()

	s, err := node.OpenStream(ctx, p)
	if err != nil {
		return "", err
	}
	return a.p2p.track(s), nil
}

// P2PStreamWrite escribe bytes (en base64) en el stream.
func (a *App) P2PStreamWrite(streamID, dataB64 string) error {
	st, err := a.p2p.get(streamID)
	if err != nil {
		return err
	}
	data, err := base64.StdEncoding.DecodeString(dataB64)
	if err != nil {
		return fmt.Errorf("datos no son base64 válido: %w", err)
	}
	a.p2p.touch(streamID)
	if err := st.s.SetWriteDeadline(time.Now().Add(p2pDefaultTimeout)); err != nil {
		return err
	}
	if _, err := st.s.Write(data); err != nil {
		return fmt.Errorf("escritura fallida: %w", err)
	}
	return nil
}

// P2PStreamRead lee del stream lo que haya disponible, hasta maxBytes. Devuelve
// los bytes en base64 y si el remoto ya terminó de hablar (EOF).
func (a *App) P2PStreamRead(streamID string, maxBytes, timeoutMs int) (P2PChunk, error) {
	st, err := a.p2p.get(streamID)
	if err != nil {
		return P2PChunk{}, err
	}
	if maxBytes <= 0 {
		maxBytes = 64 * 1024
	}
	a.p2p.touch(streamID)
	if err := st.s.SetReadDeadline(time.Now().Add(timeout(timeoutMs))); err != nil {
		return P2PChunk{}, err
	}

	buf := make([]byte, maxBytes)
	n, err := st.s.Read(buf)
	chunk := P2PChunk{Data: base64.StdEncoding.EncodeToString(buf[:n])}
	if errors.Is(err, io.EOF) {
		chunk.EOF = true
		return chunk, nil
	}
	if err != nil {
		return chunk, fmt.Errorf("lectura fallida: %w", err)
	}
	return chunk, nil
}

// P2PStreamCloseWrite cierra SOLO nuestro lado de escritura: le dice al remoto
// "terminé de hablar, te escucho". Es lo que permite que el otro lado lea hasta
// EOF y luego conteste por el mismo stream.
func (a *App) P2PStreamCloseWrite(streamID string) error {
	st, err := a.p2p.get(streamID)
	if err != nil {
		return err
	}
	return st.s.CloseWrite()
}

// P2PStreamClose cierra el stream y lo olvida.
func (a *App) P2PStreamClose(streamID string) error {
	st := a.p2p.drop(streamID)
	if st == nil {
		return nil // ya estaba cerrado: cerrar dos veces no es un error
	}
	return st.s.Close()
}

// ---- internos ----

// baseCtx es el contexto de la app (vive hasta que se cierra la ventana).
func (a *App) baseCtx() context.Context {
	if a.ctx == nil {
		return context.Background()
	}
	return a.ctx
}

// nodeAndPeer resuelve de una vez el nodo y el PeerID textual que manda el
// frontend, que es el preámbulo de casi toda primitiva dirigida a un peer.
func (a *App) nodeAndPeer(peerID string) (*p2plite.Node, p2plite.PeerID, error) {
	node, err := a.ensureNode()
	if err != nil {
		return nil, "", err
	}
	p, err := p2plite.ParsePeerID(peerID)
	if err != nil {
		return nil, "", err
	}
	return node, p, nil
}

// timeout aplica el plazo por defecto cuando el frontend no pasa ninguno.
func timeout(ms int) time.Duration {
	if ms <= 0 {
		return p2pDefaultTimeout
	}
	return time.Duration(ms) * time.Millisecond
}

// track registra un stream y devuelve su identificador. El temporizador lo
// recoge si nadie lo toca: el frontend puede desaparecer (recarga, error) y un
// stream huérfano no se cierra solo.
func (b *p2pBridge) track(s p2plite.Stream) string {
	id := fmt.Sprintf("s%d", b.seq.Add(1))
	st := &p2pStream{s: s}
	st.reap = time.AfterFunc(p2pStreamIdle, func() {
		if dead := b.drop(id); dead != nil {
			_ = dead.s.Close()
		}
	})

	b.mu.Lock()
	b.streams[id] = st
	b.mu.Unlock()
	return id
}

func (b *p2pBridge) get(id string) (*p2pStream, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	st, ok := b.streams[id]
	if !ok {
		return nil, fmt.Errorf("stream %q desconocido (¿ya cerrado?)", id)
	}
	return st, nil
}

// touch aplaza la recogida: el stream sigue en uso.
func (b *p2pBridge) touch(id string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if st, ok := b.streams[id]; ok {
		st.reap.Reset(p2pStreamIdle)
	}
}

func (b *p2pBridge) drop(id string) *p2pStream {
	b.mu.Lock()
	defer b.mu.Unlock()
	st, ok := b.streams[id]
	if !ok {
		return nil
	}
	st.reap.Stop()
	delete(b.streams, id)
	return st
}
