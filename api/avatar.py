import json
import os
import time
from urllib.request import Request, urlopen

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
}

TEST_IMAGE_URL = "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=900&q=80"


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(payload, ensure_ascii=False),
    }


def _simulate_sensetime_request(image_base64):
    """
    TODO: Replace with real Sensetime AIGC API integration.
    1. Sign request with server-side secret.
    2. Upload base64 image payload.
    3. Poll or receive generated avatar URL.
    """
    time.sleep(0.4)
    return {
        "avatarUrl": TEST_IMAGE_URL,
        "sourceLength": len(image_base64 or ""),
    }


def handler(event, context):
    method = (event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method") or "").upper()

    if method == "OPTIONS":
        return _response(200, {"ok": True})

    if method != "POST":
        return _response(405, {"ok": False, "error": "Method not allowed"})

    try:
        body = event.get("body") or "{}"
        if event.get("isBase64Encoded"):
            import base64
            body = base64.b64decode(body).decode("utf-8")

        payload = json.loads(body)
        image_base64 = payload.get("imageBase64", "")

        result = _simulate_sensetime_request(image_base64)
        return _response(200, {
            "ok": True,
            "avatarUrl": result["avatarUrl"],
            "sourceLength": result["sourceLength"],
        })
    except Exception as exc:
        return _response(500, {"ok": False, "error": str(exc)})
