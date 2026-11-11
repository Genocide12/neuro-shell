// ===== NeuroShell :: встраивание сайта =====
package site

import "embed"

//go:embed index.html
var FS embed.FS

// IndexHTML возвращает собранный одностраничный интерфейс.
func IndexHTML() []byte {
	b, err := FS.ReadFile("index.html")
	if err != nil {
		panic("neuroshell: index.html not embedded: " + err.Error())
	}
	return b
}
