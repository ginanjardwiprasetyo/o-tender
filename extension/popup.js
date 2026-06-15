document.addEventListener('DOMContentLoaded', () => {
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const statusText = document.getElementById('statusText');

  function showActive() {
    statusText.textContent = 'Aktif (Polling Backend...)';
    statusText.style.color = '#4ade80';
    btnStart.style.display = 'none';
    btnStop.style.display = 'block';
    btnStop.disabled = false;
    btnStop.textContent = 'Stop Polling';
  }

  function showInactive() {
    statusText.textContent = 'Nonaktif';
    statusText.style.color = '#ef4444';
    btnStart.style.display = 'block';
    btnStop.style.display = 'none';
    btnStart.disabled = false;
    btnStart.textContent = 'Start Polling';
  }

  // On open: ping background. If dead → reset stale isPolling
  function init() {
    try {
      chrome.runtime.sendMessage({ action: 'ping' }, (resp) => {
        if (chrome.runtime.lastError || !resp || !resp.alive) {
          // Background is gone → reset stale state
          chrome.storage.local.set({ isPolling: false });
          chrome.storage.local.remove(['currentTask', 'taskDeadline', 'scrapeTabId']);
          showInactive();
        } else {
          // Background alive → show real state
          chrome.storage.local.get(['isPolling'], (r) => {
            (r.isPolling ? showActive : showInactive)();
          });
        }
      });
    } catch (e) {
      // sendMessage threw → background unreachable
      chrome.storage.local.set({ isPolling: false });
      showInactive();
    }
  }

  init();

  btnStart.addEventListener('click', () => {
    btnStart.disabled = true;
    btnStart.textContent = 'Memulai...';
    try {
      chrome.runtime.sendMessage({ action: 'startPolling' }, () => {
        // Background responded — check if it actually started
        chrome.storage.local.get(['isPolling'], (r) => {
          (r.isPolling ? showActive : showInactive)();
        });
      });
    } catch (e) {
      showInactive();
    }
  });

  btnStop.addEventListener('click', () => {
    btnStop.disabled = true;
    btnStop.textContent = 'Menghentikan...';
    try {
      chrome.runtime.sendMessage({ action: 'stopPolling' }, () => {
        chrome.storage.local.get(['isPolling'], (r) => {
          (r.isPolling ? showActive : showInactive)();
        });
      });
    } catch (e) {
      showInactive();
    }
  });
});
