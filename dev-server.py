import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HOST = "0.0.0.0"
PORT = 8000
STORE_PATH = "progress-store.json"


def load_store():
    if not os.path.exists(STORE_PATH):
        return {"accounts": {}}
    try:
        with open(STORE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {"accounts": {}}
        accounts = data.get("accounts")
        if not isinstance(accounts, dict):
            return {"accounts": {}}
        return {"accounts": accounts}
    except Exception:
        return {"accounts": {}}


def write_store(data):
    tmp = f"{STORE_PATH}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STORE_PATH)


def sanitize_progress(progress):
    out = {"done": {}, "bookmarks": {}}
    if not isinstance(progress, dict):
        return out
    done = progress.get("done")
    if isinstance(done, dict):
        for k, v in done.items():
            if v:
                out["done"][str(k)] = 1
    bookmarks = progress.get("bookmarks")
    if isinstance(bookmarks, dict):
        for k, v in bookmarks.items():
            if v:
                out["bookmarks"][str(k)] = 1
    return out


class Handler(SimpleHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/progress":
            query = parse_qs(parsed.query)
            account_id = (query.get("accountId") or [""])[0].strip()
            if not account_id:
                self._send_json({"ok": False, "error": "missing_account_id"}, status=400)
                return

            store = load_store()
            data = store["accounts"].get(account_id, {"done": {}, "bookmarks": {}})
            self._send_json({"ok": True, "accountId": account_id, "data": sanitize_progress(data)})
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/progress":
            self._send_json({"ok": False, "error": "not_found"}, status=404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length > 0 else b"{}"
            payload = json.loads(raw.decode("utf-8"))
        except Exception:
            self._send_json({"ok": False, "error": "invalid_json"}, status=400)
            return

        account_id = str((payload or {}).get("accountId", "")).strip()
        if not account_id:
            self._send_json({"ok": False, "error": "missing_account_id"}, status=400)
            return

        data = sanitize_progress((payload or {}).get("data"))
        store = load_store()
        store["accounts"][account_id] = data
        write_store(store)
        self._send_json({"ok": True, "accountId": account_id})


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Serving on http://127.0.0.1:{PORT}")
    server.serve_forever()
