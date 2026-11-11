# Diagnosing recurring `network error` in the desktop app

A recurring network error is not evidence by itself that the API key is invalid. HTTP 401/404 responses are different: the app received an HTTP response, while browser `Failed to fetch` usually means that it received no usable response.

## Distinguish the failure

1. Record the request timestamp, configured base URL and selected model. Never record or paste the API key, Authorization header, or full settings export.
2. In the desktop app, inspect the local proxy response/status and process lifetime. If `127.0.0.1:<port>` cannot answer `/__ns/ping`, restart/rebuild the desktop app; the web page cannot repair a stopped local proxy.
3. If the local proxy is alive, inspect its HTTP status and sanitized error body. 401 is an authorization rejection; 404 indicates route/model mismatch; 429 indicates provider throttling; 5xx indicates upstream/provider failure; a 502 proxy error points to a transport/upstream connection failure.
4. Compare the same request against the configured endpoint with the provider's supported diagnostic path. Do not retry a failed chat POST automatically: the provider may have accepted and billed the generation even if the client lost the response.
5. Check browser DevTools Network and the NeuroShell process console around the failure. Save only sanitized status, URL path, timing, and error category.

## Safe remediation

- Update/rebuild the desktop executable after source changes; GitHub Pages updates do not update an already-installed EXE.
- Ensure desktop heartbeat reaches `/__ns/ping` while the window remains open; verify local proxy process and port stability.
- Reuse a bounded HTTP transport in the Go proxy and report upstream connection failures as explicit 502 responses, without logging credentials or request bodies.
- Add regression tests for 401, 404, 429, 5xx, connection reset, proxy shutdown, slow streaming responses, and lost client connection.
- Keep automatic retries off for generation POSTs unless the provider offers idempotency keys and the app uses them. Automatic retries can double-charge.

## Current limitation

A root-cause fix needs a captured sanitized failure status and matching local-proxy logs. The generic UI message alone does not identify whether the failure is upstream connectivity, local proxy shutdown, or provider rejection.
