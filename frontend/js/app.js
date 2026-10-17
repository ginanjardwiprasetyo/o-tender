/**
 * TenderBuild — SPA Router & App Init
 */
const App = {
    pages: {
        'dashboard':      { page: DashboardPage,    title: 'Dashboard' },
        'tender-browse':  { page: TenderBrowsePage, title: 'Cari Tender LKPP' },
        'sirup-browse':   { page: SirupBrowsePage,  title: 'Cari RUP (SIRUP)' },
        'tender-manage':  { page: TenderManagePage, title: 'Tender Saya' },
        'tender-recap':   { page: TenderRecapPage,  title: 'Rekap Tender' },
        'tender-detail':  { page: TenderDetailPage, title: 'Detail Tender' },
        'equipment':      { page: EquipmentPage,    title: 'Data Peralatan' },
        'personnel':      { page: PersonnelPage,    title: 'Data Personil' },
        'experience':     { page: ExperiencePage,   title: 'Pengalaman Personil' },
        'company':        { page: CompanyPage,      title: 'Perusahaan' },
        'company-detail': { page: CompanyDetailPage,title: 'Detail Perusahaan' },
        'documents':      { page: DocumentsPage,    title: 'Surat' },
        'templates':      { page: TemplatesPage,    title: 'Template' },
        // ONLYOFFICE_DULU_DIMATIKAN — edit template via CKEditor. Aktifkan lagi: uncomment baris ini + script onlyoffice.js & nav di index.html
        // 'onlyoffice':     { page: OnlyOfficePage,   title: 'Word Online' },
        'dokpil':         { page: DokpilPage,       title: 'Dokumen Pemilihan (Dokpil)' },
        'settings':       { page: SettingsPage,     title: 'Pengaturan' },
    },

    currentPage: null,
    _authed: false,
    role: 'admin',

    canWrite() { return this.role !== 'viewer'; },

    // ponytail: viewer = lihat saja — sembunyikan semua pemicu tulis (tombol + upload).
    // Dijalankan tiap render + via observer (tabel/modal yang re-render belakangan ikut ke-hide).
    applyRole() {
        const viewer = !this.canWrite();
        document.body.classList.toggle('role-viewer', viewer);
        if (!viewer) return;
        const needle = ['openform(', 'remove(', 'save', 'deledu(', 'delexp(', 'delska(',
            'addeduform(', 'addexpform(', 'addskaform(', 'addattachment', 'removeattachment',
            'deletefilefield', 'deleteimagefield', 'cropkop(', '_cropapply', 'syncfolder(',
            'syncgdoc', 'openeditor(', 'removerecord(', 'removebatch(', 'wzgenerate(', '_wzeqmanual(',
            '_wzequpload(', '_wzeqdelfile(', '_wzeqpickshared(', '_wzequseshared(',
            'addexperiencestart(', 'gotoaddform(', 'startmanualcrawl(', 'stopcrawl(',
            'startcrawl(', 'markasread(', 'markallasread', 'markasunread', 'kirimpdf(',
            'removeexcludeword(', 'removeprovince(', 'createsuratfromdokpil(',
            'followtender', 'btn-follow-tender', 'dokpil-file-input'];
        document.querySelectorAll('#page-container button, #modal-overlay button, #page-container input[type="file"], #modal-overlay input[type="file"]').forEach(el => {
            if (el.type === 'file') { el.style.display = 'none'; return; }
            const sig = ((el.getAttribute('onclick') || '') + '#' + (el.id || '')).toLowerCase();
            if (needle.some(s => sig.includes(s))) el.style.display = 'none';
        });
    },

    _observeRole() {
        if (this._roleObs) return;
        this._roleObs = true;
        const mo = new MutationObserver(() => {
            clearTimeout(this._roleT);
            this._roleT = setTimeout(() => this.applyRole(), 16);
        });
        mo.observe(document.getElementById('page-container'), { childList: true, subtree: true });
        mo.observe(document.getElementById('modal-overlay'), { childList: true, subtree: true });
    },

    async init() {
        Toast.init();
        Modal.init();
        this.loadLoginStats();

        // Sidebar toggle — status hide/expand disimpan (bertahan setelah reload)
        const applySidebar = (collapsed) => {
            document.getElementById('sidebar').classList.toggle('collapsed', collapsed);
            document.querySelector('.main-content').classList.toggle('expanded', collapsed);
        };
        if (window.innerWidth > 768 && localStorage.getItem('tenderbuild-sidebar') === 'collapsed') applySidebar(true);
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.toggle('open');
            } else {
                const collapsed = !document.getElementById('sidebar').classList.contains('collapsed');
                applySidebar(collapsed);
                localStorage.setItem('tenderbuild-sidebar', collapsed ? 'collapsed' : 'expanded');
            }
        });

        // Sidebar tooltip for collapsed state
        this.setupSidebarTooltip();

        // Clock
        this.updateClock();
        setInterval(() => this.updateClock(), 30000);

        // Theme — default dark, apply light-theme only if user saved it
        let savedTheme = localStorage.getItem('tenderbuild-theme');
        if (!savedTheme) {
          savedTheme = 'dark';
          localStorage.setItem('tenderbuild-theme', 'dark');
        }
        if (savedTheme === 'light') {
          document.body.classList.add('light-theme');
        }
        this.updateThemeIcon();
        document.getElementById('theme-toggle').addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('tenderbuild-theme', isLight ? 'light' : 'dark');
            this.updateThemeIcon();
        });

        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

        document.getElementById('login-pass')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitLogin();
        });
        document.getElementById('login-user')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.submitLogin();
        });

        // Auth gate — login mulai tersembunyi; hanya tampil bila session invalid
        try {
            const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
            if (res.ok) {
                const json = await res.json();
                this.role = json.data?.role || 'admin';
                this.enterApp();
            } else {
                this.showLogin();
            }
        } catch {
            this.showLogin();
        }

        lucide.createIcons();
    },

    showLogin() {
        this._authed = false;
        document.body.classList.remove('is-authed');
        const el = document.getElementById('login-screen');
        if (el) el.classList.remove('hidden');
        const err = document.getElementById('login-error');
        if (err) err.classList.add('hidden');
        setTimeout(() => document.getElementById('login-user')?.focus(), 50);
    },

    hideLogin() {
        const el = document.getElementById('login-screen');
        if (el) el.classList.add('hidden');
    },

    async submitLogin() {
        const user = document.getElementById('login-user')?.value || '';
        const pass = document.getElementById('login-pass')?.value || '';
        const errEl = document.getElementById('login-error');
        const btn = document.getElementById('login-btn');
        const btnText = document.getElementById('login-btn-text');
        if (errEl) errEl.classList.add('hidden');
        if (!user || !pass) {
            if (errEl) { errEl.textContent = 'Isi username dan password'; errEl.classList.remove('hidden'); }
            return;
        }
        if (btn) btn.disabled = true;
        if (btnText) btnText.textContent = 'Memeriksa...';
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || 'Login gagal');
            this.role = json.data?.role || 'admin';
            const passInput = document.getElementById('login-pass');
            if (passInput) passInput.value = '';
            this.enterApp();
        } catch (e) {
            if (errEl) { errEl.textContent = e.message || 'Login gagal'; errEl.classList.remove('hidden'); }
        } finally {
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = 'Masuk ke oTender';
        }
    },

    enterApp() {
        this._authed = true;
        // role-viewer dipasang SEBELUM konten halaman dirender → CSS sembunyikan tombol tulis dari paint pertama (tanpa flash)
        this.applyRole();
        document.body.classList.add('is-authed');
        this.hideLogin();
        this._observeRole();

        // Hash router (sekali)
        if (!this._routerBound) {
            this._routerBound = true;
            window.addEventListener('hashchange', () => this.navigate());
        }
        this.navigate();
        this.checkDbStatus();
    },

    // ponytail: angka hero login dari DB (publik); gagal → biarkan "…"
    async loadLoginStats() {
        try {
            const res = await fetch('/api/public-stats');
            const json = await res.json();
            const d = json.data || {};
            const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            set('pc-stat-crawl', Number(d.tercrawling || 0).toLocaleString('id-ID') + '+');
            set('pc-stat-follow', (d.diikuti || 0) + '+');
            const n = Number(d.nilai_kontrak || 0);
            const rp = n >= 1e12 ? 'Rp ' + (n / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' T'
                : n >= 1e9 ? 'Rp ' + (n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' M'
                : n >= 1e6 ? 'Rp ' + Math.round(n / 1e6) + ' jt' : 'Rp ' + n.toLocaleString('id-ID');
            set('pc-stat-nilai', rp);
            set('pc-stat-sbu', d.jml_sbu || 0);
        } catch { /* abaikan — login tetap jalan */ }
    },

    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } catch { /* tetap keluar lokal */ }
        this._authed = false;
        this.role = 'admin';
        document.body.classList.remove('is-authed');
        document.body.classList.remove('role-viewer');
        location.hash = '';
        this.showLogin();
        Toast.info('Anda telah logout', { duration: 2500 });
    },

    async checkDbStatus() {
        try {
            const res = await fetch('/api/db-status');
            const json = await res.json();
            if (!json.ok && json.needs_migration) {
                SetupPage.show(json.project_ref, json.migration_url);
            }
        } catch (err) {
            console.warn('DB check failed:', err.message);
            // Non-blocking warning
            if (window.location.hash === '#dashboard') {
                Toast.warning('Koneksi ke server bermasalah. Pastikan backend berjalan.', { duration: 5000 });
            }
        }
    },

    updateClock() {
        const el = document.getElementById('topbar-clock');
        if (!el) return;
        const now = new Date();
        el.textContent = now.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
        }) + '  ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    },

    updateThemeIcon() {
        const btn = document.getElementById('theme-toggle');
        const isLight = document.body.classList.contains('light-theme');
        btn.innerHTML = isLight ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
        lucide.createIcons({ nodes: [btn] });
    },

    setupSidebarTooltip() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        // Create tooltip element once
        const tip = document.createElement('div');
        tip.className = 'sidebar-tooltip';
        tip.innerHTML = '<div class="sidebar-tooltip-inner"></div>';
        tip.style.display = 'none';
        document.body.appendChild(tip);

        const inner = tip.querySelector('.sidebar-tooltip-inner');
        let hideTimer = null;

        const show = (item) => {
            if (!sidebar.classList.contains('collapsed')) return;
            const label = item.querySelector('span:not(.nav-badge)');
            if (!label) return;
            const text = label.textContent.trim();
            if (!text) return;

            clearTimeout(hideTimer);
            inner.textContent = text;
            const rect = item.getBoundingClientRect();
            tip.style.display = 'flex';
            tip.style.top = (rect.top + rect.height / 2) + 'px';
            tip.style.transform = 'translateY(-50%)';
        };

        const hide = () => {
            hideTimer = setTimeout(() => { tip.style.display = 'none'; }, 80);
        };

        sidebar.addEventListener('mouseover', (e) => {
            const item = e.target.closest('.nav-item');
            if (item) show(item);
        });
        sidebar.addEventListener('mouseout', (e) => {
            const item = e.target.closest('.nav-item');
            if (item) hide();
        });
    },

    async navigate() {
        if (!this._authed) return;
        const hash = location.hash.slice(1) || 'dashboard';
        const [pageKeyWithQuery] = hash.split('?');
        const pageKey = pageKeyWithQuery.split('/')[0];
        const entry = this.pages[pageKey];

        if (!entry) {
            location.hash = '#dashboard';
            return;
        }

        // ponytail: viewer dilarang masuk Pengaturan & Template (nav juga di-hide via CSS)
        if (!this.canWrite() && (pageKey === 'settings' || pageKey === 'templates')) {
            Toast.info('Halaman khusus admin', { duration: 2500 });
            location.hash = '#dashboard';
            return;
        }

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageKey);
        });
        document.getElementById('page-title').textContent = entry.title;

        // Close sidebar on mobile
        document.getElementById('sidebar').classList.remove('open');

        const container = document.getElementById('page-container');

        // Stub pages (belum diimplementasi)
        if (!entry.page) {
            container.innerHTML = `
                <div class="empty-state" style="height:60vh;">
                    <i data-lucide="construction"></i>
                    <p style="font-size:1.1rem;font-weight:600;margin-bottom:4px;">${entry.title}</p>
                    <p>Fitur ini akan tersedia pada fase pengembangan selanjutnya.</p>
                </div>`;
            lucide.createIcons({ nodes: [container] });
            this.applyRole();
            return;
        }

        container.innerHTML = '<div class="page-loading"><div class="spinner"></div><p>Memuat...</p></div>';

        try {
            const query = hash.includes('?') ? hash.split('?')[1] : '';
            const params = hash.split('/').slice(1);
            const html = await entry.page.render(query, ...params);
            container.innerHTML = html;
            lucide.createIcons({ nodes: [container] });
            if (entry.page.afterRender) await entry.page.afterRender();
            this.applyRole();
        } catch (e) {
            console.error('Page render error:', e);
            container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="alert-circle" style="color:var(--danger);"></i>
                    <p style="color:var(--danger);margin-top:12px;">Error: ${e.message}</p>
                    <button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="App.navigate()">
                        <i data-lucide="refresh-cw"></i> Coba Lagi
                    </button>
                </div>`;
            lucide.createIcons({ nodes: [container] });
        }

        this.currentPage = pageKey;
    }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
