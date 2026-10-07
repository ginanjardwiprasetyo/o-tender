// content.js — scrape halaman dokumen SPSE + tombol "Simpan ke Drive"
(() => {
  function sanitizeFolderName(name) {
    return (name || '')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'Folder Pengadaan SPSE';
  }

  function extractFolderName() {
    const bodyText = document.body.innerText;
    const match = bodyText.match(/Untuk Pengadaan\s*([\s\S]*?)\s*Kelompok Kerja Pemilihan:/i);
    if (match && match[1]) {
      const clean = match[1].replace(/^[\s,]+|[\s,]+$/g, '').trim();
      if (clean) return sanitizeFolderName(clean);
    }
    const h1 = document.querySelector('h1, h2, .page-header h3, title');
    const t = (h1 && h1.textContent || '').trim();
    if (t && !/dokumen/i.test(t)) return sanitizeFolderName(t);
    const kode = (location.pathname.match(/\/dokumen\/(\d+)/) || [])[1];
    return kode ? 'Paket_' + kode : 'Folder Pengadaan SPSE';
  }

  const FILE_EXT = 'pdf|docx?|xlsx?|xls|zip|rar|7z|jpg|jpeg|png|gif|dwg|cad|csv|txt|pptx?';

  function fileNameFromLink(a) {
    const re = new RegExp('([\\w\\-().\\s]+\\.(?:' + FILE_EXT + '))\\b', 'i');

    const tr = a.closest('tr');
    if (tr) {
      for (const cell of tr.querySelectorAll('td, th')) {
        const m = cell.innerText.match(re);
        if (m) return m[1].trim();
      }
    }

    let el = a.previousElementSibling;
    for (let i = 0; el && i < 3; i++, el = el.previousElementSibling) {
      const m = (el.innerText || '').match(re);
      if (m) return m[1].trim();
    }

    const row = a.closest('li, .list-group-item, p, div');
    if (row) {
      const m = row.innerText.match(re);
      if (m) return m[1].trim();
    }

    try {
      const path = new URL(a.href).pathname.split('/').filter(Boolean).pop() || '';
      const decoded = decodeURIComponent(path);
      if (decoded.includes('.')) return decoded;
      if (decoded) return decoded;
    } catch (_) {}

    const label = (a.textContent || '').replace(/\[Download\]/gi, '').trim();
    if (label && label.includes('.')) return label;
    return null;
  }

  function extractDownloads() {
    const links = Array.from(document.querySelectorAll('a'));
    const seen = new Set();
    const out = [];
    for (const a of links) {
      if (!a.href) continue;
      if (!/\[Download\]/i.test(a.textContent)) continue;
      if (seen.has(a.href)) continue;
      seen.add(a.href);
      out.push({ url: a.href, name: fileNameFromLink(a) });
    }
    return out;
  }

  function scrape() {
    return {
      folderName: extractFolderName(),
      downloadUrls: extractDownloads()
    };
  }

  // ── style tombol (idle = ikon bulat saja; upload = pill + progress) ──
  function ensureStyles() {
    if (document.getElementById('spse-drive-btn-style')) return;
    const s = document.createElement('style');
    s.id = 'spse-drive-btn-style';
    s.textContent = `
      #spse-drive-exporter-btn{
        display:inline-flex;align-items:center;justify-content:center;gap:6px;
        box-sizing:border-box;width:48px;height:48px;padding:0;
        border:none;border-radius:50%;background:#1a73e8;color:#fff;
        cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.28);
        overflow:hidden;line-height:1
      }
      #spse-drive-exporter-btn .spse-icon{
        width:26px;height:26px;flex:0 0 26px;display:block
      }
      #spse-drive-exporter-btn .spse-label,
      #spse-drive-exporter-btn .spse-pct,
      #spse-drive-exporter-btn .spse-spin{display:none}
      #spse-drive-exporter-btn.is-busy,
      #spse-drive-exporter-btn.is-msg{
        width:auto;min-width:48px;height:40px;padding:0 14px;border-radius:999px
      }
      #spse-drive-exporter-btn.is-busy .spse-icon,
      #spse-drive-exporter-btn.is-msg .spse-icon{display:none}
      #spse-drive-exporter-btn.is-busy .spse-spin,
      #spse-drive-exporter-btn.is-busy .spse-label,
      #spse-drive-exporter-btn.is-busy .spse-pct{display:inline-block}
      #spse-drive-exporter-btn.is-msg .spse-label{display:inline-block}
      #spse-drive-exporter-btn .spse-spin{
        width:14px;height:14px;border:2px solid rgba(255,255,255,.35);
        border-top-color:#fff;border-radius:50%;
        animation:spseSpin .7s linear infinite;flex:0 0 14px
      }
      #spse-drive-exporter-btn.is-busy{opacity:.92;cursor:progress}
      #spse-drive-exporter-btn .spse-label{
        font:600 13px/1 system-ui,sans-serif;color:#fff;white-space:nowrap
      }
      #spse-drive-exporter-btn .spse-pct{
        font-weight:800;font-size:12px;background:rgba(255,255,255,.2);
        padding:2px 6px;border-radius:99px
      }
      @keyframes spseSpin{to{transform:rotate(360deg)}}
    `;
    document.documentElement.appendChild(s);
  }

  // Panah download putih saja — bg biru dari tombol, tanpa kotak ganda
  const ICON_SVG =
    '<svg class="spse-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M12 3v10m0 0l-4.5-4.5M12 13l4.5-4.5" fill="none" stroke="#fff" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M4 16v2.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V16" fill="none" ' +
    'stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>' +
    '</svg>';

  function setBtnIdle(btn, dest) {
    clearTimeout(btn._spseMsgT);
    btn.classList.remove('is-busy', 'is-msg');
    btn.disabled = false;
    btn.querySelector('.spse-label').textContent = '';
    btn.querySelector('.spse-pct').textContent = '';
    btn.title = 'Ke Drive: ' + (dest || 'My Drive') + ' — klik untuk unggah, klik kanan untuk ganti folder';
  }

  function setBtnMsg(btn, text, ms, destAfter) {
    clearTimeout(btn._spseMsgT);
    btn.classList.remove('is-busy');
    btn.classList.add('is-msg');
    btn.disabled = true;
    btn.querySelector('.spse-label').textContent = text;
    btn.querySelector('.spse-pct').textContent = '';
    btn._spseMsgT = setTimeout(() => setBtnIdle(btn, destAfter), ms || 3000);
  }

  function setBtnBusy(btn, current, total) {
    clearTimeout(btn._spseMsgT);
    const pct = total ? Math.round((current / total) * 100) : 0;
    btn.classList.remove('is-msg');
    btn.classList.add('is-busy');
    btn.disabled = true;
    btn.querySelector('.spse-label').textContent = 'Upload ' + current + '/' + total;
    btn.querySelector('.spse-pct').textContent = pct + '%';
  }

  async function startUpload(btn, destName) {
    if (btn.classList.contains('is-busy')) return;
    const data = scrape();
    if (!data.downloadUrls.length) {
      setBtnMsg(btn, 'Tidak ada [Download]', 2500, destName);
      return;
    }
    const stored = await chrome.storage.local.get([
      'savedParentId',
      'savedParentName',
      'savedParentPath'
    ]);
    setBtnBusy(btn, 0, data.downloadUrls.length);
    chrome.runtime.sendMessage({
      action: 'START_UPLOAD',
      payload: {
        folderName: data.folderName,
        downloadUrls: data.downloadUrls,
        parentFolderId: stored.savedParentId || '',
        parentFolderName: stored.savedParentName || 'My Drive',
        parentFolderPath: stored.savedParentPath || null
      }
    });
  }

  async function injectButton() {
    if (document.getElementById('spse-drive-exporter-btn')) return;
    ensureStyles();
    const stored = await chrome.storage.local.get(['savedParentName', 'savedParentPath']);
    const destPath = Array.isArray(stored.savedParentPath) && stored.savedParentPath.length
      ? stored.savedParentPath
      : [stored.savedParentName || 'My Drive'].filter(Boolean);
    const dest = destPath.join(' / ') || 'My Drive';

    const btn = document.createElement('button');
    btn.id = 'spse-drive-exporter-btn';
    btn.type = 'button';
    btn.title = 'Ke Drive: ' + dest + ' — klik unggah, klik kanan ganti folder';
    btn.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483647'
    ].join(';');
    btn.innerHTML = ICON_SVG +
      '<span class="spse-spin"></span>' +
      '<span class="spse-label"></span>' +
      '<span class="spse-pct"></span>';

    btn.addEventListener('click', () => startUpload(btn, dest));
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      alert('Buka ikon ekstensi (popup) → "Pilih / ganti folder tujuan" untuk mengubah lokasi Drive.');
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action !== 'UPLOAD_PROGRESS') return;
      if (msg.finished) {
        if (msg.dest) {
          chrome.storage.local.set({ savedParentName: msg.dest });
          btn.title = 'Ke Drive: ' + msg.dest;
        }
        if (msg.error) {
          setBtnMsg(btn, '❌ ' + msg.error.slice(0, 40), 4000, msg.dest || dest);
        } else {
          setBtnMsg(btn, '✅ ' + msg.done + '/' + msg.total + ' file', 4000, msg.dest || dest);
        }
      } else {
        setBtnBusy(btn, msg.current, msg.total);
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.savedParentPath && !btn.classList.contains('is-busy')) {
        const p = Array.isArray(changes.savedParentPath.newValue) && changes.savedParentPath.newValue.length
          ? changes.savedParentPath.newValue
          : ['My Drive'];
        setBtnIdle(btn, p.join(' / '));
      }
    });

    document.body.appendChild(btn);
  }

  if (/\/dokumen\//.test(location.pathname)) {
    injectButton();
  }

  return scrape();
})();
