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
                <h2>Dokumen Lelang</h2>
                <p>Rekap dokumen penawaran tender yang pernah digenerate</p>
            </div>
            <button class="btn btn-primary" onclick="DocumentsPage.openForm()"><i data-lucide="plus"></i> Buat Dokumen</button>
        </div>
        <div id="doc-records"><div class="page-loading"><div class="spinner"></div></div></div>`;
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
        } catch (e) { console.error('Failed to load data for docs', e); }
        this.loadRecords();
    },

    async loadRecords() {
        const el = document.getElementById('doc-records');
        if (!el) return;
        try {
            const res = await API.getDocRecords();
            const rows = res.data || [];
            if (!rows.length) {
                el.innerHTML = '<div class="empty-state"><i data-lucide="file-check"></i><p>Belum ada dokumen. Buat via tombol <strong>Buat Dokumen</strong>.</p></div>';
                lucide.createIcons(); return;
            }
            const vOf = (r) => { try { return typeof r.variables === 'string' ? JSON.parse(r.variables) : (r.variables || {}); } catch { return {}; } };
            // kelompokkan per generate: batch_id di variables — lama tanpa batch_id = grup sendiri
            const groups = new Map();
            rows.forEach(r => {
                const v = vOf(r);
                const key = v.batch_id || ('s-' + r.id);
                if (!groups.has(key)) groups.set(key, { key, hasBatch: !!v.batch_id, v, items: [] });
                groups.get(key).items.push({ r, v });
            });
            const th = (x) => (x === null || x === undefined || x === '' ? '-' : `${x} th`);
            // rows sudah DESC; Map preserve insert order = grup terbaru di atas
            el.innerHTML = `<div class="table-container" style="overflow-x:auto;"><table class="mini-table doc-records-table"><thead><tr>
                <th style="width:28px;"></th><th>Pembuatan</th><th>Nama Paket</th><th>SBU</th><th>Perusahaan</th><th>Pelaksana</th><th>K3</th><th style="text-align:center;">Peng. Pelaksana</th><th style="text-align:center;">Peng. K3</th><th style="text-align:center;">TTD</th><th style="text-align:center;">Aksi</th></tr></thead><tbody>` +
                [...groups.values()].map(g => {
                    const { v, items, key } = g;
                    const first = items[0];
                    const ttd = (() => {
                        const vv = items.map(i => i.v);
                        if (vv.some(x => x.has_ttd === true)) return '<span style="color:var(--success); font-weight:800;" title="TTD + cap ada">✓</span>';
                        if (vv.every(x => x.has_ttd === false)) return '<span style="color:var(--text-muted);">-</span>';
                        return vv.some(x => { const s = x.show || {}; return (s.direktur || s.pelaksana || s.k3) && s.cap; })
                            ? '<span style="color:var(--success); font-weight:800;" title="TTD + cap ada">✓</span>' : '<span style="color:var(--text-muted);">-</span>';
                    })();
                    const zipA = g.hasBatch ? `<a class="btn btn-secondary eq-btn" href="/api/documents/batch/${encodeURIComponent(key)}/zip" title="Unduh semua (ZIP)" onclick="event.stopPropagation()"><i data-lucide="archive"></i></a>` : '';
                    const delAll = `<button class="btn btn-danger eq-btn" onclick="event.stopPropagation(); DocumentsPage.removeBatch('${key}')" title="Hapus semua"><i data-lucide="trash-2"></i></button>`;
                    const parent = `<tr class="doc-parent" onclick="DocumentsPage.toggleBatch('${key}')">
                    <td style="text-align:center; color:var(--text-muted);"><i data-lucide="chevron-right" class="doc-chev" data-batch="${key}" style="width:16px; height:16px; transition:transform .15s;"></i></td>
                    <td style="white-space:nowrap;">${(() => { const d = first.r.created_at ? new Date(first.r.created_at) : null; return d && !isNaN(d) ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + '<br>' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'; })()}</td>
                    <td>${Fmt.escape(v.tender?.nama || first.r.nama_tender || '-')}<br><small style="color:var(--text-muted);">${Fmt.escape(v.tender?.kode || first.r.kode_tender || '')}</small></td>
                    <td>${Fmt.escape(first.r.tender_sbu || '-')}</td>
                    <td>${Fmt.escape(first.r.nama_perusahaan || '-')}</td>
                    <td>${Fmt.escape(v.pelaksana?.nama || v.vars?.nama_pelaksana || '-')}</td>
                    <td>${Fmt.escape(v.k3?.nama || v.vars?.nama_k3 || '-')}</td>
                    <td style="text-align:center;">${th(v.pelaksana?.pengalaman ?? v.vars?.pengalaman_pelaksana)}</td>
                    <td style="text-align:center;">${th(v.k3?.pengalaman ?? v.vars?.pengalaman_k3)}</td>
                    <td style="text-align:center;">${ttd}</td>
                    <td><div class="eq-actions">${zipA}${delAll}</div></td>
                </tr>`;
                    const children = items.map(({ r }) => `<tr class="doc-child" data-batch="${key}" style="display:none;">
                    <td></td>
                    <td colspan="9" style="padding-left:36px;"><i data-lucide="file-text" style="width:14px; height:14px; vertical-align:-2px; color:var(--accent);"></i> <strong>${Fmt.escape(r.nama_template || 'Dokumen')}</strong>
                        <small style="color:var(--text-muted); margin-left:8px;">${r.page_count || '?'} hal.</small></td>
                    <td style="text-align:center; white-space:nowrap;">
                        <div class="eq-actions">
                            <a class="btn btn-secondary eq-btn" href="${r.file_url}" target="_blank" title="Lihat" onclick="event.stopPropagation()"><i data-lucide="eye"></i></a>
                            <a class="btn btn-secondary eq-btn" href="${r.file_url}" download title="Unduh" onclick="event.stopPropagation()"><i data-lucide="download"></i></a>
                            <button class="btn btn-danger eq-btn" onclick="event.stopPropagation(); DocumentsPage.removeRecord('${r.id}', '${Fmt.escape(r.file_url || '')}')" title="Hapus"><i data-lucide="trash-2"></i></button>
                        </div>
                    </td>
                </tr>`).join('');
                    return parent + children;
                }).join('') + `</tbody></table></div>`;
            lucide.createIcons();
        } catch (e) {
            el.innerHTML = `<div class="empty-state"><i data-lucide="file-text"></i><p>Gagal memuat dokumen: ${e.message}</p></div>`;
            lucide.createIcons();
        }
    },

    toggleBatch(key) {
        const kids = document.querySelectorAll(`tr.doc-child[data-batch="${CSS.escape(key)}"]`);
        if (!kids.length) return;
        const open = kids[0].style.display === 'none';
        kids.forEach(k => k.style.display = open ? '' : 'none');
        const chev = document.querySelector(`.doc-chev[data-batch="${CSS.escape(key)}"]`);
        if (chev) chev.style.transform = open ? 'rotate(90deg)' : '';
    },

    removeBatch(key, hasBatch) {
        Modal.confirm('Hapus Semua Dokumen', 'Hapus seluruh file PDF + catatan dalam generate ini?', async () => {
            try {
                const res = await API.getDocRecords();
                const rows = (res.data || []).filter(r => {
                    let v = {}; try { v = typeof r.variables === 'string' ? JSON.parse(r.variables) : (r.variables || {}); } catch {}
                    return (v.batch_id || ('s-' + r.id)) === key;
                });
                for (const r of rows) {
                    if (r.file_url) await API.deleteFile(r.file_url).catch(() => {});
                    await API.deleteDocRecord(r.id).catch(() => {});
                }
                Toast.success(`${rows.length} dokumen dihapus`);
                this.loadRecords();
            } catch (e) { Toast.error(e.message); }
        });
    },

    removeRecord(id, url) {
        Modal.confirm('Hapus Dokumen', 'Hapus catatan + file PDF ini?', async () => {
            try {
                if (url) await API.deleteFile(url).catch(() => {});
                await API.deleteDocRecord(id);
                Toast.success('Dokumen dihapus');
                this.loadRecords();
            } catch (e) { Toast.error(e.message); }
        });
    },

    openForm() {
        if (!this.companies?.length) { Toast.warning('Tunggu data dimuat...'); return; }
        this._wz = { step: 1, tender: null, vars: {}, letter: { pa: 'PA', sdg: '', perihal: 'Penawaran Administrasi', lampiran: 'Dokumen Penawaran', tgl: new Date().toISOString().split('T')[0], nomor: '', urut: null }, equip: {}, pelaksana: { id: '', exp: [] }, k3: { id: '', exp: [] }, rkk: { vars: {} } };
        const compOpts = this.companies.map(c => `<option value="${c.id}">${Fmt.escape(c.nama_perusahaan)}</option>`).join('');
        const stepBar = (n) => [1, 2, 3, 4, 5, 6].map(i => `<div class="doc-wiz-step" data-s="${i}" onclick="DocumentsPage._wizGo(${i})" title="Ke langkah ${i}" style="flex:1; text-align:center; font-size:0.75rem; font-weight:700; padding:8px 4px; border-radius:8px; cursor:pointer; background:${i === n ? 'var(--accent)' : 'var(--bg-tertiary)'}; color:${i === n ? '#fff' : 'var(--text-muted)'};">${i}. ${['Proyek', '04 Surat', '01 Alat', 'Personil', 'RKK', 'Review'][i - 1]}</div>`).join('');
        const body = `
        <div id="doc-wiz-steps" style="display:flex; gap:8px; margin-bottom:16px;">${stepBar(1)}</div>
        <div id="doc-wiz-hint"></div>
        <div class="doc-wiz-pane" data-pane="1"></div>
        <div class="doc-wiz-pane" data-pane="2" style="display:none;"></div>
        <div class="doc-wiz-pane" data-pane="3" style="display:none;"></div>
        <div class="doc-wiz-pane" data-pane="4" style="display:none;"></div>
        <div class="doc-wiz-pane" data-pane="5" style="display:none;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px;">RKK — Tabel B1/B2/D2/E1</div>
            <div id="doc-rkk-box"></div>
        </div>
        <div class="doc-wiz-pane" data-pane="6" style="display:none;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px;">Review & Generate</div>
            <div id="doc-review-box"></div>
        </div>`;
        const footer = `<button class="btn btn-secondary" onclick="Modal.close()">Batal</button><span style="flex:1;"></span><button class="btn btn-secondary" id="doc-wiz-back" onclick="DocumentsPage._wizNav(-1)" style="display:none;">‹ Kembali</button><button class="btn btn-primary" id="doc-wiz-next" onclick="DocumentsPage._wizNav(1)">Lanjut ›</button><button class="btn btn-primary" id="doc-generate-btn" onclick="DocumentsPage.wzGenerate()" style="display:none;"><i data-lucide="file-check"></i> Generate PDF</button>`;
        Modal.open('Buat Dokumen Lelang', body, footer, { maxWidth: 'calc(100vw - 40px)' });
        this._wzForm1(compOpts);
        this._wizShow(1);
        // ponytail: Enter di langkah Review = Generate; guard overlay biar tak nyasar setelah modal tutup
        document.removeEventListener('keydown', this._wzKeyH);
        this._wzKeyH = (e) => {
            if (e.key !== 'Enter' || this._wzStep !== 6) return;
            if (document.getElementById('modal-overlay')?.classList.contains('hidden')) return;
            const gen = document.getElementById('doc-generate-btn');
            if (!gen || gen.style.display === 'none' || gen.disabled) return;
            e.preventDefault();
            this.wzGenerate();
        };
        document.addEventListener('keydown', this._wzKeyH);
        lucide.createIcons();
    },

    _wizShow(n) {
        this._wzStep = n;
        document.querySelectorAll('.doc-wiz-pane').forEach(p => { p.style.display = +p.dataset.pane === n ? '' : 'none'; });
        document.querySelectorAll('.doc-wiz-step').forEach(s => {
            const active = +s.dataset.s === Math.min(n, 6);
            s.style.background = active ? 'var(--accent)' : (+s.dataset.s < n ? 'var(--success)' : 'var(--bg-tertiary)');
            s.style.color = (active || +s.dataset.s < n) ? '#fff' : 'var(--text-muted)';
        });
        document.getElementById('doc-wiz-back').style.display = n > 1 ? '' : 'none';
        document.getElementById('doc-wiz-next').style.display = n < 6 ? '' : 'none';
        const gen = document.getElementById('doc-generate-btn');
        if (gen) gen.style.display = n === 6 ? '' : 'none';
        const hints = {
            1: 'Pilih paket yang belum lewat upload — data terisi otomatis, semua bisa diubah.',
            2: 'Nomor tersusun otomatis. Perihal menentukan segmen. Tanggal bisa diklik.',
            3: 'Ceklis alat yang dipakai. Klik nilai untuk ubah. Sewa → lampirkan file.',
            4: 'Pilih pelaksana & K3 — profil terisi otomatis, riwayat boleh kosong.',
            5: 'Tabel RKK B1/B2/D2/E1 — isian untuk dokumen 03 RKK.',
            6: 'Periksa ringkasan, lalu generate PDF (semua dokumen: 01–04).',
        };
        const hint = document.getElementById('doc-wiz-hint');
        if (hint) hint.textContent = hints[n] || '';
        lucide.createIcons();
    },

    _wzVal(id) { return document.getElementById(id)?.value ?? ''; },

    // bulan → romawi
    _roman(m) { return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][m - 1] || ''; },

    // tender aktif = ada jadwal berakhir ≥ sekarang
    _tenderAktif() {
        const now = new Date();
        const months = { januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5, juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11 };
        return (this.tenders || []).filter(t => {
            let j = t.jadwal;
            if (!j) return true;
            if (typeof j === 'string') { try { j = JSON.parse(j); } catch { return true; } }
            const ends = (Array.isArray(j) ? j : []).map(s => {
                const m = String(s.end || '').match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/i);
                if (!m || months[m[2].toLowerCase()] === undefined) return null;
                return new Date(+m[3], months[m[2].toLowerCase()], +m[1], +m[4], +m[5]);
            }).filter(Boolean);
            if (!ends.length) return true;
            return Math.max(...ends) >= now;
        });
    },

    // ── FORM 1: proyek ──
    _wzForm1(compOpts) {
        const pane = document.querySelector('.doc-wiz-pane[data-pane="1"]');
        const tenders = this._tenderAktif();
        pane.innerHTML = `
        <div style="font-weight:700; margin-bottom:10px; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">1. Proyek &amp; Perusahaan</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 28px; align-items:start;">
        <div>
            <div class="form-group"><label class="form-label">Cari Proyek *</label>
                <div style="position:relative;">
                    <input class="form-input" id="wz-tender-search" placeholder="Ketik nama/kode paket..." autocomplete="off"
                        oninput="DocumentsPage._wzTenderSearch(this.value)" onfocus="DocumentsPage._wzTenderSearch(this.value)">
                    <input type="hidden" id="wz-tender" value="">
                    <div id="wz-tender-drop" class="hidden" style="position:absolute; top:100%; left:0; right:0; z-index:30; max-height:240px; overflow:auto; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:8px; margin-top:4px; box-shadow:0 8px 16px rgba(0,0,0,.15);"></div>
                </div>
                <small style="color:var(--text-muted);">Ketik untuk menyaring daftar panjang</small>
            </div>
            <div style="display:grid; grid-template-columns:110px 1fr; gap:10px;">
                <div class="form-group" style="margin-bottom:10px;"><label class="form-label">Tahun</label><input class="form-input" id="wz-tahun" placeholder="2026"></div>
                <div class="form-group" style="margin-bottom:10px;"><label class="form-label">Lokasi</label><input class="form-input" id="wz-lokasi" placeholder="Kab. Sukoharjo"></div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group" style="margin-bottom:10px;"><label class="form-label">LPSE</label><input class="form-input" id="wz-lpse" placeholder="LPSE Kab. ..."></div>
                <div class="form-group" style="margin-bottom:10px;"><label class="form-label">Nomor Tender</label><input class="form-input" id="wz-kode" readonly style="background:var(--bg-tertiary);"></div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="form-group" style="margin-bottom:0;"><label class="form-label">Pagu (angka)</label><input class="form-input" id="wz-pagu" inputmode="numeric" placeholder="480000000" oninput="DocumentsPage._wzTerbilang()"></div>
                <div class="form-group" style="margin-bottom:0;"><label class="form-label">Terbilang (otomatis)</label><input class="form-input" id="wz-terbilang" placeholder="otomatis dari pagu"></div>
            </div>
        </div>
        <div>
            <div class="form-group"><label class="form-label">Perusahaan *</label>
                <select class="form-select" id="wz-comp"><option value="">-- Pilih --</option>${compOpts}</select>
            </div>
            <div class="form-group"><label class="form-label">Pokja (custom)</label><input class="form-input" id="wz-pokja" placeholder="Pokja Pemilihan ..."></div>
            <div class="form-group"><label class="form-label">Alamat Pokja</label><input class="form-input" id="wz-alamat-pokja" placeholder="Jl. ..."></div>
            <div class="form-group" style="margin-bottom:0;"><label class="form-label">TTD &amp; Cap?</label>
                <select class="form-select" id="wz-with-ttd"><option value="1">Ya, sertakan</option><option value="0">Tidak</option></select>
            </div>
        </div>
        </div>`;
    },

    _wzTenderSearch(q) {
        const box = document.getElementById('wz-tender-drop');
        if (!box) return;
        const s = (q || '').toLowerCase();
        const list = this._tenderAktif().filter(t =>
            !s || (t.nama_tender || t.nama_paket || '').toLowerCase().includes(s) || String(t.kode_tender || '').includes(s)
        ).slice(0, 30);
        if (!list.length) { box.innerHTML = '<div style="padding:10px 14px; font-size:0.82rem; color:var(--text-muted);">Tidak ketemu.</div>'; }
        else box.innerHTML = list.map(t => `
            <div onmousedown="DocumentsPage._wzTenderChoose('${t.id}')" style="padding:9px 14px; font-size:0.84rem; cursor:pointer; border-bottom:1px solid var(--border-color);"
                onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background=''">
                <strong>${Fmt.escape(t.nama_tender || t.nama_paket || '')}</strong><br>
                <small style="color:var(--text-muted);">${Fmt.escape(t.kode_tender || '')}</small>
            </div>`).join('');
        box.classList.remove('hidden');
        clearTimeout(this._wzDropT);
        this._wzDropT = setTimeout(() => box.classList.add('hidden'), 8000);
    },

    _wzTenderChoose(id) {
        const t = (this.tenders || []).find(x => String(x.id) === String(id));
        document.getElementById('wz-tender-drop')?.classList.add('hidden');
        if (!t) return;
        document.getElementById('wz-tender').value = t.id;
        document.getElementById('wz-tender-search').value = `${t.nama_tender || t.nama_paket || ''} — ${t.kode_tender || ''}`;
        this._wzTenderPick(t.id);
    },

    async _wzTenderPick(id) {
        const t = (this.tenders || []).find(x => String(x.id) === String(id));
        this._wz.tender = t || null;
        if (!t) return;
        const set = (el, v) => { const e = document.getElementById(el); if (e) e.value = v ?? ''; };
        set('wz-tahun', t.tahun || '');
        set('wz-lokasi', t.lokasi_pekerjaan || t.lokasi || '');
        set('wz-lpse', t.klpd ? 'LPSE ' + t.klpd : '');
        set('wz-kode', t.kode_tender || '');
        const paguDigits = String(t.pagu || '').replace(/\D/g, '');
        const paguEl = document.getElementById('wz-pagu');
        if (paguEl) { paguEl.dataset.raw = paguDigits; paguEl.value = paguDigits ? Number(paguDigits).toLocaleString('id-ID') : ''; }
        const nm = t.nama_tender || t.nama_paket || '';
        this._wz.vars.nama_paket = nm;
        this._wzTerbilang();
        // ponytail: tarik data dokpil (RKK) tersimpan utk tender ini → pre-fill tab RKK (B1)
        await this._wzLoadDokpilRkk(t.kode_tender || t.id);
        if (this._wzStep === 5) this._wzForm5();   // re-render RKK tab bila sudah di sana
    },

    async _wzLoadDokpilRkk(kodeTender) {
        if (!kodeTender) return;
        try {
            const res = await fetch('/api/dokpil/saved/' + encodeURIComponent(kodeTender));
            const json = await res.json();
            if (!json.success || !json.data) { console.warn('[RKK load] tidak ada data tersimpan untuk', kodeTender); return; }
            const rkk = json.data.rkk;
            if (!Array.isArray(rkk) || !rkk.length) { console.warn('[RKK load] rkk kosong untuk', kodeTender); return; }
            const vars = this._wz.rkk.vars || {};
            const n = rkk.length;
            this._wz.rkk.barisB1 = n;
            this._wz.rkk.barisB2 = this._wz.rkk.barisB2 || 1;
            this._wz.rkk.barisD2 = this._wz.rkk.barisD2 || 1;
            rkk.forEach((row, i) => {
                const idx = i + 1;
                const uraian = Array.isArray(row) ? (row[1] || '') : (row.uraian || row.uraian_pekerjaan || '');
                const bahaya = Array.isArray(row) ? (row[2] || '') : (row.bahaya || row.identifikasi_bahaya || '');
                if (uraian) vars['uraian_b' + idx] = uraian;
                if (bahaya) vars['identifikasi_b' + idx] = bahaya;
            });
            this._wz.rkk.vars = vars;
        } catch (e) { console.warn('[RKK load] gagal:', e.message); }
    },

    // ponytail: pagu tampil bertitik (480.000.000), mentah digit disimpan di dataset
    _wzPaguRaw() {
        const el = document.getElementById('wz-pagu');
        return (el?.dataset.raw ?? el?.value ?? '').replace(/\D/g, '');
    },

    _wzTerbilang() {
        const el = document.getElementById('wz-pagu');
        if (!el) return;
        const digits = el.value.replace(/\D/g, '').slice(0, 15);
        el.dataset.raw = digits;
        if (digits) el.value = Number(digits).toLocaleString('id-ID');
        const tb = this._terbilang(digits);
        const tbel = document.getElementById('wz-terbilang');
        if (tbel && tb) tbel.value = '(' + tb + ')';
    },

    // ── FORM 2: 04 surat ──
    _wzForm2() {
        const pane = document.querySelector('.doc-wiz-pane[data-pane="2"]');
        const comp = this.companies.find(c => c.id === this._wz.companyId) || {};
        const L = this._wz.letter;
        const tgl = L.tgl || new Date().toISOString().split('T')[0];
        const dt = new Date(tgl);
        const tglShow = (() => { const d = new Date(tgl + 'T00:00:00'); return isNaN(d) ? tgl : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); })();
        pane.innerHTML = `
        <div style="font-weight:700; margin-bottom:12px;">2. Surat <span style="font-weight:400; color:var(--text-muted); font-size:0.78rem;">— 04 surat • format 001/PA/SDG/UGM/X/2026</span></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 28px; align-items:start;">
        <div>
            <div class="form-row">
                <div class="form-group" style="max-width:110px;"><label class="form-label">Urut</label><input class="form-input" id="wz-urut" readonly value="${Fmt.escape(L.urut || '')}" style="background:var(--bg-tertiary);"></div>
                <div class="form-group" style="max-width:130px;"><label class="form-label">Segmen (otomatis)</label><input class="form-input" id="wz-pa" value="${Fmt.escape(L.pa)}" oninput="DocumentsPage._wzPaManual()" title="Otomatis dari perihal, bisa diubah manual"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Perusahaan</label><input class="form-input" readonly value="${Fmt.escape(comp.singkatan || '')}" style="background:var(--bg-tertiary);"></div>
                <div class="form-group"><label class="form-label">Direktur</label><input class="form-input" readonly value="${Fmt.escape(comp.direktur || '')}" style="background:var(--bg-tertiary);"></div>
            </div>
            <div class="form-row">
                <div class="form-group" style="max-width:80px;"><label class="form-label">Bulan</label><input class="form-input" readonly value="${this._roman(dt.getMonth() + 1)}" style="background:var(--bg-tertiary);"></div>
                <div class="form-group" style="max-width:90px;"><label class="form-label">Tahun</label><input class="form-input" readonly value="${dt.getFullYear()}" style="background:var(--bg-tertiary);"></div>
            </div>
            <div class="form-group"><label class="form-label">Nomor Surat Jadi <span style="font-weight:400; font-size:0.75rem; color:var(--text-muted);">(otomatis setelah kode di kanan diisi)</span></label>
                <div style="display:flex; gap:8px;">
                    <input class="form-input" id="wz-nomor" readonly value="${Fmt.escape(L.nomor)}" style="background:var(--bg-tertiary); font-weight:700; flex:1;">
                </div>
            </div>
        </div>
        <div>
            <div class="form-group"><label class="form-label">Kode Proyek</label><input class="form-input" id="wz-sdg" value="${Fmt.escape(L.sdg)}" placeholder="contoh: SDG" oninput="DocumentsPage._wzAutoNomor()"></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Perihal</label><input class="form-input" id="wz-perihal" value="${Fmt.escape(L.perihal)}" placeholder="Penawaran Administrasi" oninput="DocumentsPage._wzPerihalChange()"></div>
                <div class="form-group"><label class="form-label">Lampiran</label><input class="form-input" id="wz-lampiran" value="${Fmt.escape(L.lampiran)}"></div>
            </div>
            <div class="form-group"><label class="form-label">Tanggal Surat</label>
                <div style="display:flex; gap:6px; align-items:center;">
                    <div style="position:relative; flex:1; display:flex; align-items:center;">
                        <input type="text" class="form-input" id="wz-tgl-show" readonly value="${tglShow}"
                            style="cursor:pointer; padding-right:36px;"
                            onclick="DocumentsPage._datePop('wz-tgl')"
                            title="Klik untuk pilih tanggal">
                        <button type="button" style="position:absolute; right:6px; background:none; border:none; padding:0; cursor:pointer; display:flex; align-items:center; color:var(--accent);" onclick="DocumentsPage._datePop('wz-tgl')" title="Pilih tanggal">
                            <i data-lucide="calendar-days" style="width:17px; height:17px; pointer-events:none;"></i>
                        </button>
                    </div>
                    <input type="hidden" id="wz-tgl" value="${tgl}">
                    <button type="button" class="btn btn-secondary btn-sm" style="white-space:nowrap; flex-shrink:0;" onclick="DocumentsPage._wzTglSet(new Date().toISOString().split('T')[0])" title="Isi hari ini">Hari ini</button>
                </div>
            </div>
            <div class="form-group" style="margin-bottom:0;"><label class="form-label">Alamat Direktur</label><input class="form-input" id="wz-alamat-dir" value="${Fmt.escape(L.alamatDir || comp.alamat_direktur || comp.alamat || '')}"></div>
        </div>
        </div>`;
        lucide.createIcons();
        this._wzAutoNomor();
    },

    // ponytail: inisial perihal ("Penawaran Administrasi" → "PA"), maks 4 huruf
    _wzInitPA(text) {
        const w = String(text || '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
        return (w.map(x => x[0]).join('') || 'PA').toUpperCase().slice(0, 4);
    },

    _wzNomorPreview() {
        const comp = this.companies.find(c => c.id === this._wz.companyId) || {};
        const L = this._wz.letter;
        const paInput = (document.getElementById('wz-pa')?.value || '').toUpperCase().trim();
        L.pa = paInput || this._wzInitPA(document.getElementById('wz-perihal')?.value || L.perihal);
        L.sdg = (document.getElementById('wz-sdg')?.value || '').toUpperCase().trim();
        const tgl = document.getElementById('wz-tgl')?.value || L.tgl;
        const dt = new Date(tgl);
        const urut = L.urut ? String(L.urut).padStart(3, '0') : '___';
        const nomor = [urut, L.pa, L.sdg || '___', comp.singkatan || '___', this._roman(dt.getMonth() + 1), dt.getFullYear()].join('/');
        const el = document.getElementById('wz-nomor');
        if (el) el.value = nomor;
        return nomor;
    },

    _wzPerihalChange() {
        // ponytail: segmen manual menang; bila belum disentuh, ikut perihal
        if (!this._wz._paDirty) {
            const pa = this._wzInitPA(document.getElementById('wz-perihal')?.value);
            const paEl = document.getElementById('wz-pa');
            if (paEl) paEl.value = pa;
        }
        this._wzNomorPreview();
        this._wzAutoNomor();
    },

    _wzPaManual() {
        this._wz._paDirty = true;
        this._wzNomorPreview();
        this._wzAutoNomor();
    },

    // ponytail: popup kalender — muncul dekat ikon kalender bukan pojok layar
    _datePop(targetId) {
        document.getElementById('wz-datepop')?.remove();
        const target = document.getElementById(targetId);
        const show = document.getElementById('wz-tgl-show');
        const cur = target?.value ? new Date(target.value + 'T00:00:00') : new Date();
        const state = { y: cur.getFullYear(), m: cur.getMonth(), sel: target?.value || '' };
        const pop = document.createElement('div');
        pop.id = 'wz-datepop';
        pop.style.cssText = 'position:fixed; z-index:5000; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:12px; box-shadow:0 12px 32px rgba(0,0,0,.3); padding:14px; width:280px;';
        // ponytail: posisi dekat ikon kalender (tombol kanan dari input) bukan pojok
        const anchor = show || target;
        const r = anchor ? anchor.getBoundingClientRect() : { left: 100, bottom: 100, right: 380 };
        const popW = 280, popH = 300;
        let left = r.right - popW; // rata kanan dengan input
        if (left < 8) left = 8;
        if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
        let top = r.bottom + 4;
        if (top + popH > window.innerHeight - 8) top = r.top - popH - 4;
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';
        document.body.appendChild(pop);
        const draw = () => {
            const first = new Date(state.y, state.m, 1);
            const off = (first.getDay() + 6) % 7;
            const dim = new Date(state.y, state.m + 1, 0).getDate();
            const ml = first.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
            let cells = '';
            for (let i = 0; i < off; i++) cells += '<span></span>';
            for (let d = 1; d <= dim; d++) {
                const k = `${state.y}-${String(state.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const sel = k === state.sel;
                const today = k === new Date().toISOString().split('T')[0];
                cells += `<span data-d="${k}" style="display:flex; align-items:center; justify-content:center; height:32px; border-radius:8px; font-size:0.82rem; cursor:pointer; font-weight:${sel ? '800' : '400'}; background:${sel ? 'var(--accent)' : today ? 'var(--accent-bg)' : 'transparent'}; color:${sel ? '#fff' : 'var(--text-primary)'};">${d}</span>`;
            }
            pop.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                    <button class="btn btn-secondary btn-sm" data-nav="-1">‹</button>
                    <strong style="text-transform:capitalize; font-size:0.85rem;">${ml}</strong>
                    <button class="btn btn-secondary btn-sm" data-nav="1">›</button>
                </div>
                <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px; text-align:center; font-size:0.68rem; color:var(--text-muted); font-weight:700; margin-bottom:4px;">
                    ${['S', 'S', 'R', 'K', 'J', 'S', 'M'].map(w => `<span>${w}</span>`).join('')}
                </div>
                <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px;">${cells}</div>
                <button class="btn btn-secondary btn-sm" style="width:100%; margin-top:8px;" data-today="1">Hari ini</button>`;
            pop.querySelectorAll('[data-nav]').forEach(b => b.onclick = (e) => {
                e.stopPropagation();
                const dt = new Date(state.y, state.m + (+b.dataset.nav), 1);
                state.y = dt.getFullYear(); state.m = dt.getMonth(); draw();
            });
            pop.querySelector('[data-today]').onclick = (e) => { e.stopPropagation(); this._wzTglSet(new Date().toISOString().split('T')[0]); };
            pop.querySelectorAll('[data-d]').forEach(s => s.onclick = (e) => { e.stopPropagation(); this._wzTglSet(s.dataset.d); });
        };
        draw();
        setTimeout(() => {
            const off = (e) => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('pointerdown', off); } };
            document.addEventListener('pointerdown', off);
        }, 0);
    },

    _wzTglSet(v) {
        const h = document.getElementById('wz-tgl');
        const s = document.getElementById('wz-tgl-show');
        if (h) h.value = v;
        if (s && v) {
            const d = new Date(v + 'T00:00:00');
            s.value = isNaN(d) ? v : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        }
        document.getElementById('wz-datepop')?.remove();
        this._wzTglChange();
    },

    _wzTglChange() {
        const v = document.getElementById('wz-tgl')?.value;
        this._wzTglPretty();
        this._wzForm2dateOnly();
        this._wzAutoNomor();
    },

    _wzForm2dateOnly() {
        const v = document.getElementById('wz-tgl')?.value;
        if (!v) return;
        this._wz.letter.tgl = v;
        this._wzNomorPreview();
    },

    // ponytail: nomor auto-generate (debounce) setelah kode+perusahaan+tgl lengkap — tanpa tombol
    _wzAutoNomor() {
        clearTimeout(this._wzNomorT);
        this._wzNomorT = setTimeout(() => this._wzDoNomor(), 700);
    },

    async _wzDoNomor() {
        if (this._wz._nomorBusy) return;
        const comp = this.companies.find(c => c.id === this._wz.companyId) || {};
        if (!comp.id) return;
        const sdg = (document.getElementById('wz-sdg')?.value || '').toUpperCase().trim();
        if (!sdg) return;
        const perihal = document.getElementById('wz-perihal')?.value.trim() || 'Penawaran Administrasi';
        const paManual = (document.getElementById('wz-pa')?.value || '').toUpperCase().trim();
        const pa = paManual || this._wzInitPA(perihal);
        const tgl = document.getElementById('wz-tgl')?.value || new Date().toISOString().split('T')[0];
        const dt = new Date(tgl);
        const cur = document.getElementById('wz-nomor')?.value || '';
        this._wz._nomorBusy = true;
        try {
            const res = await API.getNextLetterNumber(comp.id, sdg, dt.getFullYear(), dt.getMonth() + 1, pa);
            // hanya timpa bila user belum mengunci nomor lain / masih placeholder
            const el = document.getElementById('wz-nomor');
            this._wz.letter.urut = res.data.nomor_urut;
            this._wz.letter.nomor = res.data.nomor_surat;
            this._wz.letter.pa = res.data.perihal_singkatan || pa;
            if (el && (!cur || cur.includes('___') || el.value === cur)) {
                el.value = res.data.nomor_surat;
                const eu = document.getElementById('wz-urut');
                if (eu) eu.value = String(res.data.nomor_urut).padStart(3, '0');
                const paEl = document.getElementById('wz-pa');
                if (paEl) paEl.value = this._wz.letter.pa;
            }
        } catch (e) { console.warn('Auto nomor:', e.message); }
        finally { this._wz._nomorBusy = false; }
    },

    _wzCollect2() {
        const L = this._wz.letter;
        L.perihal = document.getElementById('wz-perihal')?.value.trim() || 'Penawaran Administrasi';
        L.pa = this._wzInitPA(L.perihal);
        L.sdg = (document.getElementById('wz-sdg')?.value || '').toUpperCase().trim();
        L.lampiran = document.getElementById('wz-lampiran')?.value.trim() || 'Dokumen Penawaran';
        L.tgl = document.getElementById('wz-tgl')?.value || L.tgl;
        L.alamatDir = document.getElementById('wz-alamat-dir')?.value.trim() || '';
        L.nomor = document.getElementById('wz-nomor')?.value.trim() || '';
        if (!L.nomor || L.nomor.includes('___')) L.nomor = this._wzNomorPreview();
    },

    _wzCollect3() {
        Object.keys(this._wz.equip).forEach(async (id) => {
            const st = this._wz.equip[id];
            if (st && st.files === null) {
                try {
                    const res = await API.getEquipmentFiles(id);
                    st.files = (res.data || []).map(f => ({ url: f.file_url, label: f.label }));
                } catch {}
            }
        });
    },

    _wzCollect4() {
        ['pelaksana', 'k3'].forEach(role => {
            const r = this._wz[role];
            r.id = document.getElementById('wz-' + role)?.value || '';
            r.posisi = document.getElementById(`wz-${role}-posisi`)?.value.trim() || '';
            r.pendidikan = document.getElementById(`wz-${role}-pendidikan`)?.value.trim() || '';
            r.pengalaman = document.getElementById(`wz-${role}-pengalaman`)?.value.trim() || '0';
            r.ttl = document.getElementById(`wz-${role}-ttl`)?.value.trim() || '';
            const box = document.getElementById(`wz-${role}-exp`);
            const checked = box ? Array.from(box.querySelectorAll('input:checked')) : [];
            r.exp = checked.map(i => i.value);
            r.expNames = checked.map(i => i.closest('label')?.querySelector('strong')?.textContent || i.value);
        });
        this._wz.show = {
            direktur: document.getElementById('wz-show-direktur')?.checked ?? true,
            pelaksana: document.getElementById('wz-show-pelaksana')?.checked ?? true,
            k3: document.getElementById('wz-show-k3')?.checked ?? true,
            cap: document.getElementById('wz-show-cap')?.checked ?? true,
        };
        this._wz.capSize = parseInt(document.getElementById('wz-cap-size')?.value) || 0;
    },

    _wzCollect5() {
        const g = (id) => document.getElementById(id)?.value.trim() ?? '';
        this._wz.rkk = this._wz.rkk || {};
        this._wz.rkk.barisB1 = Number(document.getElementById('wz-rkk-b1-rows')?.value) || 1;
        this._wz.rkk.barisB2 = Number(document.getElementById('wz-rkk-b2-rows')?.value) || 1;
        this._wz.rkk.barisD2 = Number(document.getElementById('wz-rkk-d2-rows')?.value) || 1;
        this._wz.rkk.mungkin = Number(document.getElementById('wz-rkk-mungkin')?.value) || 1;
        this._wz.rkk.parah = Number(document.getElementById('wz-rkk-parah')?.value) || 1;
        const vars = {};
        document.querySelectorAll('[data-rkk-var]').forEach(inp => {
            const k = inp.dataset.rkkVar; const v = inp.value.trim();
            if (v !== '') vars[k] = v;
        });
        this._wz.rkk.vars = vars;
        const e1rows = [];
        document.querySelectorAll('.wz-rkk-e1-row').forEach((tr, i) => {
            const kegiatan = tr.querySelector('[data-e1="kegiatan"]')?.value.trim() || '';
            const pic = tr.querySelector('[data-e1="pic"]')?.value.trim() || '';
            const minggu = Array.from(tr.querySelectorAll('[data-e1="minggu"]')).map(cb => cb.checked ? 'x' : '');
            e1rows.push({ no: i + 1, kegiatan, pic, minggu });
        });
        this._wz.rkk.e1rows = e1rows.filter(r => r.kegiatan);
    },

    _wzForm5() {
        const pane = document.querySelector('.doc-wiz-pane[data-pane="5"]');
        if (!pane) return;
        const r = this._wz.rkk || {};
        const rowsB1 = r.barisB1 || 1, rowsB2 = r.barisB2 || 1, rowsD2 = r.barisD2 || 1;
        const vars = r.vars || {};
        const mkInp = (key, ph = '') =>
            '<input class="form-input" style="font-size:0.82rem;" data-rkk-var="' + key + '" value="' + Fmt.escape(vars[key] || '') + '" placeholder="' + Fmt.escape(ph) + '">';
        const mkRows = (n, prefix) => Array.from({ length: n }, (_, i) =>
            '<div style="display:grid;grid-template-columns:40px 1fr;gap:6px;align-items:center;margin-bottom:4px;">' +
            '<span style="font-size:0.75rem;color:var(--text-muted);text-align:center;font-weight:600;">' + (i + 1) + '</span>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' +
            '<input class="form-input" style="font-size:0.82rem;" data-rkk-var="' + prefix + '_b' + (i + 1) + '" placeholder="uraian pekerjaan baris ' + (i + 1) + '">' +
            '<input class="form-input" style="font-size:0.82rem;" data-rkk-var="identifikasi_b' + (i + 1) + '" placeholder="identifikasi bahaya baris ' + (i + 1) + '">' +
            '</div></div>').join('');
        const e1 = r.e1rows && r.e1rows.length ? r.e1rows : [
            { kegiatan: 'Inspeksi Keselamatan Konstruksi', pic: '{{posisi_k3}}', minggu: ['x', '', '', '', 'x', '', ''] },
            { kegiatan: 'Patroli Keselamatan Konstruksi', pic: '{{posisi_k3}}', minggu: ['x', 'x', 'x', 'x', 'x', 'x', 'x'] },
            { kegiatan: 'Audit Internal', pic: '{{posisi_k3}}', minggu: ['', 'x', '', 'x', '', 'x', ''] },
        ];
        const e1Html = this._wzRkkE1Html(e1);
        pane.innerHTML = '<div style="font-weight:700; margin-bottom:12px;">5. RKK <span style="font-weight:400; color:var(--text-muted); font-size:0.78rem;">— tabel B1/B2/D2/E1 (jumlah baris B1/B2/D2 bisa ditambah)</span></div>' +
        '<div style="border:1px solid var(--border-color); border-radius:8px; padding:10px 12px; margin-bottom:10px;">' +
        '<div style="font-size:0.85rem; font-weight:700; margin-bottom:8px;">Tabel B1 — Identifikasi Bahaya & Penilaian Risiko</div>' +
        '<div style="margin-top:10px;"><div class="form-row">' +
        '<div class="form-group" style="max-width:120px;"><label class="form-label">Jumlah baris</label><input type="number" min="1" max="50" class="form-input" id="wz-rkk-b1-rows" value="' + rowsB1 + '" onchange="DocumentsPage._wzRkkAddRows(\'b1\', this.value)"></div>' +
        '<div class="form-group"><label class="form-label">Persyaratan Pemenuhan Peraturan</label><input class="form-input" style="font-size:0.82rem;" data-rkk-var="syaratAturan" value="' + Fmt.escape(vars.syaratAturan || '') + '" placeholder="peraturan terkait"></div>' +
        '<div class="form-group"><label class="form-label">Pengendalian Awal</label><input class="form-input" style="font-size:0.82rem;" data-rkk-var="pengAwal" value="' + Fmt.escape(vars.pengAwal || '') + '" placeholder="pengendalian awal"></div>' +
        '<div class="form-group"><label class="form-label">Pengendalian Lanjutan</label><input class="form-input" style="font-size:0.82rem;" data-rkk-var="pengLanjut" value="' + Fmt.escape(vars.pengLanjut || '') + '" placeholder="pengendalian lanjutan"></div>' +
        '</div><div style="margin-top:8px;"><label class="form-label">Baris (No. | Uraian Pekerjaan | Identifikasi Bahaya | F | A)</label>' +
        '<div id="wz-rkk-b1-rows-wrap">' + mkRows(rowsB1, 'uraian') + '</div></div></div></div>' +
        '<div style="border:1px solid var(--border-color); border-radius:8px; padding:10px 12px; margin-bottom:10px;">' +
        '<div style="font-size:0.85rem; font-weight:700; margin-bottom:8px;">Tabel B2 — Program Pengendalian Risiko</div>' +
        '<div style="margin-top:10px;"><div class="form-row"><div class="form-group" style="max-width:120px;"><label class="form-label">Jumlah baris</label><input type="number" min="1" max="50" class="form-input" id="wz-rkk-b2-rows" value="' + rowsB2 + '" onchange="DocumentsPage._wzRkkAddRows(\'b2\', this.value)"></div></div>' +
        '<div style="display:grid;gap:6px;">' + [1,2,3,4,5,6,7,8,9].map(n =>
            '<div class="form-group" style="margin:0;"><label class="form-label" style="font-size:0.75rem;">Kolom ' + n + ' (isi_b2_' + n + ')</label>' +
            '<input class="form-input" style="font-size:0.82rem;" data-rkk-var="isi_b2_' + n + '" value="' + Fmt.escape(vars['isi_b2_' + n] || '') + '" placeholder="isi kolom ' + n + '"></div>').join('') +
        '</div></div></div>' +
        '<div style="border:1px solid var(--border-color); border-radius:8px; padding:10px 12px; margin-bottom:10px;">' +
        '<div style="font-size:0.85rem; font-weight:700; margin-bottom:8px;">Tabel D2 — Langkah Pekerjaan & Pengendalian</div>' +
        '<div style="margin-top:10px;"><div class="form-row">' +
        '<div class="form-group" style="max-width:120px;"><label class="form-label">Jumlah baris</label><input type="number" min="1" max="50" class="form-input" id="wz-rkk-d2-rows" value="' + rowsD2 + '" onchange="DocumentsPage._wzRkkAddRows(\'d2\', this.value)"></div>' +
        '<div class="form-group"><label class="form-label">Pengendalian</label><input class="form-input" style="font-size:0.82rem;" data-rkk-var="pengD2" value="' + Fmt.escape(vars.pengD2 || '') + '" placeholder="pengendalian"></div>' +
        '<div class="form-group"><label class="form-label">Penanggung Jawab</label><input class="form-input" style="font-size:0.82rem;" data-rkk-var="pjD2" value="' + Fmt.escape(vars.pjD2 || '') + '" placeholder="penanggung jawab"></div>' +
        '</div><div style="margin-top:8px;"><label class="form-label">Baris (No. | Uraian | Identifikasi)</label>' +
        '<div id="wz-rkk-d2-rows-wrap">' + mkRows(rowsD2, 'uraian') + '</div></div></div></div>' +
        '<div style="border:1px solid var(--border-color); border-radius:8px; padding:10px 12px; margin-bottom:10px;">' +
        '<div style="font-size:0.85rem; font-weight:700; margin-bottom:8px;">Tabel E1 — Jadwal Kegiatan Keselamatan</div>' +
        '<div style="margin-top:10px;"><div id="wz-rkk-e1-wrap">' + e1Html + '</div>' +
        '<button type="button" class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="DocumentsPage._wzRkkE1Add()">+ Tambah Kegiatan</button></div></div>' +
        '<div class="form-row" style="margin-top:8px;"><div class="form-group"><label class="form-label">Kemungkinan default (F)</label><input type="number" min="1" max="5" class="form-input" id="wz-rkk-mungkin" value="' + (r.mungkin || 1) + '"></div>' +
        '<div class="form-group"><label class="form-label">Keparahan default (A)</label><input type="number" min="1" max="5" class="form-input" id="wz-rkk-parah" value="' + (r.parah || 1) + '"></div></div>' +
        '<div style="margin-top:16px; border-top:1px solid var(--border-color); padding-top:12px;">' +
        '<div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Preview Tabel RKK (dari data tender + #rkk)</div>' +
        '<div id="wz-rkk-preview-b1" style="margin-bottom:10px; border:1px solid var(--border-color); border-radius:8px; padding:8px; overflow:auto; max-height:360px; background:var(--bg-secondary);"><span style="color:var(--text-muted); font-size:0.8rem;">Memuat B1...</span></div>' +
        '<div id="wz-rkk-preview-b2" style="margin-bottom:10px; border:1px solid var(--border-color); border-radius:8px; padding:8px; overflow:auto; max-height:360px; background:var(--bg-secondary);"><span style="color:var(--text-muted); font-size:0.8rem;">Memuat B2...</span></div>' +
        '<div id="wz-rkk-preview-d2" style="margin-bottom:10px; border:1px solid var(--border-color); border-radius:8px; padding:8px; overflow:auto; max-height:360px; background:var(--bg-secondary);"><span style="color:var(--text-muted); font-size:0.8rem;">Memuat D2...</span></div>' +
        '<div id="wz-rkk-preview-e1" style="margin-bottom:10px; border:1px solid var(--border-color); border-radius:8px; padding:8px; overflow:auto; max-height:360px; background:var(--bg-secondary);"><span style="color:var(--text-muted); font-size:0.8rem;">Memuat E1...</span></div>' +
        '</div>';
        lucide.createIcons();
        this._wzRkkLoadPreview();
    },

    _wzRkkE1Html(rows) {
        return '<table class="mini-table" style="font-size:0.78rem;"><thead><tr>' +
            '<th style="width:32px;">No</th><th>Kegiatan</th><th style="width:150px;">PIC</th>' +
            '<th style="width:24px;">1</th><th style="width:24px;">2</th><th style="width:24px;">3</th><th style="width:24px;">4</th><th style="width:24px;">5</th><th style="width:24px;">6</th><th style="width:24px;">7</th><th style="width:44px;"></th></tr></thead><tbody>' +
            rows.map((r2, i) => '<tr class="wz-rkk-e1-row">' +
                '<td style="text-align:center;">' + (i + 1) + '</td>' +
                '<td><input class="form-input" style="font-size:0.78rem;" data-e1="kegiatan" value="' + Fmt.escape(r2.kegiatan || '') + '"></td>' +
                '<td><input class="form-input" style="font-size:0.78rem;" data-e1="pic" value="' + Fmt.escape(r2.pic || '{{posisi_k3}}') + '"></td>' +
                (r2.minggu || []).map(m => '<td style="text-align:center;"><input type="checkbox" data-e1="minggu" ' + (m === 'x' ? 'checked' : '') + ' style="accent-color:var(--accent);"></td>').join('') +
                '<td style="text-align:center;"><button type="button" class="btn btn-danger btn-sm" style="padding:2px 6px;" onclick="this.closest(\'tr\').remove(); DocumentsPage._wzRkkE1Renumber();">×</button></td>' +
                '</tr>').join('') + '</tbody></table>';
    },

    async _wzRkkLoadPreview() {
        try {
            const settings = await API.getSettings();
            const s = settings.data || {};
            const r = this._wz.rkk || {};
            const vars = r.vars || {};
            const b1 = Number(r.barisB1) || Number(s.rkk_baris_b1) || 1;
            const b2 = Number(r.barisB2) || Number(s.rkk_baris_b2) || 1;
            const d2 = Number(r.barisD2) || 1;
            const mungkin = Number(s.rkk_default_mungkin) || 1;
            const parah = Number(s.rkk_default_parah) || 1;
            const ambang = { kecil: Number(s.rkk_ambang_kecil) || 4, sedang: Number(s.rkk_ambang_sedang) || 12, besar: Number(s.rkk_ambang_besar) || 25 };
            const e1rows = (r.e1rows && r.e1rows.length) ? r.e1rows : [
                { kegiatan: 'Inspeksi Keselamatan Konstruksi', pic: '{{posisi_k3}}', minggu: ['x', '', '', '', 'x', '', ''] },
                { kegiatan: 'Patroli Keselamatan Konstruksi', pic: '{{posisi_k3}}', minggu: ['x', 'x', 'x', 'x', 'x', 'x', 'x'] },
                { kegiatan: 'Audit Internal', pic: '{{posisi_k3}}', minggu: ['', 'x', '', 'x', '', 'x', ''] },
            ];
            const [h1, h2, h3, h4] = await Promise.all([
                API.request('/rkk/preview', { method: 'POST', body: { tabel: 'b1', html: s.rkk_tabel_b1 || '', baris: b1, mungkin, parah, ambang, vars } }),
                API.request('/rkk/preview', { method: 'POST', body: { tabel: 'b2', html: s.rkk_tabel_b2 || '', baris: b2, mungkin, parah, ambang, vars } }),
                API.request('/rkk/preview', { method: 'POST', body: { tabel: 'd2', html: s.rkk_tabel_d2 || '', baris: d2, mungkin, parah, ambang, vars } }),
                API.request('/rkk/preview', { method: 'POST', body: { tabel: 'e1', html: s.rkk_tabel_e1 || '', baris: 1, mungkin, parah, ambang, vars: { ...vars, _e1rows: e1rows } } }),
            ]);
            const el1 = document.getElementById('wz-rkk-preview-b1'); if (el1) el1.innerHTML = (h1.data?.html || '<span style="color:var(--text-muted);">Tidak tersedia</span>');
            const el2 = document.getElementById('wz-rkk-preview-b2'); if (el2) el2.innerHTML = (h2.data?.html || '<span style="color:var(--text-muted);">Tidak tersedia</span>');
            const el3 = document.getElementById('wz-rkk-preview-d2'); if (el3) el3.innerHTML = (h3.data?.html || '<span style="color:var(--text-muted);">Tidak tersedia</span>');
            const el4 = document.getElementById('wz-rkk-preview-e1'); if (el4) el4.innerHTML = (h4.data?.html || '<span style="color:var(--text-muted);">Tidak tersedia</span>');
        } catch (e) {
            console.warn('[RKK preview] gagal:', e.message);
        }
    },

    _wzRkkE1Add() {
        const wrap = document.getElementById('wz-rkk-e1-wrap');
        if (!wrap) return;
        const tbody = wrap.querySelector('tbody');
        if (!tbody) return;
        const tr = document.createElement('tr');
        tr.className = 'wz-rkk-e1-row';
        tr.innerHTML = '<td style="text-align:center;">' + (tbody.children.length + 1) + '</td>' +
            '<td><input class="form-input" style="font-size:0.78rem;" data-e1="kegiatan" placeholder="nama kegiatan"></td>' +
            '<td><input class="form-input" style="font-size:0.78rem;" data-e1="pic" value="{{posisi_k3}}"></td>' +
            Array(7).fill('').map(() => '<td style="text-align:center;"><input type="checkbox" data-e1="minggu" style="accent-color:var(--accent);"></td>').join('') +
            '<td style="text-align:center;"><button type="button" class="btn btn-danger btn-sm" style="padding:2px 6px;" onclick="DocumentsPage._wzRkkE1Del(this)">×</button></td>';
        tbody.appendChild(tr);
    },

    _wzRkkE1Del(btn) { btn.closest('tr').remove(); this._wzRkkE1Renumber(); },


    _wzRkkE1Del(btn) { btn.closest('tr').remove(); this._wzRkkE1Renumber(); },
    _wzRkkE1Renumber() {
        const rows = document.querySelectorAll('.wz-rkk-e1-row');
        rows.forEach((tr, i) => { const td = tr.querySelector('td'); if (td) td.textContent = i + 1; });
    },

    _wzRkkAddRows(kind, n) {
        const n2 = Math.max(1, parseInt(n, 10) || 1);
        if (kind === 'b1') {
            const wrap = document.getElementById('wz-rkk-b1-rows-wrap');
            if (wrap) wrap.innerHTML = Array.from({ length: n2 }, (_, i) =>
                '<div style="display:grid;grid-template-columns:40px 1fr;gap:6px;align-items:center;margin-bottom:4px;">' +
                '<span style="font-size:0.75rem;color:var(--text-muted);text-align:center;font-weight:600;">' + (i + 1) + '</span>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' +
                '<input class="form-input" style="font-size:0.82rem;" data-rkk-var="uraian_b' + (i + 1) + '" placeholder="uraian pekerjaan baris ' + (i + 1) + '">' +
                '<input class="form-input" style="font-size:0.82rem;" data-rkk-var="identifikasi_b' + (i + 1) + '" placeholder="identifikasi bahaya baris ' + (i + 1) + '">' +
                '</div></div>').join('');
        } else if (kind === 'd2') {
            const wrap = document.getElementById('wz-rkk-d2-rows-wrap');
            if (wrap) wrap.innerHTML = Array.from({ length: n2 }, (_, i) =>
                '<div style="display:grid;grid-template-columns:40px 1fr;gap:6px;align-items:center;margin-bottom:4px;">' +
                '<span style="font-size:0.75rem;color:var(--text-muted);text-align:center;font-weight:600;">' + (i + 1) + '</span>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' +
                '<input class="form-input" style="font-size:0.82rem;" data-rkk-var="uraian_b' + (i + 1) + '" placeholder="uraian pekerjaan baris ' + (i + 1) + '">' +
                '<input class="form-input" style="font-size:0.82rem;" data-rkk-var="identifikasi_b' + (i + 1) + '" placeholder="identifikasi bahaya baris ' + (i + 1) + '">' +
                '</div></div>').join('');
        }
    },

    _wzReview() {
        const box = document.getElementById('doc-review-box');
        if (!box) return;
        const t = this._wz.tender || {};
        const comp = this.companies.find(c => c.id === this._wz.companyId) || {};
        const L = this._wz.letter;
        const nm = id => (this.personnel.find(p => p.id === id) || {}).nama || '-';
        const row = (k, v) => `<div style="display:flex; gap:8px; font-size:0.85rem; padding:6px 0; border-bottom:1px solid var(--border-color);"><span style="width:150px; color:var(--text-muted); flex-shrink:0;">${k}</span><strong>${v}</strong></div>`;
        box.innerHTML =
            row('Paket', Fmt.escape(t.nama_tender || t.nama_paket || '-')) +
            row('Perusahaan', Fmt.escape(comp.nama_perusahaan || '-') + (comp.kbli ? ` (KBLI ${Fmt.escape(comp.kbli)})` : '')) +
            row('Nomor surat', Fmt.escape(L.nomor || '-')) +
            row('Peralatan', Object.keys(this._wz.equip).length + ' alat dipilih') +
            row('Pelaksana', Fmt.escape(nm(this._wz.pelaksana.id)) + ` (${(this._wz.pelaksana.exp || []).length} riwayat)`) +
            row('K3', Fmt.escape(nm(this._wz.k3.id)) + ` (${(this._wz.k3.exp || []).length} riwayat)`) +
            `<div style="display:flex; align-items:center; gap:10px; margin-top:12px; padding:10px 12px; border:1px solid var(--border); border-radius:8px; background:var(--bg-tertiary);">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin:0; flex:1;">
                    <input type="checkbox" id="wz-scan-effect" ${this._wz.scanEffect ? 'checked' : ''} onchange="DocumentsPage.wzScanToggle(this.checked)" style="width:16px;height:16px;accent-color:var(--accent);">
                    <span>
                        <span style="display:block;font-size:0.85rem;color:var(--text-primary);">Efek dokumen seperti hasil pindai</span>
                        <span style="display:block;font-size:0.72rem;color:var(--text-muted);margin-top:2px;">Berlaku untuk semua dokumen di batch ini (surat, alat, personil). Teks PDF jadi tidak bisa dicari/copy.</span>
                    </span>
                </label>
            </div>`;
    },

    // toggle efek scan (diterapkan ke SEMUA dokumen di batch)
    wzScanToggle(on) {
        this._wz.scanEffect = !!on;
    },

    async wzGenerate() {
        const btn = document.getElementById('doc-generate-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Mempersiapkan...'; }
        try {
            const comp = this.companies.find(c => c.id === this._wz.companyId) || {};
            const t = this._wz.tender || {};
            const L = this._wz.letter;
            const tpl04 = (this.templates.find(x => /04 surat/i.test(x.nama_template)) || this.templates[0] || {});
            if (!tpl04.id) throw new Error('Template 04 surat belum ada');
            // ponytail: file alat TIDAK ikut 04 surat — hanya nempel di dokumen 01 alat
            const equipAtts = [];
            for (const eqId of Object.keys(this._wz.equip)) {
                try {
                    const res = await API.getEquipmentFiles(eqId);
                    const e = (this.equipments || []).find(x => x.id === eqId) || {};
                    (res.data || []).forEach(f => equipAtts.push({ name: `${e.jenis || 'Alat'} — ${f.label || 'lampiran'}`, url: f.file_url }));
                    if (e.file_url) equipAtts.push({ name: `${e.jenis || 'Alat'} — berkas`, url: e.file_url });
                } catch {}
            }
            const expUrls = [];
            for (const role of ['pelaksana', 'k3']) {
                const r = this._wz[role];
                if (!r.id || !r.exp?.length) continue;
                try {
                    const det = await API.getPersonnelById(r.id);
                    (det.data?.experience_history || []).filter(x => r.exp.includes(String(x.id)))
                        .forEach(x => { if (x.surat_referensi_url) expUrls.push({ name: `Referensi — ${x.nama_kegiatan || ''}`, url: x.surat_referensi_url }); });
                } catch {}
            }
            const V = this._wz.vars;
            const pelObj = this.personnel.find(p => p.id === this._wz.pelaksana.id) || {};
            const k3Obj = this.personnel.find(p => p.id === this._wz.k3.id) || {};
            const vars = {
                ...V,
                nomor_surat: L.nomor, nomor_surat_penawaran: L.nomor,
                perihal: L.perihal, perihal_penawaran: L.perihal,
                lampiran: L.lampiran, tanggal: L.tgl,
                direktur: comp.direktur || '', alamat_direktur: L.alamatDir || comp.alamat_direktur || comp.alamat || '',
                nama_perusahaan: comp.nama_perusahaan || '',
                nama_pelaksana: pelObj.nama || '',
                posisi_pelaksana: this._wz.pelaksana.posisi || '', alamat_pelaksana: pelObj.alamat || '-',
                nama_k3: k3Obj.nama || '',
                posisi_k3: this._wz.k3.posisi || '', alamat_k3: k3Obj.alamat || '-',
            };
            const payload = {
                company_id: comp.id, template_ids: [tpl04.id],
                tender_id: t.id || t.kode_tender || null,
                signer2_id: this._wz.pelaksana.id || null, signer3_id: this._wz.k3.id || null,
                signer2_data: { jabatan: this._wz.pelaksana.posisi || undefined },
                signer3_data: { jabatan: this._wz.k3.posisi || undefined },
                show: this._wz.show, cap_opts: { ...(this._wz.capSize ? { size: this._wz.capSize } : {}) },
                personil_ids: [this._wz.pelaksana.id, this._wz.k3.id].filter(Boolean),
                equipment_ids: Object.keys(this._wz.equip),
                vars, with_cap_ttd: V.withTtd !== false,
                // checkbox DOM = sumber kebenaran (bela-bela kalau handler-nya gagal)
                scan_effect: (document.getElementById('wz-scan-effect')?.checked) ?? !!this._wz.scanEffect,
                attachments: expUrls,
                variables: {
                    batch_id: (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)),
                    company_id: comp.id, tender: { kode: t.kode_tender, nama: t.nama_tender || t.nama_paket },
                    vars, letter: L, equipIds: Object.keys(this._wz.equip),
                    pelaksana: { ...this._wz.pelaksana, nama: pelObj.nama || '' },
                    k3: { ...this._wz.k3, nama: k3Obj.nama || '' },
                    show: this._wz.show, capPos: 'auto-bergantian',
                },
            };
            // ponytail: 01 alat & 02 personil = dokumen terpisah; file lampiran alat hanya nempel di 01 alat
            // TTD direktur/cap ikut form wizard (with_cap_ttd + show.direktur) — template kini punya {{ttd_direktur}}
            const jobs = [{ label: '04 surat', payload }];
            const tpl01 = this.templates.find(x => /01 alat/i.test(x.nama_template));
            if (tpl01?.id && payload.equipment_ids.length) {
                jobs.push({ label: '01 alat', payload: {
                    ...payload, template_ids: [tpl01.id],
                    signer2_id: null, signer3_id: null, signer2_data: undefined, signer3_data: undefined,
                    personil_ids: [], attachments: equipAtts,
                } });
            }
            const tpl02 = this.templates.find(x => /02 personil/i.test(x.nama_template));
            if (tpl02?.id && payload.personil_ids.length) {
                jobs.push({ label: '02 personil', payload: {
                    ...payload, template_ids: [tpl02.id],
                    signer2_id: null, signer3_id: null, signer2_data: undefined, signer3_data: undefined,
                    equipment_ids: [], attachments: [],
                } });
            }
            // 03 RKK — selalu ikut batch; isian dari tab RKK (B1/B2/D2/E1) + baris dinamis
            const tpl03 = this.templates.find(x => /03 ?rkk/i.test(x.nama_template));
            if (tpl03?.id) {
                const rk = this._wz.rkk || {};
                jobs.push({ label: '03 RKK', payload: {
                    ...payload, template_ids: [tpl03.id],
                    signer2_id: null, signer3_id: null, signer2_data: undefined, signer3_data: undefined,
                    equipment_ids: [], attachments: [],
                    vars: { ...vars, ...(rk.vars || {}),
                        rkk_baris_b1: rk.barisB1 || 1, rkk_baris_b2: rk.barisB2 || 1, rkk_baris_d2: rk.barisD2 || 1,
                        ...(rk.e1rows?.length ? { rkk_e1rows: rk.e1rows } : {}) },
                } });
            }
            const dt = new Date(L.tgl);
            if (L.urut && L.sdg) {
                await API.createLetter({
                    company_id: comp.id, nomor_urut: L.urut, kode_surat: L.sdg,
                    bulan: dt.getMonth() + 1, tahun: dt.getFullYear(), nomor_surat: L.nomor,
                    perihal: L.perihal, tanggal: L.tgl, perihal_singkatan: L.pa,
                    konten: JSON.stringify({ template: tpl04.id }), template_id: tpl04.id,
                }).catch(e => console.warn('Simpan nomor:', e.message));
            }
            // ponytail: tutup modal lalu generate jalan di background — tab bisa ditinggal, tanpa lag
            Modal.close();
            Toast.sticky('⏳ Merender PDF... bisa navigasi ke halaman lain, dokumen muncul saat selesai.');
            this._runGenerateBg(jobs);
        } catch (e) {
            Toast.error(e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = 'Generate PDF'; }
        }
    },

    // ponytail: generate di background — 1 job gagal TIDAK membatalkan sisanya; laporan per-dokumen
    async _runGenerateBg(jobs) {
        const list = Array.isArray(jobs) ? jobs : [{ label: 'PDF', payload: jobs }];
        const outs = [], fails = [];
        for (const j of list) {
            try {
                const res = await API.generateDocument(j.payload);
                outs.push({ label: j.label, d: res.data });
                if (res.data?.scan_error) Toast.warning(`${j.label}: efek scan GAGAL (${res.data.scan_error}) — PDF tetap normal`);
            } catch (e) {
                fails.push(`${j.label}: ${e.message}`);
                Toast.error(`${j.label} gagal: ${e.message}`);
            }
        }
        if (outs.length) {
            Toast.success(outs.map(o => `✅ ${o.label} (${o.d.pages} hal.) — <a href="${o.d.url}" target="_blank" style="color:var(--accent); font-weight:700;">Unduh</a>`).join('<br>')
                + (fails.length ? `<br><span style="color:var(--warning); font-weight:700;">⚠ gagal: ${fails.length}</span>` : ''));
            this.loadRecords();
        } else if (fails.length) Toast.error('Generate gagal: ' + fails.join('; '));
    },

    // ── FORM 3: 01 alat (tabel + pagination + ceklis + lampiran per alat) ──
    _wzEqPage: 1,
    _wzEqPerPage: 5,
    _wzForm3() {
        const pane = document.querySelector('.doc-wiz-pane[data-pane="3"]');
        pane.innerHTML = `
        <div style="font-weight:700; margin-bottom:4px;">3. Peralatan <span style="font-weight:400; color:var(--text-muted); font-size:0.78rem;">— ceklis yang dipakai • klik nilai untuk ubah langsung</span></div>
        <div class="table-container" style="overflow-x:auto;"><table class="mini-table"><thead><tr>
            <th style="width:36px; text-align:center;"><input type="checkbox" onchange="DocumentsPage._wzEqAll(this.checked)" style="accent-color:var(--accent);"></th>
            <th>Jenis</th><th>Kapasitas</th><th style="width:64px;">Jumlah</th><th style="width:70px;">Tahun</th><th>Merk/Type</th><th style="width:110px;">Kondisi</th><th>Lokasi</th><th>Bukti</th><th style="width:64px;">File</th><th style="width:36px; text-align:center;"><input type="checkbox" onchange="DocumentsPage._wzEqAll(this.checked)" style="accent-color:var(--accent);" title="Pilih semua"></th>
        </tr></thead><tbody id="wz-eq-body"></tbody></table></div>
        <div id="wz-eq-pager" style="display:flex; gap:8px; align-items:center; margin-top:8px; font-size:0.8rem;"></div>
        <div id="wz-eq-files" style="margin-top:8px;"></div>
        <details style="margin-top:10px; border:1px dashed var(--border-color); border-radius:8px; padding:10px 12px;">
            <summary style="cursor:pointer; font-size:0.82rem; font-weight:700;">+ Input alat manual (di luar daftar)</summary>
            <div style="display:grid; grid-template-columns:2fr 1fr 1fr 1fr 1fr; gap:8px; margin-top:8px;">
                <input class="form-input" id="wz-eqm-jenis" placeholder="Jenis alat *">
                <select class="form-select" id="wz-eqm-pt"><option value="">PT...</option>${(this.companies || []).map(c => `<option value="${c.id}">${Fmt.escape(c.singkatan || c.nama_perusahaan)}</option>`).join('')}</select>
                <input class="form-input" id="wz-eqm-kap" placeholder="Kapasitas">
                <input class="form-input" id="wz-eqm-satuan" placeholder="Satuan">
                <input type="number" class="form-input" id="wz-eqm-jumlah" placeholder="Jumlah">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr 1fr; gap:8px; margin-top:8px;">
                <input type="number" class="form-input" id="wz-eqm-tahun" placeholder="Tahun">
                <input class="form-input" id="wz-eqm-merk" placeholder="Merk/Type">
                <select class="form-select" id="wz-eqm-kondisi"><option value="Baik">Baik</option><option value="Rusak Ringan">Rusak Ringan</option><option value="Rusak Berat">Rusak Berat</option></select>
                <input class="form-input" id="wz-eqm-lokasi" placeholder="Lokasi">
                <input class="form-input" id="wz-eqm-bukti" placeholder="Bukti (milik/sewa)">
            </div>
            <div style="display:flex; gap:8px; margin-top:8px; align-items:center; flex-wrap:wrap;">
                <label class="form-label" style="margin:0;">Berkas:</label>
                <input type="file" class="form-input" id="wz-eqm-file" accept="image/*,.pdf" style="flex:1; min-width:160px;">
                <button class="btn btn-secondary btn-sm" onclick="DocumentsPage._wzEqManual()">Tambah & Ceklis</button>
            </div>
        </details>`;
        this._wzEqPage = 1;
        this._wzRenderEq();
    },

    _wzEqKap(e) {
        if (e.kapasitas_angka != null || e.kapasitas_satuan) return `${e.kapasitas_angka ?? ''} ${e.kapasitas_satuan || ''}`.trim();
        return e.kapasitas || '-';
    },

    _wzRenderEq() {
        const body = document.getElementById('wz-eq-body');
        const pager = document.getElementById('wz-eq-pager');
        if (!body) return;
        const list = this.equipments || [];
        const pages = Math.max(1, Math.ceil(list.length / this._wzEqPerPage));
        this._wzEqPage = Math.min(Math.max(1, this._wzEqPage), pages);
        const start = (this._wzEqPage - 1) * this._wzEqPerPage;
        body.innerHTML = list.slice(start, start + this._wzEqPerPage).map(e => {
            const sel = this._wz.equip[e.id];
            const kapA = e.kapasitas_angka ?? '';
            const kapS = e.kapasitas_satuan ?? '';
            const inp = 'font-size:0.78rem; padding:3px 6px;';
            return `<tr>
                <td style="text-align:center;"><input type="checkbox" ${sel ? 'checked' : ''} onchange="DocumentsPage._wzEqToggle('${e.id}', this.checked)" style="accent-color:var(--accent); width:16px; height:16px;"></td>
                <td><strong>${Fmt.escape(e.jenis)}</strong></td>
                <td style="white-space:nowrap;"><input class="form-input" style="${inp} width:56px; display:inline-block;" value="${kapA}" onchange="DocumentsPage._wzEqEdit('${e.id}','kapA',this.value)" title="Angka kapasitas"> <input class="form-input" style="${inp} width:56px; display:inline-block;" value="${Fmt.escape(kapS)}" onchange="DocumentsPage._wzEqEdit('${e.id}','kapS',this.value)" title="Satuan (m³/cc/ton...)"></td>
                <td><input type="number" class="form-input" style="${inp} width:56px;" value="${e.jumlah ?? ''}" onchange="DocumentsPage._wzEqEdit('${e.id}','jumlah',this.value)"></td>
                <td><input type="number" class="form-input" style="${inp} width:64px;" value="${e.tahun_produksi ?? ''}" onchange="DocumentsPage._wzEqEdit('${e.id}','tahun',this.value)"></td>
                <td><input class="form-input" style="${inp} min-width:90px;" value="${Fmt.escape(e.merk_type || '')}" onchange="DocumentsPage._wzEqEdit('${e.id}','merk',this.value)"></td>
                <td><select class="form-select" style="${inp}" onchange="DocumentsPage._wzEqEdit('${e.id}','kondisi',this.value)">
                    ${['Baik', 'Rusak Ringan', 'Rusak Berat'].map(k => `<option ${e.kondisi === k ? 'selected' : ''}>${k}</option>`).join('')}</select></td>
                <td><input class="form-input" style="${inp} min-width:90px;" value="${Fmt.escape(e.lokasi_sekarang || '')}" onchange="DocumentsPage._wzEqEdit('${e.id}','lokasi',this.value)"></td>
                <td><small>${Fmt.escape(e.bukti_kepemilikan || '-')}</small></td>
                <td style="text-align:center;"><button class="btn btn-secondary btn-sm" onclick="DocumentsPage._wzEqFiles('${e.id}')">📎 <span id="wz-eq-n-${e.id}">${sel?.files ? sel.files.length : '…'}</span></button></td>
                <td style="text-align:center;"><input type="checkbox" ${sel ? 'checked' : ''} onchange="DocumentsPage._wzEqToggle('${e.id}', this.checked)" style="accent-color:var(--accent); width:16px; height:16px;" title="Pilih alat ini"></td>
            </tr>`;
        }).join('') || '<tr><td colspan="11" class="text-center">Belum ada data peralatan</td></tr>';
        pager.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="DocumentsPage._wzEqGo(-1)" ${this._wzEqPage <= 1 ? 'disabled' : ''}>‹</button>
            <span style="color:var(--text-muted);">Hal ${this._wzEqPage}/${pages} • ${list.length} alat • ${Object.keys(this._wz.equip).length} dipilih</span>
            <button class="btn btn-secondary btn-sm" onclick="DocumentsPage._wzEqGo(1)" ${this._wzEqPage >= pages ? 'disabled' : ''}>›</button>`;
        lucide.createIcons();
    },

    _wzEqGo(d) { this._wzEqPage += d; this._wzRenderEq(); },

    // ponytail: alat manual → simpan ke master lalu ceklis otomatis
    async _wzEqManual() {
        const jenis = document.getElementById('wz-eqm-jenis')?.value.trim();
        if (!jenis) { Toast.warning('Isi jenis alat'); return; }
        const kapA = parseFloat(String(document.getElementById('wz-eqm-kap')?.value || '').replace(',', '.')) || null;
        const kapS = document.getElementById('wz-eqm-satuan')?.value.trim() || null;
        try {
            const res = await API.createEquipment({
                jenis,
                company_id: document.getElementById('wz-eqm-pt')?.value || null,
                kapasitas: [kapA, kapS].filter(Boolean).join(' ') || null,
                kapasitas_angka: kapA, kapasitas_satuan: kapS,
                jumlah: parseInt(document.getElementById('wz-eqm-jumlah')?.value) || null,
                tahun_produksi: parseInt(document.getElementById('wz-eqm-tahun')?.value) || null,
                merk_type: document.getElementById('wz-eqm-merk')?.value.trim() || null,
                kondisi: document.getElementById('wz-eqm-kondisi')?.value || 'Baik',
                lokasi_sekarang: document.getElementById('wz-eqm-lokasi')?.value.trim() || null,
                bukti_kepemilikan: document.getElementById('wz-eqm-bukti')?.value.trim() || null,
            });
            const item = res.data || res;
            // ponytail: berkas manual ikut terunggah + tercatat sebagai lampiran alat
            const fInput = document.getElementById('wz-eqm-file');
            if (fInput?.files?.length) {
                try {
                    Toast.info('Mengunggah berkas...');
                    const up = await API.uploadFile(fInput.files[0], 'equipment');
                    await API.addEquipmentFile(item.id, { label: fInput.files[0].name, file_url: up.url });
                } catch (e) { Toast.error('Berkas gagal: ' + e.message); }
            }
            this.equipments = [...(this.equipments || []), item];
            this._wz.equip[item.id] = { files: null };
            this._wzEqPage = Math.ceil(this.equipments.length / this._wzEqPerPage);
            this._wzRenderEq();
            ['wz-eqm-jenis', 'wz-eqm-pt', 'wz-eqm-kap', 'wz-eqm-satuan', 'wz-eqm-jumlah', 'wz-eqm-tahun', 'wz-eqm-merk', 'wz-eqm-lokasi', 'wz-eqm-bukti', 'wz-eqm-file'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
            Toast.success('Alat ditambahkan & diceklis');
        } catch (e) { Toast.error(e.message); }
    },

    // ponytail: edit nilai langsung di tabel form → update master (sumber tunggal, tanpa duplikasi)
    async _wzEqEdit(id, field, value) {
        const map = { kapA: 'kapasitas_angka', kapS: 'kapasitas_satuan', jumlah: 'jumlah', tahun: 'tahun_produksi', merk: 'merk_type', kondisi: 'kondisi', lokasi: 'lokasi_sekarang' };
        const col = map[field];
        if (!col) return;
        let v = value;
        if (field === 'kapA') v = value === '' ? null : parseFloat(String(value).replace(',', '.')) || null;
        if (field === 'jumlah' || field === 'tahun') v = value === '' ? null : parseInt(value) || null;
        if (field === 'kapS' || field === 'merk' || field === 'lokasi') v = String(value).trim() || null;
        try {
            const e = (this.equipments || []).find(x => x.id === id) || {};
            const patch = { [col]: v };
            if (field === 'kapA' || field === 'kapS') {
                const a = field === 'kapA' ? v : e.kapasitas_angka;
                const s = field === 'kapS' ? v : e.kapasitas_satuan;
                patch.kapasitas = [a, s].filter(x => x !== null && x !== '').join(' ') || null;
            }
            const res = await API.updateEquipment(id, patch);
            Object.assign(e, res.data || patch);
        } catch (err) { Toast.error(err.message); this._wzRenderEq(); }
    },

    _wzEqAll(on) {
        (this.equipments || []).forEach(e => {
            if (on) { if (!this._wz.equip[e.id]) this._wz.equip[e.id] = { files: null }; }
            else delete this._wz.equip[e.id];
        });
        // ceklis ganda (kiri+kanan) — sinkronkan dua header
        document.querySelectorAll('.doc-wiz-pane[data-pane="3"] thead input[type="checkbox"]').forEach(c => { c.checked = on; });
        this._wzRenderEq();
    },

    _wzEqToggle(id, on) {
        if (on) { if (!this._wz.equip[id]) this._wz.equip[id] = { files: null }; }
        else delete this._wz.equip[id];
        // ceklis ganda (kiri+kanan) — samakan pasangan pada baris yang sama
        document.querySelectorAll(`input[onchange*="_wzEqToggle('${id}'"]`).forEach(c => { c.checked = on; });
        const n = Object.keys(this._wz.equip).length;
        const pg = document.getElementById('wz-eq-pager');
        if (pg) { const s = pg.querySelector('span'); if (s) s.textContent = s.textContent.replace(/• \d+ dipilih/, `• ${n} dipilih`); }
    },

    async _wzEqFiles(id) {
        const box = document.getElementById('wz-eq-files');
        const e = (this.equipments || []).find(x => x.id === id) || {};
        box.innerHTML = `<div style="border:1px solid var(--border-color); border-radius:8px; padding:12px; background:var(--bg-secondary);">
            <div style="font-weight:700; margin-bottom:8px;">📎 ${Fmt.escape(e.jenis || '')} ${e.bukti_kepemilikan === 'Perjanjian sewa' ? '<span class="badge badge-warning">sewa — lampirkan file baru</span>' : ''}</div>
            <div id="wz-eq-filelist" style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;"><span class="spinner-sm"></span> Memuat...</div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <input type="file" class="form-input" id="wz-eq-upload" accept="image/*,.pdf" style="flex:1; min-width:160px;">
                <button class="btn btn-secondary btn-sm" onclick="DocumentsPage._wzEqUpload('${id}')">Upload Baru</button>
                <button class="btn btn-secondary btn-sm" onclick="DocumentsPage._wzEqPickShared('${id}')">Pakai File Alat Lain</button>
            </div></div>`;
        try {
            const res = await API.getEquipmentFiles(id);
            const files = res.data || [];
            if (this._wz.equip[id]) this._wz.equip[id].files = files.map(f => ({ url: f.file_url, label: f.label }));
            const n = document.getElementById('wz-eq-n-' + id);
            if (n) n.textContent = files.length;
            document.getElementById('wz-eq-filelist').innerHTML = files.length ? files.map(f => `
                <div style="display:flex; gap:8px; align-items:center; font-size:0.82rem;">
                    <a href="${f.file_url}" target="_blank" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${Fmt.escape(f.label || f.file_url.split('/').pop())}</a>
                    <button class="btn btn-danger btn-sm" style="padding:2px 8px;" onclick="DocumentsPage._wzEqDelFile('${id}','${f.id}','${Fmt.escape(f.file_url)}')">Hapus</button>
                </div>`).join('') : '<small style="color:var(--text-muted);">Belum ada file — upload baru di bawah.</small>';
        } catch (err) { document.getElementById('wz-eq-filelist').innerHTML = `<small style="color:var(--danger);">${err.message}</small>`; }
    },

    async _wzEqUpload(id) {
        const input = document.getElementById('wz-eq-upload');
        if (!input?.files?.length) { Toast.warning('Pilih file dulu'); return; }
        try {
            Toast.info('Mengunggah...');
            const up = await API.uploadFile(input.files[0], 'equipment');
            const label = prompt('Label file:', input.files[0].name) || input.files[0].name;
            await API.addEquipmentFile(id, { label, file_url: up.url });
            Toast.success('File tersimpan');
            if (!this._wz.equip[id]) this._wz.equip[id] = { files: null };
            this._wzEqFiles(id);
        } catch (e) { Toast.error(e.message); }
    },

    async _wzEqPickShared(id) {
        try {
            const res = await API.getAllEquipmentFiles();
            const files = (res.data || []).filter(f => String(f.equipment_id) !== String(id));
            if (!files.length) { Toast.info('Belum ada file milik alat lain'); return; }
            const body = files.slice(0, 30).map(f => `
                <div style="display:flex; gap:8px; align-items:center; padding:6px 0; border-bottom:1px solid var(--border-color); font-size:0.82rem;">
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${Fmt.escape(f.file_url)}">${Fmt.escape(f.equipment_nama || '')} — ${Fmt.escape(f.label || '')}</span>
                    <button class="btn btn-secondary btn-sm" onclick="DocumentsPage._wzEqUseShared('${id}','${f.id}')">Pakai</button>
                </div>`).join('');
            Modal.open('Pakai File Alat Lain', `<div style="max-height:50vh; overflow:auto;">${body}</div>`, '<button class="btn btn-secondary" onclick="Modal.close()">Tutup</button>');
        } catch (e) { Toast.error(e.message); }
    },

    async _wzEqUseShared(id, fileId) {
        try {
            await API.addEquipmentFile(id, { file_id: fileId });
            Modal.close();
            Toast.success('File dibagikan ke alat ini (1 file, 2 alat)');
            if (!this._wz.equip[id]) this._wz.equip[id] = { files: null };
            this._wzEqFiles(id);
        } catch (e) { Toast.error(e.message); }
    },

    _wzEqDelFile(equipId, fileId, url) {
        Modal.confirm('Hapus Lampiran Alat',
            'Hapus catatan lampiran ini?',
            async () => {
                try {
                    if (url) await API.deleteFile(url).catch(() => {});
                    await API.deleteEquipmentFile(fileId);
                    Toast.success('Dihapus');
                    this._wzEqFiles(equipId);
                } catch (e) { Toast.error(e.message); }
            },
            { confirmLabel: 'Ya, Hapus', detail: 'Berkas di storage juga ikut terhapus.' });
    },

    // ── FORM 4: personil (pelaksana + K3 + riwayat masing-masing) ──
    // ponytail: dropdown difilter jabatan (pelaksana↔Pelaksana, k3↔K3); kosong → tampil semua + info
    _wzRoleOpts(role) {
        const kw = role === 'pelaksana' ? 'pelaksana' : 'k3';
        const hit = (this.personnel || []).filter(p => (p.jabatan || '').toLowerCase().includes(kw));
        const list = hit.length ? hit : (this.personnel || []);
        return { opts: list.map(p => `<option value="${p.id}">${Fmt.escape(p.nama)} — ${Fmt.escape(p.jabatan || '-')}</option>`).join(''), fallback: !hit.length };
    },

    _wzForm4() {
        const pane = document.querySelector('.doc-wiz-pane[data-pane="4"]');
        const pel = this._wzRoleOpts('pelaksana'), k3o = this._wzRoleOpts('k3');
        pane.innerHTML = `
        <div style="font-weight:700; margin-bottom:12px;">4. Personil <span style="font-weight:400; color:var(--text-muted); font-size:0.78rem;">— profil auto, semua editable • riwayat boleh kosong/1/banyak</span></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:start;">
        ${['pelaksana', 'k3'].map(role => {
            const oo = role === 'pelaksana' ? pel : k3o;
            return `
        <div style="border:1px solid var(--border-color); border-radius:8px; padding:12px; background:var(--bg-secondary);">
            <div class="form-group"><label class="form-label">${role === 'pelaksana' ? 'Pelaksana' : 'Petugas K3'}${oo.fallback ? ' <small style="color:var(--warning);">(belum ada jabatan ini — tampil semua)</small>' : ''}</label>
                <select class="form-select" id="wz-${role}" onchange="DocumentsPage._wzRolePick('${role}')">
                    <option value="">-- Pilih personil --</option>${oo.opts}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Posisi</label><input class="form-input" id="wz-${role}-posisi"></div>
                <div class="form-group"><label class="form-label">Pendidikan</label><input class="form-input" id="wz-${role}-pendidikan"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Pengalaman (tahun, kosong = 0)</label><input type="number" class="form-input" id="wz-${role}-pengalaman"></div>
                <div class="form-group"><label class="form-label">TTL (tempat, tanggal lahir)</label><input class="form-input" id="wz-${role}-ttl" placeholder="otomatis dari data personil"></div>
            </div>
            <div class="form-group"><label class="form-label">Riwayat ${role === 'pelaksana' ? 'pelaksana' : 'K3'} (boleh kosong)</label>
                <div id="wz-${role}-exp" style="display:flex; flex-direction:column; gap:6px;"><small style="color:var(--text-muted);">Pilih personil dulu.</small></div>
            </div>
        </div>`; }).join('')}
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">Tampilkan</label>
                <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:0.82rem; padding-top:8px;">
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;"><input type="checkbox" id="wz-show-direktur" checked style="accent-color:var(--accent);"> TTD Direktur</label>
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;"><input type="checkbox" id="wz-show-pelaksana" checked style="accent-color:var(--accent);"> Pelaksana</label>
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;"><input type="checkbox" id="wz-show-k3" checked style="accent-color:var(--accent);"> K3</label>
                    <label style="display:flex; align-items:center; gap:5px; cursor:pointer;"><input type="checkbox" id="wz-show-cap" checked style="accent-color:var(--accent);"> Cap</label>
                </div>
            </div>
            <div class="form-group" style="max-width:130px;"><label class="form-label">Ukuran Cap (px)</label>
                <input type="number" class="form-input" id="wz-cap-size" placeholder="otomatis">
            </div>
            <div class="form-group"><label class="form-label">Posisi Cap</label>
                <input class="form-input" readonly value="Otomatis bergantian" style="background:var(--bg-tertiary);">
            </div>
        </div>`;
        lucide.createIcons();
    },

    async _wzRolePick(role) {
        const id = document.getElementById('wz-' + role)?.value || '';
        this._wz[role].id = id;
        this._wz[role].exp = [];
        const box = document.getElementById(`wz-${role}-exp`);
        if (!id) {
            ['posisi', 'pendidikan', 'pengalaman', 'ttl'].forEach(k => { const e = document.getElementById(`wz-${role}-${k}`); if (e) e.value = ''; });
            if (box) box.innerHTML = '<small style="color:var(--text-muted);">Pilih personil dulu.</small>';
            return;
        }
        try {
            const res = await API.getPersonnelById(id);
            const p = res.data || {};
            const set = (k, v) => { const e = document.getElementById(`wz-${role}-${k}`); if (e) e.value = v ?? ''; };
            set('posisi', p.jabatan || '');
            set('pendidikan', p.tingkat_pendidikan || '');
            set('pengalaman', p.tahun_pengalaman ?? 0);
            // ponytail: TTL pendek "Kulon Progo, 12 Juli 1998" (bukan ISO mentah)
            let ttl = p.tempat_lahir || '';
            if (p.tanggal_lahir) {
                const d = new Date(p.tanggal_lahir);
                if (!isNaN(d)) ttl += (ttl ? ', ' : '') + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            }
            set('ttl', ttl);
            const exps = p.experience_history || [];
            box.innerHTML = exps.length ? exps.map(x => `
                <label style="display:flex; gap:8px; align-items:flex-start; font-size:0.82rem; cursor:pointer; border:1px solid var(--border-color); border-radius:6px; padding:6px 10px;">
                    <input type="checkbox" value="${x.id}" onchange="DocumentsPage._wzExpToggle('${role}')" style="accent-color:var(--accent); margin-top:2px;">
                    <span><strong>${Fmt.escape(x.nama_kegiatan || '')}</strong> <span style="color:var(--text-muted);">(${Fmt.escape(x.tahun || '')}${x.posisi ? ' • ' + Fmt.escape(x.posisi) : ''})</span></span>
                </label>`).join('') : '<small style="color:var(--text-muted);">Personil ini belum punya riwayat.</small>';
        } catch (e) { Toast.error(e.message); }
    },

    _wzExpToggle(role) {
        const box = document.getElementById(`wz-${role}-exp`);
        this._wz[role].exp = box ? Array.from(box.querySelectorAll('input:checked')).map(i => i.value) : [];
    },


    _wizNav(d) {
        const n = Math.min(6, Math.max(1, this._wzStep + d));
        if (d > 0) {
            if (!this._wzValidate(this._wzStep)) return;
            if (this._wzStep === 2) this._wzCollect2();
            if (this._wzStep === 3) this._wzCollect3();
            if (this._wzStep === 4) this._wzCollect4();
            if (this._wzStep === 5) this._wzCollect5();   // RKK — data utk dokumen 03
            if (n === 2) this._wzForm2();
            if (n === 3) this._wzForm3();
            if (n === 4) this._wzForm4();
            if (n === 5) this._wzForm5();
            if (n === 6) this._wzReview();
        }
        this._wizShow(n);
    },

    // ponytail: lompat via step — mundur bebas, maju wajib valid + collect tiap tahap terlewati
    _wizGo(n) {
        n = Math.min(6, Math.max(1, n));
        if (n === this._wzStep) return;
        if (n < this._wzStep) { this._wizShow(n); return; }
        for (let s = this._wzStep; s < n; s++) {
            if (!this._wzValidate(s)) return;
            if (s === 2) this._wzCollect2();
            if (s === 3) this._wzCollect3();
            if (s === 4) this._wzCollect4();
            if (s === 5) this._wzCollect5();
        }
        if (n === 2) this._wzForm2();
        if (n === 3) this._wzForm3();
        if (n === 4) this._wzForm4();
        if (n === 5) this._wzForm5();
        if (n === 6) this._wzReview();
        this._wizShow(n);
    },

    _wzCollect1() {
        const g = (id) => document.getElementById(id)?.value.trim() ?? '';
        this._wz.companyId = document.getElementById('wz-comp')?.value || '';
        Object.assign(this._wz.vars, {
            tahun_anggaran: g('wz-tahun'), lokasi: g('wz-lokasi'), lpse: g('wz-lpse'),
            pokja: g('wz-pokja'), alamat_pokja: g('wz-alamat-pokja'),
            kode_tender: g('wz-kode'), pagu: this._wzPaguRaw(), pagu_terbilang: g('wz-terbilang'),
            withTtd: document.getElementById('wz-with-ttd')?.value !== '0',
        });
    },

    _wzValidate(step) {
        if (step === 1) {
            this._wzCollect1();
            if (!this._wz.tender) { Toast.warning('Pilih paket proyek dulu'); return false; }
            if (!this._wz.companyId) { Toast.warning('Pilih perusahaan'); return false; }
        }
        return true;
    },

    // pane 3 dibangun malas (hanya saat dibuka) agar popup cepat
    // ponytail: loader overlay ber-timer + tahap, result modal estetik tombol kontras
    _wzLoader(show, stage) {
        // ponytail: timeout tahap disimpan agar bisa dibatalkan (hindari loader muncul lagi setelah selesai)
        if (!show) (this._wzStageT || []).forEach(clearTimeout);
        // ponytail: generate jalan di server — tab boleh ditinggal; jangan tampilkan loader bila tab sembunyi
        if (document.hidden && show) return;
        let ov = document.getElementById('wz-loader');
        if (show) {
            if (!ov) {
                ov = document.createElement('div');
                ov.id = 'wz-loader';
                ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:4000;display:flex;align-items:center;justify-content:center;pointer-events:none;';
                ov.innerHTML = `<div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:14px; padding:28px 36px; text-align:center; max-width:320px;">
                    <div class="spinner" style="margin:0 auto 14px auto;"></div>
                    <div id="wz-loader-stage" style="font-weight:700;"></div>
                    <div id="wz-loader-time" style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">0 dtk</div>
                </div>`;
                document.body.appendChild(ov);
            }
            ov.style.display = 'flex';
            this._wzT0 = Date.now();
            clearInterval(this._wzTimer);
            this._wzTimer = setInterval(() => {
                const t = document.getElementById('wz-loader-time');
                if (t) t.textContent = Math.round((Date.now() - this._wzT0) / 1000) + ' dtk';
            }, 500);
        } else {
            clearInterval(this._wzTimer);
            if (ov) ov.style.display = 'none';
        }
        if (stage) { const s = document.getElementById('wz-loader-stage'); if (s) s.textContent = stage; }
    },

    async _runGenerate(payload, btnId, btnLabel) {
        const btn = document.getElementById(btnId);
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Generate PDF...'; }
        this._wzLoader(true, 'Menyiapkan data...');
        try {
            this._wzStageT = [
                setTimeout(() => this._wzLoader(true, 'Merender PDF di server...'), 2500),
                setTimeout(() => this._wzLoader(true, 'Menggabung lampiran & mengunggah...'), 12000),
            ];
            const res = await API.generateDocument(payload);
            const d = res.data;
            this._wzLoader(false);
            Modal.open('Dokumen PDF Jadi',
                `<div style="text-align:center; padding:8px 4px;">
                    <div style="width:56px; height:56px; border-radius:50%; background:var(--success-bg); color:var(--success); display:flex; align-items:center; justify-content:center; margin:0 auto 12px auto;"><i data-lucide="file-check" style="width:28px; height:28px;"></i></div>
                    <h3 style="margin:0 0 4px 0;">PDF Siap</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem;">${d.pages} halaman • tersimpan di rekap dokumen${d.cap_variants?.length ? ` • cap V${[...new Set(d.cap_variants)].join('/')}` : ''}</p>
                    ${d.skipped?.length ? `<p style="font-size:0.78rem; color:var(--warning);">Lewati: ${d.skipped.map(Fmt.escape).join('; ')}</p>` : ''}
                    <div style="display:flex; gap:10px; justify-content:center; margin-top:16px;">
                        <a href="${d.url}" target="_blank" class="btn btn-primary"><i data-lucide="download"></i> Unduh PDF</a>
                        <button class="btn btn-secondary" onclick="Modal.close()">Tutup</button>
                    </div>
                </div>`,
                '');
            lucide.createIcons();
            Toast.success('PDF tersimpan di database dokumen');
            DocumentsPage.loadRecords();
        } catch (e) { this._wzLoader(false); Toast.error('Generate gagal: ' + e.message); }
        finally { if (btn) { btn.disabled = false; btn.innerHTML = btnLabel; } }
    },

};
