const SettingsPage = {
    lpseList: [],
    selectedLpse: [],
    groupsList: [],
    selectedGroupId: '',
    selectedGroupName: '',

    async render() {
        return `
        <style>
        /* Modern Switch Toggle Style */
        .tb-switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
            flex-shrink: 0;
        }
        .tb-switch input { 
            opacity: 0;
            width: 0;
            height: 0;
        }
        .tb-slider {
            position: absolute;
            cursor: pointer;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: var(--border, #e2e8f0);
            transition: .3s;
            border-radius: 24px;
        }
        .tb-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .tb-switch input:checked + .tb-slider {
            background-color: var(--accent, #3b82f6);
        }
        .tb-switch input:checked + .tb-slider:before {
            transform: translateX(20px);
        }
        .tb-switch-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(248, 250, 252, 0.5);
            padding: 14px 18px;
            border-radius: 12px;
            border: 1px solid var(--border, #f1f5f9);
            transition: all 0.2s ease;
        }
        .tb-switch-container:hover {
            background: rgba(241, 245, 249, 0.8);
            border-color: #cbd5e1;
        }
        .spin {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        </style>

        <div class="page-header"><div><h2>Pengaturan</h2><p>Konfigurasi aplikasi dan integrasi</p></div></div>
        <div style="max-width: 800px; margin: 0 auto; padding-bottom: 50px;">
            
            <!-- Target LPSE Card -->
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

            <!-- Default LPSE Filter Card -->
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

            <!-- WA Notification Config Card -->
            <div class="card" style="margin-bottom:32px; padding:28px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                    <div style="width:40px; height:40px; border-radius:10px; background:rgba(59,130,246,0.1); color:var(--accent); display:flex; align-items:center; justify-content:center;">
                        <i data-lucide="message-square"></i>
                    </div>
                    <h3 style="font-size:1.1rem; font-weight:700;">Integrasi Notifikasi WA</h3>
                </div>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:20px; line-height:1.5;">
                    Data API Key dan nomor telepon akan otomatis terisi dari server (<code>.env</code>) jika belum tersimpan di database.
                </p>
                
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">API Key Fonnte</label>
                        <input type="password" class="form-input" id="s-wakey" placeholder="API Key fonnte.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Nomor Tujuan WA (Pribadi / HP)</label>
                        <input class="form-input" id="s-wanum" placeholder="Contoh: 628xxxxxxxxxx">
                        <p style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Gunakan kode negara (62). Digunakan sebagai fallback jika tidak ada grup yang dipilih.</p>
                    </div>
                </div>

                <!-- WA Group Search & Selection -->
                <div class="form-group" style="position:relative; margin-top: 16px;">
                    <label class="form-label">Cari & Pilih Grup WA (Fonnte)</label>
                    <div style="display:flex; gap:8px;">
                        <div style="position:relative; flex:1; display:flex; align-items:center;">
                            <input type="text" class="form-input" id="s-wagroup-search" placeholder="Cari nama grup WA Anda di Fonnte..." autocomplete="off" style="padding-right:36px;">
                            <button id="s-btn-clear-group" class="hidden" onclick="SettingsPage.clearGroupSelection(event)" style="position:absolute; right:10px; background:none; border:none; color:var(--text-muted); cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Hapus grup terpilih">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                        <button class="btn btn-secondary" style="padding:0 18px; font-size:0.85rem; display:flex; align-items:center; gap:6px; height:42px; border-radius:8px;" id="s-btn-sync-groups" onclick="SettingsPage.fetchGroups(event)">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                            Sinkron Grup
                        </button>
                    </div>
                    <div id="s-wagroup-dropdown" class="tb-dropdown hidden" style="width:100%; top: calc(100% + 4px);"></div>
                    <div id="s-wagroup-selected-info" style="margin-top:6px; font-size:0.78rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                        <span id="s-wagroup-info-text">Tidak ada grup WA yang dipilih (akan dikirim ke nomor HP pribadi).</span>
                    </div>
                </div>

                <div class="form-group" style="margin-top: 16px;">
                    <label class="form-label">SBU Target Notifikasi (Hasil Scraping)</label>
                    <input type="text" class="form-input" id="s-wasbu" placeholder="Contoh: BG 001, BG 002, BG 005, BS 004">
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">Pisahkan dengan koma. Untuk notifikasi tender baru yang cocok dengan kualifikasi SBU perusahaan Anda.</p>
                </div>

                <div class="form-group" style="margin-top: 16px;">
                    <label class="form-label">Batasan HPS Maksimal Notifikasi (Rp)</label>
                    <input type="number" class="form-input" id="s-wamaxhps" placeholder="Contoh: 3500000000">
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">Hanya tender dengan HPS lebih kecil atau sama dengan nominal ini yang akan dikirimkan ke WhatsApp/Grup (kosongkan atau isi 0 untuk mengirim semua).</p>
                </div>

                <!-- WA Schedule Preferences Toggles -->
                <div style="margin-top: 28px; border-top: 1px solid var(--border, #e2e8f0); padding-top: 24px;">
                    <h4 style="font-size:0.95rem; font-weight:700; color:var(--text-main); margin-bottom:16px;">🔔 Pengaturan Jadwal Notifikasi (Tender Saya)</h4>
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        
                        <!-- Toggle 1: Pemberian Penjelasan -->
                        <div class="tb-switch-container">
                            <div style="padding-right: 16px;">
                                <span style="font-size:0.9rem; font-weight:600; color:var(--text-main); display:block; margin-bottom:2px;">Pemberian Penjelasan (Anwijzing)</span>
                                <span style="font-size:0.78rem; color:var(--text-muted);">Kirim notifikasi pengingat 30 menit sebelum rapat pemberian penjelasan dimulai.</span>
                            </div>
                            <label class="tb-switch">
                                <input type="checkbox" id="s-notif-penjelasan" checked>
                                <span class="tb-slider"></span>
                            </label>
                        </div>

                        <!-- Toggle 2: Pemasukan Penawaran -->
                        <div class="tb-switch-container">
                            <div style="padding-right: 16px;">
                                <span style="font-size:0.9rem; font-weight:600; color:var(--text-main); display:block; margin-bottom:2px;">Upload Dokumen Penawaran</span>
                                <span style="font-size:0.78rem; color:var(--text-muted);">Kirim notifikasi H-1 sebelum tanggal batas akhir upload penawaran pada pukul 08:00 WIB.</span>
                            </div>
                            <label class="tb-switch">
                                <input type="checkbox" id="s-notif-upload" checked>
                                <span class="tb-slider"></span>
                            </label>
                        </div>

                        <!-- Toggle 3: Penetapan Pemenang -->
                        <div class="tb-switch-container">
                            <div style="padding-right: 16px;">
                                <span style="font-size:0.9rem; font-weight:600; color:var(--text-main); display:block; margin-bottom:2px;">Penetapan Pemenang</span>
                                <span style="font-size:0.78rem; color:var(--text-muted);">Kirim notifikasi pemberitahuan tepat saat jadwal tahap penetapan pemenang dimulai.</span>
                            </div>
                            <label class="tb-switch">
                                <input type="checkbox" id="s-notif-pemenang" checked>
                                <span class="tb-slider"></span>
                            </label>
                        </div>
                </div>

                <div style="display:flex; justify-content:flex-end; margin-top:24px; border-top: 1px solid var(--border, #e2e8f0); padding-top:20px;">
                    <button class="btn btn-secondary" style="padding:8px 16px; font-size:0.85rem; border-radius:var(--radius-md); display:flex; align-items:center; gap:8px;" onclick="SettingsPage.testWA(event)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg> Uji Coba Kirim WA
                    </button>
                </div>
            </div>

            <!-- WA Logs Card -->
            <div class="card" style="margin-top:32px; margin-bottom:32px; padding:28px;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:40px; height:40px; border-radius:10px; background:rgba(16,185,129,0.1); color:#10b981; display:flex; align-items:center; justify-content:center;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-history"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        </div>
                        <div>
                            <h3 style="font-size:1.1rem; font-weight:700;">Riwayat Pengiriman WA</h3>
                            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Menampilkan 20 riwayat pengiriman notifikasi WhatsApp per halaman.</p>
                        </div>
                    </div>
                    <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem; display:flex; align-items:center; gap:6px; height:34px; border-radius:6px;" onclick="SettingsPage.loadWALogs(event)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                        Segarkan
                    </button>
                </div>

                <div style="overflow-x:auto; border:1px solid var(--border, #e2e8f0); border-radius:8px; max-height:400px; overflow-y:auto; margin-bottom:16px;">
                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                        <thead>
                            <tr style="background:#f8fafc; border-bottom:1px solid var(--border, #e2e8f0); position:sticky; top:0; z-index:1;">
                                <th style="padding:10px 14px; font-weight:600; color:var(--text-main);">Waktu</th>
                                <th style="padding:10px 14px; font-weight:600; color:var(--text-main);">Target</th>
                                <th style="padding:10px 14px; font-weight:600; color:var(--text-main);">Pesan</th>
                                <th style="padding:10px 14px; font-weight:600; color:var(--text-main);">Status</th>
                            </tr>
                        </thead>
                        <tbody id="s-walogs-table-body">
                            <tr>
                                <td colspan="4" style="padding:20px; text-align:center; color:var(--text-muted); font-style:italic;">Memuat riwayat pengiriman...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pagination Controls -->
                <div style="display:flex; align-items:center; justify-content:space-between; padding-top:16px; border-top:1px solid var(--border, #e2e8f0); font-size:0.82rem;">
                    <span style="color:var(--text-muted); font-weight:500;" id="s-walogs-page-info">Halaman 1 dari 1 (Total: 0)</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="btn btn-secondary" id="s-walogs-btn-prev" style="padding:6px 12px; font-size:0.78rem; border-radius:6px; display:flex; align-items:center; gap:4px; height:32px;" onclick="SettingsPage.changeWALogsPage(-1)">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg> Sebelum
                        </button>
                        <button class="btn btn-secondary" id="s-walogs-btn-next" style="padding:6px 12px; font-size:0.78rem; border-radius:6px; display:flex; align-items:center; gap:4px; height:32px;" onclick="SettingsPage.changeWALogsPage(1)">
                            Berikutnya <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                    </div>
                </div>
            </div>
 
            <!-- Save button -->
            <div style="display:flex; justify-content:flex-end;">
                <button class="btn btn-primary" style="padding:12px 32px; font-size:1rem; border-radius:var(--radius-md); display:flex; align-items:center; gap:8px;" onclick="SettingsPage.save()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save"><path d="M21.3 8.7 15.3 2.7A2 2 0 0 0 14 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10a2 2 0 0 0-.7-1.3z"/><path d="M7 22v-8h10v8"/><path d="M7 2h7v4H7z"/></svg>
                    Simpan Semua Pengaturan
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
            if (data.wa_target_max_hps) document.getElementById('s-wamaxhps').value = data.wa_target_max_hps;
            
            // Set notif preferences switches
            document.getElementById('s-notif-penjelasan').checked = data.wa_notif_penjelasan !== 'false';
            document.getElementById('s-notif-upload').checked = data.wa_notif_upload !== 'false';
            document.getElementById('s-notif-pemenang').checked = data.wa_notif_pemenang !== 'false';

            // Load saved Fonnte group selection
            this.selectedGroupId = data.wa_target_group_id || '';
            this.selectedGroupName = data.wa_target_group_name || '';
            this.updateGroupUIState();

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
        } catch(e) { /* not configured yet */ }
        
        this.renderSelectedLpse();
        this._setupLpseSearch();
        this._setupDefaultLpseSearch();
        this._setupWAGroupSearch();
        this.loadWALogs();
        
        if (window.lucide) window.lucide.createIcons();
    },

    async fetchGroups(e) {
        if (e) e.preventDefault();
        const apiKey = document.getElementById('s-wakey').value.trim();
        if (!apiKey) {
            Toast.error('Harap masukkan API Key Fonnte terlebih dahulu!');
            return;
        }

        const btn = document.getElementById('s-btn-sync-groups');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Syncing...`;

        try {
            Toast.info('Menghubungkan ke Fonnte untuk mengambil grup WhatsApp...');
            const res = await API.getWAGroups(apiKey);
            if (res.success && Array.isArray(res.data)) {
                this.groupsList = res.data;
                Toast.success(`Daftar grup berhasil disinkronkan! Ditemukan ${this.groupsList.length} grup.`);
                this._showWAGroupsDropdown('');
            } else {
                Toast.error('Gagal mensinkronisasi grup WA dari Fonnte. Periksa API Key Anda.');
            }
        } catch (err) {
            Toast.error(err.message || 'Terjadi kesalahan saat memproses grup.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    },

    updateGroupUIState() {
        const input = document.getElementById('s-wagroup-search');
        const clearBtn = document.getElementById('s-btn-clear-group');
        const infoText = document.getElementById('s-wagroup-info-text');

        if (!input) return;

        if (this.selectedGroupId && this.selectedGroupName) {
            input.value = this.selectedGroupName;
            clearBtn.classList.remove('hidden');
            infoText.innerHTML = `🟢 Grup aktif: <strong>${this.selectedGroupName}</strong> <span style="font-family:monospace; font-size:0.75rem;">(${this.selectedGroupId})</span>`;
        } else {
            input.value = '';
            clearBtn.classList.add('hidden');
            infoText.innerHTML = `Tidak ada grup WA yang dipilih (akan dikirim ke nomor HP pribadi).`;
        }
    },

    clearGroupSelection(e) {
        if (e) e.preventDefault();
        this.selectedGroupId = '';
        this.selectedGroupName = '';
        this.updateGroupUIState();
        Toast.info('Pilihan grup dihapus. Notifikasi dialihkan ke Nomor Tujuan Pribadi.');
    },

    _showWAGroupsDropdown(q) {
        const dropdown = document.getElementById('s-wagroup-dropdown');
        if (!dropdown) return;

        if (!this.groupsList || this.groupsList.length === 0) {
            dropdown.innerHTML = `<div style="padding:14px; font-size:0.8rem; color:var(--text-muted); text-align:center; font-style:italic;">Silakan klik tombol "Sinkron Grup" terlebih dahulu untuk memuat data.</div>`;
            dropdown.classList.remove('hidden');
            return;
        }

        const matches = this.groupsList.filter(g => g.name.toLowerCase().includes(q.toLowerCase()));
        if (matches.length === 0) {
            dropdown.innerHTML = `<div style="padding:14px; font-size:0.8rem; color:var(--text-muted); text-align:center;">Grup "${q}" tidak ditemukan</div>`;
            dropdown.classList.remove('hidden');
            return;
        }

        dropdown.innerHTML = matches.map(g => `
            <div class="tb-dd-item" data-id="${g.id}" data-name="${g.name.replace(/"/g,'&quot;')}" style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; display:flex; flex-direction:column; gap:2px; cursor:pointer;">
                <span style="font-weight:600; font-size:0.88rem; color:var(--text-main);">${g.name}</span>
                <span style="font-size:0.72rem; color:var(--text-muted); font-family:monospace;">${g.id}</span>
            </div>
        `).join('');
        
        dropdown.classList.remove('hidden');
    },

    _setupWAGroupSearch() {
        const input = document.getElementById('s-wagroup-search');
        const dropdown = document.getElementById('s-wagroup-dropdown');
        if (!input || !dropdown) return;

        dropdown.addEventListener('mousedown', (e) => {
            const item = e.target.closest('.tb-dd-item');
            if (item) {
                e.preventDefault();
                this.selectedGroupId = item.dataset.id;
                this.selectedGroupName = item.dataset.name;
                
                this.updateGroupUIState();
                dropdown.classList.add('hidden');
                Toast.success(`Grup "${item.dataset.name}" terpilih!`);
            }
        });

        input.addEventListener('input', (e) => {
            this._showWAGroupsDropdown(e.target.value.trim());
        });

        input.addEventListener('focus', () => {
            this._showWAGroupsDropdown(input.value.trim());
        });

        input.addEventListener('blur', () => {
            setTimeout(() => dropdown.classList.add('hidden'), 200);
        });
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
                wa_target_max_hps: document.getElementById('s-wamaxhps').value.trim(),
                crawl_lpse_targets: JSON.stringify(this.selectedLpse),
                default_lpse: document.getElementById('s-default-lpse-val').value ? JSON.stringify({
                    kd_lpse: document.getElementById('s-default-lpse-val').value,
                    nama_lpse: document.getElementById('s-default-lpse-search').value
                }) : null,
                wa_notif_penjelasan: document.getElementById('s-notif-penjelasan').checked ? 'true' : 'false',
                wa_notif_upload: document.getElementById('s-notif-upload').checked ? 'true' : 'false',
                wa_notif_pemenang: document.getElementById('s-notif-pemenang').checked ? 'true' : 'false',
                wa_target_group_id: this.selectedGroupId,
                wa_target_group_name: this.selectedGroupName
            });
            Toast.success('Pengaturan berhasil disimpan');
        } catch(e) { Toast.error(e.message); }
    },

    async testWA(e) {        if (e) e.preventDefault();
        const apiKey = document.getElementById('s-wakey').value.trim();
        
        // Prioritaskan ID Grup yang dipilih jika ada, jika tidak gunakan nomor pribadi
        const target = this.selectedGroupId || document.getElementById('s-wanum').value.trim();
        
        if (!apiKey || !target) {
            Toast.error('API Key Fonnte dan Target (Nomor Pribadi atau Grup WA) harus diisi untuk uji coba!');
            return;
        }

        try {
            Toast.info('Sedang mengirim pesan uji coba...');
            const res = await API.testWA({ wa_api_key: apiKey, wa_target_numbers: target });
            if (res.success) {
                Toast.success('Pesan uji coba berhasil terkirim! Periksa WhatsApp/Grup Anda.');
                // Reload logs after testing
                setTimeout(() => this.loadWALogs(), 1500);
            } else {
                Toast.error(res.error || 'Gagal mengirim pesan uji coba.');
            }
        } catch (err) {
            Toast.error(err.message || 'Gagal mengirim pesan uji coba.');
        }
    },

    async resendWALog(id) {
        const btn = document.querySelector(`button[onclick*="${id}"]`);
        const original = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>'; }
        try {
            Toast.info('Mengirim ulang pesan...');
            await API.resendWALog(id);
            Toast.success('Pesan berhasil dikirim ulang! Periksa WhatsApp/Grup Anda.');
        } catch (err) {
            Toast.error(err.message || 'Gagal mengirim ulang pesan.');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = original; }
            setTimeout(() => this.loadWALogs(), 1500);
        }
    },

    async loadWALogs(e) {
        if (e) e.preventDefault();
        this.waLogsPage = this.waLogsPage || 1;
        const tbody = document.getElementById('s-walogs-table-body');
        if (!tbody) return;

        try {
            tbody.innerHTML = `<tr><td colspan="4" style="padding:20px; text-align:center; color:var(--text-muted);"><svg class="spin" style="margin-right:8px;" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Memuat data...</td></tr>`;
            const res = await API.getWALogs(this.waLogsPage, 20);
            if (res.success && Array.isArray(res.data)) {
                const pag = res.pagination || { total: 0, limit: 20, page: 1, pages: 1 };
                this.waLogsTotalPages = pag.pages;
                
                // Update pagination indicators and buttons
                const pageInfoEl = document.getElementById('s-walogs-page-info');
                const btnPrevEl = document.getElementById('s-walogs-btn-prev');
                const btnNextEl = document.getElementById('s-walogs-btn-next');
                
                if (pageInfoEl) pageInfoEl.innerText = `Halaman ${pag.page} dari ${pag.pages} (Total: ${pag.total})`;
                if (btnPrevEl) btnPrevEl.disabled = pag.page <= 1;
                if (btnNextEl) btnNextEl.disabled = pag.page >= pag.pages;

                if (res.data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" style="padding:20px; text-align:center; color:var(--text-muted); font-style:italic;">Belum ada riwayat pengiriman.</td></tr>`;
                    return;
                }
                
                tbody.innerHTML = res.data.map(log => {
                    const date = new Date(log.created_at).toLocaleString('id-ID', { hour12: false });
                    const isSuccess = log.status === 'success';
                    const badge = isSuccess 
                        ? `<span style="background:rgba(16,185,129,0.1); color:#10b981; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">Sukses</span>`
                        : `<span style="background:rgba(239,68,68,0.1); color:#ef4444; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;" title="${(log.error_message || '').replace(/"/g, '&quot;')}">Gagal</span>`;
                    
                    const msgPreview = log.message.length > 60 ? log.message.substring(0, 60) + '...' : log.message;
                    const logId = log.id || Math.random().toString(36).substr(2, 9);
                    
                    return `
                        <tr style="border-bottom:1px solid #f1f5f9; cursor:pointer;" onclick="SettingsPage.toggleLogDetail('${logId}')">
                            <td style="padding:10px 14px; white-space:nowrap; color:var(--text-muted);">${date}</td>
                            <td style="padding:10px 14px; font-family:monospace; font-size:0.8rem;">${log.target}</td>
                            <td style="padding:10px 14px; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${msgPreview}</td>
                            <td style="padding:10px 14px; display:flex; align-items:center; gap:8px;">
                                ${badge}
                                ${!isSuccess ? `<button title="Kirim ulang pesan" style="padding:4px; font-size:0.75rem; border-radius:6px; height:26px; width:26px; display:flex; align-items:center; justify-content:center; border:1px solid var(--border,#e2e8f0); background:#fff; color:var(--accent,#3b82f6); cursor:pointer; flex-shrink:0;" onclick="event.stopPropagation(); SettingsPage.resendWALog('${log.id}')">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                                </button>` : ''}
                                <svg id="icon-${logId}" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;"><path d="m6 9 6 6 6-6"/></svg>
                            </td>
                        </tr>
                        <tr id="detail-${logId}" style="display:none; background:#f8fafc; border-bottom:1px solid #f1f5f9;">
                            <td colspan="4" style="padding:16px 20px;">
                                <div style="font-size:0.85rem; color:var(--text-main); white-space:pre-wrap; font-family:inherit; line-height:1.6;">${SettingsPage.formatWAMarkdown(log.message)}</div>
                                ${!isSuccess && log.error_message ? `<div style="margin-top:8px; padding:8px; background:rgba(239,68,68,0.1); color:#ef4444; border-radius:6px; font-size:0.8rem;"><strong>Error:</strong> ${log.error_message}</div>` : ''}
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="4" style="padding:20px; text-align:center; color:#ef4444;">Gagal memuat riwayat pengiriman.</td></tr>`;
            }
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" style="padding:20px; text-align:center; color:#ef4444;">Error: ${err.message}</td></tr>`;
        }
    },

    async changeWALogsPage(offset) {
        this.waLogsPage = (this.waLogsPage || 1) + offset;
        if (this.waLogsPage < 1) this.waLogsPage = 1;
        if (this.waLogsTotalPages && this.waLogsPage > this.waLogsTotalPages) {
            this.waLogsPage = this.waLogsTotalPages;
        }
        await this.loadWALogs();
    },

    formatWAMarkdown(text) {
        if (!text) return '';
        let escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // WhatsApp Markdown styling:
        // Bold: *text*
        escaped = escaped.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
        // Italic: _text_
        escaped = escaped.replace(/_(.*?)_/g, '<em>$1</em>');
        // Strikethrough: ~text~
        escaped = escaped.replace(/~(.*?)~/g, '<del>$1</del>');
        // Monospace block: ```text```
        escaped = escaped.replace(/```([\s\S]*?)```/g, '<code style="background:rgba(241,245,249,0.9); padding:10px; border-radius:6px; font-family:monospace; display:block; white-space:pre; margin: 8px 0; border: 1px solid var(--border,#e2e8f0); font-size:0.8rem;">$1</code>');
        // Monospace inline: `text`
        escaped = escaped.replace(/`([^`\n]+)`/g, '<code style="background:rgba(241,245,249,0.9); padding:2px 6px; border-radius:4px; font-family:monospace; border: 1px solid var(--border,#e2e8f0); font-size:0.8rem;">$1</code>');
        
        return escaped;
    },

    toggleLogDetail(id) {
        const detailRow = document.getElementById(`detail-${id}`);
        const icon = document.getElementById(`icon-${id}`);
        if (!detailRow) return;
        if (detailRow.style.display === 'none') {
            detailRow.style.display = 'table-row';
            if (icon) icon.style.transform = 'rotate(180deg)';
        } else {
            detailRow.style.display = 'none';
            if (icon) icon.style.transform = 'rotate(0deg)';
        }
    }
};
