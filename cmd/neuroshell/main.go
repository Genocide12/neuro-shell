// ===== NeuroShell :: десктопная обёртка (Go) =====
// Локальный сервер отдаёт index.html и проксирует запросы к любым API,
// поэтому CORS не важен. Ключ хранится на машине пользователя.
package main

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync/atomic"
	"time"

	"neuroshell/internal/site"
)

var version = "1.0.1"

func main() {
	mux := http.NewServeMux()

	// мост: сердцебиение — сервер живёт, пока открыта вкладка приложения
	var lastBeat int64 // 0 до первого пинга
	mux.HandleFunc("/__ns/ping", func(w http.ResponseWriter, r *http.Request) {
		atomic.StoreInt64(&lastBeat, time.Now().Unix())
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte("pong"))
	})
	mux.HandleFunc("/__ns/exit", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte("bye"))
		go func() {
			time.Sleep(300 * time.Millisecond)
			fmt.Println("\n[NeuroShell] вкладка закрыта — выходим.")
			os.Exit(0)
		}()
	})

	// прокси к любому API: /__ns/proxy?url=https://.../v1/chat/completions
	mux.HandleFunc("/__ns/proxy", nsProxy)

	// всё остальное — встроенный сайт
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Write(site.IndexHTML())
	})

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatal("listen:", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	url := fmt.Sprintf("http://127.0.0.1:%d/", port)

	server := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	fmt.Printf("NeuroShell %s — сервер запущен: %s\n", version, url)
	if err := openBrowser(url); err != nil {
		fmt.Println("Не удалось открыть браузер автоматически. Откройте вручную:", url)
	}
	fmt.Println("Работает. Закройте вкладку приложения (или это окно) для выхода.")
	// до первого пинга ждём до 10 минут (пользователь открывает вкладку),
	// дальше живём, пока идут сердцебиения; пропали — вкладку закрыли
	firstDeadline := time.Now().Add(10 * time.Minute)
	for {
		time.Sleep(2 * time.Second)
		last := atomic.LoadInt64(&lastBeat)
		if last == 0 {
			if time.Now().After(firstDeadline) {
				fmt.Println("\n[NeuroShell] вкладка так и не открылась — выходим.")
				return
			}
			continue
		}
		if time.Now().Unix()-last > 25 {
			fmt.Println("\n[NeuroShell] вкладка закрыта — выходим.")
			return
		}
	}
}

// nsProxy — универсальный прокси для API-запросов (обход CORS и смешанных схем).
func nsProxy(w http.ResponseWriter, r *http.Request) {
	target := r.URL.Query().Get("url")
	if target == "" {
		http.Error(w, "missing url", http.StatusBadRequest)
		return
	}
	if !strings.HasPrefix(target, "http://") && !strings.HasPrefix(target, "https://") {
		http.Error(w, "bad url", http.StatusBadRequest)
		return
	}

	body, _ := io.ReadAll(io.LimitReader(r.Body, 64<<20))

	req, err := http.NewRequestWithContext(r.Context(), r.Method, target, bytes.NewReader(body))
	if err != nil {
		http.Error(w, "bad request: "+err.Error(), http.StatusBadRequest)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream, */*")
	if auth := r.Header.Get("X-NS-Authorization"); auth != "" {
		req.Header.Set("Authorization", auth)
	}
	if xi := r.Header.Get("X-NS-X-Api-Key"); xi != "" {
		req.Header.Set("x-api-key", xi)
	}
	// браузерный UA: часть прокси-сервисов фильтрует не-браузерные клиенты
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 NeuroShell/"+version)

	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		http.Error(w, "proxy error: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	for _, h := range []string{"Content-Type"} {
		if v := resp.Header.Get(h); v != "" {
			w.Header().Set(h, v)
		}
	}
	w.Header().Set("X-NS-Status", fmt.Sprintf("%d", resp.StatusCode))
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// openBrowser открывает URL в браузере по умолчанию.
func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}
