# Chrome Web Store Metadata & Store Listing

## Extension Metadata
- **Name:** YouTube Video Downloader Pro
- **Version:** 1.0.0
- **Category:** Productivity / Photos & Video
- **Primary Language:** Italiano / Inglese
- **Last Updated:** 2026-10-09

## Short Description (max 132 caratteri)
Scarica video YouTube nel PC alla massima qualità disponibile (4K, 1440p, 1080p) con selezione della traccia audio preferita.

## Detailed Description
**YouTube Video Downloader Pro** è la soluzione definitiva per scaricare video da YouTube direttamente sul tuo computer alla massima risoluzione effettivamente disponibile, consentendo inoltre di scegliere la specifica traccia audio (lingua originale, doppiaggi internazionali o audio ad alta fedeltà).

### Caratteristiche Principali:
- **Massima Risoluzione Rilevata:** Rileva ed estrae flussi video fino a 4K Ultra HD (2160p), 2K Quad HD (1440p), Full HD (1080p60/1080p) e HD (720p).
- **Selezione Traccia Audio:** Consente di selezionare facilmente tra audio originale e tutte le tracce audio multilingua (es. doppiaggi in Italiano, Inglese, Spagnolo, Francese, Tedesco, Giapponese, ecc.).
- **Integrazione Nativa nell'Interfaccia YouTube:** Inietta un comodo pulsante "Scarica" direttamente sotto al player di YouTube, accanto ai pulsanti Mi piace e Condividi.
- **Popup Estensione Elegante:** Interfaccia moderna con tema scuro e glassmorphism per monitorare e gestire i download con un clic.
- **Formati Multipli:** Supporta MP4 universale, WebM ad alta efficienza e conversione diretta in solo audio MP3.
- **Muxing ad Alta Fedeltà con FFmpeg:** Combina automaticamente il flusso video alla massima qualità con la traccia audio prescelta senza perdita di sincronizzazione audio/video.
- **Monitoraggio in Tempo Reale:** Barra di avanzamento interattiva con velocità di trasferimento (MB/s), percentuale e tempo stimato (ETA).
- **Accesso Diretto ai File:** Apertura con un clic del file scaricato o della cartella di destinazione.

---

## Permissions Justification

| Permission | Justification |
| :--- | :--- |
| `activeTab` | Necessario per rilevare l'URL del video YouTube attualmente in riproduzione nella scheda attiva quando l'utente apre il popup dell'estensione. |
| `tabs` | Necessario per leggere l'URL e il titolo della scheda video di YouTube al fine di estrarre i metadati del video. |
| `storage` | Necessario per salvare localmente le preferenze dell'utente (formato predefinito, risoluzione preferita e storico dei download). |
| `downloads` | Necessario per consentire all'estensione di salvare i file multimediali scaricati nella cartella predefinita del sistema. |
| `*://*.youtube.com/*` | Necessario per iniettare il content script che aggiunge il pulsante di download e la modale di configurazione nella pagina video di YouTube. |
| `*://*.googlevideo.com/*` | Necessario per consentire l'accesso ai flussi multimediali dei video di YouTube. |
| `http://127.0.0.1:8765/*` | Necessario per comunicare con il modulo helper locale dedicato al download ad alta velocità fino a 4K e al muxing FFmpeg delle tracce audio. |

---

## Privacy & Data Use
- **Raccolta dati:** Nessun dato personale o cronologia di navigazione viene raccolto, trasmesso o venduto a terzi.
- **Archiviazione:** Tutte le preferenze e i file scaricati rimangono rigorosamente sul computer dell'utente (`localhost` e memoria locale del browser).
- **Comunicazione esterna:** L'estensione comunica unicamente con YouTube e con il demone locale `127.0.0.1:8765`.

---

## Version History
- **1.0.0 (2026-10-09):**
  - Rilascio iniziale.
  - Supporto risoluzioni fino a 4K (2160p) e 8K.
  - Selezione completa delle tracce audio multilingua e doppiaggi.
  - Pulsante in-page nativo e popup estensione glassmorphism.
  - Integrazione con helper locale e muxing FFmpeg.
