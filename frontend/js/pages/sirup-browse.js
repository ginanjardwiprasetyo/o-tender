/**
 * SIRUP Browse Page — Crawl & browse RUP (Rencana Umum Pengadaan)
 */
const SirupBrowsePage = {
    provinces: [],
    selectedProvinces: new Set(),
    selectedBulan: new Set(),
    selectedAkhirBulan: new Set(),
    results: [],
    total: 0,
    page: 1,
    sortCol: 'pemilihan',
    sortDir: 'asc',
    filterProvinsi: '',
    filterCari: '',
    filterExcludeWords: [],
    filterBulanMulti: new Set(),
    filterTahun: new Date().getFullYear(),
    filterMetode: '',
    filterRead: '', // '' = semua, 'read' = dibaca, 'unread' = belum dibaca
    crawledProvinces: [],
    metodeList: [],
    readSet: new Set(),
    _pollTimer: null,

    BULAN_NAMES: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],

    COLS: [
        { key: 'nama_paket', label: 'Paket', sortable: true },
        { key: 'pagu', label: 'Pagu', sortable: true },
        { key: 'metode', label: 'Metode', sortable: true },
        { key: 'pemilihan', label: 'Pemilihan', sortable: true },
        { key: 'lokasi', label: 'Lokasi', sortable: true },
    ],

    async render() {
        return `
        <div class="page-header">
            <div>
                <h2>Cari RUP (SIRUP)</h2>
                <p>Pantau Rencana Umum Pengadaan Pekerjaan Konstruksi dari SIRUP LKPP</p>
            </div>
        </div>

        <div class="card" style="margin-bottom:24px; padding:28px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; padding-bottom:20px; border-bottom:1px solid var(--border-subtle);">
                <div style="display:flex; gap:14px; align-items:center;">
                    <div style="width:44px; height:44px; border-radius:12px; background:rgba(16,185,129,0.1); color:#10b981; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i data-lucide="clipboard-list"></i>
                    </div>
                    <div>
                        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-primary); margin:0;">SIRUP Crawl</h3>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin:4px 0 0 0;" id="sirup-status-text">Pilih provinsi dan bulan untuk mulai crawl</p>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-secondary btn-sm" id="btn-stop-sirup" onclick="SirupBrowsePage.stopCrawl()" style="background:var(--bg-primary); border:1px solid var(--danger); color:var(--danger); display:none;">
                        <i data-lucide="square"></i> Stop
                    </button>
                    <button class="btn btn-primary btn-sm" id="btn-start-sirup" onclick="SirupBrowsePage.startCrawl()">
                        <i data-lucide="play"></i> Jalankan Crawl
                    </button>
                </div>
            </div>

            <!-- Province Selector -->
            <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label" style="font-weight:700; margin-bottom:10px;">
                    <i data-lucide="map-pin" style="width:14px;height:14px;display:inline;vertical-align:middle;"></i>
                    Provinsi
                </label>
                <div style="display:flex; gap:8px; align-items:flex-start;">
                    <div style="position:relative; flex:1;">
                        <input type="text" class="form-input" id="sirup-province-input"
                            placeholder="Ketik nama provinsi..."
                            autocomplete="off" style="height:42px;"
                            oninput="SirupBrowsePage.filterProvinces(this.value)"
                            onfocus="SirupBrowsePage.filterProvinces(this.value)"
                            onblur="setTimeout(()=>document.getElementById('sirup-province-dropdown').classList.add('hidden'),150)">
                        <div id="sirup-province-dropdown" class="hidden" style="position:absolute;top:100%;left:0;right:0;z-index:50;max-height:260px;overflow-y:auto;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);box-shadow:var(--shadow-lg);"></div>
                    </div>
                    <button class="btn btn-secondary btn-sm" style="height:42px; padding:0 14px; flex-shrink:0;"
                        onclick="SirupBrowsePage.selectAllProvinces()">
                        <i data-lucide="check-square"></i> Semua
                    </button>
                </div>
                <div id="sirup-selected-provinces" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;"></div>
            </div>

            <!-- Tahun + Awal + Akhir Pemilihan -->
            <div class="form-group" style="margin-bottom:16px;">
                <label class="form-label" style="font-weight:700;">Tahun</label>
                <select class="form-select" id="sirup-tahun" style="height:42px; min-width:140px;">
                    <option value="2026" selected>2026</option>
                </select>
            </div>
            <div style="display:flex; gap:24px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:300px; margin-bottom:0;">
                    <label class="form-label" style="font-weight:700; margin-bottom:10px;">
                        <i data-lucide="calendar" style="width:14px;height:14px;display:inline;vertical-align:middle;"></i>
                        Awal Pemilihan
                    </label>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;" id="sirup-bulan-chips"></div>
                </div>
                <div class="form-group" style="flex:1; min-width:300px; margin-bottom:0;">
                    <label class="form-label" style="font-weight:700; margin-bottom:10px;">
                        <i data-lucide="calendar-check" style="width:14px;height:14px;display:inline;vertical-align:middle;"></i>
                        Akhir Pemilihan
                    </label>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;" id="sirup-akhir-bulan-chips"></div>
                </div>
            </div>

            <!-- Live Log -->
            <div id="sirup-log-container" class="hidden" style="margin-top:20px; padding:14px; background:#0f172a; border-radius:10px; border:1px solid #1e293b;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="spinner-sm" style="width:10px; height:10px;"></span>
                        <span style="font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Live Crawl Log</span>
                    </div>
                    <button onclick="document.getElementById('sirup-log-container').classList.add('hidden')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:1rem;">&times;</button>
                </div>
                <div id="sirup-logs" style="font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:#cbd5e1; max-height:150px; overflow-y:auto; line-height:1.6;"></div>
            </div>
        </div>

        <div id="sirup-results-container"></div>
        <div id="sirup-pagination" style="display:flex; justify-content:center; gap:10px; margin-top:20px;"></div>
        `;
    },

    async afterRender() {
        this.loadFromStorage();
        this.loadReadSet();
        this.page = 1;

        // Prefer DB settings (shared local + online); fall back to localStorage
        try {
            const res = await API.getSettings();
            const s = res.data || {};
            let remote = false;
            if (s.sirup_provinsi) {
                try { this.selectedProvinces = new Set(JSON.parse(s.sirup_provinsi)); remote = true; } catch {}
            }
            if (s.sirup_akhir_bulan) {
                try {
                    const arr = JSON.parse(s.sirup_akhir_bulan);
                    // Only use remote if size is reasonable (not old default)
                    if (Array.isArray(arr) && arr.length > 0 && arr.length <= 3) {
                        this.selectedAkhirBulan = new Set(arr);
                        remote = true;
                    }
                } catch {}
            }
            if (s.sirup_exclude_words) {
                try { this.filterExcludeWords = JSON.parse(s.sirup_exclude_words); remote = true; } catch {}
            }
            if (remote) this.saveToStorage();
        } catch {}

        if (!this.provinces.length) {
            try {
                const res = await API.getSirupProvinces();
                this.provinces = res.data || [];
            } catch { this.provinces = []; }
        }

        try {
            const res = await API.getSirupCrawledProvinces();
            this.crawledProvinces = res.data || [];
        } catch { this.crawledProvinces = []; }

        try {
            const res = await API.getSirupMetode();
            this.metodeList = res.data || [];
        } catch { this.metodeList = []; }

        this.renderBulanChips();
        this.renderAkhirBulanChips();
        this.renderSelectedProvinces();
        this.loadResults();
        // Set default metode in dropdown after render
        setTimeout(() => {
            const metodeSelect = document.getElementById('sirup-filter-metode-select');
            if (metodeSelect) metodeSelect.value = this.filterMetode;
        }, 0);
        this.checkAndPollStatus();
    },

    STORAGE_KEY: 'sirup-browse-state',

    loadFromStorage() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                if (s.provinsi) this.selectedProvinces = new Set(s.provinsi);
                if (s.bulan) this.selectedBulan = new Set(s.bulan);
                if (s.akhirBulan) this.selectedAkhirBulan = new Set(s.akhirBulan);
                if (s.excludeWords) this.filterExcludeWords = s.excludeWords;
            }
        } catch {}
        const cm = new Date().getMonth() + 1;
        // Default awal pemilihan: cm-1 s/d cm (2 bulan). Reset if empty or old default (size > 3)
        if (this.selectedBulan.size === 0 || this.selectedBulan.size > 3) {
            this.selectedBulan = new Set();
            if (cm > 1) this.selectedBulan.add(cm - 1);
            this.selectedBulan.add(cm);
        }
        // Default akhir pemilihan: cm s/d cm+1 (2 bulan). Reset if empty or old default (size > 3)
        if (this.selectedAkhirBulan.size === 0 || this.selectedAkhirBulan.size > 3) {
            this.selectedAkhirBulan = new Set([cm]);
            if (cm < 12) this.selectedAkhirBulan.add(cm + 1);
        }
        this.filterProvinsi = '';
        this.filterCari = '';
        // Default: bulan ini s/d Desember, metode Penunjukan Langsung
        this.filterBulanMulti = new Set();
        for (let m = cm; m <= 12; m++) this.filterBulanMulti.add(m);
        this.filterTahun = new Date().getFullYear();
        this.filterMetode = 'Penunjukan Langsung';
    },

    saveToStorage() {
        const payload = {
            provinsi: [...this.selectedProvinces],
            bulan: [...this.selectedBulan],
            akhirBulan: [...this.selectedAkhirBulan],
            excludeWords: this.filterExcludeWords,
        };
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload)); } catch {}
        // Persist to DB so local + online share the same crawl config
        clearTimeout(this._saveSettingsTimer);
        this._saveSettingsTimer = setTimeout(() => {
            API.updateSettings({
                sirup_provinsi: JSON.stringify(payload.provinsi),
                sirup_bulan: JSON.stringify(payload.bulan),
                sirup_akhir_bulan: JSON.stringify(payload.akhirBulan),
                sirup_exclude_words: JSON.stringify(payload.excludeWords),
            }).catch(() => {});
        }, 400);
    },

    // ─── Province Selector ─────────────────────────────
    renderBulanChips() {
        const el = document.getElementById('sirup-bulan-chips');
        if (!el) return;
        el.innerHTML = this.BULAN_NAMES.map((name, i) => {
            const m = i + 1;
            const active = this.selectedBulan.has(m);
            return `<button class="btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}"
                style="height:32px; padding:0 14px;"
                onclick="SirupBrowsePage.toggleBulan(${m})">${name}</button>`;
        }).join('');
    },

    toggleBulan(m) {
        this.selectedBulan.has(m) ? this.selectedBulan.delete(m) : this.selectedBulan.add(m);
        this.renderBulanChips();
        this.saveToStorage();
    },

    renderAkhirBulanChips() {
        const el = document.getElementById('sirup-akhir-bulan-chips');
        if (!el) return;
        el.innerHTML = this.BULAN_NAMES.map((name, i) => {
            const m = i + 1;
            const active = this.selectedAkhirBulan.has(m);
            return `<button class="btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}"
                style="height:32px; padding:0 14px;"
                onclick="SirupBrowsePage.toggleAkhirBulan(${m})">${name}</button>`;
        }).join('');
    },

    toggleAkhirBulan(m) {
        this.selectedAkhirBulan.has(m) ? this.selectedAkhirBulan.delete(m) : this.selectedAkhirBulan.add(m);
        this.renderAkhirBulanChips();
        this.saveToStorage();
    },

    filterProvinces(q) {
        const dd = document.getElementById('sirup-province-dropdown');
        if (!dd) return;
        if (!q || q.length < 1) { dd.classList.add('hidden'); return; }
        const ql = q.toLowerCase();
        const list = this.provinces.filter(p => p.name.toLowerCase().includes(ql) && !this.selectedProvinces.has(p.name));
        if (list.length === 0) { dd.innerHTML = '<div style="padding:12px 16px;color:var(--text-muted);font-size:0.85rem;">Tidak ditemukan</div>'; dd.classList.remove('hidden'); return; }
        dd.innerHTML = list.map(p =>
            `<div class="tb-dropdown-item" onmousedown="SirupBrowsePage.selectProvince('${p.name}')">${p.name}</div>`
        ).join('');
        dd.classList.remove('hidden');
    },

    selectProvince(name) {
        this.selectedProvinces.add(name);
        document.getElementById('sirup-province-input').value = '';
        document.getElementById('sirup-province-dropdown').classList.add('hidden');
        this.renderSelectedProvinces();
        this.saveToStorage();
    },

    removeProvince(name) {
        this.selectedProvinces.delete(name);
        this.renderSelectedProvinces();
        this.saveToStorage();
    },

    selectAllProvinces() {
        this.provinces.forEach(p => this.selectedProvinces.add(p.name));
        this.renderSelectedProvinces();
        this.saveToStorage();
    },

    renderSelectedProvinces() {
        const el = document.getElementById('sirup-selected-provinces');
        if (!el) return;
        if (this.selectedProvinces.size === 0) {
            el.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem;">Belum ada provinsi dipilih</span>';
            return;
        }
        el.innerHTML = [...this.selectedProvinces].sort().map(name =>
            `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:rgba(16,185,129,0.1);color:#10b981;border-radius:6px;font-size:0.82rem;font-weight:500;">
                ${name}
                <button onclick="SirupBrowsePage.removeProvince('${name}')" style="background:none;border:none;color:#10b981;cursor:pointer;padding:0;line-height:1;font-size:1.1rem;">&times;</button>
            </span>`
        ).join('');
    },

    // ─── Crawl Control ─────────────────────────────────
    async startCrawl() {
        if (this.selectedProvinces.size === 0) return Toast.warning('Pilih minimal satu provinsi');
        if (this.selectedBulan.size === 0) return Toast.warning('Pilih minimal satu bulan awal pemilihan');
        if (this.selectedAkhirBulan.size === 0) return Toast.warning('Pilih minimal satu bulan akhir pemilihan');

        try {
            await API.startSirupCrawl({
                provinsi: [...this.selectedProvinces],
                bulan: [...this.selectedBulan],
                akhirBulan: [...this.selectedAkhirBulan],
                tahun: parseInt(document.getElementById('sirup-tahun').value),
            });
            Toast.success('Proses crawl dimulai');
            document.getElementById('btn-start-sirup').style.display = 'none';
            document.getElementById('btn-stop-sirup').style.display = '';
            document.getElementById('sirup-log-container').classList.remove('hidden');
            this.pollStatus();
        } catch (err) { Toast.error('Gagal: ' + err.message); }
    },

    async stopCrawl() {
        try { await API.stopSirupCrawl(); Toast.info('Stop requested'); }
        catch (err) { Toast.error('Gagal: ' + err.message); }
    },

    async checkAndPollStatus() {
        try {
            const res = await API.getSirupCrawlStatus();
            const s = res.data;
            if (s.running) {
                document.getElementById('btn-start-sirup').style.display = 'none';
                document.getElementById('btn-stop-sirup').style.display = '';
                document.getElementById('sirup-log-container').classList.remove('hidden');
                this.updateStatusUI(s);
                this.pollStatus();
            } else if (s.state === 'completed' && s.logs?.length > 0) {
                document.getElementById('sirup-log-container').classList.remove('hidden');
                this.updateStatusUI(s);
            }
        } catch {}
    },

    async pollStatus() {
        if (this._pollTimer) clearTimeout(this._pollTimer);
        try {
            const res = await API.getSirupCrawlStatus();
            this.updateStatusUI(res.data);
            if (res.data.running) {
                this._pollTimer = setTimeout(() => this.pollStatus(), 2000);
            } else {
                document.getElementById('btn-start-sirup').style.display = '';
                document.getElementById('btn-stop-sirup').style.display = 'none';
                this.loadResults();
            }
        } catch {
            if (this._pollTimer) clearTimeout(this._pollTimer);
            document.getElementById('btn-start-sirup').style.display = '';
            document.getElementById('btn-stop-sirup').style.display = 'none';
        }
    },

    updateStatusUI(s) {
        const statusEl = document.getElementById('sirup-status-text');
        const logsEl = document.getElementById('sirup-logs');
        const logContainer = document.getElementById('sirup-log-container');
        if (statusEl) {
            statusEl.textContent = s.running ? (s.progress || 'Berjalan...') :
                s.state === 'completed' ? `Selesai — ${s.history?.[0]?.total || 0} data` :
                s.state === 'error' ? 'Error' : 'Siap';
        }
        if (logsEl && s.logs) {
            logContainer?.classList.remove('hidden');
            logsEl.innerHTML = s.logs.slice(-40).map(l => `<div style="white-space:pre;">${this.esc(l)}</div>`).join('');
            logsEl.scrollTop = logsEl.scrollHeight;
        }
    },

    // ─── Table Filters ─────────────────────────────────
    filterSearchProv(q) {
        const dd = document.getElementById('sirup-filter-prov-dd');
        if (!dd) return;
        if (!q || q.length < 1) { dd.classList.add('hidden'); return; }
        const ql = q.toLowerCase();
        const list = this.crawledProvinces.filter(n => n.toLowerCase().includes(ql));
        if (list.length === 0) { dd.innerHTML = '<div style="padding:10px 14px;color:var(--text-muted);font-size:0.82rem;">Tidak ditemukan</div>'; dd.classList.remove('hidden'); return; }
        dd.innerHTML = list.map(n =>
            `<div class="tb-dropdown-item" onmousedown="SirupBrowsePage.applyFilterProv('${n}')" style="padding:8px 14px;font-size:0.85rem;cursor:pointer;">${n}</div>`
        ).join('');
        dd.classList.remove('hidden');
    },

    applyFilterProv(name) {
        this.filterProvinsi = name;
        document.getElementById('sirup-filter-prov-input').value = name;
        document.getElementById('sirup-filter-prov-dd').classList.add('hidden');
        this.page = 1;
        this.loadResults();
    },

    clearFilterProv() {
        this.filterProvinsi = '';
        document.getElementById('sirup-filter-prov-input').value = '';
        this.page = 1;
        this.loadResults();
    },

    toggleFilterBulan(m) {
        this.filterBulanMulti.has(m) ? this.filterBulanMulti.delete(m) : this.filterBulanMulti.add(m);
        this.page = 1;
        this.loadResults();
    },

    setFilterBulan(val) {
        if (val) {
            this.filterBulanMulti = new Set([parseInt(val)]);
        } else {
            this.filterBulanMulti = new Set();
        }
        this.page = 1;
        this.loadResults();
    },

    toggleFilterBulan(m) {
        if (this.filterBulanMulti.has(m)) {
            this.filterBulanMulti.delete(m);
        } else {
            this.filterBulanMulti.add(m);
        }
        this.page = 1;
        this.loadResults();
    },

    selectAllBulan() {
        this.filterBulanMulti = new Set([1,2,3,4,5,6,7,8,9,10,11,12]);
        this.page = 1;
        this.loadResults();
    },

    clearAllBulan() {
        this.filterBulanMulti = new Set();
        this.page = 1;
        this.loadResults();
    },

    setFilterTahun(val) {
        this.filterTahun = val ? parseInt(val) : new Date().getFullYear();
        this.page = 1;
        this.loadResults();
    },

    setFilterMetode(val) {
        this.filterMetode = val || '';
        this.page = 1;
        this.loadResults();
    },

    setFilterRead(val) {
        this.filterRead = val || '';
        this.page = 1;
        this.loadResults();
    },

    applyFilterCari() {
        this.filterCari = document.getElementById('sirup-filter-cari').value.trim();
        this.page = 1;
        this.loadResults();
    },

    addExcludeWord(word) {
        const w = word.trim().toLowerCase();
        if (!w) return;
        if (this.filterExcludeWords.includes(w)) return;
        this.filterExcludeWords.push(w);
        this.saveToStorage();
        this.page = 1;
        this.loadResults();
    },

    removeExcludeWord(word) {
        this.filterExcludeWords = this.filterExcludeWords.filter(w => w !== word);
        this.saveToStorage();
        this.page = 1;
        this.loadResults();
    },

    clearAllFilters() {
        this.filterProvinsi = '';
        this.filterCari = '';
        this.filterExcludeWords = [];
        this.saveToStorage();
        const cm = new Date().getMonth() + 1;
        this.filterBulanMulti = new Set();
        for (let m = cm; m <= 12; m++) this.filterBulanMulti.add(m);
        this.filterTahun = new Date().getFullYear();
        this.filterMetode = 'Penunjukan Langsung';
        this.filterRead = '';
        this.page = 1;
        const input = document.getElementById('sirup-filter-cari');
        if (input) input.value = '';
        const provInput = document.getElementById('sirup-filter-prov-input');
        if (provInput) provInput.value = '';
        const tahunSelect = document.getElementById('sirup-filter-tahun-select');
        if (tahunSelect) tahunSelect.value = String(new Date().getFullYear());
        const metodeSelect = document.getElementById('sirup-filter-metode-select');
        if (metodeSelect) metodeSelect.value = 'Penunjukan Langsung';
        const readSelect = document.getElementById('sirup-filter-read-select');
        if (readSelect) readSelect.value = '';
        this.loadResults();
    },

    // ─── Results Table ─────────────────────────────────
    async loadResults() {
        const container = document.getElementById('sirup-results-container');
        if (!container) return;

        try {
            const params = { page: this.page, limit: 20, tahun: this.filterTahun };
            if (this.selectedProvinces.size) params.provinsi = [...this.selectedProvinces].join(',');
            if (this.filterCari) params.search = this.filterCari;
            if (this.filterExcludeWords.length) params.exclude = this.filterExcludeWords.join('|');
            if (this.filterProvinsi) params.filter_lokasi = this.filterProvinsi;
            if (this.filterBulanMulti.size) params.bulan = [...this.filterBulanMulti].join(',');
            if (this.filterMetode) params.metode = this.filterMetode;
            if (this.filterRead) {
                params.read_status = this.filterRead;
                params.read_codes = [...this.readSet].join(',');
            }
            if (this.sortCol) { params.sort = this.sortCol; params.dir = this.sortDir; }

            console.log('[SIRUP] loadResults params:', JSON.stringify(params));
            const res = await API.getSirupRup(params);
            this.results = res.data || [];
            this.total = res.total || 0;

            const defaultBulan = new Set(); for (let m = new Date().getMonth()+1; m<=12; m++) defaultBulan.add(m);
            const isDefaultBulan = this.filterBulanMulti.size === defaultBulan.size && [...this.filterBulanMulti].every(m => defaultBulan.has(m));
            const isDefaultMetode = this.filterMetode === 'Penunjukan Langsung';
            const hasActiveFilter = this.filterCari || this.filterExcludeWords.length || this.filterProvinsi || !isDefaultBulan || !isDefaultMetode || this.filterTahun !== new Date().getFullYear() || !!this.filterRead;

            if (!this.results.length) {
                container.innerHTML = `
                    <div class="empty-state" style="padding:60px 20px;">
                        <i data-lucide="clipboard-list" style="width:48px;height:48px;color:var(--text-muted);"></i>
                        <p style="font-size:1rem;font-weight:600;margin-top:16px;color:var(--text-primary);">Belum ada data RUP</p>
                        <p style="color:var(--text-muted);margin-top:4px;">${hasActiveFilter ? 'Tidak ada data yang cocok dengan filter' : 'Pilih provinsi dan bulan, lalu jalankan crawl'}</p>
                        ${hasActiveFilter ? '<button class="btn btn-danger btn-sm" style="margin-top:16px;" onclick="SirupBrowsePage.clearAllFilters()"><i data-lucide="x"></i> Reset Filter</button>' : ''}
                    </div>`;
                lucide.createIcons({ nodes: [container] });
                return;
            }

            const thStyle = (col) => {
                let base = 'padding:10px 12px;font-size:0.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;white-space:nowrap;';
                if (col.sortable) base += 'cursor:pointer;user-select:none;';
                return base;
            };
            const sortIcon = (col) => {
                if (this.sortCol !== col.key) return '<span style="opacity:0.3;margin-left:4px;">↕</span>';
                return this.sortDir === 'asc' ? '<span style="margin-left:4px;">↑</span>' : '<span style="margin-left:4px;">↓</span>';
            };

            container.innerHTML = `
                <div class="card" style="overflow-x:auto;">
                    <!-- Filter Bar -->
                    <div style="padding:12px 16px; border-bottom:1px solid var(--border-subtle);">
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <!-- Cari kata -->
                            <div style="position:relative;">
                                <input type="text" class="form-input" id="sirup-filter-cari" placeholder="Cari nama paket..."
                                    value="${this.esc(this.filterCari)}"
                                    style="height:32px;width:200px;font-size:0.82rem;padding-left:28px;"
                                    onkeydown="if(event.key==='Enter')SirupBrowsePage.applyFilterCari()">
                                <i data-lucide="search" style="width:13px;height:13px;position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;"></i>
                            </div>

                            <!-- Kecualikan kata: chip input -->
                            <div style="display:flex;align-items:center;gap:4px;min-height:32px;padding:2px 8px;border:1px solid var(--danger);border-radius:6px;background:var(--bg-primary);flex-wrap:wrap;">
                                ${this.filterExcludeWords.map(w => `
                                    <span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;font-size:0.75rem;background:rgba(239,68,68,0.1);color:var(--danger);border-radius:4px;">
                                        ${this.esc(w)}
                                        <button type="button" onclick="SirupBrowsePage.removeExcludeWord('${this.esc(w)}')" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:0;font-size:0.85rem;line-height:1;">&times;</button>
                                    </span>
                                `).join('')}
                                <input type="text" id="sirup-filter-exclude" placeholder="${this.filterExcludeWords.length ? '' : 'Kecualikan...'}"
                                    style="border:none;outline:none;background:transparent;font-size:0.82rem;min-width:80px;flex:1;height:24px;color:var(--text-primary);"
                                    onkeydown="if(event.key==='Enter'){event.preventDefault();event.stopPropagation();const v=this.value.trim();if(v){SirupBrowsePage.addExcludeWord(v);this.value='';}}">
                            </div>

                            <!-- Filter Lokasi -->
                            <div style="position:relative;">
                                <input type="text" class="form-input" id="sirup-filter-prov-input" placeholder="Lokasi..."
                                    autocomplete="off"
                                    value="${this.esc(this.filterProvinsi)}"
                                    style="height:32px;width:160px;font-size:0.82rem;"
                                    oninput="SirupBrowsePage.filterSearchProv(this.value)"
                                    onfocus="SirupBrowsePage.filterSearchProv(this.value)"
                                    onkeydown="if(event.key==='Enter'){event.preventDefault();SirupBrowsePage.applyFilterProv(this.value.trim());}"
                                    onblur="setTimeout(()=>document.getElementById('sirup-filter-prov-dd').classList.add('hidden'),150)">
                                <div id="sirup-filter-prov-dd" class="hidden" style="position:absolute;top:100%;left:0;z-index:50;max-height:200px;overflow-y:auto;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);box-shadow:var(--shadow-lg);min-width:160px;"></div>
                            </div>

                            <!-- Filter Bulan: checkbox dropdown -->
                            <div style="position:relative;">
                                <button type="button" id="sirup-bulan-dd-btn" onclick="document.getElementById('sirup-bulan-dd').classList.toggle('hidden')"
                                    style="height:32px;font-size:0.82rem;padding:0 24px 0 10px;border:1px solid var(--border-subtle);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap;">
                                    Bulan${this.filterBulanMulti.size ? ' ('+this.filterBulanMulti.size+')' : ''}
                                    <i data-lucide="chevron-down" style="width:12px;height:12px;position:absolute;right:8px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;"></i>
                                </button>
                                <div id="sirup-bulan-dd" class="hidden" style="position:absolute;top:100%;left:0;z-index:50;min-width:160px;max-height:260px;overflow-y:auto;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);box-shadow:var(--shadow-lg);padding:6px 0;margin-top:4px;">
                                    <div style="padding:4px 10px 6px;display:flex;gap:6px;">
                                        <button type="button" onclick="SirupBrowsePage.selectAllBulan()" style="font-size:0.7rem;color:var(--accent);background:none;border:none;cursor:pointer;">Pilih Semua</button>
                                        <button type="button" onclick="SirupBrowsePage.clearAllBulan()" style="font-size:0.7rem;color:var(--danger);background:none;border:none;cursor:pointer;">Hapus Semua</button>
                                    </div>
                                    ${this.BULAN_NAMES.map((name, i) => {
                                        const m = i + 1;
                                        const checked = this.filterBulanMulti.has(m) ? 'checked' : '';
                                        return `<label style="display:flex;align-items:center;gap:8px;padding:5px 10px;font-size:0.82rem;cursor:pointer;color:var(--text-primary);" onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background=''">
                                            <input type="checkbox" ${checked} onchange="SirupBrowsePage.toggleFilterBulan(${m})" style="accent-color:var(--accent);width:14px;height:14px;">
                                            ${name}
                                        </label>`;
                                    }).join('')}
                                </div>
                            </div>

                            <!-- Filter Tahun: dropdown -->
                            <select class="form-select" id="sirup-filter-tahun-select"
                                style="height:32px;font-size:0.82rem;min-width:54px;max-width:64px;padding:0 16px 0 6px;"
                                onchange="SirupBrowsePage.setFilterTahun(this.value)">
                                ${[2026,2025,2024].map(y => `<option value="${y}" ${this.filterTahun===y?'selected':''}>${y}</option>`).join('')}
                            </select>

                            <!-- Filter Metode: dropdown -->
                            <select class="form-select" id="sirup-filter-metode-select"
                                style="height:32px;font-size:0.82rem;min-width:70px;max-width:100px;padding:0 16px 0 6px;"
                                onchange="SirupBrowsePage.setFilterMetode(this.value)">
                                <option value="">Metode</option>
                                ${this.metodeList.map(m =>
                                    `<option value="${m}" ${this.filterMetode===m?'selected':''}>${m}</option>`
                                ).join('')}
                            </select>

                            <!-- Filter Dibaca: dropdown -->
                            <select class="form-select" id="sirup-filter-read-select"
                                style="height:32px;font-size:0.82rem;min-width:100px;max-width:130px;padding:0 16px 0 6px;"
                                onchange="SirupBrowsePage.setFilterRead(this.value)">
                                <option value="" ${this.filterRead===''?'selected':''}>Semua Hasil</option>
                                <option value="unread" ${this.filterRead==='unread'?'selected':''}>Belum Dibaca</option>
                                <option value="read" ${this.filterRead==='read'?'selected':''}>Dibaca</option>
                            </select>

                            ${hasActiveFilter ? `<button class="btn btn-xs btn-danger" style="height:24px;font-size:0.72rem;" onclick="SirupBrowsePage.clearAllFilters()">Clear</button>` : ''}
                            <button class="btn btn-xs btn-secondary" style="height:24px;font-size:0.72rem;margin-left:4px;" onclick="SirupBrowsePage.markAllAsRead()">Tandai Semua Dibaca</button>
                            <button class="btn btn-xs btn-secondary" style="height:24px;font-size:0.72rem;" onclick="SirupBrowsePage.downloadPdf()"><i data-lucide="download" style="width:11px;height:11px;"></i> Download PDF</button>
                            <button class="btn btn-xs btn-secondary" style="height:24px;font-size:0.72rem;" onclick="SirupBrowsePage.kirimPdf()"><i data-lucide="send" style="width:11px;height:11px;"></i> Kirim PDF</button>
                            <span style="font-size:0.82rem;color:var(--text-muted);margin-left:auto;">${this.total} data</span>
                        </div>
                    </div>

                    <table class="table" style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:2px solid var(--border-subtle);text-align:left;">
                                <th style="padding:10px 12px;font-size:0.78rem;font-weight:700;color:var(--text-muted);width:45px;">No</th>
                                ${this.COLS.map(c => `
                                    <th style="${thStyle(c)}" ${c.sortable ? `onclick="SirupBrowsePage.toggleSort('${c.key}')"` : ''}>
                                        ${c.label}${sortIcon(c)}
                                    </th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${this.results.map((r, i) => {
                                const read = this.isRead(r.kode_paket);
                                const bg = read ? '' : 'background:rgba(100,116,139,0.06);';
                                return `
                                <tr style="border-bottom:1px solid var(--border-subtle);cursor:pointer;transition:background 0.15s;${bg}"
                                    onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background='${bg ? 'rgba(100,116,139,0.06)' : ''}'"
                                    onclick="SirupBrowsePage.showDetail('${r.kode_paket}')">
                                    <td style="padding:10px 12px;font-size:0.85rem;color:var(--text-muted);" onclick="event.stopPropagation();${read ? `SirupBrowsePage.confirmMarkUnread('${r.kode_paket}', event)` : `SirupBrowsePage.confirmMarkRead('${r.kode_paket}', event)`}">${(this.page-1)*20+i+1}</td>
                                    <td style="padding:10px 12px;max-width:320px;">
                                        <div style="font-weight:600;font-size:0.88rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.esc(r.nama_paket)}</div>
                                        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">${this.esc(r.kode_paket)}</div>
                                    </td>
                                    <td style="padding:10px 12px;font-size:0.88rem;font-weight:600;white-space:nowrap;">${Fmt.rupiah(r.pagu)}</td>
                                    <td style="padding:10px 12px;font-size:0.82rem;white-space:nowrap;">${this.esc(r.metode || '-')}</td>
                                    <td style="padding:10px 12px;font-size:0.82rem;">${this.esc(this.getPemilihanDisplay(r))}</td>
                                    <td style="padding:10px 12px;font-size:0.82rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this.esc(r.lokasi || '')}">${this.esc(r.lokasi || '-')}</td>
                                </tr>`}).join('')}
                        </tbody>
                    </table>
                </div>`;

            const totalPages = Math.ceil(this.total / 20);
            const pagEl = document.getElementById('sirup-pagination');
            if (pagEl) {
                pagEl.innerHTML = totalPages > 1 ? `
                    <button class="btn btn-secondary btn-sm" ${this.page<=1?'disabled':''} onclick="SirupBrowsePage.goPage(${this.page-1})">Prev</button>
                    <span style="display:flex;align-items:center;font-size:0.85rem;color:var(--text-muted);">Hal ${this.page} / ${totalPages}</span>
                    <button class="btn btn-secondary btn-sm" ${this.page>=totalPages?'disabled':''} onclick="SirupBrowsePage.goPage(${this.page+1})">Next</button>` : '';
            }

            lucide.createIcons({ nodes: [container] });
        } catch (err) {
            container.innerHTML = `<div class="empty-state"><p style="color:var(--danger);">Gagal memuat: ${err.message}</p></div>`;
        }
    },

    toggleSort(col) {
        if (this.sortCol === col) {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortCol = col;
            this.sortDir = 'asc';
        }
        this.loadResults();
    },

    goPage(p) { this.page = p; this.loadResults(); },

    // ─── Detail Modal ──────────────────────────────────
    async showDetail(kode) {
        Toast.info('Memuat detail RUP...');
        try {
            const res = await API.getSirupDetail(kode);
            const r = res.data;
            const d = r.detail_data || {};
            const lokasiRows = d._lokasi_rows || [];
            const sumberDanaRows = d._sumber_dana_rows || [];

            const v = (key) => d[key] || r[key] || null;
            const bool = (val) => val ? '<span style="color:var(--success);font-weight:600;">Ya</span>' : 'Tidak';

            // Helper: render a key-value row
            const kvRow = (label, val, bg) => `
                <div style="display:flex;gap:16px;padding:9px 14px;${bg ? 'background:var(--bg-primary);' : ''}border-bottom:1px solid var(--border-subtle);">
                    <div style="width:170px;flex-shrink:0;font-size:0.8rem;font-weight:600;color:var(--text-muted);">${label}</div>
                    <div style="font-size:0.85rem;color:var(--text-primary);word-break:break-word;">${val || '-'}</div>
                </div>`;

            // Helper: render a section
            const section = (icon, title, content) => `
                <div style="margin-top:22px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                        <i data-lucide="${icon}" style="width:15px;height:15px;color:var(--accent);"></i>
                        <span style="font-size:0.88rem;font-weight:700;color:var(--text-primary);">${title}</span>
                    </div>
                    <div style="border:1px solid var(--border-subtle);border-radius:8px;overflow:hidden;">${content}</div>
                </div>`;

            let html = `<div style="max-height:72vh;overflow-y:auto;">`;

            // ── Header: Kode + Nama + Pagu ──
            html += `
                <div style="padding:16px;background:var(--bg-primary);border-radius:8px;margin-bottom:4px;">
                    <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-bottom:4px;">${this.esc(r.kode_paket)}</div>
                    <div style="font-size:1rem;font-weight:700;color:var(--text-primary);margin-bottom:6px;line-height:1.4;">${this.esc(v('Nama Paket') || r.nama_paket)}</div>
                    <div style="font-size:1.1rem;font-weight:800;color:var(--success);">${Fmt.rupiah(r.pagu)}</div>
                </div>`;

            // ── Identitas ──
            html += section('building-2', 'Identitas', [
                kvRow('KLPD', v('Nama KLPD') || r.kldi, false),
                kvRow('Satuan Kerja', v('Satuan Kerja') || r.satuan_kerja, true),
                kvRow('Tahun Anggaran', v('Tahun Anggaran') || r.tahun_anggaran, false),
                kvRow('Jenis Pengadaan', v('Jenis Pengadaan') || r.jenis_pengadaan, true),
                kvRow('Metode Pemilihan', v('Metode Pemilihan') || r.metode, false),
                kvRow('PDN', bool(v('Produk Dalm Negeri') === 'Ya' || r.is_pdn), true),
                kvRow('Usaha Kecil', bool(v('Usaha Kecil/Koperasi') === 'Ya' || r.is_umk), false),
            ].join(''));

            // ── Lokasi ──
            if (lokasiRows.length) {
                const lokRows = lokasiRows.map((lr, i) => `
                    <div style="display:flex;gap:16px;padding:9px 14px;${i%2===0?'background:var(--bg-primary);':''}border-bottom:1px solid var(--border-subtle);">
                        <div style="font-size:0.85rem;color:var(--text-primary);">${this.esc(lr.provinsi)}</div>
                        <div style="font-size:0.85rem;color:var(--text-secondary);">—</div>
                        <div style="font-size:0.85rem;color:var(--text-primary);">${this.esc(lr.kabupaten)}</div>
                        ${lr.detail ? `<div style="font-size:0.82rem;color:var(--text-muted);">(${this.esc(lr.detail)})</div>` : ''}
                    </div>`).join('');
                html += section('map-pin', 'Lokasi', lokRows);
            }

            // ── Spesifikasi ──
            const spItems = [
                kvRow('Volume', v('Volume Pekerjaan'), false),
                kvRow('Uraian', v('Uraian Pekerjaan'), true),
                kvRow('Spesifikasi', v('Spesifikasi Pekerjaan'), false),
            ];
            if (v('Pra DIPA / DPA')) spItems.push(kvRow('Pra DIPA / DPA', v('Pra DIPA / DPA'), true));
            if (v('Pengadaan Berkelanjutan atau Sustainable Public Procurement (SPP)')) {
                const spp = ['Aspek Ekonomi','Aspek Sosial','Aspek Lingkungan'].filter(a => d[a]).map(a => `${a}: ${d[a]}`).join(', ');
                spItems.push(kvRow('SPP', spp || '-', false));
            }
            html += section('clipboard', 'Spesifikasi', spItems.join(''));

            // ── Sumber Dana ──
            if (sumberDanaRows.length) {
                const sdRows = sumberDanaRows.map((sr, i) => `
                    <div style="display:flex;gap:16px;padding:9px 14px;${i%2===0?'background:var(--bg-primary);':''}border-bottom:1px solid var(--border-subtle);">
                        <div style="font-size:0.85rem;color:var(--text-primary);">${this.esc(sr.sumberDana)}</div>
                        <div style="font-size:0.82rem;color:var(--text-muted);">${this.esc(sr.tahun)}</div>
                        <div style="font-size:0.82rem;color:var(--text-secondary);flex:1;">${this.esc(sr.klpd)}</div>
                        <div style="font-size:0.85rem;font-weight:600;color:var(--text-primary);">${sr.pagu ? Fmt.rupiah(parseInt(sr.pagu.replace(/\D/g,''))||0) : '-'}</div>
                    </div>`).join('');
                html += section('banknote', 'Sumber Dana', sdRows);
            }

            // ── Jadwal ──
            const parseDateRange = (text) => {
                if (!text) return null;
                const m = text.match(/(?:Mulai\s+Akhir\s+)?(.+?\d{4})\s+(.+?\d{4})/);
                if (m) return `${m[1].trim()} → ${m[2].trim()}`;
                return null;
            };
            const jadwalItems = [];
            const pm = parseDateRange(v('Pemanfaatan Barang/Jasa'));
            if (pm) jadwalItems.push(kvRow('Pemanfaatan', pm, false));
            const jk = parseDateRange(v('Jadwal Pelaksanaan Kontrak'));
            if (jk) jadwalItems.push(kvRow('Kontrak', jk, jadwalItems.length % 2 === 0));
            const jp = parseDateRange(v('Jadwal Pemilihan Penyedia'));
            if (jp) jadwalItems.push(kvRow('Pemilihan', jp, jadwalItems.length % 2 === 0));
            if (d['Tanggal Umumkan Paket']) jadwalItems.push(kvRow('Diumumkan', d['Tanggal Umumkan Paket'], jadwalItems.length % 2 === 0));
            if (jadwalItems.length) html += section('calendar', 'Jadwal', jadwalItems.join(''));

            // ── Detail Lainnya ──
            const skipKeys = new Set([
                'Nama Paket','Kode RUP','Nama KLPD','Satuan Kerja','Tahun Anggaran',
                'Volume Pekerjaan','Uraian Pekerjaan','Spesifikasi Pekerjaan',
                'Produk Dalam Negeri','Usaha Kecil/Koperasi','Pra DIPA / DPA',
                'Jenis Pengadaan','Total Pagu','Metode Pemilihan',
                'Tanggal Umumkan Paket','Pemanfaatan Barang/Jasa',
                'Jadwal Pelaksanaan Kontrak','Jadwal Pemilihan Penyedia',
                '_lokasi_rows','_sumber_dana_rows',
                'Aspek Ekonomi','Aspek Sosial','Aspek Lingkungan',
                'Pengadaan Berkelanjutan atau Sustainable Public Procurement (SPP)',
                'Sumber Dana',
            ]);
            const extra = Object.entries(d).filter(([k]) => !skipKeys.has(k) && !k.startsWith('_'));
            if (extra.length) {
                const extraRows = extra.map(([k, val], i) => `
                    <div style="display:flex;gap:16px;padding:9px 14px;${i%2===0?'background:var(--bg-primary);':''}border-bottom:1px solid var(--border-subtle);">
                        <div style="width:170px;flex-shrink:0;font-size:0.8rem;font-weight:600;color:var(--text-muted);">${this.esc(k)}</div>
                        <div style="font-size:0.85rem;color:var(--text-primary);word-break:break-word;">${this.esc(String(val))}</div>
                    </div>`).join('');
                html += section('info', 'Informasi Tambahan', extraRows);
            }

            html += '</div>';
            if (!Object.keys(d).length) {
                html += `<p style="margin-top:12px;font-size:0.82rem;color:var(--text-muted);">Detail lengkap belum tersedia di data crawl. Ringkasan di atas dari daftar paket.</p>`;
            }
            Modal.open('Detail RUP', html);
        } catch (err) { Toast.error('Gagal: ' + err.message); }
    },

    esc(s) { const e = document.createElement('span'); e.textContent = s || ''; return e.innerHTML; },

    // ─── Read/Unread ────────────────────────────────
    loadReadSet() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY + '_read');
            if (raw) this.readSet = new Set(JSON.parse(raw));
        } catch {}
    },
    saveReadSet() {
        localStorage.setItem(this.STORAGE_KEY + '_read', JSON.stringify([...this.readSet]));
    },
    isRead(kode) { return this.readSet.has(kode); },

    markAsRead(kode) {
        this.readSet.add(kode);
        this.saveReadSet();
        this.loadResults();
    },

    markAsUnread(kode) {
        this.readSet.delete(kode);
        this.saveReadSet();
        this.loadResults();
    },

    confirmMarkRead(kode, event) {
        event.stopPropagation();
        const name = this.results.find(r => r.kode_paket === kode)?.nama_paket || kode;
        Modal.open('Tandai Dibaca', `
            <div style="padding:8px 0;">
                <p style="margin-bottom:16px;color:var(--text-primary);">Tandai <strong>${this.esc(name)}</strong> sebagai sudah dibaca?</p>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Tidak</button>
                    <button class="btn btn-primary btn-sm" onclick="SirupBrowsePage.markAsRead('${kode}');Modal.close();">Ya</button>
                </div>
            </div>
        `);
    },

    confirmMarkUnread(kode, event) {
        event.stopPropagation();
        const name = this.results.find(r => r.kode_paket === kode)?.nama_paket || kode;
        Modal.open('Tandai Belum Dibaca', `
            <div style="padding:8px 0;">
                <p style="margin-bottom:16px;color:var(--text-primary);">Tandai <strong>${this.esc(name)}</strong> sebagai belum dibaca?</p>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Tidak</button>
                    <button class="btn btn-primary btn-sm" onclick="SirupBrowsePage.markAsUnread('${kode}');Modal.close();">Ya</button>
                </div>
            </div>
        `);
    },

    markAllAsRead() {
        if (!this.results.length) return;
        Modal.open('Tandai Semua Dibaca', `
            <div style="padding:8px 0;">
                <p style="margin-bottom:16px;color:var(--text-primary);">Tandai semua ${this.results.length} paket di halaman ini sebagai sudah dibaca?</p>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Batal</button>
                    <button class="btn btn-primary btn-sm" onclick="SirupBrowsePage._doMarkAllRead()">Ya, Tandai</button>
                </div>
            </div>
        `);
    },

    _doMarkAllRead() {
        this.results.forEach(r => this.readSet.add(r.kode_paket));
        this.saveReadSet();
        Modal.close();
        this.loadResults();
        Toast.success('Semua ditandai sudah dibaca');
    },

    // ─── Export / Kirim PDF ──────────────────────────
    async downloadPdf() {
        const { doc, filename } = await this.exportPdf();
        if (!doc) return;
        doc.save(filename);
        Toast.success('PDF berhasil di-download');
    },

    async kirimPdf() {
        try {
            const { doc, filename } = await this.exportPdf();
            if (!doc) return;
            Toast.info('Mengirim PDF ke WhatsApp...');
            const blob = doc.output('blob');
            const fd = new FormData();
            fd.append('file', blob, filename);
            fd.append('message', `RUP SIRUP — Tahun ${this.filterTahun} (${filename})`);
            const res = await fetch('/api/sirup/send-pdf', { method: 'POST', body: fd });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Gagal mengirim');
            Toast.success('PDF terkirim ke WhatsApp');
        } catch (err) {
            Toast.error('Gagal kirim: ' + err.message);
        }
    },

    async exportPdf() {
        Toast.info('Menyiapkan PDF...');
        try {
            // Fetch all matching data (paginate)
            const allData = [];
            let pg = 1;
            const params = { limit: 100, tahun: this.filterTahun };
            if (this.selectedProvinces.size) params.provinsi = [...this.selectedProvinces].join(',');
            if (this.filterCari) params.search = this.filterCari;
            if (this.filterExcludeWords.length) params.exclude = this.filterExcludeWords.join('|');
            if (this.filterProvinsi) params.filter_lokasi = this.filterProvinsi;
            if (this.filterBulanMulti.size) params.bulan = [...this.filterBulanMulti].join(',');
            if (this.filterMetode) params.metode = this.filterMetode;
            if (this.filterRead) {
                params.read_status = this.filterRead;
                params.read_codes = [...this.readSet].join(',');
            }
            if (this.sortCol) { params.sort = this.sortCol; params.dir = this.sortDir; }

            while (true) {
                params.page = pg;
                const res = await API.getSirupRup(params);
                const rows = res.data || [];
                allData.push(...rows);
                if (allData.length >= (res.total || 0) || rows.length < 100) break;
                pg++;
            }

            if (!allData.length) { Toast.warning('Tidak ada data untuk di-export'); return { doc: null, filename: null }; }

            if (!window.jspdf) { Toast.error('jsPDF belum ter-load, coba refresh halaman'); return { doc: null, filename: null }; }
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            // Load logo for watermark
            let logoDataUrl = null;
            try {
                const resp = await fetch('/img/logo.svg');
                const svgText = await resp.text();
                const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(svgBlob);
                const img = new Image();
                await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
                const canvas = document.createElement('canvas');
                canvas.width = 200; canvas.height = 200;
                const ctx = canvas.getContext('2d');
                ctx.globalAlpha = 0.08;
                ctx.drawImage(img, 0, 0, 200, 200);
                logoDataUrl = canvas.toDataURL('image/png');
                URL.revokeObjectURL(url);
            } catch {}

            // Watermark on every page
            const addWatermark = () => {
                if (logoDataUrl) {
                    const pageW = doc.internal.pageSize.getWidth();
                    const pageH = doc.internal.pageSize.getHeight();
                    doc.addImage(logoDataUrl, 'PNG', (pageW - 60) / 2, (pageH - 60) / 2, 60, 60);
                }
            };
            doc.setPage = (function(orig) {
                return function(n) { orig.call(doc, n); };
            })(doc.setPage.bind(doc));

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Rencana Umum Pengadaan (RUP) — SIRUP LKPP', 14, 15);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Tahun Anggaran: ${this.filterTahun} | Total: ${allData.length} data | Dicetak: ${new Date().toLocaleDateString('id-ID')} | https://tender.rekayasa-sipil.my.id`, 14, 22);

            const rows = allData.map((r, i) => [
                i + 1,
                r.kode_paket || '-',
                r.satuan_kerja || '-',
                r.nama_paket || '-',
                r.pagu ? Fmt.rupiah(r.pagu) : '-',
                r.metode || '-',
                this.getPemilihanDisplay(r),
                r.lokasi || '-',
            ]);

            // Store allData for link building in didDrawCell
            const allDataRef = allData;

            doc.autoTable({
                startY: 26,
                head: [['No', 'Kode RUP', 'Satuan Kerja', 'Nama Paket', 'Pagu (Rp)', 'Metode Pemilihan', 'Waktu Pemilihan', 'Lokasi']],
                body: rows,
                styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', font: 'helvetica' },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', fontSize: 7 },
                alternateRowStyles: { fillColor: [245, 248, 250] },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center' },
                    1: { cellWidth: 28 },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 'auto' },
                    4: { cellWidth: 28, halign: 'right' },
                    5: { cellWidth: 28 },
                    6: { cellWidth: 30 },
                    7: { cellWidth: 35 },
                },
                didParseCell: function(data) {
                    // Blue text for nama_paket hyperlinks
                    if (data.section === 'body' && data.column.index === 3) {
                        const kode = allDataRef[data.row.index]?.kode_paket;
                        if (kode) {
                            data.cell.styles.textColor = [37, 99, 235];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                },
                didDrawCell: function(data) {
                    // Hyperlink on nama_paket column
                    if (data.section === 'body' && data.column.index === 3) {
                        const kode = allDataRef[data.row.index]?.kode_paket;
                        if (kode) {
                            const url = `https://sirup.inaproc.id/sirup/rup/detailPaketPenyedia2020?idPaket=${kode}`;
                            doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
                        }
                    }
                },
                margin: { left: 14, right: 14 },
            });

            // Watermark on every page
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                addWatermark();
            }

            const filename = `RUP_${this.filterTahun}_${new Date().toISOString().slice(0,10)}.pdf`;
            return { doc, filename };
        } catch (err) {
            Toast.error('Gagal export: ' + err.message);
            return { doc: null, filename: null };
        }
    },

    getPemilihanDisplay(r) {
        if (r.detail_data) {
            try {
                const dd = typeof r.detail_data === 'string' ? JSON.parse(r.detail_data) : r.detail_data;
                const akhir = dd['Jadwal Pemilihan Penyedia Akhir'];
                if (akhir) return akhir;
            } catch {}
        }
        return r.pemilihan || '-';
    },
};
window.SirupBrowsePage = SirupBrowsePage;
