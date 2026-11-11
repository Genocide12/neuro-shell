#!/usr/bin/env python3
"""NeuroShell :: сборка одностраничного index.html из исходников src/.

Запуск:  python3 scripts/build_site.py
Результат пишется в index.html в корне репозитория (его же отдаёт
GitHub Pages и встраивает в exe команда go:embed).
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"


def read(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


css = re.sub(r"/\*.*?\*/", "", read("style.css"), flags=re.S).strip()  # без комментариев
body = read("body.html").strip()
bridge = read("bridge.js").strip()
app = read("app.js").strip()

FAVICON = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' "
    "fill='none' stroke='%236c8cff' stroke-width='2' stroke-linecap='round' "
    "stroke-linejoin='round'%3E%3Cpath d='M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z'/%3E"
    "%3Cpath d='M9 12h.01M15 12h.01M9 16c.6.7 1.8 1 3 1s2.4-.3 3-1'/%3E%3C/svg%3E"
)

TEMPLATE = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>NeuroShell — красивая оболочка для вашего API</title>
<meta name="description" content="Лёгкий графический интерфейс для OpenAI-совместимых API: чат со стримингом, артефакты, цены на токены, несколько профилей инструкций. Один HTML-файл, всё локально.">
<link rel="icon" href="@@FAVICON@@">
<style>
@@CSS@@
</style>
</head>
<body>
@@BODY@@

<script>
@@BRIDGE@@
</script>
<script>
@@APP@@
</script>
</body>
</html>
"""

html = TEMPLATE
html = html.replace("@@FAVICON@@", FAVICON)
html = html.replace("@@CSS@@", css)
html = html.replace("@@BODY@@", body)
html = html.replace("@@BRIDGE@@", bridge)
html = html.replace("@@APP@@", app)

# Пишем обе копии: корневой index.html отдаёт GitHub Pages,
# а internal/site/index.html встраивается в exe (go:embed).
for out in (ROOT / "index.html", ROOT / "internal" / "site" / "index.html"):
    out.write_text(html, encoding="utf-8")
print(f"OK: index.html собран ({len(html):,} байт) -> корень + internal/site")
