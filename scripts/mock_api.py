#!/usr/bin/env python3
"""NeuroShell :: мок OpenAI-совместимого API для локальных тестов.

Запуск:  python3 scripts/mock_api.py [порт]     (по умолчанию 8788)

Отвечает на GET /v1/models и POST /v1/chat/completions (обычный и
стриминговый режим, с usage в последнем чанке). Все ответы отдаются
с CORS-заголовками, чтобы мок работал и в веб-версии приложения.
"""
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8788

MODELS = {
    "object": "list",
    "data": [
        {"id": m, "object": "model", "created": 0, "owned_by": "anthropic"}
        for m in [
            "claude-opus-5-5", "claude-opus-5", "claude-opus-4-8",
            "claude-sonnet-4-6", "claude-sonnet-4-5", "claude-haiku-4-5",
            "fable-5",
        ]
    ],
}

REPLY = (
    "Привет! Это ответ мок-сервера для проверки NeuroShell.\n\n"
    "| Модель | Вход $/1M | Выход $/1M |\n|---|---|---|\n"
    "| Opus 5.5 | 4 | 20 |\n| Sonnet 5.5 | 2 | 10 |\n\n"
    "```python\nprint('стриминг и таблицы работают')\n```"
)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path.rstrip("/").endswith("/models"):
            body = json.dumps(MODELS).encode()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", "0"))
        try:
            req = json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            self.send_error(400)
            return

        prompt_tokens = sum(len(str(m.get("content", ""))) for m in req.get("messages", [])) // 4 + 7
        completion_tokens = len(REPLY) // 4 + 5
        model = req.get("model", "mock")

        if req.get("stream"):
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            chunks = [REPLY[i:i+40] for i in range(0, len(REPLY), 40)]
            for i, piece in enumerate(chunks):
                payload = json.dumps(
                    {"id": "mock", "object": "chat.completion.chunk", "model": model,
                     "choices": [{"index": 0, "delta": {"content": piece}}]},
                    ensure_ascii=False,
                )
                self._sse(payload)
                time.sleep(0.01)
            # последний чанк — фактический расход токенов
            self._sse(json.dumps({
                "id": "mock", "object": "chat.completion.chunk", "model": model,
                "choices": [{"index": 0, "delta": {}}],
                "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens,
                          "total_tokens": prompt_tokens + completion_tokens},
            }))
            self.wfile.write(b"0\r\n\r\n")
        else:
            body = json.dumps({
                "id": "mock", "object": "chat.completion", "model": model,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": REPLY}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens,
                          "total_tokens": prompt_tokens + completion_tokens},
            }, ensure_ascii=False).encode()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def _sse(self, payload: str):
        data = f"data: {payload}\n\n".encode()
        self.wfile.write(f"{len(data):x}\r\n".encode() + data + b"\r\n")

    def log_message(self, fmt, *args):
        sys.stderr.write("[mock] " + fmt % args + "\n")


if __name__ == "__main__":
    print(f"Мок API: http://127.0.0.1:{PORT}/v1  (Ctrl+C — остановить)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
