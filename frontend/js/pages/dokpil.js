const DokpilPage = {
  extractedFields: {},
  extractedTables: {},
  rawText: '',
  aiSummary: '',
  aiEnabled: false,
  driveFolderId: '',
  driveCurrentFolder: '',
  driveCurrentName: '',
  driveStack: [],
  followedTenders: [],
  selectedTenderId: '',
  currentFileName: '',

  async render() {
    return `
    <div class="page-header">
      <div>
        <h2>Dokumen Pemilihan (Dokpil)</h2>
        <p>Pilih PDF dari Google Drive untuk ekstraksi data Lembar Data Pemilihan</p>
      </div>
    </div>

    <!-- Drive Browser -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-title" style="display:flex;align-items:center;gap:8px;">
        <i data-lucide="folder-open" style="width:18px;height:18px;color:#34a853;"></i>
        Google Drive
        <span id="dokpil-drive-badge" style="margin-left:auto;font-size:0.75rem;font-weight:400;color:var(--text-muted);"></span>
      </div>
      <!-- Breadcrumb -->
      <div id="dokpil-breadcrumb" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:16px;font-size:0.82rem;color:var(--text-muted);min-height:28px;"></div>
      <!-- File grid -->
      <div id="dokpil-drive-list" style="min-height:120px;"></div>
    </div>

    <!-- Loading -->
    <div id="dokpil-loading" class="hidden" style="text-align:center;padding:40px;">
      <div class="spinner" style="margin:0 auto 16px;"></div>
      <p style="color:var(--text-muted);">Membaca, mengekstrak, dan menganalisis PDF...</p>
    </div>

    <!-- Preview BAB IV (default hidden) -->
    <div id="dokpil-raw-section" class="hidden" style="margin-bottom:24px;">
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;gap:8px;">
          <i data-lucide="eye" style="width:16px;height:16px;"></i>
          Preview BAB IV
          <span style="margin-left:auto;display:flex;gap:8px;">
            <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.8rem;" onclick="DokpilPage.reextractSelected()" title="Pilih teks di Preview lalu klik ini — untuk PDF dengan layout beda"><i data-lucide="refresh-cw" style="width:13px;height:13px;"></i> Parse ulang pilihan</button>
            <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.8rem;" onclick="DokpilPage.copyRaw()">Salin</button>
            <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.8rem;" onclick="DokpilPage.toggleRaw()">
              <i data-lucide="chevron-down" id="dokpil-raw-chevron" style="width:14px;height:14px;transition:transform 0.2s;"></i>
              <span id="dokpil-raw-toggle-label">Tampilkan</span>
            </button>
          </span>
        </div>
        <pre id="dokpil-raw-text" class="hidden" style="max-height:340px;overflow:auto;background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);font-size:0.8rem;line-height:1.6;white-space:pre-wrap;margin:0;"></pre>
      </div>
    </div>

    <!-- Results -->
    <div id="dokpil-result-section" class="hidden">
      <div class="page-header" style="margin-bottom:16px;">
        <div><h3 style="margin:0;">Hasil Ekstraksi — Lembar Data Pemilihan</h3></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="DokpilPage.copyResult()"><i data-lucide="copy"></i> Salin</button>
          <button class="btn btn-secondary" onclick="DokpilPage.downloadResult()"><i data-lucide="download"></i> JSON</button>
        </div>
      </div>
      <div id="dokpil-fields"></div>

      <!-- Save to Tender -->
      <div class="card" style="margin-top:24px;">
        <div class="card-title" style="display:flex;align-items:center;gap:8px;">
          <i data-lucide="save" style="width:16px;height:16px;color:var(--accent);"></i>
          Simpan ke Tender Saya
        </div>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;">Pilih proyek dari Tender Saya, lalu simpan data dokpil ini.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
          <div class="form-group" style="flex:1;min-width:220px;margin:0;">
            <label class="form-label">Pilih Proyek</label>
            <select id="dokpil-tender-select" class="form-input" style="height:40px;">
              <option value="">— Memuat daftar tender… —</option>
            </select>
          </div>
          <button class="btn btn-primary" id="dokpil-save-btn" onclick="DokpilPage.saveToTender()" style="height:40px;">
            <i data-lucide="save"></i> Simpan
          </button>
        </div>
        <div id="dokpil-save-status" style="margin-top:10px;font-size:0.82rem;"></div>
      </div>
    </div>

    <!-- Error -->
    <div id="dokpil-error" class="hidden" style="text-align:center;padding:40px;">
      <i data-lucide="alert-triangle" style="width:48px;height:48px;color:var(--danger);margin-bottom:12px;"></i>
      <p id="dokpil-error-msg" style="color:var(--danger);font-weight:500;"></p>
      <button class="btn btn-secondary" style="margin-top:12px;" onclick="DokpilPage.reset()"><i data-lucide="refresh-cw"></i> Coba Lagi</button>
    </div>
    `;
  },

  async afterRender() {
    lucide.createIcons();
    await this.loadDriveFolder();
    this.loadFollowedTenders();
  },

  // ── Drive folder ──
  async loadDriveFolder() {
    try {
      const res = await fetch('/api/dokpil/drive/folder');
      const json = await res.json();
      this.driveFolderId = json.data?.folderId || '';
      this.driveCurrentFolder = this.driveFolderId;
      this.driveCurrentName = '';
      this.driveStack = [];
      if (this.driveFolderId) {
        await this.loadDriveList();
      } else {
        document.getElementById('dokpil-drive-list').innerHTML =
          '<div style="text-align:center;padding:32px;color:var(--text-muted);">' +
          '<i data-lucide="folder-x" style="width:32px;height:32px;margin-bottom:8px;"></i>' +
          '<p>Folder Drive belum diatur.</p>' +
          '<p style="font-size:0.8rem;">Buka <b>Pengaturan → Dokpil — Folder Google Drive</b> untuk mengatur folder induk.</p>' +
          '</div>';
        lucide.createIcons();
      }
    } catch (e) { /* ignore */ }
  },

  // ── Drive list ──
  async loadDriveList(folderId, folderName) {
    const target = folderId || this.driveCurrentFolder;
    if (!target) return;
    const listEl = document.getElementById('dokpil-drive-list');
    if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);"><div class="spinner" style="margin:0 auto 12px;"></div>Memuat folder…</div>';
    try {
      const res = await fetch(`/api/dokpil/drive/list?folderId=${encodeURIComponent(target)}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const { folders, pdfs } = json.data;
      this.driveCurrentFolder = target;
      if (folderName !== undefined) this.driveCurrentName = folderName;
      this.renderBreadcrumb();
      this.renderDriveGrid(folders, pdfs);
    } catch (err) {
      if (listEl) listEl.innerHTML = `<div style="color:var(--danger);padding:24px;text-align:center;font-size:0.85rem;">${Fmt.escape(err.message)}</div>`;
    }
  },

  renderBreadcrumb() {
    const el = document.getElementById('dokpil-breadcrumb');
    if (!el) return;
    const parts = [];
    // root
    parts.push(`<a href="#" onclick="DokpilPage.driveGoRoot();return false;" style="color:var(--accent);text-decoration:none;display:flex;align-items:center;gap:4px;"><i data-lucide="hard-drive" style="width:14px;height:14px;"></i> Drive</a>`);
    // stack entries (name + id)
    for (let i = 0; i < this.driveStack.length; i++) {
      const s = this.driveStack[i];
      parts.push('<span style="color:var(--text-muted);">/</span>');
      parts.push(`<a href="#" onclick="DokpilPage.driveGoTo(${i});return false;" style="color:var(--accent);text-decoration:none;">${Fmt.escape(s.name || 'Folder')}</a>`);
    }
    // current
    if (this.driveCurrentName) {
      parts.push('<span style="color:var(--text-muted);">/</span>');
      parts.push(`<span style="color:var(--text-primary);font-weight:600;">${Fmt.escape(this.driveCurrentName)}</span>`);
    }
    el.innerHTML = parts.join('');
    lucide.createIcons();
  },

  renderDriveGrid(folders, pdfs) {
    const listEl = document.getElementById('dokpil-drive-list');
    if (!listEl) return;

    if (!folders.length && !pdfs.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);"><i data-lucide="folder-open" style="width:32px;height:32px;margin-bottom:8px;opacity:0.4;"></i><p>Folder ini kosong.</p></div>';
      lucide.createIcons();
      return;
    }

    const folderCards = folders.map(f => `
      <div class="dokpil-drive-card" onclick="DokpilPage.driveInto('${f.id}', '${Fmt.escape(f.name).replace(/'/g, "\\'")}')" title="${Fmt.escape(f.name)}">
        <div class="dokpil-drive-card-icon" style="background:rgba(251,188,4,0.12);color:#fbbc04;">
          <i data-lucide="folder"></i>
        </div>
        <div class="dokpil-drive-card-name">${Fmt.escape(f.name)}</div>
      </div>`).join('');

    const pdfCards = pdfs.map(f => `
      <div class="dokpil-drive-card" onclick="DokpilPage.parseDriveFile('${f.id}', '${Fmt.escape(f.name).replace(/'/g, "\\'")}')" title="Klik untuk parse">
        <div class="dokpil-drive-card-icon" style="background:rgba(234,67,53,0.12);color:#ea4335;">
          <i data-lucide="file-text"></i>
        </div>
        <div class="dokpil-drive-card-name">${Fmt.escape(f.name.replace(/\.pdf$/i, ''))}</div>
        <div class="dokpil-drive-card-meta">PDF</div>
      </div>`).join('');

    listEl.innerHTML = `<div class="dokpil-drive-grid">${folderCards}${pdfCards}</div>`;
    lucide.createIcons();
  },

  driveInto(id, name) {
    this.driveStack.push({ id: this.driveCurrentFolder, name: this.driveCurrentName });
    this.loadDriveList(id, name);
  },

  driveGoTo(index) {
    // pop back to index
    this.driveStack = this.driveStack.slice(0, index);
    const target = index === 0 ? { id: this.driveFolderId, name: '' } : this.driveStack[index - 1];
    this.driveCurrentFolder = target.id;
    this.driveCurrentName = target.name || '';
    this.driveStack = this.driveStack.slice(0, index);
    this.loadDriveList(target.id, target.name);
  },

  driveGoRoot() {
    this.driveStack = [];
    this.driveCurrentFolder = this.driveFolderId;
    this.driveCurrentName = '';
    this.loadDriveList();
  },

  // ── Parse ──
  async parseDriveFile(fileId, fileName) {
    this.currentFileName = fileName;
    document.getElementById('dokpil-error').classList.add('hidden');
    document.getElementById('dokpil-result-section').classList.add('hidden');
    document.getElementById('dokpil-raw-section').classList.add('hidden');
    document.getElementById('dokpil-loading').classList.remove('hidden');
    const badge = document.getElementById('dokpil-drive-badge');
    if (badge) badge.textContent = '📄 ' + fileName;

    try {
      const res = await fetch('/api/dokpil/drive/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
      });
      const json = await res.json();
      document.getElementById('dokpil-loading').classList.add('hidden');
      if (!json.success) throw new Error(json.error || 'Gagal memproses PDF dari Drive');

      this.extractedFields = json.data.fields;
      this.extractedTables = json.data.tables || {};
      this.aiSummary = json.data.ai_summary || '';
      this.aiEnabled = json.data.ai_enabled || false;
      this.rawText = json.data.raw_text_preview || '';

      // Preview BAB IV — toggle available, default hidden
      const rawSection = document.getElementById('dokpil-raw-section');
      const rawText = document.getElementById('dokpil-raw-text');
      if (rawText && this.rawText) {
        rawText.textContent = this.rawText;
        rawText.classList.add('hidden');
        rawSection.classList.remove('hidden');
        const chevron = document.getElementById('dokpil-raw-chevron');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        const label = document.getElementById('dokpil-raw-toggle-label');
        if (label) label.textContent = 'Tampilkan';
      }

      this.renderFields();
      document.getElementById('dokpil-result-section').classList.remove('hidden');
      Toast.success('Data berhasil diekstrak dari Drive');
    } catch (err) {
      document.getElementById('dokpil-loading').classList.add('hidden');
      document.getElementById('dokpil-error-msg').textContent = err.message;
      document.getElementById('dokpil-error').classList.remove('hidden');
      Toast.error(err.message);
    }
  },

  toggleRaw() {
    const rawText = document.getElementById('dokpil-raw-text');
    const chevron = document.getElementById('dokpil-raw-chevron');
    const label = document.getElementById('dokpil-raw-toggle-label');
    if (!rawText) return;
    const hidden = rawText.classList.toggle('hidden');
    if (chevron) chevron.style.transform = hidden ? 'rotate(0deg)' : 'rotate(180deg)';
    if (label) label.textContent = hidden ? 'Tampilkan' : 'Sembunyikan';
  },

  copyRaw() {
    navigator.clipboard.writeText(this.rawText).then(() => {
      Toast.success('Raw text disalin ke clipboard');
    }).catch(() => {
      Toast.warning('Gagal menyalin, salin manual');
    });
  },

  // Parse ulang dari teks yang DIPILIH user di Preview BAB IV (handle PDF dgn layout beda)
  async reextractSelected() {
    const sel = window.getSelection();
    const selected = (sel && sel.toString() ? sel.toString() : '').trim();
    const rawEl = document.getElementById('dokpil-raw-text');
    // pastikan preview terbuka agar user bisa pilih teks
    if (rawEl && rawEl.classList.contains('hidden')) {
      rawEl.classList.remove('hidden');
      const chev = document.getElementById('dokpil-raw-chevron');
      if (chev) chev.style.transform = 'rotate(180deg)';
      const lbl = document.getElementById('dokpil-raw-toggle-label');
      if (lbl) lbl.textContent = 'Sembunyikan';
      Toast.info('Preview dibuka. Blok teks yang mau diparse, lalu klik "Parse ulang pilihan" lagi.');
      return;
    }
    if (!selected) {
      Toast.warning('Blok dulu teks di Preview BAB IV (atau klik tanpa blok untuk parse ulang teks penuh)');
    }
    const loading = document.getElementById('dokpil-loading');
    const errEl = document.getElementById('dokpil-error');
    if (loading) loading.classList.remove('hidden');
    if (errEl) errEl.classList.add('hidden');
    try {
      const res = await fetch('/api/dokpil/reextract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selected })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal parse ulang');
      this.extractedFields = json.data.fields || {};
      this.extractedTables = json.data.tables || {};
      if (json.data.raw_text_preview) this.rawText = json.data.raw_text_preview;
      const rawTextEl = document.getElementById('dokpil-raw-text');
      if (rawTextEl) rawTextEl.textContent = this.rawText;
      const resultSection = document.getElementById('dokpil-result-section');
      if (resultSection) resultSection.classList.remove('hidden');
      this.renderFields();
      lucide.createIcons();
      Toast.success(selected ? 'Berhasil parse ulang pilihan teks' : 'Berhasil parse ulang');
    } catch (err) {
      if (errEl) errEl.classList.remove('hidden');
      const msgEl = document.getElementById('dokpil-error-msg');
      if (msgEl) msgEl.textContent = err.message;
      Toast.error(err.message);
    } finally {
      if (loading) loading.classList.add('hidden');
    }
  },

  // ── Followed tenders ──
  async loadFollowedTenders() {
    try {
      const res = await fetch('/api/followed');
      const json = await res.json();
      this.followedTenders = json.data || [];
      const sel = document.getElementById('dokpil-tender-select');
      if (!sel) return;
      if (!this.followedTenders.length) {
        sel.innerHTML = '<option value="">— Belum ada tender diikuti —</option>';
        return;
      }
      sel.innerHTML = '<option value="">— Pilih proyek —</option>' +
        this.followedTenders.map(t =>
          `<option value="${t.kode_tender}">${Fmt.escape(t.nama_tender || t.kode_tender)}${t.kode_tender ? ' (' + t.kode_tender + ')' : ''}</option>`
        ).join('');
    } catch (e) { /* ignore */ }
  },

  // ── Save to DB ──
  async saveToTender() {
    const sel = document.getElementById('dokpil-tender-select');
    const statusEl = document.getElementById('dokpil-save-status');
    const btn = document.getElementById('dokpil-save-btn');
    const kodeTender = sel?.value;
    if (!kodeTender) {
      Toast.warning('Pilih proyek dulu');
      return;
    }

    const fields = this.getFields();
    const tables = this.getTables();
    const payload = {
      kode_tender: kodeTender,
      nama_file: this.currentFileName,
      pokja: fields.pokja || '',
      alamat_pokja: fields.alamat_pokja || '',
      nama_paket: fields.nama_paket || '',
      lokasi: fields.lokasi || '',
      jangka_waktu: fields.jangka_waktu || '',
      pagu_anggaran: fields.pagu_anggaran || '',
      pagu_terbilang: this.extractedFields.pagu_terbilang || '',
      kir: fields.kir || this.extractedFields.kir || 'tidak',
      peralatan: tables.peralatan || [],
      personel: tables.personel || [],
      rkk: tables.rkk || [],
    };

    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Menyimpan…';
    lucide.createIcons();

    try {
      const res = await fetch('/api/dokpil/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      statusEl.innerHTML = '<span style="color:var(--success);">✓ Tersimpan ke tender ' + Fmt.escape(kodeTender) + '</span>';
      Toast.success('Data dokpil tersimpan ke Tender Saya');
    } catch (err) {
      statusEl.innerHTML = `<span style="color:var(--danger);">✕ ${Fmt.escape(err.message)}</span>`;
      Toast.error(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="save"></i> Simpan';
      lucide.createIcons();
    }
  },

  // ── Fields render ──
  renderFields() {
    const container = document.getElementById('dokpil-fields');
    if (!container) return;
    container.innerHTML = '';

    const fieldDefs = [
      { key: 'pokja', label: 'Nama Pokja / Kelompok Kerja' },
      { key: 'alamat_pokja', label: 'Alamat Pokja' },
      { key: 'nama_paket', label: 'Nama Paket Pekerjaan' },
      { key: 'lokasi', label: 'Lokasi Pekerjaan' },
      { key: 'jangka_waktu', label: 'Jangka Waktu Pelaksanaan (hari)' },
      { key: 'pagu_anggaran', label: 'Pagu Anggaran (Rp)' },
      { key: 'kir', label: 'Mensyaratkan KIR?', readOnly: true },
    ];

    const rows = fieldDefs.map(f => {
      const val = this.extractedFields[f.key] || '';
      if (f.readOnly) {
        return `
        <tr>
          <td class="dokpil-td-label">${f.label}</td>
          <td class="dokpil-td-value">
            <span style="font-weight:600;color:${val === 'ya' ? 'var(--success)' : 'var(--text-muted)'};">${val ? val.toUpperCase() : '—'}</span>
          </td>
        </tr>`;
      }
      const rowsCount = val ? Math.min(val.split('\n').length + 1, 6) : 2;
      return `
      <tr>
        <td class="dokpil-td-label">
          ${f.label}
          <span class="dokpil-field-status ${val ? 'found' : 'missing'}">${val ? 'Ditemukan' : 'Kosong'}</span>
        </td>
        <td class="dokpil-td-value">
          <textarea class="form-textarea dokpil-field-input" data-key="${f.key}" rows="${rowsCount}">${Fmt.escape(val)}</textarea>
        </td>
      </tr>`;
    }).join('');

    const paguTbl = this.extractedFields.pagu_terbilang;
    const terbilangRow = paguTbl ? `
      <tr>
        <td class="dokpil-td-label">Terbilang</td>
        <td class="dokpil-td-value" style="font-style:italic;color:var(--text-muted);padding:8px 12px;">${Fmt.escape(paguTbl)}</td>
      </tr>` : '';

    const tableHtml = `
      <table class="dokpil-result-table">
        <thead><tr><th style="width:32%;">Field</th><th>Nilai (bisa diedit)</th></tr></thead>
        <tbody>${rows}${terbilangRow}</tbody>
      </table>`;

    const tablesHtml = this.renderTables();

    const aiHtml = this.aiSummary ? `
      <div style="margin-top:24px;font-size:0.85rem;color:var(--text-muted);border-top:1px solid var(--border);padding-top:16px;">
        <div style="white-space:pre-wrap;line-height:1.7;">${Fmt.escape(this.aiSummary)}</div>
        <div style="margin-top:8px;font-style:italic;font-size:0.75rem;">Diolah oleh AI Cloudflare</div>
      </div>` : '';

    container.innerHTML = tableHtml + (tablesHtml ? `<h4 style="margin:24px 0 12px;">Tabel Terstruktur (Persyaratan Teknis & RKK)</h4>${tablesHtml}` : '') + aiHtml;
  },

  renderTables() {
    const tables = this.extractedTables;
    if (!tables || !Object.keys(tables).length) return '';

    const titles = {
      peralatan: 'Peralatan Utama',
      personel: 'Personel Manajerial',
      rkk: 'Rencana Keselamatan Konstruksi (RKK)'
    };

    const html = Object.keys(titles).map(key => {
      const t = tables[key];
      if (t && t.rows && t.rows.length) {
        const headerCells = t.header
          ? `<tr><th>${t.header.map(h => Fmt.escape(h)).join('</th><th>')}</th></tr>`
          : '';
        const colCount = t.header ? t.header.length : (t.rows[0] ? t.rows[0].length : 0);
        // editable: each cell = <input data-table data-row data-col>
        const bodyRows = t.rows.map((r, ri) =>
          `<tr>${Array.from({ length: colCount }, (_, ci) =>
            `<td><input class="dokpil-cell-input" data-table="${key}" data-row="${ri}" data-col="${ci}" value="${Fmt.escape(r[ci] || '')}" /></td>`
          ).join('')}</tr>`
        ).join('');
        return `
        <div class="dokpil-subtable">
          <div class="dokpil-subtable-title">${titles[key]} <span style="font-weight:400;color:var(--text-muted);font-size:0.72rem;">(bisa diedit)</span></div>
          <div style="overflow:auto;">
            <table class="structured-table">
              <thead>${headerCells}</thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </div>
        </div>`;
      }
      return '';
    }).join('');

    return html;
  },

  getFields() {
    const inputs = document.querySelectorAll('.dokpil-field-input');
    const fields = {};
    inputs.forEach(inp => {
      fields[inp.getAttribute('data-key')] = inp.value;
    });
    return fields;
  },

  // baca nilai tabel yang diedit (berdasarkan data-table/row/col), fallback ke extractedTables
  getTables() {
    const out = {};
    const inputs = document.querySelectorAll('.dokpil-cell-input');
    if (!inputs.length) {
      // belum dirender / tidak ada tabel → pakai hasil ekstraksi mentah
      return {
        peralatan: this.extractedTables.peralatan?.rows || [],
        personel: this.extractedTables.personel?.rows || [],
        rkk: this.extractedTables.rkk?.rows || [],
      };
    }
    const grouped = {};
    inputs.forEach(inp => {
      const t = inp.getAttribute('data-table');
      const r = parseInt(inp.getAttribute('data-row'), 10);
      const c = parseInt(inp.getAttribute('data-col'), 10);
      (grouped[t] = grouped[t] || []);
      (grouped[t][r] = grouped[t][r] || [])[c] = inp.value;
    });
    return {
      peralatan: grouped.peralatan || [],
      personel: grouped.personel || [],
      rkk: grouped.rkk || [],
    };
  },

  copyResult() {
    const fields = this.getFields();
    const tables = this.getTables();
    const fieldText = Object.entries(fields)
      .filter(([_, v]) => v)
      .map(([k, v]) => {
        const label = {
          pokja: 'Nama Pokja',
          alamat_pokja: 'Alamat Pokja',
          nama_paket: 'Nama Paket Pekerjaan',
          lokasi: 'Lokasi Pekerjaan',
          jangka_waktu: 'Jangka Waktu Pelaksanaan',
          pagu_anggaran: 'Pagu Anggaran',
        }[k] || k;
        return `${label}: ${v}`;
      }).join('\n\n');

    const titles = { peralatan: 'Peralatan Utama', personel: 'Personel Manajerial', rkk: 'RKK' };
    const tableText = Object.keys(titles).map(key => {
      const rows = tables[key];
      if (!rows || !rows.length) return '';
      const lines = rows.map(r => '  • ' + (Array.isArray(r) ? r.filter(Boolean).join(' | ') : r)).join('\n');
      return `\n${titles[key]}:\n${lines}`;
    }).join('\n');

    const text = fieldText + tableText;

    navigator.clipboard.writeText(text).then(() => {
      Toast.success('Data disalin ke clipboard');
    }).catch(() => {
      Toast.warning('Gagal menyalin, salin manual');
    });
  },

  downloadResult() {
    const fields = this.getFields();
    const tables = this.getTables();
    const blob = new Blob([JSON.stringify({ ...fields, tables }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dokpil-extracted.json';
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('File JSON terdownload');
  },

  reset() {
    document.getElementById('dokpil-error').classList.add('hidden');
    document.getElementById('dokpil-result-section').classList.add('hidden');
    document.getElementById('dokpil-raw-section').classList.add('hidden');
  }
};
