#!/usr/bin/env python3
"""Build NeuroShell's single-file website from src/."""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
VERSION = "1.4.2"


def read(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


css = re.sub(r"/\*.*?\*/", "", read("style.css"), flags=re.S).strip()
body = read("body.html").strip()
bridge = read("bridge.js").strip()
monitor = read("error-monitor.js").strip()
app = read("app.js").strip()
jarvis = read("jarvis.js").strip()
queue = read("queue.js").strip()
version_script = read("version.js").strip()

FAVICON = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' "
    "fill='none' stroke='%236c8cff' stroke-width='2' stroke-linecap='round' "
    "stroke-linejoin='round'%3E%3Cpath d='M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z'/%3E"
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
<script>window.NS_RELEASE_VERSION = "@@VERSION@@";</script>
<script>
@@BRIDGE@@
</script>
<script>
@@MONITOR@@
</script>
<script>
@@APP@@
</script>
<script>
@@JARVIS@@
</script>
<script>
@@QUEUE@@
</script>
<script>
@@VERSION_SCRIPT@@
</script>
</body>
</html>
"""

replacements = {
    "@@FAVICON@@": FAVICON,
    "@@VERSION@@": VERSION,
    "@@CSS@@": css,
    "@@BODY@@": body,
    "@@BRIDGE@@": bridge,
    "@@MONITOR@@": monitor,
    "@@APP@@": app,
    "@@JARVIS@@": jarvis,
    "@@QUEUE@@": queue,
    "@@VERSION_SCRIPT@@": version_script,
}
html = TEMPLATE
for marker, value in replacements.items():
    html = html.replace(marker, value)

for out in (ROOT / "index.html", ROOT / "internal" / "site" / "index.html"):
    out.write_text(html, encoding="utf-8")
print(f"OK: NeuroShell {VERSION} built ({len(html):,} bytes)")
