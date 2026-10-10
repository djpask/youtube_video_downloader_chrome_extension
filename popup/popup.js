// YouTube Video Downloader Pro - Popup Controller (Manifest V3)
document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Tabs
  const tabVideoBtn = document.getElementById('tab-video-btn');
  const tabDownloadsBtn = document.getElementById('tab-downloads-btn');
  const paneVideo = document.getElementById('pane-video');
  const paneDownloads = document.getElementById('pane-downloads');
  const activeDlBadge = document.getElementById('active-dl-badge');
  const downloadsSummaryTag = document.getElementById('downloads-summary-tag');
  const downloadsListContainer = document.getElementById('downloads-list-container');
  const downloadsEmpty = document.getElementById('downloads-empty');

  // Video Tab Elements
  const viewLoading = document.getElementById('view-loading');
  const viewNoVideo = document.getElementById('view-no-video');
  const viewVideo = document.getElementById('view-video');
  const helperOfflineBox = document.getElementById('helper-offline-box');
  
  const engineDot = document.getElementById('engine-dot');
  const engineStatusText = document.getElementById('engine-status-text');
  const downloadFolderText = document.getElementById('download-folder-path');
  const activeFolderPath = document.getElementById('active-folder-path');
  const btnBrowseFolder = document.getElementById('btn-browse-folder');
  const btnEditFolder = document.getElementById('btn-edit-folder');
  const folderPreviewBox = document.getElementById('folder-preview-box');
  const folderInlineEditor = document.getElementById('folder-inline-editor');
  const inputFolderPath = document.getElementById('input-folder-path');
  const btnSaveFolder = document.getElementById('btn-save-folder');
  const btnCancelFolder = document.getElementById('btn-cancel-folder');
  const folderStatusMsg = document.getElementById('folder-status-msg');
  const btnFooterChangeFolder = document.getElementById('btn-footer-change-folder');

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
  const btnCancelCurrent = document.getElementById('btn-cancel-current');
  const btnRevealFolder = document.getElementById('btn-reveal-folder');

  let currentVideoUrl = null;
  let currentVideoData = null;
  let currentDownloadId = null;
  let selectedFormat = 'mp4';
  let activeTab = 'tab-video';
  let pollInterval = null;
  let currentDownloadDir = '~/Scaricati';

  // Tab switching
  tabVideoBtn.addEventListener('click', () => switchTab('tab-video'));
  tabDownloadsBtn.addEventListener('click', () => switchTab('tab-downloads'));

  function switchTab(tabId) {
    activeTab = tabId;
    if (tabId === 'tab-video') {
      tabVideoBtn.classList.add('active');
      tabDownloadsBtn.classList.remove('active');
      paneVideo.style.display = 'block';
      paneDownloads.style.display = 'none';
    } else {
      tabVideoBtn.classList.remove('active');
      tabDownloadsBtn.classList.add('active');
      paneVideo.style.display = 'none';
      paneDownloads.style.display = 'block';
      refreshDownloadsList();
    }
  }

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

  function updateFolderDisplay(path) {
    if (!path) return;
    currentDownloadDir = path;
    if (activeFolderPath) activeFolderPath.textContent = path;
    if (downloadFolderText) downloadFolderText.textContent = path;
    if (inputFolderPath) inputFolderPath.value = path;
  }

  function showFolderMessage(msg, type = 'error') {
    if (!folderStatusMsg) return;
    folderStatusMsg.textContent = msg;
    folderStatusMsg.className = `folder-status-msg ${type}`;
    folderStatusMsg.style.display = 'block';
    setTimeout(() => {
      if (folderStatusMsg) folderStatusMsg.style.display = 'none';
    }, 4000);
  }

  function openFolderEditor() {
    if (folderPreviewBox) folderPreviewBox.style.display = 'none';
    if (folderInlineEditor) folderInlineEditor.style.display = 'flex';
    if (inputFolderPath) {
      inputFolderPath.value = currentDownloadDir;
      inputFolderPath.focus();
    }
  }

  function closeFolderEditor() {
    if (folderInlineEditor) folderInlineEditor.style.display = 'none';
    if (folderPreviewBox) folderPreviewBox.style.display = 'flex';
    if (folderStatusMsg) folderStatusMsg.style.display = 'none';
  }

  async function handleBrowseFolder() {
    const btn = btnBrowseFolder;
    const oldText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Apertura...';
    }
    try {
      const res = await chrome.runtime.sendMessage({ action: 'SELECT_FOLDER' });
      if (res && res.status === 'ok' && res.download_dir) {
        updateFolderDisplay(res.download_dir);
        showFolderMessage('✅ Cartella aggiornata: ' + res.download_dir, 'success');
      } else if (res && res.status === 'unsupported') {
        openFolderEditor();
      }
    } catch (e) {
      console.warn('Browse error:', e);
      openFolderEditor();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  async function handleSaveCustomFolder() {
    const val = inputFolderPath ? inputFolderPath.value.trim() : '';
    if (!val) {
      showFolderMessage('Inserisci un percorso valido', 'error');
      return;
    }
    if (btnSaveFolder) {
      btnSaveFolder.disabled = true;
      btnSaveFolder.textContent = 'Verifica...';
    }
    try {
      const res = await chrome.runtime.sendMessage({
        action: 'SET_CONFIG',
        download_dir: val
      });
      if (res && res.status === 'ok' && res.download_dir) {
        updateFolderDisplay(res.download_dir);
        closeFolderEditor();
      } else {
        showFolderMessage(res?.message || res?.error || 'Percorso non valido o inaccessibile', 'error');
      }
    } catch (e) {
      showFolderMessage('Errore: ' + e.message, 'error');
    } finally {
      if (btnSaveFolder) {
        btnSaveFolder.disabled = false;
        btnSaveFolder.textContent = 'Salva';
      }
    }
  }

  if (btnBrowseFolder) btnBrowseFolder.addEventListener('click', handleBrowseFolder);
  if (btnFooterChangeFolder) btnFooterChangeFolder.addEventListener('click', handleBrowseFolder);
  if (btnEditFolder) btnEditFolder.addEventListener('click', openFolderEditor);
  if (folderPreviewBox) folderPreviewBox.addEventListener('click', openFolderEditor);
  if (btnCancelFolder) btnCancelFolder.addEventListener('click', closeFolderEditor);
  if (btnSaveFolder) btnSaveFolder.addEventListener('click', handleSaveCustomFolder);

  if (inputFolderPath) {
    inputFolderPath.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSaveCustomFolder();
      else if (e.key === 'Escape') closeFolderEditor();
    });
  }

  document.querySelectorAll('.preset-tag').forEach((tag) => {
    tag.addEventListener('click', () => {
      const p = tag.getAttribute('data-preset');
      if (p && inputFolderPath) {
        inputFolderPath.value = p;
      }
    });
  });

  async function checkHelper() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'CHECK_HELPER' });
      if (res && res.active) {
        engineDot.className = 'status-dot active';
        engineStatusText.textContent = 'Engine Attivo';
        if (res.download_dir) {
          updateFolderDisplay(res.download_dir);
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

  // Fetch and display all downloads in Tab 2
  async function refreshDownloadsList() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'GET_ALL_DOWNLOADS' });
      const items = res?.downloads || [];
      
      const activeItems = items.filter(d => ['starting', 'downloading', 'muxing'].includes(d.status));
      const activeCount = activeItems.length;

      // Update badge
      if (activeCount > 0) {
        activeDlBadge.style.display = 'inline-block';
        activeDlBadge.textContent = String(activeCount);
      } else {
        activeDlBadge.style.display = 'none';
      }

      downloadsSummaryTag.textContent = `${activeCount} in corso (${items.length} totali)`;

      if (items.length === 0) {
        downloadsListContainer.innerHTML = '';
        downloadsEmpty.style.display = 'block';
        return;
      }

      downloadsEmpty.style.display = 'none';
      renderDownloadsCards(items);
    } catch (err) {
      console.error('Error refreshing downloads list:', err);
    }
  }

  function renderDownloadsCards(items) {
    downloadsListContainer.innerHTML = '';

    items.forEach((item) => {
      const card = document.createElement('div');
      const isActive = ['starting', 'downloading', 'muxing'].includes(item.status);
      card.className = `download-item-card ${isActive ? 'is-active' : ''}`;

      let statusLabel = 'In attesa...';
      let statusClass = 'downloading';
      if (item.status === 'downloading') {
        statusLabel = `Scaricamento ${Math.round(item.percent || 0)}%`;
        statusClass = 'downloading';
      } else if (item.status === 'muxing') {
        statusLabel = 'Muxing FFmpeg...';
        statusClass = 'muxing';
      } else if (item.status === 'completed') {
        statusLabel = 'Completato';
        statusClass = 'completed';
      } else if (item.status === 'cancelled') {
        statusLabel = 'Interrotto';
        statusClass = 'cancelled';
      } else if (item.status === 'error') {
        statusLabel = 'Errore';
        statusClass = 'error';
      }

      const qualityBadge = item.quality === 'max' ? 'Max Qualità' : `${item.quality}p`;
      const formatBadge = (item.format || 'mp4').toUpperCase();

      card.innerHTML = `
        <div class="dl-item-top">
          <div class="dl-item-title" title="${escapeHtml(item.title || '')}">${escapeHtml(item.title || 'Video YouTube')}</div>
          <span class="dl-status-tag ${statusClass}">${statusLabel}</span>
        </div>

        <div class="dl-item-tags">
          <span class="dl-badge">${qualityBadge}</span>
          <span class="dl-badge">${formatBadge}</span>
          ${item.filename ? `<span class="dl-badge">${escapeHtml(item.filename)}</span>` : ''}
        </div>

        ${isActive ? `
          <div class="progress-bar-track" style="margin: 4px 0;">
            <div class="progress-bar-fill" style="width: ${Math.min(100, Math.max(0, item.percent || 0))}%;"></div>
          </div>
        ` : ''}

        <div class="dl-item-bottom">
          <div class="dl-item-progress-info">
            ${isActive && item.speed ? `<span>${item.speed}</span>` : ''}
            ${isActive && item.eta ? `<span>ETA ${item.eta}</span>` : ''}
            ${!isActive && item.error ? `<span style="color:#ff5566;">${escapeHtml(item.error)}</span>` : ''}
          </div>
          <div class="dl-item-actions">
            ${isActive ? `
              <button class="btn btn-danger-sm btn-cancel-task" data-id="${item.id}">
                ⏹️ Interrompi
              </button>
            ` : ''}
            ${item.status === 'completed' && item.path ? `
              <button class="btn btn-secondary btn-sm btn-open-file" data-path="${escapeHtml(item.path)}">
                📁 Apri
              </button>
            ` : ''}
          </div>
        </div>
      `;

      // Cancel button event
      const cancelBtn = card.querySelector('.btn-cancel-task');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
          cancelBtn.disabled = true;
          cancelBtn.textContent = 'Interruzione...';
          await cancelTask(item.id);
        });
      }

      // Open file event
      const openBtn = card.querySelector('.btn-open-file');
      if (openBtn) {
        openBtn.addEventListener('click', async () => {
          await chrome.runtime.sendMessage({
            action: 'OPEN_FOLDER',
            path: item.path
          });
        });
      }

      downloadsListContainer.appendChild(card);
    });
  }

  async function cancelTask(downloadId) {
    try {
      await chrome.runtime.sendMessage({
        action: 'CANCEL_DOWNLOAD',
        downloadId
      });
      await refreshDownloadsList();
      if (currentDownloadId === downloadId) {
        progStatus.textContent = '⏹️ Download interrotto dall\'utente';
        btnStartDownload.disabled = false;
        btnStartDownload.innerHTML = `<span>Scarica nel PC</span>`;
        btnCancelCurrent.style.display = 'none';
      }
    } catch (e) {
      console.error('Failed to cancel download:', e);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function init() {
    viewLoading.style.display = 'flex';
    viewNoVideo.style.display = 'none';
    viewVideo.style.display = 'none';

    const helperOk = await checkHelper();
    await refreshDownloadsList();

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
      format: selectedFormat,
      output_dir: currentDownloadDir
    };

    try {
      const startRes = await chrome.runtime.sendMessage({
        action: 'START_DOWNLOAD',
        payload
      });

      if (startRes && startRes.download_id) {
        currentDownloadId = startRes.download_id;
        startPollingProgress(startRes.download_id);
        await refreshDownloadsList();
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

  // Cancel current download button
  btnCancelCurrent.addEventListener('click', async () => {
    if (currentDownloadId) {
      btnCancelCurrent.disabled = true;
      btnCancelCurrent.textContent = 'Interruzione...';
      await cancelTask(currentDownloadId);
    }
  });

  function startPollingProgress(downloadId) {
    progressBox.style.display = 'block';
    btnCancelCurrent.style.display = 'inline-block';
    btnCancelCurrent.disabled = false;
    btnCancelCurrent.textContent = '⏹️ Interrompi questo download';
    btnRevealFolder.style.display = 'none';

    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
      try {
        const prog = await chrome.runtime.sendMessage({
          action: 'GET_PROGRESS',
          downloadId
        });

        await refreshDownloadsList();

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
          btnCancelCurrent.style.display = 'none';
          btnRevealFolder.style.display = 'inline-block';

          btnStartDownload.disabled = false;
          btnStartDownload.innerHTML = `<span>Scarica di nuovo</span>`;

          btnRevealFolder.onclick = async () => {
            await chrome.runtime.sendMessage({
              action: 'OPEN_FOLDER',
              path: prog.path
            });
          };
        } else if (prog.status === 'cancelled') {
          clearInterval(pollInterval);
          progStatus.textContent = '⏹️ Download interrotto dall\'utente';
          btnCancelCurrent.style.display = 'none';
          btnStartDownload.disabled = false;
          btnStartDownload.innerHTML = `<span>Scarica nel PC</span>`;
        } else if (prog.status === 'error') {
          clearInterval(pollInterval);
          progStatus.textContent = '❌ Errore durante il download';
          progSpeed.textContent = prog.error || 'Errore processo';
          btnCancelCurrent.style.display = 'none';
          btnStartDownload.disabled = false;
          btnStartDownload.innerHTML = `<span>Riprova</span>`;
        }
      } catch (err) {
        console.error('Error polling:', err);
      }
    }, 1000);
  }

  await init();

  // Periodic polling for general downloads list every 2.5s
  setInterval(async () => {
    if (activeTab === 'tab-downloads') {
      await refreshDownloadsList();
    }
  }, 2000);
});
