package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestProxyForwardsStatusAndBody(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" { t.Errorf("authorization = %q", got) }
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = io.WriteString(w, `{"error":"invalid key"}`)
	}))
	defer upstream.Close()

	proxy := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/__ns/proxy?url="+url.QueryEscape(upstream.URL+"/v1/chat/completions"), strings.NewReader(`{"model":"test"}`))
	request.Header.Set("X-NS-Authorization", "Bearer test-key")
	nsProxy(proxy, request)
	if proxy.Code != http.StatusUnauthorized { t.Fatalf("status = %d, want 401", proxy.Code) }
	if proxy.Header().Get("X-NS-Status") != "401" { t.Fatalf("X-NS-Status = %q", proxy.Header().Get("X-NS-Status")) }
	if !strings.Contains(proxy.Body.String(), "invalid key") { t.Fatalf("body = %q", proxy.Body.String()) }
}

func TestProxyRejectsMissingURL(t *testing.T) {
	proxy := httptest.NewRecorder()
	nsProxy(proxy, httptest.NewRequest(http.MethodPost, "/__ns/proxy", nil))
	if proxy.Code != http.StatusBadRequest { t.Fatalf("status = %d, want 400", proxy.Code) }
}
