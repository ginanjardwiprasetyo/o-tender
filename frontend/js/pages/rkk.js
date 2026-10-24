/**
 * TenderBuild — Halaman RKK (tabel builder)
 * "Format Tabel & VARIABEL" kini berupa tabel visual: klik sel untuk mengedit teks,
 * chip variabel untuk nilai (rkk_val_*), sel hitungan terkunci (F×A / Tingkat).
 * Tidak ada lagi textarea kode HTML, daftar "Isian Tabel", maupun tabel referensi variabel.
 * ponytail: format menyimpan 1 baris template — jumlah baris di Pengaturan Umum,
 *            nilai per tender diisi di form pembuatan dokumen.
 */
const RkkPage = {
    cfg: null,
    _tab: 'b1',
    // tabel builder (edit sel in-place)
    _tbl: null,          // <table> live yg sedang diedit
    _draftHtml: {},      // tab -> format HTML hasil edit (belum disimpan)
    _dirtyVals: {},      // 'rkk_val_x' -> nilai (diedit di sel value)
    _dirtyTabs: {},      // tab -> true (tab itu diedit)

    TABS: [
        { id: 'b1', label: 'Tabel B1', icon: 'triangle-alert' },
        { id: 'b2', label: 'Tabel B2', icon: 'list-checks' },
        { id: 'd2', label: 'Tabel D2', icon: 'git-branch' },
        { id: 'e1', label: 'Tabel E1', icon: 'clipboard-list' },
    ],

    async render() {
        return `
        <div class="page-header">
            <div>
                <h2>Pengaturan RKK</h2>
                <p>Builder tabel RKK (B1/B2/D2/E1) — klik sel untuk mengedit teks &amp; nilai langsung</p>
            </div>
            <button class="btn btn-primary" id="rkk-save-btn" onclick="RkkPage.save()">
                <i data-lucide="save"></i> Simpan Pengaturan
            </button>
        </div>
        <div id="rkk-body"><div class="page-loading"><div class="spinner"></div></div></div>`;
    },

    async afterRender() { this.load(); },

    async load() {
        const el = document.getElementById('rkk-body');
        if (!el) return;
        this._tbl = null; this._draftHtml = {}; this._dirtyVals = {}; this._dirtyTabs = {};
        try {
            const res = await API.getSettings();
            this.cfg = res.data || {};
            try {
                const c = await API.getRkkConfig();
                this.defaults = c.data?.defaults || {};
                this.varDefs = c.data?.vars || {};
            } catch (e2) { console.warn('Gagal ambil config RKK:', e2.message); }
            this.renderBody();
        } catch (e) {
            el.innerHTML = `<div class="empty-state"><i data-lucide="alert-triangle"></i><p>Gagal memuat pengaturan: ${Fmt.escape(e.message)}</p></div>`;
            lucide.createIcons();
        }
    },

    // nilai pengaturan (dari server) atau default
    val(key, def = '') {
        const v = this.cfg ? this.cfg[key] : '';
        return (v === null || v === undefined || v === '') ? def : v;
    },

    set(key, value) { this.cfg = this.cfg || {}; this.cfg[key] = value; },

    // nilai terbaru utk satu key: draft edit > settings
    _cur(key) {
        const v = this._dirtyVals[key];
        return v !== undefined ? v : (this.cfg ? this.cfg[key] : '');
    },

    renderBody() {
        const el = document.getElementById('rkk-body');
        if (!el) return;
        const upd = 'oninput="RkkPage._updateCalc()"';
        el.innerHTML = `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-title" style="display:flex;gap:8px;align-items:center;">
                    <i data-lucide="sliders-horizontal" style="width:16px;height:16px;"></i>
                    Pengaturan Umum
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Jumlah baris Tabel B1</label>
                        <input type="number" min="1" max="50" class="form-input" id="rkk-baris-b1" value="${this.val('rkk_baris_b1', 1)}"></div>
                    <div class="form-group"><label class="form-label">Jumlah baris Tabel B2</label>
                        <input type="number" min="1" max="50" class="form-input" id="rkk-baris-b2" value="${this.val('rkk_baris_b2', 1)}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Default Kemungkinan (F)</label>
                        <input type="number" min="1" max="5" class="form-input" id="rkk-mungkin" value="${this.val('rkk_default_mungkin', 1)}" ${upd}></div>
                    <div class="form-group"><label class="form-label">Default Keparahan (A)</label>
                        <input type="number" min="1" max="5" class="form-input" id="rkk-parah" value="${this.val('rkk_default_parah', 1)}" ${upd}></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Ambang Risiko Kecil (nilai ≤)</label>
                        <input type="number" min="0" class="form-input" id="rkk-kecil" value="${this.val('rkk_ambang_kecil', 4)}" ${upd}></div>
                    <div class="form-group"><label class="form-label">Ambang Risiko Sedang (nilai ≤)</label>
                        <input type="number" min="0" class="form-input" id="rkk-sedang" value="${this.val('rkk_ambang_sedang', 12)}" ${upd}></div>
                    <div class="form-group"><label class="form-label">Ambang Risiko Besar (nilai ≤)</label>
                        <input type="number" min="0" class="form-input" id="rkk-besar" value="${this.val('rkk_ambang_besar', 25)}" ${upd}></div>
                </div>
                <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">
                    Nilai risiko = Kemungkinan (F) × Keparahan (A). Tingkat: ≤ kecil → Risiko Kecil, ≤ sedang → Risiko Sedang, selainnya Risiko Besar.
                </p>
            </div>

            <div class="card" style="margin-bottom:16px;">
                <div class="card-title" style="display:flex;gap:8px;align-items:center;">
                    <i data-lucide="table-2" style="width:16px;height:16px;"></i>
                    Format Tabel &amp; VARIABEL
                    <span style="font-weight:400;font-size:0.75rem;color:var(--text-muted);">— builder visual, klik sel untuk mengedit</span>
                </div>
                <div id="rkk-tablist" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
                    ${this.TABS.map(t => `<button class="btn ${t.id === this._tab ? 'btn-primary' : 'btn-secondary'} btn-sm" data-tab="${t.id}" onclick="RkkPage.setTab('${t.id}')">
                        <i data-lucide="${t.icon}" style="width:13px;height:13px;"></i> ${t.label}</button>`).join('')}
                </div>
                <div id="rkk-tab-body"></div>
            </div>`;
        this.renderTab();
        lucide.createIcons();
    },

    // pindah tab tanpa merender ulang Pengaturan Umum (input umum tdk hilang)
    setTab(id) {
        if (id === this._tab) return;
        this._stashDraft();
        this._tab = id;
        document.querySelectorAll('#rkk-tablist [data-tab]').forEach(b => {
            const on = b.dataset.tab === id;
            b.classList.toggle('btn-primary', on);
            b.classList.toggle('btn-secondary', !on);
        });
        this.renderTab();
    },

    // simpan tabel live tab aktif ke draft
    _stashDraft() {
        if (this._tbl) this._draftHtml[this._tab] = this._serialize(this._tbl);
    },

    renderTab() {
        const el = document.getElementById('rkk-tab-body');
        if (!el) return;
        this._tbl = null;
        const t = this._tab;
        const src = this._draftHtml[t] || this.val('rkk_tabel_' + t, '') || (this.defaults || {})[t] || '';
        if (!src.trim() || !/<table/i.test(src)) {
            el.innerHTML = `
                <div class="rkk-builder-empty">
                    <i data-lucide="table-2" style="width:22px;height:22px;margin-bottom:6px;"></i>
                    <div style="font-weight:600;color:var(--text-primary);margin-bottom:3px;">Format Tabel ${t.toUpperCase()} belum tersedia</div>
                    <div style="font-size:0.8rem;">Simpan tabel dari form pembuatan dokumen, lalu kembali ke sini untuk mengeditnya.</div>
                </div>`;
            lucide.createIcons({ nodes: [el] });
            return;
        }
        const holder = document.createElement('div');
        holder.innerHTML = src;
        const table = holder.querySelector('table');
        if (!table) {
            el.innerHTML = `<div class="rkk-builder-empty"><div style="font-size:0.8rem;">Format Tabel ${t.toUpperCase()} tidak berbentuk tabel.</div></div>`;
            return;
        }
        this._decorate(table);
        this._tbl = table;
        el.innerHTML = `
            <div class="rkk-legend">
                <span><b class="rkk-dot rkk-dot--ce"></b> sel teks — klik untuk mengedit</span>
                <span><b class="rkk-dot rkk-dot--val"></b> chip nilai — klik untuk mengisi (tersimpan ke variabel)</span>
                <span><b class="rkk-dot rkk-dot--ref"></b> otomatis dari data dokumen</span>
                <span><b class="rkk-dot rkk-dot--calc"></b> hitungan (F×A / Tingkat)</span>
            </div>
            <div class="rkk-preview rkk-builder" oninput="RkkPage._onEdit(event)"></div>
            <p class="rkk-builder-note">Format menyimpan satu baris template; jumlah baris diatur di Pengaturan Umum, nilai per baris &amp; data tender diisi saat pembuatan dokumen.
            Sel bernilai kosong menampilkan label variabelnya.</p>`;
        const box = el.querySelector('.rkk-builder');
        box.appendChild(table);
        // tempel = teks polos, agar struktur tabel tdk terkontaminasi HTML eksternal
        table.addEventListener('paste', e => {
            if (!e.clipboardData) return;
            e.preventDefault();
            document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        });
        this._updateCalc();
    },

    /* ── klasifikasi & dekorasi sel ─────────────────────────────── */

    // jenis token: 'calc' (hitungan terkunci), 'val' (nilai bisa diedit), 'ref' (dari dokumen)
    _classify(key, vlist) {
        let m = key.match(/^(\d+)(resiko|tingkat)$/);
        if (m) return { k: 'calc', row: m[1], name: m[2] };
        m = key.match(/^(\d+)(mungkin|parah)$/);
        if (m) return { k: 'val', key: m[2] + '_b' + m[1] };
        if (vlist.some(v => v.key === key)) return { k: 'val', key };
        if (/^[A-Za-z_]\w*_b\d+$/.test(key) && vlist.some(v => v.perBaris && key.startsWith(v.key))) return { k: 'val', key };
        return { k: 'ref' };
    },

    _labelFor(key, vlist) {
        const v = vlist.find(x => x.key === key) || vlist.find(x => x.perBaris && key.startsWith(x.key));
        return v ? v.label : key;
    },

    // nilai utk chip: rkk_val_* (draft > settings) → default F/A → kosong
    _valueOf(key) {
        const v = this._cur('rkk_val_' + key);
        if (v !== '' && v !== undefined && v !== null) return String(v);
        const d = this._def(key);
        return d === '' ? '' : String(d);
    },

    _def(key) {
        if (/^mungkin_b\d+$/.test(key)) return document.getElementById('rkk-mungkin')?.value ?? this.val('rkk_default_mungkin', 1);
        if (/^parah_b\d+$/.test(key)) return document.getElementById('rkk-parah')?.value ?? this.val('rkk_default_parah', 1);
        return '';
    },

    _chipVal(origKey, varKey, vlist) {
        const ph = this._labelFor(varKey, vlist);
        return `<span class="rkk-vval" contenteditable="true" data-rkk-key="${varKey}" data-rkk-token="{{${origKey}}}" data-ph="${Fmt.escape(ph)}">${Fmt.escape(this._valueOf(varKey))}</span>`;
    },

    _chipCalc(origKey, row, name) {
        return `<span class="rkk-vc" contenteditable="false" data-rkk-calc="${row}" data-rkk-name="${name}" data-rkk-token="{{${origKey}}}" title="Hitungan otomatis (F × A / ambang risiko)">0</span>`;
    },

    _chipRef(origKey) {
        return `<span class="rkk-vref" contenteditable="false" data-rkk-token="{{${origKey}}}" title="Variabel terisi otomatis dari data dokumen">${Fmt.escape(origKey.replace(/^\d+/, ''))}</span>`;
    },

    // ubah tiap sel: teks biasa → contenteditable; token → chip (nilai/hitungan/ref)
    _decorate(table) {
        const vlist = (this.varDefs || {})[this._tab] || [];
        const TOKRE = /\{\{\s*(\w+)\s*\}\}/g;   // \w+ → ikut token berawalan angka ({{1mungkin}})
        table.querySelectorAll('td, th').forEach(cell => {
            const html = cell.innerHTML;
            const toks = html.match(TOKRE) || [];
            if (!toks.length) {
                cell.setAttribute('contenteditable', 'true');
                cell.classList.add('rkk-ce');
                return;
            }
            const pure = toks.length === 1 && cell.textContent.replace(/\{\{[^}]*\}\}/g, '').trim() === '';
            if (pure) {
                const key = toks[0].replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '');
                const kind = this._classify(key, vlist);
                // penanda: bila chip dihapus user, token dipulihkan saat serialisasi
                cell.dataset.rkkPure = '{{' + key + '}}';
                cell.innerHTML = kind.k === 'val' ? this._chipVal(key, kind.key, vlist)
                    : kind.k === 'calc' ? this._chipCalc(key, kind.row, kind.name)
                    : this._chipRef(key);
                return;
            }
            // campuran: tiap placeholder jadi chip, sel tetap bisa diedit di sekitarnya
            cell.innerHTML = html.replace(TOKRE, (m, key) => {
                const kind = this._classify(key, vlist);
                return kind.k === 'val' ? this._chipVal(key, kind.key, vlist)
                    : kind.k === 'calc' ? this._chipCalc(key, kind.row, kind.name)
                    : this._chipRef(key);
            });
            cell.setAttribute('contenteditable', 'true');
            cell.classList.add('rkk-ce');
        });
    },

    /* ── hitungan live (F×A, Tingkat, chip F/A mengikuti default) ── */

    _updateCalc() {
        if (!this._tbl) return;
        // chip F/A tanpa nilai manual → ikut input default
        this._tbl.querySelectorAll('[data-rkk-key]').forEach(ch => {
            const k = ch.dataset.rkkKey;
            if (!/^(mungkin|parah)_b\d+$/.test(k)) return;
            if (this._cur('rkk_val_' + k) !== '') return;
            ch.textContent = String(this._def(k));
        });
        const num = (id, def) => { const v = document.getElementById(id)?.value; const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; };
        const amb = {
            kecil: num('rkk-kecil', parseInt(this.val('rkk_ambang_kecil', 4), 10)),
            sedang: num('rkk-sedang', parseInt(this.val('rkk_ambang_sedang', 12), 10)),
        };
        this._tbl.querySelectorAll('[data-rkk-calc]').forEach(ch => {
            const row = ch.dataset.rkkCalc || '1';
            const F = parseInt(this._valueOf('mungkin_b' + row), 10) || 0;
            const A = parseInt(this._valueOf('parah_b' + row), 10) || 0;
            const n = F * A;
            ch.textContent = (ch.dataset.rkkName === 'resiko')
                ? String(n)
                : (n <= amb.kecil ? 'Risiko Kecil' : n <= amb.sedang ? 'Risiko Sedang' : 'Risiko Besar');
        });
    },

    _onEdit(e) {
        this._dirtyTabs[this._tab] = true;
        const t = e.target;
        const k = t && t.dataset ? t.dataset.rkkKey : null;
        if (k) {
            this._dirtyVals['rkk_val_' + k] = t.textContent;
            this._updateCalc();
        }
    },

    /* ── serialisasi: tabel live → HTML format ──────────────────── */

    _serialize(table) {
        const clone = table.cloneNode(true);
        // sel murni yg chip-nya dihapus → pulihkan token aslinya
        clone.querySelectorAll('[data-rkk-pure]').forEach(c => {
            if (!c.querySelector('[data-rkk-token]')) c.textContent = c.dataset.rkkPure;
            c.removeAttribute('data-rkk-pure');
        });
        // chip → token asli (nilai tdk pernah bocor ke format)
        clone.querySelectorAll('[data-rkk-token]').forEach(ch => {
            ch.replaceWith(document.createTextNode(ch.dataset.rkkToken));
        });
        clone.querySelectorAll('td, th').forEach(c => {
            c.removeAttribute('contenteditable');
            c.removeAttribute('data-ph');
            (c.className || '').split(/\s+/).forEach(cl => { if (cl.startsWith('rkk-')) c.classList.remove(cl); });
            c.innerHTML = this._cleanCell(c.innerHTML);
        });
        return clone.outerHTML;
    },

    // artefak contenteditable (<div> dari Enter, br ganda) → HTML rapi
    _cleanCell(h) {
        return String(h)
            .replace(/<div\b[^>]*>/gi, '<br>').replace(/<\/div>/gi, '')
            .replace(/(?:<br>\s*){2,}/g, '<br>')
            .replace(/^\s*(?:<br>\s*)+/i, '').replace(/(?:\s*<br>)+\s*$/i, '');
    },

    async save() {
        const btn = document.getElementById('rkk-save-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...'; }
        try {
            this._stashDraft();
            const payload = {
                rkk_baris_b1: Number(document.getElementById('rkk-baris-b1')?.value) || 1,
                rkk_baris_b2: Number(document.getElementById('rkk-baris-b2')?.value) || 1,
                rkk_default_mungkin: Number(document.getElementById('rkk-mungkin')?.value) || 1,
                rkk_default_parah: Number(document.getElementById('rkk-parah')?.value) || 1,
                rkk_ambang_kecil: Number(document.getElementById('rkk-kecil')?.value) || 0,
                rkk_ambang_sedang: Number(document.getElementById('rkk-sedang')?.value) || 0,
                rkk_ambang_besar: Number(document.getElementById('rkk-besar')?.value) || 0,
            };
            // format tabel: hanya tab yg diedit (tab lain tdk ditimpa)
            Object.keys(this._dirtyTabs).forEach(t => {
                if (this._draftHtml[t] !== undefined) payload['rkk_tabel_' + t] = this._draftHtml[t];
            });
            // nilai isian dari chip builder
            Object.keys(this._dirtyVals).forEach(k => { payload[k] = this._dirtyVals[k]; });
            await API.updateSettings(payload);
            this.cfg = { ...(this.cfg || {}), ...payload };
            this._draftHtml = {}; this._dirtyVals = {}; this._dirtyTabs = {};
            Toast.success('Pengaturan RKK disimpan');
        } catch (e) {
            Toast.error('Gagal menyimpan: ' + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save"></i> Simpan Pengaturan'; lucide.createIcons(); }
        }
    },
};
