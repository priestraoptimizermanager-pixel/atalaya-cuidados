#!/usr/bin/env python3
import hashlib
import hmac
import http.server
import json
import os
import shutil
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATA_FILE = DATA_DIR / "atalaya-cuidados-sync.json"
SYNC_TOKEN_HASH = os.environ.get("SYNC_TOKEN_HASH", "").strip()
MAX_BODY_BYTES = 1024 * 1024


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def log_message(self, format, *args):
        pass

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        super().end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_json({"ok": True})
            return
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/sync":
            self.send_json({"error": "not_found"}, status=404)
            return
        if not self.authorized():
            self.send_json({"error": "unauthorized"}, status=401)
            return

        body = self.read_body()
        action = body.get("action")
        if action == "pull":
            self.handle_pull()
            return
        if action == "push":
            self.handle_push(body)
            return
        self.send_json({"error": "unknown_action"}, status=400)

    def authorized(self):
        if not SYNC_TOKEN_HASH:
            return False
        header = self.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return False
        token = header[7:].strip()
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        return hmac.compare_digest(digest, SYNC_TOKEN_HASH)

    def read_body(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return {}
        if length <= 0 or length > MAX_BODY_BYTES:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError:
            return {}

    def handle_pull(self):
        if not DATA_FILE.exists():
            self.send_json({"empty": True})
            return
        try:
            payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            self.send_json({"error": "stored_data_invalid"}, status=500)
            return
        self.send_json(payload)

    def handle_push(self, body):
        if not valid_payload(body):
            self.send_json({"error": "invalid_payload"}, status=400)
            return

        current = None
        if DATA_FILE.exists():
            try:
                current = json.loads(DATA_FILE.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                current = None

        current_time = encrypted_updated_at(current)
        incoming_time = encrypted_updated_at(body)
        if current_time and incoming_time and incoming_time < current_time:
            self.send_json({"error": "stale_payload", "current": current}, status=409)
            return

        payload = {
            "app": "cuidados-mama",
            "version": 2,
            "encrypted": body["encrypted"],
        }
        temp_file = DATA_FILE.with_suffix(".tmp")
        temp_file.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        shutil.move(str(temp_file), str(DATA_FILE))
        self.send_json({"ok": True, "updatedAt": body["encrypted"]["updatedAt"]})

    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def valid_payload(body):
    if body.get("app") != "cuidados-mama" or body.get("version") != 2:
        return False
    encrypted = body.get("encrypted")
    if not isinstance(encrypted, dict):
        return False
    for field in ("alg", "kdf", "iv", "data", "updatedAt"):
        if not isinstance(encrypted.get(field), str):
            return False
    return (
        encrypted["alg"] == "AES-GCM"
        and encrypted["kdf"] == "PBKDF2-SHA256"
        and len(encrypted["iv"]) <= 64
        and len(encrypted["data"]) <= MAX_BODY_BYTES
    )


def encrypted_updated_at(payload):
    if not isinstance(payload, dict):
        return ""
    encrypted = payload.get("encrypted")
    if not isinstance(encrypted, dict):
        return ""
    value = encrypted.get("updatedAt", "")
    return value if isinstance(value, str) else ""


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
    server.serve_forever()
