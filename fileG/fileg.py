#!/usr/bin/env python3
"""Local YouTube format picker for Termux. Use only content you may download."""
from __future__ import annotations
import json, re, shutil, subprocess, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HOST, PORT = "127.0.0.1", 8765
OUT_DIR = Path.home() / "storage" / "downloads" / "FileG"
ROOT = Path(__file__).resolve().parent
LOCK = threading.Lock()
EVENTS: list[dict] = []
NEXT_EVENT = 1
STATE: dict = {"busy": False, "title": "", "formats": [], "error": "", "url": ""}

def log(message: str) -> None:
    global NEXT_EVENT
    with LOCK:
        EVENTS.append({"id": NEXT_EVENT, "time": time.strftime("%H:%M:%S"), "text": message.rstrip()})
        NEXT_EVENT += 1
        del EVENTS[:-500]

def youtube_url(value: str) -> bool:
    try:
        parsed = urlparse(value.strip())
        host = (parsed.hostname or "").lower().rstrip(".")
        return parsed.scheme == "https" and (host == "youtu.be" or host == "youtube.com" or host.endswith(".youtube.com"))
    except ValueError:
        return False

def quality_label(height: int) -> str:
    if height >= 2160: return f"4K · {height}p"
    if height >= 1080: return f"Full HD · {height}p"
    if height >= 720: return f"HD · {height}p"
    return f"Kichik format · {height}p"

def inspect(url: str) -> dict:
    if not youtube_url(url): raise ValueError("Faqat https://youtube.com yoki https://youtu.be havolasini kiriting.")
    if not shutil.which("yt-dlp"): raise RuntimeError("yt-dlp topilmadi. O‘rnatish yo‘riqnomasi README.md faylida.")
    log("Havola tekshirilmoqda: " + url)
    proc = subprocess.run(["yt-dlp", "--dump-single-json", "--no-playlist", "--no-warnings", url], capture_output=True, text=True, timeout=120)
    if proc.returncode: raise RuntimeError((proc.stderr or "Video ma’lumotini olib bo‘lmadi.").strip()[-1200:])
    try: data = json.loads(proc.stdout)
    except json.JSONDecodeError as exc: raise RuntimeError("yt-dlp javobini o‘qib bo‘lmadi; yt-dlp ni yangilang.") from exc
    heights = sorted({int(f["height"]) for f in data.get("formats", []) if f.get("height") and f.get("vcodec") != "none"}, reverse=True)
    formats = [{"id": f"video-{h}", "height": h, "label": quality_label(h)} for h in heights[:10]]
    formats.append({"id": "mp3", "label": "MP3 · audio"})
    if len(formats) == 1: raise RuntimeError("Ushbu videoda yuklab olinadigan format topilmadi.")
    log(f"Topildi: {data.get('title', 'YouTube video')} · {len(heights)} xil video sifati va MP3")
    return {"title": data.get("title") or "YouTube video", "duration": data.get("duration_string") or "", "thumbnail": data.get("thumbnail") or "", "formats": formats}

def run_download(url: str, choice: str) -> None:
    global STATE
    try:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        common = ["yt-dlp", "--no-playlist", "--newline", "--progress", "--paths", str(OUT_DIR), "-o", "%(title).180B [%(id)s].%(ext)s"]
        if choice == "mp3": cmd = common + ["-x", "--audio-format", "mp3", "--audio-quality", "0", url]
        else:
            match = re.fullmatch(r"video-(\d{2,4})", choice)
            if not match: raise ValueError("Tanlangan format noto‘g‘ri.")
            height = int(match.group(1))
            cmd = common + ["-f", f"bestvideo[height<={height}]+bestaudio/best[height<={height}]", "--merge-output-format", "mp4", url]
        log("Yuklab olish boshlandi. Fayl Downloads/FileG ichiga saqlanadi.")
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        assert proc.stdout is not None
        for line in proc.stdout: log(line)
        if proc.wait(): log("Xatolik: yuklab olish tugamadi. Terminaldagi yt-dlp xabarini tekshiring.")
        else: log("Tayyor. Fayl telefondagi Downloads/FileG papkasida.")
    except Exception as exc: log("Xatolik: " + str(exc))
    finally:
        with LOCK: STATE["busy"] = False

class Handler(BaseHTTPRequestHandler):
    def _json(self, value: dict, status: int = 200) -> None:
        raw = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status); self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(raw)

    def _local_only(self) -> bool:
        host = self.headers.get("Host", "").split(":")[0]
        origin = self.headers.get("Origin")
        return host in ("127.0.0.1", "localhost") and (not origin or urlparse(origin).hostname in ("127.0.0.1", "localhost"))

    def do_GET(self) -> None:
        if not self._local_only(): self.send_error(403); return
        path = urlparse(self.path)
        if path.path == "/":
            raw = (ROOT / "index.html").read_bytes()
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(raw))); self.end_headers(); self.wfile.write(raw)
        elif path.path == "/api/state":
            with LOCK: self._json({"busy": STATE["busy"], "title": STATE["title"], "formats": STATE["formats"], "error": STATE["error"], "events": EVENTS[-100:]})
        elif path.path == "/api/events":
            after = int(parse_qs(path.query).get("after", ["0"])[0])
            with LOCK: self._json({"events": [e for e in EVENTS if e["id"] > after], "busy": STATE["busy"]})
        else: self.send_error(404)

    def do_POST(self) -> None:
        if not self._local_only(): self.send_error(403); return
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 8192)
            body = json.loads(self.rfile.read(length)); url = str(body.get("url", "")).strip()
            if self.path == "/api/inspect":
                result = inspect(url)
                with LOCK: STATE.update({"title": result["title"], "formats": result["formats"], "error": "", "url": url})
                self._json(result)
            elif self.path == "/api/download":
                choice = str(body.get("format", ""))
                with LOCK:
                    if STATE["busy"]: self._json({"error": "Boshqa yuklab olish davom etmoqda."}, 409); return
                    if url != STATE["url"] or choice not in {f["id"] for f in STATE["formats"]}: self._json({"error": "Ushbu havolani qayta tekshirib format tanlang."}, 400)
                    elif not youtube_url(url): self._json({"error": "YouTube havolasi noto‘g‘ri."}, 400)
                    else:
                        STATE["busy"] = True
                        threading.Thread(target=run_download, args=(url, choice), daemon=True).start()
                        self._json({"ok": True})
            else: self.send_error(404)
        except Exception as exc: self._json({"error": str(exc)}, 400)

    def log_message(self, fmt: str, *args: object) -> None: pass

if __name__ == "__main__":
    print("FileG ishlayapti: http://127.0.0.1:8765")
    print("To‘xtatish: Termux oynasida Ctrl+C")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
