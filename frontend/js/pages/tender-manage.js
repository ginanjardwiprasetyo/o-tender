/**
 * TenderBuild — Manage Followed Tenders
 */
const TenderManagePage = {
    data: [],
    companies: [],
    page: 1,
    perPage: 10,

    async render() {
        return `
        <div class="manage-header">
            <div class="header-left">
                <h2>Tender Saya</h2>
                <p>Monitoring dan kelola paket yang sedang Anda ikuti</p>
            </div>
            <button class="btn btn-primary" onclick="location.hash='#tender-recap'" title="Rekap hasil evaluasi per perusahaan">
                <i data-lucide="table-2" style="width:16px;height:16px;"></i> Rekap Hasil
            </button>
        </div>

        <div id="tm-summary" class="summary-stats" style="margin-bottom:22px;"></div>

        <div id="tm-list" class="manage-content">
            <div class="page-loading" style="height:300px;">
                <div class="spinner"></div>
                <p>Memuat daftar tender...</p>
            </div>
        </div>

        <style>
            .manage-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; gap: 20px; }
            .header-left h2 { font-size: 1.8rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px; }
            .header-left p { color: var(--text-muted); font-size: 0.95rem; }

            .manage-content { display: flex; flex-direction: column; gap: 16px; }

            .followed-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 16px;
                padding: 22px 24px;
                display: grid;
                grid-template-columns: 1fr 270px;
                gap: 24px;
                transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
                position: relative;
                overflow: hidden;
            }
            .followed-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow-md); }

            /* Strip status di sisi kiri kartu */
            .followed-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--accent); }
            .followed-card.f-menang::before   { background: var(--success); }
            .followed-card.f-kalah::before    { background: var(--danger); }
            .followed-card.f-diproses::before { background: var(--accent); }

            .card-main { min-width: 0; }
            .card-title { font-size: 1.08rem; font-weight: 700; color: var(--text-primary); line-height: 1.45; }
            .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
            .card-head .badge { flex: 0 0 auto; margin-top: 2px; }

            .card-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
            .info-box { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
            .info-label { font-size: 0.63rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: var(--text-muted); }
            .info-val { font-size: 0.86rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

            .card-side {
                background: var(--bg-primary);
                border-radius: 12px;
                padding: 16px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                gap: 14px;
                border: 1px solid var(--border-subtle);
            }
            .side-price .val { font-size: 1.15rem; font-weight: 800; color: var(--accent); margin-top: 2px; }
            .side-deadline { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-top: 10px; display: flex; align-items: center; gap: 6px; }
            .side-deadline .lewat { color: var(--danger); font-weight: 700; }

            .card-actions { display: flex; gap: 8px; }
            .card-actions .btn { height: 36px; font-size: 0.8rem; padding: 0; justify-content: center; }
            .card-actions .btn-icon { flex: 1; }

            @media (max-width: 850px) {
                .followed-card { grid-template-columns: 1fr; }
                .manage-header { flex-direction: column; align-items: flex-start; }
                .manage-header .btn { width: 100%; justify-content: center; }
            }
        </style>
        `;
    },

    async afterRender() {
        this.loadData();
    },

    async loadData() {
        try {
            const [fRes, cRes] = await Promise.all([
                API.getFollowedTenders(),
                API.getCompanies().catch(() => ({ data: [] }))
            ]);
            this.data = fRes.data || [];
            this.companies = (cRes.data || []).filter(c => c.nama_perusahaan);
            this.page = 1;
            this.renderSummary();
            this.renderList();
        } catch (e) {
            console.error(e);
            const listEl = document.getElementById('tm-list');
            if (listEl) listEl.innerHTML = '<div class="empty-state"><p>Gagal memuat data diikuti</p></div>';
        }
    },

    renderSummary() {
        const total = this.data.length;
        const menang = this.data.filter(t => t.status === 'Menang').length;
        const kalah = this.data.filter(t => t.status === 'Kalah').length;
        const diproses = this.data.filter(t => t.status !== 'Menang' && t.status !== 'Kalah').length;
        const totalPagu = this.data.reduce((sum, t) => sum + (parseFloat(t.pagu) || 0), 0);

        const el = document.getElementById('tm-summary');
        if (!el) return;

        const chip = (dot, label, val) => `
            <div class="stat-chip">
                <span class="chip-dot" style="background:${dot}"></span>
                <div><div class="chip-label">${label}</div><div class="chip-val">${val}</div></div>
            </div>`;

        el.innerHTML =
            chip('var(--accent)', 'Diikuti', total) +
            chip('var(--success)', 'Menang', menang) +
            chip('var(--danger)', 'Kalah', kalah) +
            chip('var(--info)', 'Diproses', diproses) +
            chip('var(--warning)', 'Estimasi Pagu', Fmt.rupiah(totalPagu));
    },

    _norm(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    },

    _cocok(nama, kandidat) {
        const n = this._norm(nama);
        const k = this._norm(kandidat);
        if (!k) return false;
        if (k === n || (k.length >= 8 && n.includes(k))) return true;
        // Tanpa awalan cv/pt: "GARREL MULTI PERKASA" = "CV Garrel Multi Perkasa"
        const core = s => this._norm(s).replace(/^(cv|pt|persero|perum|koperasi)/, '');
        const nc = core(nama), kc = core(kandidat);
        return nc.length >= 8 && kc.length >= 8 && nc.includes(kc);
    },

    _pemenang(t) {
        const w = (t.history_pemenang || '').trim();
        if (w) return w;
        const a = t.history_alasan || '';
        return a.startsWith('Pemenang:') ? a.slice(9).trim() : '';
    },

    /** Badge: Kalah(n) bila semua perusahaan kalah; Menang(n) bila ada yang menang */
    _statusBadge(t) {
        if (t.status === 'Menang') {
            const w = this._pemenang(t);
            const n = w ? this.companies.filter(c => this._cocok(w, c.nama_perusahaan)).length : 0;
            return `<span class="badge badge-success">Menang(${Math.max(1, n)})</span>`;
        }
        if (t.status === 'Kalah') {
            const peserta = Array.isArray(t.history_peserta) ? t.history_peserta : [];
            if (!peserta.length) return '<span class="badge badge-danger">Kalah</span>';
            return `<span class="badge badge-danger">Kalah(${peserta.length})</span>`;
        }
        return '<span class="badge badge-info">Diproses</span>';
    },

    _fmtDeadline(d) {
        if (!d) return null;
        const dt = new Date(d);
        const label = isNaN(dt.getTime())
            ? d
            : dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        return { label, past: !isNaN(dt.getTime()) && dt < new Date() };
    },

    goto(p) {
        const total = Math.max(1, Math.ceil(this.data.length / this.perPage));
        this.page = Math.min(Math.max(1, p), total);
        this.renderList();
        const list = document.getElementById('tm-list');
        if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    renderList() {
        const el = document.getElementById('tm-list');
        if (!this.data.length) {
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

        const total = Math.ceil(this.data.length / this.perPage);
        this.page = Math.min(Math.max(1, this.page), total);
        const start = (this.page - 1) * this.perPage;
        const slice = this.data.slice(start, start + this.perPage);

        const cards = slice.map(t => {
            const st = t.status === 'Menang' ? 'menang' : t.status === 'Kalah' ? 'kalah' : 'diproses';
            const badge = this._statusBadge(t);
            const dl = this._fmtDeadline(t.deadline);
            const spse = `https://spse.inaproc.id/${t.slug || 'lpse'}/evaluasi/${t.kode_tender}/hasil`;

            return `
        <div class="followed-card f-${st}">
            <div class="card-main">
                <div class="card-head">
                    <div class="card-title">${Fmt.escape(t.nama_tender)}</div>
                    ${badge}
                </div>
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
                        <div class="info-val">${Fmt.escape(t.kode_tender)}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">Tahun Anggaran</div>
                        <div class="info-val">${Fmt.escape(String(t.tahun || '-'))}</div>
                    </div>
                    <div class="info-box" style="grid-column: 1 / -1;">
                        <div class="info-label">Lokasi Pekerjaan</div>
                        <div class="info-val" title="${Fmt.escape(t.lokasi_pekerjaan)}">${Fmt.escape(t.lokasi_pekerjaan || '-')}</div>
                    </div>
                </div>
            </div>
            <div class="card-side">
                <div>
                    <div class="side-price">
                        <div class="info-label">Nilai Pagu</div>
                        <div class="val">${Fmt.rupiah(t.pagu)}</div>
                    </div>
                    ${dl ? `<div class="side-deadline"><i data-lucide="clock" style="width:14px;height:14px;"></i> Batas: <span class="${dl.past ? 'lewat' : ''}">${Fmt.escape(dl.label)}${dl.past ? ' (lewat)' : ''}</span></div>` : ''}
                </div>
                <div class="card-actions">
                    <button class="btn btn-primary btn-icon" title="Detail" onclick="TenderManagePage.viewDetail('${t.kode_tender}', '${t.slug || 'lpse'}')">
                        <i data-lucide="eye"></i>
                    </button>
                    <a class="btn btn-secondary btn-icon" href="${spse}" target="_blank" rel="noopener" title="Buka laman hasil evaluasi di SPSE">
                        <i data-lucide="file-search"></i>
                    </a>
                    <button class="btn btn-danger btn-icon" title="Berhenti ikuti" onclick="TenderManagePage.remove('${t.id}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        </div>`;
        }).join('');

        const dari = start + 1, sampai = Math.min(start + this.perPage, this.data.length);
        const pager = total > 1 ? `
            <div class="list-pager">
                <span class="pager-info">Menampilkan ${dari}–${sampai} dari ${this.data.length} proyek</span>
                <div class="pager-btns">
                    <button class="btn btn-secondary btn-sm" onclick="TenderManagePage.goto(1)" ${this.page === 1 ? 'disabled' : ''} title="Halaman pertama">&laquo;</button>
                    <button class="btn btn-secondary btn-sm" onclick="TenderManagePage.goto(${this.page - 1})" ${this.page === 1 ? 'disabled' : ''}>&lsaquo; Prev</button>
                    <span class="pager-info">Halaman ${this.page} / ${total}</span>
                    <button class="btn btn-secondary btn-sm" onclick="TenderManagePage.goto(${this.page + 1})" ${this.page === total ? 'disabled' : ''}>Next &rsaquo;</button>
                    <button class="btn btn-secondary btn-sm" onclick="TenderManagePage.goto(${total})" ${this.page === total ? 'disabled' : ''} title="Halaman terakhir">&raquo;</button>
                </div>
            </div>` : '';

        el.innerHTML = cards + pager;
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
