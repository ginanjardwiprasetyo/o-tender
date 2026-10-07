/**
 * TenderBuild — Rekap Hasil Evaluasi per Proyek × Perusahaan
 */
const TenderRecapPage = {
    tenders: [],
    companies: [],
    page: 1,
    perPage: 10,
    _alasanBag: [],

    async render() {
        return `
        <div class="recap-header">
            <div class="header-left">
                <h2>Rekap Tender</h2>
                <p>Hasil evaluasi per proyek dan per perusahaan</p>
            </div>
            <div class="header-actions">
                <button class="btn btn-secondary" onclick="window.print()" title="Cetak / simpan PDF">
                    <i data-lucide="printer" style="width:16px;height:16px;"></i> Cetak
                </button>
                <a href="#tender-manage" class="btn btn-primary"><i data-lucide="arrow-left" style="width:16px;height:16px;"></i> Tender Saya</a>
            </div>
        </div>

        <div id="recap-stats" class="summary-stats" style="margin-bottom:20px;"></div>
        <div id="recap-body">
            <div class="page-loading" style="height:300px;">
                <div class="spinner"></div>
                <p>Memuat data rekap...</p>
            </div>
        </div>

        <style>
            .recap-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 22px; }
            .recap-header h2 { font-size: 1.8rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px; }
            .recap-header p { color: var(--text-muted); font-size: 0.95rem; }
            .recap-header .header-actions { display: flex; gap: 10px; flex: 0 0 auto; }
            .recap-header .btn { text-decoration: none; }

            /* ── Tabel rekap ─────────────────────────────── */
            .recap-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.9rem; }
            .recap-table th {
                background: var(--bg-primary);
                color: var(--text-muted);
                font-size: 0.72rem;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                font-weight: 700;
                padding: 12px 14px;
                text-align: left;
                border-bottom: 2px solid var(--border-color);
                white-space: nowrap;
                position: sticky;
                top: 0;
                z-index: 2;
            }
            .recap-table td {
                background: var(--bg-card);
                padding: 13px 14px;
                border-bottom: 1px solid var(--border-color);
                vertical-align: middle;
                min-width: 200px;
                max-width: 340px;
                color: var(--text-secondary);
                line-height: 1.5;
                overflow-wrap: anywhere;
            }
            /* Garis vertikal antar kolom */
            .recap-table th + th,
            .recap-table td + td { border-left: 1px solid var(--border-color); }
            .recap-table .col-proyek + th,
            .recap-table .col-proyek + td { border-left: none; } /* proyek sudah punya border-right */
            .recap-table tbody tr:nth-child(even) td { background: var(--bg-primary); }
            .recap-table tbody tr:hover td { box-shadow: inset 0 0 0 9999px rgba(128, 128, 128, 0.08); }

            /* Badge pill lembut di dalam tabel */
            .recap-table .badge { border-radius: 999px; padding: 3px 11px; font-size: 0.75rem; }

            /* Kolom No */
            .recap-table .col-no { min-width: 46px; max-width: 46px; text-align: center; font-size: 0.8rem; color: var(--text-muted); font-weight: 600; }

            /* Kolom perusahaan — ringkas, isi di tengah */
            .recap-table .col-comp { min-width: 96px; max-width: 170px; text-align: center; }

            /* Kolom Proyek — sticky saat scroll horizontal */
            .recap-table .col-proyek {
                position: sticky;
                left: 0;
                z-index: 1;
                min-width: 250px;
                max-width: 320px;
                border-right: 1px solid var(--border-color);
            }
            .recap-table .col-pemenang { min-width: 170px; font-weight: 600; color: var(--text-primary); }

            .recap-proyek-nama {
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                font-weight: 700;
                font-size: 0.9rem;
                line-height: 1.4;
                color: var(--text-primary);
                text-decoration: none;
            }
            .recap-proyek-nama:hover { color: var(--accent); text-decoration: underline; }

            /* Ikon segitiga ! pemicu popup alasan (menempel pada badge Kalah) */
            .alasan-trigger {
                display: inline-flex; align-items: center; justify-content: center;
                border: none; background: transparent; cursor: pointer;
                color: var(--danger); padding: 2px; margin-left: 5px;
                border-radius: 4px; vertical-align: middle;
            }
            .alasan-trigger:hover { background: rgba(239, 68, 68, 0.12); }

            /* Popup alasan: mengambang, terkunci di dalam tabel, hanya teks */
            .table-container { position: relative; }
            .alasan-pop {
                position: absolute;
                z-index: 30;
                width: min(360px, calc(100% - 16px));
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                box-shadow: var(--shadow-lg);
                padding: 12px 14px;
                font-size: 0.85rem;
                line-height: 1.6;
                color: var(--text-secondary);
            }
            .recap-none { color: var(--text-muted); opacity: 0.4; }
            .recap-menang-kita { color: var(--success); font-weight: 700; display: inline-flex; align-items: center; gap: 4px; }

            @media (max-width: 768px) {
                .recap-header { flex-direction: column; align-items: flex-start; }
                .recap-header .header-actions { width: 100%; }
                .recap-header .header-actions .btn { flex: 1; justify-content: center; }
            }

            /* ── Cetak / PDF ────────────────────────────── */
            @media print {
                #sidebar, .topbar { display: none !important; }
                .main-content { margin: 0 !important; padding: 0 !important; }
                .page-container { padding: 0 !important; max-width: none !important; }
                .recap-header .header-actions, .list-pager { display: none !important; }
                .table-container { overflow: visible !important; }
                .recap-table th, .recap-table .col-proyek { position: static !important; }
                .recap-table { font-size: 0.78rem; }
                .recap-table td, .recap-table th { padding: 8px 10px; }
                * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                @page { margin: 12mm; }
            }
        </style>
        `;
    },

    async afterRender() {
        try {
            const [fRes, cRes] = await Promise.all([
                API.getFollowedTenders(),
                API.getCompanies().catch(() => ({ data: [] }))
            ]);
            this.tenders = fRes.data || [];
            this.companies = (cRes.data || []).filter(c => c.nama_perusahaan);
            this.page = 1;
            this.renderStats();
            this.renderTable();
        } catch (e) {
            console.error(e);
            const el = document.getElementById('recap-body');
            if (el) el.innerHTML = `<div class="empty-state"><i data-lucide="alert-circle" style="color:var(--danger);"></i><p style="color:var(--danger);">Gagal memuat rekap: ${Fmt.escape(e.message)}</p></div>`;
            lucide.createIcons({ nodes: [el] });
        }
    },

    renderStats() {
        const el = document.getElementById('recap-stats');
        if (!el) return;
        const menang = this.tenders.filter(t => t.status === 'Menang').length;
        const kalah = this.tenders.filter(t => t.status === 'Kalah').length;
        const diproses = this.tenders.filter(t => t.status !== 'Menang' && t.status !== 'Kalah').length;
        const chip = (dot, label, val) => `
            <div class="stat-chip">
                <span class="chip-dot" style="background:${dot}"></span>
                <div><div class="chip-label">${label}</div><div class="chip-val">${val}</div></div>
            </div>`;
        el.innerHTML =
            chip('var(--accent)', 'Proyek', this.tenders.length) +
            chip('var(--success)', 'Menang', menang) +
            chip('var(--danger)', 'Kalah', kalah) +
            chip('var(--info)', 'Diproses', diproses);
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

    _nama(p) {
        return typeof p === 'string' ? p : (p && p.nama) || '';
    },

    _pemenang(t) {
        const w = (t.history_pemenang || '').trim();
        if (w) return w;
        const a = t.history_alasan || '';
        return a.startsWith('Pemenang:') ? a.slice(9).trim() : '';
    },

    _cell(t, c) {
        const badge = (cls, label) => `<span class="badge badge-${cls}">${label}</span>`;
        const alasanBtn = (alasan) => {
            if (!alasan) return '';
            this._alasanBag.push({ alasan });
            const i = this._alasanBag.length - 1;
            return `<button class="alasan-trigger" onclick="TenderRecapPage.showAlasan(${i}, this, event)" title="Lihat alasan"><i data-lucide="alert-triangle" style="width:15px;height:15px;"></i></button>`;
        };

        if (t.status === 'Menang') {
            const peserta = Array.isArray(t.history_peserta) ? t.history_peserta : [];
            const winner = this._nama(peserta[0]) || this._pemenang(t);
            if (!winner) return badge('success', 'Menang');
            return this._cocok(winner, c.nama_perusahaan)
                ? badge('success', 'Menang')
                : '<span class="recap-none">—</span>';
        }

        if (t.status === 'Kalah') {
            const peserta = Array.isArray(t.history_peserta) ? t.history_peserta : [];
            if (!peserta.length) {
                // Baris lama tanpa data per perusahaan
                return badge('danger', 'Kalah') + alasanBtn(t.history_alasan || '');
            }
            const entry = peserta.find(p => this._cocok(this._nama(p), c.nama_perusahaan));
            if (!entry) return '<span class="recap-none">—</span>';
            return badge('danger', 'Kalah') + alasanBtn(entry.alasan || '');
        }

        return badge('info', 'Diproses');
    },

    _alasanHtml(i) {
        const a = this._alasanBag[i];
        return a ? Fmt.escape(a.alasan) : '';
    },

    showAlasan(i, btn, ev) {
        if (ev) ev.stopPropagation();
        this.closeAlasan();
        const html = this._alasanHtml(i);
        const cont = btn && btn.closest('.table-container');
        if (!html || !cont) return;

        const pop = document.createElement('div');
        pop.id = 'alasan-pop';
        pop.className = 'alasan-pop';
        pop.innerHTML = html;
        cont.appendChild(pop);

        // Terkunci pada sel pemicu & di-clamp tetap di dalam area tabel
        const cr = cont.getBoundingClientRect(), br = btn.getBoundingClientRect();
        const w = pop.offsetWidth, h = pop.offsetHeight;
        const sl = cont.scrollLeft, st = cont.scrollTop;
        let left = br.left - cr.left + sl + br.width / 2 - w / 2;
        left = Math.min(Math.max(sl + 8, left), sl + cont.clientWidth - w - 8);
        let top = br.bottom - cr.top + st + 8;
        if (top + h > st + cont.clientHeight - 8) top = br.top - cr.top + st - h - 8;
        top = Math.min(Math.max(st + 8, top), st + cont.clientHeight - h - 8);
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';

        this._onOutside = (e) => { if (!pop.contains(e.target)) this.closeAlasan(); };
        this._onKey = (e) => { if (e.key === 'Escape') this.closeAlasan(); };
        document.addEventListener('click', this._onOutside, true);
        document.addEventListener('keydown', this._onKey);
    },

    closeAlasan() {
        const pop = document.getElementById('alasan-pop');
        if (pop) pop.remove();
        if (this._onOutside) document.removeEventListener('click', this._onOutside, true);
        if (this._onKey) document.removeEventListener('keydown', this._onKey);
        this._onOutside = this._onKey = null;
    },

    _cellPemenang(t) {
        const w = this._pemenang(t);
        if (!w) return '<span class="recap-none">—</span>';
        const kita = this.companies.some(c => this._cocok(w, c.nama_perusahaan));
        return kita
            ? `<span class="recap-menang-kita"><i data-lucide="trophy" style="width:14px;height:14px;"></i>${Fmt.escape(w)}</span>`
            : Fmt.escape(w);
    },

    goto(p) {
        const total = Math.max(1, Math.ceil(this.tenders.length / this.perPage));
        this.page = Math.min(Math.max(1, p), total);
        this.renderTable();
        const body = document.getElementById('recap-body');
        if (body) body.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    renderTable() {
        const el = document.getElementById('recap-body');
        if (!el) return;
        this.closeAlasan();

        if (!this.tenders.length) {
            el.innerHTML = `<div class="empty-state">
                <i data-lucide="inbox" style="opacity:0.3;"></i>
                <p style="margin-top:12px;">Belum ada tender untuk direkap.</p>
                <a href="#tender-browse" class="btn btn-primary" style="margin-top:12px;">Cari Tender</a>
            </div>`;
            lucide.createIcons({ nodes: [el] });
            return;
        }

        const total = Math.ceil(this.tenders.length / this.perPage);
        this.page = Math.min(Math.max(1, this.page), total);
        const start = (this.page - 1) * this.perPage;
        const slice = this.tenders.slice(start, start + this.perPage);
        this._alasanBag = [];

        const heads = this.companies.map(c => {
            const label = ((c.singkatan || '').trim()) || c.nama_perusahaan;
            return `<th class="col-comp" title="${Fmt.escape(c.nama_perusahaan)}">${Fmt.escape(label)}</th>`;
        }).join('');
        const rows = slice.map((t, i) => `
            <tr>
                <td class="col-no">${start + i + 1}</td>
                <td class="col-proyek">
                    <a class="recap-proyek-nama" href="https://spse.inaproc.id/${t.slug || 'lpse'}/evaluasi/${t.kode_tender}/hasil" target="_blank" rel="noopener" title="Buka laman hasil di SPSE">${Fmt.escape(t.nama_tender)}</a>
                </td>
                <td class="col-pemenang">${this._cellPemenang(t)}</td>
                ${this.companies.map(c => `<td class="col-comp">${this._cell(t, c)}</td>`).join('')}
            </tr>
        `).join('');

        const dari = start + 1, sampai = Math.min(start + this.perPage, this.tenders.length);
        el.innerHTML = `
            <div class="table-container">
                <table class="recap-table">
                    <thead>
                        <tr>
                            <th class="col-no">No</th>
                            <th class="col-proyek">Proyek</th>
                            <th class="col-pemenang"><i data-lucide="trophy" style="width:13px;height:13px;vertical-align:-2px;"></i> Pemenang</th>
                            ${heads}
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="list-pager">
                <span class="pager-info">Menampilkan ${dari}–${sampai} dari ${this.tenders.length} proyek</span>
                <div class="pager-btns">
                    <button class="btn btn-secondary btn-sm" onclick="TenderRecapPage.goto(1)" ${this.page === 1 ? 'disabled' : ''} title="Halaman pertama">&laquo;</button>
                    <button class="btn btn-secondary btn-sm" onclick="TenderRecapPage.goto(${this.page - 1})" ${this.page === 1 ? 'disabled' : ''}>&lsaquo; Prev</button>
                    <span class="pager-info">Halaman ${this.page} / ${total}</span>
                    <button class="btn btn-secondary btn-sm" onclick="TenderRecapPage.goto(${this.page + 1})" ${this.page === total ? 'disabled' : ''}>Next &rsaquo;</button>
                    <button class="btn btn-secondary btn-sm" onclick="TenderRecapPage.goto(${total})" ${this.page === total ? 'disabled' : ''} title="Halaman terakhir">&raquo;</button>
                </div>
            </div>
            ${!this.companies.length ? '<p style="font-size:0.8rem;color:var(--text-muted);margin-top:10px;">Kolom perusahaan belum muncul — tambahkan data perusahaan dulu.</p>' : ''}
        `;
        lucide.createIcons({ nodes: [el] });
    }
};
