// ===== NeuroShell :: инструменты агента (файлы + GitHub) =====
// Локальные эндпоинты, через которые ИИ в чате работает с файлами
// компьютера и скачивает репозитории с GitHub:
//
//	POST /__ns/fs/home    — путь к домашней папке пользователя
//	POST /__ns/fs/drives  — диски компьютера и домашняя папка (навигация с корня)
//	POST /__ns/fs/list    — содержимое папки
//	POST /__ns/fs/read    — прочитать файл
//	POST /__ns/fs/write   — записать файл
//	POST /__ns/fs/mkdir   — создать папку
//	POST /__ns/fs/delete  — удалить файл/папку
//	POST /__ns/fs/move    — переименовать/переместить
//	POST /__ns/fs/search  — поиск файлов по имени
//	POST /__ns/gh/clone   — скачать репозиторий GitHub в папку
//
// Два режима доступа (поле "full" в запросе):
//   - рабочая папка (по умолчанию): все пути обязаны лежать внутри
//     папки root, заданной пользователем; выход наружу через .. или
//     симлинки запрещён;
//   - весь компьютер (full:true): модель работает с любыми абсолютными
//     путями всех дисков — как обычная программа; включается осознанно
//     в настройках, подтверждение не требуется для чтения, но системный
//     промпт обязывает модель спрашивать перед удалением/перезаписью.
//
// Безопасность:
//   - каждый запрос должен нести заголовок X-NS-Agent — он заставляет браузер
//     делать preflight, поэтому сторонний сайт не сможет отправить запрос
//     «вслепую» (защита от drive-by);
//   - при наличии заголовка Origin он должен совпадать с адресом приложения;
//   - размеры ограничены (чтение 2 МБ, запись 8 МБ, списки и поиск — лимит).
package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	fsMaxRead  = 2 << 20 // 2 МБ на чтение файла
	fsMaxWrite = 8 << 20 // 8 МБ на запись файла
	fsMaxList  = 1000    // максимум записей в списке папки
	fsMaxFind  = 200     // максимум результатов поиска
)

// registerAgentAPI подключает файловые и GitHub-инструменты к мультиплексору.
func registerAgentAPI(mux *http.ServeMux) {
	mux.HandleFunc("/__ns/fs/", func(w http.ResponseWriter, r *http.Request) {
		if !agentGuard(w, r) {
			return
		}
		switch strings.TrimPrefix(r.URL.Path, "/__ns/fs/") {
		case "home":
			fsHome(w, r)
		case "drives":
			fsDrives(w, r)
		case "list":
			fsList(w, r)
		case "read":
			fsRead(w, r)
		case "write":
			fsWrite(w, r)
		case "mkdir":
			fsMkdir(w, r)
		case "delete":
			fsDelete(w, r)
		case "move":
			fsMove(w, r)
		case "search":
			fsSearch(w, r)
		default:
			http.Error(w, "unknown fs endpoint", http.StatusNotFound)
		}
	})
	mux.HandleFunc("/__ns/gh/clone", func(w http.ResponseWriter, r *http.Request) {
		if !agentGuard(w, r) {
			return
		}
		ghClone(w, r)
	})
}

// agentGuard проверяет защиту эндпоинтов инструментов: метод, заголовок
// X-NS-Agent и (если браузер его прислал) Origin. Возвращает false, если
// запрос отклонён.
func agentGuard(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return false
	}
	if r.Header.Get("X-NS-Agent") != "1" {
		http.Error(w, "X-NS-Agent header required", http.StatusForbidden)
		return false
	}
	if o := r.Header.Get("Origin"); o != "" {
		if o != "http://"+r.Host && o != "https://"+r.Host {
			http.Error(w, "cross-origin denied", http.StatusForbidden)
			return false
		}
	}
	return true
}

// ---- вспомогательные: разбор JSON и ответы ----

func readJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	b, err := io.ReadAll(io.LimitReader(r.Body, fsMaxWrite+1<<20))
	if err != nil {
		return err
	}
	if len(b) > fsMaxWrite+(1<<20) {
		return errors.New("тело запроса слишком большое")
	}
	return json.Unmarshal(b, dst)
}

func jsonOK(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(payload)
}

func jsonErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]any{"error": msg})
}

// ---- разрешение путей: два режима доступа ----

// fsScope — рамки доступа текущего запроса. full=true открывает весь
// компьютер (абсолютные пути любых дисков), иначе действует граница
// рабочей папки root — как в прежних версиях.
type fsScope struct {
	full      bool
	root      string
	rootGiven bool
}

// newScope разбирает запрос и возвращает рамки доступа.
func newScope(q fsReq) (fsScope, error) {
	if q.Full {
		return fsScope{full: true}, nil
	}
	root, err := fsRoot(q.Root)
	if err != nil {
		return fsScope{}, err
	}
	return fsScope{root: root, rootGiven: true}, nil
}

// resolve превращает путь запроса в абсолютный путь на диске.
// Режим full — любой абсолютный путь компьютера; режим папки —
// путь внутри рабочей папки (выход через .. и симлинки запрещён).
func (sc fsScope) resolve(p string) (string, error) {
	p = strings.TrimSpace(p)
	if sc.full {
		if p == "" || p == "." {
			home, _ := os.UserHomeDir()
			return "", errors.New("в режиме «весь компьютер» укажите абсолютный путь (например C:\\Users\\Gennadiy\\Desktop или /home/user); домашняя папка: " + home)
		}
		if !filepath.IsAbs(p) {
			return "", errors.New("в режиме «весь компьютер» путь должен быть абсолютным (C:\\… или /…): " + p)
		}
		return filepath.Clean(p), nil
	}
	return fsPath(sc.root, p)
}

// fsRoot проверяет и возвращает чистый абсолютный путь рабочей папки.
func fsRoot(root string) (string, error) {
	root = strings.TrimSpace(root)
	if root == "" {
		return "", errors.New("рабочая папка не задана: укажите её в настройках (Инструменты → Рабочая папка)")
	}
	if !filepath.IsAbs(root) {
		return "", errors.New("рабочая папка должна быть абсолютным путём (например, C:\\Users\\Gennadiy\\Desktop\\Next Claud)")
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	// каталог должен существовать и быть папкой
	fi, err := os.Stat(abs)
	if err != nil {
		return "", errors.New("рабочая папка недоступна: " + err.Error())
	}
	if !fi.IsDir() {
		return "", errors.New("рабочая папка — не каталог: " + abs)
	}
	return abs, nil
}

// fsPath надёжно склеивает root и вложенный путь, не выпуская за пределы root.
// Пустой sub означает саму рабочую папку. Проверяются и симлинки.
func fsPath(root, sub string) (string, error) {
	sub = strings.TrimSpace(sub)
	if sub == "" || sub == "." {
		return root, nil
	}
	// абсолютный вложенный путь допустим, только если он уже внутри root
	joined := sub
	if !filepath.IsAbs(joined) {
		joined = filepath.Join(root, sub)
	}
	abs, err := filepath.Abs(joined)
	if err != nil {
		return "", err
	}
	// без выхода за корень (…, "..", и т.п.)
	if abs != root && !strings.HasPrefix(filepath.ToSlash(abs)+"/", filepath.ToSlash(root)+"/") {
		return "", errors.New("путь вне рабочей папки: " + sub)
	}
	// симлинки не должны уводить наружу
	if real, err := filepath.EvalSymlinks(abs); err == nil {
		if real != root && !strings.HasPrefix(filepath.ToSlash(real)+"/", filepath.ToSlash(root)+"/") {
			return "", errors.New("путь (симлинк) ведёт вне рабочей папки: " + sub)
		}
		return real, nil
	}
	return abs, nil
}

// ---- эндпоинты ----

type fsReq struct {
	Root    string `json:"root"`
	Full    bool   `json:"full"` // режим «весь компьютер» (без границы папки)
	Path    string `json:"path"`
	From    string `json:"from"`
	To      string `json:"to"`
	Content string `json:"content"`
	Pattern string `json:"pattern"`
}

// fsHome — путь к домашней папке (кнопка «Домашняя папка» в настройках).
func fsHome(w http.ResponseWriter, r *http.Request) {
	h, err := os.UserHomeDir()
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, "не удалось определить домашнюю папку: "+err.Error())
		return
	}
	jsonOK(w, map[string]any{"home": h})
}

// fsDrives — диски компьютера (Windows) или корень «/» (Unix) и домашняя
// папка. Точка входа модели в режим «весь компьютер».
func fsDrives(w http.ResponseWriter, r *http.Request) {
	var drives []string
	if runtime.GOOS == "windows" {
		for c := 'A'; c <= 'Z'; c++ {
			vol := string(c) + ":\\"
			if fi, err := os.Stat(vol); err == nil && fi.IsDir() {
				drives = append(drives, vol)
			}
		}
	} else {
		drives = []string{"/"}
	}
	home, _ := os.UserHomeDir()
	jsonOK(w, map[string]any{"drives": drives, "home": home})
}

// fsList — содержимое папки: имя, размер, признак каталога, изменение.
func fsList(w http.ResponseWriter, r *http.Request) {
	var q fsReq
	if err := readJSON(r, &q); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad json: "+err.Error())
		return
	}
	sc, err := newScope(q)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	dir, err := sc.resolve(q.Path)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	fi, err := os.Stat(dir)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "не удалось открыть папку: "+err.Error())
		return
	}
	if !fi.IsDir() {
		jsonErr(w, http.StatusBadRequest, "это не папка, а файл: "+q.Path)
		return
	}
	ents, err := os.ReadDir(dir)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, "не удалось прочитать папку: "+err.Error())
		return
	}
	type entry struct {
		Name string `json:"name"`
		Dir  bool   `json:"dir"`
		Size int64  `json:"size"`
		Mod  string `json:"mod"`
	}
	list := make([]entry, 0, len(ents))
	trunc := false
	for _, e := range ents {
		if len(list) >= fsMaxList {
			trunc = true
			break
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		list = append(list, entry{
			Name: e.Name(),
			Dir:  e.IsDir(),
			Size: info.Size(),
			Mod:  info.ModTime().Format("2006-01-02 15:04"),
		})
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Dir != list[j].Dir {
			return list[i].Dir
		}
		return strings.ToLower(list[i].Name) < strings.ToLower(list[j].Name)
	})
	jsonOK(w, map[string]any{"path": q.Path, "entries": list, "truncated": trunc})
}

// fsRead — прочитать текстовый файл (до 2 МБ).
func fsRead(w http.ResponseWriter, r *http.Request) {
	var q fsReq
	if err := readJSON(r, &q); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad json: "+err.Error())
		return
	}
	sc, err := newScope(q)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	p, err := sc.resolve(q.Path)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	fi, err := os.Stat(p)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "файл не найден: "+err.Error())
		return
	}
	if fi.IsDir() {
		jsonErr(w, http.StatusBadRequest, "это папка, а не файл: "+q.Path)
		return
	}
	if fi.Size() > 50<<20 {
		jsonErr(w, http.StatusBadRequest, "файл слишком большой (более 50 МБ)")
		return
	}
	b, err := os.ReadFile(p)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, "не удалось прочитать: "+err.Error())
		return
	}
	truncated := false
	if len(b) > fsMaxRead {
		b = b[:fsMaxRead]
		truncated = true
	}
	if !utf8.Valid(b) {
		jsonOK(w, map[string]any{
			"binary":    true,
			"size":      fi.Size(),
			"truncated": truncated,
			"content":   "(бинарный файл — содержимое не показано; размер " + fmt.Sprintf("%d", fi.Size()) + " байт)",
		})
		return
	}
	jsonOK(w, map[string]any{"content": string(b), "size": fi.Size(), "truncated": truncated})
}

// fsWrite — создать/перезаписать файл (создавая недостающие папки).
func fsWrite(w http.ResponseWriter, r *http.Request) {
	var q fsReq
	if err := readJSON(r, &q); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad json: "+err.Error())
		return
	}
	sc, err := newScope(q)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	p, err := sc.resolve(q.Path)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(q.Content) > fsMaxWrite {
		jsonErr(w, http.StatusBadRequest, "контент больше 8 МБ")
		return
	}
	if sc.rootGiven && p == sc.root {
		jsonErr(w, http.StatusBadRequest, "нужен путь файла, а не рабочей папки")
		return
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		jsonErr(w, http.StatusInternalServerError, "не удалось создать папку: "+err.Error())
		return
	}
	if err := os.WriteFile(p, []byte(q.Content), 0o644); err != nil {
		jsonErr(w, http.StatusInternalServerError, "не удалось записать: "+err.Error())
		return
	}
	jsonOK(w, map[string]any{"path": q.Path, "bytes": len(q.Content)})
}

// fsMkdir — создать папку (вложенность допустима).
func fsMkdir(w http.ResponseWriter, r *http.Request) {
	var q fsReq
	if err := readJSON(r, &q); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad json: "+err.Error())
		return
	}
	sc, err := newScope(q)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	p, err := sc.resolve(q.Path)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := os.MkdirAll(p, 0o755); err != nil {
		jsonErr(w, http.StatusInternalServerError, "не удалось создать папку: "+err.Error())
		return
	}
	jsonOK(w, map[string]any{"path": q.Path})
}

// fsDelete — удалить файл или папку (папку — рекурсивно).
func fsDelete(w http.ResponseWriter, r *http.Request) {
	var q fsReq
	if err := readJSON(r, &q); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad json: "+err.Error())
		return
	}
	sc, err := newScope(q)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	p, err := sc.resolve(q.Path)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if sc.rootGiven && p == sc.root {
		jsonErr(w, http.StatusBadRequest, "нельзя удалить саму рабочую папку")
		return
	}
	if _, err := os.Stat(p); err != nil {
		jsonErr(w, http.StatusNotFound, "не найдено: "+err.Error())
		return
	}
	if err := os.RemoveAll(p); err != nil {
		jsonErr(w, http.StatusInternalServerError, "не удалось удалить: "+err.Error())
		return
	}
	jsonOK(w, map[string]any{"deleted": q.Path})
}

// fsMove — переименовать/переместить файл или папку.
func fsMove(w http.ResponseWriter, r *http.Request) {
	var q fsReq
	if err := readJSON(r, &q); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad json: "+err.Error())
		return
	}
	sc, err := newScope(q)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	from, err := sc.resolve(q.From)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	to, err := sc.resolve(q.To)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if sc.rootGiven && (from == sc.root || to == sc.root) {
		jsonErr(w, http.StatusBadRequest, "нельзя двигать саму рабочую папку")
		return
	}
	if _, err := os.Stat(from); err != nil {
		jsonErr(w, http.StatusNotFound, "источник не найден: "+err.Error())
		return
	}
	if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
		jsonErr(w, http.StatusInternalServerError, "не удалось создать целевую папку: "+err.Error())
		return
	}
	if err := os.Rename(from, to); err != nil {
		jsonErr(w, http.StatusInternalServerError, "не удалось переместить: "+err.Error())
		return
	}
	jsonOK(w, map[string]any{"from": q.From, "to": q.To})
}

// fsSearch — поиск файлов по подстроке в имени (без учёта регистра),
// с обходом вложенных папок. Служебные каталоги (.git, node_modules, …)
// пропускаются. В режиме «весь компьютер» без path поиск идёт от
// домашней папки; предохранитель — 10 секунд на обход.
func fsSearch(w http.ResponseWriter, r *http.Request) {
	var q fsReq
	if err := readJSON(r, &q); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad json: "+err.Error())
		return
	}
	sc, err := newScope(q)
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	start := ""
	if strings.TrimSpace(q.Path) != "" {
		start, err = sc.resolve(q.Path)
		if err != nil {
			jsonErr(w, http.StatusBadRequest, err.Error())
			return
		}
	} else if sc.full {
		// весь компьютер без точки старта — ищем от домашней папки
		home, herr := os.UserHomeDir()
		if herr != nil {
			jsonErr(w, http.StatusInternalServerError, "не удалось определить домашнюю папку: "+herr.Error())
			return
		}
		start = home
	} else {
		start = sc.root
	}
	pattern := strings.ToLower(strings.TrimSpace(q.Pattern))
	if pattern == "" {
		jsonErr(w, http.StatusBadRequest, "задан пустой шаблон поиска")
		return
	}
	skip := map[string]bool{".git": true, "node_modules": true, "__pycache__": true, ".venv": true, "venv": true, "$RECYCLE.BIN": true, "System Volume Information": true}
	type hit struct {
		Path string `json:"path"`
		Dir  bool   `json:"dir"`
		Size int64  `json:"size"`
	}
	var hits []hit
	truncated := false
	deadline := time.Now().Add(10 * time.Second) // предохранитель от огромных деревьев
	var walk func(dir, rel string) error
	walk = func(dir, rel string) error {
		if truncated {
			return nil
		}
		if time.Now().After(deadline) {
			truncated = true
			return nil
		}
		ents, err := os.ReadDir(dir)
		if err != nil {
			return nil // нет доступа — просто пропускаем
		}
		for _, e := range ents {
			if truncated {
				return nil
			}
			if skip[e.Name()] {
				continue
			}
			relPath := e.Name()
			if rel != "" {
				relPath = rel + string(filepath.Separator) + e.Name()
			}
			if strings.Contains(strings.ToLower(e.Name()), pattern) {
				var size int64
				if info, err := e.Info(); err == nil {
					size = info.Size()
				}
				hits = append(hits, hit{Path: relPath, Dir: e.IsDir(), Size: size})
				if len(hits) >= fsMaxFind {
					truncated = true
					return nil
				}
			}
			if e.IsDir() {
				_ = walk(filepath.Join(dir, e.Name()), relPath)
			}
		}
		return nil
	}
	_ = walk(start, "")
	jsonOK(w, map[string]any{"path": q.Path, "scanned": start, "results": hits, "truncated": truncated})
}

// ghClone — скачать репозиторий GitHub (zip-архив) и распаковать его
// в папку на компьютере. Приватные репозитории — с токеном. Ветка по
// умолчанию main, при 404 пробуется master. В режиме «весь компьютер»
// dest может быть абсолютным путём; относительное имя создаётся в
// домашней папке.
func ghClone(w http.ResponseWriter, r *http.Request) {
	var q struct {
		Root  string `json:"root"`
		Full  bool   `json:"full"`  // режим «весь компьютер»
		Repo  string `json:"repo"`  // "owner/name"
		Ref   string `json:"ref"`   // ветка или тег, по умолчанию main
		Token string `json:"token"` // GitHub PAT (для приватных репо)
		Dest  string `json:"dest"`  // куда распаковать (абсолютный путь или имя подпапки)
	}
	if err := readJSON(r, &q); err != nil {
		jsonErr(w, http.StatusBadRequest, "bad json: "+err.Error())
		return
	}
	sc, err := newScope(fsReq{Root: q.Root, Full: q.Full})
	if err != nil {
		jsonErr(w, http.StatusBadRequest, err.Error())
		return
	}
	repo := strings.TrimPrefix(strings.TrimSuffix(strings.TrimSpace(q.Repo), "/"), "https://github.com/")
	repo = strings.TrimPrefix(repo, "http://github.com/")
	if parts := strings.Split(repo, "/"); len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		jsonErr(w, http.StatusBadRequest, "репозиторий задаётся как «владелец/имя», например Genocide12/neuro-shell")
		return
	} else {
		repo = parts[0] + "/" + parts[1]
	}
	ref := strings.TrimSpace(q.Ref)
	if ref == "" {
		ref = "main"
	}
	dest := strings.TrimSpace(q.Dest)
	if dest == "" {
		dest = strings.Split(repo, "/")[1]
	}
	var destPath string
	if sc.full {
		if filepath.IsAbs(dest) {
			destPath = filepath.Clean(dest)
		} else {
			home, herr := os.UserHomeDir()
			if herr != nil {
				jsonErr(w, http.StatusInternalServerError, "не удалось определить домашнюю папку: "+herr.Error())
				return
			}
			destPath = filepath.Join(home, dest)
		}
	} else {
		destPath, err = fsPath(sc.root, dest)
		if err != nil {
			jsonErr(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	if _, err := os.Stat(destPath); err == nil {
		jsonErr(w, http.StatusConflict, "папка уже существует: "+dest+" — выберите другое имя (dest)")
		return
	}

	zipBytes, usedRef, err := downloadRepoZip(repo, ref, q.Token)
	if err != nil {
		jsonErr(w, http.StatusBadGateway, "не удалось скачать архив: "+err.Error())
		return
	}

	files, err := extractZipTo(zipBytes, destPath)
	if err != nil {
		_ = os.RemoveAll(destPath) // не оставляем половину распакованного
		jsonErr(w, http.StatusInternalServerError, "не удалось распаковать: "+err.Error())
		return
	}
	jsonOK(w, map[string]any{"dest": dest, "destPath": destPath, "ref": usedRef, "files": files})
}

// downloadRepoZip тянет zipball через api.github.com (работает и для
// приватных репозиториев с токеном). При 404 для main пробует master.
func downloadRepoZip(repo, ref, token string) ([]byte, string, error) {
	tryRef := func(ref string) ([]byte, error) {
		url := "https://api.github.com/repos/" + repo + "/zipball/" + ref
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "NeuroShell/"+version)
		req.Header.Set("Accept", "application/vnd.github+json")
		if strings.TrimSpace(token) != "" {
			req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(token))
		}
		client := &http.Client{Timeout: 5 * time.Minute}
		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound {
			return nil, os.ErrNotExist
		}
		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(io.LimitReader(resp.Body, 400))
			return nil, fmt.Errorf("GitHub API: HTTP %d %s", resp.StatusCode, strings.TrimSpace(string(b)))
		}
		return io.ReadAll(io.LimitReader(resp.Body, 512<<20)) // до 512 МБ
	}
	b, err := tryRef(ref)
	if errors.Is(err, os.ErrNotExist) && ref == "main" {
		if b2, err2 := tryRef("master"); err2 == nil {
			return b2, "master", nil
		}
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, ref, err
	}
	if err != nil {
		return nil, ref, fmt.Errorf("ветка/тег «%s» не найдены (попробуйте указать ref)", ref)
	}
	return b, ref, nil
}

// extractZipTo распаковывает архив в dst, снимая корневую папку архивов
// GitHub («repo-ref/…») и защищаясь от zip-slip.
func extractZipTo(zipBytes []byte, dst string) (int, error) {
	zr, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		return 0, err
	}
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return 0, err
	}
	// имя корневой папки в архиве (до первого «/»)
	var prefix string
	for _, f := range zr.File {
		if i := strings.IndexByte(f.Name, '/'); i > 0 {
			prefix = f.Name[:i+1]
			break
		}
	}
	files := 0
	for _, f := range zr.File {
		name := strings.TrimPrefix(strings.ReplaceAll(f.Name, "\\", "/"), prefix)
		if name == "" {
			continue
		}
		target := filepath.Join(dst, filepath.FromSlash(name))
		if !strings.HasPrefix(filepath.ToSlash(target)+"/", filepath.ToSlash(dst)+"/") {
			return files, fmt.Errorf("недопустимый путь в архиве: %s", f.Name) // zip-slip
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return files, err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return files, err
		}
		rc, err := f.Open()
		if err != nil {
			return files, err
		}
		out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
		if err != nil {
			rc.Close()
			return files, err
		}
		if _, err := io.Copy(out, io.LimitReader(rc, 256<<20)); err != nil { // до 256 МБ на файл
			rc.Close()
			out.Close()
			return files, err
		}
		rc.Close()
		out.Close()
		files++
	}
	return files, nil
}
