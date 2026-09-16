// content.js — TenderBuild Scraper Worker
chrome.storage.local.get(['currentTask', '_scrapeRunId'], (result) => {
  const currentTask = result.currentTask;
  if (!currentTask) return;

  const pageKey = document.URL.split('#')[0];
  const runKey = (currentTask.id || '') + '|' + pageKey;
  if (result._scrapeRunId === runKey) {
    console.log('[Content] Already processed this page for this task, skipping');
    return;
  }

  chrome.runtime.sendMessage({ action: 'verifyScrapeTab' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.ok) {
      console.log('[Content] Not the scrape tab, skipping');
      return;
    }
    console.log('[Content] Running scrape in designated tab');
    chrome.storage.local.set({ _scrapeRunId: runKey });
    checkCloudflareAndScrape(currentTask);
  });
});

function isCloudflareChallenge() {
  const title = document.title.toLowerCase();
  return title.includes('just a moment') ||
         title.includes('cloudflare') ||
         title.includes('security check') ||
         document.querySelector('#cf-please-wait') ||
         document.querySelector('#challenge-form') ||
         document.querySelector('.cf-browser-verification') ||
         document.querySelector('#cf-challenge-running');
}

function isErrorPage() {
  const text = document.body.innerText.toLowerCase();
  const title = document.title.toLowerCase();
  
  if (title.includes('akses ditolak') || text.includes('akses ditolak!') || text.includes('anda tidak diizinkan membuka halaman ini')) {
    return "Akses Ditolak (Diblokir WAF SPSE)";
  }
  if (text.includes('sedang dalam pemeliharaan') || title.includes('maintenance')) {
    return "Sedang Pemeliharaan (Maintenance)";
  }
  if (text.includes('502 bad gateway') || text.includes('504 gateway time-out')) {
    return "Server LPSE Error (502/504)";
  }
  return null;
}

function checkCloudflareAndScrape(currentTask) {
  if (isCloudflareChallenge()) {
    console.log('Cloudflare challenge detected. Waiting for auto-redirect...');
    return;
  }

  const errReason = isErrorPage();
  if (errReason) {
    console.error('SPSE Error detected:', errReason);
    chrome.runtime.sendMessage({
      action: 'scrapeResult',
      taskId: currentTask.id,
      data: { error: errReason }
    });
    return;
  }

  // viaList: if URL has /lelang/{kode}/ we're on detail; otherwise we're on list page
  const isDetailPage = /\/lelang\/\d+/.test(document.URL);
  if (currentTask.viaList && !isDetailPage) {
    console.log('[viaList] On list page, clicking tender link...');
    clickTenderLinkViaList(currentTask);
    return;
  }

  let waitTime = currentTask.type === 'detail' ? 2000 : 2500;
  let retries = 0;
  const maxRetries = 2;

  function attemptScrape() {
    try {
      if (currentTask.type === 'list') {
        // Skip scroll for list — scroll might interfere with table detection
        setTimeout(() => {
          const data = scrapeTenderList(currentTask.yearStr);
          if (data && data.error === 'No data table found' && retries < maxRetries) {
            retries++;
            console.log(`Table not found, retry ${retries}/${maxRetries}...`);
            setTimeout(attemptScrape, 1500);
            return;
          }
          // Process tahapan clicks for deadline
          processTahapanClicks(data, 0, currentTask);
        }, 800);
      } else if (currentTask.type === 'detail') {
        // Check if we're on the pengumuman page or already on jadwal page
        const url = document.URL.toLowerCase();
        const isJadwalPage = url.includes('/jadwal') || url.includes('/tahapan');

        if (isJadwalPage) {
          // We navigated here from pengumuman — extract deadline and combine
          setTimeout(() => {
            const scheduleData = scrapeTenderSchedule();
            // Read temp data saved before navigation
            chrome.storage.local.get(['_tempDetailData', '_tempTaskId'], (tmp) => {
              const data = tmp._tempDetailData || {};
              if (scheduleData.deadline && scheduleData.deadline !== '-') {
                data.batas_upload = scheduleData.deadline;
              }
              chrome.runtime.sendMessage({
                action: 'scrapeResult',
                taskId: tmp._tempTaskId || currentTask.id,
                data: data
              });
              chrome.storage.local.remove(['_tempDetailData', '_tempTaskId']);
            });
          }, 2000);
          return;
        }

        // On pengumuman page (or viaList just landed here)
        // 1) Click Pengumuman tab — extract SBU, Pagu, HPS
        clickPengumumanTab();
        setTimeout(() => {
          const data = extractTableData();

          // Save to temp storage, then navigate to jadwal page via chrome.tabs.update
          // instead of window.location.href to keep using the SAME tab
          chrome.storage.local.set({
            _tempDetailData: data,
            _tempTaskId: currentTask.id
          }, () => {
            // Derive jadwal URL from current URL — /lelang/{kode}/ -> /lelang/{kode}/jadwal
            const baseMatch = document.URL.match(/^(.+?\/lelang\/\d+)/i);
            const jadwalUrl = baseMatch ? baseMatch[1] + '/jadwal' : document.URL.replace(/\/?(?:pengumumanlelang|informasi|detail)?$/, '/jadwal');
            console.log('[Detail] Navigating to jadwal page:', jadwalUrl);
            // Use window.location.href — this navigates in the same tab.
            // The content script will re-run on the new page via document_idle.
            window.location.href = jadwalUrl;
          });
        }, 1500);
        return;
      } else if (currentTask.type === 'schedule') {
        const data = scrapeTenderSchedule();
        chrome.runtime.sendMessage({
          action: 'scrapeResult',
          taskId: currentTask.id,
          data: data
        });
      }
    } catch (e) {
      console.error('Scrape error:', e);
      chrome.runtime.sendMessage({
        action: 'scrapeResult',
        taskId: currentTask.id,
        data: { error: e.message }
      });
    }
  }

  setTimeout(attemptScrape, waitTime);
}

// Process tahapan clicks sequentially to extract deadline from each row
function processTahapanClicks(data, index, currentTask) {
  if (!data || Array.isArray(data) && data.length === 0) {
    chrome.runtime.sendMessage({
      action: 'scrapeResult',
      taskId: currentTask.id,
      data: data
    });
    return;
  }
  if (!Array.isArray(data) || index >= data.length) {
    chrome.runtime.sendMessage({
      action: 'scrapeResult',
      taskId: currentTask.id,
      data: data
    });
    return;
  }

  const row = data[index];
  if (!row['Kode Tender']) {
    processTahapanClicks(data, index + 1, currentTask);
    return;
  }

  // Find the tahapan cell in the table for this row
  const table = document.querySelector('#tbllelang, #dt-paket, #dttable, table.dataTable');
  if (!table) {
    chrome.runtime.sendMessage({
      action: 'scrapeResult',
      taskId: currentTask.id,
      data: data
    });
    return;
  }

  const rows = Array.from(table.rows);
  const startIdx = table.tHead ? 1 : 0;
  let targetRow = null;

  for (let i = startIdx; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td');
    const kode = cells[0]?.innerText?.trim();
    const linkEl = cells[1]?.querySelector('a');
    let kodeFromHref = kode;
    if (linkEl) { const m = linkEl.href.match(/\/lelang\/(\d+)\//); if (m) kodeFromHref = m[1]; }
    if (kodeFromHref === row['Kode Tender']) {
      targetRow = rows[i];
      break;
    }
  }

  if (!targetRow) {
    processTahapanClicks(data, index + 1, currentTask);
    return;
  }

  // Find tahapan link - look for clickable element in tahapan-related cells
  const cells = targetRow.querySelectorAll('td');
  let tahapanCell = null;
  
  // Tahapan is usually the column with stage names/links
  // Try to find cell with tahapan-related content
  for (let i = 0; i < cells.length; i++) {
    const cellText = cells[i].innerText.toLowerCase();
    if (cellText.includes('buka') || cellText.includes('evaluasi') || 
        cellText.includes('tahap') || cellText.includes('upload') ||
        cellText.includes('pengumuman')) {
      tahapanCell = cells[i];
      break;
    }
  }

  // If no specific tahapan cell found, look for any clickable link/button in the row
  if (!tahapanCell) {
    for (let i = 0; i < cells.length; i++) {
      const clickEl = cells[i].querySelector('a, button, [onclick], .tahapan, .btn-tahapan');
      if (clickEl) {
        tahapanCell = cells[i];
        break;
      }
    }
  }

  // Last resort: look for cells with dates or schedule info
  if (!tahapanCell) {
    for (let i = 0; i < cells.length; i++) {
      const cellText = cells[i].innerText;
      if (/\d{1,2}\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)/i.test(cellText)) {
        tahapanCell = cells[i];
        break;
      }
    }
  }

  if (!tahapanCell) {
    processTahapanClicks(data, index + 1, currentTask);
    return;
  }

  // Try to extract deadline from cell text directly first
  const cellText = tahapanCell.innerText.trim();
  const deadlineMatch = cellText.match(/(?:berakhir|selesai|deadline|batas)[:\s]*([^\n]+)/i) ||
                        cellText.match(/(\d{1,2}\s+(?:jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)\w*\s+\d{4})/i);
  
  if (deadlineMatch) {
    row['Batas Upload'] = deadlineMatch[1] || deadlineMatch[0];
    processTahapanClicks(data, index + 1, currentTask);
    return;
  }

  // Click the tahapan cell to open schedule modal
  const clickTarget = tahapanCell.querySelector('a, button, [onclick]') || tahapanCell;
  
  try {
    clickTarget.click();
  } catch (e) {
    processTahapanClicks(data, index + 1, currentTask);
    return;
  }

  // Wait for modal to appear
  setTimeout(() => {
    // Look for modal with schedule/tahapan info
    const modal = document.querySelector('.modal.show, .modal[style*="display: block"], #modalTahapan, .modal-dialog');
    
    if (modal) {
      const modalText = modal.innerText.toLowerCase();
      
      // Find upload dokumen penawaran deadline
      const deadlinePatterns = [
        /upload dokumen penawaran\s*[:\-]?\s*([^\n]+)/i,
        /pemasukan penawaran\s*[:\-]?\s*([^\n]+)/i,
        /batas upload\s*[:\-]?\s*([^\n]+)/i,
        /berakhir\s*[:\-]?\s*([^\n]+)/i,
        /(\d{1,2}\s+(?:jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)\w*\s+\d{4})/i
      ];

      for (const pattern of deadlinePatterns) {
        const match = modalText.match(pattern);
        if (match) {
          row['Batas Upload'] = match[1] || match[0];
          break;
        }
      }

      // Close modal
      const closeBtn = modal.querySelector('.btn-close, [data-bs-dismiss="modal"], [data-dismiss="modal"], .close');
      if (closeBtn) {
        try { closeBtn.click(); } catch(e) {}
      } else {
        // Try clicking outside modal to close
        document.body.click();
        // Or press Escape
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27 }));
      }
    }

    // Process next row
    setTimeout(() => {
      processTahapanClicks(data, index + 1, currentTask);
    }, 500);
  }, 800);
}

function clickTenderLinkViaList(currentTask) {
  const kode = currentTask.kode;
  if (!kode) {
    chrome.runtime.sendMessage({
      action: 'scrapeResult',
      taskId: currentTask.id,
      data: { error: 'No kode provided for viaList click' }
    });
    return;
  }

  let retries = 0;
  const maxRetries = 5;

  function attemptClick() {
    const table = document.querySelector('#tbllelang, #dt-paket, #dttable, table.dataTable');
    if (!table) {
      if (retries < maxRetries) {
        retries++;
        console.log(`[viaList] Table not found, retry ${retries}/${maxRetries}...`);
        setTimeout(attemptClick, 2000);
        return;
      }
      chrome.runtime.sendMessage({
        action: 'scrapeResult',
        taskId: currentTask.id,
        data: { error: 'Table not found for viaList click' }
      });
      return;
    }

    const rows = Array.from(table.rows);
    const startIdx = table.tHead ? 1 : 0;

    for (let i = startIdx; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length < 2) continue;

      const kodeCell = cells[0]?.innerText?.trim();
      const linkEl = cells[1]?.querySelector('a');
      if (!linkEl) continue;

      const href = linkEl.getAttribute('href') || linkEl.href;
      const hrefKode = href.match(/\/lelang\/(\d+)\//)?.[1];

      if (hrefKode === kode || kodeCell === kode) {
        console.log(`[viaList] Found tender ${kode}, clicking link...`);
        linkEl.click();
        // Fallback: if click didn't navigate, force navigation after 3s
        setTimeout(() => {
          if (!/\/lelang\/\d+/.test(document.URL)) {
            console.log('[viaList] Click did not navigate, forcing window.location...');
            window.location.href = linkEl.href;
          }
        }, 3000);
        return;
      }
    }

    chrome.runtime.sendMessage({
      action: 'scrapeResult',
      taskId: currentTask.id,
      data: { error: `Tender ${kode} not found in list` }
    });
  }

  setTimeout(attemptClick, 2000);
}

function scrapeTenderList(yearStr) {
  const TABLE_SELECTORS = ['#tbllelang', '#dt-paket', '#dttable', 'table.dataTable'];
  const results = [];

  function findTable() {
    for (const sel of TABLE_SELECTORS) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const rows = el.rows;
      const dataRows = el.tHead ? Array.from(rows).slice(1) : Array.from(rows);
      if (dataRows.length > 1) return el;
    }
    return null;
  }

  const table = findTable();
  if (!table) return { error: 'No data table found' };

  const isDtPaket = table.id === 'dt-paket';
  function getText(el) { return el?.innerText?.trim() || ''; }

  const rows = Array.from(table.rows);
  const startIdx = table.tHead ? 1 : 0;

  for (let i = startIdx; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td');
    if (cells.length < 4) continue;

    const kode = getText(cells[0]);
    const linkEl = cells[1]?.querySelector('a');
    const nama = linkEl?.innerText?.trim() || getText(cells[1]).split('\n')[0];
    let kodeFromHref = kode;
    if (linkEl) { const m = linkEl.href.match(/\/lelang\/(\d+)\//); if (m) kodeFromHref = m[1]; }

    const cell1Text = cells[1]?.innerText || '';
    if (yearStr) {
      const taMatch = cell1Text.match(/TA\s+(\d{4})/i);
      if (taMatch && taMatch[1] !== yearStr) continue;
    }

    const instansi = getText(cells[2]);
    const status   = getText(cells[3]).replace(/\s*\[\.+\]\s*$/, '').trim();

    const hpsIdx = isDtPaket ? 6 : 4;
    const paguIdx = isDtPaket ? 5 : 4;
    const hpsRaw = getText(cells[hpsIdx]) || '0';
    const paguRaw = (isDtPaket && cells.length > paguIdx) ? getText(cells[paguIdx]) : hpsRaw;

    function parseInBrowser(raw) {
      if (!raw) return 0;
      let s = String(raw).trim().replace(/^rp\.?\s*/i, '').replace(/\s+/g, ' ');
      const unitMatch = s.match(/([\d,\.]+)\s*(T|M|Jt|Rb)\b/i);
      if (unitMatch) {
        const n = parseFloat(unitMatch[1].replace(/\./g, '').replace(',', '.'));
        const u = unitMatch[2].toLowerCase();
        if (u === 't') return Math.round(n * 1e12);
        if (u === 'm') return Math.round(n * 1e9);
        if (u === 'jt') return Math.round(n * 1e6);
        if (u === 'rb') return Math.round(n * 1e3);
      }
      const plain = parseFloat(s.replace(/\./g, '').replace(',', '.'));
      return isNaN(plain) ? 0 : Math.round(plain);
    }

    const pagu = parseInBrowser(paguRaw);
    const hps  = parseInBrowser(hpsRaw);

    if (kodeFromHref && nama) {
      results.push({
        'Kode Tender': kodeFromHref, 'Nama Paket': nama, 'Instansi': instansi,
        'Pagu': pagu, 'HPS': hps, 'Status_Tender': status,
        'Kategori Pekerjaan': 'Pekerjaan Konstruksi',
        'SBU': '-', 'Batas Upload': '-'
      });
    }
  }
  return results;
}

function clickPengumumanTab() {
  // Only click JS tabs (data-toggle="tab", role="tab", nav-link inside nav-tabs)
  // NOT page links (<a href="/lelang/.../pengumumanlelang">)
  const tabLinks = document.querySelectorAll(
    'a[data-toggle="tab"], a[data-bs-toggle="tab"], [role="tab"], .nav-tabs a.nav-link'
  );
  for (const link of tabLinks) {
    const text = link.innerText.toLowerCase().trim();
    const isActive = link.classList.contains('active') || link.parentElement?.classList.contains('active');
    if ((text.includes('pengumuman') || text.includes('informasi umum') || text.includes('detail')) && !isActive) {
      console.log(`[Detail] Clicking tab: "${link.innerText.trim()}"`);
      link.click();
      return true;
    }
  }
  return false;
}

function clickJadwalTab() {
  // Try multiple selectors to find the Jadwal tab
  const selectors = [
    'a[data-toggle="tab"]',
    'a[data-bs-toggle="tab"]',
    '[role="tab"]',
    '.nav-tabs a.nav-link',
    'a[href*="jadwal"]',
    'a[href*="Jadwal"]'
  ];
  const allLinks = [];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach(el => {
      if (!allLinks.includes(el)) allLinks.push(el);
    });
  }
  for (const link of allLinks) {
    const text = link.innerText.toLowerCase().trim();
    const href = (link.getAttribute('href') || '').toLowerCase();
    const isActive = link.classList.contains('active') || link.parentElement?.classList.contains('active');
    if ((text.includes('jadwal') || text.includes('tahapan') || text.includes('waktu') || href.includes('jadwal')) && !isActive) {
      console.log(`[Detail] Clicking jadwal tab: "${link.innerText.trim()}"`);
      link.click();
      return true;
    }
  }
  console.log('[Detail] No Jadwal tab found, will search all tables on page');
  return false;
}

// KBLI -> SBU map (subset, synced with backend/data/kbli-sbu.json)
const KBLI_TO_SBU_EXT = {"41011":["BG001","GT001"],"41012":["BG002","GT002"],"41013":["BG003","GT003"],"41014":["BG004","GT004"],"41015":["BG005","GT005"],"41016":["BG006","GT006"],"41017":["BG007","GT007"],"41018":["BG008","GT008"],"41019":["BG009"],"42101":["BS001"],"42102":["BS002","ST001"],"42103":["BS003"],"42201":["BS004"],"42202":["BS005","ST002"],"42203":["BS006"],"42204":["BS007","ST003"],"42205":["BS008"],"42206":["BS009"],"42911":["BS010","ST004"],"42912":["BS011","ST005"],"42913":["BS012"],"42915":["BS013","ST006"],"42916":["BS014","ST007"],"42917":["BS015","ST008"],"42918":["BS016","ST009"],"42919":["BS017"],"42923":["BS018","ST010"],"42924":["BS019","ST011"],"42209":["BS020"],"43110":["PL001"],"42914":["PL002"],"43120":["PL003","PL004","PL006","PL007"],"42207":["PL005"],"43902":["PL008"]};

function extractSbuCodes(text) {
  if (!text || text === '-') return '-';
  // normalize "BG002KBLI" -> "BG002 KBLI"
  const norm = String(text).replace(/([A-Z]{2}\d{1,3})(KBLI|NIB|SBU)/gi, '$1 $2');
  const regex = /\b(BG|BS|PL|PB|GT|ST|KP|KK|RK|RE|EL|ME|SP|TI|MK|PR|EE|SE|AR|AL|AT|IT|IN|PA)[\s-]*0*(\d{1,3})\b/gi;
  const codes = [];
  let m;
  while ((m = regex.exec(norm.toUpperCase())) !== null) {
    const code = m[1] + m[2].padStart(3, '0');
    if (!codes.includes(code)) codes.push(code);
  }
  // KBLI fallback: if no SBU found but KBLI present, map via KBLI_TO_SBU_EXT
  if (codes.length === 0 || /KBLI|NIB/i.test(text)) {
    const kbliAnchored = /KBLI[^\d]{0,10}(\d{5})/gi;
    let km;
    const extra = [];
    while ((km = kbliAnchored.exec(text)) !== null) {
      const sbus = KBLI_TO_SBU_EXT[km[1]];
      if (sbus) for (const s of sbus) if (!codes.includes(s) && !extra.includes(s)) extra.push(s);
    }
    if (/KBLI|NIB/i.test(text)) {
      const all5 = text.match(/\b\d{5}\b/g) || [];
      for (const n of all5) {
        const sbus = KBLI_TO_SBU_EXT[n];
        if (sbus) for (const s of sbus) if (!codes.includes(s) && !extra.includes(s)) extra.push(s);
      }
    }
    for (const s of extra) codes.push(s);
  }
  return codes.length > 0 ? codes.join(', ') : '-';
}

function extractTableData() {
  let sbu = '';
  let pagu = '';
  let hps = '';
  let nama_paket = '';
  let instansi = '';
  let batas_upload = '';
  let details = {};
  let qualText = '';

  document.querySelectorAll('table tr').forEach(row => {
    const cells = Array.from(row.querySelectorAll('th, td'));
    if (cells.length === 0) return;

    const pairs = [];
    if (cells.length === 2) {
      pairs.push({ label: cells[0].innerText.trim(), value: cells[1].innerText.trim() });
    } else if (cells.length >= 4) {
      for (let i = 0; i + 1 < cells.length; i += 2) {
        pairs.push({ label: cells[i].innerText.trim(), value: cells[i + 1].innerText.trim() });
      }
    } else if (cells.length === 3) {
      pairs.push({ label: cells[0].innerText.trim(), value: cells[2].innerText.trim() });
    }

    pairs.forEach(({ label, value }) => {
      if (label && value && label !== value) details[label] = value;
      const lbl = label.toLowerCase();
      if (lbl.includes('sbu') || lbl.includes('sertifikat badan usaha')) {
        sbu = extractSbuCodes(value);
      } else if (lbl.includes('nilai pagu') || lbl === 'pagu') {
        pagu = value;
      } else if (lbl.includes('nilai hps') || lbl === 'hps') {
        hps = value;
      } else if (lbl === 'nama paket') {
        nama_paket = value;
      } else if (lbl === 'instansi') {
        instansi = value;
      } else if (lbl.includes('upload dokumen penawaran') || 
                 lbl.includes('pemasukan penawaran') ||
                 lbl.includes('batas upload') ||
                 lbl.includes('batas akhir penawaran') ||
                 lbl.includes('waktu berakhir') ||
                 (lbl.includes('berakhir') && lbl.includes('penawaran')) ||
                 lbl.includes('deadline') ||
                 (lbl.includes('tgl') && lbl.includes('penawaran'))) {
        batas_upload = value;
      }
    });
  });

  const bodyText = document.body.innerText;
  const idx = bodyText.indexOf('Syarat Kualifikasi');
  if (idx >= 0) {
      const section = bodyText.substring(idx + 'Syarat Kualifikasi'.length);
      const endIdx = section.search(/Peserta Tender|Jumlah Peserta|©/);
      qualText = (endIdx > 0 ? section.substring(0, endIdx) : section.substring(0, 3000)).trim();
  }

  if (qualText) {
      details['Syarat Kualifikasi'] = qualText;
      // merge SBU dari sbuRaw + qualText (KBLI fallback, typo BG002KBLI)
      const combined = [sbu, qualText].filter(Boolean).join(' ');
      const merged = extractSbuCodes(combined);
      if (merged !== '-') sbu = merged;
  }

  // final fallback: if still empty, try whole body (handles NIB/KBLI only cases)
  if (!sbu || sbu === '-') {
      const fallback = extractSbuCodes(bodyText.substring(0, 8000));
      if (fallback !== '-') sbu = fallback;
  }
  if (!sbu) sbu = '-';

  console.log(`[Detail] Extracted: sbu="${sbu}" pagu="${pagu}" hps="${hps}" deadline="${batas_upload}"`);
  return { sbu, pagu, hps, nama_paket, instansi, batas_upload, details, qualText };
}

function scrapeTenderDetail() {
  return extractTableData();
}

function scrapeTenderSchedule() {
  let deadline = '';
  const details = {};

  // 1. Search ALL tables on the page for deadline labels
  document.querySelectorAll('table tr').forEach(row => {
    const cells = Array.from(row.querySelectorAll('th, td'));
    if (cells.length === 0) return;

    const pairs = [];
    if (cells.length === 2) {
      pairs.push({ label: cells[0].innerText.trim(), value: cells[1].innerText.trim() });
    } else if (cells.length >= 4) {
      for (let i = 0; i + 1 < cells.length; i += 2) {
        pairs.push({ label: cells[i].innerText.trim(), value: cells[i + 1].innerText.trim() });
      }
    } else if (cells.length === 3) {
      pairs.push({ label: cells[0].innerText.trim(), value: cells[2].innerText.trim() });
    }

    pairs.forEach(({ label, value }) => {
      if (label && value && label !== value) details[label] = value;
      const lbl = label.toLowerCase();
      if (lbl.includes('upload dokumen penawaran') || 
          lbl.includes('pemasukan penawaran') ||
          lbl.includes('batas upload') ||
          lbl.includes('batas akhir penawaran') ||
          lbl.includes('waktu berakhir') ||
          (lbl.includes('berakhir') && lbl.includes('penawaran')) ||
          lbl.includes('deadline') ||
          (lbl.includes('tgl') && lbl.includes('penawaran'))) {
        deadline = value;
      }
    });
  });

  // 2. Search ALL elements with label-like structure (div, dl, etc.), not just tables
  if (!deadline) {
    // Look for definition lists
    document.querySelectorAll('dl dt, dl dd, .form-group label, .form-group .value, .field-label, .field-value').forEach(el => {
      const text = el.innerText.trim();
      const parent = el.parentElement;
      if (parent) {
        const parentText = parent.innerText;
        if (/batas\s*upload|upload\s*dokumen|pemasukan\s*penawaran|berakhir.*penawaran/i.test(parentText) ||
            /batas\s*upload|upload\s*dokumen|pemasukan\s*penawaran|berakhir.*penawaran/i.test(text)) {
          // The sibling or next element likely has the date
          const next = el.nextElementSibling || el.nextSibling;
          if (next && next.innerText) {
            deadline = next.innerText.trim();
          } else {
            // Extract date from parent text after the label
            const labelMatch = parentText.match(/(?:batas\s*upload|upload\s*dokumen|pemasukan\s*penawaran|berakhir.*penawaran)[\s:]*([^\n]+)/i);
            if (labelMatch) deadline = labelMatch[1].trim();
          }
        }
      }
    });
  }

  // 3. Search raw body text with comprehensive patterns
  if (!deadline) {
    const bodyText = document.body.innerText;
    const patterns = [
      /(?:Batas\s*(?:Akhir\s+)?Upload|Batas\s+Akhir\s+Penawaran)[\s:]*([^\n]+)/i,
      /(?:Upload\s+Dokumen\s+Penawaran|Pemasukan\s+Penawaran)[\s:]*([^\n]+)/i,
      /(?:Berakhir|Selesai)[\s:]*([^\n]+?Penawaran[^\n]*)/i,
      /Tgl\s*\.?\s*(?:Akhir|Penutupan)[\s:]*([^\n]+)/i
    ];
    for (const p of patterns) {
      const m = bodyText.match(p);
      if (m && m[1].trim()) {
        deadline = m[1].trim();
        console.log(`[Schedule] Found deadline via body text: "${deadline}"`);
        break;
      }
    }
  }

  // 4. Last resort: look for ANY Indonesian date in proximity to "jadwal" section
  if (!deadline) {
    const bodyText = document.body.innerText;
    // Find the "Jadwal" section and look for dates after it
    const jadwalIdx = bodyText.search(/jadwal|tahapan|waktu|schedule/i);
    if (jadwalIdx >= 0) {
      const afterJadwal = bodyText.substring(jadwalIdx, jadwalIdx + 500);
      const datePattern = /(\d{1,2}\s+(?:jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)\w*\s+\d{4}[\s\d:]*)/i;
      const dm = afterJadwal.match(datePattern);
      if (dm) {
        deadline = dm[1].trim();
        console.log(`[Schedule] Found date near Jadwal section: "${deadline}"`);
      }
    }
  }

  console.log(`[Schedule] Final deadline: "${deadline || '(empty)'}"`);
  return { deadline, details };
}
