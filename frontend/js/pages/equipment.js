/**
 * TenderBuild — Equipment Page (CRUD)
 */
const EquipmentPage = {
    data: [],

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
            <table>
                <thead><tr>
                    <th>No</th><th>Jenis Peralatan</th><th>Kapasitas</th><th>Jumlah</th>
                    <th>Tahun</th><th>Merk / Type</th><th>Kondisi</th><th>Lokasi</th><th>Berkas</th><th>Aksi</th>
                </tr></thead>
                <tbody id="eq-tbody"><tr><td colspan="9" class="text-center">Memuat...</td></tr></tbody>
            </table>
        </div>`;
    },

    async afterRender() { this.loadData(); },

    async loadData() {
        try {
            const res = await API.getEquipments();
            this.data = res.data || [];
            this.renderTable(this.data);
        } catch (e) {
            const tbody = document.getElementById('eq-tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">Gagal memuat data</td></tr>';
        }
    },

    renderTable(items) {
        const tbody = document.getElementById('eq-tbody');
        if (!tbody) return;
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><i data-lucide="truck"></i><p>Belum ada data peralatan</p></div></td></tr>';
            lucide.createIcons({ nodes: [tbody] }); return;
        }
        tbody.innerHTML = items.map((e, i) => `<tr>
            <td>${i + 1}</td>
            <td style="font-weight:500;color:var(--text-primary);">${Fmt.escape(e.jenis)}</td>
            <td>${Fmt.escape(e.kapasitas) || '-'}</td>
            <td>${e.jumlah || '-'}</td>
            <td>${e.tahun_produksi || '-'}</td>
            <td>${Fmt.escape(e.merk_type) || '-'}</td>
            <td>${Fmt.statusKondisi(e.kondisi)}</td>
            <td>${Fmt.escape(e.lokasi_sekarang) || '-'}</td>
            <td style="text-align:center;">
                ${e.file_url 
                    ? `<a href="${e.file_url}" target="_blank" class="btn btn-secondary btn-icon btn-sm" title="Lihat Berkas"><i data-lucide="file-text"></i></a>` 
                    : `<span style="color:var(--text-muted);font-size:0.8rem;">-</span>`}
            </td>
            <td class="table-actions">
                <button class="btn btn-secondary btn-icon btn-sm" onclick="EquipmentPage.openForm('${e.id}')" title="Edit"><i data-lucide="pencil"></i></button>
                <button class="btn btn-danger btn-icon btn-sm" onclick="EquipmentPage.remove('${e.id}')" title="Hapus"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>`).join('');
        lucide.createIcons({ nodes: [tbody] });
    },

    filter() {
        const q = document.getElementById('eq-search').value.toLowerCase();
        const filtered = this.data.filter(e => (e.jenis + ' ' + e.merk_type + ' ' + e.lokasi_sekarang).toLowerCase().includes(q));
        this.renderTable(filtered);
    },

    openForm(id) {
        const item = id ? this.data.find(e => e.id === id) : {};
        const title = id ? 'Edit Peralatan' : 'Tambah Peralatan Baru';
        const body = `
        <div class="form-row">
            <div class="form-group"><label class="form-label">Jenis Peralatan *</label><input class="form-input" id="f-jenis" value="${Fmt.escape(item.jenis || '')}" required></div>
            <div class="form-group"><label class="form-label">Kapasitas</label><input class="form-input" id="f-kapasitas" value="${Fmt.escape(item.kapasitas || '')}"></div>
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
                <input type="file" class="form-input" id="f-file" accept="image/*,.pdf">
                ${item.file_url ? `<a href="${item.file_url}" target="_blank" style="font-size:0.8rem;margin-top:4px;display:inline-block;">Lihat berkas tersimpan</a>` : ''}
            </div>
        </div>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Batal</button>
            <button class="btn btn-primary" onclick="EquipmentPage.save('${id || ''}')">Simpan</button>
        `;
        Modal.open(title, body, footer);
    },

    async save(id) {
        const btn = document.querySelector('#modal-footer .btn-primary');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...'; }

        try {
            const fileInput = document.getElementById('f-file');
            let file_url = id ? (this.data.find(x => x.id === id).file_url) : null;

            if (fileInput.files.length) {
                const res = await API.uploadFile(fileInput.files[0], 'equipment');
                file_url = res.url;
            }

            const data = {
                jenis: document.getElementById('f-jenis').value.trim(),
                kapasitas: document.getElementById('f-kapasitas').value.trim(),
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
    const cls = k === 'Baik' ? 'badge-green' : k === 'Rusak Ringan' ? 'badge-yellow' : 'badge-red';
    return `<span class="badge ${cls}">${k || 'N/A'}</span>`;
};
