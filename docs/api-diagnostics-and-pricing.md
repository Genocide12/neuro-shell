# API diagnostics and pricing discovery

## Scope and safety

NeuroShell must never display or log API credentials. Diagnostics should report the request URL, HTTP status when a response exists, and a sanitized error category, but must redact `Authorization`, `X-API-Key`, query strings that may contain credentials, and response bodies that might echo secrets. Never infer actual billing prices from a model name or from an unrelated vendor's advertised rates.

## What the browser errors mean

- `Failed to fetch` / `NetworkError` means browser `fetch` did not expose an HTTP response. Possible causes include CORS/preflight rejection, DNS/TLS/connectivity, a blocked request, or a local proxy failure. It does not identify which cause occurred.
- HTTP `401` means an HTTP response was received and authorization was rejected. Check whether the selected provider expects `Authorization: Bearer …`, `x-api-key`, or another scheme; do not print the credential while diagnosing.
- HTTP `404` means the requested route or model was not found; verify the configured base URL and API route separately from model availability.

## Pricing discovery for api.gym-rat.online

Do not assume that `/v1/models` includes prices. The current client can parse pricing fields when the server returns them, but many OpenAI-compatible model-list endpoints return only IDs and metadata. Implement pricing display in this order:

1. Request the configured base URL's model-list endpoint using the same credential handling as the normal API call. Redact the credential from all logs and UI errors.
2. If the response has documented pricing fields, normalize them to USD per million input/output tokens and label them as server-provided. Support both per-token values and already-normalized values only when the response format makes units unambiguous.
3. If the endpoint has no pricing data, show “цены не предоставляются API” and allow manual per-model prices. Do not label guesses as actual provider prices.
4. Do not probe undocumented routes or try a user's key against unrelated hosts. A provider-specific pricing endpoint must be confirmed from the provider's documentation or an explicit user-provided response sample with secrets removed.

## Diagnostics implementation checklist

- Distinguish a received HTTP status from a fetch/network exception.
- For HTTP errors, show status and a short sanitized server message where safe.
- For fetch failures, show a concise CORS/connectivity/local-proxy checklist; do not claim that the key is invalid.
- In desktop mode, state whether the request passed through the local proxy and surface proxy connection errors separately.
- Add tests for 401, 404, 429, 5xx, malformed JSON, CORS-like rejection, and successful model-list responses both with and without pricing metadata.

## Verification needed before provider-specific prices

No verified schema or live response from `api.gym-rat.online` is included in this repository. Provider-specific automatic pricing should only be implemented after verifying the API's documented endpoint/schema or inspecting a redacted sample response. Until then, manual prices are the honest fallback.
