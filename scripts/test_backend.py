#!/usr/bin/env python3
import json
import os
import sys
import time
import urllib.request

BASE_URL = 'http://127.0.0.1:8765'

def test_status():
    print("[TEST 1] Verifica endpoint /status...")
    req = urllib.request.Request(f"{BASE_URL}/status")
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        assert data['status'] == 'ok', f"Status not ok: {data}"
        assert data['ytdlp_available'] is True, "yt-dlp non disponibile"
        assert data['ffmpeg_available'] is True, "ffmpeg non disponibile"
        print(f"  -> OK: Server attivo, yt-dlp & ffmpeg pronti. Cartella: {data['download_dir']}")
        return data

def test_video_info():
    print("[TEST 2] Verifica estrazione info video e massima qualità (4K)...")
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    req = urllib.request.Request(
        f"{BASE_URL}/video_info",
        data=json.dumps({"url": url}).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        assert data['status'] == 'ok', f"Video info status not ok: {data}"
        assert '2160p' in data['maxQuality'], f"Max quality not 4K: {data['maxQuality']}"
        assert len(data['videoQualities']) > 0, "Nessuna qualità video estratta"
        assert len(data['audioTracks']) > 0, "Nessuna traccia audio estratta"
        print(f"  -> OK: Titolo: '{data['title']}' | Max Quality: {data['maxQuality']} | Tracce audio: {len(data['audioTracks'])}")

def test_multilingual_audio():
    print("[TEST 3] Verifica estrazione tracce audio multilingua...")
    url = "https://www.youtube.com/watch?v=0e3GPea1Tyg"
    req = urllib.request.Request(
        f"{BASE_URL}/video_info",
        data=json.dumps({"url": url}).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        assert data['status'] == 'ok', "Multilingual video info failed"
        assert len(data['audioTracks']) > 5, f"Audio tracks insufficient: {len(data['audioTracks'])}"
        sample_langs = [t['label'] for t in data['audioTracks'][:4]]
        print(f"  -> OK: Rilevate {len(data['audioTracks'])} tracce audio. Esempi: {sample_langs}")

def test_download_and_progress():
    print("[TEST 4] Test download reale con traccia audio e muxing FFmpeg...")
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    req = urllib.request.Request(
        f"{BASE_URL}/download",
        data=json.dumps({
            "url": url,
            "quality": "240",
            "audio_track_id": "auto",
            "format": "mp4"
        }).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        dl_id = res['download_id']
        print(f"  -> Avviato download ID: {dl_id}")

    # Polling progress
    completed = False
    for i in range(50):
        time.sleep(1)
        req_prog = urllib.request.Request(f"{BASE_URL}/progress?id={dl_id}")
        with urllib.request.urlopen(req_prog, timeout=5) as p_resp:
            p_data = json.loads(p_resp.read().decode('utf-8'))
            status = p_data.get('status')
            pct = p_data.get('percent', 0)
            if status == 'completed':
                completed = True
                print(f"  -> OK: Download completato al 100%! File: {p_data['filename']}")
                if os.path.exists(p_data['path']):
                    sz = os.path.getsize(p_data['path'])
                    print(f"  -> OK: File verificato sul disco: {sz} bytes ({sz / 1024 / 1024:.2f} MB)")
                    os.remove(p_data['path'])
                    print("  -> File di test rimosso con successo.")
                break
            elif status == 'error':
                raise RuntimeError(f"Download fallito: {p_data.get('error')}")
            else:
                print(f"     Progresso: {pct:.1f}% ({p_data.get('speed', '')})", end='\r')

    assert completed, "Download timeout non completato in 50 secondi"

if __name__ == '__main__':
    print("=== AVVIO SUITE DI TEST YOUTUBE VIDEO DOWNLOADER PRO ===")
    test_status()
    test_video_info()
    test_multilingual_audio()
    test_download_and_progress()
    print("=== TUTTI I TEST HANNO AVUTO SUCCESSO! ===")
