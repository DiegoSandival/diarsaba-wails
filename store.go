package main

import (
	"bytes"
	"crypto/sha256"
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

	// metaFileHash guarda el hash del JSON del repo tal como se leyó o escribió
	// por última vez. Es lo que permite detectar que el archivo cambió POR FUERA
	// (un git pull, un checkout de rama, una edición a mano) y reimportarlo sin
	// que tengas que acordarte de hacerlo.
	metaFileHash = []byte("file_hash")
)

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
		for _, name := range [][]byte{bucketAtoms, bucketMeta} {
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

// putAtom escribe UN átomo. Es la operación que justifica todo el cambio:
// guardar un átomo ya no reescribe el programa entero.
func (s *atomStore) putAtom(name string, value json.RawMessage) error {
	if name == "" {
		return errors.New("el nombre del átomo no puede estar vacío")
	}
	if !json.Valid(value) {
		return fmt.Errorf("el valor de %q no es JSON válido", name)
	}
	return s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(bucketAtoms).Put([]byte(name), value)
	})
}

// deleteAtom borra un átomo. Borrar algo que no existe no es un error.
func (s *atomStore) deleteAtom(name string) error {
	return s.db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket(bucketAtoms).Delete([]byte(name))
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
