/**
 * TenderBuild — Document Templates Page — WYSIWYG editor CKEditor 5 custom build (GPL-3.0)
 * ponytail: fidelity style dipertahankan plugin RawStyle (frontend/editor-src/rawstyle.js),
 * build & tes: npm run build:editor && npm run test:editor
 */
const TemplatesPage = {
    templates: [],
    _ck: null,
    _ckPromise: null,
    _ckHtml: '',
    _ckEpoch: 0,
    _ckCloseBound: false,
    _sample: null,
    _sampleP: null,

    async render() {
        return `
        <div class="page-header">
            <div><h2>Template Dokumen</h2><p>Kelola format kop surat, narasi, tanda tangan, dan layout dokumen</p></div>
            <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary" onclick="TemplatesPage.seedDefaultTemplates()"><i data-lucide="sparkles"></i> Muat Template Standar Tender</button>
                <button class="btn btn-primary" onclick="TemplatesPage.openEditor()"><i data-lucide="plus"></i> Buat Template</button>
            </div>
        </div>
        <div id="tpl-list"><div class="page-loading"><div class="spinner"></div></div></div>`;
    },

    async afterRender() { this.loadData(); },

    async loadData() {
        const el = document.getElementById('tpl-list');
        if (!el) return;
        try {
            const res = await API.getTemplates();
            this.templates = res.data || [];
            this.renderList();
        } catch (e) {
            el.innerHTML = '<div class="empty-state"><i data-lucide="layout"></i><p>Gagal memuat template</p></div>';
            lucide.createIcons();
        }
    },

    async seedDefaultTemplates() {
        Modal.confirm('Muat Template Standar', 'Apakah Anda ingin menambahkan 11 template standar dokumen penawaran tender (Penawaran, Pakta Integritas, K3/RKK, Kebenaran Dokumen, SKP, Personil, Peralatan, +4 baru: Pernyataan Mengikuti Tender, BPJS, Daftar Peralatan & Daftar Personil)?', async () => {
            try {
                const res = await API.seedTemplates();
                Toast.success(res.message || 'Template standar berhasil ditambahkan!');
                this.loadData();
            } catch (e) { Toast.error('Gagal memuat template standar: ' + e.message); }
        });
    },

    renderList() {
        const el = document.getElementById('tpl-list');
        if (!el) return;
        if (!this.templates.length) {
            el.innerHTML = `<div class="empty-state">
                <div style="width:64px;height:64px;border-radius:16px;background:rgba(59,130,246,0.1);color:var(--accent);display:flex;align-items:center;justify-content:center;margin:0 auto 16px auto;">
                    <i data-lucide="layout-template" style="width:32px;height:32px;"></i>
                </div>
                <h3>Belum Ada Template</h3>
                <p style="max-width:440px;margin:8px auto 20px auto;">Buat template baru atau gunakan tombol di bawah untuk memuat 11 template standar tender konstruksi.</p>
                <div style="display:flex; gap:12px; justify-content:center;">
                    <button class="btn btn-secondary" onclick="TemplatesPage.seedDefaultTemplates()"><i data-lucide="sparkles"></i> Muat Template Standar Tender</button>
                    <button class="btn btn-primary" onclick="TemplatesPage.openEditor()"><i data-lucide="plus"></i> Buat Template Manual</button>
                </div>
            </div>`;
            lucide.createIcons(); return;
        }
        el.innerHTML = this.templates.map(t => `
        <div class="card" style="margin-bottom:12px; padding:16px 20px; cursor:pointer;" onclick="TemplatesPage.openEditor('${t.id}')">
            <div style="display:flex; align-items:center; gap:16px; justify-content:space-between; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:0;">
                    <div style="width:48px; height:48px; border-radius:var(--radius-md); background:rgba(59,130,246,0.1); color:var(--accent); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i data-lucide="file-text"></i>
                    </div>
                    <div style="min-width:0;">
                        <div style="font-weight:600; font-size:0.95rem;">${Fmt.escape(t.nama_template)}</div>
                        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">
                            ${t.kategori ? '<span class="badge badge-info">' + Fmt.escape(t.kategori) + '</span> • ' : ''}
                            Ukuran Kertas: ${t.paper_size || 'A4'} • Margin: ${t.margin_top || 25}mm
                        </div>
                    </div>
                </div>
                <div class="table-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-secondary btn-sm" onclick="TemplatesPage.preview('${t.id}')"><i data-lucide="eye"></i> Preview</button>
                    <button class="btn btn-secondary btn-icon btn-sm" onclick="TemplatesPage.openEditor('${t.id}')" title="Edit dengan CKEditor"><i data-lucide="pencil"></i></button>
                    <button class="btn btn-danger btn-icon btn-sm" onclick="TemplatesPage.remove('${t.id}')" title="Hapus"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        </div>`).join('');
        lucide.createIcons();
    },

    // ─── VARIABLES ────────────────────────────────────
    VARS: [
        { key: '{{nama_perusahaan}}', label: 'Nama Perusahaan', cat: 'Perusahaan' },
        { key: '{{singkatan}}', label: 'Singkatan', cat: 'Perusahaan' },
        { key: '{{direktur}}', label: 'Direktur', cat: 'Perusahaan' },
        { key: '{{kota_perusahaan}}', label: 'Kota Perusahaan', cat: 'Perusahaan' },
        { key: '{{alamat}}', label: 'Alamat Perusahaan', cat: 'Perusahaan' },
        { key: '{{npwp}}', label: 'NPWP Perusahaan', cat: 'Perusahaan' },
        { key: '{{nama_paket}}', label: 'Nama Paket', cat: 'Tender' },
        { key: '{{kode_tender}}', label: 'Kode Tender', cat: 'Tender' },
        { key: '{{nilai_pagu}}', label: 'Nilai Pagu', cat: 'Tender' },
        { key: '{{nilai_hps}}', label: 'Nilai HPS', cat: 'Tender' },
        { key: '{{pagu_anggaran}}', label: 'Pagu Anggaran', cat: 'Tender' },
        { key: '{{terbilang}}', label: 'Terbilang (Rupiah)', cat: 'Tender' },
        { key: '{{nilai_pagu_terbilang}}', label: 'Terbilang Pagu', cat: 'Tender' },
        { key: '{{pagu_terbilang}}', label: 'Terbilang Pagu (dokpil)', cat: 'Tender' },
        { key: '{{instansi}}', label: 'Instansi/KLPD', cat: 'Tender' },
        { key: '{{pokja}}', label: 'Pokja Pemilihan', cat: 'Tender' },
        { key: '{{alamat_pokja}}', label: 'Alamat Pokja', cat: 'Tender' },
        { key: '{{lokasi}}', label: 'Lokasi Pekerjaan', cat: 'Tender' },
        { key: '{{jangka_waktu}}', label: 'Jangka Waktu (hari)', cat: 'Tender' },
        { key: '{{header_surat}}', label: 'Header Surat (No, Lamp, Hal)', cat: 'Surat' },
        { key: '{{nomor_surat}}', label: 'Nomor Surat', cat: 'Surat' },
        { key: '{{tanggal_surat}}', label: 'Tanggal Surat (Kota, tgl)', cat: 'Surat' },
        { key: '{{perihal}}', label: 'Perihal', cat: 'Surat' },
        { key: '{{lampiran}}', label: 'Lampiran', cat: 'Surat' },
        { key: '{{nama_personil}}', label: 'Nama Personil', cat: 'Personil/Peralatan' },
        { key: '{{jabatan_personil}}', label: 'Jabatan Personil', cat: 'Personil/Peralatan' },
        { key: '{{tabel_peralatan}}', label: 'Tabel Peralatan (auto)', cat: 'Personil/Peralatan' },
        { key: '{{tabel_personil}}', label: 'Tabel Personil (auto)', cat: 'Personil/Peralatan' },
        { key: '{{struktur_organisasi}}', label: 'Struktur Organisasi (bagan)', cat: 'Personil/Peralatan' },
        { key: '{{ttd_gabungan}}', label: 'TTD Pihak 1 & 2', cat: 'Tanda Tangan' },
        { key: '{{ttd_direktur}}', label: 'TTD Direktur', cat: 'Tanda Tangan' },
        { key: '{{ttd_personil}}', label: 'TTD Personil', cat: 'Tanda Tangan' },
    ],

    // ─── CKEDITOR (vendor/ckeditor5 — fidelity: plugin RawStyle) ──
    _loadCkCss() {
        if (document.getElementById('ck-editor-css')) return;
        const l = document.createElement('link');
        l.id = 'ck-editor-css';
        l.rel = 'stylesheet';
        l.href = '/vendor/ckeditor5/ckeditor.css';
        document.head.appendChild(l);
    },
    async _loadCk() {
        if (window.ClassicEditor) return;
        this._loadCkCss();
        if (!this._ckPromise) {
            this._ckPromise = new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = '/vendor/ckeditor5/ckeditor.js';
                s.onload = res;
                s.onerror = () => rej(new Error('Modul editor gagal dimuat'));
                document.head.appendChild(s);
            });
        }
        await this._ckPromise;
    },
    _destroyEditor() {
        this._ckEpoch++;
        const ed = this._ck;
        this._ck = null;
        if (ed) { try { ed.destroy(); } catch (_) {} }
    },
    async _initEditor(html, focus) {
        // epoch: init batal jika modal sudah ditutup di tengah jalan
        const epoch = ++this._ckEpoch;
        try {
            await this._loadCk();
            if (epoch !== this._ckEpoch) return;
            const src = document.getElementById('tpl-editor');
            if (!src) return;
            src.innerHTML = html || '<p><br></p>';
            this._ck = await window.ClassicEditor.create(src, { licenseKey: 'GPL' });
            if (epoch !== this._ckEpoch) { this._destroyEditor(); return; }
            this._ck.model.document.on('change:data', () => this.updateLiveEditorPreview());
            if (focus) this._ck.focus();
            this.updateLiveEditorPreview();
        } catch (e) { Toast.error('Editor gagal dimuat: ' + e.message); }
    },
    _editorToHtml() {
        const html = this._ck ? this._ck.getData() : this._ckHtml;
        if (!html || !html.trim() || html.trim() === '<p><br></p>') return '';
        return html.trim();
    },
    _insertVarAtCursor(varKey) {
        if (!this._ck) { Toast.info('Editor belum siap'); return; }
        this._ck.focus();
        this._ck.execute('input', { text: varKey + ' ' });
        this.updateLiveEditorPreview();
    },
    _ensureTableStyles(html) {
        // tabel baru bawaan CKEditor belum bergaya — samakan dengan tampilan & ekspor docx
        return html
            .replace(/<table(?=[\s>])(?![^>]*style=)/g, '<table style="width:100%; border-collapse:collapse; margin:10px 0; table-layout:fixed;"')
            .replace(/<(td|th)(?=[\s>])(?![^>]*style=)/g, '<$1 style="border:1px solid #000; padding:6px;"');
    },

    // ─── DATA CONTOH — data asli dari DB; kosong? crawl live SPSE ──
    async _sampleData() {
        if (this._sample) return this._sample;
        if (!this._sampleP) {
            this._sampleP = this._buildSample()
                .then(s => (this._sample = s))
                .catch(() => (this._sample = {}));
        }
        return this._sampleP;
    },
    async _buildSample() {
        const arr = p => p.then(r => (r && r.data) || []).catch(() => []);
        const [comps, tends, follows, crawls, pers, eqps, letters] = await Promise.all([
            arr(API.getCompanies()), arr(API.getTenders()), arr(API.getFollowedTenders()),
            arr(API.getCrawledTenders({ limit: 5 })), arr(API.getPersonnel()),
            arr(API.getEquipments()), arr(API.getLetters())
        ]);
        const c = comps[0] || {};
        const t = tends[0] || follows[0] || crawls[0] || await this._crawlSampleTender() || {};
        const p = pers[0] || {};
        const L = letters[0] || {};
        const esc = Fmt.escape;
        const pagu = t.pagu ?? t['Pagu'] ?? '';
        const hps = t.hps ?? t['HPS'] ?? '';
        const now = new Date();
        const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][now.getMonth()];
        const namaPaket = t.nama_paket || t.nama_tender || t['Nama Paket'] || '';
        const instansi = t.instansi || t.klpd || t['Instansi'] || t['LPSE'] || '';
        const tb = pagu !== '' ? DocumentsPage._terbilang(pagu) : '';
        const nomor = L.nomor_surat || `001/SP/${c.singkatan || 'XX'}/${roman}/${now.getFullYear()}`;
        const perihal = L.perihal || (namaPaket ? 'Penawaran ' + namaPaket : 'Penawaran');
        const tanggal = `${c.kota ? esc(c.kota) + ', ' : ''}${Fmt.date(now.toISOString())}`;
        const hRow = (label, val) => `<tr><td style="width:80px; padding:2px 0; vertical-align:top;">${label}</td><td style="width:15px; padding:2px 0; vertical-align:top;">:</td><td style="padding:2px 0; vertical-align:top;">${val}</td></tr>`;
        const cells = (v, center) => ` style="border:1px solid #000; padding:4px;${center ? ' text-align:center;' : ''}"`;
        const th = (v) => `<th${cells(v)}>${v}</th>`;
        const tbl = (heads, rows, kosong) => rows
            ? `<table style="width:100%; border-collapse:collapse; font-size:9pt;"><tr style="background:#f2f2f2;">${heads.map(th).join('')}</tr>${rows}</table>`
            : `<div style="border:1px dashed #94a3b8; padding:8px; text-align:center; color:#64748b; font-size:0.8rem;">[${kosong}]</div>`;
        const pRows = pers.slice(0, 20).map((x, i) =>
            `<tr><td${cells(1, 1)}>${i + 1}</td><td${cells(1)}>${esc(x.nama || '')}</td><td${cells(1)}>${esc(x.jabatan || x.pangkat || '-')}</td></tr>`).join('');
        const eqRows = eqps.slice(0, 20).map((e, i) =>
            `<tr><td${cells(1, 1)}>${i + 1}</td><td${cells(1)}>${esc(e.jenis || '')}</td><td${cells(1)}>${esc(e.kapasitas || '-')}</td><td${cells(1, 1)}>${esc(String(e.jumlah ?? '-'))}</td></tr>`).join('');
        const lok = t.lokasi || t.lokasi_pekerjaan || '';
        return {
            nama_perusahaan: esc(c.nama_perusahaan || ''),
            singkatan: esc(c.singkatan || ''),
            direktur: esc(c.direktur || ''),
            kota_perusahaan: esc(c.kota || ''),
            alamat: esc(c.alamat || ''),
            npwp: esc(c.npwp_usaha || ''),
            kop_nama: esc(c.kop_nama || c.nama_perusahaan || ''),
            kop_alamat: esc(c.kop_alamat || [c.alamat, c.kota].filter(Boolean).join(', ')),
            kop_kontak: esc(c.kop_kontak || ''),
            kop_is_image: !!c.kop_is_image,
            kop_image_url: c.kop_image_url || '',
            kop_garis_warna: c.kop_garis_warna || '#000000',
            font_surat: c.font_surat || 'Times New Roman',
            nama_paket: esc(namaPaket),
            kode_tender: esc(String(t.kode_tender || t['Kode Tender'] || '')),
            instansi: esc(instansi),
            lokasi: esc(typeof lok === 'object' && lok ? Object.values(lok).join(', ') : lok),
            pokja: esc(t.pokja || ''),
            alamat_pokja: esc(t.alamat_pokja || ''),
            jangka_waktu: esc(String(t.jangka_waktu || '')),
            nilai_pagu: pagu !== '' ? Fmt.rupiah(pagu) : '',
            nilai_hps: hps !== '' ? Fmt.rupiah(hps) : '',
            pagu_anggaran: pagu !== '' ? Fmt.rupiah(pagu) : '',
            terbilang: tb, nilai_pagu_terbilang: tb, pagu_terbilang: tb,
            nomor_surat: esc(nomor),
            tanggal_surat: tanggal,
            perihal: esc(perihal),
            lampiran: esc(L.lampiran || '-'),
            nama_personil: esc(p.nama || ''),
            jabatan_personil: esc(p.jabatan || p.pangkat || ''),
            header_surat: `<table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:inherit; font-family:inherit;">${hRow('Nomor', esc(nomor))}${hRow('Lampiran', esc(L.lampiran || '-'))}${hRow('Perihal', esc(perihal))}</table>`,
            tabel_personil: tbl(['No', 'Nama', 'Jabatan'], pRows, 'Tabel Personil — terisi otomatis'),
            tabel_peralatan: tbl(['No', 'Jenis', 'Kapasitas', 'Jumlah'], eqRows, 'Tabel Peralatan — terisi otomatis'),
            struktur_organisasi: '<div style="text-align:center; border:1px solid #000; padding:8px; margin:10px 0;">Bagan Struktur Organisasi</div>',
            ttd_gabungan: '<div style="text-align:center;color:#94a3b8;border:2px dashed #cbd5e1;padding:20px;border-radius:8px;margin-top:20px;">[Tanda Tangan Pihak 1 & Pihak 2 Akan Muncul Disini]</div>',
            ttd_direktur: '<div style="text-align:center;color:#94a3b8;border:2px dashed #cbd5e1;padding:20px;border-radius:8px;margin-top:20px;width:250px;margin-left:auto;">[Tanda Tangan Direktur Akan Muncul Disini]</div>',
            ttd_personil: '<div style="text-align:center;color:#94a3b8;border:2px dashed #cbd5e1;padding:20px;border-radius:8px;margin-top:20px;width:250px;">[Tanda Tangan Personil Akan Muncul Disini]</div>',
        };
    },
    async _crawlSampleTender() {
        // ponytail: db tenders kosong → tarik 1 paket live dari SPSE (scrape fallback)
        try {
            const lpse = (await API.getLPSEList()).data || [];
            if (!lpse.length) return null;
            const res = await API.searchTenders(String(new Date().getFullYear()), String(lpse[0].kd_lpse));
            return ((res && res.data) || [])[0] || null;
        } catch (e) { return null; }
    },
    _fontStack(name) {
        const n = String(name || 'Times New Roman').replace(/[^A-Za-z0-9 '\-.,]/g, '');
        return `'${n}', 'Times New Roman', Times, serif`;
    },
    _kopLine(color) {
        return /^#[0-9a-fA-F]{3,8}$/.test(color || '') ? color : '#000000';
    },

    // ─── EDITOR ───────────────────────────────────────
    async openEditor(id) {
        let t = {};
        if (id) {
            try { const res = await API.request(`/templates/${id}`); t = res.data; } catch (e) { Toast.error(e.message); return; }
        }
        // inject Aptos font (onlinewebfonts) once
        if (!document.getElementById('aptos-font-link')) {
            const l = document.createElement('link');
            l.id = 'aptos-font-link';
            l.rel = 'stylesheet';
            l.href = 'https://db.onlinewebfonts.com/c/7dd5f4bf5d38875ca1822a830b6e6fe4?family=Aptos';
            document.head.appendChild(l);
        }
        const title = id ? 'Edit Template' : 'Buat Template Baru';
        const cats = {};
        this.VARS.forEach(v => { (cats[v.cat] = cats[v.cat] || []).push(v); });
        const varGroups = Object.entries(cats).map(([cat, vars]) => `
            <div style="margin-bottom:6px;">
                <div style="font-size:0.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">${cat}</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px;">
                    ${vars.map(v => `<span class="badge badge-info" style="cursor:pointer; font-size:0.72rem; padding:3px 7px;" onclick="TemplatesPage._insertVarAtCursor('${v.key}')" title="${v.label}">${v.key}</span>`).join('')}
                </div>
            </div>`).join('');
        const body = `
        <div style="max-height:82vh; overflow-y:auto; padding-right:6px;">
            <div class="form-row">
                <div class="form-group"><label class="form-label">Nama Template <span style="color:var(--danger)">*</span></label>
                    <input class="form-input" id="tpl-nama" value="${Fmt.escape(t.nama_template || '')}" placeholder="Surat Penawaran, Pakta Integritas, dll.">
                </div>
                <div class="form-group"><label class="form-label">Kategori</label>
                    <select class="form-select" id="tpl-kategori">
                        ${['', 'Penawaran', 'Pernyataan', 'Dukungan', 'Administrasi', 'Lainnya'].map(v =>
                            `<option ${t.kategori === v ? 'selected' : ''}>${v || '-- Pilih --'}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- CKEditor WYSIWYG (custom build — style mentah dipertahankan, lihat frontend/editor-src) -->
            <div class="tpl-ck-box" style="border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                <div id="tpl-editor"></div>
            </div>

            <!-- Variables -->
            <div style="border:1px solid var(--border-color); border-radius:var(--radius-md); padding:12px; margin-bottom:16px; background:var(--bg-secondary); max-height:220px; overflow-y:auto;">
                <div style="font-weight:700; font-size:0.8rem; margin-bottom:8px; color:var(--text-secondary);">Klik variabel untuk sisipkan ke editor (kursor di posisi yang diinginkan):</div>
                ${varGroups}
            </div>

            <!-- LAYOUT -->
            <div style="border:1px solid var(--border-color); border-radius:var(--radius-md); padding:16px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                    <i data-lucide="ruler" style="width:16px; height:16px; color:var(--accent);"></i>
                    <span style="font-weight:700; font-size:0.9rem;">Layout Halaman & Margin Paper</span>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Ukuran Kertas</label>
                        <select class="form-select" id="tpl-paper">
                            <option ${(t.paper_size || 'A4') === 'A4' ? 'selected' : ''}>A4</option>
                            <option ${t.paper_size === 'F4' ? 'selected' : ''}>F4</option>
                        </select>
                    </div>
                    <div class="form-group"><label class="form-label">Orientasi</label>
                        <select class="form-select" id="tpl-orient">
                            <option ${(t.orientation || 'portrait') === 'portrait' ? 'selected' : ''}>portrait</option>
                            <option ${t.orientation === 'landscape' ? 'selected' : ''}>landscape</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Margin Kiri (mm)</label>
                        <input type="number" class="form-input" id="tpl-ml" value="${t.margin_left ?? 30}">
                    </div>
                    <div class="form-group"><label class="form-label">Margin Kanan (mm)</label>
                        <input type="number" class="form-input" id="tpl-mr" value="${t.margin_right ?? 25}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Margin Atas (mm)</label>
                        <input type="number" class="form-input" id="tpl-mt" value="${t.margin_top ?? 25}">
                    </div>
                    <div class="form-group"><label class="form-label">Margin Bawah (mm)</label>
                        <input type="number" class="form-input" id="tpl-mb" value="${t.margin_bottom ?? 25}">
                    </div>
                </div>
                <label style="display:flex; align-items:center; gap:6px; font-size:0.82rem; cursor:pointer; margin-top:8px;"><input type="checkbox" id="tpl-fit-layout" ${t.fit_layout ? 'checked' : ''}> Mampatkan (rapat saat preview)</label>
            </div>

            <div style="margin-top:12px;">
                <div style="font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Live Preview (data asli dari database / SPSE):</div>
                <div id="tpl-live-preview" class="ck-content tpl-doc" style="background:white; color:#000; padding:16px; border:1px solid var(--border-color); border-radius:6px; min-height:120px; max-height:220px; overflow-y:auto;"></div>
            </div>
        </div>`;

        const footer = `
            <button class="btn btn-secondary" onclick="TemplatesPage.preview(null, true)"><i data-lucide="eye"></i> Preview Layar Penuh</button>
            <button class="btn btn-secondary" onclick="Modal.close()">Batal</button>
            <button class="btn btn-primary" onclick="TemplatesPage.save('${id || ''}')">Simpan Template</button>`;

        Modal.open(title, body, footer);
        const modalEl = document.getElementById('modal');
        if (modalEl) modalEl.style.maxWidth = '1020px';
        lucide.createIcons();
        this._bindSheetVars();
        this._sampleData().then(s => {
            const box = document.querySelector('.tpl-ck-box');
            if (box) box.style.setProperty('--ck-content-font-family', this._fontStack(s.font_surat));
        });
        if (!this._ckCloseBound) {
            this._ckCloseBound = true;
            document.addEventListener('modal:close', () => this._destroyEditor());
        }
        this._ckHtml = t.html_content || '';
        this._initEditor(this._ckHtml, !id);
    },

    _paperW(paper, orient) {
        if (orient === 'landscape') return paper === 'F4' ? '330mm' : '297mm';
        return paper === 'F4' ? '215mm' : '210mm';
    },
    _bindSheetVars() {
        // layout form → CSS var lembar kertas editor (real-time, sama dgn preview)
        const box = document.querySelector('.tpl-ck-box');
        if (!box) return;
        const set = () => {
            const paper = document.getElementById('tpl-paper');
            const orient = document.getElementById('tpl-orient');
            box.style.setProperty('--pw', this._paperW(paper && paper.value, orient && orient.value));
            ['mt', 'mr', 'mb', 'ml'].forEach(k => {
                const el = document.getElementById('tpl-' + k);
                box.style.setProperty('--' + k, (parseInt(el && el.value, 10) || (k === 'ml' ? 30 : 25)) + 'mm');
            });
            const fit = document.getElementById('tpl-fit-layout');
            box.style.setProperty('--ck-content-font-size', fit && fit.checked ? '11pt' : '12pt');
            box.style.setProperty('--ck-content-line-height', fit && fit.checked ? '1.3' : '1.5');
        };
        ['tpl-paper', 'tpl-orient', 'tpl-mt', 'tpl-mr', 'tpl-mb', 'tpl-ml', 'tpl-fit-layout'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', set);
        });
        set();
    },

    updateLiveEditorPreview() {
        const prev = document.getElementById('tpl-live-preview');
        if (!prev) return;
        const html = this._editorToHtml();
        if (!html) { prev.innerHTML = '<em style="color:#999;">Belum ada isi surat...</em>'; return; }
        this._sampleData().then(s => {
            const p = document.getElementById('tpl-live-preview');
            if (!p) return;
            p.style.setProperty('--ck-content-font-family', this._fontStack(s.font_surat));
            p.innerHTML = html.replace(/\{\{([^}]+)\}\}/g, (m, k) =>
                s[k] != null && s[k] !== '' ? s[k]
                    : `<span style="background:#fef3c7; padding:1px 4px;">${Fmt.escape(m)}</span>`);
        });
    },

    _collectFormData() {
        return {
            nama_template: document.getElementById('tpl-nama')?.value?.trim(),
            kategori: document.getElementById('tpl-kategori')?.value || null,
            html_content: this._ensureTableStyles(this._editorToHtml()),
            fit_layout: document.getElementById('tpl-fit-layout')?.checked || false,
            paper_size: document.getElementById('tpl-paper')?.value || 'A4',
            orientation: document.getElementById('tpl-orient')?.value === 'landscape' ? 'landscape' : 'portrait',
            margin_top: parseInt(document.getElementById('tpl-mt')?.value) || 25,
            margin_bottom: parseInt(document.getElementById('tpl-mb')?.value) || 25,
            margin_left: parseInt(document.getElementById('tpl-ml')?.value) || 30,
            margin_right: parseInt(document.getElementById('tpl-mr')?.value) || 25,
        };
    },

    async save(id) {
        const btn = document.querySelector('#modal-footer .btn-primary');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...'; }
        try {
            const data = this._collectFormData();
            if (!data.nama_template) throw new Error('Nama template wajib diisi');
            if (!data.html_content) throw new Error('Isi surat tidak boleh kosong');
            if (id) { await API.updateTemplate(id, data); Toast.success('Template diperbarui'); }
            else { await API.createTemplate(data); Toast.success('Template baru dibuat'); }
            Modal.close();
            const modalEl = document.getElementById('modal');
            if (modalEl) modalEl.style.maxWidth = '';
            this.loadData();
        } catch (e) { Toast.error(e.message); if (btn) { btn.disabled = false; btn.innerHTML = 'Simpan Template'; } }
    },

    // ─── PREVIEW ──────────────────────────────────────
    async preview(id, fromForm) {
        let t;
        if (fromForm) { t = this._collectFormData(); }
        else { try { const res = await API.request(`/templates/${id}`); t = res.data; } catch (e) { Toast.error(e.message); return; } }
        const s = await this._sampleData();
        this._loadCkCss();
        const paperW = this._paperW(t.paper_size, t.orientation);
        const subst = str => (str || '').replace(/\{\{([^}]+)\}\}/g, (m, k) => s[k] || m);
        const fontStack = this._fontStack(s.font_surat);
        const kopLine = this._kopLine(s.kop_garis_warna);
        const kop = s.kop_is_image && s.kop_image_url
            ? `<img src="${Fmt.url(s.kop_image_url)}" style="width:100%; max-height:140px; object-fit:contain; display:block; margin:0 auto 10px auto; border-bottom:3px double ${kopLine}; padding-bottom:8px;">`
            : s.kop_nama
                ? `<div style="text-align:center; border-bottom:3px double ${kopLine}; padding-bottom:12px; margin-bottom:10px;"><div style="font-size:16pt; font-weight:bold; text-transform:uppercase;">${s.kop_nama}</div><div style="font-size:10pt;">${[s.kop_alamat, s.kop_kontak].filter(Boolean).join(' • ')}</div></div>`
                : `<div style="text-align:center; border-bottom:3px double #000; padding-bottom:12px; margin-bottom:10px; color:#94a3b8; border-color:#cbd5e1; font-style:italic;"><div style="font-size:16pt; font-weight:bold; text-transform:uppercase;">[KOP SURAT PERUSAHAAN]</div><div style="font-size:10pt;">Alamat Perusahaan akan tampil otomatis di sini</div></div>`;
        const narasi = subst(t.html_content);
        const html = `<div style="background:#e2e8f0; padding:24px; border-radius:var(--radius-md); overflow:auto; max-height:70vh;"><div style="width:${paperW}; max-width:100%; margin:0 auto; background:white; box-shadow:0 4px 24px rgba(0,0,0,0.12); padding:${t.margin_top||25}mm ${t.margin_right||25}mm ${t.margin_bottom||25}mm ${t.margin_left||30}mm; font-family:${fontStack}; color:#000; min-height:400px;">${kop}<div class="ck-content tpl-doc" style="--ck-content-font-family:${fontStack}; --ck-content-font-size:${t.fit_layout ? '11pt' : '12pt'}; --ck-content-line-height:${t.fit_layout ? '1.3' : '1.5'};">${narasi || '<span style="color:#999;">— Narasi belum diisi —</span>'}</div></div></div>`;
        const finalHtml = html.replace(/\{\{[^}]+\}\}/g, '.........');
        if (fromForm) {
            const overlay = document.createElement('div');
            overlay.id = 'tpl-preview-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;';
            overlay.innerHTML = `<div style="background:var(--bg-secondary);border-radius:var(--radius-lg);max-width:920px;width:100%;max-height:95vh;display:flex;flex-direction:column;"><div style="padding:16px 24px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;">Preview Template</h3><button class="btn btn-secondary btn-sm" onclick="document.getElementById('tpl-preview-overlay').remove()">✕ Tutup</button></div><div style="padding:16px;overflow-y:auto;flex:1;">${finalHtml}</div></div>`;
            document.body.appendChild(overlay);
        } else {
            Modal.open('Preview: ' + Fmt.escape(t.nama_template), finalHtml, '<button class="btn btn-secondary" onclick="Modal.close()">Tutup</button>');
            const modalEl = document.getElementById('modal');
            if (modalEl) modalEl.style.maxWidth = '920px';
        }
    },

    remove(id) {
        Modal.confirm('Hapus Template', 'Yakin ingin menghapus template ini?', async () => {
            try { await API.deleteTemplate(id); Toast.success('Template dihapus'); this.loadData(); }
            catch (e) { Toast.error(e.message); }
        });
    }
};
