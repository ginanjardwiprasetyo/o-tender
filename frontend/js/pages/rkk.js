/**
 * TenderBuild — Halaman RKK
 * Pengaturan variabel + format tabel RKK (B1/B2/D2) untuk dokumen.
 * ponytail: E1 formatnya menyusul — langsung di form pembuatan dokumen.
 */
const RkkPage = {
    cfg: null,
    _tab: 'b1',

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
                <p>Variabel &amp; format tabel RKK (B1/B2/D2) yang dipakai di dokumen</p>
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

    renderBody() {
        const el = document.getElementById('rkk-body');
        if (!el) return;
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
                        <input type="number" min="1" max="5" class="form-input" id="rkk-mungkin" value="${this.val('rkk_default_mungkin', 1)}"></div>
                    <div class="form-group"><label class="form-label">Default Keparahan (A)</label>
                        <input type="number" min="1" max="5" class="form-input" id="rkk-parah" value="${this.val('rkk_default_parah', 1)}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Ambang Risiko Kecil (nilai ≤)</label>
                        <input type="number" min="0" class="form-input" id="rkk-kecil" value="${this.val('rkk_ambang_kecil', 4)}"></div>
                    <div class="form-group"><label class="form-label">Ambang Risiko Sedang (nilai ≤)</label>
                        <input type="number" min="0" class="form-input" id="rkk-sedang" value="${this.val('rkk_ambang_sedang', 12)}"></div>
                    <div class="form-group"><label class="form-label">Ambang Risiko Besar (nilai ≤)</label>
                        <input type="number" min="0" class="form-input" id="rkk-besar" value="${this.val('rkk_ambang_besar', 25)}"></div>
                </div>
                <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">
                    Nilai risiko = Kemungkinan (F) × Keparahan (A). Tingkat: ≤ kecil → Risiko Kecil, ≤ sedang → Risiko Sedang, selainnya Risiko Besar.
                </p>
            </div>

            <div class="card" style="margin-bottom:16px;">
                <div class="card-title" style="display:flex;gap:8px;align-items:center;">
                    <i data-lucide="table-2" style="width:16px;height:16px;"></i>
                    Format Tabel &amp; Variabel
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
                    ${this.TABS.map(t => `<button class="btn ${t.id === this._tab ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="RkkPage.setTab('${t.id}')">
                        <i data-lucide="${t.icon}" style="width:13px;height:13px;"></i> ${t.label}</button>`).join('')}
                </div>
                <div id="rkk-tab-body"></div>
            </div>`;
        this.renderTab();
        lucide.createIcons();
    },

    setTab(id) { this._tab = id; this.renderBody(); },

    renderTab() {
        const el = document.getElementById('rkk-tab-body');
        if (!el) return;
        const t = this._tab;
        if (t === 'e1') {
            el.innerHTML = `
                <div style="padding:14px;border:1px dashed var(--border-strong);border-radius:8px;margin-bottom:14px;color:var(--text-muted);">
                    <i data-lucide="clipboard-list" style="width:20px;height:20px;margin-bottom:4px;"></i>
                    <div style="font-size:0.88rem;color:var(--text-primary);margin-bottom:3px;">Format Tabel E1 menyusul</div>
                    <div style="font-size:0.78rem;">Tabel E1 akan langsung ditampilkan di form pembuatan dokumen. Isian di bawah tetap bisa diisi di sini.</div>
                </div>`;
            lucide.createIcons({ nodes: [el] });
            return;
        }
        const key = 'rkk_tabel_' + t;
        const def = (this.defaults || {})[t] || '';
        const vlist = (this.varDefs || {})[t] || [];
        const baris = Number(this.val('rkk_baris_' + t, 1)) || 1;
        el.innerHTML = `
            ${vlist.length ? `
            <div style="margin-bottom:14px;">
                <div style="font-size:0.8rem;font-weight:600;margin-bottom:6px;">Isian Tabel ${t.toUpperCase()}</div>
                <div style="display:grid;gap:8px;">
                    ${vlist.map(v => {
                        if (!v.perBaris) {
                            return `<div class="form-group" style="margin:0;">
                                <label class="form-label">${Fmt.escape(v.label)} <code style="font-size:0.7rem;color:var(--text-muted);">{{${Fmt.escape(v.key)}}}</code></label>
                                <input class="form-input" data-rkk-val="${Fmt.escape(v.key)}" value="${Fmt.escape(this.val('rkk_val_' + v.key, ''))}" placeholder="${Fmt.escape(v.ket || '')}">
                            </div>`;
                        }
                        return `<div class="form-group" style="margin:0;">
                            <label class="form-label">${Fmt.escape(v.label)} <code style="font-size:0.7rem;color:var(--text-muted);">(per baris)</code></label>
                            <div style="display:grid;gap:6px;">
                                ${Array.from({length: baris}, (_, i) => {
                                    const key = v.key + (i + 1);
                                    return `<input class="form-input" data-rkk-val="${Fmt.escape(key)}" value="${Fmt.escape(this.val('rkk_val_' + key, ''))}" placeholder="baris ${i + 1} — ${Fmt.escape(v.ket || '')}">`;
                                }).join('')}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : ''}
            ${vlist.length ? `
            <div style="margin-bottom:14px;">
                <div style="font-size:0.8rem;font-weight:600;margin-bottom:6px;">Variabel Tabel ${t.toUpperCase()}</div>
                <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;">
                    <table class="table" style="width:100%;font-size:0.78rem;">
                        <thead><tr><th style="width:210px;">Nama Variabel</th><th>Keterangan</th><th style="width:120px;">Default</th></tr></thead>
                        <tbody>
                            ${vlist.map(v => `<tr>
                                <td><code>{{${Fmt.escape(v.key)}}}</code>${v.perBaris ? ' <span style="font-size:0.68rem;color:var(--text-muted);">(per baris)</span>' : ''}</td>
                                <td>${Fmt.escape(v.label)}${v.ket ? ' — ' + Fmt.escape(v.ket) : ''}</td>
                                <td>${v.default !== undefined ? Fmt.escape(String(v.default)) : '-'}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>` : ''}
            <div class="form-group" style="margin-bottom:12px;">
                <label class="form-label">Format Tabel ${t.toUpperCase()} (HTML)</label>
                <textarea class="form-input" id="rkk-html-${t}" rows="14" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.75rem;line-height:1.5;white-space:pre;overflow:auto;">${Fmt.escape(this.val(key, def))}</textarea>
                <p style="font-size:0.72rem;color:var(--text-muted);margin:6px 0 0;">
                    Placeholder baris: <code>{{1mungkin}}</code> <code>{{1parah}}</code> <code>{{1resiko}}</code> <code>{{1tingkat}}</code> — angka depan otomatis menyesuaikan baris.
                    Nilai <code>{{1resiko}}</code> = F × A, <code>{{1tingkat}}</code> otomatis dari ambang risiko di atas.
                </p>
            </div>
            <div class="form-row">
                <div class="form-group" style="width:100%;">
                    <label class="form-label">Pratinjau (contoh: 1 baris, F=3, A=4)</label>
                    <div id="rkk-preview" class="rkk-preview"></div>
                </div>
            </div>`;
        this.renderPreview();
        lucide.createIcons({ nodes: [el] });
    },

    // pratinjau: pakai engine backend (/api/rkk/preview) biar sama persis dgn hasil dokumen
    async renderPreview() {
        const el = document.getElementById('rkk-preview');
        if (!el) return;
        const t = this._tab;
        const html = this.val('rkk_tabel_' + t, '');
        try {
            const res = await API.request('/rkk/preview', {
                method: 'POST',
                body: { tabel: t, html, baris: Number(this.val('rkk_baris_' + t, 1)) || 1,
                        mungkin: Number(this.val('rkk_default_mungkin', 1)) || 1,
                        parah: Number(this.val('rkk_default_parah', 1)) || 1,
                        ambang: { kecil: Number(this.val('rkk_ambang_kecil', 4)), sedang: Number(this.val('rkk_ambang_sedang', 12)), besar: Number(this.val('rkk_ambang_besar', 25)) } }
            });
            el.innerHTML = res.data && res.data.html ? res.data.html : '<span style="color:var(--text-muted);font-size:0.8rem;">Pratinjau tidak tersedia.</span>';
        } catch (e) {
            el.innerHTML = `<span style="color:var(--danger);font-size:0.8rem;">${Fmt.escape(e.message)}</span>`;
        }
    },

    async save() {
        const btn = document.getElementById('rkk-save-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...'; }
        try {
            const payload = {
                rkk_baris_b1: Number(document.getElementById('rkk-baris-b1')?.value) || 1,
                rkk_baris_b2: Number(document.getElementById('rkk-baris-b2')?.value) || 1,
                rkk_default_mungkin: Number(document.getElementById('rkk-mungkin')?.value) || 1,
                rkk_default_parah: Number(document.getElementById('rkk-parah')?.value) || 1,
                rkk_ambang_kecil: Number(document.getElementById('rkk-kecil')?.value) || 0,
                rkk_ambang_sedang: Number(document.getElementById('rkk-sedang')?.value) || 0,
                rkk_ambang_besar: Number(document.getElementById('rkk-besar')?.value) || 0,
                rkk_tabel_b1: document.getElementById('rkk-html-b1')?.value || '',
                rkk_tabel_b2: document.getElementById('rkk-html-b2')?.value || '',
                rkk_tabel_d2: document.getElementById('rkk-html-d2')?.value || '',
            };
            // nilai isian manual
            document.querySelectorAll('[data-rkk-val]').forEach(inp => {
                payload['rkk_val_' + inp.dataset.rkkVal] = inp.value;
            });
            await API.updateSettings(payload);
            this.cfg = { ...(this.cfg || {}), ...payload };
            Toast.success('Pengaturan RKK disimpan');
        } catch (e) {
            Toast.error('Gagal menyimpan: ' + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save"></i> Simpan Pengaturan'; lucide.createIcons(); }
        }
    },
};
