// ponytail: localStorage bisa diblokir (private mode / cookie diblokir) → jangan sampai
// seluruh modul gagal init. Semua akses dibungkus try/catch.
function lsGet(key) {
  try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch (e) { /* abaikan */ }
}

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
  aiModels: [],
  aiModel: lsGet('dokpil_ai_model'),

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
      <!-- AI model picker -->
      <div id="dokpil-ai-bar" style="display:none;align-items:center;gap:8px;margin-bottom:12px;font-size:0.82rem;">
        <i data-lucide="sparkles" style="width:14px;height:14px;color:var(--accent);"></i>
        <span style="color:var(--text-muted);white-space:nowrap;">Model AI</span>
        <select id="dokpil-ai-model" class="form-input" style="height:32px;max-width:320px;font-size:0.8rem;" onchange="DokpilPage.onModelChange(this.value)"></select>
        <span id="dokpil-ai-model-note" style="color:var(--text-muted);font-size:0.72rem;"></span>
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
        <div class="card-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <i data-lucide="eye" style="width:16px;height:16px;"></i>
          Preview BAB IV
          <span id="dokpil-raw-meta" style="font-weight:400;font-size:0.75rem;color:var(--text-3);"></span>
          <span style="margin-left:auto;display:flex;gap:8px;">
            <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.8rem;" onclick="DokpilPage.toggleRawClean()" id="dokpil-raw-clean-btn">
              <i data-lucide="wand-2" style="width:13px;height:13px;"></i> <span id="dokpil-raw-clean-label">Bersihkan</span>
            </button>
            <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.8rem;" onclick="DokpilPage.copyRaw()">Salin</button>
            <button class="btn btn-secondary" style="padding:4px 10px;font-size:0.8rem;" onclick="DokpilPage.toggleRaw()">
              <i data-lucide="chevron-down" id="dokpil-raw-chevron" style="width:14px;height:14px;transition:transform 0.2s;"></i>
              <span id="dokpil-raw-toggle-label">Tampilkan</span>
            </button>
          </span>
        </div>
        <div id="dokpil-raw-body" class="hidden">
          <p class="dokpil-raw-hint">Ground truth untuk verifikasi hasil ekstraksi — bandingkan isi BAB IV ini dengan hasil parser di atas.</p>
          <pre id="dokpil-raw-text" class="dokpil-raw-text"></pre>
        </div>
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
          <div class="form-group" style="flex:1;min-width:240px;margin:0;">
            <label class="form-label">Pilih Proyek</label>
            <div class="dokpil-tender-picker">
              <div class="search-box" style="max-width:none;">
                <i data-lucide="search"></i>
                <input type="text" id="dokpil-tender-search" placeholder="Ketik min. 3 karakter untuk mencari proyek..." autocomplete="off"
                       oninput="DokpilPage.filterTenders()" onfocus="DokpilPage.filterTenders()" onkeydown="DokpilPage.tenderSearchKey(event)">
                <div id="dokpil-tender-list" class="dokpil-tender-list hidden"></div>
              </div>
              <div id="dokpil-tender-hint" class="dokpil-tender-hint hidden"></div>
              <div id="dokpil-tender-selected" class="dokpil-tender-selected hidden"></div>
            </div>
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
    this.loadAiModels();
    await this.loadDriveFolder();
    this.loadFollowedTenders();
    // tutup dropdown picker saat klik di luar
    if (this._docClick) document.removeEventListener('click', this._docClick);
    this._docClick = (e) => {
      const picker = document.querySelector('.dokpil-tender-picker');
      if (picker && !picker.contains(e.target)) {
        document.getElementById('dokpil-tender-list')?.classList.add('hidden');
      }
    };
    document.addEventListener('click', this._docClick);
  },

  // ── AI model picker ──
  async loadAiModels() {
    try {
      const res = await fetch('/api/dokpil/ai/models');
      const json = await res.json();
      this.aiModels = json.data?.models || [];
      const def = json.data?.default || '';
      if (!this.aiModel) this.aiModel = def;
      const sel = document.getElementById('dokpil-ai-model');
      if (!sel) return;
      sel.innerHTML = this.aiModels.map(m =>
        `<option value="${Fmt.escape(m.id)}"${m.id === this.aiModel ? ' selected' : ''}>${Fmt.escape(m.name)}</option>`
      ).join('');
      if (this.aiModels.length) document.getElementById('dokpil-ai-bar').style.display = 'flex';
      const note = document.getElementById('dokpil-ai-model-note');
      if (note) note.textContent = `${this.aiModels.length} model gratis`;
    } catch (e) { /* offline / no key — hide bar, AI skip */ }
  },
  onModelChange(v) {
    this.aiModel = v;
    lsSet('dokpil_ai_model', v);
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
        <div class="dokpil-drive-card-meta">FOLDER</div>
        ${f.modifiedTime ? `<div class="dokpil-drive-card-time" title="Terakhir diubah: ${Fmt.dateTime(f.modifiedTime)}">Diperbarui ${Fmt.dateShort(f.modifiedTime)}</div>` : ''}
      </div>`).join('');

    const pdfCards = pdfs.map(f => `
      <div class="dokpil-drive-card" onclick="DokpilPage.parseDriveFile('${f.id}', '${Fmt.escape(f.name).replace(/'/g, "\\'")}')" title="Klik untuk parse">
        <div class="dokpil-drive-card-icon" style="background:rgba(234,67,53,0.12);color:#ea4335;">
          <i data-lucide="file-text"></i>
        </div>
        <div class="dokpil-drive-card-name">${Fmt.escape(f.name.replace(/\.pdf$/i, ''))}</div>
        <div class="dokpil-drive-card-meta">PDF</div>
        ${f.modifiedTime ? `<div class="dokpil-drive-card-time" title="Terakhir diubah: ${Fmt.dateTime(f.modifiedTime)}">Upload ${Fmt.dateShort(f.modifiedTime)}</div>` : ''}
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
        body: JSON.stringify({ fileId, aiModel: this.aiModel })
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
        this.rawClean = false;
        this._rawCleanCache = undefined;
        rawText.textContent = this.rawText;
        document.getElementById('dokpil-raw-body')?.classList.add('hidden');
        rawSection.classList.remove('hidden');
        const chevron = document.getElementById('dokpil-raw-chevron');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        const label = document.getElementById('dokpil-raw-toggle-label');
        if (label) label.textContent = 'Tampilkan';
        const cleanLabel = document.getElementById('dokpil-raw-clean-label');
        if (cleanLabel) cleanLabel.textContent = 'Bersihkan';
        this.updateRawMeta();
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
    const body = document.getElementById('dokpil-raw-body');
    const chevron = document.getElementById('dokpil-raw-chevron');
    const label = document.getElementById('dokpil-raw-toggle-label');
    if (!body) return;
    const hidden = body.classList.toggle('hidden');
    if (chevron) chevron.style.transform = hidden ? 'rotate(0deg)' : 'rotate(180deg)';
    if (label) label.textContent = hidden ? 'Tampilkan' : 'Sembunyikan';
  },

  // Teks PDF mentah: 38% baris kosong + kata terpotong per baris → rapikan utk dibaca.
  // "Mentah" (toggle) tetap tersedia utk ground truth persis.
  toggleRawClean() {
    this.rawClean = !this.rawClean;
    const pre = document.getElementById('dokpil-raw-text');
    if (pre) pre.textContent = this.rawClean ? this.cleanRawText() : this.rawText;
    const label = document.getElementById('dokpil-raw-clean-label');
    if (label) label.textContent = this.rawClean ? 'Mentah' : 'Bersihkan';
    const btn = document.getElementById('dokpil-raw-clean-btn');
    if (btn) btn.classList.toggle('active', this.rawClean);
    this.updateRawMeta();
  },

  // Buang furniture halaman, gabung baris lanjutan yg terpotong, buang baris kosong berlebih.
  cleanRawText() {
    if (this._rawCleanCache !== undefined) return this._rawCleanCache;
    const NEW_ITEM = /^\s*(?:[a-zA-Z]\.\s|\d+[.)]\s)/;      // "a. Foo", "1) Foo", "1. Foo"
    const PAGE_NO  = /^\s*[-–—]\s*\d+\s*[-–—]\s*$/;       // "- 73 -"
    const PARA_F   = /^Paraf\b/;                            // "Paraf 1 Paraf 2 Paraf 3"
    const ABBR     = /\b(Jl|No|Tp|Kab|Kec|Prov|Desa|Blok|hal|dsb|dst|dkk|a\.n)\.$/i; // "Jl." → lanjutan
    const out = [];
    for (const raw of String(this.rawText || '').split('\n')) {
      const line = raw.replace(/\s+$/, '');
      const t = line.trim();
      if (!t) continue;                          // buang baris kosong
      if (PAGE_NO.test(t) || PARA_F.test(t)) continue;  // buang furniture halaman
      const prev = out[out.length - 1];
      const endsSentence = prev !== undefined && /\.$/.test(prev) && !ABBR.test(prev);
      const canMerge = prev !== undefined
        && !/:$/.test(prev)                       // label ("Pokja Pemilihan :") → jangan digabung
        && !endsSentence                         // kalimat selesai → jangan digabung
        && !NEW_ITEM.test(t)                     // baris baru → jangan digabung ke atas
        && !/^Keterangan/i.test(t);
      if (canMerge) out[out.length - 1] = prev + ' ' + t;
      else out.push(t);
    }
    this._rawCleanCache = out.join('\n');
    return this._rawCleanCache;
  },

  // Counter karakter/baris di header preview
  updateRawMeta() {
    const el = document.getElementById('dokpil-raw-meta');
    if (!el) return;
    const txt = this.rawClean ? this.cleanRawText() : (this.rawText || '');
    const lines = txt ? txt.split('\n').length : 0;
    el.textContent = txt ? `${lines} baris · ${txt.length.toLocaleString('id-ID')} karakter` : '';
  },

  copyRaw() {
    navigator.clipboard.writeText(this.rawText).then(() => {
      Toast.success('Raw text disalin ke clipboard');
    }).catch(() => {
      Toast.warning('Gagal menyalin, salin manual');
    });
  },

  // ── Followed tenders (searchable picker) ──
  async loadFollowedTenders() {
    try {
      const res = await fetch('/api/followed');
      const json = await res.json();
      this.followedTenders = json.data || [];
      this.selectedTenderId = '';
      const selBox = document.getElementById('dokpil-tender-selected');
      if (selBox) { selBox.classList.add('hidden'); selBox.innerHTML = ''; }
      this.renderTenderList('');
    } catch (e) { /* ignore */ }
  },

  // Tampilkan daftar proyek (difilter q). List baru muncul setelah ketik >= 3 karakter.
  renderTenderList(q) {
    const list = document.getElementById('dokpil-tender-list');
    const hint = document.getElementById('dokpil-tender-hint');
    if (!list) return;
    const needle = String(q || '').trim();
    const all = this.followedTenders || [];

    // Gate: min 3 karakter → list tetap tertutup, kasih hint biar user ga bingung
    if (needle.length < 3) {
      list.classList.add('hidden');
      if (hint) {
        if (needle.length) {
          hint.textContent = 'Ketik minimal 3 karakter untuk mencari proyek.';
        } else {
          hint.textContent = all.length
            ? `${all.length} proyek tersedia — ketik minimal 3 karakter untuk mencari.`
            : 'Belum ada tender diikuti.';
        }
        hint.classList.remove('hidden');
      }
      return;
    }
    if (hint) hint.classList.add('hidden');

    const lower = needle.toLowerCase();
    const hits = all.filter(t => ((t.nama_tender || '') + ' ' + (t.kode_tender || '') + ' ' + (t.satuan_kerja || '')).toLowerCase().includes(lower));

    if (!all.length) {
      list.innerHTML = '<div class="dokpil-tender-empty">Belum ada tender diikuti.</div>';
      list.classList.remove('hidden');
      this.placeTenderList(list);
      return;
    }
    if (!hits.length) {
      list.innerHTML = '<div class="dokpil-tender-empty">Tidak ada proyek cocok dengan "' + Fmt.escape(needle) + '".</div>';
      list.classList.remove('hidden');
      this.placeTenderList(list);
      return;
    }
    // Tampilkan max 60 hasil; sisanya via pencarian
    const shown = hits.slice(0, 60);
    list.innerHTML = shown.map(t => {
      const pagu = t.pagu ? Fmt.rupiah(t.pagu) : '';
      return `<div class="dokpil-tender-opt" data-kode="${t.kode_tender}" onclick="DokpilPage.pickTender(this.dataset.kode)">
        <div class="dokpil-tender-opt-name">${Fmt.escape(t.nama_tender || '(tanpa nama)')}</div>
        <div class="dokpil-tender-opt-meta">
          <span class="dokpil-tender-opt-kode">${t.kode_tender}</span>
          ${pagu ? '<span>' + pagu + '</span>' : ''}
          ${t.satuan_kerja ? '<span>' + Fmt.escape(t.satuan_kerja) + '</span>' : ''}
        </div>
      </div>`;
    }).join('') +
      (hits.length > shown.length
        ? `<div class="dokpil-tender-empty">… ${hits.length - shown.length} proyek lain. Ketik untuk mempersempit.</div>`
        : (hits.length > 1 ? `<div class="dokpil-tender-count">${hits.length} proyek</div>` : ''));
    list.classList.remove('hidden');
    this.placeTenderList(list);
  },

  // Default list ke ATAS; balik ke bawah kalo ruang di atas kurang (mis. halaman di scroll jauh).
  placeTenderList(list) {
    const inp = document.getElementById('dokpil-tender-search');
    if (!inp || !list) return;
    const r = inp.getBoundingClientRect();
    const spaceAbove = r.top;
    const spaceBelow = window.innerHeight - r.bottom;
    list.classList.toggle('drop-down', spaceAbove < 220 && spaceBelow > spaceAbove);
  },

  filterTenders() {
    const inp = document.getElementById('dokpil-tender-search');
    this.renderTenderList(inp ? inp.value : '');
  },

  // Enter = pilih hasil teratas; Escape = tutup
  tenderSearchKey(e) {
    if (e.key === 'Escape') {
      const list = document.getElementById('dokpil-tender-list');
      if (list) list.classList.add('hidden');
      return;
    }
    if (e.key !== 'Enter') return;
    const list = document.getElementById('dokpil-tender-list');
    const first = list && list.querySelector('.dokpil-tender-opt');
    if (first) this.pickTender(first.dataset.kode);
  },

  pickTender(kode) {
    const t = (this.followedTenders || []).find(x => String(x.kode_tender) === String(kode));
    if (!t) return;
    this.selectedTenderId = String(t.kode_tender);
    const inp = document.getElementById('dokpil-tender-search');
    if (inp) inp.value = '';
    const list = document.getElementById('dokpil-tender-list');
    if (list) list.classList.add('hidden');
    const hint = document.getElementById('dokpil-tender-hint');
    if (hint) hint.classList.add('hidden');
    const box = document.getElementById('dokpil-tender-selected');
    if (box) {
      box.innerHTML = `<i data-lucide="check-circle" style="width:14px;height:14px;"></i>
        <div class="dokpil-tender-selected-txt">
          <div class="dokpil-tender-selected-name">${Fmt.escape(t.nama_tender || '')}</div>
          <div class="dokpil-tender-selected-meta">Kode ${t.kode_tender}${t.pagu ? ' · ' + Fmt.rupiah(t.pagu) : ''}</div>
        </div>
        <button class="btn btn-secondary" style="padding:2px 8px;font-size:0.72rem;" onclick="DokpilPage.clearTender()">Ganti</button>`;
      box.classList.remove('hidden');
      lucide.createIcons();
    }
  },

  clearTender() {
    this.selectedTenderId = '';
    const box = document.getElementById('dokpil-tender-selected');
    if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
    this.renderTenderList('');
  },
  // ── Save to DB ──
  async saveToTender() {
    const statusEl = document.getElementById('dokpil-save-status');
    const btn = document.getElementById('dokpil-save-btn');
    const kodeTender = this.selectedTenderId;
    if (!kodeTender) {
      Toast.warning('Pilih proyek dulu');
      const inp = document.getElementById('dokpil-tender-search');
      if (inp) inp.focus();
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
        <div style="margin-top:8px;font-style:italic;font-size:0.75rem;">Diolah oleh AI (${Fmt.escape(this.aiModel || 'default')})</div>
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
