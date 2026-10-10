import signal
#!/usr/bin/env python3
import glob
import http.server
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.parse
from pathlib import Path

PORT = 8765
DEFAULT_DOWNLOAD_DIR = str(Path.home() / "Scaricati")
if not os.path.exists(DEFAULT_DOWNLOAD_DIR):
    DEFAULT_DOWNLOAD_DIR = str(Path.home() / "Downloads")
    if not os.path.exists(DEFAULT_DOWNLOAD_DIR):
        DEFAULT_DOWNLOAD_DIR = str(Path.home())

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLED_YTDLP = os.path.join(SCRIPT_DIR, "yt-dlp")
SYSTEM_YTDLP = "/home/pask/bin/yt-dlp"

def get_ytdlp_path():
    if os.path.isfile(BUNDLED_YTDLP) and os.access(BUNDLED_YTDLP, os.X_OK):
        return BUNDLED_YTDLP
    if os.path.isfile(SYSTEM_YTDLP) and os.access(SYSTEM_YTDLP, os.X_OK):
        return SYSTEM_YTDLP
    return "yt-dlp"

downloads = {}
downloads_lock = threading.Lock()
active_processes = {}
active_processes_lock = threading.Lock()

class YouTubeDownloaderHandler(http.server.BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, data, status=200):
        try:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            return {}
        raw = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def log_message(self, fmt, *args):
        sys.stderr.write("[YT-Server] " + (fmt % args) + "\n")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path in ("/", "/health", "/status"):
            ytdlp = get_ytdlp_path()
            ytdlp_ok = os.path.exists(ytdlp)
            ffmpeg_ok = os.path.exists("/usr/bin/ffmpeg")
            self.send_json({
                "status": "ok",
                "service": "youtube_video_downloader_helper",
                "version": "1.1.0",
                "ytdlp_available": ytdlp_ok,
                "ffmpeg_available": ffmpeg_ok,
                "download_dir": DEFAULT_DOWNLOAD_DIR
            })
            return

        if path == "/downloads":
            with downloads_lock:
                items = list(downloads.values())
            # Sort newest first
            items.sort(key=lambda x: x.get("created_at", 0), reverse=True)
            self.send_json({"downloads": items})
            return

        if path == "/progress":
            dl_id = query.get("id", [None])[0]
            if not dl_id:
                self.send_json({"error": "Missing id parameter"}, 400)
                return
            with downloads_lock:
                item = downloads.get(dl_id)
            if not item:
                self.send_json({"error": "Task not found"}, 404)
                return
            self.send_json(item)
            return

        self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        if path == "/video_info":
            url = body.get("url")
            if not url:
                self.send_json({"error": "URL required"}, 400)
                return
            self.handle_video_info(url)
            return

        if path == "/download":
            self.handle_download(body)
            return

        if path == "/cancel":
            dl_id = body.get("download_id")
            if not dl_id:
                self.send_json({"error": "download_id required"}, 400)
                return
            self.handle_cancel(dl_id)
            return

        if path == "/open_folder":
            folder = body.get("folder", DEFAULT_DOWNLOAD_DIR)
            file_path = body.get("path")
            target = file_path if file_path and os.path.exists(file_path) else folder
            try:
                subprocess.Popen(["xdg-open", target], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                self.send_json({"status": "opened", "target": target})
            except Exception as e:
                self.send_json({"status": "error", "message": str(e)}, 500)
            return

        self.send_json({"error": "Not found"}, 404)

    def handle_cancel(self, dl_id):
        cancelled = False
        with downloads_lock:
            if dl_id in downloads:
                item = downloads[dl_id]
                item["cancelled"] = True
                if item["status"] in ("starting", "downloading", "muxing"):
                    item["status"] = "cancelled"
                    item["speed"] = ""
                    item["eta"] = ""
                    cancelled = True

        with active_processes_lock:
            proc = active_processes.get(dl_id)
            if proc and proc.poll() is None:
                try:
                    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                    time.sleep(0.2)
                    if proc.poll() is None:
                        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                    cancelled = True
                except Exception:
                    pass
                active_processes.pop(dl_id, None)

        # Cleanup partial files for this download if known
        with downloads_lock:
            p = downloads.get(dl_id, {}).get("path", "")
            if p:
                for part in glob.glob(p + "*"):
                    if part.endswith(".part") or ".f" in part:
                        try:
                            os.remove(part)
                        except Exception:
                            pass

        self.send_json({"status": "cancelled", "download_id": dl_id, "success": cancelled})

    def handle_video_info(self, url):
        ytdlp = get_ytdlp_path()
        cmd = [ytdlp, "-J", "--no-playlist", url]
        try:
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=25)
            if proc.returncode != 0:
                self.send_json({"error": "Failed to extract video info", "details": proc.stderr[:300]}, 500)
                return
            raw_data = json.loads(proc.stdout)
            
            title = raw_data.get("title", "Video senza titolo")
            video_id = raw_data.get("id", "")
            duration = raw_data.get("duration", 0)
            channel = raw_data.get("uploader") or raw_data.get("channel", "")
            thumbnail = raw_data.get("thumbnail", "")
            
            formats = raw_data.get("formats", [])
            
            video_resolutions = {}
            for f in formats:
                vcodec = f.get("vcodec")
                if vcodec and vcodec != "none":
                    h = f.get("height") or 0
                    fps = f.get("fps") or 30
                    if h > 0:
                        lbl = f"{h}p"
                        if h >= 4320:
                            lbl = f"{h}p (8K FUHD)"
                        elif h >= 2160:
                            lbl = f"{h}p (4K UHD)"
                        elif h >= 1440:
                            lbl = f"{h}p (2K QHD)"
                        elif h >= 1080:
                            lbl = f"{h}p (Full HD)"
                        elif h >= 720:
                            lbl = f"{h}p (HD)"
                        
                        if fps >= 50:
                            lbl += f" {int(fps)}fps"
                            
                        if h not in video_resolutions or (fps > video_resolutions[h].get("fps", 0)):
                            video_resolutions[h] = {
                                "height": h,
                                "fps": int(fps),
                                "label": lbl,
                                "vcodec": vcodec
                            }

            sorted_qualities = sorted(video_resolutions.values(), key=lambda x: x["height"], reverse=True)
            max_quality_label = sorted_qualities[0]["label"] if sorted_qualities else "Massima qualità disponibile"

            audio_tracks = []
            seen_tracks = set()
            
            audio_tracks.append({
                "id": "auto",
                "label": "Migliore Audio Disponibile (Originale)",
                "lang": "default",
                "is_default": True
            })

            lang_names = {
                "it": "Italiano", "en": "Inglese", "es": "Spagnolo", "fr": "Francese",
                "de": "Tedesco", "ja": "Giapponese", "ko": "Coreano", "pt": "Portoghese",
                "ru": "Russo", "zh": "Cinese", "ar": "Arabo", "hi": "Hindi"
            }

            for f in formats:
                acodec = f.get("acodec")
                if acodec and acodec != "none" and (f.get("vcodec") == "none" or not f.get("vcodec")):
                    lang = (f.get("language") or "und").lower()
                    note = f.get("format_note") or ""
                    abr = f.get("abr") or 0
                    fid = f.get("format_id")
                    
                    track_key = f"{lang}_{fid}"
                    if track_key not in seen_tracks and lang != "und":
                        seen_tracks.add(track_key)
                        lang_display = lang_names.get(lang, lang.upper())
                        label = f"Lingua: {lang_display}"
                        if note:
                            label += f" ({note})"
                        if abr > 0:
                            label += f" ~{int(abr)} kbps"
                        audio_tracks.append({
                            "id": fid,
                            "label": label,
                            "lang": lang,
                            "abr": int(abr) if abr else None,
                            "is_default": False
                        })

            self.send_json({
                "status": "ok",
                "title": title,
                "videoId": video_id,
                "duration": duration,
                "channel": channel,
                "thumbnail": thumbnail,
                "maxQuality": max_quality_label,
                "videoQualities": sorted_qualities,
                "audioTracks": audio_tracks
            })
        except subprocess.TimeoutExpired:
            self.send_json({"error": "Timeout getting video info"}, 504)
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    def handle_download(self, body):
        url = body.get("url")
        if not url:
            self.send_json({"error": "URL required"}, 400)
            return

        quality = body.get("quality", "max")
        audio_track_id = body.get("audio_track_id", "auto")
        format_mode = body.get("format", "mp4")
        output_dir = body.get("output_dir", DEFAULT_DOWNLOAD_DIR)
        os.makedirs(output_dir, exist_ok=True)

        download_id = f"dl_{int(time.time()*1000)}"
        
        with downloads_lock:
            downloads[download_id] = {
                "id": download_id,
                "url": url,
                "title": body.get("title", "Preparazione download..."),
                "quality": quality,
                "audio_track": audio_track_id,
                "format": format_mode,
                "status": "starting",
                "cancelled": False,
                "percent": 0,
                "speed": "",
                "eta": "",
                "filename": "",
                "path": "",
                "error": None,
                "created_at": time.time()
            }

        thread = threading.Thread(target=run_download_task, args=(download_id, url, quality, audio_track_id, format_mode, output_dir), daemon=True)
        thread.start()

        self.send_json({
            "status": "started",
            "download_id": download_id,
            "output_dir": output_dir
        })

def run_download_task(download_id, url, quality, audio_track_id, format_mode, output_dir):
    with downloads_lock:
        if downloads.get(download_id, {}).get("status") == "cancelled" or downloads.get(download_id, {}).get("cancelled"):
            return
    ytdlp = get_ytdlp_path()
    
    if format_mode == "audio_only":
        if audio_track_id and audio_track_id != "auto":
            format_spec = audio_track_id
        else:
            format_spec = "bestaudio/best"
    else:
        if quality == "max":
            v_spec = "bestvideo"
        else:
            v_spec = f"bestvideo[height<={quality}]"
            
        if audio_track_id and audio_track_id != "auto":
            a_spec = audio_track_id
        else:
            a_spec = "bestaudio/best"
            
        format_spec = f"{v_spec}+{a_spec}"

    out_template = os.path.join(output_dir, "%(title).150s [%(resolution)s].%(ext)s")
    if format_mode == "audio_only":
        out_template = os.path.join(output_dir, "%(title).150s.%(ext)s")

    cmd = [
        ytdlp,
        "--newline",
        "--no-playlist",
        "-f", format_spec,
        "--merge-output-format", "mp4" if format_mode == "mp4" else ("webm" if format_mode == "webm" else "mp3"),
        "-o", out_template,
        url
    ]

    if format_mode == "audio_only":
        cmd.extend(["-x", "--audio-format", "mp3"])

    # Determine expected destination filename ahead of time
    expected_path = ""
    try:
        fn_cmd = [ytdlp, "--get-filename", "-f", format_spec, "--merge-output-format", "mp4" if format_mode == "mp4" else ("webm" if format_mode == "webm" else "mp3"), "-o", out_template, url]
        fn_res = subprocess.run(fn_cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=8)
        if fn_res.returncode == 0:
            lines = [l.strip() for l in fn_res.stdout.splitlines() if l.strip()]
            if lines:
                expected_path = lines[-1]
    except Exception:
        pass

    with downloads_lock:
        if downloads.get(download_id, {}).get("status") == "cancelled" or downloads.get(download_id, {}).get("cancelled"):
            return
        downloads[download_id]["status"] = "downloading"
        if expected_path:
            downloads[download_id]["path"] = expected_path
            downloads[download_id]["filename"] = os.path.basename(expected_path)

    dest_filename = expected_path
    try:
        with downloads_lock:
            if downloads.get(download_id, {}).get("status") == "cancelled" or downloads.get(download_id, {}).get("cancelled"):
                return
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, preexec_fn=os.setsid)
        with active_processes_lock:
            active_processes[download_id] = proc

        for line in proc.stdout:
            line_str = line.strip()
            
            # Check if cancelled mid-stream
            with downloads_lock:
                if downloads.get(download_id, {}).get("status") == "cancelled":
                    break

            if "[download] Destination:" in line_str:
                raw_dest = line_str.split("[download] Destination:", 1)[1].strip()
                if not dest_filename:
                    dest_filename = raw_dest
            elif "[Merger] Merging formats into" in line_str:
                dest_filename = line_str.split("[Merger] Merging formats into", 1)[1].strip().strip('"')
                with downloads_lock:
                    if downloads[download_id]["status"] != "cancelled":
                        downloads[download_id]["status"] = "muxing"
                        downloads[download_id]["percent"] = 99.0
                        downloads[download_id]["path"] = dest_filename
                        downloads[download_id]["filename"] = os.path.basename(dest_filename)
            elif "[download]" in line_str and "%" in line_str:
                m = re.search(r"([0-9.]+)%\s+of\s+~?([0-9.]+\w+)\s+at\s+([0-9.]+\w+/s)\s+ETA\s+([0-9:]+)", line_str)
                if m:
                    pct = float(m.group(1))
                    speed = m.group(3)
                    eta = m.group(4)
                    with downloads_lock:
                        if downloads[download_id]["status"] != "cancelled":
                            downloads[download_id]["percent"] = pct
                            downloads[download_id]["speed"] = speed
                            downloads[download_id]["eta"] = eta
                            downloads[download_id]["status"] = "downloading"
                else:
                    m2 = re.search(r"([0-9.]+)%", line_str)
                    if m2:
                        with downloads_lock:
                            if downloads[download_id]["status"] != "cancelled":
                                downloads[download_id]["percent"] = float(m2.group(1))

        proc.wait()
        
        with downloads_lock:
            # If already cancelled, do not mark as error or completed
            if downloads[download_id]["status"] == "cancelled":
                return

            if proc.returncode == 0:
                final_path = dest_filename or expected_path
                if final_path and re.search(r"\.f[0-9]+\.", final_path):
                    cleaned = re.sub(r"\.f[0-9]+", "", final_path)
                    if os.path.exists(cleaned):
                        final_path = cleaned
                downloads[download_id]["status"] = "completed"
                downloads[download_id]["percent"] = 100.0
                downloads[download_id]["filename"] = os.path.basename(final_path)
                downloads[download_id]["path"] = final_path
            else:
                downloads[download_id]["status"] = "error"
                downloads[download_id]["error"] = f"Download terminato con codice {proc.returncode}"
    except Exception as e:
        with downloads_lock:
            if downloads.get(download_id, {}).get("status") != "cancelled":
                downloads[download_id]["status"] = "error"
                downloads[download_id]["error"] = str(e)
    finally:
        with active_processes_lock:
            active_processes.pop(download_id, None)

def run():
    server_address = ("127.0.0.1", PORT)
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    httpd = http.server.ThreadingHTTPServer(server_address, YouTubeDownloaderHandler)
    print(f"[YT-Server] Ascolto attivo su http://127.0.0.1:{PORT}")
    print(f"[YT-Server] Cartella download predefinita: {DEFAULT_DOWNLOAD_DIR}")
    httpd.serve_forever()

if __name__ == "__main__":
    run()
