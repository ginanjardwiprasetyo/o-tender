/**
 * TenderBuild — Dashboard Page
 */
const DashboardPage = {
    async render() {
        return `
        <div class="page-header">
            <div>
                <h2>Dashboard</h2>
                <p>Ringkasan informasi tender & jadwal mendatang</p>
            </div>
        </div>

        <div class="stats-grid" id="stats-grid">
            <div class="stat-card">
                <div class="stat-icon blue"><i data-lucide="folder-kanban"></i></div>
                <div class="stat-value" id="stat-total">-</div>
                <div class="stat-label">Total Tender Diikuti</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green"><i data-lucide="trophy"></i></div>
                <div class="stat-value" id="stat-menang">-</div>
                <div class="stat-label">Menang</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red"><i data-lucide="x-circle"></i></div>
                <div class="stat-value" id="stat-kalah">-</div>
                <div class="stat-label">Kalah</div>
            </div>
        </div>

        <div style="margin-top:24px;">
            <div class="card">
                <div class="card-header-flex" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <div class="card-title" style="margin-bottom:0;">Jadwal Mendatang (7 Hari)</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);"><i data-lucide="info" style="width:14px; height:14px; vertical-align:middle;"></i> Sinkronisasi otomatis dari Tender Saya</div>
                </div>
                <div id="upcoming-list" class="upcoming-grid-layout">
                    <div class="page-loading"><div class="spinner"></div></div>
                </div>
            </div>
        </div>
        `;
    },

    async afterRender() {
        this.loadStats();
        this.loadUpcoming();

        // Background check for win/lose status & fetch missing schedules
        API.syncFollowedStatus().then(() => {
            this.loadStats();
            this.loadUpcoming();
        }).catch(e => console.error(e));
    },

    async loadStats() {
        try {
            const { data } = await API.getFollowedStats();
            const elTotal = document.getElementById('stat-total');
            if (elTotal) elTotal.textContent = data.total || 0;
            const elMenang = document.getElementById('stat-menang');
            if (elMenang) elMenang.textContent = data.menang || 0;
            const elKalah = document.getElementById('stat-kalah');
            if (elKalah) elKalah.textContent = data.kalah || 0;
            const badge = document.getElementById('tender-count-badge');
            if (badge) badge.textContent = data.total || '';
        } catch { /* ignore */ }
    },

    async loadUpcoming() {
        const el = document.getElementById('upcoming-list');
        if (!el) return;
        try {
            const { data } = await API.getFollowedUpcoming();
            if (!data || data.length === 0) {
                el.innerHTML = '<div class="empty-state"><i data-lucide="calendar-check"></i><p>Tidak ada jadwal dalam 7 hari ke depan</p></div>';
                lucide.createIcons({ nodes: [el] });
                return;
            }
            el.innerHTML = data.slice(0, 10).map(s => {
                const dateObj = new Date(s.end_date);
                const day = dateObj.getDate();
                const month = dateObj.toLocaleString('id-ID', { month: 'short' }).toUpperCase();
                
                return `
                <div class="schedule-calendar-item">
                    <div class="date-badge">
                        <span class="month">${month}</span>
                        <span class="day">${day}</span>
                    </div>
                    <div class="schedule-info">
                        <div class="stage-tag">${Fmt.escape(s.stage_name)}</div>
                        <div class="tender-name">${Fmt.escape(s.tenders?.nama_paket || '')}</div>
                        <div class="instansi-name"><i data-lucide="building"></i> ${Fmt.escape(s.tenders?.instansi || '')}</div>
                    </div>
                    <div class="time-info">
                        <i data-lucide="clock"></i> ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')} WIB
                    </div>
                </div>
                `;
            }).join('');
            lucide.createIcons({ nodes: [el] });
        } catch {
            el.innerHTML = '<div class="empty-state"><p>Hubungkan Supabase untuk melihat data</p></div>';
        }
    },

    async loadMasterSummary() {
        try {
            const [eq, ps] = await Promise.all([API.getEquipments(), API.getPersonnel()]);
            const elEq = document.getElementById('sum-equip');
            if (elEq) elEq.textContent = eq.data?.length || 0;
            const elPs = document.getElementById('sum-personnel');
            if (elPs) elPs.textContent = ps.data?.length || 0;
        } catch { /* ignore */ }
        try {
            const tpl = await API.getTemplates();
            const elTpl = document.getElementById('sum-templates');
            if (elTpl) elTpl.textContent = tpl.data?.length || 0;
        } catch { /* ignore */ }
    }
};
