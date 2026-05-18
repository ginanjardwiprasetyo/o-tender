/**
 * TenderBuild — Browse LKPP Tenders Page
 */
const TenderBrowsePage = {
    lpseList: [],
    
    // Tab 1 (Crawl) State
    crawlResults: [],
    crawlTotal: 0,
    crawlPage: 1,
    crawlFilter: { search: '', lpse: '' },
    crawlSort: 'deadline_desc',
    
    // Tab 2 (Manual) State
    manualResults: [],
    manualTotalRaw: 0,
    currentSlug: '',
    followedCodes: new Set(),

    currentTab: 'crawl', // 'crawl' or 'manual'

    async render() {
        return `
        <div class="page-header">
            <div>
                <h2>Cari Tender LKPP</h2>
                <p>Pantau paket Pekerjaan Konstruksi dari sistem LPSE seluruh Indonesia</p>
            </div>
        </div>

        <div class="tabs">
            <button class="tab active" data-tab="crawl" onclick="TenderBrowsePage.switchTab('crawl')">
                <i data-lucide="database"></i> Hasil Crawl Otomatis
            </button>
            <button class="tab" data-tab="manual" onclick="TenderBrowsePage.switchTab('manual')">
                <i data-lucide="globe"></i> Cari Langsung (Live API)
            </button>
        </div>

        <!-- TAB 1: CRAWL -->
        <div id="tab-crawl" class="tab-content">
            <div class="card" style="margin-bottom:24px; padding:28px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; padding-bottom:20px; border-bottom:1px solid var(--border-subtle);">
                    <div style="display:flex; gap:14px; align-items:center;">
                        <div style="width:44px; height:44px; border-radius:12px; background:rgba(59,130,246,0.1); color:var(--accent); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <i data-lucide="server"></i>
                        </div>
                        <div>
                            <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-primary); margin:0;">Database Tender Terpusat</h3>
                            <p style="font-size:0.85rem; color:var(--text-muted); margin:4px 0 0 0;" id="crawl-status-text">Status: Mengambil data...</p>
                        </div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="TenderBrowsePage.startManualCrawl()" style="background:var(--bg-primary); border:1px solid var(--border-color);">
                        <i data-lucide="refresh-cw"></i> Jalankan Crawl
                    </button>
                </div>
                
                <div class="tb-grid">
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Cari Keyword</label>
                        <div class="search-box">
                            <i data-lucide="search"></i>
                            <input type="text" id="crawl-search" placeholder="Nama paket, instansi, atau kode..." onkeypress="if(event.key==='Enter') TenderBrowsePage.loadCrawledData()">
                        </div>
                    </div>
                    <div class="form-group" style="position:relative; margin-bottom:0;">
                        <label class="form-label">Filter LPSE</label>
                        <input type="text" class="form-input" id="crawl-lpse" placeholder="Semua LPSE" autocomplete="off" style="height:38px;">
                        <input type="hidden" id="crawl-lpse-val">
                        <div id="crawl-lpse-dropdown" class="tb-dropdown hidden"></div>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Urutkan</label>
                        <select class="form-select" id="crawl-sort" style="height:38px;" onchange="TenderBrowsePage.loadCrawledData()">
                            <option value="deadline_desc" selected>Batas Upload (Terjauh)</option>
                            <option value="deadline_asc">Batas Upload (Terdekat)</option>
                            <option value="crawled_at">Update Terakhir</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0; align-self:flex-end;">
                        <button class="btn btn-primary" style="height:38px; padding:0 24px; justify-content:center;" onclick="TenderBrowsePage.loadCrawledData()">
                            Filter
                        </button>
                    </div>
                </div>

                <!-- LIVE LOG BOX -->
                <div id="crawl-log-container" class="hidden" style="margin-top:20px; padding:12px; background:#0f172a; border-radius:8px; border:1px solid #1e293b;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:0.7rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Live Crawl Log</span>
                        <span class="spinner-sm" style="width:10px; height:10px;"></span>
                    </div>
                    <div id="crawl-logs" style="font-family:'JetBrains Mono', monospace; font-size:0.7rem; color:#cbd5e1; max-height:120px; overflow-y:auto; line-height:1.5;"></div>
                </div>
            </div>

            <div id="crawl-results-container"></div>
            <div id="crawl-pagination" style="display:flex; justify-content:center; gap:10px; margin-top:20px;"></div>
        </div>

        <!-- TAB 2: MANUAL -->
        <div id="tab-manual" class="tab-content hidden">
            <div class="card" style="margin-bottom:24px; padding:24px;">
                <div class="tb-grid">
                    <div class="form-group" style="position:relative; margin-bottom:0;">
                        <label class="form-label">LPSE Tujuan</label>
                        <input type="text" class="form-input" id="tb-lpse"
                            placeholder="Ketik nama LPSE (misal: Yogyakarta)..."
                            autocomplete="off" style="height:46px;">
                        <input type="hidden" id="tb-lpse-val">
                        <div id="lpse-dropdown" class="tb-dropdown hidden"></div>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Tahun Anggaran</label>
                        <select class="form-select" id="tb-tahun" style="height:46px;">
                            <option value="2026" selected>2026</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                            <option value="2023">2023</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0; align-self:flex-end;">
                        <button class="btn btn-primary" style="height:46px; padding:0 24px; justify-content:center;"
                            onclick="TenderBrowsePage.searchManual()">
                            <i data-lucide="search"></i> Cari Paket
                        </button>
                    </div>
                </div>
            </div>

            <div id="tb-results">
                <div class="empty-state">
                    <i data-lucide="search" style="width:48px;height:48px;opacity:0.15;"></i>
                    <p style="margin-top:12px;color:var(--text-muted);">Masukkan nama LPSE dan pilih tahun untuk mulai mencari ke server LKPP.</p>
                </div>
            </div>
        </div>
        `;
    },

    async afterRender() {
        this.loadLPSE();
        this._setupDropdowns();
        this.updateCrawlStatus();

        // Load followed tenders to show checkmarks
        try {
            const res = await API.getFollowedTenders();
            this.followedCodes = new Set((res.data || []).map(t => String(t.kode_tender)));
        } catch (e) { console.error('Failed to load followed status:', e); }

        // Preserve state in UI
        if (this.crawlFilter.search) document.getElementById('crawl-search').value = this.crawlFilter.search;
        
        if (this.crawlFilter.lpse) {
            document.getElementById('crawl-lpse-val').value = this.crawlFilter.lpse;
            const match = this.lpseList.find(l => String(l.kd_lpse) === String(this.crawlFilter.lpse));
            if (match) document.getElementById('crawl-lpse').value = match.nama_lpse;
        } else {
            // Apply default from settings if no filter is set
            try {
                const { data } = await API.getSettings();
                if (data.default_lpse) {
                    const def = JSON.parse(data.default_lpse);
                    this.crawlFilter.lpse = def.kd_lpse;
                    document.getElementById('crawl-lpse-val').value = def.kd_lpse;
                    document.getElementById('crawl-lpse').value = def.nama_lpse;
                }
            } catch {}
        }

        this.loadCrawledData(this.crawlPage);
    },

    switchTab(tabId) {
        this.currentTab = tabId;
        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
        document.querySelector(`.tab[data-tab="${tabId}"]`).classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    },

    async loadLPSE() {
        try {
            const { data } = await API.getLPSEList();
            this.lpseList = data || [];
        } catch { Toast.error('Gagal memuat daftar LPSE'); }
    },

    _setupDropdowns() {
        const setup = (inputId, hiddenId, dropdownId) => {
            const input    = document.getElementById(inputId);
            const hidden   = document.getElementById(hiddenId);
            const dropdown = document.getElementById(dropdownId);
            if (!input || !dropdown) return;

            const show = (q) => {
                const matches = this.lpseList
                    .filter(l => l.nama_lpse.toLowerCase().includes(q.toLowerCase()))
                    .slice(0, 60);
                if (!matches.length) { dropdown.classList.add('hidden'); return; }
                dropdown.innerHTML = matches.map(l =>
                    `<div class="tb-dd-item" data-kd="${l.kd_lpse}" data-name="${l.nama_lpse.replace(/"/g,'&quot;')}">${l.nama_lpse}</div>`
                ).join('');
                dropdown.classList.remove('hidden');
            };

            dropdown.addEventListener('mousedown', (e) => {
                const item = e.target.closest('.tb-dd-item');
                if (item) {
                    e.preventDefault();
                    input.value  = item.dataset.name;
                    hidden.value = item.dataset.kd;
                    dropdown.classList.add('hidden');
                }
            });
            input.addEventListener('input', (e) => {
                hidden.value = '';
                const q = e.target.value.trim();
                q.length >= 2 ? show(q) : dropdown.classList.add('hidden');
            });
            input.addEventListener('focus', (e) => {
                if (e.target.value.trim().length >= 2) show(e.target.value.trim());
            });
            input.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 150));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { 
                    dropdown.classList.add('hidden'); 
                    if(inputId === 'crawl-lpse') this.loadCrawledData();
                    else this.searchManual(); 
                }
            });
        };

        setup('tb-lpse', 'tb-lpse-val', 'lpse-dropdown');
        setup('crawl-lpse', 'crawl-lpse-val', 'crawl-lpse-dropdown');
    },

    // ─── TAB 1: CRAWLER LOGIC ────────────────────────────

    async updateCrawlStatus() {
        try {
            const { data } = await API.getCrawlStatus();
            const textEl = document.getElementById('crawl-status-text');
            if (!textEl) return;

            if (data.current && data.current.state === 'running') {
                textEl.innerHTML = `<span style="color:var(--warning);"><span class="spinner-sm" style="display:inline-block;vertical-align:middle;margin-right:6px;"></span> Sedang berjalan (${data.current.processedLpse || 0}/${data.current.totalLpse || 0} LPSE)</span>`;
                
                // Update Logs
                const logContainer = document.getElementById('crawl-log-container');
                const logBox = document.getElementById('crawl-logs');
                if (logContainer && logBox && data.current.logs) {
                    logContainer.classList.remove('hidden');
                    logBox.innerHTML = data.current.logs.map(l => `<div style="margin-bottom:2px;">${Fmt.escape(l)}</div>`).join('');
                }
                
                setTimeout(() => this.updateCrawlStatus(), 3000);
            } else {
                // Not running, hide log container
                const logContainer = document.getElementById('crawl-log-container');
                if (logContainer) logContainer.classList.add('hidden');
                
                if (data.history && data.history.length > 0) {
                    const last = data.history[0];
                    if (last.status === 'success' && last.finished_at) {
                        const date = new Date(last.finished_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
                        textEl.innerHTML = `Terakhir update: <strong>${date}</strong> — ${last.total_konstruksi || 0} tender konstruksi dari ${last.total_lpse || 0} LPSE`;
                    } else if (last.status === 'error') {
                        const date = last.finished_at ? new Date(last.finished_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
                        textEl.innerHTML = `<span style="color:var(--danger);">Crawl terakhir gagal (${date}). </span><span style="color:var(--text-muted);">Klik Jalankan Crawl untuk mencoba ulang.</span>`;
                    } else {
                        textEl.innerHTML = `Belum ada data crawl berhasil. Silakan klik Jalankan Crawl Sekarang.`;
                    }
                } else {
                    textEl.innerHTML = `Belum ada data crawl. Silakan klik Jalankan Crawl Sekarang.`;
                }
            }
        } catch(e) {
            const textEl = document.getElementById('crawl-status-text');
            if (textEl) textEl.innerHTML = `<span style="color:var(--danger);">Server tidak terhubung.</span> Pastikan backend berjalan di port 3000.`;
        }
    },

    async startManualCrawl() {
        const btn = document.querySelector('[onclick*="startManualCrawl"]');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-sm" style="display:inline-block;vertical-align:middle;margin-right:6px;"></span> Memulai...';
        }
        try {
            await API.startCrawl(new Date().getFullYear());
            Toast.success('Proses crawl dimulai di latar belakang. Halaman akan otomatis diperbarui.');
            setTimeout(() => this.updateCrawlStatus(), 1500);
        } catch(e) {
            Toast.error('Gagal memulai crawl: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="refresh-cw"></i> Jalankan Crawl Sekarang';
                lucide.createIcons({ nodes: [btn] });
            }
        }
    },

    async loadCrawledData(page = 1) {
        this.crawlPage = page;
        this.crawlFilter.search = document.getElementById('crawl-search').value.trim();
        this.crawlFilter.lpse = document.getElementById('crawl-lpse-val').value;
        this.crawlSort = document.getElementById('crawl-sort').value;

        const el = document.getElementById('crawl-results-container');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div><p>Memuat data...</p></div>';

        try {
            const res = await API.getCrawledTenders({ 
                page: this.crawlPage, 
                limit: 20, 
                search: this.crawlFilter.search, 
                lpse: this.crawlFilter.lpse,
                sort: this.crawlSort
            });
            this.crawlResults = res.data || [];
            this.crawlTotal = res.pagination ? res.pagination.total : 0;
            this.renderCrawlTable();
        } catch(e) {
            el.innerHTML = `<div class="empty-state"><i data-lucide="inbox" style="opacity:0.3;"></i><p>Tidak ada data tender di database. Klik <strong>Jalankan Crawl Sekarang</strong> untuk mulai mengambil data.</p></div>`;
            lucide.createIcons();
        }
    },

    renderCrawlTable() {
        const el = document.getElementById('crawl-results-container');
        if (!el) return;
        if (!this.crawlResults.length) {
            el.innerHTML = `<div class="empty-state"><i data-lucide="inbox" style="opacity:0.3;"></i><p>Tidak ada data ditemukan.</p></div>`;
            lucide.createIcons();
            document.getElementById('crawl-pagination').innerHTML = '';
            return;
        }

        const rows = this.crawlResults.map((t, i) => {
            const offset = (this.crawlPage - 1) * 20;
            const batasRaw = t.batas_upload || null;
            const batasUpload = batasRaw ? this._fmtDate(batasRaw) : '-';
            const isPast = batasRaw ? this._isPast(batasRaw) : false;
            const batasLabel = batasRaw
                ? `<span class="${isPast ? 'tb-date-past' : 'tb-date-open'}">${Fmt.escape(batasUpload)}${isPast ? ' (lewat)' : ''}</span>`
                : `<span style="color:var(--text-muted);">—</span>`;
            const isFollowed = this.followedCodes.has(String(t.kode_tender));
            
            return `
            <tr>
                <td style="color:var(--text-muted);text-align:center;">${offset + i + 1}</td>
                <td>
                    <div style="font-weight:600;color:var(--text-primary);">
                        ${Fmt.escape(t.nama_paket)}
                        ${isFollowed ? '<i data-lucide="check-circle" style="width:14px; height:14px; color:var(--success); display:inline-block; vertical-align:middle; margin-left:4px;" title="Sudah Diikuti"></i>' : ''}
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">
                        ${t.kode_tender} &bull; ${Fmt.escape(t.nama_lpse)} &bull; ${Fmt.escape(t.instansi)}
                    </div>
                </td>
                <td><span class="tb-pagu">${Fmt.rupiah(t.pagu)}</span></td>
                <td><span class="badge badge-gray">${this._fmtSbu(t.sbu)}</span></td>
                <td>${batasLabel}</td>
                <td style="text-align:center;">
                    <button class="btn btn-secondary btn-sm" onclick="TenderBrowsePage.viewDetailCrawl('${t.kode_tender}', '${t.slug || ''}')">
                        <i data-lucide="eye"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        el.innerHTML = `
            <div style="margin-bottom:12px; color:var(--text-secondary); font-size:0.85rem;">
                Ditemukan <strong>${this.crawlTotal}</strong> tender
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th width="50" style="text-align:center;">No</th>
                            <th>Info Paket</th>
                            <th width="140">Pagu</th>
                            <th width="90">SBU</th>
                            <th width="120">Batas Upload</th>
                            <th width="60" style="text-align:center;">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        lucide.createIcons();
        this.renderPagination();
    },

    renderPagination() {
        const totalPages = Math.ceil(this.crawlTotal / 20);
        const el = document.getElementById('crawl-pagination');
        if (totalPages <= 1) { el.innerHTML = ''; return; }

        let html = '';
        if (this.crawlPage > 1) {
            html += `<button class="btn btn-secondary btn-sm" onclick="TenderBrowsePage.loadCrawledData(${this.crawlPage - 1})">Prev</button>`;
        }
        html += `<span style="padding:4px 12px; font-size:0.85rem;">Hal ${this.crawlPage} dari ${totalPages}</span>`;
        if (this.crawlPage < totalPages) {
            html += `<button class="btn btn-secondary btn-sm" onclick="TenderBrowsePage.loadCrawledData(${this.crawlPage + 1})">Next</button>`;
        }
        el.innerHTML = html;
    },

    viewDetailCrawl(kode, slug) {
        if (!slug || slug === 'null') slug = 'lpse';
        location.hash = `#tender-detail/${kode}/${slug}`;
    },

    // ─── TAB 2: MANUAL LOGIC ─────────────────────────────

    async searchManual() {
        let kd       = document.getElementById('tb-lpse-val').value.trim();
        const tahun  = document.getElementById('tb-tahun').value;
        const lpseText = document.getElementById('tb-lpse').value.trim();

        if (!kd && lpseText.length >= 2) {
            const match = this.lpseList.find(l => l.nama_lpse.toLowerCase() === lpseText.toLowerCase())
                       || this.lpseList.find(l => l.nama_lpse.toLowerCase().includes(lpseText.toLowerCase()));
            if (match) {
                kd = String(match.kd_lpse);
                document.getElementById('tb-lpse-val').value = kd;
                document.getElementById('tb-lpse').value     = match.nama_lpse;
            }
        }
        if (!kd) { Toast.warning('Pilih LPSE dari daftar dropdown'); return; }

        const el = document.getElementById('tb-results');
        if (!el) return;
        el.innerHTML = `<div class="page-loading" style="height:200px;">
            <div class="spinner"></div>
            <p style="margin-top:12px;color:var(--text-secondary);">Mengambil data live dari LKPP...</p>
        </div>`;

        try {
            const res = await API.searchTenders(tahun, kd, lpseText);
            this.manualResults     = res.data      || [];
            this.manualTotalRaw    = res.total_raw || 0;
            this.currentSlug = res.slug      || '';

            this.renderManualTable();

            if (this.manualResults.length > 0 && this.currentSlug) {
                this._fetchDeadlines();
            }
        } catch (e) {
            el.innerHTML = `<div class="empty-state">
                <i data-lucide="alert-circle" style="color:var(--danger);"></i>
                <p style="color:var(--danger);margin-top:12px;">Gagal memuat data: ${Fmt.escape(e.message)}</p>
            </div>`;
            lucide.createIcons();
        }
    },

    async _fetchDeadlines() {
        const needFetch = this.manualResults.filter(t => !this._getDeadline(t));
        if (!needFetch.length) return;

        const bySlug = {};
        needFetch.forEach(t => {
            const slug = t['_slug'] || this.currentSlug;
            if (!bySlug[slug]) bySlug[slug] = [];
            bySlug[slug].push(t);
        });

        await Promise.all(Object.entries(bySlug).map(async ([slug, tenders]) => {
            try {
                const kodes = tenders.map(t => String(t['Kode Tender'] || t.kode_tender)).filter(Boolean).join(',');
                const { data } = await API.jadwalBatch(slug, kodes);
                if (data) {
                    tenders.forEach(t => {
                        const kode = String(t['Kode Tender'] || t.kode_tender);
                        t['_deadline_fetched'] = data[kode] || '-';
                        this._updateDeadlineCell(t);
                    });
                }
            } catch (err) {
                tenders.forEach(t => {
                    t['_deadline_fetched'] = '-';
                    this._updateDeadlineCell(t);
                });
            }
        }));
    },

    _updateDeadlineCell(t) {
        if (!t) return;
        const kode = String(t['Kode Tender'] || t.kode_tender);
        const row  = document.getElementById(`row-${kode}`);
        if (!row) return;
        const cell = row.querySelector('.col-deadline');
        if (!cell) return;
        
        const dl = this._getDeadline(t);
        if (!dl || dl === '-') { cell.innerHTML = '<span class="text-muted">—</span>'; return; }
        
        const past = this._isPast(dl);
        const label = this._fmtDate(dl);
        cell.innerHTML = `<span class="${past ? 'tb-date-past' : 'tb-date-open'}">${Fmt.escape(label)}${past ? ' <span style="font-size:0.68rem;">(lewat)</span>' : ''}</span>`;
    },

    _getDeadline(t) {
        const jp = t['jadwal_penawaran'] || t.jadwal_penawaran;
        if (jp && typeof jp === 'object') {
            const ta = jp.tanggal_akhir || jp.berakhir;
            if (ta) return ta;
        }
        if (t['_deadline_fetched']) return t['_deadline_fetched'];
        return null;
    },

    _fmtDate(dateStr) {
        if (!dateStr || dateStr === '-') return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    _isPast(dateStr) {
        if (!dateStr || dateStr === '-') return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            // Try manual parse if it's Indonesian
            try {
                const months = { 'januari':0,'februari':1,'maret':2,'april':3,'mei':4,'juni':5,'juli':6,'agustus':7,'september':8,'oktober':9,'november':10,'desember':11 };
                const m = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
                if (m) {
                    const mo = months[m[2].toLowerCase()];
                    if (mo !== undefined) return new Date(+m[3], mo, +m[1], 23, 59) < new Date();
                }
            } catch {}
            return false;
        }
        return d < new Date();
    },

    _fmtSbu(sbu) {
        if (!sbu || sbu === '-' || sbu === 'null' || sbu === 'undefined') return '-';
        const clean = String(sbu).trim().toUpperCase();
        
        // If it's already a clean SBU code list (e.g. "BG006" or "BG006, BS001"), return it
        const singleOrListRegex = /^([A-Z]{2}[- ]?\d{3})(,\s*[A-Z]{2}[- ]?\d{3})*$/;
        if (singleOrListRegex.test(clean)) return clean;
        
        // Otherwise, extract SBU codes from the text
        const regex = /\b(BG|BS|PL|PB|GT|ST|KP|KK|RK|RE|EL|ME|SP|TI|MK|PR|EE|SE)[\s-]*0*(\d{1,3})\b/gi;
        const matches = [];
        let m;
        while ((m = regex.exec(clean)) !== null) {
            const prefix = m[1].toUpperCase();
            const num = m[2].padStart(3, '0');
            const code = `${prefix}${num}`;
            matches.push({
                code,
                index: m.index,
                endIndex: regex.lastIndex
            });
        }
        
        if (matches.length === 0) return '-';
        
        // Prioritize KBLI 2020 SBU codes
        const sbu2020 = [];
        for (let i = 0; i < matches.length; i++) {
            const current = matches[i];
            const next = matches[i + 1];
            
            const start = current.endIndex;
            const end = next ? next.index : Math.min(clean.length, start + 80);
            const windowText = clean.substring(start, end);
            
            const is2020 = /2020/.test(windowText);
            if (is2020) {
                if (!sbu2020.includes(current.code)) {
                    sbu2020.push(current.code);
                }
            }
        }
        
        if (sbu2020.length > 0) {
            return sbu2020.join(', ');
        }
        
        const allUnique = [];
        matches.forEach(m => {
            if (!allUnique.includes(m.code)) {
                allUnique.push(m.code);
            }
        });
        return allUnique.join(', ');
    },

    renderManualTable() {
        const el = document.getElementById('tb-results');
        if (!el) return;
        if (!this.manualResults.length) {
            el.innerHTML = `<div class="empty-state">
                <i data-lucide="inbox" style="opacity:0.3;"></i>
                <p style="margin-top:12px;">Tidak ditemukan paket Pekerjaan Konstruksi.</p>
                <p style="font-size:0.85rem;color:var(--text-muted);">Total ${this.manualTotalRaw} paket ditemukan, tidak ada kategori Konstruksi.</p>
            </div>`;
            lucide.createIcons();
            return;
        }

        const rows = this.manualResults.map((t, i) => {
            const kode     = t['Kode Tender']   || t.kode_tender   || '';
            const nama     = t['Nama Paket']    || t.nama_paket    || '-';
            const pagu     = t['Pagu']          || t.pagu          || 0;
            const deadline = this._getDeadline(t);
            const past     = this._isPast(deadline);
            const dlLabel  = this._fmtDate(deadline);
            const isFollowed = this.followedCodes.has(String(kode));

            return `
            <tr id="row-${kode}">
                <td style="color:var(--text-muted);text-align:center;font-size:0.85rem;">${i + 1}</td>
                <td>
                    <div style="font-weight:600;line-height:1.4;color:var(--text-primary);">
                        ${Fmt.escape(nama)}
                        ${isFollowed ? '<i data-lucide="check-circle" style="width:14px; height:14px; color:var(--success); display:inline-block; vertical-align:middle; margin-left:4px;" title="Sudah Diikuti"></i>' : ''}
                    </div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">${kode}</div>
                </td>
                <td><span class="tb-pagu">${Fmt.rupiah(pagu)}</span></td>
                <td class="col-deadline">
                    ${dlLabel
                        ? `<span class="${past ? 'tb-date-past' : 'tb-date-open'}">${Fmt.escape(dlLabel)}${past ? ' <span style="font-size:0.68rem;">(lewat)</span>' : ''}</span>`
                        : `<span class="spinner" style="width:11px;height:11px;border-width:1.5px;display:inline-block;opacity:0.4;"></span>`}
                </td>
                <td style="text-align:center;">
                    <button class="btn btn-secondary btn-sm" onclick="TenderBrowsePage.viewDetailCrawl('${kode}', '${t['_slug'] || this.currentSlug}')">
                        <i data-lucide="eye"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        el.innerHTML = `
            <div>
                <span>
                    Ditemukan <strong>${this.manualResults.length}</strong> paket konstruksi
                    <span>(dari ${this.manualTotalRaw} total)</span>
                </span>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th width="44" style="text-align:center;">No</th>
                            <th>Nama Paket</th>
                            <th width="175">Pagu</th>
                            <th width="155">Batas Penawaran</th>
                            <th width="60" style="text-align:center;">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
        lucide.createIcons();
    }
};
