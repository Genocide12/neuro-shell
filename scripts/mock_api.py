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

# Ответ после того, как инструмент вернул результат (для теста режима агента)
REPLY_AFTER_TOOLS = (
    "Готово — я вызвал инструмент и получил результат:\n\n"
    "```text\n{tool_result}\n```\n\n"
    "Цикл «модель → инструмент → модель» работает."
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

        messages = req.get("messages", [])
        has_tools = bool(req.get("tools"))
        tool_results = [m for m in messages if m.get("role") == "tool"]
        prompt_tokens = sum(len(str(m.get("content", ""))) for m in messages) // 4 + 7

        # Режим агента: первый запрос с tools → просим вызвать инструмент;
        # когда результаты вернулись — обычный текстовый ответ.
        # Если среди инструментов есть fs_drives — включён режим «весь
        # компьютер»: спрашиваем диски; иначе листаем рабочую папку.
        if has_tools and not tool_results:
            completion_tokens = 30
            tool_names = [t.get("function", {}).get("name", "") for t in req.get("tools", [])]
            if "fs_drives" in tool_names:
                call_name, call_args = "fs_drives", "{}"
            else:
                call_name, call_args = "fs_list", json.dumps({"path": ""}, ensure_ascii=False)
            tool_call = {
                "id": "call_mock_1",
                "type": "function",
                "function": {"name": call_name, "arguments": call_args},
            }
            finish = "tool_calls"
            reply = None
        elif tool_results:
            reply = REPLY_AFTER_TOOLS.format(
                tool_result=str(tool_results[-1].get("content", ""))[:400]
            )
            completion_tokens = len(reply) // 4 + 5
            tool_call = None
            finish = "stop"
        else:
            reply = REPLY
            completion_tokens = len(REPLY) // 4 + 5
            tool_call = None
            finish = "stop"
        model = req.get("model", "mock")

        if req.get("stream"):
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()

            def sse(payload):
                data = f"data: {payload}\n\n".encode()
                self.wfile.write(f"{len(data):x}\r\n".encode() + data + b"\r\n")

            if tool_call is not None:
                # инструмент просится стримом: имя, затем аргументы кусками
                sse(json.dumps({
                    "id": "mock", "object": "chat.completion.chunk", "model": model,
                    "choices": [{"index": 0, "delta": {"tool_calls": [{
                        "index": 0, "id": tool_call["id"], "type": "function",
                        "function": {"name": tool_call["function"]["name"], "arguments": ""},
                    }]}}],
                }, ensure_ascii=False))
                args = tool_call["function"]["arguments"]
                for i in range(0, len(args), 10):
                    sse(json.dumps({
                        "id": "mock", "object": "chat.completion.chunk", "model": model,
                        "choices": [{"index": 0, "delta": {"tool_calls": [{
                            "index": 0,
                            "function": {"arguments": args[i:i+10]},
                        }]}}],
                    }, ensure_ascii=False))
                    time.sleep(0.01)
            else:
                chunks = [reply[i:i+40] for i in range(0, len(reply), 40)]
                for piece in chunks:
                    sse(json.dumps(
                        {"id": "mock", "object": "chat.completion.chunk", "model": model,
                         "choices": [{"index": 0, "delta": {"content": piece}}]},
                        ensure_ascii=False,
                    ))
                    time.sleep(0.01)
            # последний чанк — фактический расход токенов
            sse(json.dumps({
                "id": "mock", "object": "chat.completion.chunk", "model": model,
                "choices": [{"index": 0, "delta": {}, "finish_reason": finish}],
                "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens,
                          "total_tokens": prompt_tokens + completion_tokens},
            }))
            self.wfile.write(b"0\r\n\r\n")
        else:
            message = {"role": "assistant", "content": reply}
            if tool_call is not None:
                message = {"role": "assistant", "content": "", "tool_calls": [tool_call]}
            body = json.dumps({
                "id": "mock", "object": "chat.completion", "model": model,
                "choices": [{"index": 0, "message": message, "finish_reason": finish}],
                "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens,
                          "total_tokens": prompt_tokens + completion_tokens},
            }, ensure_ascii=False).encode()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("[mock] " + fmt % args + "\n")


if __name__ == "__main__":
    print(f"Мок API: http://127.0.0.1:{PORT}/v1  (Ctrl+C — остановить)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
