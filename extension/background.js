// background.js — TenderBuild Scraper Worker (MV3)
let isPolling = false;
let pollingTimer = null;
let scrapeTabId = null;
let emptyPolls = 0;
let isProcessingResult = false;
let isExecutingTask = false;
let isAcquiringTab = false;        // Guard against concurrent tab creation
let pendingTabResolvers = [];       // Queue for concurrent acquireTab callers
const BACKEND_URL = 'http://localhost:3000/api/crawler';

// ─── STARTUP: Recover state, clean up orphaned tasks ───────────
chrome.storage.local.get(['isPolling', 'scrapeTabId', 'currentTask', 'taskDeadline'], (result) => {
  // Validate stored scrapeTabId — if the tab doesn't exist, clear it
  if (result.scrapeTabId) {
    chrome.tabs.get(result.scrapeTabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        console.log('[Startup] Stored scrapeTabId', result.scrapeTabId, 'is gone, clearing');
        scrapeTabId = null;
        chrome.storage.local.remove('scrapeTabId');
      } else {
        scrapeTabId = result.scrapeTabId;
        console.log('[Startup] Recovered scrapeTabId:', scrapeTabId);
      }
    });
  }

  if (result.currentTask && result.taskDeadline && Date.now() > result.taskDeadline) {
    console.warn('[Startup] Cleaning up expired task:', result.currentTask.id);
    submitResult(result.currentTask.id, { error: 'Service worker restarted during task' });
    chrome.storage.local.remove(['currentTask', 'taskDeadline', '_scrapeRunId']);
  } else if (result.currentTask && result.taskDeadline) {
    const remaining = result.taskDeadline - Date.now();
    chrome.alarms.create('taskTimeout', { when: result.taskDeadline });
    console.log('[Startup] Task still valid, restarting timeout in', Math.round(remaining / 1000), 's');
  }

  if (result.isPolling) {
    isPolling = true;
    emptyPolls = 0;
    console.log('[Startup] Resuming polling');
    pollTask();
  }
});

// ─── TAB REMOVAL LISTENER: Detect when our scrape tab is closed ─────
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === scrapeTabId) {
    console.log('[Tab] Scrape tab', tabId, 'was closed externally');
    scrapeTabId = null;
    chrome.storage.local.remove('scrapeTabId');
  }
});

// ─── ALARM HANDLER ─────────────────────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'taskTimeout') {
    console.error('[Alarm] Task timeout fired');
    chrome.storage.local.get(['currentTask'], (res) => {
      if (res.currentTask) {
        submitResult(res.currentTask.id, { error: 'Extension timeout' });
      }
      chrome.storage.local.remove(['currentTask', 'taskDeadline', '_scrapeRunId']);
      // Don't close the tab on timeout — reuse it for next task
      if (isPolling) schedulePoll(1000);
    });
  }
});

// ─── MESSAGE HANDLER ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ alive: true });
  } else if (request.action === 'verifyScrapeTab') {
    const isScrapeTab = scrapeTabId !== null && sender.tab && sender.tab.id === scrapeTabId;
    sendResponse({ ok: isScrapeTab });
  } else if (request.action === 'startPolling') {
    startPolling();
    sendResponse({ status: 'started' });
  } else if (request.action === 'stopPolling') {
    stopPolling();
    sendResponse({ status: 'stopped' });
  } else if (request.action === 'scrapeResult') {
    if (scrapeTabId !== null && sender.tab && sender.tab.id !== scrapeTabId) {
      console.log('[Result] Ignoring from wrong tab', sender.tab.id, '(expected', scrapeTabId + ')');
      return true;
    }

    if (isProcessingResult) {
      console.log('[Result] Already processing a result, ignoring duplicate');
      return true;
    }
    isProcessingResult = true;

    chrome.alarms.clear('taskTimeout');
    chrome.storage.local.get(['currentTask'], (res) => {
      const task = res.currentTask;
      if (!task) {
        console.log('[Result] No currentTask, ignoring');
        isProcessingResult = false;
        return;
      }
      console.log('[Result]', task.type, '→', JSON.stringify(request.data).slice(0, 200));
      submitResult(task.id, request.data);
      chrome.storage.local.remove(['currentTask', 'taskDeadline', '_scrapeRunId'], () => {
        isProcessingResult = false;
        schedulePoll(500);
      });
    });
  }
  return true;
});

// ─── POLLING ───────────────────────────────────────────────────
function schedulePoll(delay) {
  if (pollingTimer) clearTimeout(pollingTimer);
  pollingTimer = setTimeout(pollTask, delay);
}

function startPolling() {
  if (isPolling) {
    emptyPolls = 0;
    return;
  }
  isPolling = true;
  emptyPolls = 0;
  chrome.storage.local.set({ isPolling: true });
  console.log('[Poll] Started');
  pollTask();
}

function stopPolling() {
  isPolling = false;
  emptyPolls = 0;
  if (pollingTimer) clearTimeout(pollingTimer);
  pollingTimer = null;
  chrome.alarms.clear('taskTimeout');
  closeScrapeTab();
  chrome.storage.local.set({ isPolling: false });
  chrome.storage.local.remove(['currentTask', 'taskDeadline', '_scrapeRunId']);
  console.log('[Poll] Stopped');
}

async function pollTask() {
  if (!isPolling || isExecutingTask) return;

  try {
    const res = await fetch(`${BACKEND_URL}/task`);
    const json = await res.json();

    if (json.success && json.data) {
      emptyPolls = 0;
      console.log('[Task]', json.data.type, json.data.id?.slice(0, 8));
      await executeTask(json.data);
    } else {
      emptyPolls++;
      if (json.done || emptyPolls >= 100) {
        console.log(json.done ? '[Poll] Done signal' : '[Poll] Timeout, stopping');
        stopPolling();
      } else {
        schedulePoll(3000);
      }
    }
  } catch (err) {
    console.error('[Poll]', err.message);
    emptyPolls++;
    if (emptyPolls >= 100) {
      stopPolling();
    } else {
      schedulePoll(10000);
    }
  }
}

// ─── TAB MANAGEMENT ────────────────────────────────────────────
function closeScrapeTab() {
  if (scrapeTabId !== null) {
    const id = scrapeTabId;
    scrapeTabId = null;
    chrome.storage.local.remove('scrapeTabId');
    chrome.tabs.remove(id, () => {
      if (chrome.runtime.lastError) {
        console.log('[Tab] Close failed (tab already gone):', id);
      } else {
        console.log('[Tab] Closed', id);
      }
    });
  }
}

/**
 * Acquire a single scrape tab. Guarantees only ONE tab is ever created
 * even if multiple callers invoke acquireTab() concurrently.
 */
async function acquireTab() {
  // 1. Fast path: we already have a valid tab
  if (scrapeTabId !== null) {
    try {
      const tab = await chrome.tabs.get(scrapeTabId);
      if (tab && !chrome.runtime.lastError) {
        console.log('[Tab] Reuse', tab.id);
        return tab.id;
      }
    } catch (_) {}
    // Tab is gone
    console.log('[Tab] Saved', scrapeTabId, 'gone');
    scrapeTabId = null;
    chrome.storage.local.remove('scrapeTabId');
  }

  // 2. If another call is already creating a tab, wait for it
  if (isAcquiringTab) {
    return new Promise((resolve) => {
      pendingTabResolvers.push(resolve);
    });
  }

  // 3. We are the first caller — create the tab
  isAcquiringTab = true;

  return new Promise((resolve) => {
    chrome.tabs.create({ active: false }, (tab) => {
      console.log('[Tab] Created', tab.id);
      scrapeTabId = tab.id;
      chrome.storage.local.set({ scrapeTabId: tab.id });

      // Resolve our own promise
      resolve(tab.id);

      // Resolve any queued callers that arrived while we were creating
      for (const queued of pendingTabResolvers) {
        queued(tab.id);
      }
      pendingTabResolvers = [];
      isAcquiringTab = false;
    });
  });
}

// ─── EXECUTE TASK ──────────────────────────────────────────────
async function executeTask(task) {
  if (isExecutingTask) return;
  isExecutingTask = true;

  try {
    chrome.alarms.clear('taskTimeout');

    const deadline = Date.now() + 120000;
    const navigateUrl = task.viaList && task.listUrl ? task.listUrl : task.url;

    const tabId = await acquireTab();

    await chrome.storage.local.set({
      currentTask: { ...task, _tabId: tabId },
      taskDeadline: deadline
    });

    chrome.alarms.create('taskTimeout', { when: deadline });

    await new Promise((resolve) => {
      chrome.tabs.update(tabId, { url: navigateUrl }, () => resolve());
    });
  } finally {
    isExecutingTask = false;
  }
}

// ─── SUBMIT RESULT ─────────────────────────────────────────────
async function submitResult(taskId, data) {
  try {
    await fetch(`${BACKEND_URL}/task-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, data })
    });
    console.log('[Submit]', taskId?.slice(0, 8));
  } catch (err) {
    console.error('[Submit]', err.message);
  }
}
