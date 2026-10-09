// YouTube Video Downloader Pro - Popup Controller (Manifest V3)
document.addEventListener('DOMContentLoaded', async () => {
  const viewLoading = document.getElementById('view-loading');
  const viewNoVideo = document.getElementById('view-no-video');
  const viewVideo = document.getElementById('view-video');
  const helperOfflineBox = document.getElementById('helper-offline-box');
  
  const engineDot = document.getElementById('engine-dot');
  const engineStatusText = document.getElementById('engine-status-text');
  const downloadFolderText = document.getElementById('download-folder-path');

  const videoThumb = document.getElementById('video-thumb');
  const videoTitle = document.getElementById('video-title');
  const videoChannel = document.getElementById('video-channel');
  const maxQualityText = document.getElementById('max-quality-text');
  const selectQuality = document.getElementById('select-quality');
  const selectAudio = document.getElementById('select-audio');
  const audioTracksCount = document.getElementById('audio-tracks-count');
  
  const btnStartDownload = document.getElementById('btn-start-download');
  const progressBox = document.getElementById('progress-box');
  const progStatus = document.getElementById('prog-status');
  const progPercent = document.getElementById('prog-percent');
  const progBarFill = document.getElementById('prog-bar-fill');
  const progSpeed = document.getElementById('prog-speed');
  const progEta = document.getElementById('prog-eta');
  const completedActions = document.getElementById('completed-actions');
  const btnRevealFolder = document.getElementById('btn-reveal-folder');

  let currentVideoUrl = null;
  let currentVideoData = null;
  let selectedFormat = 'mp4';
  let pollInterval = null;

  // Format chip selection
  document.querySelectorAll('.format-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.format-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedFormat = chip.getAttribute('data-format');
    });
  });

  // Open YouTube button
  document.getElementById('btn-open-youtube').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.youtube.com' });
    window.close();
  });

  // Retry helper connection
  document.getElementById('btn-retry-helper').addEventListener('click', async () => {
    await init();
  });

  async function checkHelper() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'CHECK_HELPER' });
      if (res && res.active) {
        engineDot.className = 'status-dot active';
        engineStatusText.textContent = 'Engine Attivo';
        if (res.download_dir) {
          downloadFolderText.textContent = res.download_dir;
        }
        helperOfflineBox.style.display = 'none';
        return true;
      }
    } catch (e) {
      console.warn('Helper check failed:', e);
    }

    engineDot.className = 'status-dot error';
    engineStatusText.textContent = 'Engine Offline';
    helperOfflineBox.style.display = 'block';
    return false;
  }

  function formatDuration(seconds) {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  async function init() {
    viewLoading.style.display = 'flex';
    viewNoVideo.style.display = 'none';
    viewVideo.style.display = 'none';

    const helperOk = await checkHelper();

    // Query active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      viewLoading.style.display = 'none';
      viewNoVideo.style.display = 'flex';
      return;
    }

    const url = new URL(tab.url);
    const isYTWatch = url.hostname.includes('youtube.com') && (url.pathname === '/watch' || url.pathname.startsWith('/shorts/'));

    if (!isYTWatch) {
      viewLoading.style.display = 'none';
      viewNoVideo.style.display = 'flex';
      return;
    }

    let cleanUrl = tab.url;
    if (url.pathname === '/watch') {
      const v = url.searchParams.get('v');
      cleanUrl = v ? `https://www.youtube.com/watch?v=${v}` : tab.url;
    }
    currentVideoUrl = cleanUrl;

    if (!helperOk) {
      viewLoading.style.display = 'none';
      viewVideo.style.display = 'block';
      videoTitle.textContent = tab.title.replace(' - YouTube', '') || 'Video YouTube';
      btnStartDownload.disabled = true;
      return;
    }

    // Fetch full video metadata with video qualities & audio tracks
    try {
      const info = await chrome.runtime.sendMessage({
        action: 'GET_VIDEO_INFO',
        url: cleanUrl
      });

      viewLoading.style.display = 'none';

      if (!info || info.error) {
        viewNoVideo.style.display = 'flex';
        viewNoVideo.querySelector('h3').textContent = 'Analisi video fallita';
        viewNoVideo.querySelector('p').textContent = info?.error || 'Impossibile estrarre informazioni dal video.';
        return;
      }

      currentVideoData = info;
      displayVideoInfo(info);
    } catch (err) {
      viewLoading.style.display = 'none';
      viewNoVideo.style.display = 'flex';
      viewNoVideo.querySelector('h3').textContent = 'Errore di connessione';
      viewNoVideo.querySelector('p').textContent = err.message;
    }
  }

  function displayVideoInfo(info) {
    viewVideo.style.display = 'block';

    videoThumb.src = info.thumbnail || '';
    videoTitle.textContent = info.title || 'Video senza titolo';
    videoChannel.textContent = info.channel || '';
    document.getElementById('video-duration').textContent = formatDuration(info.duration);
    maxQualityText.textContent = info.maxQuality || 'Massima qualità';

    // Populate video qualities
    selectQuality.innerHTML = '';
    const maxOpt = document.createElement('option');
    maxOpt.value = 'max';
    maxOpt.textContent = `⭐ ${info.maxQuality || 'Massima Qualità'} (Consigliata)`;
    selectQuality.appendChild(maxOpt);

    if (info.videoQualities && info.videoQualities.length > 0) {
      info.videoQualities.forEach((q) => {
        const opt = document.createElement('option');
        opt.value = q.height;
        opt.textContent = `${q.label} [${q.height}p]`;
        selectQuality.appendChild(opt);
      });
    }

    // Populate audio tracks
    selectAudio.innerHTML = '';
    if (info.audioTracks && info.audioTracks.length > 0) {
      audioTracksCount.textContent = `${info.audioTracks.length} tracc${info.audioTracks.length === 1 ? 'ia' : 'e'}`;
      info.audioTracks.forEach((track) => {
        const opt = document.createElement('option');
        opt.value = track.id;
        opt.textContent = track.label;
        if (track.is_default) opt.selected = true;
        selectAudio.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = 'auto';
      opt.textContent = 'Audio Predefinito (Originale)';
      selectAudio.appendChild(opt);
    }

    btnStartDownload.disabled = false;
  }

  // Handle Download Click
  btnStartDownload.addEventListener('click', async () => {
    btnStartDownload.disabled = true;
    btnStartDownload.innerHTML = `<div class="spinner" style="width:16px;height:16px;margin:0;border-width:2px;"></div><span>Avvio...</span>`;

    const payload = {
      url: currentVideoUrl,
      title: currentVideoData?.title || 'Video YouTube',
      quality: selectQuality.value,
      audio_track_id: selectAudio.value,
      format: selectedFormat
    };

    try {
      const startRes = await chrome.runtime.sendMessage({
        action: 'START_DOWNLOAD',
        payload
      });

      if (startRes && startRes.download_id) {
        startPollingProgress(startRes.download_id);
      } else {
        alert('Errore: ' + (startRes?.error || 'Impossibile iniziare il download'));
        btnStartDownload.disabled = false;
        btnStartDownload.innerHTML = `<span>Scarica nel PC</span>`;
      }
    } catch (e) {
      alert('Errore durante la richiesta: ' + e.message);
      btnStartDownload.disabled = false;
      btnStartDownload.innerHTML = `<span>Scarica nel PC</span>`;
    }
  });

  function startPollingProgress(downloadId) {
    progressBox.style.display = 'block';
    completedActions.style.display = 'none';

    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
      try {
        const prog = await chrome.runtime.sendMessage({
          action: 'GET_PROGRESS',
          downloadId
        });

        if (!prog) return;

        if (prog.status === 'downloading') {
          progStatus.textContent = 'Download flussi alta qualità...';
          const p = Math.min(100, Math.max(0, prog.percent || 0));
          progPercent.textContent = `${p.toFixed(1)}%`;
          progBarFill.style.width = `${p}%`;
          progSpeed.textContent = prog.speed ? `Velocità: ${prog.speed}` : '';
          progEta.textContent = prog.eta ? `ETA: ${prog.eta}` : '';
        } else if (prog.status === 'muxing') {
          progStatus.textContent = 'Muxing FFmpeg in corso...';
          progBarFill.style.width = '99%';
          progPercent.textContent = '99%';
        } else if (prog.status === 'completed') {
          clearInterval(pollInterval);
          progStatus.textContent = '✅ Download completato!';
          progBarFill.style.width = '100%';
          progPercent.textContent = '100%';
          progSpeed.textContent = 'Salvato sul PC';
          progEta.textContent = prog.filename || '';
          completedActions.style.display = 'block';

          btnStartDownload.disabled = false;
          btnStartDownload.innerHTML = `<span>Scarica di nuovo</span>`;

          btnRevealFolder.onclick = async () => {
            await chrome.runtime.sendMessage({
              action: 'OPEN_FOLDER',
              path: prog.path
            });
          };
        } else if (prog.status === 'error') {
          clearInterval(pollInterval);
          progStatus.textContent = '❌ Errore durante il download';
          progSpeed.textContent = prog.error || 'Errore processo';
          btnStartDownload.disabled = false;
          btnStartDownload.innerHTML = `<span>Riprova</span>`;
        }
      } catch (err) {
        console.error('Error polling:', err);
      }
    }, 800);
  }

  await init();
});
