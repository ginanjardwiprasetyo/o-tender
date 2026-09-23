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
    deleteEducation(id) { return this.request(`/personnel/education/${id}`, { method: 'DELETE' }); },
    addExperience(pid, data) { return this.request(`/personnel/${pid}/experience`, { method: 'POST', body: data }); },
    updateExperience(id, data) { return this.request(`/personnel/experience/${id}`, { method: 'PUT', body: data }); },
    deleteExperience(id) { return this.request(`/personnel/experience/${id}`, { method: 'DELETE' }); },
    addSka(pid, data) { return this.request(`/personnel/${pid}/ska`, { method: 'POST', body: data }); },
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
    getFollowedUpcoming() { return this.request('/followed/upcoming'); },
    checkFollowed(kode) { return this.request(`/followed/check/${kode}`); },
    syncFollowedTender(data) { return this.request('/followed/sync', { method: 'POST', body: data }); },
    syncFollowedStatus() { return this.request('/followed/sync-status', { method: 'POST' }); },
    deleteFollowedTender(id) { return this.request(`/followed/${id}`, { method: 'DELETE' }); },

    // ─── Crawler ──────────────────────────────────────
    startCrawl(year) { return this.request('/crawler/start', { method: 'POST', body: { year } }); },
    stopCrawl() { return this.request('/crawler/stop', { method: 'POST' }); },
    getCrawlStatus() { return this.request('/crawler/status'); },
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
    async uploadFile(file, category) {
        const formData = new FormData();
        formData.append('category', category);
        formData.append('file', file);
        const url = `${this.base}/uploads`;
        const res = await fetch(url, { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Upload gagal');
        return json;
    },
    deleteFile(url) {
        return this.request('/uploads', { method: 'DELETE', body: { url } });
    },

    // ─── Schedules ────────────────────────────────────
    getSchedules() { return this.request('/schedules'); },
    getUpcomingSchedules() { return this.request('/schedules/upcoming'); },

    // ─── Templates ────────────────────────────────────
    getTemplates() { return this.request('/templates'); },
    createTemplate(data) { return this.request('/templates', { method: 'POST', body: data }); },
    updateTemplate(id, data) { return this.request(`/templates/${id}`, { method: 'PUT', body: data }); },
    deleteTemplate(id) { return this.request(`/templates/${id}`, { method: 'DELETE' }); },
    seedTemplates() { return this.request('/templates/seed', { method: 'POST' }); },

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
    getNextLetterNumber(company_id, kode_surat, tahun, bulan) {
        let url = `/letters/next-number?company_id=${company_id}&kode_surat=${encodeURIComponent(kode_surat)}&tahun=${tahun}`;
        if (bulan) url += `&bulan=${bulan}`;
        return this.request(url);
    },

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
