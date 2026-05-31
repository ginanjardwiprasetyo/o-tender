/**
 * TenderBuild — Manage Followed Tenders
 */
const TenderManagePage = {
    data: [],

    async render() {
        return `
        <div class="manage-header">
            <div class="header-left">
                <h2>Tender Saya</h2>
                <p>Monitoring dan kelola paket yang sedang Anda ikuti</p>
            </div>
            <div id="tm-summary" class="header-right">
                <!-- Stats will be rendered here -->
            </div>
        </div>

        <div id="tm-list" class="manage-content">
            <div class="page-loading" style="height:300px;">
                <div class="spinner"></div>
                <p>Memuat daftar tender...</p>
            </div>
        </div>

        <style>
            .manage-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; gap: 20px; }
            .header-left h2 { font-size: 1.8rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px; }
            .header-left p { color: var(--text-muted); font-size: 0.95rem; }
            
            .summary-stats { display: flex; gap: 16px; }
            .stat-box { background: var(--bg-card); border: 1px solid var(--border-color); padding: 12px 20px; border-radius: 12px; box-shadow: var(--shadow-sm); text-align: right; }
            .stat-label { font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 2px; }
            .stat-val { font-size: 1.1rem; font-weight: 800; color: var(--accent); }

            .manage-content { display: flex; flex-direction: column; gap: 16px; }
            
            .followed-card { 
                background: var(--bg-card); 
                border: 1px solid var(--border-color); 
                border-radius: 16px; 
                padding: 24px; 
                display: grid; 
                grid-template-columns: 1fr 280px; 
                gap: 24px;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            .followed-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow-md); }
            .followed-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--accent); opacity: 0.5; }

            .card-main { min-width: 0; }
            .card-title { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; line-height: 1.4; }
            
            .card-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .info-box { display: flex; flex-direction: column; gap: 2px; }
            .info-label { font-size: 0.65rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); }
            .info-val { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

            .card-side { 
                background: var(--bg-primary); 
                border-radius: 12px; 
                padding: 16px; 
                display: flex; 
                flex-direction: column; 
                justify-content: space-between; 
                border: 1px solid var(--border-subtle);
            }
            .side-price { margin-bottom: 12px; }
            .side-price .val { font-size: 1.15rem; font-weight: 800; color: var(--accent); }
            
            .card-actions { display: flex; gap: 8px; margin-top: auto; }
            .card-actions .btn { flex: 1; justify-content: center; height: 36px; font-size: 0.8rem; }

            @media (max-width: 850px) {
                .followed-card { grid-template-columns: 1fr; }
                .manage-header { flex-direction: column; align-items: flex-start; }
                .summary-stats { width: 100%; }
                .stat-box { flex: 1; }
            }
        </style>
        `;
    },

    async afterRender() {
        this.loadData();
    },

    async loadData() {
        try {
            const res = await API.getFollowedTenders();
            this.data = res.data || [];
            this.renderSummary();
            this.renderList(this.data);
        } catch (e) { 
            console.error(e);
            const listEl = document.getElementById('tm-list');
            if (listEl) listEl.innerHTML = '<div class="empty-state"><p>Gagal memuat data diikuti</p></div>'; 
        }
    },

    renderSummary() {
        const total = this.data.length;
        const totalPagu = this.data.reduce((sum, t) => sum + (parseFloat(t.pagu) || 0), 0);
        
        const el = document.getElementById('tm-summary');
        if (!el) return;

        el.innerHTML = `
            <div class="summary-stats">
                <div class="stat-box">
                    <div class="stat-label">Total Diikuti</div>
                    <div class="stat-val">${total} Paket</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Estimasi Nilai</div>
                    <div class="stat-val">${Fmt.rupiah(totalPagu)}</div>
                </div>
            </div>
        `;
    },

    renderList(items) {
        const el = document.getElementById('tm-list');
        if (!items.length) {
            el.innerHTML = `
                <div class="empty-state" style="padding: 60px 20px;">
                    <div style="width: 80px; height: 80px; background: var(--bg-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <i data-lucide="folder-kanban" style="width: 40px; height: 40px; opacity: 0.2;"></i>
                    </div>
                    <p style="font-weight: 700; color: var(--text-primary); font-size: 1.1rem;">Belum ada tender diikuti</p>
                    <p style="color: var(--text-muted); max-width: 300px; margin: 8px auto 20px;">Anda belum menambahkan paket tender apapun ke dalam daftar pantauan.</p>
                    <a href="#tender-browse" class="btn btn-primary">Cari Tender Sekarang</a>
                </div>`;
            lucide.createIcons({ nodes: [el] }); return;
        }

        el.innerHTML = items.map(t => `
        <div class="followed-card">
            <div class="card-main">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12px;">
                    <div class="card-title" style="margin-bottom:0;">${Fmt.escape(t.nama_tender)}</div>
                    ${t.status && t.status !== 'Diproses' ? `<span class="badge badge-${t.status === 'Menang' ? 'success' : 'danger'}">${t.status}</span>` : '<span class="badge badge-info">Diproses</span>'}
                </div>
                ${t.status === 'Kalah' ? `<div style="background:rgba(239,68,68,0.1); border-left:3px solid var(--danger); padding:8px 12px; border-radius:4px; font-size:0.8rem; color:var(--danger); margin-bottom:12px;"><i data-lucide="external-link" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Cek hasil evaluasi di <a href="https://spse.inaproc.id/${t.slug || 'lpse'}/evaluasi/${t.kode_tender}/hasil" target="_blank" style="color:var(--danger);text-decoration:underline;font-weight:700;">SPSE &rarr;</a></div>` : ''}
                <div class="card-info-grid">
                    <div class="info-box">
                        <div class="info-label">K/L/PD</div>
                        <div class="info-val" title="${Fmt.escape(t.klpd)}">${Fmt.escape(t.klpd || '-')}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Satuan Kerja</div>
                        <div class="info-val" title="${Fmt.escape(t.satuan_kerja)}">${Fmt.escape(t.satuan_kerja || '-')}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Kode Tender</div>
                        <div class="info-val">${t.kode_tender}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Tahun Anggaran</div>
                        <div class="info-val">${t.tahun}</div>
                    </div>
                    <div class="info-box" style="grid-column: 1 / -1;">
                        <div class="info-label">Lokasi Pekerjaan</div>
                        <div class="info-val">${Fmt.escape(t.lokasi_pekerjaan || '-')}</div>
                    </div>
                </div>
            </div>
            <div class="card-side">
                <div class="side-price">
                    <div class="info-label">Nilai Pagu</div>
                    <div class="val">${Fmt.rupiah(t.pagu)}</div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-secondary" onclick="TenderManagePage.viewDetail('${t.kode_tender}', '${t.slug || 'lpse'}')">
                        <i data-lucide="eye"></i> Detail
                    </button>
                    <a class="btn btn-secondary" href="https://spse.inaproc.id/${t.slug || 'lpse'}/evaluasi/${t.kode_tender}/hasil" target="_blank" style="text-decoration:none;">
                        <i data-lucide="file-search"></i> Evaluasi
                    </a>
                    <button class="btn btn-danger btn-icon" onclick="TenderManagePage.remove('${t.id}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        </div>`).join('');
        lucide.createIcons({ nodes: [el] });
    },

    viewDetail(kode, slug) {
        location.hash = `#tender-detail/${kode}/${slug || 'lpse'}`;
    },

    remove(id) {
        Modal.confirm('Hapus Tender', 'Yakin ingin berhenti mengikuti tender ini? Data yang sudah tersimpan akan dihapus dari daftar pantauan.', async () => {
            try { 
                await API.deleteFollowedTender(id); 
                Toast.success('Tender berhasil dihapus dari daftar'); 
                this.loadData(); 
            }
            catch(e) { Toast.error(e.message); }
        });
    }
};
