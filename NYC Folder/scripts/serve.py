"""Serve the site with caching turned off.

`python3 -m http.server` sends only `Last-Modified` — no `Cache-Control`, no
`ETag`. With no explicit freshness the browser falls back to HEURISTIC caching
and may reuse index.html or site.css for minutes without revalidating.

That is not academic here. This project has no build step, so filenames never
change and there is nothing to bust a stale cache with. An edit can land, the
page can look untouched, and the obvious conclusion — "the change did not
work" — is wrong. It has already cost one round trip: index.html was written
twice in quick succession, a browser cached the intermediate copy, and the
second edit appeared to have silently failed.

Same URL as before:
    python3 scripts/serve.py
    -> http://localhost:8080/NYC%20Folder/index.html
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# Serve from the parent of NYC Folder, so both /NYC%20Folder/index.html and the
# "main scroll folder" symlink resolve exactly as they do in production.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Frame sequences are hundreds of requests; the default log buries errors.
        if not args or not str(args[0]).startswith(("GET /NYC%20Folder/main",
                                                    "GET /main")):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    os.chdir(os.path.dirname(ROOT))
    print(f"  serving {os.getcwd()} with caching disabled")
    print(f"  -> http://localhost:{PORT}/NYC%20Folder/index.html")
    ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
