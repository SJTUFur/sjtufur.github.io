#!/usr/bin/env python3
"""Local-only editing service. No third-party dependencies or production backend."""
import argparse
import hashlib
import json
import os
import re
import secrets
import tempfile
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

FILES = {
    "members": ("members-data.js", "SITE_MEMBERS", "成员资料。可用 tools/members-editor.html 编辑并导出本文件。"),
    "media": ("media-data.js", "SITE_MEDIA", "多媒体资料。可用 tools/media-editor.html 编辑。"),
}


class EditorHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def json_response(self, status, value):
        content = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def local_request(self):
        port = self.server.server_address[1]
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        if self.headers.get("Host") not in hosts:
            return False
        origin = self.headers.get("Origin")
        return (not origin or origin in {"http://" + host for host in hosts}) and self.headers.get("Sec-Fetch-Site") != "cross-site"

    def do_GET(self):
        if not self.local_request():
            self.json_response(403, {"error": "仅允许本机同源访问。"})
            return
        path = urlsplit(self.path).path
        if path == "/__editor/session":
            self.json_response(200, {"token": self.server.editor_token})
            return
        root = self.server.editor_root
        target = (root / unquote(path).lstrip("/")).resolve()
        try:
            relative = target.relative_to(root)
        except ValueError:
            self.send_error(403)
            return
        if any(part.startswith(".") for part in relative.parts):
            self.send_error(403)
            return
        if path == "/":
            self.path = "/tools/editors.html"
        super().do_GET()

    def list_directory(self, path):
        self.send_error(403, "Directory listing is disabled")
        return None

    def do_POST(self):
        if not self.local_request() or not secrets.compare_digest(self.headers.get("X-Editor-Token", ""), self.server.editor_token):
            self.json_response(403, {"error": "请从本地编辑服务打开工具后重试。"})
            return
        path = urlsplit(self.path)
        if path.path not in {"/__editor/apply", "/__editor/image"}:
            self.json_response(404, {"error": "未知操作。"})
            return
        try:
            limit = 8 * 1024 * 1024 if path.path.endswith("image") else 2 * 1024 * 1024
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= limit:
                raise ValueError("文件大小不符合要求，资料最多 2 MB，图片最多 8 MB。")
            body = self.rfile.read(length)
            if path.path == "/__editor/image":
                self.save_image(path.query, body)
            else:
                self.save_data(body)
        except (ValueError, TypeError, UnicodeError) as error:
            self.json_response(400, {"error": str(error)})
        except OSError:
            self.json_response(500, {"error": "无法写入文件，请检查工程目录权限。"})

    def save_data(self, body):
        payload = json.loads(body)
        if not isinstance(payload, dict) or payload.get("kind") not in FILES:
            raise ValueError("不支持的资料类型。")
        data = payload.get("data")
        if not isinstance(data, list) or not all(isinstance(row, dict) for row in data):
            raise ValueError("资料必须是记录列表。")
        filename, variable, comment = FILES[payload["kind"]]
        source = "// " + comment + "\nwindow." + variable + " = " + json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + ";\n"
        destination = self.server.editor_root / filename
        # Only these two data files can be replaced; never accept a client-supplied path.
        if destination.is_symlink():
            raise ValueError("资料文件不能是符号链接。")
        temporary = None
        try:
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=destination.parent, delete=False) as stream:
                temporary = stream.name
                stream.write(source)
            os.replace(temporary, destination)
        finally:
            if temporary and os.path.exists(temporary):
                os.unlink(temporary)
        self.json_response(200, {"file": filename})

    def save_image(self, query, body):
        params = parse_qs(query)
        name = Path(params.get("name", ["image"])[0]).name
        image_folder = params.get("folder", ["gallery"])[0]
        if image_folder not in {"gallery", "people"}:
            raise ValueError("图片只能保存到 gallery 或 people 目录。")
        suffix = Path(name).suffix.lower()
        valid = ((suffix == ".png" and body.startswith(b"\x89PNG\r\n\x1a\n")) or
                 (suffix in {".jpg", ".jpeg"} and body.startswith(b"\xff\xd8\xff")) or
                 (suffix == ".gif" and body.startswith((b"GIF87a", b"GIF89a"))) or
                 (suffix == ".webp" and body.startswith(b"RIFF") and body[8:12] == b"WEBP"))
        if not valid:
            raise ValueError("请选择 PNG、JPG、GIF 或 WebP 图片。")
        stem = re.sub(r"[^\w-]", "-", Path(name).stem)[:50] or "image"
        filename = f"{stem}-{hashlib.sha256(body).hexdigest()[:12]}{suffix}"
        folder = self.server.editor_root / "assets/images" / image_folder
        if folder.resolve() != self.server.editor_root / "assets/images" / image_folder:
            raise ValueError("图片目录不能指向工程外部。")
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / filename
        if target.is_symlink():
            raise ValueError("图片文件不能是符号链接。")
        if not target.exists():
            target.write_bytes(body)
        self.json_response(200, {"path": f"assets/images/{image_folder}/" + filename})


def create_server(root, port=8765):
    root = Path(root).resolve()
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(EditorHandler, directory=str(root)))
    server.editor_root = root
    server.editor_token = secrets.token_urlsafe(32)
    return server


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SJTUfur 本地编辑工具")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open", action="store_true", help="在默认浏览器中打开工具入口")
    args = parser.parse_args()
    server = create_server(Path(__file__).resolve().parent.parent, args.port)
    print(f"本地编辑工具：http://127.0.0.1:{server.server_port}/", flush=True)
    print("应用会保存本地资料文件；线上网站仍按原来的 PR 流程发布。Ctrl+C 结束。", flush=True)
    if args.open:
        webbrowser.open(f"http://127.0.0.1:{server.server_port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
