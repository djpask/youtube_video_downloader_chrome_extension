// YouTube Video Downloader Pro - Content Script (Manifest V3)
(() => {
  'use strict';

  let currentVideoUrl = null;
  let activeModal = null;
  let pollInterval = null;

  // Icons SVG
  const DOWNLOAD_ICON = `
    <svg viewBox="0 0 24 24">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
    </svg>`;

  function isWatchPage() {
    return window.location.pathname === '/watch' || window.location.pathname.startsWith('/shorts/');
  }

  function getCleanVideoUrl() {
    const url = new URL(window.location.href);
    if (url.pathname === '/watch') {
      const v = url.searchParams.get('v');
      return v ? `https://www.youtube.com/watch?v=${v}` : window.location.href;
    }
    return window.location.href;
  }

  // Inject download button into YouTube actions bar
  function injectDownloadButton() {
    if (!isWatchPage()) return;
    if (document.getElementById('ytd-action-download-btn')) return;

    // Potential container targets across different YouTube layouts
    const containers = [
      '#top-level-buttons-computed',
      'ytd-watch-metadata #actions #top-level-buttons-computed',
      '#actions-inner #top-level-buttons-computed',
      '#menu-container #top-level-buttons-computed',
      'ytd-menu-renderer.ytd-watch-metadata'
    ];

    let targetBar = null;
    for (const selector of containers) {
      const el = document.querySelector(selector);
      if (el) {
        targetBar = el;
        break;
      }
    }

    if (!targetBar) return;

    const btn = document.createElement('button');
    btn.id = 'ytd-action-download-btn';
    btn.className = 'ytd-downloader-action-btn';
    btn.title = 'Scarica questo video alla massima qualità e scegli la traccia audio';
    btn.innerHTML = `${DOWNLOAD_ICON}<span>Scarica</span>`;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDownloaderModal();
    });

    // Insert after standard buttons
    targetBar.appendChild(btn);
  }

  // Open Downloader Modal
  async function openDownloaderModal() {
    if (activeModal) {
      activeModal.classList.add('active');
      return;
    }

    const videoUrl = getCleanVideoUrl();
    currentVideoUrl = videoUrl;

    // Create modal DOM
    const overlay = document.createElement('div');
    overlay.className = 'ytd-modal-overlay';
    overlay.id = 'ytd-downloader-modal';

    overlay.innerHTML = `
      <div class="ytd-modal-dialog">
        <div class="ytd-modal-header">
          <div class="ytd-modal-title-wrap">
            <div class="ytd-modal-logo">
              <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            </div>
            <div class="ytd-modal-title">YouTube Video Downloader Pro</div>
          </div>
          <button class="ytd-modal-close-btn" id="ytd-modal-close">×</button>
        </div>

        <div class="ytd-modal-body">
          <div id="ytd-modal-loading" style="text-align:center; padding: 30px 10px;">
            <div class="ytd-spinner" style="margin: 0 auto 12px; width: 28px; height: 28px; border-width: 3px;"></div>
            <div style="font-size: 14px; color: #bbb;">Analisi risoluzioni massime e tracce audio disponibili...</div>
          </div>

          <div id="ytd-modal-content" style="display: none;">
            <div class="ytd-video-preview">
              <div class="ytd-preview-thumb-wrap">
                <img class="ytd-preview-thumb" id="ytd-thumb" src="" alt="Thumbnail">
              </div>
              <div class="ytd-preview-info">
                <div class="ytd-preview-title" id="ytd-title">Titolo video</div>
                <div class="ytd-preview-channel" id="ytd-channel">Canale</div>
              </div>
            </div>

            <div class="ytd-max-quality-badge" id="ytd-max-badge">
              ⭐ Massima Qualità Rilevata: <span id="ytd-max-label">Analisi...</span>
            </div>

            <div class="ytd-form-group">
              <label class="ytd-form-label" for="ytd-select-quality">
                <span>Risoluzione Video</span>
                <span style="font-size: 11px; color: #ff4d6d;">Massima qualità consigliata</span>
              </label>
              <select class="ytd-select" id="ytd-select-quality"></select>
            </div>

            <div class="ytd-form-group">
              <label class="ytd-form-label" for="ytd-select-audio">
                <span>Traccia Audio</span>
                <span style="font-size: 11px; color: #888;" id="ytd-audio-count">1 disponibile</span>
              </label>
              <select class="ytd-select" id="ytd-select-audio"></select>
            </div>

            <div class="ytd-form-group">
              <label class="ytd-form-label">Formato di Salvataggio</label>
              <div class="ytd-format-pills">
                <div class="ytd-pill-btn active" data-format="mp4">MP4 (Video)</div>
                <div class="ytd-pill-btn" data-format="webm">WebM (Video)</div>
                <div class="ytd-pill-btn" data-format="audio_only">MP3 (Solo Audio)</div>
              </div>
            </div>

            <button class="ytd-download-start-btn" id="ytd-start-download">
              <svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              <span>Scarica nel PC</span>
            </button>

            <!-- Progress section -->
            <div class="ytd-progress-section" id="ytd-progress-box">
              <div class="ytd-progress-header">
                <span id="ytd-prog-status">Preparazione...</span>
                <span id="ytd-prog-percent">0%</span>
              </div>
              <div class="ytd-progress-bar-bg">
                <div class="ytd-progress-bar-fill" id="ytd-prog-bar"></div>
              </div>
              <div class="ytd-progress-meta">
                <span id="ytd-prog-speed">-- MB/s</span>
                <span id="ytd-prog-eta">ETA --:--</span>
              </div>
              <div class="ytd-complete-actions" id="ytd-complete-box">
                <button class="ytd-open-folder-btn" id="ytd-open-folder">
                  📁 Mostra nella cartella Scaricati
                </button>
              </div>
            </div>
          </div>

          <div id="ytd-modal-error" style="display: none; padding: 15px; background: rgba(255, 0, 51, 0.1); border: 1px solid rgba(255, 0, 51, 0.3); border-radius: 10px; color: #ff8093; font-size: 13px; line-height: 1.4;">
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    activeModal = overlay;

    // Event listeners for close
    document.getElementById('ytd-modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Format pills selector
    let selectedFormat = 'mp4';
    overlay.querySelectorAll('.ytd-pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.ytd-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedFormat = btn.getAttribute('data-format');
      });
    });

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('active'));

    // Request video info from background / helper
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'GET_VIDEO_INFO',
        url: videoUrl
      });

      if (!response || response.error) {
        showError(response?.error || 'Impossibile contattare il server locale. Assicurati che backend/start.sh sia avviato.');
        return;
      }

      renderVideoData(response, selectedFormat, videoUrl);
    } catch (err) {
      showError('Errore di comunicazione: ' + err.message);
    }
  }

  function renderVideoData(info, initialFormat, videoUrl) {
    document.getElementById('ytd-modal-loading').style.display = 'none';
    const content = document.getElementById('ytd-modal-content');
    content.style.display = 'block';

    document.getElementById('ytd-thumb').src = info.thumbnail || '';
    document.getElementById('ytd-title').textContent = info.title || 'Video YouTube';
    document.getElementById('ytd-channel').textContent = info.channel || '';
    document.getElementById('ytd-max-label').textContent = info.maxQuality || 'Massima qualità';

    // Populate video qualities (Max Quality first!)
    const qualitySelect = document.getElementById('ytd-select-quality');
    qualitySelect.innerHTML = '';

    const maxOpt = document.createElement('option');
    maxOpt.value = 'max';
    maxOpt.textContent = `⭐ ${info.maxQuality || 'Massima Qualità'} (Predefinita)`;
    qualitySelect.appendChild(maxOpt);

    if (info.videoQualities && info.videoQualities.length > 0) {
      info.videoQualities.forEach((q) => {
        const opt = document.createElement('option');
        opt.value = q.height;
        opt.textContent = `${q.label} [${q.height}p]`;
        qualitySelect.appendChild(opt);
      });
    }

    // Populate audio tracks
    const audioSelect = document.getElementById('ytd-select-audio');
    audioSelect.innerHTML = '';

    if (info.audioTracks && info.audioTracks.length > 0) {
      document.getElementById('ytd-audio-count').textContent = `${info.audioTracks.length} tracc${info.audioTracks.length === 1 ? 'ia' : 'e'} disponib.${info.audioTracks.length === 1 ? '' : 'i'}`;
      info.audioTracks.forEach((track) => {
        const opt = document.createElement('option');
        opt.value = track.id;
        opt.textContent = track.label;
        if (track.is_default) opt.selected = true;
        audioSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = 'auto';
      opt.textContent = 'Audio Predefinito (Originale)';
      audioSelect.appendChild(opt);
    }

    // Start download handler
    const startBtn = document.getElementById('ytd-start-download');
    startBtn.onclick = async () => {
      startBtn.disabled = true;
      startBtn.innerHTML = `<div class="ytd-spinner"></div><span>Avvio download...</span>`;

      let chosenFormat = 'mp4';
      const activePill = document.querySelector('.ytd-pill-btn.active');
      if (activePill) chosenFormat = activePill.getAttribute('data-format');

      const payload = {
        url: videoUrl,
        title: info.title,
        quality: qualitySelect.value,
        audio_track_id: audioSelect.value,
        format: chosenFormat
      };

      try {
        const startRes = await chrome.runtime.sendMessage({
          action: 'START_DOWNLOAD',
          payload
        });

        if (startRes && startRes.download_id) {
          trackDownloadProgress(startRes.download_id);
        } else {
          showError('Impossibile avviare il download: ' + (startRes?.error || 'Errore sconosciuto'));
          startBtn.disabled = false;
          startBtn.innerHTML = `<span>Riprova</span>`;
        }
      } catch (err) {
        showError('Errore durante l\'avvio: ' + err.message);
        startBtn.disabled = false;
        startBtn.innerHTML = `<span>Riprova</span>`;
      }
    };
  }

  function trackDownloadProgress(downloadId) {
    const progBox = document.getElementById('ytd-progress-box');
    progBox.classList.add('visible');

    const statusEl = document.getElementById('ytd-prog-status');
    const percentEl = document.getElementById('ytd-prog-percent');
    const barEl = document.getElementById('ytd-prog-bar');
    const speedEl = document.getElementById('ytd-prog-speed');
    const etaEl = document.getElementById('ytd-prog-eta');
    const completeBox = document.getElementById('ytd-complete-box');
    const startBtn = document.getElementById('ytd-start-download');

    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
      try {
        const prog = await chrome.runtime.sendMessage({
          action: 'GET_PROGRESS',
          downloadId
        });

        if (!prog) return;

        if (prog.status === 'downloading') {
          statusEl.textContent = 'Download flussi video e audio...';
          const p = Math.min(100, Math.max(0, prog.percent || 0));
          percentEl.textContent = `${p.toFixed(1)}%`;
          barEl.style.width = `${p}%`;
          speedEl.textContent = prog.speed ? `Velocità: ${prog.speed}` : '';
          etaEl.textContent = prog.eta ? `Tempo rimasto: ${prog.eta}` : '';
        } else if (prog.status === 'muxing') {
          statusEl.textContent = 'Muxing alta fedeltà con FFmpeg...';
          barEl.style.width = '99%';
          percentEl.textContent = '99%';
        } else if (prog.status === 'completed') {
          clearInterval(pollInterval);
          statusEl.textContent = '✅ Download completato con successo!';
          barEl.style.width = '100%';
          percentEl.textContent = '100%';
          speedEl.textContent = 'Salvato nella cartella Scaricati';
          etaEl.textContent = prog.filename || '';
          completeBox.classList.add('visible');

          startBtn.disabled = false;
          startBtn.innerHTML = `<span>Scarica di nuovo</span>`;

          document.getElementById('ytd-open-folder').onclick = async () => {
            await chrome.runtime.sendMessage({
              action: 'OPEN_FOLDER',
              path: prog.path
            });
          };
        } else if (prog.status === 'error') {
          clearInterval(pollInterval);
          statusEl.textContent = '❌ Errore durante il download';
          showError(prog.error || 'Errore nel processo di download.');
          startBtn.disabled = false;
          startBtn.innerHTML = `<span>Riprova</span>`;
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 800);
  }

  function showError(msg) {
    document.getElementById('ytd-modal-loading').style.display = 'none';
    const errBox = document.getElementById('ytd-modal-error');
    errBox.style.display = 'block';
    errBox.innerHTML = `
      <strong>Attenzione:</strong> ${msg}
      <div style="margin-top: 8px; font-size: 12px; color: #ddd;">
        💡 Per abilitare il download alla massima qualità 4K e tutte le tracce audio, assicurati che il server sia attivo eseguendo nel terminale:<br>
        <code style="background: rgba(0,0,0,0.4); padding: 3px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">sw_development/youtube_video_downloader_chrome_extension/backend/start.sh</code>
      </div>
    `;
  }

  function closeModal() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (activeModal) {
      activeModal.classList.remove('active');
      setTimeout(() => {
        if (activeModal && activeModal.parentNode) {
          activeModal.parentNode.removeChild(activeModal);
        }
        activeModal = null;
      }, 250);
    }
  }

  // Observer to detect YouTube SPA transitions
  function initObserver() {
    injectDownloadButton();

    window.addEventListener('yt-navigate-finish', () => {
      setTimeout(injectDownloadButton, 500);
    });

    const observer = new MutationObserver(() => {
      if (isWatchPage() && !document.getElementById('ytd-action-download-btn')) {
        injectDownloadButton();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver);
  } else {
    initObserver();
  }
})();
