import json
import time
from http.server import BaseHTTPRequestHandler

TEST_IMAGE_URL = "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=900&q=80"


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(200, {"ok": True})

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
            payload = json.loads(raw_body)

            image_base64 = payload.get("imageBase64", "")
            # TODO: Replace this simulated delay with real Sensetime AIGC signing + forwarding.
            time.sleep(0.4)

            self._send_json(200, {
                "ok": True,
                "avatarUrl": TEST_IMAGE_URL,
                "sourceLength": len(image_base64),
            })
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})
