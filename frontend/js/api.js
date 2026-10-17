/**
 * TenderBuild — API Client
 * Wrapper for all backend API calls
 */
const API = {
    base: '/api',

    async request(endpoint, options = {}) {
        const url = `${this.base}${endpoint}`;
        const config = {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        };
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }
        try {
            const res = await fetch(url, { credentials: 'same-origin', ...config });
            const ver = res.headers.get('x-app-ver');
            if (ver && !this._appVerWarned) {
                if (this._appVer === undefined) this._appVer = ver;
                else if (this._appVer !== ver) {
                    this._appVerWarned = true;
                    if (typeof Toast !== 'undefined' && Toast.warning) Toast.warning('Aplikasi diperbarui di server — muat ulang halaman (Ctrl/Cmd+R) untuk fitur terbaru');
                }
            }
            if (res.status === 401) {
                if (typeof App !== 'undefined' && App.showLogin) App.showLogin();
                throw new Error('Belum login');
            }
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            if (!ct.includes('application/json')) {
                throw new Error(`Response bukan JSON (HTTP ${res.status} ${ct || 'tanpa content-type'})`);
            }
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Terjadi kesalahan');
            return json;
        } catch (err) {
            console.error(`API Error [${endpoint}]:`, err);
            throw err;
        }
    },

    // ─── Equipment ────────────────────────────────────
    getEquipments() { return this.request('/equipments'); },
    createEquipment(data) { return this.request('/equipments', { method: 'POST', body: data }); },
    updateEquipment(id, data) { return this.request(`/equipments/${id}`, { method: 'PUT', body: data }); },
    deleteEquipment(id) { return this.request(`/equipments/${id}`, { method: 'DELETE' }); },

    // ─── Personnel ────────────────────────────────────
    getPersonnel() { return this.request('/personnel'); },
    getPersonnelById(id) { return this.request(`/personnel/${id}`); },
    createPersonnel(data) { return this.request('/personnel', { method: 'POST', body: data }); },
    updatePersonnel(id, data) { return this.request(`/personnel/${id}`, { method: 'PUT', body: data }); },
    deletePersonnel(id) { return this.request(`/personnel/${id}`, { method: 'DELETE' }); },
    addEducation(pid, data) { return this.request(`/personnel/${pid}/education`, { method: 'POST', body: data }); },
    updateEducation(id, data) { return this.request(`/personnel/education/${id}`, { method: 'PUT', body: data }); },
    deleteEducation(id) { return this.request(`/personnel/education/${id}`, { method: 'DELETE' }); },
    addExperience(pid, data) { return this.request(`/personnel/${pid}/experience`, { method: 'POST', body: data }); },
    updateExperience(id, data) { return this.request(`/personnel/experience/${id}`, { method: 'PUT', body: data }); },
    deleteExperience(id) { return this.request(`/personnel/experience/${id}`, { method: 'DELETE' }); },
    addSka(pid, data) { return this.request(`/personnel/${pid}/ska`, { method: 'POST', body: data }); },
    updateSka(id, data) { return this.request(`/personnel/ska/${id}`, { method: 'PUT', body: data }); },
    deleteSka(id) { return this.request(`/personnel/ska/${id}`, { method: 'DELETE' }); },

    // ─── Tenders ──────────────────────────────────────
    getTenders(status) { return this.request(`/tenders${status ? '?status=' + status : ''}`); },
    getTenderStats() { return this.request('/tenders/stats'); },
    getTenderById(id) { return this.request(`/tenders/${id}`); },
    createTender(data) { return this.request('/tenders', { method: 'POST', body: data }); },
    updateTender(id, data) { return this.request(`/tenders/${id}`, { method: 'PUT', body: data }); },
    deleteTender(id) { return this.request(`/tenders/${id}`, { method: 'DELETE' }); },
    assignPersonnel(tid, data) { return this.request(`/tenders/${tid}/assign`, { method: 'POST', body: data }); },
    removeAssignment(id) { return this.request(`/tenders/assign/${id}`, { method: 'DELETE' }); },

    // ─── LKPP ─────────────────────────────────────────
    getLPSEList() { return this.request('/lkpp/lpse'); },
    searchTenders(tahun, kd_lpse, lpse_name) {
        const name = lpse_name ? `&lpse_name=${encodeURIComponent(lpse_name)}` : '';
        return this.request(`/lkpp/tenders?tahun=${tahun}&kd_lpse=${kd_lpse}${name}`);
    },
    followTender(data) { return this.request('/lkpp/follow', { method: 'POST', body: data }); },
    scrapeTender(slug, kode) { return this.request(`/lkpp/scrape?slug=${slug}&kode=${kode}`); },
    deepScan(slug, kodes) { return this.request(`/lkpp/deep-scan?slug=${slug}&kodes=${Array.isArray(kodes) ? kodes.join(',') : kodes}`); },
    jadwalBatch(slug, kodes) { return this.request(`/lkpp/jadwal-batch?slug=${slug}&kodes=${Array.isArray(kodes) ? kodes.join(',') : kodes}`); },
    
    // ─── Followed Tenders ─────────────────────────────
    getFollowedTenders() { return this.request('/followed'); },
    getFollowedStats() { return this.request('/followed/stats'); },
    getFollowedUpcoming(days, past) {
        const q = [];
        if (days) q.push(`days=${days}`);
        if (past) q.push(`past=${past}`);
        return this.request('/followed/upcoming' + (q.length ? `?${q.join('&')}` : ''));
    },
    checkFollowed(kode) { return this.request(`/followed/check/${kode}`); },
    syncFollowedTender(data) { return this.request('/followed/sync', { method: 'POST', body: data }); },
    syncFollowedStatus() { return this.request('/followed/sync-status', { method: 'POST' }); },
    deleteFollowedTender(id) { return this.request(`/followed/${id}`, { method: 'DELETE' }); },

    // ─── Crawler ──────────────────────────────────────
    startCrawl(year) { return this.request('/crawler/start', { method: 'POST', body: { year } }); },
    stopCrawl() { return this.request('/crawler/stop', { method: 'POST' }); },
    getCrawlStatus() { return this.request('/crawler/status'); },
    getActionsStatus() { return this.request('/crawler/actions-status'); },
    getCrawledTenders(params) {
        const clean = {};
        if (params) Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) clean[k] = v; });
        const q = new URLSearchParams(clean).toString();
        return this.request(`/crawler/tenders${q ? '?' + q : ''}`);
    },

    // ─── Companies ────────────────────────────────────
    getCompanies(params) { 
        if (params && params.search) return this.request(`/companies?search=${encodeURIComponent(params.search)}`);
        return this.request('/companies'); 
    },
    getCompanyById(id) { return this.request(`/companies/${id}`); },
    createCompany(data) { return this.request('/companies', { method: 'POST', body: data }); },
    updateCompany(id, data) { return this.request(`/companies/${id}`, { method: 'PUT', body: data }); },
    deleteCompany(id) { return this.request(`/companies/${id}`, { method: 'DELETE' }); },

    // ─── Uploads ──────────────────────────────────────
    // ponytail: XHR (bukan fetch) agar dapat upload.onprogress; default tampil MB pasti di tombol Simpan modal
    async uploadFile(file, category, onProgress) {
        const mb = (s) => (s / 1024 / 1024).toFixed(1).replace('.', ',');
        const setLabel = (html) => { const b = document.querySelector('#modal-footer .btn-primary'); if (b) b.innerHTML = html; };
        const update = onProgress || ((pct, loaded, total) =>
            setLabel(`<span class="spinner-sm"></span> Mengunggah... ${mb(loaded)}/${mb(total)} MB (${pct}%)`));
        // Kompres gambar dulu (bisa dimatikan di Pengaturan); PDF diteruskan apa adanya
        let payload = file;
        if (localStorage.getItem('tb_compress') !== '0' && file.type.startsWith('image/')) {
            if (!onProgress) setLabel('<span class="spinner-sm"></span> Memampatkan gambar...');
            payload = await this.compressImage(file);
        }
        const MAX = 50 * 1024 * 1024; // samakan dengan multer backend
        if (payload.size > MAX) throw new Error(`File kebesaran (${mb(payload.size)} MB, maks ${mb(MAX)} MB) — kompres/perkecil dulu`);
        update(0, 0, payload.size);
        const formData = new FormData();
        formData.append('category', category);
        formData.append('file', payload, payload.name);
        const json = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${this.base}/uploads`);
            xhr.upload.onprogress = (e) => { if (e.lengthComputable) update(Math.round(e.loaded / e.total * 100), e.loaded, e.total); };
            xhr.onload = () => {
                let j = null;
                try { j = JSON.parse(xhr.responseText); } catch {}
                if (xhr.status >= 200 && xhr.status < 300 && j && j.success) resolve(j);
                else reject(new Error((j && j.error) || `Upload gagal (HTTP ${xhr.status})`));
            };
            xhr.onerror = () => reject(new Error('Upload gagal (jaringan)'));
            xhr.send(formData);
        });
        // ponytail: 100% = baru sampai server; jeda sesudahnya = server teruskan ke storage + simpan → label fase berikut agar tak terlihat stuck
        if (onProgress) update(100, payload.size, payload.size);
        else setLabel(`<span class="spinner-sm"></span> Meneruskan ke penyimpanan... (${mb(payload.size)} MB)`);
        return json;
    },
    // Kompres gambar via Canvas bawaan browser (tanpa lib): max 2560px, JPEG q0.92 / PNG lossless;
    // hasil dipakai hanya jika lebih kecil — dijamin tak pernah lebih besar dari aslinya
    async compressImage(file) {
        try {
            if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
            const bmp = await createImageBitmap(file);
            try {
                const s = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
                const c = document.createElement('canvas');
                c.width = Math.max(1, Math.round(bmp.width * s));
                c.height = Math.max(1, Math.round(bmp.height * s));
                c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
                const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                const blob = await new Promise(r => c.toBlob(r, type, 0.92));
                if (!blob || blob.size >= file.size) return file;
                return new File([blob], file.name.replace(/\.\w+$/, type === 'image/png' ? '.png' : '.jpg'), { type });
            } finally { bmp.close(); }
        } catch { return file; }
    },
    deleteFile(url) {
        return this.request('/uploads', { method: 'DELETE', body: { url } });
    },

    // ─── Documents (server-side generate) ─────────────
    syncTemplate(id, gdoc_id) { return this.request(`/templates/${id}/sync`, { method: 'POST', body: { gdoc_id } }); },
    previewDocument(payload) { return this.request('/documents/preview', { method: 'POST', body: payload }); },
    getDocRecords() { return this.request('/documents/records'); },
    deleteDocRecord(id) { return this.request(`/documents/records/${id}`, { method: 'DELETE' }); },
    generateDocument(payload) { return this.request('/documents/generate', { method: 'POST', body: payload }); },

    // ─── Schedules ────────────────────────────────────
    getSchedules() { return this.request('/schedules'); },
    getUpcomingSchedules() { return this.request('/schedules/upcoming'); },

    // ─── Templates ────────────────────────────────────
    getTemplates() { return this.request('/templates'); },
    createTemplate(data) { return this.request('/templates', { method: 'POST', body: data }); },
    updateTemplate(id, data) { return this.request(`/templates/${id}`, { method: 'PUT', body: data }); },
    deleteTemplate(id) { return this.request(`/templates/${id}`, { method: 'DELETE' }); },
    syncFolder() { return this.request('/templates/sync-folder', { method: 'POST', body: {} }); },

    // ─── Letters ──────────────────────────────────────
    getLetters(params) {
        const clean = {};
        if (params) Object.entries(params).forEach(([k, v]) => { if (v) clean[k] = v; });
        const q = new URLSearchParams(clean).toString();
        return this.request(`/letters${q ? '?' + q : ''}`);
    },
    getLetterById(id) { return this.request(`/letters/${id}`); },
    createLetter(data) { return this.request('/letters', { method: 'POST', body: data }); },
    updateLetter(id, data) { return this.request(`/letters/${id}`, { method: 'PUT', body: data }); },
    deleteLetter(id) { return this.request(`/letters/${id}`, { method: 'DELETE' }); },
    getNextLetterNumber(company_id, kode_surat, tahun, bulan, pa) {
        let url = `/letters/next-number?company_id=${company_id}&kode_surat=${encodeURIComponent(kode_surat)}&tahun=${tahun}`;
        if (bulan) url += `&bulan=${bulan}`;
        if (pa) url += `&pa=${encodeURIComponent(pa)}`;
        return this.request(url);
    },
    // ─── Equipment files (1 alat N lampiran, boleh berbagi) ──
    getEquipmentFiles(id) { return this.request(`/equipments/${id}/files`); },
    getAllEquipmentFiles() { return this.request('/equipments/files/all'); },
    addEquipmentFile(id, data) { return this.request(`/equipments/${id}/files`, { method: 'POST', body: data }); },
    deleteEquipmentFile(fileId) { return this.request(`/equipments/files/${fileId}`, { method: 'DELETE' }); },

    // ─── Settings ─────────────────────────────────────
    getSettings() { return this.request('/settings'); },
    updateSettings(data) { return this.request('/settings', { method: 'PUT', body: data }); },
    testWA(data) { return this.request('/settings/test-wa', { method: 'POST', body: data }); },
    getWAGroups(apiKey) { return this.request(`/settings/wa-groups?apiKey=${encodeURIComponent(apiKey)}`); },
    getWALogs(page = 1, limit = 20) { return this.request(`/settings/wa-logs?page=${page}&limit=${limit}`); },
    resendWALog(id) { return this.request('/settings/wa-resend', { method: 'POST', body: { id } }); },

    // ─── SIRUP ────────────────────────────────────────
    getSirupProvinces() { return this.request('/sirup/provinces'); },
    getSirupCrawledProvinces() { return this.request('/sirup/crawled-provinces'); },
    getSirupMetode() { return this.request('/sirup/metode'); },
    getSirupRup(params) {
        const clean = {};
        if (params) Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null && (!Array.isArray(v) || v.length > 0)) clean[k] = v; });
        const q = new URLSearchParams(clean).toString();
        return this.request(`/sirup${q ? '?' + q : ''}`);
    },
    getSirupDetail(kode) { return this.request(`/sirup/${kode}`); },
    startSirupCrawl(data) { return this.request('/sirup/crawl', { method: 'POST', body: data }); },
    stopSirupCrawl() { return this.request('/sirup/crawl/stop', { method: 'POST' }); },
    getSirupCrawlStatus() { return this.request('/sirup/status'); },
    getSirupStats(tahun) { return this.request(`/sirup/stats?tahun=${tahun || 2026}`); },

    // ─── Health ───────────────────────────────────────
    health() { return this.request('/health'); },
};
