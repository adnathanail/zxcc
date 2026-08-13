#!/usr/bin/env python3
"""Dev server for the zxcc demo.

Serves demo/ at the root so http://127.0.0.1:8000/ shows the demo, and
maps /dist/* to the sibling dist/ directory so the bundle built by
`npm run build` is reachable without a symlink.
"""

from __future__ import annotations

import http.server
import os
import socketserver
import sys
from pathlib import Path

PORT = 8000
HOST = "127.0.0.1"

ROOT = Path(__file__).resolve().parent.parent
DEMO_DIR = ROOT / "demo"
DIST_DIR = ROOT / "dist"


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        # Route /dist/* to the project's dist/ directory; everything
        # else is served from demo/.
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean == "/dist" or clean.startswith("/dist/"):
            rel = clean[len("/dist") :].lstrip("/")
            return str(DIST_DIR / rel)
        return super().translate_path(path)


def main() -> int:
    if not DIST_DIR.exists():
        sys.stderr.write(
            f"warning: {DIST_DIR} does not exist — run `npm run build` first.\n"
        )
    os.chdir(DEMO_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
        print(f"Serving zxcc demo at http://{HOST}:{PORT}/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
