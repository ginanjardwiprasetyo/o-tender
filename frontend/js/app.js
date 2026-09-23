/**
 * TenderBuild — SPA Router & App Init
 */
const App = {
    pages: {
        'dashboard':      { page: DashboardPage,    title: 'Dashboard' },
        'tender-browse':  { page: TenderBrowsePage, title: 'Cari Tender LKPP' },
        'sirup-browse':   { page: SirupBrowsePage,  title: 'Cari RUP (SIRUP)' },
        'tender-manage':  { page: TenderManagePage, title: 'Tender Saya' },
        'tender-detail':  { page: TenderDetailPage, title: 'Detail Tender' },
        'equipment':      { page: EquipmentPage,    title: 'Data Peralatan' },
        'personnel':      { page: PersonnelPage,    title: 'Data Personil' },
        'experience':     { page: ExperiencePage,   title: 'Pengalaman Personil' },
        'company':        { page: CompanyPage,      title: 'Perusahaan' },
        'company-detail': { page: CompanyDetailPage,title: 'Detail Perusahaan' },
        'documents':      { page: DocumentsPage,    title: 'Surat' },
        'templates':      { page: TemplatesPage,    title: 'Template' },
        'onlyoffice':     { page: OnlyOfficePage,   title: 'Word Online' },
        'dokpil':         { page: DokpilPage,       title: 'Dokumen Pemilihan (Dokpil)' },
        'settings':       { page: SettingsPage,     title: 'Pengaturan' },
    },

    currentPage: null,
    _authed: false,

    async init() {
        Toast.init();
        Modal.init();

        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.toggle('open');
            } else {
                document.getElementById('sidebar').classList.toggle('collapsed');
                document.querySelector('.main-content').classList.toggle('expanded');
            }
        });

        // Clock
        this.updateClock();
        setInterval(() => this.updateClock(), 30000);

        // Theme - default to light
        document.body.classList.add('light-theme');
        let savedTheme = localStorage.getItem('tenderbuild-theme');
        if (!savedTheme) {
          savedTheme = 'light';
          localStorage.setItem('tenderbuild-theme', 'light');
        }
        if (savedTheme === 'dark') {
          document.body.classList.remove('light-theme');
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
            const passInput = document.getElementById('login-pass');
            if (passInput) passInput.value = '';
            this.enterApp();
        } catch (e) {
            if (errEl) { errEl.textContent = e.message || 'Login gagal'; errEl.classList.remove('hidden'); }
        } finally {
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = 'Masuk';
        }
    },

    enterApp() {
        this._authed = true;
        document.body.classList.add('is-authed');
        this.hideLogin();

        // Hash router (sekali)
        if (!this._routerBound) {
            this._routerBound = true;
            window.addEventListener('hashchange', () => this.navigate());
        }
        this.navigate();
        this.checkDbStatus();
    },

    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } catch { /* tetap keluar lokal */ }
        this._authed = false;
        document.body.classList.remove('is-authed');
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
