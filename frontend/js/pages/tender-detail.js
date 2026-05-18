/**
 * TenderBuild — Tender Detail Page
 * Clean, structured, and professional layout
 */
const TenderDetailPage = {
    async render() {
        return `
        <div class="detail-outer">
            <div class="detail-nav">
                <a href="#tender-browse" class="btn-back"><i data-lucide="arrow-left"></i> Kembali</a>
                <div class="nav-right">
                    <button id="btn-follow-tender" class="btn btn-primary btn-sm"><i data-lucide="bookmark"></i> Ikuti Tender</button>
                    <a id="td-external" target="_blank" class="btn btn-secondary btn-sm"><i data-lucide="external-link"></i> Website SPSE</a>
                </div>
            </div>

            <div id="td-container">
                <div class="page-loading" style="height:300px;"><div class="spinner"></div><p>Sinkronisasi data SPSE...</p></div>
            </div>
        </div>

        <style>
            .detail-outer { max-width: 1100px; margin: 0 auto; padding: 20px; }
            .detail-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); }
            .btn-back { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); text-decoration: none; font-weight: 600; font-size: 0.9rem; }
            .btn-back:hover { color: var(--accent); }

            .detail-header-card { background: var(--bg-card); border-radius: 16px; padding: 30px; margin-bottom: 24px; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); }
            .detail-title { font-size: 1.6rem; font-weight: 800; line-height: 1.3; color: var(--text-primary); margin-bottom: 20px; }
            .detail-badges { display: flex; gap: 12px; flex-wrap: wrap; }
            .badge-item { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: 8px; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; }
            
            .detail-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
            
            .detail-main { display: flex; flex-direction: column; gap: 24px; }
            .detail-side { display: flex; flex-direction: column; gap: 24px; }

            .section-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; overflow: hidden; }
            .section-title { padding: 16px 24px; background: var(--bg-primary); border-bottom: 1px solid var(--border-color); font-weight: 700; font-size: 0.95rem; color: var(--text-primary); display: flex; align-items: center; gap: 10px; }
            .section-body { padding: 24px; }

            .price-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
            .price-card { padding: 16px; background: var(--bg-primary); border-radius: 12px; border: 1px solid var(--border-subtle); text-align: center; }
            .price-label { font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 4px; }
            .price-val { font-size: 1.25rem; font-weight: 800; color: var(--accent); }

            .info-list { list-style: none; padding: 0; margin: 0; }
            .info-item { display: flex; border-bottom: 1px solid var(--border-subtle); padding: 12px 0; font-size: 0.9rem; }
            .info-item:last-child { border-bottom: none; }
            .info-label { width: 180px; color: var(--text-secondary); font-weight: 500; flex-shrink: 0; }
            .info-value { color: var(--text-primary); font-weight: 600; flex: 1; }

            .sbu-box { background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
            .sbu-tag { font-family: 'JetBrains Mono', monospace; font-size: 1.3rem; font-weight: 800; color: var(--accent); }

            .qual-content { font-size: 0.88rem; line-height: 1.7; color: var(--text-secondary); white-space: pre-line; max-height: 350px; overflow-y: auto; padding-right: 8px; }
            .qual-content::-webkit-scrollbar { width: 4px; }
            .qual-content::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 2px; }

            .deadline-card { background: var(--gradient-1); color: white; padding: 24px; border-radius: 16px; box-shadow: var(--shadow-glow); }
            .dl-label { font-size: 0.75rem; text-transform: uppercase; font-weight: 700; opacity: 0.9; margin-bottom: 6px; }
            .dl-val { font-size: 1.2rem; font-weight: 800; }

            .sch-item { display: flex; flex-direction: column; padding: 12px 0; border-bottom: 1px solid var(--border-subtle); gap: 4px; }
            .sch-item:last-child { border-bottom: none; }
            .sch-item.active { background: rgba(52, 211, 153, 0.1); margin: 0 -24px; padding: 12px 24px; border-left: 4px solid var(--success); }
            .sch-item.past .sch-name, .sch-item.past .sch-time { color: var(--text-muted); opacity: 0.6; }
            .sch-name { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); }
            .sch-time { font-size: 0.75rem; color: var(--text-muted); }

            @media (max-width: 900px) {
                .detail-grid { grid-template-columns: 1fr; }
                .price-row { grid-template-columns: 1fr; }
            }
        </style>
        `;
    },

    async afterRender() {
        const parts = location.hash.slice(1).split('/');
        if (parts.length < 3) return;
        const kode = parts[1];
        const slug = parts[2];

        try {
            // Check status first and update UI immediately
            const followRes = await API.checkFollowed(kode);
            this.isFollowed = followRes.followed;
            this.updateFollowButton(this.isFollowed);
            
            const btn = document.getElementById('btn-follow-tender');
            if (btn) btn.onclick = () => this.follow();

            // Then do the slow scraping
            const { data } = await API.scrapeTender(slug, kode);
            this.renderContent(kode, slug, data);

            // If followed, sync the latest data (dates might have changed)
            if (this.isFollowed) {
                API.syncFollowedTender({
                    kode_tender: kode,
                    deadline: this._parseDate(data.uploadDate),
                    nama_tender: data.details['Nama Tender'] || data.details['Nama Paket'],
                    pagu: data.details['Nilai Pagu Paket'] || data.details['Pagu'],
                    hps: data.details['Nilai HPS Paket'] || data.details['HPS'],
                    jadwal: JSON.stringify(data.schedules)
                }).catch(err => console.error('Sync error:', err));
            }

        } catch (e) {
            console.error('Scrape error:', e);
            const errorMsg = e.error || e.message || 'Gagal memuat data dari SPSE. Mungkin akses sedang dibatasi.';
            const container = document.getElementById('td-container');
            if (container) {
                container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="alert-triangle" style="color:var(--danger);"></i>
                    <p>${errorMsg}</p>
                    <button class="btn btn-secondary mt-2" onclick="location.reload()">Coba Lagi</button>
                </div>`;
            }
            lucide.createIcons();
        }
    },

    renderContent(kode, slug, data) {
        const { details, schedules, sbu, uploadDate, pengumumanUrl, jadwalUrl } = data;
        const title = details['Nama Tender'] || details['Nama Paket'] || 'Detail Tender';

        // HPS and Pagu — may come as "Rp. 336.140.029.163,01" or as a number
        const formatRp = (val) => {
            if (!val || val === '-') return '-';
            if (typeof val === 'string' && val.startsWith('Rp')) return val;
            const n = parseFloat(String(val).replace(/[^0-9,]/g, '').replace(',', '.'));
            return isNaN(n) ? String(val) : 'Rp ' + n.toLocaleString('id-ID');
        };
        const hps  = formatRp(details['Nilai HPS Paket']  || details['HPS']);
        const pagu = formatRp(details['Nilai Pagu Paket'] || details['Pagu']);

        const extBtn = document.getElementById('td-external');
        if (extBtn) extBtn.href = pengumumanUrl;
        this.currentTender = { kode, slug, details, uploadDate, schedules };

        // Fields to show in info list (skip ones shown elsewhere)
        const skip = new Set([
            'Nama Tender', 'Nama Paket', 'Nilai Pagu Paket', 'Nilai HPS Paket',
            'Pagu', 'HPS', 'Syarat Kualifikasi', 'Sertifikat Badan Usaha atau SBU',
            'KBLI', 'Kode Tender', 'Rencana Umum Pengadaan'
        ]);
        const infoFields = [
            'Kode Tender', 'Tahap Tender Saat Ini', 'K/L/PD/Instansi Lainnya',
            'Satuan Kerja', 'Jenis Pengadaan', 'Metode Pengadaan', 'Metode Evaluasi',
            'Jenis Kontrak', 'Tahun Anggaran', 'Lokasi Pekerjaan', 'Kualifikasi Usaha',
            'Reverse Auction?', 'Peserta Tender', 'Tanggal Pembuatan'
        ];
        const infoHtml = infoFields
            .filter(k => details[k])
            .map(k => `
                <li class="info-item">
                    <span class="info-label">${k}</span>
                    <span class="info-value">${Fmt.escape(details[k])}</span>
                </li>
            `).join('');

        // Schedule rows
        const now = new Date();
        const parseIdDate = (str) => {
            if (!str) return null;
            const months = { 'januari':0,'februari':1,'maret':2,'april':3,'mei':4,'juni':5,'juli':6,'agustus':7,'september':8,'oktober':9,'november':10,'desember':11 };
            const m = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
            if (!m) return null;
            const mo = months[m[2].toLowerCase()];
            return mo !== undefined ? new Date(+m[3], mo, +m[1]) : null;
        };

        const scheduleHtml = (schedules || []).map(s => {
            const isUpload = s.stage && (s.stage.toLowerCase().includes('upload dokumen penawaran') || s.stage.toLowerCase().includes('pemasukan penawaran'));
            const endDate = parseIdDate(s.end);
            const isPast = endDate && endDate < now;
            const hasChange = s.perubahan && s.perubahan !== 'Tidak Ada';
            return `
            <div class="sch-item ${isUpload ? 'active' : (isPast ? 'past' : '')}">
                <div class="sch-name">${Fmt.escape(s.stage)}</div>
                <div class="sch-time">
                    ${Fmt.escape(s.start)} → ${Fmt.escape(s.end)}
                    ${hasChange ? `<span style="color:var(--warning); margin-left:6px;">⚠ ${Fmt.escape(s.perubahan)}</span>` : ''}
                </div>
            </div>`;
        }).join('');

        const el = document.getElementById('td-container');
        if (!el) return;

        el.innerHTML = `
            <div class="detail-header-card">
                <h2 class="detail-title">${Fmt.escape(title)}</h2>
                <div class="detail-badges">
                    <span class="badge-item"><i data-lucide="hash"></i> ${kode}</span>
                    <span class="badge-item"><i data-lucide="map-pin"></i> ${slug.toUpperCase()}</span>
                    ${details['Tahap Tender Saat Ini'] ? `<span class="badge-item"><i data-lucide="activity"></i> ${Fmt.escape(details['Tahap Tender Saat Ini'])}</span>` : ''}
                    ${details['Kualifikasi Usaha'] ? `<span class="badge-item"><i data-lucide="briefcase"></i> ${Fmt.escape(details['Kualifikasi Usaha'])}</span>` : ''}
                </div>
            </div>

            <div class="detail-grid">
                <div class="detail-main">
                    <!-- SBU — most important, shown first -->
                    <div class="section-card">
                        <div class="section-title"><i data-lucide="shield-check"></i> Persyaratan Kualifikasi / SBU</div>
                        <div class="section-body">
                            <div class="sbu-box">
                                <div class="price-label" style="margin-bottom:8px;">Subklasifikasi Badan Usaha (SBU)</div>
                                <div class="sbu-tag">${Fmt.escape(sbu && sbu !== '-' ? sbu : '—')}</div>
                            </div>
                            ${details['Syarat Kualifikasi'] ? `
                            <div class="price-label" style="margin-bottom:10px; margin-top:16px;">Uraian Syarat Kualifikasi</div>
                            <div class="qual-content">${Fmt.escape(details['Syarat Kualifikasi'])}</div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Info Umum -->
                    <div class="section-card">
                        <div class="section-title"><i data-lucide="info"></i> Informasi Tender</div>
                        <div class="section-body">
                            <div class="price-row">
                                <div class="price-card">
                                    <div class="price-label">Nilai Pagu Paket</div>
                                    <div class="price-val">${Fmt.escape(pagu)}</div>
                                </div>
                                <div class="price-card">
                                    <div class="price-label">Nilai HPS Paket</div>
                                    <div class="price-val" style="color:var(--success);">${Fmt.escape(hps)}</div>
                                </div>
                            </div>
                            <ul class="info-list">${infoHtml}</ul>
                        </div>
                    </div>
                </div>

                <div class="detail-side">
                    <div class="deadline-card">
                        <div class="dl-label">⏰ Batas Upload Penawaran</div>
                        <div class="dl-val">${Fmt.escape(uploadDate && uploadDate !== '-' ? uploadDate : 'Lihat jadwal')}</div>
                    </div>

                    <div class="section-card">
                        <div class="section-title">
                            <i data-lucide="calendar-clock"></i> Jadwal Tahapan
                            <a href="${jadwalUrl}" target="_blank" style="margin-left:auto; color:var(--accent); font-size:0.75rem;">Buka SPSE</a>
                        </div>
                        <div class="section-body" style="padding-top:0; padding-bottom:10px;">
                            ${scheduleHtml || '<p style="color:var(--text-muted); font-size:0.85rem; padding-top:16px;">Jadwal tidak tersedia.</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();
    },

    _parseDate(str) {
        if (!str || str === '-') return null;
        const months = { 'januari':0,'februari':1,'maret':2,'april':3,'mei':4,'juni':5,'juli':6,'agustus':7,'september':8,'oktober':9,'november':10,'desember':11 };
        const m = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/i);
        if (!m) return null;
        const mo = months[m[2].toLowerCase()];
        if (mo === undefined) return null;
        return new Date(+m[3], mo, +m[1], +m[4], +m[5]);
    },

    async follow() {
        if (!this.currentTender) return;

        const btn = document.getElementById('btn-follow-tender');
        if (!btn) return;

        // Show loading state
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Menambahkan...';
        
        try {
            const payload = {
                'Kode Tender': this.currentTender.kode,
                'Repo id LPSE': this.currentTender.kode_lpse,
                'LPSE': this.currentTender.slug,
                'Deadline': this._parseDate(this.currentTender.uploadDate),
                jadwal: JSON.stringify(this.currentTender.schedules),
                ...this.currentTender.details
            };
            await API.followTender(payload);
            
            this.isFollowed = true;
            this.updateFollowButton(true);
            Toast.success('Berhasil diikuti! Paket ini sekarang ada di daftar Tender Saya.');
        } catch (e) {
            if (e.status === 409) {
                this.isFollowed = true;
                this.updateFollowButton(true);
                Toast.warning('Paket ini sudah Anda ikuti sebelumnya.');
            } else {
                this.updateFollowButton(false);
                Toast.error('Gagal mengikuti tender: ' + e.message);
            }
        }
    },

    updateFollowButton(followed) {
        const btn = document.getElementById('btn-follow-tender');
        if (!btn) return;

        if (followed) {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="check-circle"></i> Sudah Diikuti';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-success');
        } else {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="bookmark"></i> Ikuti Tender';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-primary');
        }
        lucide.createIcons({ nodes: [btn] });
    }
};
