/**
 * TenderBuild — SPA Router & App Init
 */
const App = {
    pages: {
        'dashboard':      { page: DashboardPage,    title: 'Dashboard' },
        'tender-browse':  { page: TenderBrowsePage, title: 'Cari Tender LKPP' },
        'tender-manage':  { page: TenderManagePage, title: 'Tender Saya' },
        'tender-detail':  { page: TenderDetailPage, title: 'Detail Tender' },
        'equipment':      { page: EquipmentPage,    title: 'Data Peralatan' },
        'personnel':      { page: PersonnelPage,    title: 'Data Personil' },
        'experience':     { page: ExperiencePage,   title: 'Pengalaman Personil' },
        'company':        { page: CompanyPage,      title: 'Perusahaan' },
        'company-detail': { page: CompanyDetailPage,title: 'Detail Perusahaan' },
        'documents':      { page: DocumentsPage,    title: 'Surat' },
        'templates':      { page: TemplatesPage,    title: 'Template' },
        'dokpil':         { page: DokpilPage,       title: 'Dokumen Pemilihan (Dokpil)' },
        'settings':       { page: SettingsPage,     title: 'Pengaturan' },
    },

    currentPage: null,

    init() {
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
        // Force light theme on first load regardless of saved preference
        document.body.classList.add('light-theme');
        // Set default in localStorage if not present
        let savedTheme = localStorage.getItem('tenderbuild-theme');
        if (!savedTheme) {
          savedTheme = 'light';
          localStorage.setItem('tenderbuild-theme', 'light');
        }
        // Apply saved theme for future toggles (will be overridden on first load)
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

        // Hash router
        window.addEventListener('hashchange', () => this.navigate());
        this.navigate();

        // Init icons
        lucide.createIcons();

        // Check DB status (non-blocking)
        this.checkDbStatus();
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
        const hash = location.hash.slice(1) || 'dashboard';
        const pageKey = hash.split('/')[0];
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
            const params = hash.split('/').slice(1);
            const html = await entry.page.render(params);
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
