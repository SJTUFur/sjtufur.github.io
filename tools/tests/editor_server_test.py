"""Run with: python3 tools/tests/editor_server_test.py"""
import base64
import importlib.util
import json
import tempfile
import threading
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from urllib.parse import urljoin

spec = importlib.util.spec_from_file_location("editor_server", Path(__file__).resolve().parents[1] / "editor_server.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EditorServerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.server = module.create_server(self.root, 0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"
        self.token = json.load(urlopen(self.base + "/__editor/session"))["token"]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def post(self, path, data, token=True, origin=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["X-Editor-Token"] = self.token
        if origin:
            headers["Origin"] = origin
        body = json.dumps(data).encode() if not isinstance(data, bytes) else data
        return json.load(urlopen(Request(self.base + path, body, headers)))

    def test_save_only_known_data_files(self):
        for kind, filename, variable in [("members", "members-data.js", "SITE_MEMBERS"), ("media", "media-data.js", "SITE_MEDIA")]:
            data = [{"name": "测试", "text": '"; alert(1); //'}]
            result = self.post("/__editor/apply", {"kind": kind, "data": data})
            self.assertEqual(result["file"], filename)
            source = (self.root / filename).read_text()
            assignment = source.split("window." + variable + " = ", 1)[1].strip()[:-1]
            self.assertEqual(json.loads(assignment), data)
        with self.assertRaises(HTTPError):
            self.post("/__editor/apply", {"kind": "../index.html", "data": []})
        self.assertFalse((self.root / "index.html").exists())

    def test_write_needs_local_origin_and_token(self):
        for kwargs in [{"token": False}, {"origin": "https://example.com"}]:
            with self.assertRaises(HTTPError) as error:
                self.post("/__editor/apply", {"kind": "members", "data": []}, **kwargs)
            self.assertEqual(error.exception.code, 403)

    def test_upload_image_without_overwrite(self):
        image = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1f8AAAAASUVORK5CYII=")
        first = self.post("/__editor/image?name=photo.png", image)
        second = self.post("/__editor/image?name=photo.png", image)
        self.assertEqual(first["path"], second["path"])
        self.assertEqual((self.root / first["path"]).read_bytes(), image)
        person = self.post("/__editor/image?name=avatar.png&folder=people", image)
        self.assertTrue(person["path"].startswith("assets/images/people/"))
        self.assertEqual((self.root / person["path"]).read_bytes(), image)
        jfif = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00"
        jpeg = self.post("/__editor/image?name=photo.JFIF&folder=people", jfif)
        self.assertTrue(jpeg["path"].endswith(".jpg"))
        self.assertEqual((self.root / jpeg["path"]).read_bytes(), jfif)
        with self.assertRaises(HTTPError):
            self.post("/__editor/image?name=bad.jfif", b"not an image")
        with self.assertRaises(HTTPError):
            self.post("/__editor/image?name=photo.svg", b"<svg/>")
        with self.assertRaises(HTTPError):
            self.post("/__editor/image?name=photo.png&folder=../elsewhere", image)

    def test_hidden_files_are_not_served(self):
        (self.root / ".git").mkdir()
        (self.root / ".git/config").write_text("private")
        with self.assertRaises(HTTPError) as error:
            urlopen(self.base + "/.git/config")
        self.assertEqual(error.exception.code, 403)

    def test_launcher_entry_links_and_editor_assets(self):
        # Exercise the real hub and relative URLs, not just independent known endpoints.
        source = Path(__file__).resolve().parents[2]
        import shutil
        shutil.copytree(source / "tools", self.root / "tools")
        shutil.copy2(source / "styles.css", self.root / "styles.css")
        for name in ["members-data.js", "members.js", "media-data.js", "media.js", "index.html"]:
            shutil.copy2(source / name, self.root / name)

        class Links(HTMLParser):
            def __init__(self):
                super().__init__()
                self.urls = []

            def handle_starttag(self, tag, attrs):
                values = dict(attrs)
                if tag in {"a", "link", "script"}:
                    url = values.get("href") or values.get("src")
                    if url:
                        self.urls.append(url)

        response = urlopen(self.base + "/")
        self.assertEqual(response.url, self.base + "/tools/editors.html")
        links = Links()
        links.feed(response.read().decode())
        pages = [urljoin(response.url, url) for url in links.urls if url.endswith(".html")]
        self.assertIn(self.base + "/tools/members-editor.html", pages)
        self.assertIn(self.base + "/tools/media-editor.html", pages)
        for url in pages:
            page = urlopen(url)
            self.assertEqual(page.status, 200)
            if "/tools/" in url:
                assets = Links()
                assets.feed(page.read().decode())
                for asset in assets.urls:
                    if ".css" in asset or ".js" in asset:
                        self.assertEqual(urlopen(urljoin(url, asset)).status, 200)
        for filename in ["members-editor.html", "media-editor.html"]:
            self.assertEqual(urlopen(self.base + "/" + filename).url, self.base + "/tools/" + filename)

    def test_launch_uses_next_port_when_preferred_port_is_busy(self):
        other = module.create_available_server(self.root, self.server.server_port)
        try:
            self.assertNotEqual(other.server_port, self.server.server_port)
            self.assertEqual(other.server_address[0], "127.0.0.1")
        finally:
            other.server_close()


if __name__ == "__main__":
    unittest.main()
