/**
 * TenderBuild — Equipment Page (CRUD)
 */
const EquipmentPage = {
    data: [],
    sortKey: '',
    sortDir: 1,
    page: 1,
    perPage: 10,

    async render() {
        return `
        <div class="page-header">
            <div><h2>Data Peralatan</h2><p>Inventarisasi peralatan proyek perusahaan</p></div>
            <button class="btn btn-primary" onclick="EquipmentPage.openForm()">
                <i data-lucide="plus"></i> Tambah Alat
            </button>
        </div>
        <div class="toolbar">
            <div class="search-box">
                <i data-lucide="search"></i>
                <input type="text" id="eq-search" placeholder="Cari peralatan..." oninput="EquipmentPage.filter()">
            </div>
        </div>
        <div class="table-container">
            <table class="eq-table">
                <thead><tr>
                    <th class="col-no">No</th>
                    <th class="th-sort" onclick="EquipmentPage.sort('company_singkatan')">PT <span class="sort-ind" data-k="company_singkatan"></span></th>
                    <th class="th-sort" onclick="EquipmentPage.sort('jenis')">Jenis Peralatan <span class="sort-ind" data-k="jenis"></span></th>
                    <th class="th-sort" onclick="EquipmentPage.sort('kapasitas')">Kapasitas <span class="sort-ind" data-k="kapasitas"></span></th>
                    <th class="th-sort" onclick="EquipmentPage.sort('jumlah')">Jumlah <span class="sort-ind" data-k="jumlah"></span></th>
                    <th class="th-sort" onclick="EquipmentPage.sort('tahun_produksi')">Tahun <span class="sort-ind" data-k="tahun_produksi"></span></th>
                    <th class="th-sort" onclick="EquipmentPage.sort('merk_type')">Merk / Type <span class="sort-ind" data-k="merk_type"></span></th>
                    <th class="th-sort" onclick="EquipmentPage.sort('kondisi')">Kondisi <span class="sort-ind" data-k="kondisi"></span></th>
                    <th class="th-sort" onclick="EquipmentPage.sort('lokasi_sekarang')">Lokasi <span class="sort-ind" data-k="lokasi_sekarang"></span></th>
                    <th class="th-sort" onclick="EquipmentPage.sort('bukti_kepemilikan')">Bukti <span class="sort-ind" data-k="bukti_kepemilikan"></span></th>
                    <th>Berkas</th><th class="col-aksi">Aksi</th>
                </tr></thead>
                <tbody id="eq-tbody"><tr><td colspan="12" class="text-center">Memuat...</td></tr></tbody>
            </table>
        </div>
        <div id="eq-pager"></div>`;
    },

    async afterRender() { this.loadData(); },

    async loadData() {
        try {
            const [res, comps] = await Promise.all([API.getEquipments(), API.getCompanies().catch(() => ({ data: [] }))]);
            this.data = res.data || [];
            this.companies = comps.data || [];
            this.page = 1;
            this.applyView();
        } catch (e) {
            const tbody = document.getElementById('eq-tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="12" class="text-center">Gagal memuat data</td></tr>';
        }
    },

    filtered() {
        const q = (document.getElementById('eq-search')?.value || '').toLowerCase();
        let items = !q ? [...this.data] : this.data.filter(e =>
            [e.jenis, e.kapasitas, e.merk_type, e.lokasi_sekarang, e.kondisi, e.bukti_kepemilikan]
                .filter(Boolean).join(' ').toLowerCase().includes(q));
        if (this.sortKey) {
            const k = this.sortKey, d = this.sortDir;
            items.sort((a, b) => {
                const va = a[k], vb = b[k];
                if (va == null && vb == null) return 0;
                if (va == null) return 1;
                if (vb == null) return -1;
                if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * d;
                return String(va).localeCompare(String(vb), 'id', { numeric: true }) * d;
            });
        }
        return items;
    },

    sort(key) {
        if (this.sortKey === key) this.sortDir *= -1;
        else { this.sortKey = key; this.sortDir = 1; }
        this.applyView();
    },

    goto(p) {
        const total = Math.max(1, Math.ceil(this.filtered().length / this.perPage));
        this.page = Math.min(Math.max(1, p), total);
        this.applyView();
    },

    applyView() {
        const items = this.filtered();
        const total = Math.max(1, Math.ceil(items.length / this.perPage));
        this.page = Math.min(Math.max(1, this.page), total);
        const start = (this.page - 1) * this.perPage;
        this.renderTable(items.slice(start, start + this.perPage), start);
        this.renderPager(items.length, start);
        document.querySelectorAll('.sort-ind').forEach(el => {
            el.textContent = el.dataset.k === this.sortKey ? (this.sortDir === 1 ? ' ▲' : ' ▼') : '';
        });
    },

    renderTable(items, offset = 0) {
        const tbody = document.getElementById('eq-tbody');
        if (!tbody) return;
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="12"><div class="empty-state"><i data-lucide="truck"></i><p>Belum ada data peralatan</p></div></td></tr>';
            lucide.createIcons({ nodes: [tbody] }); return;
        }
        tbody.innerHTML = items.map((e, i) => `<tr>
            <td class="col-no">${offset + i + 1}</td>
            <td class="col-center"><span class="badge badge-info">${Fmt.escape(e.company_singkatan || '-')}</span></td>
            <td class="cell-jenis" title="${Fmt.escape(e.jenis)}">${Fmt.escape(e.jenis)}</td>
            <td>${Fmt.escape(e.kapasitas) || '-'}</td>
            <td class="col-num">${e.jumlah ?? '-'}</td>
            <td class="col-num">${e.tahun_produksi || '-'}</td>
            <td>${Fmt.escape(e.merk_type) || '-'}</td>
            <td>${Fmt.statusKondisi(e.kondisi)}</td>
            <td>${Fmt.escape(e.lokasi_sekarang) || '-'}</td>
            <td class="cell-bukti" title="${Fmt.escape(e.bukti_kepemilikan || '')}">${Fmt.escape(e.bukti_kepemilikan) || '-'}</td>
            <td class="col-center">
                ${((e.file_url ? 1 : 0) + (e.doc_count || 0)) === 0 ? `<span class="eq-dash">-</span>`
                    : ((e.file_url ? 1 : 0) + (e.doc_count || 0)) === 1 && e.file_url
                        ? `<a href="${e.file_url}" target="_blank" class="btn btn-secondary eq-btn" title="Lihat Berkas"><i data-lucide="eye"></i></a>`
                        : `<button class="btn btn-secondary eq-btn" onclick="EquipmentPage.showFiles('${e.id}')" title="Lihat ${(e.file_url ? 1 : 0) + (e.doc_count || 0)} berkas"><i data-lucide="eye"></i></button>`}
            </td>
            <td class="col-aksi"><div class="eq-actions">
                <button class="btn btn-secondary eq-btn" onclick="EquipmentPage.openForm('${e.id}')" title="Edit"><i data-lucide="pencil"></i></button>
                <button class="btn btn-danger eq-btn" onclick="EquipmentPage.remove('${e.id}')" title="Hapus"><i data-lucide="trash-2"></i></button>
            </div></td>
        </tr>`).join('');
        lucide.createIcons({ nodes: [tbody] });
    },

    renderPager(total, start) {
        const el = document.getElementById('eq-pager');
        if (!el) return;
        const pages = Math.ceil(total / this.perPage);
        if (pages <= 1) { el.innerHTML = total ? `<div class="list-pager"><span class="pager-info">Menampilkan ${total} data</span></div>` : ''; return; }
        const dari = start + 1, sampai = Math.min(start + this.perPage, total);
        el.innerHTML = `
            <div class="list-pager">
                <span class="pager-info">Menampilkan ${dari}–${sampai} dari ${total} data</span>
                <div class="pager-btns">
                    <button class="btn btn-secondary btn-sm" onclick="EquipmentPage.goto(1)" ${this.page === 1 ? 'disabled' : ''} title="Halaman pertama">&laquo;</button>
                    <button class="btn btn-secondary btn-sm" onclick="EquipmentPage.goto(${this.page - 1})" ${this.page === 1 ? 'disabled' : ''}>&lsaquo; Prev</button>
                    <span class="pager-info">Halaman ${this.page} / ${pages}</span>
                    <button class="btn btn-secondary btn-sm" onclick="EquipmentPage.goto(${this.page + 1})" ${this.page === pages ? 'disabled' : ''}>Next &rsaquo;</button>
                    <button class="btn btn-secondary btn-sm" onclick="EquipmentPage.goto(${pages})" ${this.page === pages ? 'disabled' : ''} title="Halaman terakhir">&raquo;</button>
                </div>
            </div>`;
    },

    filter() {
        this.page = 1;
        this.applyView();
    },

    openForm(id) {
        const item = id ? this.data.find(e => e.id === id) : {};
        const title = id ? 'Edit Peralatan' : 'Tambah Peralatan Baru';
        const body = `
        <div class="form-row">
            <div class="form-group"><label class="form-label">Jenis Peralatan *</label><input class="form-input" id="f-jenis" value="${Fmt.escape(item.jenis || '')}" required></div>
            <div class="form-group"><label class="form-label">PT / Perusahaan</label>
                <select class="form-select" id="f-pt" onchange="EquipmentPage.onCompanyChange()">
                    <option value="">-- Tanpa PT --</option>
                    ${(this.companies || []).map(c => `<option value="${c.id}" ${item.company_id === c.id ? 'selected' : ''}>${Fmt.escape(c.singkatan || c.nama_perusahaan)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label class="form-label">Kapasitas (angka)</label><input type="number" step="any" class="form-input" id="f-kap-angka" value="${item.kapasitas_angka ?? ''}" placeholder="1,7"></div>
            <div class="form-group"><label class="form-label">Satuan</label><input class="form-input" id="f-kap-satuan" list="satuan-list" value="${Fmt.escape(item.kapasitas_satuan || item.kapasitas || '')}" placeholder="m³ / cc / ton / liter...">
                <datalist id="satuan-list"><option value="m3"></option><option value="m³"></option><option value="cc"></option><option value="liter"></option><option value="ton"></option><option value="inch"></option><option value="m"></option><option value="PK"></option></datalist>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">Jumlah</label><input type="number" class="form-input" id="f-jumlah" value="${item.jumlah || ''}"></div>
            <div class="form-group"><label class="form-label">Tahun Produksi</label><input type="number" class="form-input" id="f-tahun" value="${item.tahun_produksi || ''}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">Merk / Type</label><input class="form-input" id="f-merk" value="${Fmt.escape(item.merk_type || '')}"></div>
            <div class="form-group"><label class="form-label">Kondisi</label>
                <select class="form-select" id="f-kondisi">
                    <option value="Baik" ${item.kondisi === 'Baik' ? 'selected' : ''}>Baik</option>
                    <option value="Rusak Ringan" ${item.kondisi === 'Rusak Ringan' ? 'selected' : ''}>Rusak Ringan</option>
                    <option value="Rusak Berat" ${item.kondisi === 'Rusak Berat' ? 'selected' : ''}>Rusak Berat</option>
                </select>
            </div>
        </div>
        <div class="form-group"><label class="form-label">Lokasi Sekarang</label><input class="form-input" id="f-lokasi" value="${Fmt.escape(item.lokasi_sekarang || '')}"></div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">Bukti Kepemilikan (No. BPKB/Faktur)</label><input class="form-input" id="f-bukti" value="${Fmt.escape(item.bukti_kepemilikan || '')}"></div>
            <div class="form-group">
                <label class="form-label">Upload Berkas Alat (PDF/Image)</label>
                <input type="file" class="form-input" id="f-file" accept="image/*,.pdf" style="margin-bottom:6px;">
                <input type="hidden" id="f-file-url" value="${item.file_url || ''}">

                <div id="prev-eq-file-container" style="display:${item.file_url ? 'flex' : 'none'}; align-items:center; gap:8px; background:var(--bg-tertiary); padding:6px 12px; border-radius:6px; border:1px solid var(--border-color); width:fit-content;">
                    <i data-lucide="file-text" style="width:16px; height:16px; color:var(--text-muted);"></i>
                    <a id="prev-eq-file-link" href="${item.file_url || '#'}" target="_blank" style="font-size:0.8rem; font-weight:500;">Lihat berkas tersimpan</a>
                    <button type="button" onclick="EquipmentPage.deleteFileField('${id || ''}', event)" class="btn btn-danger btn-sm" style="padding:2px 6px; font-size:0.7rem; border-radius:4px; display:inline-flex; align-items:center; gap:2px; height:20px; border:none; cursor:pointer;" title="Hapus Berkas dari Cloud">
                        <i data-lucide="x" style="width:10px; height:10px;"></i> Hapus
                    </button>
                </div>
            </div>
        </div>
        <div class="eq-files">
                    <div class="eq-files-head">
                        <div>
                            <div class="eq-files-title"><i data-lucide="paperclip" style="width:14px;height:14px;"></i> Lampiran per Alat</div>
                            <div class="eq-files-hint">Berkas pendukung alat (BPKB, foto, perjanjian sewa) — boleh dipakai bersama alat lain tanpa upload ulang.</div>
                        </div>
                        <span id="eq-files-count" class="badge badge-info" style="font-size:0.68rem;flex-shrink:0;">0</span>
                    </div>
                    <div id="eq-files-list" class="eq-files-list"></div>
                    <div class="eq-files-actions">
                        <label class="btn btn-secondary btn-sm eq-files-btn" for="f-eq-new-file" style="margin:0;">
                            <i data-lucide="upload" style="width:13px;height:13px;"></i> Unggah File
                        </label>
                        <input type="file" id="f-eq-new-file" accept="image/*,.pdf" class="hidden" onchange="EquipmentPage.fillEqLabel(this)">
                        <button type="button" class="btn btn-secondary btn-sm eq-files-btn" onclick="EquipmentPage.pickSharedFile('${id || ''}')">
                            <i data-lucide="copy" style="width:13px;height:13px;"></i> Pakai File Alat Lain
                        </button>
                    </div>
                    <input type="text" class="form-input" id="f-eq-label" placeholder="Label lampiran (mis. Perjanjian Sewa) — untuk file baru" style="font-size:0.8rem;" oninput="this.dataset.touched='1'">
                    <div class="eq-files-note">
                        <i data-lucide="info" style="width:12px;height:12px;"></i>
                        ${id ? 'Lampiran disimpan terpisah dari "Upload Berkas Alat" di atas.'
                             : 'Lampiran bisa ditambahkan sekarang — ikut tersimpan saat alat disimpan.'}
                    </div>
                </div>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Batal</button>
            <button class="btn btn-primary" onclick="EquipmentPage.save('${id || ''}')">Simpan</button>
        `;
        Modal.open(title, body, footer);
        lucide.createIcons();
        // Lampiran utk alat BARU: di-stage dulu (belum ada id alat buat nyimpen)
        this._pendingFiles = [];
        this._savedFiles = [];      // reset — jangan nyangkut lampiran alat sebelumnya
        this._formId = id || '';
        if (id) this.loadDocFiles(id);
        else this.renderDocFiles();
    },

    // ponytail: mata melihat SEMUA berkas alat (legacy + lampiran per alat, termasuk berbagi)
    async showFiles(id) {
        const e = (this.data || []).find(x => x.id === id) || {};
        const all = [];
        if (e.file_url) all.push({ url: e.file_url, label: 'Berkas utama' });
        try {
            const res = await API.getEquipmentFiles(id);
            (res.data || []).forEach(f => all.push({ url: f.file_url, label: f.label || 'Lampiran' }));
        } catch (err) { Toast.error(err.message); return; }
        if (!all.length) { Toast.info('Belum ada berkas'); return; }
        if (all.length === 1) { window.open(all[0].url, '_blank'); return; }
        Modal.open(`Berkas: ${e.jenis || ''}`,
            `<div style="display:flex; flex-direction:column; gap:8px;">${all.map(f => `
                <a href="${f.url}" target="_blank" style="display:flex; gap:8px; align-items:center; padding:8px 12px; border:1px solid var(--border-color); border-radius:8px; font-size:0.85rem;">
                    <i data-lucide="file-text" style="width:14px; height:14px;"></i>
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${Fmt.escape(f.label)}</span>
                    <i data-lucide="external-link" style="width:14px; height:14px;"></i>
                </a>`).join('')}</div>`,
            '<button class="btn btn-secondary" onclick="Modal.close()">Tutup</button>');
        lucide.createIcons();
    },

    async loadDocFiles(id) {
        const box = document.getElementById('eq-files-list');
        if (!box) return;
        try {
            const res = await API.getEquipmentFiles(id);
            this._savedFiles = res.data || [];
        } catch (e) {
            box.innerHTML = `<small style="color:var(--danger);">Gagal muat: ${e.message}</small>`;
            return;
        }
        this.renderDocFiles();
    },

    // Render daftar lampiran: yg tersimpan di server + yg di-stage (alat baru)
    renderDocFiles() {
        const box = document.getElementById('eq-files-list');
        if (!box) return;
        const saved = this._savedFiles || [];
        const pending = this._pendingFiles || [];
        const badge = document.getElementById('eq-files-count');
        if (badge) badge.textContent = String(saved.length + pending.length);

        const item = ({ icon, name, meta, badges = '', actions }) => `
            <div class="eq-files-item">
                <div class="eq-files-ico"><i data-lucide="${icon}"></i></div>
                <div class="eq-files-txt">
                    <div class="eq-files-name" title="${Fmt.escape(name)}">${Fmt.escape(name)}</div>
                    ${meta ? `<div class="eq-files-meta">${meta}</div>` : ''}
                    ${badges ? `<div class="eq-files-badges">${badges}</div>` : ''}
                </div>
                <div class="eq-files-actions">${actions}</div>
            </div>`;

        const rows = [
            ...saved.map(f => item({
                icon: 'file-text',
                name: f.label || (f.file_url || '').split('/').pop(),
                meta: f.owner_nama ? `milik ${f.owner_nama}${f.owner_pt ? ' · ' + f.owner_pt : ''}` : '',
                badges: (f.shared_count > 0 || f.shared_from)
                    ? `<span class="eq-tag">dipakai ${f.shared_count || 1}x${f.shared_from ? ' · ' + f.shared_from : ''}</span>` : '',
                actions: `<a class="btn btn-secondary btn-sm eq-files-btn" href="${f.file_url}" target="_blank" title="Buka"><i data-lucide="external-link" style="width:12px;height:12px;"></i></a>
                           <button type="button" class="btn btn-danger btn-sm eq-files-btn" data-del-file="${f.id}" data-del-url="${Fmt.escape(f.file_url)}" title="Hapus lampiran"><i data-lucide="trash-2" style="width:12px;height:12px;"></i></button>`
            })),
            ...pending.map((p, i) => item({
                icon: p.kind === 'share' ? 'copy' : 'file-up',
                name: p.label,
                meta: p.kind === 'share' ? 'dipakai dari alat lain' : 'siap diunggah',
                badges: `<span class="eq-tag eq-tag--draft">${p.kind === 'share' ? 'BERAGI' : 'DRAFT'}</span>`,
                actions: `<button type="button" class="btn btn-danger btn-sm eq-files-btn" data-del-pending="${i}" title="Batalkan"><i data-lucide="x" style="width:12px;height:12px;"></i></button>`
            }))
        ];
        box.innerHTML = rows.length ? rows.join('')
            : `<div class="eq-files-empty">
                   <i data-lucide="paperclip" style="width:18px;height:18px;"></i>
                   <span>Belum ada lampiran</span>
                   <small>Unggah berkas pendukung, atau pakai berkas milik alat lain.</small>
               </div>`;
        box.querySelectorAll('[data-del-file]').forEach(b => b.onclick = () => this.delDocFile(
            this._formId || '', b.dataset.delFile, b.dataset.delUrl));
        box.querySelectorAll('[data-del-pending]').forEach(b => b.onclick = () => {
            this._pendingFiles.splice(parseInt(b.dataset.delPending, 10), 1);
            this.renderDocFiles();
        });
        lucide.createIcons({ nodes: [box] });
    },

    // Lampiran untuk alat YANG SUDAH ADA → langsung simpan
    // (alat baru → di-stage, disimpan bareng alatnya)
    // Nama file jadi default label (bisa diubah user)
    fillEqLabel(input) {
        const lab = document.getElementById('f-eq-label');
        const f = input?.files?.[0];
        if (lab && f && !lab.dataset.touched) lab.value = f.name;
    },

    async addDocFile(id) {
        const input = document.getElementById('f-eq-new-file');
        if (!input?.files?.length) { Toast.warning('Pilih file dulu'); return; }
        const file = input.files[0];
        const labEl = document.getElementById('f-eq-label');
        const label = (labEl?.value || '').trim() || file.name;
        const resetInputs = () => {
            input.value = '';
            if (labEl) { labEl.value = ''; delete labEl.dataset.touched; }
        };
        try {
            if (!id) {
                // alat BARU → stage dulu (ikut tersimpan bareng alatnya)
                this._pendingFiles.push({ kind: 'upload', file, label });
                resetInputs();
                this.renderDocFiles();
                Toast.info('Lampiran ditambahkan — ikut tersimpan saat alat disimpan');
                return;
            }
            Toast.info('Mengunggah...');
            const up = await API.uploadFile(file, 'equipment');
            await API.addEquipmentFile(id, { label, file_url: up.url });
            Toast.success('Lampiran ditambahkan');
            resetInputs();
            this.loadDocFiles(id);
        } catch (e) { Toast.error(e.message); }
    },

    // Mekanisme berbagi: pakai berkas milik alat lain tanpa upload ulang.
    // Inline (bukan modal) → form alat tetap utuh.
    // Picker berkas milik alat lain — modal bertumpuk di atas form (form tetap utuh).
    // Daftar bisa 50+ berkas → ada pencarian + filter PT + counter.
    async pickSharedFile(id) {
        let files = [];
        try {
            const res = await API.getAllEquipmentFiles();
            files = res.data || [];
            if (id) {
                // sembunyikan berkas yg sudah terlampir di alat ini
                const mine = await API.getEquipmentFiles(id);
                const used = new Set((mine.data || []).map(f => f.id));
                files = files.filter(f => !used.has(f.id));
            }
        } catch (e) { Toast.error(e.message); return; }

        if (!files.length) {
            Toast.info('Belum ada berkas alat lain yang bisa dipakai');
            return;
        }
        // daftar PT utk filter
        const pts = [...new Map(files.filter(f => f.company_id)
            .map(f => [f.company_id, f.company_singkat || f.company_singkatan || f.nama_perusahaan || 'PT']))
            .values()].sort();

        const body = `
        <div class="eq-bank">
            <div class="eq-bank-tools">
                <div class="search-box eq-bank-search">
                    <i data-lucide="search"></i>
                    <input type="text" id="eq-bank-q" placeholder="Cari nama berkas, alat, atau PT..." autocomplete="off">
                </div>
                <select class="form-select eq-bank-pt" id="eq-bank-pt" style="width:auto;min-width:170px;">
                    <option value="">Semua PT</option>
                    ${pts.map(p => `<option value="${Fmt.escape(p)}">${Fmt.escape(p)}</option>`).join('')}
                </select>
            </div>
            <div class="eq-bank-count" id="eq-bank-count"></div>
            <div class="eq-bank-list" id="eq-bank-list"></div>
        </div>`;

        const layer = Modal.openLayered('Pakai File Alat Lain', body,
            '<button class="btn btn-secondary" data-modal-close>Tutup</button>',
            { maxWidth: 800 });

        // render + filter (client side → responsif utk ratusan berkas)
        const listEl = layer.el.querySelector('#eq-bank-list');
        const countEl = layer.el.querySelector('#eq-bank-count');
        const qEl = layer.el.querySelector('#eq-bank-q');
        const ptEl = layer.el.querySelector('#eq-bank-pt');

        const draw = () => {
            const q = (qEl.value || '').trim().toLowerCase();
            const pt = ptEl.value || '';
            const hits = files.filter(f => {
                if (pt && String(f.company_singkat || f.company_singkatan || f.nama_perusahaan || '') !== pt) return false;
                if (!q) return true;
                const hay = [f.label, f.file_url, f.equipment_nama, f.company_singkat, f.company_singkatan, f.nama_perusahaan]
                    .filter(Boolean).join(' ').toLowerCase();
                return hay.includes(q);
            });
            countEl.textContent = hits.length === files.length
                ? `${files.length} berkas`
                : `${hits.length} dari ${files.length} berkas`;
            if (!hits.length) {
                listEl.innerHTML = '<div class="eq-files-empty"><i data-lucide="search-x" style="width:18px;height:18px;"></i><span>Tidak ada berkas cocok</span></div>';
                lucide.createIcons({ nodes: [listEl] });
                return;
            }
            listEl.innerHTML = hits.map(f => {
                const name = f.label || (f.file_url || '').split('/').pop();
                const pt = f.company_singkat || f.company_singkatan || f.nama_perusahaan || '';
                return `<div class="eq-bank-item">
                    <i data-lucide="file-text" style="width:16px;height:16px;"></i>
                    <div class="eq-bank-txt">
                        <div class="eq-bank-name" title="${Fmt.escape(name)}">${Fmt.escape(name)}</div>
                        <div class="eq-bank-meta">
                            ${pt ? `<span class="eq-tag">${Fmt.escape(pt)}</span>` : ''}
                            ${f.equipment_nama ? `<span>${Fmt.escape(f.equipment_nama)}</span>` : ''}
                            ${f.used_count > 1 ? `<span class="eq-tag">dipakai ${f.used_count - 1}x</span>` : ''}
                        </div>
                    </div>
                    <button type="button" class="btn btn-primary btn-sm" data-pick-file="${f.id}" data-pick-label="${Fmt.escape(name)}">Pakai</button>
                </div>`;
            }).join('');
            listEl.querySelectorAll('[data-pick-file]').forEach(b => b.onclick = () => {
                layer.close();
                this.useSharedFile(id, b.dataset.pickFile, b.dataset.pickLabel);
            });
            lucide.createIcons({ nodes: [listEl] });
        };
        qEl.addEventListener('input', draw);
        ptEl.addEventListener('change', draw);
        draw();
    },

    async useSharedFile(id, fileId, label) {
        try {
            if (!id) {
                this._pendingFiles.push({ kind: 'share', file_id: fileId, label });
                this.renderDocFiles();
                Toast.info('Lampiran ditambahkan — ikut tersimpan saat alat disimpan');
                return;
            }
            await API.addEquipmentFile(id, { file_id: fileId, label });
            Toast.success('Lampiran ditambahkan');
            this.loadDocFiles(id);
        } catch (e) { Toast.error(e.message); }
    },

    // Simpan lampiran yg di-stage (dipakai utk alat baru)
    async savePendingFiles(equipmentId) {
        const pending = this._pendingFiles || [];
        for (const p of pending) {
            if (p.kind === 'share') {
                await API.addEquipmentFile(equipmentId, { file_id: p.file_id, label: p.label });
            } else {
                const up = await API.uploadFile(p.file, 'equipment');
                await API.addEquipmentFile(equipmentId, { label: p.label, file_url: up.url });
            }
        }
        this._pendingFiles = [];
    },

    delDocFile(equipId, fileId, url) {
        // Kalau berkasnya dipakai alat lain → jangan hapus file aslinya (cuma catatan)
        const shared = (this._savedFiles || []).find(f => f.id === fileId);
        const dipakaiLain = shared && (shared.shared_count > 0 || shared.shared_from);
        const pesan = dipakaiLain
            ? `Hapus catatan lampiran ini? Berkas aslinya TIDAK dihapus karena masih dipakai alat lain (${shared.shared_from || 'alat lain'}).`
            : 'Hapus catatan lampiran ini? (berkas storage ikut dihapus)';
        Modal.confirm('Hapus Lampiran', pesan, async () => {
            try {
                if (url && !dipakaiLain) await API.deleteFile(url).catch(() => {});
                await API.deleteEquipmentFile(fileId);
                Toast.success('Lampiran dihapus');
                this.loadDocFiles(equipId);
            } catch (e) { Toast.error(e.message); }
        });
    },

    async deleteFileField(id, event) {
        if (event) event.preventDefault();
        
        const urlInput = document.getElementById('f-file-url');
        const url = urlInput ? urlInput.value : '';
        const fileInput = document.getElementById('f-file');
        
        const resetUI = () => {
            if (urlInput) urlInput.value = '';
            if (fileInput) fileInput.value = '';
            const container = document.getElementById('prev-eq-file-container');
            if (container) container.style.display = 'none';
        };
        
        if (url) {
            Modal.confirm('Hapus Berkas', 'Yakin ingin menghapus berkas alat ini secara permanen dari Supabase Storage?', async () => {
                try {
                    Toast.info('Menghapus berkas...');
                    await API.deleteFile(url);
                    resetUI();
                    
                    if (id) {
                        await API.updateEquipment(id, { file_url: null });
                        const index = this.data.findIndex(x => x.id === id);
                        if (index !== -1) this.data[index].file_url = null;
                        this.applyView();
                    }
                    
                    Toast.success('Berkas berhasil dihapus secara permanen!');
                } catch (err) {
                    Toast.error('Gagal menghapus berkas: ' + err.message);
                }
            });
        } else {
            resetUI();
            Toast.info('Pilihan berkas lokal dihapus.');
        }
    },

    async save(id) {
        const btn = document.querySelector('#modal-footer .btn-primary');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...'; }

        try {
            const fileInput = document.getElementById('f-file');
            let file_url = document.getElementById('f-file-url')?.value || null;

            if (fileInput.files.length) {
                const oldFile = id ? (this.data.find(x => x.id === id)?.file_url) : null;
                if (oldFile && oldFile !== file_url) {
                    await API.deleteFile(oldFile).catch(err => console.warn('Failed to delete old file:', err.message));
                }
                
                const res = await API.uploadFile(fileInput.files[0], 'equipment');
                file_url = res.url;
            }

            const kapAngka = parseFloat(String(document.getElementById('f-kap-angka').value).replace(',', '.')) || null;
            const kapSatuan = document.getElementById('f-kap-satuan').value.trim() || null;
            const data = {
                jenis: document.getElementById('f-jenis').value.trim(),
                company_id: document.getElementById('f-pt')?.value || null,
                kapasitas: [kapAngka, kapSatuan].filter(Boolean).join(' ') || null,
                kapasitas_angka: kapAngka,
                kapasitas_satuan: kapSatuan,
                jumlah: parseInt(document.getElementById('f-jumlah').value) || null,
                tahun_produksi: parseInt(document.getElementById('f-tahun').value) || null,
                merk_type: document.getElementById('f-merk').value.trim(),
                kondisi: document.getElementById('f-kondisi').value,
                lokasi_sekarang: document.getElementById('f-lokasi').value.trim(),
                bukti_kepemilikan: document.getElementById('f-bukti').value.trim(),
                file_url
            };

            if (!data.jenis) { throw new Error('Jenis peralatan wajib diisi'); }

            if (id) {
                await API.updateEquipment(id, data);
                Toast.success('Data alat diperbarui');
            } else {
                const res = await API.createEquipment(data);
                const newId = res.data?.id;
                // lampiran yg di-stage (upload / pakai file alat lain) ikut tersimpan
                if (newId && (this._pendingFiles || []).length) {
                    try { await this.savePendingFiles(newId); }
                    catch (e) { Toast.warning('Alat tersimpan, tapi ada lampiran yg gagal: ' + e.message); }
                }
                Toast.success('Data alat ditambahkan');
            }
            Modal.close();
            this.loadData();
        } catch (e) { 
            Toast.error(e.message); 
            if (btn) { btn.disabled = false; btn.innerHTML = 'Simpan'; }
        }
    },

    remove(id) {
        Modal.confirm('Hapus Peralatan', 'Yakin ingin menghapus data peralatan ini?', async () => {
            try { await API.deleteEquipment(id); Toast.success('Berhasil dihapus'); this.loadData(); }
            catch (e) { Toast.error(e.message); }
        });
    }
};

// Add kondisi badge helper
Fmt.statusKondisi = (k) => {
    const cls = k === 'Baik' ? 'badge-success' : k === 'Rusak Ringan' ? 'badge-warning' : 'badge-danger';
    return `<span class="badge ${cls}">${k || 'N/A'}</span>`;
};
