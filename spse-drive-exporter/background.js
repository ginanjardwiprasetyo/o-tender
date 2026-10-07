const DELAY_MS = 400;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_UPLOAD') {
    handleUploadProcess(request.payload, sender.tab)
      .then((summary) => sendResponse({ success: true, ...summary }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (request.action === 'LIST_FOLDERS') {
    listFolders(request.query || '', request.parentId || '')
      .then((folders) => sendResponse({ success: true, folders }))
      .catch((err) => sendResponse({ success: false, error: err.message, needsReauth: !!(err && err.needsReauth) }));
    return true;
  }
  if (request.action === 'REAUTH') {
    forceReauth()
      .then((token) => sendResponse({ success: true, hasToken: !!token }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (request.action === 'GET_FOLDER_META') {
    getFolderMeta(request.folderId)
      .then((meta) => sendResponse({ success: true, meta }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (request.action === 'GET_FOLDER_PATH') {
    getFolderPath(request.folderId)
      .then((path) => sendResponse({ success: true, path }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (request.action === 'SET_DESTINATION') {
    // { folderId: string|'', folderName: string, folderPath?: string[] }
    chrome.storage.local.set({
      savedParentId: request.folderId || '',
      savedParentName: request.folderName || 'My Drive',
      savedParentPath: Array.isArray(request.folderPath) && request.folderPath.length
        ? request.folderPath
        : [request.folderName || 'My Drive']
    }, () => sendResponse({ success: true }));
    return false;
  }
});

function progress(tab, payload) {
  const msg = { action: 'UPLOAD_PROGRESS', ...payload };
  if (tab && tab.id != null) {
    chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  }
  chrome.runtime.sendMessage(msg).catch(() => {});
}

async function handleUploadProcess({ folderName, downloadUrls, parentFolderId, parentFolderName, parentFolderPath }, tab) {
  const token = await getOAuthToken();
  const destId = parentFolderId || null;
  const folderId = await findOrCreateFolder(folderName, destId, token);

  // ingat lokasi terakhir yang benar-benar dipakai
  await chrome.storage.local.set({
    savedParentId: destId || '',
    savedParentName: parentFolderName || (destId ? destId : 'My Drive'),
    savedParentPath: Array.isArray(parentFolderPath) && parentFolderPath.length
      ? parentFolderPath
      : [parentFolderName || 'My Drive']
  });

  let done = 0;
  let failed = 0;
  const total = downloadUrls.length;

  for (let i = 0; i < downloadUrls.length; i++) {
    const item = downloadUrls[i];
    progress(tab, { current: i + 1, total, done, dest: parentFolderName || 'My Drive' });
    try {
      await uploadFileToDrive(item, folderId, token);
      done++;
    } catch (e) {
      failed++;
      console.error('[SPSE Drive] gagal', item.url, e.message);
    }
    if (i < downloadUrls.length - 1) await sleep(DELAY_MS);
  }

  progress(tab, {
    done: total,
    current: total,
    total,
    finished: true,
    dest: parentFolderName || 'My Drive',
    error: failed ? `${failed} file gagal` : null
  });
  return { done, failed, total };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getOAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(token);
    });
  });
}

function removeCachedToken() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError || !token) return resolve(null);
      chrome.identity.removeCachedAuthToken({ token }, () => resolve(token));
    });
  });
}

// Paksa login ulang — perlu setelah scope manifest ditambah (drive.readonly)
async function forceReauth() {
  await removeCachedToken();
  return getOAuthToken(true);
}

async function apiFetch(url, init = {}) {
  let token = await getOAuthToken(true);
  let res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` }
  });
  if (res.status === 401 || res.status === 403) {
    // token lama / scope kurang → buang cache, minta lagi
    await removeCachedToken();
    token = await getOAuthToken(true);
    res = await fetch(url, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` }
    });
  }
  return res;
}

// ─── Folder picker data ─────────────────────────────────────
// parentId '' / root → isi My Drive; query non-kosong → cari global
async function listFolders(query, parentId) {
  const q = [
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`
  ];
  if (query) {
    q.push(`name contains '${escapeDriveQuery(query)}'`);
  } else {
    const parent = parentId || 'root';
    q.push(`'${escapeDriveQuery(parent)}' in parents`);
  }

  const url = 'https://www.googleapis.com/drive/v3/files?q=' +
    encodeURIComponent(q.join(' and ')) +
    '&fields=files(id,name,parents)&pageSize=100&orderBy=name';

  const res = await apiFetch(url);
  const data = await res.json().catch(() => ({}));
  if (data.error) {
    const e = new Error(data.error.message || ('HTTP ' + res.status));
    e.needsReauth = res.status === 401 || res.status === 403;
    throw e;
  }
  if (!res.ok) {
    const e = new Error('HTTP ' + res.status + (data.error ? ': ' + data.error.message : ''));
    e.needsReauth = res.status === 401 || res.status === 403;
    throw e;
  }

  return (data.files || []).map((f) => ({
    id: f.id,
    name: f.name
  }));
}

async function getFolderMeta(folderId) {
  if (!folderId) return { id: '', name: 'My Drive', parentId: '' };
  const res = await apiFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,parents`
  );
  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(data.error.message);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return {
    id: data.id,
    name: data.name,
    parentId: (data.parents && data.parents[0]) || ''
  };
}

// Path penuh: My Drive / A / B / … sampai root
async function getFolderPath(folderId) {
  if (!folderId) return ['My Drive'];
  const names = [];
  let id = folderId;
  for (let i = 0; i < 20 && id && id !== 'root'; i++) {
    const meta = await getFolderMeta(id);
    if (!meta.name) break;
    names.unshift(meta.name);
    id = meta.parentId;
    if (!id) break;
  }
  return ['My Drive', ...names];
}

async function findOrCreateFolder(name, parentId, token) {
  const qParts = [
    `name = '${escapeDriveQuery(name)}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`
  ];
  if (parentId) qParts.push(`'${parentId}' in parents`);
  else qParts.push(`'root' in parents`);

  const listUrl = 'https://www.googleapis.com/drive/v3/files?q=' +
    encodeURIComponent(qParts.join(' and ')) + '&fields=files(id,name)&pageSize=1';

  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
  const listData = await listRes.json();
  if (listData.error) throw new Error(listData.error.message);
  if (listData.files && listData.files.length) return listData.files[0].id;

  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : ['root']
  };
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.id;
}

function escapeDriveQuery(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function fetchFileBlob(url) {
  let res = await fetch(url, { credentials: 'omit', redirect: 'follow' });
  if (res.ok) return { blob: await res.blob(), response: res };
  if (res.status === 401 || res.status === 403 || res.status === 400) {
    res = await fetch(url, { credentials: 'include', redirect: 'follow' });
    if (res.ok) return { blob: await res.blob(), response: res };
  }
  throw new Error(`Download HTTP ${res.status}`);
}

async function uploadFileToDrive(item, folderId, token) {
  const url = typeof item === 'string' ? item : item.url;
  const { blob, response } = await fetchFileBlob(url);
  if (blob.size === 0) throw new Error('File kosong');

  // Jangan rename — hanya buang karakter ilegal Drive
  let fileName =
    (typeof item === 'object' && item.name) ||
    fileNameFromDisposition(response.headers.get('content-disposition')) ||
    fileNameFromUrl(url);
  fileName = driveSafeName(fileName);

  const meta = { name: fileName, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob, fileName);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

function fileNameFromDisposition(cd) {
  if (!cd) return null;
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try { return decodeURIComponent(star[1]); } catch (_) {}
  }
  const plain = cd.match(/filename="?([^";]+)"?/i);
  if (plain) return plain[1];
  return null;
}

function fileNameFromUrl(url) {
  try {
    const path = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    const decoded = decodeURIComponent(path);
    if (decoded.includes('.')) return decoded;
    // /dl/{hash} — pakai hash asli, jangan bikin nama baru
    if (decoded) return decoded;
  } catch (_) {}
  return 'file';
}

// Hapus karakter yang dilarang Drive saja — sisanya biarkan
function driveSafeName(name) {
  let n = String(name || 'file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  if (!n) n = 'file';
  if (n.length > 200) {
    const dot = n.lastIndexOf('.');
    if (dot > 0 && n.length - dot <= 12) {
      const ext = n.slice(dot);
      n = n.slice(0, 200 - ext.length) + ext;
    } else {
      n = n.slice(0, 200);
    }
  }
  return n;
}
