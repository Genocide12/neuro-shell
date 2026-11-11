# Release candidate 1.4.1

This release candidate contains source changes for desktop proxy diagnostics/connection reuse, an error monitor that keeps only sanitized metadata, voice transcript deduplication and persistent user-controlled voice capture, bottom-pinned scrolling, and queued plain-text messages during generation.

## Build status

**Not yet verified.** Do not install or announce this as a stable release until the CI workflow passes JavaScript syntax validation, site generation, Go tests, and Windows cross-compilation. Release publication remains gated on a `v*` tag and a successful build workflow.

## Expected behavior

- Voice capture is user-started and remains active until the user toggles it off, unless browser permission is revoked or the recognition service fails.
- Previously finalized speech segments are deduplicated when the browser restarts its recognition session.
- Text messages sent during an active completion are queued; attachments are intentionally not queued in this first implementation.
- API POST requests are not automatically retried after TLS/network failures, to avoid duplicate generations or charges.
- Desktop proxy uses a shared HTTP transport and a 30-second TLS-handshake timeout; connection failures return 502 and a non-secret diagnostic category.

## Remaining release checks

1. Confirm CI result and fix any failures.
2. Test a real SSE response and a simulated TLS-handshake timeout with a local test server.
3. Test continuous speech in supported desktop browsers and confirm one spoken phrase appears once.
4. Test queue drain ordering, errors during a queued send, and the stop-generation button.
5. Only then create/publish the version tag and provide the generated Windows executable.
