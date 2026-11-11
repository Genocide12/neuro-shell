// ===== NeuroShell :: десктопная обёртка (Go) =====
// Локальный сервер отдаёт index.html и проксирует запросы к любым API,
// поэтому CORS не важен. Ключ хранится на машине пользователя.
// Приложение открывается в отдельном собственном окне (Edge/Chrome
// в режиме --app: без вкладок, адресной строки и панелей браузера).
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
        "path/filepath"
        "runtime"
        "strconv"
        "strings"
        "sync/atomic"
        "time"

        "neuroshell/internal/site"
)

var version = "1.2.0"

// Фиксированный порт: адрес приложения не меняется между запусками, поэтому
// настройки и история чатов (localStorage браузерного профиля) сохраняются.
const defaultPort = 8947

func main() {
        mux := http.NewServeMux()

        // мост: сердцебиение — сервер живёт, пока открыто окно приложения
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
                        fmt.Println("\n[NeuroShell] окно закрыто — выходим.")
                        os.Exit(0)
                }()
        })

        // прокси к любому API: /__ns/proxy?url=https://.../v1/chat/completions
        mux.HandleFunc("/__ns/proxy", nsProxy)

        // инструменты агента: файлы на компьютере + клон с GitHub
        // (защита: заголовок X-NS-Agent, Origin и границы рабочей папки — fsapi.go)
        registerAgentAPI(mux)

        // всё остальное — встроенный сайт
        mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
                w.Header().Set("Content-Type", "text/html; charset=utf-8")
                w.Header().Set("Cache-Control", "no-store")
                w.Write(site.IndexHTML())
        })

        listener, url, err := listenURL()
        if err != nil {
                log.Fatal("listen:", err)
        }

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
        if openAppWindow(url) {
                fmt.Println("Приложение открыто в отдельном окне.")
        } else if err := openBrowser(url); err != nil {
                // крайний случай: нет ни Edge/Chrome, ни браузера по умолчанию
                notifyManual(url)
        }
        fmt.Println("Работает. Закройте окно приложения (или это окно) для выхода.")
        // до первого пинга ждём до 10 минут (пользователь открывает окно),
        // дальше живём, пока идут сердцебиения; пропали — окно закрыли
        firstDeadline := time.Now().Add(10 * time.Minute)
        for {
                time.Sleep(2 * time.Second)
                last := atomic.LoadInt64(&lastBeat)
                if last == 0 {
                        if time.Now().After(firstDeadline) {
                                fmt.Println("\n[NeuroShell] окно так и не открылось — выходим.")
                                return
                        }
                        continue
                }
                if time.Now().Unix()-last > 25 {
                        fmt.Println("\n[NeuroShell] окно закрыто — выходим.")
                        return
                }
        }
}

// listenURL слушает фиксированный порт (по умолчанию 8947, меняется
// переменной окружения NS_PORT). Если порт занят уже запущенной копией
// NeuroShell — открывает окно работающего экземпляра и завершается.
// Если порт занят чужим сервисом — берёт случайный порт.
func listenURL() (net.Listener, string, error) {
        port := os.Getenv("NS_PORT")
        if port == "" {
                port = strconv.Itoa(defaultPort)
        }
        listener, err := net.Listen("tcp", "127.0.0.1:"+port)
        if err == nil {
                return listener, "http://127.0.0.1:" + port + "/", nil
        }

        if isNeuroShell("127.0.0.1:" + port) {
                url := "http://127.0.0.1:" + port + "/"
                fmt.Println("NeuroShell уже запущена — открываю окно:", url)
                if !openAppWindow(url) {
                        _ = openBrowser(url)
                }
                os.Exit(0)
        }

        listener, err = net.Listen("tcp", "127.0.0.1:0")
        if err != nil {
                return nil, "", err
        }
        p := listener.Addr().(*net.TCPAddr).Port
        return listener, fmt.Sprintf("http://127.0.0.1:%d/", p), nil
}

// isNeuroShell проверяет по /__ns/ping, что по адресу отвечает наша копия.
func isNeuroShell(addr string) bool {
        c := &http.Client{Timeout: 2 * time.Second}
        resp, err := c.Get("http://" + addr + "/__ns/ping")
        if err != nil {
                return false
        }
        defer resp.Body.Close()
        b, _ := io.ReadAll(io.LimitReader(resp.Body, 64))
        return strings.TrimSpace(string(b)) == "pong"
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
        // браузерный UA: часть прокси-сервисов фильтрует не-браузерных клиентов
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

// openAppWindow открывает приложение в отдельном окне: Chromium-браузеры
// (Edge есть почти на каждом Windows) поддерживают режим --app — окно без
// вкладок и адресной строки, выглядит как самостоятельное приложение.
// Возвращает true, если окно запустить удалось.
func openAppWindow(url string) bool {
        for _, cmd := range appWindowCommands(url) {
                if err := cmd.Start(); err == nil {
                        return true
                }
        }
        return false
}

func appWindowCommands(url string) []*exec.Cmd {
        var cmds []*exec.Cmd
        add := func(exe string, args ...string) {
                if exe != "" {
                        cmds = append(cmds, exec.Command(exe, args...))
                }
        }
        args := []string{"--app=" + url, "--window-size=1240,860", "--no-first-run", "--no-default-browser-check"}
        switch runtime.GOOS {
        case "windows":
                for _, exe := range chromiumPaths() {
                        add(exe, args...)
                }
        case "darwin":
                add("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args...)
        default: // linux и прочее
                for _, exe := range []string{"chromium", "google-chrome", "chromium-browser"} {
                        add(exe, args...)
                }
        }
        return cmds
}

// chromiumPaths — существующие на этой машине пути к Edge и Chrome (Windows).
func chromiumPaths() []string {
        candidates := []string{}
        if la, err := os.UserCacheDir(); err == nil {
                // установки «для текущего пользователя»
                candidates = append(candidates,
                        filepath.Join(la, `Microsoft\Edge\Application\msedge.exe`),
                        filepath.Join(la, `Google\Chrome\Application\chrome.exe`),
                )
        }
        candidates = append(candidates,
                `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
                `C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
                `C:\Program Files\Google\Chrome\Application\chrome.exe`,
                `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
        )
        var out []string
        for _, p := range candidates {
                if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
                        out = append(out, p)
                }
        }
        return out
}

// openBrowser открывает URL в браузере по умолчанию (запасной вариант).
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

// notifyManual сообщает адрес вручную, если окно открыть не удалось.
func notifyManual(url string) {
        msg := "Не удалось открыть окно автоматически.\nОткройте в браузере адрес:\n" + url
        if runtime.GOOS == "windows" {
                messageBox(msg, "NeuroShell")
        } else {
                fmt.Println(msg)
        }
}
