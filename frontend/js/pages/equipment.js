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
                <select class="form-select" id="f-pt">
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
                <div style="margin-top:10px;">
                    <label class="form-label">Lampiran per Alat ${id ? '(bisa berbagi file milik alat lain)' : '(tersedia setelah Simpan)'}</label>
                    <div id="eq-files-list" style="display:flex; flex-direction:column; gap:6px; margin-bottom:6px;"></div>
                    ${id ? `<div style="display:flex; gap:6px;">
                        <input type="file" class="form-input" id="f-eq-new-file" accept="image/*,.pdf" style="flex:1;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="EquipmentPage.addDocFile('${id}')">+ File</button>
                    </div>` : ''}
                </div>
            </div>
        </div>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Batal</button>
            <button class="btn btn-primary" onclick="EquipmentPage.save('${id || ''}')">Simpan</button>
        `;
        Modal.open(title, body, footer);
        lucide.createIcons();
        if (id) this.loadDocFiles(id);
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
            const files = res.data || [];
            box.innerHTML = files.length ? files.map(f => `
                <div style="display:flex; align-items:center; gap:8px; background:var(--bg-tertiary); padding:6px 12px; border-radius:6px; border:1px solid var(--border-color);">
                    <i data-lucide="file-text" style="width:14px; height:14px; color:var(--text-muted);"></i>
                    <a href="${f.file_url}" target="_blank" style="font-size:0.8rem; font-weight:500; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${Fmt.escape(f.label || f.file_url.split('/').pop())}</a>
                    <button type="button" class="btn btn-danger btn-sm" style="padding:2px 6px; font-size:0.7rem;" onclick="EquipmentPage.delDocFile('${id}','${f.id}','${Fmt.escape(f.file_url)}')">Hapus</button>
                </div>`).join('')
                : '<small style="color:var(--text-muted);">Belum ada lampiran khusus.</small>';
            lucide.createIcons({ nodes: [box] });
        } catch (e) { box.innerHTML = `<small style="color:var(--danger);">Gagal muat: ${e.message}</small>`; }
    },

    async addDocFile(id) {
        const input = document.getElementById('f-eq-new-file');
        if (!input?.files?.length) { Toast.warning('Pilih file dulu'); return; }
        try {
            Toast.info('Mengunggah...');
            const up = await API.uploadFile(input.files[0], 'equipment');
            const label = prompt('Label lampiran (mis. Perjanjian Sewa):', input.files[0].name) || input.files[0].name;
            await API.addEquipmentFile(id, { label, file_url: up.url });
            Toast.success('Lampiran ditambahkan');
            this.loadDocFiles(id);
        } catch (e) { Toast.error(e.message); }
    },

    delDocFile(equipId, fileId, url) {
        Modal.confirm('Hapus Lampiran', 'Hapus catatan lampiran ini? (berkas storage ikut dihapus)', async () => {
            try {
                if (url) await API.deleteFile(url).catch(() => {});
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

            if (id) { await API.updateEquipment(id, data); Toast.success('Data alat diperbarui'); }
            else { await API.createEquipment(data); Toast.success('Data alat ditambahkan'); }
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
