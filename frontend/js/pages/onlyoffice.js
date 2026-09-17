/**
 * TenderBuild — OnlyOffice Word Online (mirip filestash)
 * Embed DocumentServer via DocsAPI — Aptos, tabel live drag, Word asli
 */
const OnlyOfficePage = {
  _editor: null,
  _config: null,
  _templateId: null,

  async render(params) {
    // params dari hash: #onlyoffice?id=xxx atau dari query
    const q = new URLSearchParams(params || location.hash.split('?')[1] || '');
    const id = q.get('id') || this._templateId;
    if (id) this._templateId = id;
    return `
    <div class="page-header" style="margin-bottom:12px;">
      <div>
        <h2><i data-lucide="file-text" style="width:20px;height:20px; vertical-align:middle;"></i> Word Online — OnlyOffice</h2>
        <p>Edit template seperti MS Word asli • Aptos • tabel drag live • autosave ke server</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="OnlyOfficePage.back()"><i data-lucide="arrow-left"></i> Kembali ke Template</button>
        <button class="btn btn-secondary btn-sm" onclick="OnlyOfficePage.checkHealth()"><i data-lucide="activity"></i> Cek Server</button>
      </div>
    </div>
    <div id="oo-status" style="margin-bottom:12px; padding:10px 14px; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; font-size:0.85rem; color:#475569; display:none;"></div>
    <div id="oo-editor" style="width:100%; height:75vh; min-height:600px; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; background:white; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="display:flex; align-items:center; justify-content:center; height:100%; flex-direction:column; gap:12px; color:#64748b;">
        <div class="spinner"></div><div>Memuat Word Online (OnlyOffice)...</div>
        <div style="font-size:0.75rem; max-width:520px; text-align:center;">Jika ini pertama kali, jalankan <code>docker compose up -d onlyoffice</code> lalu tunggu 20-30 detik hingga DocumentServer siap di <code>http://localhost:8000</code></div>
      </div>
    </div>
    <div style="margin-top:12px; padding:12px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; font-size:0.82rem; color:#92400e;">
      <b>Cara pakai seperti Word asli:</b> Drag border kolom tabel untuk atur lebar live • pilih font <b>Aptos</b> di toolbar OnlyOffice (Home → Font) • sisipkan variabel <code style="background:#fef3c7; padding:1px 4px; border-radius:3px;">{{nama_perusahaan}}</code> langsung ketik atau copy dari panel Template • autosave otomatis ke database • klik kembali untuk lihat hasil cetak.
    </div>`;
  },

  async afterRender(params) {
    lucide.createIcons();
    const q = new URLSearchParams(params || location.hash.split('?')[1] || '');
    const id = q.get('id') || this._templateId;
    if (!id) {
      this._showStatus('Pilih template dulu dari halaman Template → <b>Edit dengan OnlyOffice</b>', 'warn');
      return;
    }
    this._templateId = id;
    await this.loadEditor(id);
  },

  _showStatus(msg, type='info') {
    const el = document.getElementById('oo-status');
    if (!el) return;
    const bg = type==='warn' ? '#fffbeb' : type==='error' ? '#fef2f2' : '#f0fdf4';
    const bd = type==='warn' ? '#fde68a' : type==='error' ? '#fecaca' : '#bbf7d0';
    el.style.background = bg; el.style.borderColor = bd; el.style.display='block'; el.innerHTML=msg;
  },

  async checkHealth() {
    try {
      const r = await fetch('/api/onlyoffice/health');
      const j = await r.json();
      if (j.reachable) this._showStatus(`✅ OnlyOffice DocumentServer aktif di <code>${j.documentServerUrl}</code> (status ${j.status})`, 'info');
      else this._showStatus(`❌ DocumentServer tidak terjangkau di <code>${j.documentServerUrl}</code> — jalankan <code>docker compose up -d onlyoffice</code> dan tunggu 30 detik.`, 'error');
    } catch(e) { this._showStatus('❌ Gagal cek health: '+e.message, 'error'); }
  },

  async loadEditor(templateId) {
    try {
      // 1. get config
      const res = await fetch(`/api/onlyoffice/config/${templateId}`);
      const j = await res.json();
      if (!j.success) throw new Error(j.error || 'Gagal ambil config OnlyOffice');
      const { documentServerUrl, config } = j.data;
      this._config = config;

      // 2. load DocsAPI script if needed
      const apiUrl = documentServerUrl.replace(/\/$/, '') + '/web-apps/apps/api/documents/api.js';
      if (!window.DocsAPI) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = apiUrl;
          s.onload = resolve;
          s.onerror = () => reject(new Error('Gagal load DocsAPI dari '+apiUrl+' — pastikan DocumentServer jalan di '+documentServerUrl));
          document.head.appendChild(s);
        });
      }
      // 3. create editor (destroy previous)
      if (this._editor) { try { this._editor.destroyEditor(); } catch(e) {} }
      // OnlyOffice expects target element id without '#'
      const holder = document.getElementById('oo-editor');
      if (holder) holder.innerHTML = '';
      const cfg = {
        ...config,
        width: '100%',
        height: '100%',
        events: {
          onReady: () => { this._showStatus('✅ Word Online siap — edit seperti MS Word asli. Drag kolom tabel, ganti font Aptos di Home → Font.', 'info'); },
          onError: (e) => {
            console.error('OnlyOffice error', e);
            let msg='Unknown error';
            try { msg = JSON.stringify(e, null, 2); if (e && e.data) msg = typeof e.data==='string'? e.data : JSON.stringify(e.data, null,2); } catch(_){ msg = String(e); }
            this._showStatus('❌ OnlyOffice error:<br><pre style="white-space:pre-wrap; font-size:0.75rem; margin-top:6px; background:#fef2f2; padding:8px; border-radius:4px; overflow:auto;">'+Fmt.escape(msg)+'</pre>', 'error');
          },
          onDocumentStateChange: (e) => { if (e.data) document.title = '● Word Online — OnlyOffice'; else document.title = 'Word Online — OnlyOffice'; }
        }
      };
      this._editor = new window.DocsAPI.DocEditor('oo-editor', cfg);
      // health check async
      this.checkHealth();
    } catch(e) {
      console.error(e);
      this._showStatus('❌ '+Fmt.escape(e.message)+'<br><br>Jalankan: <code>docker compose up -d onlyoffice</code> lalu refresh. Pastikan port 8000 tidak dipakai app lain.', 'error');
      const holder = document.getElementById('oo-editor');
      if (holder) holder.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; flex-direction:column; gap:12px; padding:24px; text-align:center; color:#dc2626;"><i data-lucide="alert-triangle" style="width:48px; height:48px;"></i><div style="font-weight:600;">Gagal memuat Word Online</div><div style="font-size:0.85rem; color:#475569;">${Fmt.escape(e.message)}</div><button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="OnlyOfficePage.loadEditor('${templateId}')">Coba Lagi</button></div>`;
      lucide.createIcons();
    }
  },

  back() { window.location.hash = '#templates'; },
};
