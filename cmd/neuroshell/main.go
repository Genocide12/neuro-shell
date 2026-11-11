// ===== NeuroShell :: desktop wrapper =====
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

var version = "1.4.3"
// Use a version-specific port so a new EXE can't accidentally attach to an old process.
const defaultPort = 8949

var proxyClient = &http.Client{
	Timeout: 0,
	Transport: &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{Timeout: 30 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2: true,
		MaxIdleConns: 100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout: 90 * time.Second,
		TLSHandshakeTimeout: 30 * time.Second,
		ExpectContinueTimeout: time.Second,
	},
}

func main() {
	mux := http.NewServeMux()
	var lastBeat int64
	mux.HandleFunc("/__ns/ping", func(w http.ResponseWriter, r *http.Request) { atomic.StoreInt64(&lastBeat, time.Now().Unix()); w.Header().Set("Content-Type", "text/plain"); _, _ = w.Write([]byte("pong")) })
	mux.HandleFunc("/__ns/exit", func(w http.ResponseWriter, r *http.Request) { w.Header().Set("Content-Type", "text/plain"); _, _ = w.Write([]byte("bye")); go func(){ time.Sleep(300*time.Millisecond); os.Exit(0) }() })
	mux.HandleFunc("/__ns/proxy", nsProxy)
	registerAgentAPI(mux)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { w.Header().Set("Content-Type", "text/html; charset=utf-8"); w.Header().Set("Cache-Control", "no-store"); _, _ = w.Write(site.IndexHTML()) })
	listener, url, err := listenURL(); if err != nil { log.Fatal("listen:", err) }
	server := &http.Server{Handler:mux, ReadHeaderTimeout:10*time.Second, IdleTimeout:2*time.Minute}
	go func(){ if err:=server.Serve(listener); err!=nil && err!=http.ErrServerClosed { log.Fatal(err) } }()
	fmt.Printf("NeuroShell %s — сервер запущен: %s\n", version, url)
	if !openAppWindow(url) { if err:=openBrowser(url); err!=nil { notifyManual(url) } }
	deadline:=time.Now().Add(10*time.Minute)
	for { time.Sleep(2*time.Second); beat:=atomic.LoadInt64(&lastBeat); if beat==0 && time.Now().After(deadline){return}; if beat!=0 && time.Now().Unix()-beat>25{return} }
}

func listenURL() (net.Listener, string, error) {
	port:=os.Getenv("NS_PORT"); if port=="" { port=strconv.Itoa(defaultPort) }
	ln,err:=net.Listen("tcp","127.0.0.1:"+port); if err==nil{return ln,"http://127.0.0.1:"+port+"/",nil}
	if isNeuroShell("127.0.0.1:"+port){url:="http://127.0.0.1:"+port+"/";if !openAppWindow(url){_ = openBrowser(url)};os.Exit(0)}
	ln,err=net.Listen("tcp","127.0.0.1:0");if err!=nil{return nil,"",err};p:=ln.Addr().(*net.TCPAddr).Port
	return ln,fmt.Sprintf("http://127.0.0.1:%d/",p),nil
}
func isNeuroShell(addr string) bool { c:=&http.Client{Timeout:2*time.Second};resp,err:=c.Get("http://"+addr+"/__ns/ping");if err!=nil{return false};defer resp.Body.Close();b,_:=io.ReadAll(io.LimitReader(resp.Body,64));return strings.TrimSpace(string(b))=="pong" }

func nsProxy(w http.ResponseWriter,r *http.Request){
	target:=r.URL.Query().Get("url");if target==""{http.Error(w,"missing url",http.StatusBadRequest);return};if !strings.HasPrefix(target,"http://")&&!strings.HasPrefix(target,"https://"){http.Error(w,"bad url",http.StatusBadRequest);return}
	body,err:=io.ReadAll(io.LimitReader(r.Body,64<<20));if err!=nil{http.Error(w,"could not read request body",http.StatusBadRequest);return}
	req,err:=http.NewRequestWithContext(r.Context(),r.Method,target,bytes.NewReader(body));if err!=nil{http.Error(w,"bad request",http.StatusBadRequest);return}
	req.Header.Set("Content-Type","application/json");req.Header.Set("Accept","application/json, text/event-stream, */*")
	if auth:=r.Header.Get("X-NS-Authorization");auth!=""{req.Header.Set("Authorization",auth)};if key:=r.Header.Get("X-NS-X-Api-Key");key!=""{req.Header.Set("x-api-key",key)}
	req.Header.Set("User-Agent","Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 NeuroShell/"+version)
	resp,err:=proxyClient.Do(req);if err!=nil{w.Header().Set("Content-Type","text/plain; charset=utf-8");w.Header().Set("X-NS-Error","upstream_connection");http.Error(w,"Upstream connection failed: "+err.Error(),http.StatusBadGateway);return};defer resp.Body.Close()
	for _,h:=range []string{"Content-Type","Cache-Control","X-Request-Id","Request-Id"}{if v:=resp.Header.Get(h);v!=""{w.Header().Set(h,v)}};w.Header().Set("X-NS-Status",strconv.Itoa(resp.StatusCode));w.WriteHeader(resp.StatusCode);_,_=io.Copy(w,resp.Body)
}

func openAppWindow(url string) bool { for _,cmd:=range appWindowCommands(url){if cmd.Start()==nil{return true}};return false }
func appWindowCommands(url string) []*exec.Cmd { var cmds []*exec.Cmd;add:=func(exe string,args ...string){if exe!=""{cmds=append(cmds,exec.Command(exe,args...))}};args:=[]string{"--app="+url,"--window-size=1240,860","--no-first-run","--no-default-browser-check"};switch runtime.GOOS{case "windows":for _,exe:=range chromiumPaths(){add(exe,args...)};case "darwin":add("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",args...);default:for _,exe:=range []string{"chromium","google-chrome","chromium-browser"}{add(exe,args...)}};return cmds }
func chromiumPaths() []string { c:=[]string{};if la,err:=os.UserCacheDir();err==nil{c=append(c,filepath.Join(la,`Microsoft\Edge\Application\msedge.exe`),filepath.Join(la,`Google\Chrome\Application\chrome.exe`))};c=append(c,`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,`C:\Program Files\Google\Chrome\Application\chrome.exe`,`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`);var out []string;for _,p:=range c{if fi,err:=os.Stat(p);err==nil&&!fi.IsDir(){out=append(out,p)}};return out }
func openBrowser(url string) error { var cmd *exec.Cmd;switch runtime.GOOS{case "windows":cmd=exec.Command("rundll32","url.dll,FileProtocolHandler",url);case "darwin":cmd=exec.Command("open",url);default:cmd=exec.Command("xdg-open",url)};return cmd.Start() }
func notifyManual(url string){msg:="Не удалось открыть окно автоматически.\nОткройте в браузере адрес:\n"+url;if runtime.GOOS=="windows"{messageBox(msg,"NeuroShell")}else{fmt.Println(msg)}}
