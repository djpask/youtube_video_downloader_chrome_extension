// YouTube Video Downloader Pro - Service Worker (Manifest V3)
const HELPER_BASE_URL = 'http://127.0.0.1:8765';

// Helper API communication
async function checkHelperStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const resp = await fetch(`${HELPER_BASE_URL}/status`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!resp.ok) return { active: false };
    const data = await resp.json();
    return { active: true, ...data };
  } catch (err) {
    return { active: false, error: err.message };
  }
}

async function getVideoInfo(videoUrl) {
  try {
    const resp = await fetch(`${HELPER_BASE_URL}/video_info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.details || err.error || `HTTP error ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function startDownload(payload) {
  try {
    const resp = await fetch(`${HELPER_BASE_URL}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP error ${resp.status}`);
    }
    return await resp.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function getDownloadProgress(downloadId) {
  try {
    const resp = await fetch(`${HELPER_BASE_URL}/progress?id=${encodeURIComponent(downloadId)}`);
    if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
    return await resp.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function openFolder(targetPath) {
  try {
    const resp = await fetch(`${HELPER_BASE_URL}/open_folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetPath })
    });
    return await resp.json();
  } catch (err) {
    return { error: err.message };
  }
}

// Runtime message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'CHECK_HELPER': {
        const status = await checkHelperStatus();
        sendResponse(status);
        break;
      }

      case 'GET_VIDEO_INFO': {
        const info = await getVideoInfo(message.url);
        sendResponse(info);
        break;
      }

      case 'START_DOWNLOAD': {
        const res = await startDownload(message.payload);
        if (res.download_id) {
          // Store active download in storage
          const { activeDownloads = [] } = await chrome.storage.local.get('activeDownloads');
          activeDownloads.unshift({
            id: res.download_id,
            title: message.payload.title || 'Video',
            url: message.payload.url,
            startedAt: Date.now()
          });
          await chrome.storage.local.set({ activeDownloads: activeDownloads.slice(0, 15) });
        }
        sendResponse(res);
        break;
      }

      case 'GET_PROGRESS': {
        const prog = await getDownloadProgress(message.downloadId);
        sendResponse(prog);
        break;
      }

      case 'OPEN_FOLDER': {
        const res = await openFolder(message.path);
        sendResponse(res);
        break;
      }

      default:
        sendResponse({ error: 'Unknown action' });
    }
  })();
  return true; // Keep message channel open for async response
});

// Update badge if needed
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: 'PRO' });
  chrome.action.setBadgeBackgroundColor({ color: '#FF0033' });
});
