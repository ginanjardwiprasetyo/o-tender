/**
 * TenderBuild — Documents Page (Surat & Template) — WYSIWYG + auto vars
 * ponytail: native tables, no deps, terbilang shared inline
 */
const DocumentsPage = {
    letters: [],
    companies: [],
    templates: [],
    personnel: [],
    equipments: [],
    tenders: [],
    _genMap: {},      // tid -> data nomor surat tergenerate (per surat)
    _suratData: {},   // tid -> { kode, tgl, perihal, lampiran, touched } (per surat)
    _dokpilPreset: null,

    // ponytail: terbilang inline (mirrors backend/utils/terbilang.js)
    _terbilang(n) {
        n = parseInt(String(n).replace(/\D/g, ''), 10);
        if (!n || isNaN(n)) return '';
        const angka = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
        function baca(m) {
            if (m < 10) return angka[m];
            if (m < 20) { if (m === 10) return 'sepuluh'; if (m === 11) return 'sebelas'; return angka[m - 10] + ' belas'; }
            if (m < 100) return angka[Math.floor(m / 10)] + ' puluh' + (m % 10 ? ' ' + angka[m % 10] : '');
            if (m < 1000) return (Math.floor(m / 100) === 1 ? 'seratus' : angka[Math.floor(m / 100)] + ' ratus') + (m % 100 ? ' ' + baca(m % 100) : '');
            return '';
        }
        let ret = ''; const satuan = ['', 'ribu', 'juta', 'miliar', 'triliun']; let i = 0;
        while (n > 0) { const part = n % 1000; if (part) { if (i === 1 && part === 1) ret = 'seribu' + (ret ? ' ' + ret : ''); else { const s = baca(part); ret = s + (satuan[i] ? ' ' + satuan[i] : '') + (ret ? ' ' + ret : ''); } } n = Math.floor(n / 1000); i++; }
        return ret.trim() + ' rupiah';
    },

    async render() {
        return `
        <div class="page-header">
            <div>
                <h2>Surat & Dokumen</h2>
                <p>Generator nomor surat otomatis dan manajemen dokumen penawaran tender</p>
            </div>
            <button class="btn btn-primary" onclick="DocumentsPage.openForm()"><i data-lucide="plus"></i> Buat Surat Baru</button>
        </div>
        <div class="toolbar" style="flex-wrap:wrap;">
            <div class="search-box" style="min-width:200px;">
                <i data-lucide="search"></i>
                <input type="text" id="doc-search" placeholder="Nomor atau perihal..." oninput="DocumentsPage.debounceSearch()">
            </div>
            <select class="form-select" id="doc-filter-comp" onchange="DocumentsPage.loadData()" style="width:200px;padding:9px 36px 9px 14px;">
                <option value="">Semua Perusahaan</option>
            </select>
            <select class="form-select" id="doc-filter-tahun" onchange="DocumentsPage.loadData()" style="width:120px;padding:9px 36px 9px 14px;">
                <option value="2026" selected>2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
            </select>
        </div>
        <div id="doc-list"></div>`;
    },

    async afterRender() {
        try {
            const [compRes, tplRes, persRes, eqRes, tendRes] = await Promise.all([
                API.getCompanies(), API.getTemplates(), API.getPersonnel(), API.getEquipments(),
                API.getFollowedTenders().catch(() => ({ data: [] }))
            ]);
            this.companies = compRes.data || [];
            this.templates = tplRes.data || [];
            this.personnel = persRes.data || [];
            this.equipments = eqRes.data || [];
            this.tenders = tendRes.data || [];
            const filterSelect = document.getElementById('doc-filter-comp');
            const opts = this.companies.map(c => `<option value="${c.id}">${Fmt.escape(c.nama_perusahaan)}</option>`).join('');
            if (filterSelect) filterSelect.innerHTML += opts;
        } catch (e) { console.error('Failed to load data for docs', e); }
        this.loadData();
        const dokpilDataStr = sessionStorage.getItem('dokpil_extracted_data');
        if (dokpilDataStr) {
            sessionStorage.removeItem('dokpil_extracted_data');
            try { const dokpilData = JSON.parse(dokpilDataStr); setTimeout(() => this.openFormWithDokpil(dokpilData), 300); } catch (e) { }
        }
    },

    debounceTimer: null,
    debounceSearch() { clearTimeout(this.debounceTimer); this.debounceTimer = setTimeout(() => this.loadData(), 400); },

    async loadData() {
        const el = document.getElementById('doc-list');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        try {
            const search = document.getElementById('doc-search')?.value || '';
            const company_id = document.getElementById('doc-filter-comp')?.value || '';
            const tahun = document.getElementById('doc-filter-tahun')?.value || '';
            const res = await API.getLetters({ search, company_id, tahun });
            this.letters = res.data || [];
            this.renderList();
        } catch (e) {
            el.innerHTML = `<div class="empty-state"><i data-lucide="file-text"></i><p>Gagal memuat surat: ${e.message}</p></div>`;
            lucide.createIcons();
        }
    },

    renderList() {
        const el = document.getElementById('doc-list');
        if (!el) return;
        if (!this.letters.length) {
            el.innerHTML = `<div class="empty-state"><i data-lucide="file-text"></i><p>Belum ada data surat.</p><p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">Klik <strong>Buat Surat Baru</strong> untuk membuat nomor surat otomatis.</p></div>`;
            lucide.createIcons(); return;
        }
        const rows = this.letters.map((l, i) => `
        <tr>
            <td style="color:var(--text-muted);text-align:center;">${i + 1}</td>
            <td>
                <div style="font-weight:700;color:var(--accent);font-size:0.95rem;line-height:1.4;">${Fmt.escape(l.nomor_surat)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${Fmt.escape(l.singkatan || l.nama_perusahaan || '')}</div>
            </td>
            <td>${l.tanggal ? Fmt.date(l.tanggal) : '-'}</td>
            <td>${Fmt.escape(l.perihal || '-')}</td>
            <td style="text-align:center; white-space:nowrap;">
                <button class="btn btn-secondary btn-sm" onclick="DocumentsPage.viewOrPrint('${l.id}')" title="Preview / Cetak"><i data-lucide="printer"></i> Cetak</button>
                <button class="btn btn-danger btn-sm btn-icon" onclick="DocumentsPage.remove('${l.id}')" title="Hapus"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>`).join('');
        el.innerHTML = `
        <div class="table-container">
            <table>
                <thead><tr><th width="50" style="text-align:center;">No</th><th width="280">Nomor Surat</th><th width="150">Tanggal</th><th>Perihal</th><th width="120" style="text-align:center;">Aksi</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
        lucide.createIcons();
    },

    async checkNumber(tid) {
        const compId = document.getElementById('f-doc-comp')?.value;
        const block = document.querySelector(`#doc-surat-blocks [data-tpl="${tid}"]`);
        const kode = (block?.querySelector('.ds-kode')?.value || this._suratData[tid]?.kode || '').toUpperCase().trim();
        const tgl = block?.querySelector('.ds-tgl')?.value || this._suratData[tid]?.tgl;
        if (!compId || !kode) { Toast.warning('Pilih Perusahaan dan isi Kode Surat terlebih dahulu'); return; }
        const dateObj = tgl ? new Date(tgl) : new Date();
        const thn = dateObj.getFullYear(); const bln = dateObj.getMonth() + 1;
        try {
            const res = await API.getNextLetterNumber(compId, kode, thn, bln);
            this._genMap[tid] = res.data;
            const pNum = block?.querySelector('.ds-preview-num');
            const pBox = block?.querySelector('.ds-preview');
            if (pNum && pBox) { pNum.textContent = res.data.nomor_surat; pBox.classList.remove('hidden'); }
            Toast.success('Nomor surat berhasil digenerate');
        } catch (e) { Toast.error('Gagal generate nomor: ' + e.message); }
    },

    openFormWithDokpil(dokpilData) {
        this._dokpilPreset = dokpilData;
        this.openForm();
        setTimeout(() => {
            this._applyAutoPerihal();
            // pre-select peralatan/personil if names match extracted tables (best effort)
            if (dokpilData.peralatan && dokpilData.peralatan.length) {
                // peralatan from AI is objects, try to match by jenis
                const eqSel = document.getElementById('f-doc-equipments');
                if (eqSel) {
                    const names = dokpilData.peralatan.map(r => (Array.isArray(r) ? r[1] : r.jenis_alat || r.jenis || '')).filter(Boolean).map(s => s.toLowerCase());
                    Array.from(eqSel.options).forEach(o => {
                        const txt = o.textContent.toLowerCase();
                        if (names.some(n => txt.includes(n.substring(0, 12)) || n.includes(txt.substring(0, 12)))) o.selected = true;
                    });
                    this.renderAttachments();
                }
            }
            if (dokpilData.personel && dokpilData.personel.length) {
                const psel = document.getElementById('f-doc-personil-list');
                if (psel) {
                    const jabs = dokpilData.personel.map(r => (Array.isArray(r) ? r[1] : r.jabatan || '')).filter(Boolean).map(s => s.toLowerCase());
                    Array.from(psel.options).forEach(o => {
                        const txt = o.textContent.toLowerCase();
                        if (jabs.some(j => txt.includes(j.substring(0, 8)) || j.includes(txt.substring(0, 8)))) o.selected = true;
                    });
                }
            }
            Toast.info('Data dari Dokpil berhasil dimuat. Pilih template surat di bawah.');
            // trigger template vars refresh if any selected
            this.onTemplatesChange();
        }, 100);
    },

    _findTender() {
        const id = document.getElementById('f-doc-tender')?.value;
        if (!id) return null;
        return this.tenders.find(x => String(x.id) === String(id)) || null;
    },
    _tenderLabel(t) {
        return (t.nama_tender || t.nama_paket || t.title || 'Tender') + (t.kode_tender ? ' — ' + String(t.kode_tender) : '');
    },
    filterTenderOpts() {
        const dd = document.getElementById('tender-dropdown');
        if (!dd) return;
        const q = (document.getElementById('f-doc-tender-search')?.value || '').toLowerCase().trim();
        const hidden = document.getElementById('f-doc-tender');
        // user mengedit teks setelah memilih → lepas pilihan lama (sinkron)
        if (hidden?.value) {
            const t = this._findTender();
            if (t && this._tenderLabel(t).toLowerCase() !== q) { hidden.value = ''; this.onTenderChange(); }
        }
        if (q.length < 2) { dd.innerHTML = ''; dd.classList.add('hidden'); return; }
        const matches = this.tenders.filter(t => this._tenderLabel(t).toLowerCase().includes(q));
        dd.innerHTML = matches.length
            ? matches.map(t => `<div class="tender-opt" style="padding:8px 12px; cursor:pointer;" onmousedown="event.preventDefault(); DocumentsPage.selectTender('${t.id}')">${Fmt.escape(this._tenderLabel(t))}</div>`).join('')
            : '<div style="padding:8px 12px; color:var(--text-muted);">Tidak ada paket cocok</div>';
        dd.classList.remove('hidden');
    },
    selectTender(id) {
        const t = this.tenders.find(x => String(x.id) === String(id));
        if (!t) return;
        const hidden = document.getElementById('f-doc-tender');
        const search = document.getElementById('f-doc-tender-search');
        if (hidden) hidden.value = t.id;
        if (search) search.value = this._tenderLabel(t);
        this._hideTenderDrop();
        this.onTenderChange();
    },
    _hideTenderDrop() {
        const dd = document.getElementById('tender-dropdown');
        if (dd) { dd.innerHTML = ''; dd.classList.add('hidden'); }
    },

    // auto isi variabel dari paket tender terpilih (fallback: data Dokpil); tidak ada → kosong
    _autoVarValues() {
        const t = this._findTender();
        const d = this._dokpilPreset || {};
        const gv = (tk, dk) => (t && t[tk]) || (d && d[dk]) || '';
        const nama = gv('nama_tender', 'nama_paket') || t?.title || '';
        const pagu = gv('pagu', 'pagu_anggaran') || '';
        const lokasiRaw = gv('lokasi_pekerjaan', 'lokasi') || t?.lokasi || '';
        const lokasi = typeof lokasiRaw === 'object' && lokasiRaw ? Object.values(lokasiRaw).filter(Boolean).join(', ') : lokasiRaw;
        const v = {
            nama_paket: nama,
            kode_tender: gv('kode_tender', 'kode_tender') || t?.kd_pkt || '',
            instansi: gv('satuan_kerja', 'instansi') || t?.klpd || t?.lpse_name || '',
            pokja: gv('pokja', 'pokja') || '',
            alamat_pokja: gv('alamat_pokja', 'alamat_pokja'),
            jangka_waktu: gv('jangka_waktu', 'jangka_waktu'),
            masa_berlaku: gv('masa_berlaku', 'masa_berlaku'),
            masa_berlaku_penawaran: gv('masa_berlaku_penawaran', 'masa_berlaku_penawaran'),
            nomor_dokpil: gv('', 'nomor_dokpil'),
            tanggal_dokpil: gv('', 'tanggal_dokpil'),
            lokasi,
            nilai_pagu: pagu ? Fmt.rupiah(pagu) : '',
            pagu_anggaran: pagu ? Fmt.rupiah(pagu) : '',
            nilai_hps: t?.hps ? Fmt.rupiah(t.hps) : '',
            nilai_penawaran: gv('', 'nilai_penawaran'),
            terbilang: '',
            nilai_pagu_terbilang: '',
            pagu_terbilang: '',
            terbilang_penawaran: gv('', 'terbilang_penawaran'),
        };
        if (pagu) { const tb = this._terbilang(pagu); v.terbilang = tb; v.nilai_pagu_terbilang = tb; v.pagu_terbilang = tb; }
        return v;
    },
    _autoPerihal() {
        const t = this._findTender();
        const nama = (t && (t.nama_tender || t.nama_paket || t.title)) || this._dokpilPreset?.nama_paket || '';
        return nama ? 'Penawaran Pekerjaan ' + nama : '';
    },
    _applyAutoPerihal() {
        const auto = this._autoPerihal();
        if (!auto) return;
        document.querySelectorAll('#doc-surat-blocks [data-tpl]').forEach(b => {
            const s = this._suratData[b.dataset.tpl];
            if (s?.touched) return;
            const inp = b.querySelector('.ds-perihal');
            if (inp) { inp.value = auto; if (s) s.perihal = auto; }
        });
    },

    onTenderChange() {
        const auto = this._autoVarValues();
        document.querySelectorAll('.doc-dynamic-var').forEach(input => {
            const vName = input.getAttribute('data-var');
            if (vName in auto) input.value = auto[vName];
        });
        this._applyAutoPerihal();
    },

    openForm() {
        this._genMap = {}; this._suratData = {};
        const compOpts = this.companies.map(c => `<option value="${c.id}">${Fmt.escape(c.nama_perusahaan)}</option>`).join('');
        const tplOpts = this.templates.map(t => `<option value="${t.id}">${Fmt.escape(t.nama_template)}</option>`).join('');
        const persOpts = this.personnel.map(p => `<option value="${p.id}">${Fmt.escape(p.nama)} — ${Fmt.escape(p.jabatan || '-')}</option>`).join('');
        const eqOpts = this.equipments.map(e => `<option value="${e.id}">${Fmt.escape(e.jenis)} - ${Fmt.escape(e.merk_type || '')}</option>`).join('');
        const body = `
        <div class="form-row">
            <div class="form-group"><label class="form-label">Perusahaan Pengirim <span style="color:var(--danger);">*</span></label>
                <select class="form-select" id="f-doc-comp" onchange="DocumentsPage.onCompanyChange()" required>
                    <option value="">-- Pilih Perusahaan --</option>${compOpts}
                </select>
                <small id="doc-font-hint" style="display:block; margin-top:6px; color:var(--text-muted);"></small>
            </div>
            <div class="form-group"><label class="form-label">Paket Tender / Dokpil (Opsional Auto-fill)</label>
                <div style="position:relative;">
                    <input class="form-input" id="f-doc-tender-search" placeholder="Ketik untuk cari paket dari Tender Saya..." autocomplete="off"
                        oninput="DocumentsPage.filterTenderOpts()" onfocus="DocumentsPage.filterTenderOpts()" onblur="DocumentsPage._hideTenderDrop()">
                    <input type="hidden" id="f-doc-tender" value="">
                    <div id="tender-dropdown" class="hidden" style="position:absolute; top:100%; left:0; right:0; z-index:20; max-height:220px; overflow:auto; background:var(--bg-secondary, #fff); border:1px solid var(--border-color, #ccc); border-radius:8px; margin-top:4px; box-shadow:0 8px 16px rgba(0,0,0,.12);"></div>
                </div>
                <small style="color:var(--text-muted);">Pencarian otomatis setelah ketik minimal 2 karakter</small>
            </div>
        </div>
        <div class="form-group"><label class="form-label">Pilih Template Surat (Bisa >1)</label>
            <select class="form-select" id="f-doc-templates" multiple size="5" onchange="DocumentsPage.onTemplatesChange()" style="height:auto;">${tplOpts}</select>
            <small style="color:var(--text-muted);">Tahan Ctrl/Cmd untuk memilih beberapa template sekaligus</small>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Pilih Peralatan Pendukung (Bisa >1) <span style="font-weight:400; font-size:0.75rem; color:var(--text-muted);">— untuk {{tabel_peralatan}}</span></label>
                <select class="form-select" id="f-doc-equipments" multiple size="4" onchange="DocumentsPage.renderAttachments()" style="height:auto;">${eqOpts}</select>
            </div>
            <div class="form-group">
                <label class="form-label">Pilih Personil Ditugaskan (Bisa >1) <span style="font-weight:400; font-size:0.75rem; color:var(--text-muted);">— untuk {{tabel_personil}} & {{struktur_organisasi}}</span></label>
                <select class="form-select" id="f-doc-personil-list" multiple size="4" style="height:auto;">${persOpts}</select>
            </div>
        </div>
        <div style="border-top:1px dashed var(--border-color); margin:16px 0; padding-top:16px;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px;">Data Surat & Penomoran <span style="text-transform:none; font-weight:400;">— tiap surat bisa beda kode, nomor, tanggal &amp; perihal</span></div>
            <div id="doc-surat-hint" style="padding:14px; border:1px dashed var(--border-color); border-radius:8px; color:var(--text-muted); text-align:center; font-size:0.85rem;">Pilih template surat di atas — data &amp; penomoran muncul per surat.</div>
            <div id="doc-surat-blocks"></div>
        </div>
        <div style="border-top:1px dashed var(--border-color); margin:16px 0; padding-top:16px;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px;">Penandatangan & Personil</div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Penandatangan 1 (Direktur) <span style="color:var(--danger);">*</span></label>
                    <select class="form-select" id="f-doc-ttd1-type"><option value="direktur">Direktur Perusahaan (Otomatis dari Data Perusahaan)</option></select>
                </div>
                <div class="form-group"><label class="form-label">Penandatangan 2 (Personil Pelaksana — untuk {{ttd_personil}} / {{ttd_gabungan}})</label>
                    <select class="form-select" id="f-doc-ttd2" onchange="DocumentsPage.renderAttachments()">
                        <option value="">-- Tidak Ada / Kosong --</option>${persOpts}
                    </select>
                </div>
            </div>
            <label style="display:flex; align-items:center; gap:8px; margin-top:14px; cursor:pointer;">
                <input type="checkbox" id="f-doc-cap-ttd" checked style="width:16px; height:16px; accent-color:var(--accent);">
                <span style="font-weight:600;">Sertakan Cap &amp; Tanda Tangan <span style="font-weight:400; font-size:0.75rem; color:var(--text-muted);">— hapus centang untuk surat tanpa cap &amp; TTD</span></span>
            </label>
            <!-- Cap/stempel: ukuran & posisi di Master Perusahaan -->
        </div>
        <div id="doc-dynamic-vars-section" style="display:none; border-top:1px dashed var(--border-color); margin:16px 0; padding-top:16px;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px;">Variabel Tambahan Template</div>
            <div id="doc-dynamic-vars-container" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"></div>
        </div>
        <div id="doc-attachments-section" style="display:none; border-top:1px dashed var(--border-color); margin:16px 0; padding-top:16px;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px;">Sertakan Lampiran Dokumen</div>
            <div id="doc-attachments-container"></div>
        </div>`;
        const footer = `<button class="btn btn-secondary" onclick="Modal.close()">Batal</button><button class="btn btn-primary" id="doc-save-btn" onclick="DocumentsPage.generateDocument()">Generate & Cetak Surat</button>`;
        Modal.open('Buat Dokumen Surat Baru', body, footer);
        const modalEl = document.querySelector('.modal');
        if (modalEl) { modalEl.style.maxWidth = '850px'; modalEl.style.width = '90%'; }
        lucide.createIcons();
        // if dokpil preset exists, apply after open
        if (this._dokpilPreset) setTimeout(() => this.onTemplatesChange(), 150);
    },

    onCompanyChange() {
        // ganti perusahaan → nomor urut lama tidak berlaku lagi
        this._genMap = {};
        document.querySelectorAll('#doc-surat-blocks .ds-preview').forEach(el => el.classList.add('hidden'));
        this._updateFontHint();
        this.renderAttachments();
    },

    _updateFontHint() {
        const el = document.getElementById('doc-font-hint');
        if (!el) return;
        const comp = this.companies.find(c => c.id === document.getElementById('f-doc-comp')?.value);
        el.textContent = comp ? `Font surat: ${comp.font_surat || 'Times New Roman'} — dipakai saat mencetak` : '';
    },

    _suratField(tid, field, el) {
        const s = this._suratData[tid];
        if (!s) return;
        s[field] = el.value;
        if (field === 'kode') {
            delete this._genMap[tid];
            el.closest('[data-tpl]')?.querySelector('.ds-preview')?.classList.add('hidden');
        }
        if (field === 'perihal') s.touched = true;
    },

    // render blok Data Surat per template terpilih (state disimpan di _suratData)
    renderSuratBlocks() {
        const select = document.getElementById('f-doc-templates');
        const container = document.getElementById('doc-surat-blocks');
        const hint = document.getElementById('doc-surat-hint');
        if (!select || !container) return;
        container.querySelectorAll('[data-tpl]').forEach(b => {
            const s = this._suratData[b.dataset.tpl];
            if (!s) return;
            s.kode = b.querySelector('.ds-kode')?.value ?? s.kode;
            s.tgl = b.querySelector('.ds-tgl')?.value ?? s.tgl;
            s.perihal = b.querySelector('.ds-perihal')?.value ?? s.perihal;
            s.lampiran = b.querySelector('.ds-lampiran')?.value ?? s.lampiran;
        });
        const ids = Array.from(select.selectedOptions).map(o => o.value);
        if (!ids.length) { container.innerHTML = ''; hint?.classList.remove('hidden'); return; }
        hint?.classList.add('hidden');
        const today = new Date().toISOString().split('T')[0];
        const autoPerihal = this._autoPerihal();
        const firstKode = Object.values(this._suratData).find(s => s.kode)?.kode || '';
        container.innerHTML = ids.map((tid, i) => {
            const t = this.templates.find(x => x.id === tid);
            const s = this._suratData[tid] || (this._suratData[tid] = { kode: firstKode, tgl: today, perihal: '', lampiran: '-', touched: false });
            if (!s.touched && !s.perihal && autoPerihal) s.perihal = autoPerihal;
            const g = this._genMap[tid];
            return `
            <div data-tpl="${tid}" style="border:1px solid var(--border-color); border-radius:8px; padding:12px; margin-bottom:12px; background:var(--bg-secondary);">
                <div style="font-weight:700; font-size:0.8rem; color:var(--text-muted); margin-bottom:10px;">Surat ${i + 1}: ${Fmt.escape(t?.nama_template || tid)}</div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Kode Surat <span style="color:var(--danger);">*</span></label>
                        <div style="display:flex; gap:8px;">
                            <input type="text" class="form-input ds-kode" value="${Fmt.escape(s.kode)}" placeholder="SP, ST, SK" style="text-transform:uppercase; flex:1;"
                                oninput="DocumentsPage._suratField('${tid}','kode',this)" onchange="DocumentsPage.checkNumber('${tid}')">
                            <button type="button" class="btn btn-secondary" onclick="DocumentsPage.checkNumber('${tid}')"><i data-lucide="hash"></i> Gen No.</button>
                        </div>
                    </div>
                    <div class="form-group"><label class="form-label">Tanggal Surat <span style="color:var(--danger);">*</span></label>
                        <input type="date" class="form-input ds-tgl" value="${Fmt.escape(s.tgl)}" onchange="DocumentsPage._suratField('${tid}','tgl',this); DocumentsPage.checkNumber('${tid}')">
                    </div>
                </div>
                <div class="ds-preview ${g ? '' : 'hidden'}" style="margin-bottom:12px; padding:12px; background:rgba(14,165,233,0.08); border:1px solid rgba(14,165,233,0.3); border-radius:8px;">
                    <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Nomor Surat Tergenerate:</span>
                    <span class="ds-preview-num" style="font-weight:700; font-size:1rem; color:var(--accent); margin-left:8px;">${g ? Fmt.escape(g.nomor_surat) : ''}</span>
                </div>
                <div class="form-group"><label class="form-label">Perihal Surat <span style="color:var(--danger);">*</span></label>
                    <input type="text" class="form-input ds-perihal" value="${Fmt.escape(s.perihal)}" placeholder="Perihal surat (misal: Penawaran Pekerjaan...)"
                        oninput="DocumentsPage._suratField('${tid}','perihal',this)">
                </div>
                <div class="form-group"><label class="form-label">Lampiran</label>
                    <input type="text" class="form-input ds-lampiran" value="${Fmt.escape(s.lampiran)}" placeholder="1 (Satu) Berkas"
                        oninput="DocumentsPage._suratField('${tid}','lampiran',this)">
                </div>
            </div>`;
        }).join('');
        lucide.createIcons();
    },

    renderAttachments() {
        const compId = document.getElementById('f-doc-comp')?.value;
        const persId = document.getElementById('f-doc-ttd2')?.value;
        const eqIds = Array.from(document.getElementById('f-doc-equipments')?.selectedOptions || []).map(o => o.value);
        const comp = this.companies.find(c => c.id === compId);
        const pers = this.personnel.find(p => p.id === persId);
        const selectedEqs = this.equipments.filter(e => eqIds.includes(e.id));
        let allAtts = [];
        if (comp && comp.attachments) {
            let atts = comp.attachments; if (typeof atts === 'string') { try { atts = JSON.parse(atts); } catch (e) { atts = []; } }
            if (Array.isArray(atts)) allAtts = allAtts.concat(atts.map(a => ({ ...a, group: 'Perusahaan' })));
        }
        if (pers) {
            if (pers.ktp_url) allAtts.push({ name: 'KTP - ' + pers.nama, url: pers.ktp_url, group: 'Personil' });
            if (pers.npwp_url) allAtts.push({ name: 'NPWP - ' + pers.nama, url: pers.npwp_url, group: 'Personil' });
            (pers.education_history || []).forEach(e => { if (e.ijazah_url) allAtts.push({ name: `Ijazah${e.lembaga ? ' ' + e.lembaga : ''} - ${pers.nama}`, url: e.ijazah_url, group: 'Personil' }); });
            (pers.ska || []).forEach(s => { if (s.file_url) allAtts.push({ name: `${s.nama_sertifikat || 'SKA/SKT'} - ${pers.nama}`, url: s.file_url, group: 'Personil' }); });
        }
        selectedEqs.forEach(eq => { if (eq.file_url) allAtts.push({ name: 'Dokumen Alat - ' + eq.jenis, url: eq.file_url, group: 'Peralatan' }); });
        const attContainer = document.getElementById('doc-attachments-container');
        const attSection = document.getElementById('doc-attachments-section');
        if (!attContainer || !attSection) return;
        if (allAtts.length === 0) { attSection.style.display = 'none'; attContainer.innerHTML = ''; return; }
        attSection.style.display = 'block';
        attContainer.innerHTML = allAtts.map((att) => `
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; cursor:pointer; padding:8px; background:var(--bg-secondary); border-radius:6px;">
                <input type="checkbox" class="doc-attachment-cb" value='${Fmt.escape(JSON.stringify(att))}'>
                <i data-lucide="file-text" style="width:16px; height:16px; color:var(--accent);"></i>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-size:0.85rem; font-weight:500;">${Fmt.escape(att.name)}</span>
                    <span style="font-size:0.65rem; color:var(--text-muted);">${att.group}</span>
                </div>
            </label>`).join('');
        lucide.createIcons();
    },

    onTemplatesChange() {
        const select = document.getElementById('f-doc-templates');
        if (!select) return;
        this.renderSuratBlocks();
        const selectedIds = Array.from(select.selectedOptions).map(opt => opt.value);
        let allVars = new Set();
        selectedIds.forEach(id => {
            const t = this.templates.find(x => x.id === id);
            if (t && t.html_content) {
                const matches = t.html_content.match(/\{\{([^}]+)\}\}/g);
                if (matches) matches.forEach(m => {
                    const vName = m.replace(/[{}]/g, '').trim();
                    const standardVars = ['header_surat', 'nomor_surat', 'perihal', 'lampiran', 'tanggal_surat', 'kota_perusahaan', 'nama_perusahaan', 'singkatan', 'direktur', 'alamat', 'npwp', 'nama_personil', 'jabatan_personil', 'ttd_direktur', 'ttd_personil', 'ttd_gabungan', 'tabel_peralatan', 'tabel_personil', 'struktur_organisasi', 'cap_perusahaan'];
                    if (!standardVars.includes(vName)) allVars.add(vName);
                });
            }
        });
        const varSection = document.getElementById('doc-dynamic-vars-section');
        const varContainer = document.getElementById('doc-dynamic-vars-container');
        if (!varSection || !varContainer) return;
        if (allVars.size === 0) { varSection.style.display = 'none'; varContainer.innerHTML = ''; return; }
        varSection.style.display = 'block';
        const auto = this._autoVarValues();
        varContainer.innerHTML = Array.from(allVars).map(vName => {
            const defaultVal = auto[vName] ?? '';
            return `<div class="form-group" style="margin-bottom:0;"><label class="form-label" style="text-transform:capitalize;">${Fmt.escape(vName.replace(/_/g, ' '))}</label><input type="text" class="form-input doc-dynamic-var" data-var="${Fmt.escape(vName)}" value="${Fmt.escape(defaultVal)}" placeholder="Isi ${Fmt.escape(vName)}..."></div>`;
        }).join('');
    },

    async generateDocument() {
        const compId = document.getElementById('f-doc-comp')?.value;
        const templateIds = Array.from(document.getElementById('f-doc-templates')?.selectedOptions || []).map(o => o.value);
        const persId = document.getElementById('f-doc-ttd2')?.value || null;
        const equipIds = Array.from(document.getElementById('f-doc-equipments')?.selectedOptions || []).map(o => o.value);
        const personilIds = Array.from(document.getElementById('f-doc-personil-list')?.selectedOptions || []).map(o => o.value);
        const withCapTtd = document.getElementById('f-doc-cap-ttd')?.checked ?? true;
        if (!compId || templateIds.length === 0) { Toast.warning('Pilih Perusahaan dan minimal 1 Template'); return; }
        // baca Data Surat per blok (fallback ke state)
        const today = new Date().toISOString().split('T')[0];
        const items = templateIds.map(tid => {
            const block = document.querySelector(`#doc-surat-blocks [data-tpl="${tid}"]`);
            const s = this._suratData[tid] || {};
            return {
                tid,
                kode: (block?.querySelector('.ds-kode')?.value ?? s.kode ?? '').toUpperCase().trim(),
                tgl: block?.querySelector('.ds-tgl')?.value ?? s.tgl ?? today,
                perihal: (block?.querySelector('.ds-perihal')?.value ?? s.perihal ?? '').trim(),
                lampiran: (block?.querySelector('.ds-lampiran')?.value ?? s.lampiran ?? '-').trim() || '-',
            };
        });
        if (items.some(i => !i.perihal)) { Toast.warning('Isi Perihal untuk setiap surat'); return; }
        const btn = document.getElementById('doc-save-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Generate...'; }
        try {
            const dynamicVars = {};
            document.querySelectorAll('.doc-dynamic-var').forEach(input => { dynamicVars[input.getAttribute('data-var')] = input.value; });
            // auto terbilang filling if user left terbilang empty but has nilai_pagu
            if (dynamicVars['terbilang'] === '' && dynamicVars['nilai_pagu']) { const tb = this._terbilang(dynamicVars['nilai_pagu']); if (tb) dynamicVars['terbilang'] = tb; }
            if (dynamicVars['nilai_pagu_terbilang'] === '' && dynamicVars['nilai_pagu']) { const tb = this._terbilang(dynamicVars['nilai_pagu']); if (tb) dynamicVars['nilai_pagu_terbilang'] = tb; }
            if (dynamicVars['pagu_terbilang'] === '' && (dynamicVars['pagu_anggaran'] || dynamicVars['nilai_pagu'])) { const raw = dynamicVars['pagu_anggaran'] || dynamicVars['nilai_pagu']; const tb = this._terbilang(raw); if (tb) dynamicVars['pagu_terbilang'] = tb; }

            // generate nomor per surat (urut per kode & bulan)
            for (const it of items) {
                if (this._genMap[it.tid] || !it.kode) continue;
                const d = new Date(it.tgl);
                const res = await API.getNextLetterNumber(compId, it.kode, d.getFullYear(), d.getMonth() + 1);
                this._genMap[it.tid] = res.data;
            }
            // satu record surat per template (nomor & perihal sendiri-sendiri)
            for (const it of items) {
                const g = this._genMap[it.tid];
                const kontenObj = { templates: [it.tid], variables: dynamicVars, personnel: persId, equipments: equipIds, personilList: personilIds, lampiran: it.lampiran, cap_ttd: withCapTtd };
                const letterData = {
                    company_id: compId, nomor_urut: g?.nomor_urut || 0, kode_surat: it.kode || 'DOC',
                    bulan: g?.bulan || new Date(it.tgl).getMonth() + 1, tahun: g?.tahun || new Date(it.tgl).getFullYear(),
                    nomor_surat: g?.nomor_surat || '-', tanggal: it.tgl, perihal: it.perihal, konten: JSON.stringify(kontenObj)
                };
                await API.createLetter(letterData);
            }
            const parts = items.map((it, i) => this._buildPrintHtml(compId, [it.tid], persId,
                { ...dynamicVars, nomor_surat: this._genMap[it.tid]?.nomor_surat || '-', perihal: it.perihal, lampiran: it.lampiran, tanggal: it.tgl },
                equipIds, personilIds, null, withCapTtd, i === items.length - 1));
            this._openPrint(this._mergePrintParts(parts));
            Toast.success('Dokumen surat berhasil digenerate dan disimpan!');
            this._genMap = {}; Modal.close(); this.loadData();
        } catch (err) { Toast.error(err.message); if (btn) { btn.disabled = false; btn.innerHTML = 'Generate & Cetak Surat'; } }
    },

    async viewOrPrint(id) {
        try {
            const res = await API.getLetterById(id);
            const l = res.data;
            let konten = {};
            if (l.konten) { try { konten = typeof l.konten === 'string' ? JSON.parse(l.konten) : l.konten; } catch (e) { } }
            const tplIds = konten.templates || (l.template_id ? [l.template_id] : []);
            const persId = konten.personnel || null;
            const vars = konten.variables || {};
            const equipIds = konten.equipments || [];
            const personilIds = konten.personilList || [];
            if (tplIds.length === 0) { Toast.warning('Surat ini tidak memiliki template tersimpan.'); return; }
            this.buildAndPrint(l.company_id, tplIds, persId, { ...vars, nomor_surat: l.nomor_surat, perihal: l.perihal, lampiran: konten.lampiran || '-', tanggal: l.tanggal }, equipIds, personilIds, konten.cap || null, konten.cap_ttd !== false);
        } catch (e) { Toast.error('Gagal memuat detail surat: ' + e.message); }
    },

    buildAndPrint(compId, templateIds, persId, vars, equipIds, personilIds, capOpts, withCapTtd = true) {
        this._openPrint(this._buildPrintHtml(compId, templateIds, persId, vars, equipIds, personilIds, capOpts, withCapTtd));
    },

    _openPrint(fullHtml) {
        const printWin = window.open('', '_blank');
        if (!printWin) { Toast.error('Popup diblokir browser. Izinkan popup untuk mencetak dokumen.'); return; }
        printWin.document.open(); printWin.document.write(fullHtml); printWin.document.close();
        setTimeout(() => { printWin.focus(); printWin.print(); }, 600);
    },

    // gabung beberapa surat jadi satu window cetak, dipisah page-break
    // ponytail: @page/ukuran kertas & CSS head diambil dari surat pertama — campur orientasi = kertas surat pertama menang
    _mergePrintParts(parts) {
        if (parts.length === 1) return parts[0];
        let merged = parts[0].slice(0, parts[0].indexOf('<body>') + 6);
        parts.forEach((p, i) => {
            merged += p.slice(p.indexOf('<body>') + 6, p.lastIndexOf('</body>'));
            if (i < parts.length - 1) merged += '<div class="page-break"></div>';
        });
        return merged + '</body></html>';
    },

    _buildPrintHtml(compId, templateIds, persId, vars, equipIds, personilIds, capOpts, withCapTtd = true, includeAtts = true) {
        const comp = this.companies.find(c => c.id === compId);
        const pers = this.personnel.find(p => p.id === persId);
        const mainTpl = templateIds.length > 0 ? this.templates.find(x => x.id === templateIds[0]) : null;
        let pwmm = mainTpl?.paper_size === 'F4' ? 215 : 210, phmm = mainTpl?.paper_size === 'F4' ? 330 : 297;
        if (mainTpl?.orientation === 'landscape') { const t0 = pwmm; pwmm = phmm; phmm = t0; }
        const paperSizeStr = `${pwmm}mm ${phmm}mm`;
        const mt = mainTpl?.margin_top ?? 25; const mb = mainTpl?.margin_bottom ?? 25; const ml = mainTpl?.margin_left ?? 30; const mr = mainTpl?.margin_right ?? 25;
        const kota = comp?.kota || '';
        const tglFormat = vars.tanggal ? Fmt.date(vars.tanggal) : '';
        const tglSurat = kota ? `${kota}, ${tglFormat}` : tglFormat;
        const headerSurat = `<table style="width:100%; max-width:550px; margin-bottom:20px; border-collapse:collapse; font-size:inherit; font-family:inherit;"><tr><td style="width:90px; vertical-align:top; padding:2px 0;">Nomor</td><td style="width:12px; vertical-align:top; padding:2px 0;">:</td><td style="padding:2px 0;">${Fmt.escape(vars.nomor_surat)}</td></tr><tr><td style="vertical-align:top; padding:2px 0;">Lampiran</td><td style="vertical-align:top; padding:2px 0;">:</td><td style="padding:2px 0;">${Fmt.escape(vars.lampiran || '-')}</td></tr><tr><td style="vertical-align:top; padding:2px 0;">Perihal</td><td style="vertical-align:top; padding:2px 0;">:</td><td style="padding:2px 0;"><strong>${Fmt.escape(vars.perihal)}</strong></td></tr></table>`;
        const capSz = Math.min(300, Math.max(30, parseInt(capOpts?.size) || parseInt(comp?.cap_size) || 110));
        const capPos = capOpts?.pos || comp?.cap_pos || 'kiri';
        const capX = capPos === 'tengah' ? 'left:50%; transform:translateX(-50%);' : capPos === 'kanan' ? 'right:-15px;' : 'left:-15px;';
        const imgCap = withCapTtd && comp?.cap_image_url ? `<img src="${Fmt.url(comp.cap_image_url)}" style="position:absolute; ${capX} top:10px; max-width:${capSz}px; opacity:0.85; z-index:-1;">` : '';
        const imgTtdDir = comp?.ttd_image_url ? `<img src="${Fmt.url(comp.ttd_image_url)}" style="max-height:85px; position:relative; z-index:1;">` : '<br><br><br>';
        const ttdJabatan = comp?.ttd_jabatan || 'Direktur';
        const ttdDirektur = withCapTtd ? `<div style="text-align:center; position:relative; display:inline-block; min-width:220px;">${imgCap}<div style="margin-bottom:8px;"><strong>${Fmt.escape(comp?.nama_perusahaan || 'Perusahaan')}</strong></div>${imgTtdDir}<div style="margin-top:8px; font-weight:bold; text-decoration:underline;">${Fmt.escape(comp?.direktur || 'Nama Direktur')}</div><div>${Fmt.escape(ttdJabatan)}</div></div>` : '';
        let ttdPersonil = '';
        if (pers && withCapTtd) {
            const imgTtdPers = pers.ttd_image_url ? `<img src="${Fmt.url(pers.ttd_image_url)}" style="max-height:85px;">` : '<br><br><br>';
            const tglLine = tglSurat ? `<div style="margin-bottom:6px;">${Fmt.escape(tglSurat)}</div>` : '';
            ttdPersonil = `<div style="text-align:center; display:inline-block; min-width:220px;">${tglLine}<div style="margin-bottom:8px;"><strong>Hormat saya,</strong></div>${imgTtdPers}<div style="margin-top:8px; font-weight:bold; text-decoration:underline;">${Fmt.escape(pers.nama)}</div><div>${Fmt.escape(pers.jabatan || 'Pelaksana')}</div></div>`;
        }
        const ttdGabungan = withCapTtd ? `<table style="width:100%; margin-top:35px; border-collapse:collapse;"><tr><td style="width:50%; text-align:center; vertical-align:bottom;"><div style="margin-bottom:8px;">Mengetahui,</div>${ttdDirektur}</td><td style="width:50%; text-align:center; vertical-align:bottom;">${ttdPersonil}</td></tr></table>` : '';

        // ── auto vars tabel ──
        // resolve selected lists from params or DOM fallback
        let selEquipIds = equipIds;
        let selPersonilIds = personilIds;
        if ((!selEquipIds || !selEquipIds.length) && document.getElementById('f-doc-equipments')) {
            selEquipIds = Array.from(document.getElementById('f-doc-equipments')?.selectedOptions || []).map(o => o.value);
        }
        if ((!selPersonilIds || !selPersonilIds.length) && document.getElementById('f-doc-personil-list')) {
            selPersonilIds = Array.from(document.getElementById('f-doc-personil-list')?.selectedOptions || []).map(o => o.value);
        }
        selEquipIds = selEquipIds || [];
        selPersonilIds = selPersonilIds || [];
        const selectedEquipList = this.equipments.filter(e => selEquipIds.includes(e.id));
        const selectedPersonilList = this.personnel.filter(p => selPersonilIds.includes(p.id));

        const tabelPeralatan = selectedEquipList.length ? `
            <table style="width:100%; border-collapse:collapse; font-size:10pt;">
                <thead><tr style="background:#f2f2f2;">
                    <th style="border:1px solid #000; padding:4px;">No</th>
                    <th style="border:1px solid #000; padding:4px;">Jenis Peralatan</th>
                    <th style="border:1px solid #000; padding:4px;">Kapasitas</th>
                    <th style="border:1px solid #000; padding:4px;">Jumlah</th>
                    <th style="border:1px solid #000; padding:4px;">Tahun Produksi</th>
                    <th style="border:1px solid #000; padding:4px;">Merk/Type</th>
                    <th style="border:1px solid #000; padding:4px;">Kondisi</th>
                    <th style="border:1px solid #000; padding:4px;">Lokasi Sekarang</th>
                    <th style="border:1px solid #000; padding:4px;">Bukti Kepemilikan</th>
                </tr></thead>
                <tbody>
                ${selectedEquipList.map((e, i) => `<tr>
                    <td style="border:1px solid #000; padding:4px; text-align:center;">${i + 1}</td>
                    <td style="border:1px solid #000; padding:4px;">${Fmt.escape(e.jenis)}</td>
                    <td style="border:1px solid #000; padding:4px;">${Fmt.escape(e.kapasitas || '-')}</td>
                    <td style="border:1px solid #000; padding:4px; text-align:center;">${Fmt.escape(String(e.jumlah || '-'))}</td>
                    <td style="border:1px solid #000; padding:4px; text-align:center;">${Fmt.escape(String(e.tahun_produksi || '-'))}</td>
                    <td style="border:1px solid #000; padding:4px;">${Fmt.escape(e.merk_type || '-')}</td>
                    <td style="border:1px solid #000; padding:4px;">${Fmt.escape(e.kondisi || '-')}</td>
                    <td style="border:1px solid #000; padding:4px;">${Fmt.escape(e.lokasi_sekarang || '-')}</td>
                    <td style="border:1px solid #000; padding:4px;">${Fmt.escape(e.bukti_kepemilikan || '-')}</td>
                </tr>`).join('')}
                </tbody>
            </table>` : '<p style="color:#999; font-style:italic; text-align:center; border:1px dashed #ccc; padding:12px;">Tidak ada peralatan terpilih — pilih peralatan di form sebelum cetak.</p>';

        const tabelPersonil = selectedPersonilList.length ? `
            <table style="width:100%; border-collapse:collapse; font-size:10pt;">
                <thead><tr style="background:#f2f2f2;">
                    <th style="border:1px solid #000; padding:4px;">No</th>
                    <th style="border:1px solid #000; padding:4px;">Nama</th>
                    <th style="border:1px solid #000; padding:4px;">Tingkat Pendidikan</th>
                    <th style="border:1px solid #000; padding:4px;">Jabatan</th>
                    <th style="border:1px solid #000; padding:4px;">Pengalaman (th)</th>
                    <th style="border:1px solid #000; padding:4px;">Sertifikat Keahlian</th>
                </tr></thead>
                <tbody>
                ${selectedPersonilList.map((p, i) => `<tr>
                    <td style="border:1px solid #000; padding:4px; text-align:center;">${i + 1}</td>
                    <td style="border:1px solid #000; padding:4px;">${Fmt.escape(p.nama)}</td>
                    <td style="border:1px solid #000; padding:4px;">${Fmt.escape(p.tingkat_pendidikan || '-')}</td>
                    <td style="border:1px solid #000; padding:4px;">${Fmt.escape(p.jabatan || '-')}</td>
                    <td style="border:1px solid #000; padding:4px; text-align:center;">${Fmt.escape(String(p.tahun_pengalaman ?? 0))}</td>
                    <td style="border:1px solid #000; padding:4px;">${Fmt.escape(p.sertifikat_keahlian || '-')}</td>
                </tr>`).join('')}
                </tbody>
            </table>` : '<p style="color:#999; font-style:italic; text-align:center; border:1px dashed #ccc; padding:12px;">Tidak ada personil terpilih — pilih personil di form sebelum cetak.</p>';

        const strukturOrganisasi = selectedPersonilList.length ? `
            <div style="text-align:center; margin:20px 0;">
                <div style="display:inline-block; border:1px solid #000; padding:8px 20px; font-weight:bold;">
                    ${Fmt.escape(comp?.direktur || '')}<br><span style="font-weight:normal;">Direktur</span>
                </div>
                <div style="width:1px; height:20px; background:#000; margin:0 auto;"></div>
                <div style="display:flex; justify-content:center; gap:24px; margin-top:8px; flex-wrap:wrap;">
                ${selectedPersonilList.map(p => `
                    <div style="border:1px solid #000; padding:8px 14px; font-weight:bold; min-width:120px;">
                        ${Fmt.escape(p.nama)}<br><span style="font-weight:normal; font-size:0.9em;">${Fmt.escape(p.jabatan || '-')}</span>
                    </div>`).join('')}
                </div>
            </div>` : '<p style="color:#999; font-style:italic; text-align:center; border:1px dashed #ccc; padding:12px;">Bagan struktur organisasi akan tampil setelah personil terpilih.</p>';

        let kopHtml = '';
        if (comp) {
            const kopLine = /^#[0-9a-fA-F]{3,8}$/.test(comp.kop_garis_warna || '') ? comp.kop_garis_warna : '#000000';
            if (comp.kop_is_image && comp.kop_image_url) kopHtml = `<img src="${Fmt.url(comp.kop_image_url)}" style="width:100%; max-height:140px; object-fit:contain; margin-bottom:10px; border-bottom:3px double ${kopLine}; padding-bottom:8px;">`;
            else kopHtml = `<div style="text-align:center; margin-bottom:10px; border-bottom:3px double ${kopLine}; padding-bottom:10px;"><h2 style="margin:0; font-size:22px; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">${Fmt.escape(comp.kop_nama || comp.nama_perusahaan)}</h2><p style="margin:4px 0 2px 0; font-size:11pt;">${Fmt.escape(comp.kop_alamat || comp.alamat || '')}</p><p style="margin:0; font-size:10pt; color:#333;">${Fmt.escape(comp.kop_kontak || '')}</p></div>`;
        }
        const selectedAtts = includeAtts ? Array.from(document.querySelectorAll('.doc-attachment-cb:checked')).map(cb => JSON.parse(cb.value)) : [];
        const fontName = String(comp?.font_surat || 'Times New Roman').replace(/[^A-Za-z0-9 '\-.,]/g, '');
        const fontStack = `'${fontName}', 'Times New Roman', Times, serif`;
        // ponytail: @page margin 0 → Chrome sembunyikan header/footer cetak (tanggal, judul, about:blank, no. halaman); margin pindah ke padding .doc-page (inline per halaman). Satu template meluber >1 halaman = halaman lanjutan tanpa margin.
        let fullHtml = `<!DOCTYPE html><html><head><title>${Fmt.escape(vars.nomor_surat)}</title><style>@page { size: ${paperSizeStr}; margin: 0; } body { font-family: ${fontStack}; font-size: 12pt; line-height: 1.5; color: black; margin: 0; padding: 0; } .page-break { page-break-after: always; } .doc-page { position: relative; box-sizing: border-box; } .doc-page > *:nth-child(2) { margin-top: 0; } .attachment-page { display: flex; align-items: center; justify-content: center; height: 100vh; padding: 20mm; } .attachment-img { max-width: 100%; max-height: 100%; object-fit: contain; } table { border-collapse: collapse; } * { box-sizing: border-box; }</style></head><body>`;
        templateIds.forEach((tId, idx) => {
            const t = this.templates.find(x => x.id === tId); if (!t) return;
            let content = t.html_content || '';
            // tanpa cap&TTD: buang ekor penutup manual gaya {{kota_perusahaan}}, {{tanggal}} … s/d akhir (nama perusahaan/direktur/jabatan di situ ikut hilang)
            if (!withCapTtd) content = content.replace(/\{\{\s*kota_perusahaan\s*\}\}\s*,\s*\{\{\s*(?:tanggal_surat|tanggal)\s*\}\}[\s\S]*$/i, '');
            content = content.replace(/\{\{header_surat\}\}/g, headerSurat)
                .replace(/\{\{tanggal_surat\}\}/g, withCapTtd ? tglSurat : '')
                .replace(/\{\{kota_perusahaan\}\}/g, withCapTtd ? Fmt.escape(kota) : '')
                .replace(/\{\{nama_perusahaan\}\}/g, Fmt.escape(comp?.nama_perusahaan || ''))
                .replace(/\{\{singkatan\}\}/g, Fmt.escape(comp?.singkatan || comp?.nama_perusahaan || ''))
                .replace(/\{\{direktur\}\}/g, Fmt.escape(comp?.direktur || ''))
                .replace(/\{\{alamat\}\}/g, Fmt.escape(comp?.alamat || ''))
                .replace(/\{\{npwp\}\}/g, Fmt.escape(comp?.npwp_usaha || ''))
                .replace(/\{\{nama_personil\}\}/g, Fmt.escape(pers?.nama || ''))
                .replace(/\{\{jabatan_personil\}\}/g, Fmt.escape(pers?.jabatan || 'Pelaksana'))
                .replace(/\{\{ttd_direktur\}\}/g, ttdDirektur)
                .replace(/\{\{ttd_personil\}\}/g, ttdPersonil)
                .replace(/\{\{ttd_gabungan\}\}/g, ttdGabungan)
                .replace(/\{\{tabel_peralatan\}\}/g, tabelPeralatan)
                .replace(/\{\{tabel_personil\}\}/g, tabelPersonil)
                .replace(/\{\{struktur_organisasi\}\}/g, strukturOrganisasi);
            // auto terbilang fallback if not provided via dynamic vars
            if (!vars['terbilang'] && vars['nilai_pagu']) { const tb = this._terbilang(vars['nilai_pagu']); if (tb) content = content.replace(/\{\{terbilang\}\}/g, Fmt.escape(tb)); }
            if (!vars['nilai_pagu_terbilang'] && vars['nilai_pagu']) { const tb = this._terbilang(vars['nilai_pagu']); if (tb) content = content.replace(/\{\{nilai_pagu_terbilang\}\}/g, Fmt.escape(tb)); }
            Object.keys(vars).forEach(k => { content = content.replace(new RegExp(`\\{\\{ ?${k} ?\\}\\}`, 'g'), Fmt.escape(vars[k])); });
            // auto table fallback for any remaining terbilang-like tokens -> try terbilang of related nilai
            content = content.replace(/\{\{terbilang[^}]*\}\}/g, m => {
                // if still not replaced, try to find numeric var nearby
                return '.........';
            });
            content = content.replace(/\{\{[^}]+\}\}/g, '.........');
            fullHtml += `<div class="doc-page" style="min-height: ${phmm - mt - mb}mm; padding: ${mt}mm ${mr}mm ${mb}mm ${ml}mm;">${kopHtml}${content}</div>`;
            if (idx < templateIds.length - 1 || selectedAtts.length > 0) fullHtml += '<div class="page-break"></div>';
        });
        selectedAtts.forEach((att, idx) => {
            if (att.url && att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) { fullHtml += `<div class="attachment-page"><img src="${Fmt.url(att.url)}" class="attachment-img"></div>`; if (idx < selectedAtts.length - 1) fullHtml += '<div class="page-break"></div>'; }
            else { fullHtml += `<div class="attachment-page"><h3>Lampiran Dokumen: ${Fmt.escape(att.name)}</h3><p><em>(Harap sertakan file ini: ${Fmt.url(att.url)})</em></p></div>`; if (idx < selectedAtts.length - 1) fullHtml += '<div class="page-break"></div>'; }
        });
        fullHtml += '</body></html>';
        return fullHtml;
    },

    remove(id) {
        Modal.confirm('Hapus Surat', 'Hapus dokumen surat ini? Nomor urut tidak akan berubah.', async () => {
            try { await API.deleteLetter(id); Toast.success('Surat dihapus'); this.loadData(); }
            catch (e) { Toast.error(e.message); }
        });
    }
};
