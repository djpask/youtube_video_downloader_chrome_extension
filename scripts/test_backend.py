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

def test_selective_cancellation():
    print("[TEST 4] Test avvio download e INTERRUZIONE SELETTIVA (POST /cancel)...")
    url = "https://www.youtube.com/watch?v=0e3GPea1Tyg"
    
    # Avvia download 1
    req1 = urllib.request.Request(
        f"{BASE_URL}/download",
        data=json.dumps({
            "url": url,
            "quality": "720",
            "audio_track_id": "auto",
            "format": "mp4"
        }).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req1, timeout=10) as resp:
        res1 = json.loads(resp.read().decode('utf-8'))
        dl1 = res1['download_id']
        print(f"  -> Avviato download da interrompere (ID: {dl1})")

    # Attendi che il download inizi
    time.sleep(1.5)

    # Verifica presenza nell'elenco di tutti i download
    req_list = urllib.request.Request(f"{BASE_URL}/downloads")
    with urllib.request.urlopen(req_list, timeout=5) as resp:
        dl_list = json.loads(resp.read().decode('utf-8'))
        ids = [d['id'] for d in dl_list.get('downloads', [])]
        assert dl1 in ids, f"Download {dl1} non trovato nell'elenco /downloads"
        print(f"  -> OK: Download {dl1} presente nell'elenco totale ({len(ids)} elementi registrati)")

    # Invia comando di interruzione per dl1
    req_cancel = urllib.request.Request(
        f"{BASE_URL}/cancel",
        data=json.dumps({"download_id": dl1}).encode('utf-8'),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_cancel, timeout=5) as resp:
        c_res = json.loads(resp.read().decode('utf-8'))
        assert c_res.get('status') == 'cancelled', f"Cancel fallito: {c_res}"
        print(f"  -> OK: Richiesta /cancel inviata con successo per {dl1}")

    # Verifica stato progress
    time.sleep(0.5)
    req_check = urllib.request.Request(f"{BASE_URL}/progress?id={dl1}")
    with urllib.request.urlopen(req_check, timeout=5) as resp:
        p_data = json.loads(resp.read().decode('utf-8'))
        assert p_data['status'] == 'cancelled', f"Stato non 'cancelled': {p_data}"
        print(f"  -> OK: Stato verificato con successo: {p_data['status']}")

def test_download_and_completion():
    print("[TEST 5] Test download completo e verifica file...")
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
        print(f"  -> Avviato download per test completamento (ID: {dl_id})")

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
                    print("  -> File rimosso con successo.")
                break
            elif status == 'error':
                raise RuntimeError(f"Download fallito: {p_data.get('error')}")
            else:
                print(f"     Progresso: {pct:.1f}% ({p_data.get('speed', '')})", end='\r')

    assert completed, "Download timeout non completato in 50 secondi"

def test_folder_configuration():
    print("[TEST 6] Test configurazione e cambio cartella di salvataggio...")
    
    # 1. Leggi cartella iniziale
    req_cfg = urllib.request.Request(f"{BASE_URL}/config")
    with urllib.request.urlopen(req_cfg, timeout=5) as resp:
        cfg = json.loads(resp.read().decode("utf-8"))
        assert cfg["status"] == "ok", f"Config status errato: {cfg}"
        initial_dir = cfg["download_dir"]
        print(f"  -> Cartella iniziale rilevata: {initial_dir}")

    # 2. Imposta cartella personalizzata
    custom_target = os.path.expanduser("~/Scaricati/test_cartella_yt")
    req_set = urllib.request.Request(
        f"{BASE_URL}/config",
        data=json.dumps({"download_dir": custom_target}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_set, timeout=5) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        assert res["status"] == "ok", f"Cambio cartella fallito: {res}"
        assert res["download_dir"] == custom_target, f"Cartella non aggiornata: {res}"
        print(f"  -> OK: Cartella personalizzata impostata con successo: {res['download_dir']}")

    # 3. Verifica persistenza in /status
    req_st = urllib.request.Request(f"{BASE_URL}/status")
    with urllib.request.urlopen(req_st, timeout=5) as resp:
        st = json.loads(resp.read().decode("utf-8"))
        assert st["download_dir"] == custom_target, f"Status download_dir non sincronizzato: {st}"
        print(f"  -> OK: Endpoint /status riflette la nuova cartella: {st['download_dir']}")

    # 4. Ripristina cartella iniziale
    req_restore = urllib.request.Request(
        f"{BASE_URL}/config",
        data=json.dumps({"download_dir": initial_dir}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_restore, timeout=5) as resp:
        res_rest = json.loads(resp.read().decode("utf-8"))
        assert res_rest["download_dir"] == initial_dir
        print(f"  -> OK: Cartella ripristinata correttamente a: {initial_dir}")

    # Cleanup test dir if empty
    if os.path.exists(custom_target) and not os.listdir(custom_target):
        os.rmdir(custom_target)

if __name__ == '__main__':
    print("=== AVVIO SUITE DI TEST CON CONTROLLO & INTERRUZIONE DOWNLOAD ===")
    test_status()
    test_video_info()
    test_multilingual_audio()
    test_selective_cancellation()
    test_folder_configuration()
    test_download_and_completion()
    print("=== TUTTI I TEST HANNO AVUTO SUCCESSO! ===")
