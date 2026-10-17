/**
 * TenderBuild — Dashboard Page
 */
const DashboardPage = {
    async render() {
        return `
        <div class="page-header">
            <div>
                <h2>Dashboard</h2>
                <p>Kalender jadwal & deadline upload tender</p>
            </div>
        </div>

        <div class="dash-grid">
            <div class="card" style="min-width:0;">
                <div class="card-header-flex" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div class="card-title" style="margin-bottom:0;">Kalender Jadwal</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);"><i data-lucide="info" style="width:14px; height:14px; vertical-align:middle;"></i> Sinkronisasi otomatis dari Tender Saya</div>
                </div>
                <div id="upcoming-list" class="upcoming-grid-layout"></div>
            </div>
            <div class="card agenda-card" style="min-width:0;">
                <div class="card-title" style="margin-bottom:12px;" id="deadline-title">Deadline Upload</div>
                <div id="deadline-list"></div>
            </div>
        </div>
        `;
    },

    async afterRender() {
        this.loadStats();
        this.loadUpcoming();

        // Background check for win/lose status & fetch missing schedules (admin saja)
        if (App.canWrite()) API.syncFollowedStatus().then(() => {
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

    calY: null, calM: null, calEvents: [], calSelected: null,

    async loadUpcoming() {
        const el = document.getElementById('upcoming-list');
        if (!el) return;
        try {
            const now = new Date();
            if (this.calY === null) { this.calY = now.getFullYear(); this.calM = now.getMonth(); }
            if (!this.calSelected) this.calSelected = now.toISOString().slice(0, 10);
            const { data } = await API.getFollowedUpcoming(62, 7);
            this.calEvents = (data || []).map(s => ({ ...s, d: new Date(s.end_date) })).filter(s => !isNaN(s.d));
            this.renderCalendar(el);
            this.renderDeadlines();
        } catch {
            el.innerHTML = '<div class="empty-state"><p>Hubungkan Supabase untuk melihat data</p></div>';
        }
    },

    _dayKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },

    _isUpload(s) { return /upload|pemasukan/i.test(s.stage_name || ''); },

    renderDeadlines() {
        const el = document.getElementById('deadline-list');
        if (!el) return;
        const title = document.getElementById('deadline-title');
        const k = this.calSelected;
        const d = new Date(k + 'T00:00:00');
        if (title) title.textContent = 'Agenda — ' + d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
        const items = (this.calEvents || []).filter(s => this._dayKey(s.d) === k).sort((a, b) => a.d - b.d);
        if (!items.length) {
            el.innerHTML = '<div class="empty-state" style="padding:20px;"><i data-lucide="calendar-check"></i><p>Tidak ada agenda tanggal ini</p></div>';
            lucide.createIcons({ nodes: [el] }); return;
        }
        el.innerHTML = items.map(s => {
            const up = this._isUpload(s);
            const hh = `${String(s.d.getHours()).padStart(2, '0')}:${String(s.d.getMinutes()).padStart(2, '0')}`;
            return `<div class="dl-group" style="cursor:pointer;" onclick="DashboardPage._dlPop(this)" data-tip="${Fmt.escape(s.tenders?.nama_paket || '')}">
                <div class="dl-head"><strong>${Fmt.escape(s.stage_name)}</strong>${up ? '<span class="badge badge-danger">upload</span>' : ''}${s.passed ? '<span class="badge badge-gray">lewat</span>' : ''}</div>
                <div class="dl-item"><span class="dl-time"${up ? '' : ' style="color:var(--accent);"'}>${hh}</span>
                <span class="dl-name">${Fmt.escape(s.tenders?.nama_paket || '')}</span></div>
            </div>`;
        }).join('');
        lucide.createIcons({ nodes: [el] });
    },

    // ponytail: klik item agenda → popup kecil nama paket; klik di luar menutup (binding langsung, tanpa delegasi)
    _dlPop(item) {
        const txt = item?.dataset?.tip;
        if (!txt) return;
        let pop = document.getElementById('dl-tip');
        if (!pop) { pop = document.createElement('div'); pop.id = 'dl-tip'; document.body.appendChild(pop); }
        pop.textContent = txt;
        pop.style.display = 'block';
        const r = item.getBoundingClientRect();
        pop.style.left = Math.min(window.innerWidth - pop.offsetWidth - 12, r.left + 20) + 'px';
        pop.style.top = Math.min(window.innerHeight - pop.offsetHeight - 12, r.bottom + 6) + 'px';
        clearTimeout(this._dlPopT);
        this._dlPopT = setTimeout(() => {
            const off = (ev) => {
                if (!pop.contains(ev.target)) { pop.style.display = 'none'; document.removeEventListener('pointerdown', off); }
            };
            document.addEventListener('pointerdown', off);
        }, 0);
    },

    renderCalendar(el) {
        const Y = this.calY, M = this.calM;
        const todayK = this._dayKey(new Date());
        const byDay = {};
        this.calEvents.forEach(s => {
            const k = this._dayKey(s.d);
            (byDay[k] = byDay[k] || []).push(s);
        });
        Object.values(byDay).forEach(arr => arr.sort((a, b) => a.d - b.d));
        // Senin = 0 (id-ID)
        const first = new Date(Y, M, 1);
        const startOff = (first.getDay() + 6) % 7;
        const dim = new Date(Y, M + 1, 0).getDate();
        const prevDim = new Date(Y, M, 0).getDate();
        const monthName = first.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
        let cells = '';
        for (let i = 0; i < 42; i++) {
            const dayNum = i - startOff + 1;
            let d, other = false;
            if (dayNum < 1) { d = new Date(Y, M - 1, prevDim + dayNum); other = true; }
            else if (dayNum > dim) { d = new Date(Y, M + 1, dayNum - dim); other = true; }
            else d = new Date(Y, M, dayNum);
            const k = this._dayKey(d);
            const evs = byDay[k] || [];
            const nowMs = Date.now();
            const chips = evs.slice(0, 2).map(s => {
                const left = s.d - nowMs;
                const up = this._isUpload(s);
                const cls = up ? 'ev-upload' : left < 24 * 3600e3 ? 'ev-danger' : left < 3 * 86400e3 ? 'ev-warning' : 'ev-accent';
                const hh = `${String(s.d.getHours()).padStart(2, '0')}:${String(s.d.getMinutes()).padStart(2, '0')}`;
                return `<div class="cal-chip ${cls}" title="${Fmt.escape(s.stage_name)} • ${Fmt.escape(s.tenders?.nama_paket || '')}">${up ? '⏰ ' : ''}${hh} ${Fmt.escape(s.stage_name)}</div>`;
            }).join('');
            const count = evs.length > 1 ? `<span class="cal-count" title="${evs.length} jadwal tanggal ini">${evs.length}</span>` : '';
            const hasUp = evs.some(s => this._isUpload(s));
            cells += `<div class="cal-cell${other ? ' other' : ''}${k === todayK ? ' today' : ''}${k === this.calSelected ? ' selected' : ''}${evs.length ? ' has-ev' : ''}${hasUp ? ' has-upload' : ''}" data-day="${k}" onclick="DashboardPage.calSelect('${k}')">
                <span class="cal-num">${d.getDate()}</span>${count}${chips}</div>`;
        }
        el.innerHTML = `
            <div class="cal-head">
                <button class="btn btn-secondary btn-sm" onclick="DashboardPage.calNav(-1)">‹</button>
                <strong style="text-transform:capitalize;">${monthName}</strong>
                <button class="btn btn-secondary btn-sm" onclick="DashboardPage.calNav(1)">›</button>
                <button class="btn btn-secondary btn-sm" onclick="DashboardPage.calToday()">Hari ini</button>
                <span style="font-size:0.75rem; color:var(--text-muted); margin-left:auto;">${this.calEvents.length} jadwal</span>
            </div>
            <div class="cal-grid cal-week">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(w => `<div>${w}</div>`).join('')}</div>
            <div class="cal-grid">${cells}</div>`;
        lucide.createIcons({ nodes: [el] });
    },

    calNav(d) {
        const dt = new Date(this.calY, this.calM + d, 1);
        this.calY = dt.getFullYear(); this.calM = dt.getMonth();
        const el = document.getElementById('upcoming-list');
        if (el) this.renderCalendar(el);
    },

    calToday() {
        const now = new Date();
        this.calY = now.getFullYear(); this.calM = now.getMonth();
        this.calSelected = this._dayKey(now);
        const el = document.getElementById('upcoming-list');
        if (el) this.renderCalendar(el);
        this.renderDeadlines();
    },

    calSelect(k) {
        this.calSelected = k;
        const el = document.getElementById('upcoming-list');
        if (el) this.renderCalendar(el);
        this.renderDeadlines();
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
