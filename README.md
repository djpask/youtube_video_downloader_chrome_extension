# YouTube Video Downloader Pro (Chrome Extension MV3) - v0.50

Estensione Chrome moderna (Manifest V3) che consente di scaricare nel proprio PC il video YouTube che si sta guardando alla **massima qualità disponibile** (4K UHD 2160p, 2K QHD 1440p, Full HD 1080p, HD 720p) e permette di **scegliere la traccia audio desiderata** (audio originale, tracce doppiaggio multilingua come Italiano, Inglese, Spagnolo, Francese, ecc., oppure formati ad alta fedeltà Opus/AAC).

---

## 🌟 Caratteristiche Principali

1. **Massima Risoluzione Video Automatica:**
   - Rileva automaticamente la risoluzione massima fornita da YouTube per il video in esecuzione (fino a 4K 2160p a 60fps o 8K) e la imposta come predefinita.
   - Permette anche di selezionare risoluzioni intermedie (1440p, 1080p, 720p, 480p).

2. **Selezione Traccia Audio:**
   - Su video con tracce audio multiple (es. video internazionali o doppiaggi multilingua come quelli di MrBeast), elenca tutte le lingue disponibili (Italiano, Inglese, Spagnolo, Francese, Tedesco, ecc.).
   - Muxing automatico ad alta fedeltà con FFmpeg per una perfetta sincronizzazione labiale e zero perdita di qualità.

3. **Integrazione Diretta in YouTube:**
   - Inietta un pulsante personalizzato **"Scarica"** direttamente nella barra delle azioni di YouTube (accanto ai tasti Mi piace, Condividi, ecc.).
   - Cliccando sul pulsante si apre una modale fluida in stile *Glassmorphism* per configurare risoluzione, traccia audio e formato con 1 clic.

4. **Pannello Gestione Download & Interruzione Selettiva:**
   - Visualizzazione in tempo reale di tutti i download in corso con velocità (MB/s), percentuale e tempo stimato (ETA).
   - Interruzione selettiva immediata di singoli download tramite pulsante **"⏹️ Interrompi"** sia dal popup sia direttamente da YouTube.
   - Pulizia automatica istantanea dei file frammentati e temporanei (`.part`).

5. **Scelta Personalizzata della Cartella di Salvataggio:**
   - Possibilità di selezionare la cartella di destinazione sia dal Popup dell'estensione che direttamente dal pannello in-page di YouTube.
   - Apertura del selettore cartelle nativo del sistema tramite pulsante **"📂 Sfoglia"** (dialog di sistema).
   - Editor manuale con validazione istantanea dei permessi e pulsanti di scelta rapida (`~/Scaricati`, `~/Video`, `~/Desktop`).
   - Salvataggio e persistenza del percorso configurato in `~/.config/youtube_video_downloader/config.json`.

6. **Popup Estensione con Navigazione a Schede:**
   - Icona nella barra del browser con stato del motore in tempo reale.
   - Rileva istantaneamente il video nella scheda attiva, mostra anteprima, durata, risoluzioni e tracce disponibili.

7. **Formati Supportati:**
   - **MP4 (Video + Audio):** Massima compatibilità universale.
   - **WebM (Video + Audio):** Massima efficienza di compressione (VP9/AV1 + Opus).
   - **MP3 / M4A (Solo Audio):** Estrazione diretta della traccia audio prescelta.

8. **Monitoraggio e Notifica:**
   - Avanzamento in tempo reale con velocità (MB/s), percentuale (0-100%) e tempo stimato (ETA).
   - Pulsante per aprire direttamente la cartella `~/Scaricati` al termine del download.

---

## 📁 Struttura del Progetto

```
youtube_video_downloader_chrome_extension/
├── manifest.json              # Configurazione Manifest V3 dell'estensione
├── icons/                     # Icone dell'estensione (16x16, 48x48, 128x128 px)
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── background/
│   └── service-worker.js      # Service worker MV3 per messaggi e gestione download
├── content/
│   ├── content.js             # Content script per iniezione pulsante e modale YouTube
│   └── content.css            # Stili glassmorphism per l'interfaccia in-page
├── popup/
│   ├── popup.html             # Interfaccia grafica del popup dell'estensione
│   ├── popup.css              # Stili moderni del popup (tema scuro, micro-animazioni)
│   └── popup.js               # Logica interattiva del popup
├── backend/                   # Motore helper locale (zero dipendenze esterne)
│   ├── server.py              # Server HTTP REST locale su porta 8765
│   ├── start.sh               # Script di avvio automatico del server
│   └── yt-dlp                 # Binario standalone bundled di yt-dlp
├── scripts/
│   ├── generate_icons.py      # Generatore delle icone PNG
│   └── test_backend.py        # Suite di test automatizzati end-to-end
├── CHROMEWEBSTORE.md          # Documentazione e metadati per pubblicazione Web Store
└── README.md                  # Questa guida
```

---

## 🚀 Installazione dell'Estensione in Google Chrome / Chromium

1. Apri Google Chrome o Chromium e naviga all'indirizzo:
   ```
   chrome://extensions/
   ```
2. In alto a destra, attiva la levetta **"Modalità sviluppatore"** (Developer mode).
3. Clicca sul pulsante **"Carica estensione non pacchettizzata"** (Load unpacked).
4. Seleziona la cartella del progetto:
   ```
   /home/pask/sw_development/youtube_video_downloader_chrome_extension
   ```
5. L'estensione **"YouTube Video Downloader Pro"** apparirà tra le estensioni attive con la sua icona rossa.

---

## ⚙️ Avvio del Motore di Download Locale (Helper)

L'estensione include un server helper locale leggerissimo (scritto in puro Python con libreria standard, senza dipendenze aggiuntive) che sfrutta la potenza di `yt-dlp` e `ffmpeg` già presenti nel sistema per scaricare a piena banda fino a 4K/8K ed eseguire il muxing delle tracce audio scelte.

Per avviare il motore locale:
```bash
/home/pask/sw_development/youtube_video_downloader_chrome_extension/backend/start.sh
```

Il server rimarrà attivo in background sulla porta `http://127.0.0.1:8765` e salverà automaticamente i file scaricati nella tua cartella **`~/Scaricati`**.

Per fermare il server helper:
```bash
/home/pask/sw_development/youtube_video_downloader_chrome_extension/backend/stop.sh
```

---

## 🧪 Verifica e Test del Funzionamento

È inclusa una suite di test end-to-end completa che verifica automaticamente tutti gli endpoint, il rilevamento della massima qualità (4K UHD), l'estrazione delle tracce audio multilingua e l'effettivo download con muxing FFmpeg:

```bash
python3 /home/pask/sw_development/youtube_video_downloader_chrome_extension/scripts/test_backend.py
```

Tutti i test completano con esito **OK** e verificano la creazione del file reale sul disco.
