const SettingsPage = {
    lpseList: [],
    selectedLpse: [],

    async render() {
        return `
        <div class="page-header"><div><h2>Pengaturan</h2><p>Konfigurasi aplikasi dan integrasi</p></div></div>
        <div style="max-width: 800px; margin: 0 auto;">
            <div class="card" style="margin-bottom:24px; padding:28px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
                    <div style="width:40px; height:40px; border-radius:10px; background:rgba(59,130,246,0.1); color:var(--accent); display:flex; align-items:center; justify-content:center;">
                        <i data-lucide="target"></i>
                    </div>
                    <h3 style="font-size:1.1rem; font-weight:700;">Target Monitoring LPSE</h3>
                </div>
                <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:20px;">Tentukan LPSE mana saja yang akan dipantau oleh sistem crawler otomatis.</p>
                <div class="form-group" style="position:relative;">
                    <label class="form-label">Pilih LPSE Target</label>
                    <input type="text" class="form-input" id="s-lpse-search" placeholder="Cari nama LPSE..." autocomplete="off">
                    <div id="s-lpse-dropdown" class="tb-dropdown hidden"></div>
                </div>
                <div id="s-lpse-selected" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:16px;"></div>
            </div>

            <div class="card" style="margin-bottom:24px; padding:28px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
                    <div style="width:40px; height:40px; border-radius:10px; background:rgba(59,130,246,0.1); color:var(--accent); display:flex; align-items:center; justify-content:center;">
                        <i data-lucide="filter"></i>
                    </div>
                    <h3 style="font-size:1.1rem; font-weight:700;">Filter Halaman Utama</h3>
                </div>
                <div class="form-group" style="position:relative;">
                    <label class="form-label">Pilih LPSE Default di Cari Tender</label>
                    <input type="text" class="form-input" id="s-default-lpse-search" placeholder="Cari LPSE..." autocomplete="off">
                    <input type="hidden" id="s-default-lpse-val">
                    <div id="s-default-lpse-dropdown" class="tb-dropdown hidden"></div>
                </div>
            </div>

            <div class="card" style="margin-bottom:32px; padding:28px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                    <div style="width:40px; height:40px; border-radius:10px; background:rgba(59,130,246,0.1); color:var(--accent); display:flex; align-items:center; justify-content:center;">
                        <i data-lucide="message-square"></i>
                    </div>
                    <h3 style="font-size:1.1rem; font-weight:700;">Integrasi Notifikasi WA</h3>
                </div>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:20px; line-height:1.5;">
                    Data WhatsApp akan otomatis terisi dari konfigurasi <code>.env</code> jika belum tersimpan di database.
                </p>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">API Key Fonnte</label>
                        <input type="password" class="form-input" id="s-wakey" placeholder="API Key fonnte.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Nomor Tujuan</label>
                        <input class="form-input" id="s-wanum" placeholder="628xxxxxxxxxx">
                    </div>
                </div>
                <div class="form-group" style="margin-top: 16px;">
                    <label class="form-label">SBU Target Notifikasi</label>
                    <input type="text" class="form-input" id="s-wasbu" placeholder="Contoh: BG 001, BG 002, BG 005, BS 004">
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">Pisahkan dengan koma. Format fleksibel (BG002, BG 002, atau BG-002 akan tetap terdeteksi).</p>
                </div>
                <div style="display:flex; justify-content:flex-end; margin-top:16px;">
                    <button class="btn btn-secondary" style="padding:8px 16px; font-size:0.85rem; border-radius:var(--radius-md); display:flex; align-items:center; gap:8px;" onclick="SettingsPage.testWA(event)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg> Uji Coba Kirim WA
                    </button>
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end;">
                <button class="btn btn-primary" style="padding:12px 32px; font-size:1rem; border-radius:var(--radius-md);" onclick="SettingsPage.save()">
                    <i data-lucide="save"></i> Simpan Semua Pengaturan
                </button>
            </div>
        </div>`;
    },

    async afterRender() {
        try {
            const lpseRes = await API.getLPSEList();
            this.lpseList = lpseRes.data || [];
            
            const { data } = await API.getSettings();
            if (data.wa_api_key) document.getElementById('s-wakey').value = data.wa_api_key;
            if (data.wa_target_numbers) document.getElementById('s-wanum').value = data.wa_target_numbers;
            if (data.wa_target_sbu) document.getElementById('s-wasbu').value = data.wa_target_sbu;
            if (data.crawl_lpse_targets) {
                try {
                    this.selectedLpse = JSON.parse(data.crawl_lpse_targets);
                } catch { this.selectedLpse = []; }
            }
            if (data.default_lpse) {
                try {
                    const def = JSON.parse(data.default_lpse);
                    document.getElementById('s-default-lpse-val').value = def.kd_lpse;
                    document.getElementById('s-default-lpse-search').value = def.nama_lpse;
                } catch {}
            }
        } catch { /* not configured yet */ }
        
        this.renderSelectedLpse();
        this._setupLpseSearch();
        this._setupDefaultLpseSearch();
    },

    _setupDefaultLpseSearch() {
        const input = document.getElementById('s-default-lpse-search');
        const valInput = document.getElementById('s-default-lpse-val');
        const dropdown = document.getElementById('s-default-lpse-dropdown');
        if (!input || !dropdown) return;

        const show = (q) => {
            const matches = this.lpseList
                .filter(l => l.nama_lpse.toLowerCase().includes(q.toLowerCase()))
                .slice(0, 50);
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
                input.value = item.dataset.name;
                valInput.value = item.dataset.kd;
                dropdown.classList.add('hidden');
            }
        });

        input.addEventListener('input', (e) => {
            const q = e.target.value.trim();
            if (!q) valInput.value = '';
            q.length >= 2 ? show(q) : dropdown.classList.add('hidden');
        });
        input.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 150));
    },

    _setupLpseSearch() {
        const input = document.getElementById('s-lpse-search');
        const dropdown = document.getElementById('s-lpse-dropdown');
        if (!input || !dropdown) return;

        const show = (q) => {
            const matches = this.lpseList
                .filter(l => l.nama_lpse.toLowerCase().includes(q.toLowerCase()))
                .filter(l => !this.selectedLpse.find(s => s.kd_lpse == l.kd_lpse))
                .slice(0, 50);
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
                this.selectedLpse.push({ kd_lpse: item.dataset.kd, nama_lpse: item.dataset.name });
                this.renderSelectedLpse();
                input.value = '';
                dropdown.classList.add('hidden');
            }
        });

        input.addEventListener('input', (e) => {
            const q = e.target.value.trim();
            q.length >= 2 ? show(q) : dropdown.classList.add('hidden');
        });
        input.addEventListener('focus', (e) => {
            if (e.target.value.trim().length >= 2) show(e.target.value.trim());
        });
        input.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 150));
    },

    renderSelectedLpse() {
        const el = document.getElementById('s-lpse-selected');
        if (!this.selectedLpse.length) {
            el.innerHTML = '<span style="font-size:0.85rem; color:var(--text-muted); font-style:italic;">Semua LPSE terpilih.</span>';
            return;
        }
        el.innerHTML = this.selectedLpse.map(l => `
            <div class="lpse-chip">
                ${l.nama_lpse} 
                <button onclick="SettingsPage.removeLpse('${l.kd_lpse}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
        `).join('');
    },

    removeLpse(kd) {
        this.selectedLpse = this.selectedLpse.filter(l => String(l.kd_lpse) !== String(kd));
        this.renderSelectedLpse();
    },

    async save() {
        try {
            await API.updateSettings({
                wa_api_key: document.getElementById('s-wakey').value.trim(),
                wa_target_numbers: document.getElementById('s-wanum').value.trim(),
                wa_target_sbu: document.getElementById('s-wasbu').value.trim(),
                crawl_lpse_targets: JSON.stringify(this.selectedLpse),
                default_lpse: document.getElementById('s-default-lpse-val').value ? JSON.stringify({
                    kd_lpse: document.getElementById('s-default-lpse-val').value,
                    nama_lpse: document.getElementById('s-default-lpse-search').value
                }) : null
            });
            Toast.success('Pengaturan berhasil disimpan');
        } catch(e) { Toast.error(e.message); }
    },

    async testWA(e) {
        if (e) e.preventDefault();
        const apiKey = document.getElementById('s-wakey').value.trim();
        const target = document.getElementById('s-wanum').value.trim();
        
        if (!apiKey || !target) {
            Toast.error('API Key Fonnte dan Nomor Tujuan harus diisi untuk uji coba!');
            return;
        }

        try {
            Toast.info('Sedang mengirim pesan uji coba...');
            const res = await API.testWA({ wa_api_key: apiKey, wa_target_numbers: target });
            if (res.success) {
                Toast.success('Pesan uji coba berhasil terkirim! Periksa WhatsApp Anda.');
            } else {
                Toast.error(res.error || 'Gagal mengirim pesan uji coba.');
            }
        } catch (err) {
            Toast.error(err.message || 'Gagal mengirim pesan uji coba.');
        }
    }
};
