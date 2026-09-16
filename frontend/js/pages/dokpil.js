const DokpilPage = {
  extractedFields: {},
  extractedTables: {},
  rawText: '',
  aiSummary: '',
  aiEnabled: false,

  async render() {
    return `
    <div class="page-header">
      <div>
        <h2>Dokumen Pemilihan (Dokpil)</h2>
        <p>Upload Dokpil .PDF untuk ekstraksi data Lembar Data Pemilihan secara otomatis</p>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="card-title">Upload Dokumen</div>
      <div id="dokpil-upload-zone" class="dokpil-upload-zone" ondragover="event.preventDefault()" ondrop="DokpilPage.onDrop(event)">
        <i data-lucide="upload" style="width:48px;height:48px;color:var(--text-muted);margin-bottom:12px;"></i>
        <p style="font-weight:600;color:var(--text-primary);margin:0 0 4px;">Tarik & lepas file PDF di sini</p>
        <p style="font-size:0.85rem;color:var(--text-muted);margin:0 0 16px;">atau klik tombol di bawah untuk memilih file</p>
        <input type="file" id="dokpil-file-input" accept=".pdf" style="display:none;" onchange="DokpilPage.onFileSelect(event)">
        <button class="btn btn-primary" onclick="document.getElementById('dokpil-file-input').click()">
          <i data-lucide="file-text"></i> Pilih File PDF
        </button>
        <div id="dokpil-file-name" style="margin-top:12px;font-size:0.9rem;color:var(--accent);font-weight:500;display:none;"></div>
      </div>
    </div>

    <div id="dokpil-loading" class="hidden" style="text-align:center;padding:40px;">
      <div class="spinner" style="margin:0 auto 16px;"></div>
      <p style="color:var(--text-muted);">Membaca, mengekstrak, dan menganalisis PDF...</p>
    </div>

    <div id="dokpil-raw-section" class="hidden" style="margin-bottom:24px;">
      <div class="card">
        <div class="card-title">
          Preview BAB IV
          <button class="btn btn-secondary" style="float:right;padding:4px 10px;font-size:0.8rem;" onclick="DokpilPage.copyRaw()">Salin Text</button>
        </div>
        <pre id="dokpil-raw-text" style="max-height:300px;overflow:auto;background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);font-size:0.8rem;line-height:1.6;white-space:pre-wrap;margin:0;"></pre>
      </div>
    </div>

    <div id="dokpil-result-section" class="hidden">
      <div class="page-header" style="margin-bottom:16px;">
        <div><h3 style="margin:0;">Hasil Ekstraksi — Lembar Data Pemilihan</h3></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="DokpilPage.createSuratFromDokpil()"><i data-lucide="file-plus"></i> Buat Surat Penawaran dari Dokpil Ini</button>
          <button class="btn btn-secondary" onclick="DokpilPage.copyResult()"><i data-lucide="copy"></i> Salin</button>
          <button class="btn btn-secondary" onclick="DokpilPage.downloadResult()"><i data-lucide="download"></i> Download JSON</button>
        </div>
      </div>
      <div id="dokpil-fields"></div>
    </div>

    <div id="dokpil-error" class="hidden" style="text-align:center;padding:40px;">
      <i data-lucide="alert-triangle" style="width:48px;height:48px;color:var(--danger);margin-bottom:12px;"></i>
      <p id="dokpil-error-msg" style="color:var(--danger);font-weight:500;"></p>
      <button class="btn btn-secondary" style="margin-top:12px;" onclick="DokpilPage.reset()"><i data-lucide="refresh-cw"></i> Coba Lagi</button>
    </div>
    `;
  },

  async afterRender() {
    lucide.createIcons();
  },

  onDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      this.processFile(file);
    } else {
      Toast.warning('Hanya file PDF yang diizinkan');
    }
  },

  onFileSelect(e) {
    const file = e.target.files[0];
    if (file) this.processFile(file);
  },

  async processFile(file) {
    document.getElementById('dokpil-file-name').textContent = '📄 ' + file.name;
    document.getElementById('dokpil-file-name').style.display = 'block';
    document.getElementById('dokpil-error').classList.add('hidden');
    document.getElementById('dokpil-result-section').classList.add('hidden');
    document.getElementById('dokpil-raw-section').classList.add('hidden');
    document.getElementById('dokpil-loading').classList.remove('hidden');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/dokpil/parse', { method: 'POST', body: formData });
      const json = await res.json();

      document.getElementById('dokpil-loading').classList.add('hidden');

      if (!json.success) throw new Error(json.error || 'Gagal memproses PDF');

      this.extractedFields = json.data.fields;
      this.extractedTables = json.data.tables || {};
      this.aiSummary = json.data.ai_summary || '';
      this.aiEnabled = json.data.ai_enabled || false;

      this.rawText = json.data.raw_text_preview || '';
      const rawPreview = document.getElementById('dokpil-raw-text');
      if (rawPreview && this.rawText) {
        rawPreview.textContent = this.rawText;
        document.getElementById('dokpil-raw-section').classList.remove('hidden');
      }

      this.renderFields();
      document.getElementById('dokpil-result-section').classList.remove('hidden');
      Toast.success('Data berhasil diekstrak dari PDF');
    } catch (err) {
      document.getElementById('dokpil-loading').classList.add('hidden');
      document.getElementById('dokpil-error-msg').textContent = err.message;
      document.getElementById('dokpil-error').classList.remove('hidden');
      Toast.error(err.message);
    }
  },

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

    const textKeys = { peralatan: 'peralatan_text', personel: 'personel_text', rkk: 'rkk_text' };

    const html = Object.keys(titles).map(key => {
      const t = tables[key];
      if (t && t.rows && t.rows.length) {
        const headerCells = t.header
          ? `<tr><th>${t.header.map(h => Fmt.escape(h)).join('</th><th>')}</th></tr>`
          : '';
        const bodyRows = t.rows.map(r =>
          `<tr>${r.map(c => `<td>${Fmt.escape(c)}</td>`).join('')}</tr>`
        ).join('');
        return `
        <div class="dokpil-subtable">
          <div class="dokpil-subtable-title">${titles[key]}</div>
          <div style="overflow:auto;">
            <table class="structured-table">
              <thead>${headerCells}</thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </div>
        </div>`;
      }
      const txt = this.extractedFields[textKeys[key]];
      if (txt) {
        return `
        <div class="dokpil-subtable">
          <div class="dokpil-subtable-title">${titles[key]} (teks)</div>
          <pre style="background:var(--bg-input);padding:8px;border-radius:var(--radius-sm);font-size:0.75rem;white-space:pre-wrap;margin:0;">${Fmt.escape(txt)}</pre>
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

  copyResult() {
    const fields = this.getFields();
    const text = Object.entries(fields)
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

    navigator.clipboard.writeText(text).then(() => {
      Toast.success('Data disalin ke clipboard');
    }).catch(() => {
      Toast.warning('Gagal menyalin, salin manual');
    });
  },

  copyRaw() {
    navigator.clipboard.writeText(this.rawText).then(() => {
      Toast.success('Raw text disalin ke clipboard');
    }).catch(() => {
      Toast.warning('Gagal menyalin, salin manual');
    });
  },

  downloadResult() {
    const fields = this.getFields();
    const blob = new Blob([JSON.stringify(fields, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dokpil-extracted.json';
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('File JSON terdownload');
  },

  markdownToHTML(md) {
    if (!md) return '';
    return md.split('\n\n').map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('## ')) return `<h3 style="margin:8px 0 4px;">${Fmt.escape(p.slice(3))}</h3>`;
      if (p.startsWith('### ')) return `<h4 style="margin:6px 0 3px;">${Fmt.escape(p.slice(4))}</h4>`;
      if (p.startsWith('- ')) {
        const items = p.split('\n').filter(l => l.trim().startsWith('- '));
        return '<ul style="margin:4px 0;padding-left:20px;">' + items.map(i => `<li>${Fmt.escape(i.trim().slice(2))}</li>`).join('') + '</ul>';
      }
      return `<p style="margin:4px 0;">${Fmt.escape(p).replace(/\n/g, '<br>')}</p>`;
    }).join('');
  },

  createSuratFromDokpil() {
    const fields = this.getFields();
    // ponytail: include tables for auto-fill in Documents (D.5)
    const peralatan = this.extractedTables.peralatan?.rows || this.extractedFields.peralatan || [];
    const personel = this.extractedTables.personel?.rows || this.extractedFields.personel || [];
    const rkk = this.extractedTables.rkk?.rows || this.extractedFields.rkk || [];
    sessionStorage.setItem('dokpil_extracted_data', JSON.stringify({
      nama_paket: fields.nama_paket || this.extractedFields.nama_paket || '',
      pokja: fields.pokja || this.extractedFields.pokja || '',
      alamat_pokja: fields.alamat_pokja || this.extractedFields.alamat_pokja || '',
      pagu_anggaran: fields.pagu_anggaran || this.extractedFields.pagu_anggaran || '',
      pagu_terbilang: this.extractedFields.pagu_terbilang || '',
      jangka_waktu: fields.jangka_waktu || this.extractedFields.jangka_waktu || '',
      lokasi: fields.lokasi || this.extractedFields.lokasi || '',
      peralatan,
      personel,
      rkk
    }));
    window.location.hash = '#documents';
  },

  reset() {
    document.getElementById('dokpil-error').classList.add('hidden');
    document.getElementById('dokpil-result-section').classList.add('hidden');
    document.getElementById('dokpil-raw-section').classList.add('hidden');
    document.getElementById('dokpil-debug-section').classList.add('hidden');
    document.getElementById('dokpil-file-name').style.display = 'none';
    document.getElementById('dokpil-file-input').value = '';
  }
};
