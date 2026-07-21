package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	bolt "go.etcd.io/bbolt"
)

// atomStore es el almacén VIVO de átomos: un bbolt (B+tree, un solo archivo,
// mmap, sin goroutines de fondo) donde cada átomo es una clave y su valor el
// JSON crudo de ese átomo.
//
// Sustituye a reescribir predefined_functions.json entero en cada guardado.
// Dos cosas que el archivo no daba:
//   - Escritura granular: tocar un átomo escribe esa clave, no 100 KB.
//   - Atomicidad: todo va en una transacción, así que un corte a media
//     escritura ya no puede dejar el programa a medias (antes, un fallo entre
//     el Rename del backup y el WriteFile te dejaba sin archivo principal).
//
// El JSON NO desaparece: sigue siendo el formato de intercambio — la semilla
// embebida, el export para revisar en git y el import entre instancias. La BD
// es la verdad en tiempo de ejecución; el JSON es cómo esa verdad viaja y se
// revisa. Ver exportJSON / importJSON.
type atomStore struct {
	db *bolt.DB
}

var (
	bucketAtoms = []byte("atoms")
	bucketMeta  = []byte("meta")

	// bucketHistory guarda versiones anteriores de cada átomo. Dentro hay un
	// sub-bucket por nombre de átomo, y en él las versiones antiguas indexadas
	// por una secuencia creciente. Es la red de seguridad del autosave: si al
	// cerrar el editor se persistió algo roto, aquí está lo de antes.
	bucketHistory = []byte("history")

	// metaFileHash guarda el hash del JSON del repo tal como se leyó o escribió
	// por última vez. Es lo que permite detectar que el archivo cambió POR FUERA
	// (un git pull, un checkout de rama, una edición a mano) y reimportarlo sin
	// que tengas que acordarte de hacerlo.
	metaFileHash = []byte("file_hash")
)

// maxHistoryPerAtom es cuántas versiones anteriores se conservan por átomo. El
// autosave dispara al cerrar cada editor, así que unas pocas decenas cubren una
// sesión de trabajo sin dejar crecer la base sin límite.
const maxHistoryPerAtom = 25

func hashBytes(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// openAtomStore abre (o crea) la base en path.
//
// El Timeout no es opcional: bbolt toma un lock exclusivo del archivo y sin él
// una segunda instancia de la app se quedaría colgada para siempre en silencio
// en vez de fallar con un error que se pueda mostrar.
func openAtomStore(path string) (*atomStore, error) {
	db, err := bolt.Open(path, 0600, &bolt.Options{Timeout: 5 * time.Second})
	if err != nil {
		return nil, fmt.Errorf("no se pudo abrir la base de átomos (%s): %w", path, err)
	}
	err = db.Update(func(tx *bolt.Tx) error {
		for _, name := range [][]byte{bucketAtoms, bucketMeta, bucketHistory} {
			if _, err := tx.CreateBucketIfNotExists(name); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("no se pudieron crear los buckets: %w", err)
	}
	return &atomStore{db: db}, nil
}

func (s *atomStore) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

// isEmpty indica si todavía no hay ningún átomo (base recién creada).
func (s *atomStore) isEmpty() (bool, error) {
	empty := true
	err := s.db.View(func(tx *bolt.Tx) error {
		k, _ := tx.Bucket(bucketAtoms).Cursor().First()
		empty = k == nil
		return nil
	})
	return empty, err
}

// importJSON deja la base con EXACTAMENTE los átomos del JSON dado, en una sola
// transacción: o entra el programa entero o no entra nada.
//
// Aunque la semántica sea "reemplazar todo", por dentro es un diff: se borra lo
// que sobra y solo se escribe lo que de verdad cambió. Así el guardado del
// frontend —que sigue mandando el mapa completo— ya solo ensucia las páginas de
// los átomos que tocaste, sin necesidad de que el frontend lleve la cuenta.
func (s *atomStore) importJSON(data []byte) error {
	var atoms map[string]json.RawMessage
	if err := json.Unmarshal(data, &atoms); err != nil {
		return fmt.Errorf("JSON de átomos inválido: %w", err)
	}
	return s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketAtoms)
		if b == nil {
			return errors.New("falta el bucket de átomos")
		}

		// Los sobrantes se recogen antes de borrar: mutar el bucket mientras se
		// recorre con ForEach deja el cursor en un estado indefinido.
		var sobran [][]byte
		err := b.ForEach(func(k, _ []byte) error {
			if _, sigue := atoms[string(k)]; !sigue {
				sobran = append(sobran, append([]byte(nil), k...))
			}
			return nil
		})
		if err != nil {
			return err
		}
		for _, k := range sobran {
			if err := b.Delete(k); err != nil {
				return err
			}
		}

		for name, value := range atoms {
			if bytes.Equal(b.Get([]byte(name)), value) {
				continue // sin cambios: no ensuciar la página
			}
			if err := b.Put([]byte(name), value); err != nil {
				return err
			}
		}
		return nil
	})
}

// exportJSON reconstruye el JSON completo desde la base.
//
// SetEscapeHTML(false) es imprescindible: por defecto Go escapa < > & a <,
// lo que destrozaría los átomos de vista '<' y cualquier HTML dentro de una
// cadena, además de generar un diff enorme contra lo que escribe JSON.stringify.
// Con indent de 2 espacios y sin escape, la salida es byte por byte la que
// producía el frontend — solo cambia el ORDEN de las claves, que aquí queda
// ordenado (Go ordena las claves de un map al serializar), y eso es una mejora:
// el orden deja de depender de en qué momento creaste cada átomo, así que los
// diffs de git muestran lo que cambió y no cómo se barajó el archivo.
func (s *atomStore) exportJSON() ([]byte, error) {
	atoms := map[string]json.RawMessage{}
	err := s.db.View(func(tx *bolt.Tx) error {
		return tx.Bucket(bucketAtoms).ForEach(func(k, v []byte) error {
			// El valor del cursor solo es válido dentro de la transacción:
			// bbolt apunta a memoria mmap que se reutiliza al salir.
			cp := make([]byte, len(v))
			copy(cp, v)
			atoms[string(k)] = cp
			return nil
		})
	})
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(atoms); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// recordHistory guarda el valor ANTERIOR de un átomo antes de sobrescribirlo o
// borrarlo. Se conservan las últimas maxHistoryPerAtom versiones por átomo; las
// más viejas se descartan. Si no había valor previo no hay nada que versionar.
//
// La clave dentro del sub-bucket es la secuencia (creciente) en 8 bytes
// big-endian, así que el cursor las recorre de la más vieja a la más nueva y
// recortar es borrar desde el principio.
func recordHistory(tx *bolt.Tx, name string, old []byte) error {
	if old == nil {
		return nil
	}
	sub, err := tx.Bucket(bucketHistory).CreateBucketIfNotExists([]byte(name))
	if err != nil {
		return err
	}
	seq, err := sub.NextSequence()
	if err != nil {
		return err
	}
	key := make([]byte, 8)
	binary.BigEndian.PutUint64(key, seq)
	// El valor viene de la memoria mmap del bucket de átomos; hay que copiarlo
	// antes de guardarlo en otro bucket dentro de la misma transacción.
	cp := append([]byte(nil), old...)
	if err := sub.Put(key, cp); err != nil {
		return err
	}

	// Recortar por umbral de secuencia: las seq son crecientes y nunca se
	// reutilizan, así que quedarse con las últimas maxHistoryPerAtom es borrar
	// todo lo que tenga seq <= seq_actual - maxHistoryPerAtom. (No se usa
	// Stats().KeyN: no cuenta lo recién puesto dentro de esta transacción.)
	if seq <= maxHistoryPerAtom {
		return nil
	}
	cutoff := make([]byte, 8)
	binary.BigEndian.PutUint64(cutoff, seq-maxHistoryPerAtom)
	c := sub.Cursor()
	var viejas [][]byte
	for k, _ := c.First(); k != nil && bytes.Compare(k, cutoff) <= 0; k, _ = c.Next() {
		viejas = append(viejas, append([]byte(nil), k...))
	}
	for _, k := range viejas {
		if err := sub.Delete(k); err != nil {
			return err
		}
	}
	return nil
}

// putAtom escribe UN átomo, versionando antes el valor anterior. Es la
// operación del autosave: guardar un átomo ya no reescribe el programa entero.
func (s *atomStore) putAtom(name string, value json.RawMessage) error {
	if name == "" {
		return errors.New("el nombre del átomo no puede estar vacío")
	}
	if !json.Valid(value) {
		return fmt.Errorf("el valor de %q no es JSON válido", name)
	}
	return s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketAtoms)
		old := b.Get([]byte(name))
		if bytes.Equal(old, value) {
			return nil // sin cambios: ni se versiona ni se reescribe
		}
		if err := recordHistory(tx, name, old); err != nil {
			return err
		}
		return b.Put([]byte(name), value)
	})
}

// deleteAtom borra un átomo, versionando antes su valor por si el borrado hay
// que deshacerlo. Borrar algo que no existe no es un error.
func (s *atomStore) deleteAtom(name string) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketAtoms)
		old := b.Get([]byte(name))
		if old == nil {
			return nil
		}
		if err := recordHistory(tx, name, old); err != nil {
			return err
		}
		return b.Delete([]byte(name))
	})
}

// atomVersion es una versión histórica de un átomo, tal como la ve el frontend.
type atomVersion struct {
	Seq   uint64          `json:"seq"`
	Value json.RawMessage `json:"value"`
}

// history devuelve las versiones anteriores de un átomo, de la más reciente a
// la más antigua. Lista vacía si no hay historial.
func (s *atomStore) history(name string) ([]atomVersion, error) {
	var out []atomVersion
	err := s.db.View(func(tx *bolt.Tx) error {
		sub := tx.Bucket(bucketHistory).Bucket([]byte(name))
		if sub == nil {
			return nil
		}
		c := sub.Cursor()
		// De la más nueva a la más vieja: recorrido inverso.
		for k, v := c.Last(); k != nil; k, v = c.Prev() {
			out = append(out, atomVersion{
				Seq:   binary.BigEndian.Uint64(k),
				Value: append(json.RawMessage(nil), v...),
			})
		}
		return nil
	})
	return out, err
}

// restoreVersion vuelve a poner un átomo en el valor de una versión histórica.
// El valor actual se versiona antes, así que restaurar es en sí reversible.
func (s *atomStore) restoreVersion(name string, seq uint64) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		sub := tx.Bucket(bucketHistory).Bucket([]byte(name))
		if sub == nil {
			return fmt.Errorf("%q no tiene historial", name)
		}
		key := make([]byte, 8)
		binary.BigEndian.PutUint64(key, seq)
		valor := sub.Get(key)
		if valor == nil {
			return fmt.Errorf("la versión %d de %q ya no existe", seq, name)
		}
		restaurado := append([]byte(nil), valor...)

		b := tx.Bucket(bucketAtoms)
		if err := recordHistory(tx, name, b.Get([]byte(name))); err != nil {
			return err
		}
		return b.Put([]byte(name), restaurado)
	})
}

func (s *atomStore) fileHash() (string, error) {
	var h string
	err := s.db.View(func(tx *bolt.Tx) error {
		h = string(tx.Bucket(bucketMeta).Get(metaFileHash))
		return nil
	})
	return h, err
}

func (s *atomStore) setFileHash(h string) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(bucketMeta).Put(metaFileHash, []byte(h))
	})
}

// syncFromFile reimporta el JSON del repo si cambió por fuera de la app.
//
// Sin esto, en desarrollo la base y el archivo se separarían en silencio: harías
// git pull, verías el JSON nuevo en el editor y la app seguiría corriendo el
// programa viejo. Compara el hash del archivo con el que se guardó en el último
// import/export, así que solo reimporta cuando de verdad cambió.
//
// Devuelve true si hubo reimportación.
func (s *atomStore) syncFromFile(path string) (bool, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}

	h := hashBytes(data)
	known, err := s.fileHash()
	if err != nil {
		return false, err
	}
	if h == known {
		return false, nil
	}

	if err := s.importJSON(data); err != nil {
		return false, err
	}
	return true, s.setFileHash(h)
}

// exportToFile vuelca la base al JSON y registra su hash, para que el
// syncFromFile del próximo arranque no lo confunda con un cambio externo.
func (s *atomStore) exportToFile(path string) error {
	data, err := s.exportJSON()
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("error escribiendo %s: %w", path, err)
	}
	return s.setFileHash(hashBytes(data))
}
