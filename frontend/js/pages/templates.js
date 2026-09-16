/**
 * TenderBuild — Document Templates Page — WYSIWYG
 * ponytail: execCommand toolbar + contenteditable, native only, no deps
 */
const TemplatesPage = {
    templates: [],

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
            } catch (e) {
                Toast.error('Gagal memuat template standar: ' + e.message);
            }
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
                    <button class="btn btn-secondary btn-icon btn-sm" onclick="TemplatesPage.openEditor('${t.id}')" title="Edit"><i data-lucide="pencil"></i></button>
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

    // ─── WYSIWYG helpers ──────────────────────────────
    _htmlToEditor(html) {
        if (!html) return '<p><br></p>';
        // escape already handled: html is stored as HTML, we convert {{var}} to token span
        return html.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (m, name) => {
            const full = '{{' + name + '}}';
            return `<span class="wysiwyg-var" contenteditable="false" data-var="${full}">${full}</span>`;
        });
    },
    _editorToHtml(editorEl) {
        if (!editorEl) return '';
        let html = editorEl.innerHTML;
        // convert token spans back to {{var}} text
        html = html.replace(/<span[^>]*class="wysiwyg-var"[^>]*data-var="([^"]+)"[^>]*>.*?<\/span>/g, '$1');
        // also handle stray token without data-var fallback
        html = html.replace(/<span[^>]*class="wysiwyg-var"[^>]*>(.*?)<\/span>/g, '$1');
        // normalize empty editor
        if (!html.trim() || html === '<p><br></p>') return '';
        return html.trim();
    },
    _insertVarAtCursor(varKey) {
        const editor = document.getElementById('tpl-editor');
        if (!editor) return;
        editor.focus();
        const sel = window.getSelection();
        const tokenHtml = `<span class="wysiwyg-var" contenteditable="false" data-var="${varKey}">${varKey}</span>&nbsp;`;
        if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const frag = range.createContextualFragment(tokenHtml);
            const lastNode = frag.lastChild;
            range.insertNode(frag);
            // move caret after token
            range.setStartAfter(lastNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            // append at end
            editor.innerHTML += tokenHtml;
            // place caret at end
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
        this.updateLiveEditorPreview();
    },
    _fmt(cmd, val = null) {
        document.execCommand(cmd, false, val);
        const ed = document.getElementById('tpl-editor');
        if (ed) ed.focus();
        this.updateLiveEditorPreview();
    },
    _insertTable(cols) {
        const editor = document.getElementById('tpl-editor');
        if (!editor) return;
        editor.focus();
        let html = '';
        if (cols === 2) {
            html = `<table style="width:100%; border-collapse:collapse; margin:10px 0;"><tr><th style="border:1px solid #000; padding:6px; background:#f2f2f2;">Kolom 1</th><th style="border:1px solid #000; padding:6px; background:#f2f2f2;">Kolom 2</th></tr><tr><td style="border:1px solid #000; padding:6px;">&nbsp;</td><td style="border:1px solid #000; padding:6px;">&nbsp;</td></tr><tr><td style="border:1px solid #000; padding:6px;">&nbsp;</td><td style="border:1px solid #000; padding:6px;">&nbsp;</td></tr></table><p><br></p>`;
        } else {
            html = `<table style="width:100%; border-collapse:collapse; margin:10px 0;"><tr><th style="border:1px solid #000; padding:6px; background:#f2f2f2;">No</th><th style="border:1px solid #000; padding:6px; background:#f2f2f2;">Uraian</th><th style="border:1px solid #000; padding:6px; background:#f2f2f2;">Keterangan</th></tr><tr><td style="border:1px solid #000; padding:6px; text-align:center;">1</td><td style="border:1px solid #000; padding:6px;">&nbsp;</td><td style="border:1px solid #000; padding:6px;">&nbsp;</td></tr><tr><td style="border:1px solid #000; padding:6px; text-align:center;">2</td><td style="border:1px solid #000; padding:6px;">&nbsp;</td><td style="border:1px solid #000; padding:6px;">&nbsp;</td></tr></table><p><br></p>`;
        }
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const frag = range.createContextualFragment(html);
            range.insertNode(frag);
        } else {
            editor.innerHTML += html;
        }
        this.updateLiveEditorPreview();
        editor.focus();
    },

    // ─── EDITOR ───────────────────────────────────────
    async openEditor(id) {
        let t = {};
        if (id) {
            try {
                const res = await API.request(`/templates/${id}`);
                t = res.data;
            } catch (e) { Toast.error(e.message); return; }
        }
        const title = id ? 'Edit Template' : 'Buat Template Baru';
        // group vars by cat
        const cats = {};
        this.VARS.forEach(v => { (cats[v.cat] = cats[v.cat] || []).push(v); });
        const varGroups = Object.entries(cats).map(([cat, vars]) => `
            <div style="margin-bottom:6px;">
                <div style="font-size:0.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">${cat}</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px;">
                    ${vars.map(v => `<span class="badge badge-info" style="cursor:pointer; font-size:0.72rem; padding:3px 7px;" onclick="TemplatesPage._insertVarAtCursor('${v.key}')" title="${v.label}">${v.key}</span>`).join('')}
                </div>
            </div>`).join('');

        const editorHtml = this._htmlToEditor(t.html_content || '');

        const body = `
        <div style="max-height:78vh; overflow-y:auto; padding-right:6px;">
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

            <!-- WYSIWYG -->
            <div style="border:1px solid var(--border-color); border-radius:var(--radius-md); overflow:hidden; margin-bottom:12px;">
                <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-secondary); border-bottom:1px solid var(--border-color);">
                    <span style="font-weight:700; font-size:0.85rem; display:flex; align-items:center; gap:8px;"><i data-lucide="align-left" style="width:16px; height:16px; color:var(--accent);"></i> Isi Surat (WYSIWYG)</span>
                    <label style="display:flex; align-items:center; gap:6px; font-size:0.78rem; cursor:pointer;"><input type="checkbox" id="tpl-fit-layout" ${t.fit_layout ? 'checked' : ''}> Mampatkan (Fit)</label>
                </div>
                <!-- toolbar -->
                <div class="wysiwyg-toolbar" style="display:flex; flex-wrap:wrap; gap:4px; padding:8px; background:var(--bg-input); border-bottom:1px solid var(--border-color);">
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="TemplatesPage._fmt('bold')" title="Bold"><b>B</b></button>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="TemplatesPage._fmt('italic')" title="Italic"><i>I</i></button>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="TemplatesPage._fmt('underline')" title="Underline"><u>U</u></button>
                    <span style="width:1px; background:var(--border-color); margin:0 4px;"></span>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="TemplatesPage._fmt('formatBlock','h3')" title="Judul">H3</button>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="TemplatesPage._fmt('formatBlock','p')" title="Paragraf">P</button>
                    <span style="width:1px; background:var(--border-color); margin:0 4px;"></span>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 6px;" onclick="TemplatesPage._fmt('insertUnorderedList')" title="Bullet"><i data-lucide="list" style="width:14px;height:14px;"></i></button>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 6px;" onclick="TemplatesPage._fmt('insertOrderedList')" title="Numbered"><i data-lucide="list-ordered" style="width:14px;height:14px;"></i></button>
                    <span style="width:1px; background:var(--border-color); margin:0 4px;"></span>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 6px;" onclick="TemplatesPage._fmt('justifyLeft')" title="Rata kiri"><i data-lucide="align-left" style="width:14px;height:14px;"></i></button>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 6px;" onclick="TemplatesPage._fmt('justifyCenter')" title="Tengah"><i data-lucide="align-center" style="width:14px;height:14px;"></i></button>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 6px;" onclick="TemplatesPage._fmt('justifyRight')" title="Kanan"><i data-lucide="align-right" style="width:14px;height:14px;"></i></button>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 6px;" onclick="TemplatesPage._fmt('justifyFull')" title="Justify"><i data-lucide="align-justify" style="width:14px;height:14px;"></i></button>
                    <span style="width:1px; background:var(--border-color); margin:0 4px;"></span>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="TemplatesPage._insertTable(2)" title="Tabel 2 kolom">⊞ 2K</button>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="TemplatesPage._insertTable(3)" title="Tabel 3 kolom">⊞ 3K</button>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="TemplatesPage._fmt('removeFormat')" title="Hapus format">✕</button>
                </div>
                <div id="tpl-editor" contenteditable="true" class="wysiwyg-editor" style="min-height:260px; max-height:420px; overflow-y:auto; padding:16px; background:white; color:#000; font-family:'Times New Roman', serif; font-size:12pt; line-height:1.5; outline:none; text-align:justify;" oninput="TemplatesPage.updateLiveEditorPreview()" onkeyup="TemplatesPage.updateLiveEditorPreview()">${editorHtml}</div>
                <div style="padding:8px 12px; background:var(--bg-input); border-top:1px solid var(--border-color); font-size:0.72rem; color:var(--text-muted);">Tip: blok variabel berwarna biru — klik variabel di bawah untuk menyisipkan. Tabel bisa diedit langsung (klik sel untuk ketik).</div>
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
                    <div class="form-group"><label class="form-label">Margin Atas (mm)</label>
                        <input type="number" class="form-input" id="tpl-mt" value="${t.margin_top ?? 25}">
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
                <div class="form-group"><label class="form-label">Margin Bawah (mm)</label>
                    <input type="number" class="form-input" id="tpl-mb" value="${t.margin_bottom ?? 25}" style="max-width:200px;">
                </div>
            </div>

            <div style="margin-top:12px;">
                <div style="font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Live Preview (dengan data dummy):</div>
                <div id="tpl-live-preview" style="background:white; color:#000; padding:16px; border:1px solid var(--border-color); border-radius:6px; min-height:120px; max-height:220px; overflow-y:auto; font-family:'Times New Roman', serif; font-size:11pt; line-height:1.4; text-align:justify;"></div>
            </div>
        </div>`;

        const footer = `
            <button class="btn btn-secondary" onclick="TemplatesPage.preview(null, true)"><i data-lucide="eye"></i> Preview Layar Penuh</button>
            <button class="btn btn-secondary" onclick="Modal.close()">Batal</button>
            <button class="btn btn-primary" onclick="TemplatesPage.save('${id || ''}')">Simpan Template</button>`;

        Modal.open(title, body, footer);
        const modalEl = document.getElementById('modal');
        if (modalEl) modalEl.style.maxWidth = '920px';
        lucide.createIcons();
        setTimeout(() => this.updateLiveEditorPreview(), 100);
        // focus editor
        setTimeout(() => {
            const ed = document.getElementById('tpl-editor');
            if (ed && !id) ed.focus();
        }, 200);
    },

    updateLiveEditorPreview() {
        const ed = document.getElementById('tpl-editor');
        const prev = document.getElementById('tpl-live-preview');
        if (!prev) return;
        let html = ed ? ed.innerHTML : '';
        if (!html || html === '<br>' || html.trim() === '') {
            prev.innerHTML = '<em style="color:#999;">Belum ada isi surat...</em>';
            return;
        }
        // replace var tokens with dummy values for preview
        const dummy = {
            '{{nama_perusahaan}}': 'CV. GRAHA MANDIRI',
            '{{singkatan}}': 'CV.GM',
            '{{direktur}}': 'Ahmad Sutojo, S.T.',
            '{{kota_perusahaan}}': 'Sleman',
            '{{alamat}}': 'Jl. Magelang No. 123, Sleman, DIY',
            '{{npwp}}': '12.345.678.9-012.000',
            '{{nama_paket}}': 'Pekerjaan Pengecatan Gedung RSUD Sleman',
            '{{kode_tender}}': '12345678',
            '{{nilai_pagu}}': 'Rp 1.500.000.000',
            '{{nilai_hps}}': 'Rp 1.450.000.000',
            '{{pagu_anggaran}}': 'Rp 1.500.000.000',
            '{{terbilang}}': 'satu miliar lima ratus juta rupiah',
            '{{nilai_pagu_terbilang}}': 'satu miliar lima ratus juta rupiah',
            '{{pagu_terbilang}}': 'satu miliar lima ratus juta rupiah',
            '{{instansi}}': 'RSUD Sleman',
            '{{pokja}}': 'Pokja Pemilihan RSUD Sleman',
            '{{alamat_pokja}}': 'Jl. Magelang KM 14, Sleman',
            '{{lokasi}}': 'RSUD Sleman, DIY',
            '{{jangka_waktu}}': '90',
            '{{header_surat}}': '<table style="width:100%; margin-bottom:12px;"><tr><td style="width:80px;">Nomor</td><td style="width:10px;">:</td><td>001/SP/CV.GM/V/2026</td></tr><tr><td>Lampiran</td><td>:</td><td>-</td></tr><tr><td>Perihal</td><td>:</td><td>Penawaran</td></tr></table>',
            '{{nomor_surat}}': '001/SP/CV.GM/V/2026',
            '{{tanggal_surat}}': 'Sleman, 15 Mei 2026',
            '{{perihal}}': 'Penawaran Pekerjaan Pengecatan Gedung',
            '{{lampiran}}': '-',
            '{{nama_personil}}': 'Budi Santoso',
            '{{jabatan_personil}}': 'Pelaksana',
            '{{tabel_peralatan}}': '<div style="border:1px dashed #94a3b8; padding:8px; text-align:center; color:#64748b; font-size:0.8rem;">[Tabel Peralatan — terisi otomatis dari peralatan terpilih]</div>',
            '{{tabel_personil}}': '<div style="border:1px dashed #94a3b8; padding:8px; text-align:center; color:#64748b; font-size:0.8rem;">[Tabel Personil — terisi otomatis]</div>',
            '{{struktur_organisasi}}': '<div style="border:1px dashed #94a3b8; padding:8px; text-align:center; color:#64748b; font-size:0.8rem;">[Bagan Struktur Organisasi]</div>',
            '{{ttd_direktur}}': '<div style="border:1px dashed #94a3b8; padding:10px; text-align:center; color:#94a3b8; font-size:0.8rem;">[TTD Direktur]</div>',
            '{{ttd_personil}}': '<div style="border:1px dashed #94a3b8; padding:10px; text-align:center; color:#94a3b8; font-size:0.8rem;">[TTD Personil]</div>',
            '{{ttd_gabungan}}': '<div style="border:1px dashed #94a3b8; padding:10px; text-align:center; color:#94a3b8; font-size:0.8rem;">[TTD Gabungan]</div>',
        };
        // replace token spans first
        html = html.replace(/<span[^>]*class="wysiwyg-var"[^>]*data-var="([^"]+)"[^>]*>.*?<\/span>/g, (m, v) => dummy[v] || `<span style="background:#fef3c7; padding:1px 4px; border-radius:3px;">${Fmt.escape(v)}</span>`);
        // also plain {{var}} fallback
        html = html.replace(/\{\{[^}]+\}\}/g, m => dummy[m] || `<span style="background:#fef3c7; padding:1px 4px;">${Fmt.escape(m)}</span>`);
        prev.innerHTML = html;
    },

    _collectFormData() {
        const editor = document.getElementById('tpl-editor');
        return {
            nama_template: document.getElementById('tpl-nama')?.value?.trim(),
            kategori: document.getElementById('tpl-kategori')?.value || null,
            html_content: this._editorToHtml(editor),
            fit_layout: document.getElementById('tpl-fit-layout')?.checked || false,
            paper_size: document.getElementById('tpl-paper')?.value || 'A4',
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
        } catch (e) {
            Toast.error(e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = 'Simpan Template'; }
        }
    },

    // ─── PREVIEW ──────────────────────────────────────
    async preview(id, fromForm) {
        let t;
        if (fromForm) {
            t = this._collectFormData();
        } else {
            try {
                const res = await API.request(`/templates/${id}`);
                t = res.data;
            } catch (e) { Toast.error(e.message); return; }
        }
        const paperW = t.paper_size === 'F4' ? '215mm' : '210mm';
        let narasi = (t.html_content || '');
        const headerTable = `
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:inherit; font-family:inherit;">
            <tr><td style="width:80px; padding:2px 0; vertical-align:top;">Nomor</td><td style="width:15px; padding:2px 0; vertical-align:top;">:</td><td style="padding:2px 0; vertical-align:top;">001/SP/CV-GM/V/2026</td></tr>
            <tr><td style="padding:2px 0; vertical-align:top;">Lampiran</td><td style="padding:2px 0; vertical-align:top;">:</td><td style="padding:2px 0; vertical-align:top;">-</td></tr>
            <tr><td style="padding:2px 0; vertical-align:top;">Perihal</td><td style="padding:2px 0; vertical-align:top;">:</td><td style="padding:2px 0; vertical-align:top;">Penawaran Pekerjaan Pengecatan Gedung RSUD Sleman</td></tr>
        </table>`;
        narasi = narasi
            .replace(/\{\{header_surat\}\}/g, headerTable)
            .replace(/\{\{nomor_surat\}\}/g, '001/SP/CV-GM/V/2026')
            .replace(/\{\{perihal\}\}/g, 'Penawaran Pekerjaan Pengecatan Gedung RSUD Sleman')
            .replace(/\{\{lampiran\}\}/g, '-')
            .replace(/\{\{tanggal_surat\}\}/g, 'Sleman, 15 Mei 2026')
            .replace(/\{\{kota_perusahaan\}\}/g, 'Sleman')
            .replace(/\{\{nama_perusahaan\}\}/g, 'CV. UTAMA GRAHA MANDIRI')
            .replace(/\{\{singkatan\}\}/g, 'CV.UGM')
            .replace(/\{\{direktur\}\}/g, 'Ginanjar Dwi Prasetyo, S.T.')
            .replace(/\{\{alamat\}\}/g, 'Jl. Magelang No.259, Sleman, DIY')
            .replace(/\{\{npwp\}\}/g, '12.345.678.9-012.000')
            .replace(/\{\{nama_paket\}\}/g, 'Pekerjaan Pengecatan Gedung RSUD Sleman')
            .replace(/\{\{kode_tender\}\}/g, '12345678')
            .replace(/\{\{nilai_pagu\}\}/g, 'Rp 1.500.000.000,00')
            .replace(/\{\{nilai_hps\}\}/g, 'Rp 1.450.000.000,00')
            .replace(/\{\{pagu_anggaran\}\}/g, 'Rp 1.500.000.000,00')
            .replace(/\{\{terbilang\}\}/g, 'Satu Miliar Lima Ratus Juta Rupiah')
            .replace(/\{\{nilai_pagu_terbilang\}\}/g, 'satu miliar lima ratus juta rupiah')
            .replace(/\{\{pagu_terbilang\}\}/g, 'satu miliar lima ratus juta rupiah')
            .replace(/\{\{instansi\}\}/g, 'RSUD Sleman')
            .replace(/\{\{pokja\}\}/g, 'Pokja Pemilihan RSUD Sleman')
            .replace(/\{\{alamat_pokja\}\}/g, 'Jl. Magelang KM 14, Sleman')
            .replace(/\{\{lokasi\}\}/g, 'RSUD Sleman, DIY')
            .replace(/\{\{jangka_waktu\}\}/g, '90')
            .replace(/\{\{nama_personil\}\}/g, 'Budi Santoso')
            .replace(/\{\{jabatan_personil\}\}/g, 'Pelaksana')
            .replace(/\{\{tabel_peralatan\}\}/g, '<table style="width:100%; border-collapse:collapse; font-size:9pt;"><tr style="background:#f2f2f2;"><th style="border:1px solid #000; padding:4px;">No</th><th style="border:1px solid #000; padding:4px;">Jenis</th><th style="border:1px solid #000; padding:4px;">Kapasitas</th><th style="border:1px solid #000; padding:4px;">Jumlah</th></tr><tr><td style="border:1px solid #000; padding:4px; text-align:center;">1</td><td style="border:1px solid #000; padding:4px;">Scaffolding</td><td style="border:1px solid #000; padding:4px;">-</td><td style="border:1px solid #000; padding:4px; text-align:center;">250 Unit</td></tr></table>')
            .replace(/\{\{tabel_personil\}\}/g, '<table style="width:100%; border-collapse:collapse; font-size:9pt;"><tr style="background:#f2f2f2;"><th style="border:1px solid #000; padding:4px;">No</th><th style="border:1px solid #000; padding:4px;">Nama</th><th style="border:1px solid #000; padding:4px;">Jabatan</th></tr><tr><td style="border:1px solid #000; padding:4px; text-align:center;">1</td><td style="border:1px solid #000; padding:4px;">Budi Santoso</td><td style="border:1px solid #000; padding:4px;">Pelaksana</td></tr></table>')
            .replace(/\{\{struktur_organisasi\}\}/g, '<div style="text-align:center; border:1px solid #000; padding:8px; margin:10px 0;">Bagan Struktur Organisasi</div>');

        const html = `
        <div style="background:#e2e8f0; padding:24px; border-radius:var(--radius-md); overflow:auto; max-height:70vh;">
            <div style="width:${paperW}; max-width:100%; margin:0 auto; background:white; box-shadow:0 4px 24px rgba(0,0,0,0.12); padding:${t.margin_top||25}mm ${t.margin_right||25}mm ${t.margin_bottom||25}mm ${t.margin_left||30}mm; font-family:'Times New Roman', serif; font-size:${t.fit_layout ? '11pt' : '12pt'}; color:#000; line-height:${t.fit_layout ? '1.3' : '1.5'}; min-height:400px;">
                <div style="text-align:center; border-bottom:3px double #000; padding-bottom:12px; margin-bottom:20px; color:#94a3b8; border-color:#cbd5e1; font-style:italic;">
                    <div style="font-size:16pt; font-weight:bold; text-transform:uppercase;">[KOP SURAT PERUSAHAAN]</div>
                    <div style="font-size:10pt;">Alamat Perusahaan akan tampil otomatis di sini</div>
                </div>
                <div style="text-align:justify;">${narasi || '<span style="color:#999;">— Narasi belum diisi —</span>'}</div>
            </div>
        </div>`;
        let finalHtml = html
            .replace(/\{\{ttd_gabungan\}\}/g, '<div style="text-align:center;color:#94a3b8;border:2px dashed #cbd5e1;padding:20px;border-radius:8px;margin-top:20px;">[Tanda Tangan Pihak 1 & Pihak 2 Akan Muncul Disini]</div>')
            .replace(/\{\{ttd_direktur\}\}/g, '<div style="text-align:center;color:#94a3b8;border:2px dashed #cbd5e1;padding:20px;border-radius:8px;margin-top:20px;width:250px;margin-left:auto;">[Tanda Tangan Direktur Akan Muncul Disini]</div>')
            .replace(/\{\{ttd_personil\}\}/g, '<div style="text-align:center;color:#94a3b8;border:2px dashed #cbd5e1;padding:20px;border-radius:8px;margin-top:20px;width:250px;">[Tanda Tangan Personil Akan Muncul Disini]</div>')
            .replace(/\{\{[^}]+\}\}/g, '.........');

        if (fromForm) {
            const overlay = document.createElement('div');
            overlay.id = 'tpl-preview-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;';
            overlay.innerHTML = `<div style="background:var(--bg-secondary);border-radius:var(--radius-lg);max-width:920px;width:100%;max-height:95vh;display:flex;flex-direction:column;">
                <div style="padding:16px 24px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;">Preview Template</h3>
                    <button class="btn btn-secondary btn-sm" onclick="document.getElementById('tpl-preview-overlay').remove()">✕ Tutup</button>
                </div>
                <div style="padding:16px;overflow-y:auto;flex:1;">${finalHtml}</div>
            </div>`;
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
