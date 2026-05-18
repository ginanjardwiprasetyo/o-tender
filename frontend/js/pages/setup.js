/**
 * TenderBuild — Setup / Migration Page
 * Ditampilkan otomatis jika database belum disetup
 */
const SetupPage = {
    projectRef: '',
    migrationUrl: '',

    async show(projectRef, migrationUrl) {
        this.projectRef = projectRef;
        this.migrationUrl = migrationUrl;

        // Ambil SQL dari server
        let sql = '';
        try {
            const res = await fetch('/migrations/001_init.sql');
            sql = await res.text();
        } catch {
            sql = '-- Gagal memuat SQL. Buka file: backend/migrations/001_init.sql';
        }

        const container = document.getElementById('page-container');
        container.innerHTML = `
        <div style="max-width:760px; margin:0 auto; padding:24px 0;">
            <div style="text-align:center; margin-bottom:32px;">
                <div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#f59e0b,#ef4444);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                    <i data-lucide="database-zap" style="width:32px;height:32px;color:white;"></i>
                </div>
                <h2 style="font-size:1.6rem;font-weight:800;margin-bottom:8px;">Setup Database</h2>
                <p style="color:var(--text-secondary);">Tabel database belum dibuat. Ikuti langkah berikut untuk mengaktifkan TenderBuild.</p>
            </div>

            <div class="card" style="margin-bottom:20px;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                    <div style="width:32px;height:32px;border-radius:50%;background:var(--gradient-1);display:flex;align-items:center;justify-content:center;font-weight:700;color:white;flex-shrink:0;">1</div>
                    <div>
                        <div style="font-weight:600;">Buka Supabase SQL Editor</div>
                        <div style="font-size:0.82rem;color:var(--text-muted);">Login ke dashboard Supabase dan buka SQL Editor untuk project ini</div>
                    </div>
                    <a href="${migrationUrl}" target="_blank" class="btn btn-primary btn-sm" style="margin-left:auto;flex-shrink:0;">
                        <i data-lucide="external-link"></i> Buka SQL Editor
                    </a>
                </div>

                <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                    <div style="width:32px;height:32px;border-radius:50%;background:var(--gradient-1);display:flex;align-items:center;justify-content:center;font-weight:700;color:white;flex-shrink:0;">2</div>
                    <div>
                        <div style="font-weight:600;">Copy SQL Migration</div>
                        <div style="font-size:0.82rem;color:var(--text-muted);">Copy SQL di bawah ini, paste di SQL Editor, lalu klik Run</div>
                    </div>
                    <button class="btn btn-secondary btn-sm" style="margin-left:auto;flex-shrink:0;" onclick="SetupPage.copySql()">
                        <i data-lucide="copy"></i> Copy SQL
                    </button>
                </div>

                <div style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:16px;position:relative;max-height:300px;overflow-y:auto;">
                    <pre id="sql-preview" style="font-size:0.72rem;color:var(--text-secondary);white-space:pre-wrap;word-break:break-all;margin:0;font-family:monospace;">${this.escapeHtml(sql)}</pre>
                </div>

                <div style="display:flex;align-items:center;gap:12px;margin-top:20px;">
                    <div style="width:32px;height:32px;border-radius:50%;background:var(--gradient-1);display:flex;align-items:center;justify-content:center;font-weight:700;color:white;flex-shrink:0;">3</div>
                    <div>
                        <div style="font-weight:600;">Kembali ke sini dan klik Cek Ulang</div>
                        <div style="font-size:0.82rem;color:var(--text-muted);">Setelah SQL berhasil dijalankan, klik tombol di bawah</div>
                    </div>
                    <button class="btn btn-success btn-sm" style="margin-left:auto;flex-shrink:0;" onclick="SetupPage.recheck()">
                        <i data-lucide="refresh-cw"></i> Cek Ulang
                    </button>
                </div>
            </div>

            <div class="card" style="background:rgba(14,165,233,0.05);border-color:rgba(14,165,233,0.2);">
                <div style="font-size:0.82rem;color:var(--text-secondary);">
                    <strong style="color:var(--accent);">Project Supabase:</strong> ${projectRef}<br>
                    <strong style="color:var(--accent);">SQL Editor:</strong> 
                    <a href="${migrationUrl}" target="_blank" style="color:var(--accent);">${migrationUrl}</a>
                </div>
            </div>
        </div>`;

        lucide.createIcons({ nodes: [container] });
        this._sql = sql;
    },

    escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    async copySql() {
        try {
            await navigator.clipboard.writeText(this._sql);
            Toast.success('SQL berhasil di-copy! Paste di SQL Editor Supabase lalu klik Run.');
        } catch {
            Toast.error('Gagal copy otomatis. Silakan select manual teks SQL di atas.');
        }
    },

    async recheck() {
        const btn = document.querySelector('[onclick="SetupPage.recheck()"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2"></i> Mengecek...'; lucide.createIcons({ nodes: [btn] }); }
        
        try {
            const res = await fetch('/api/db-status');
            const json = await res.json();
            if (json.ok) {
                Toast.success('Database berhasil disetup! Memuat ulang...');
                setTimeout(() => location.reload(), 1500);
            } else {
                Toast.error('Tabel masih belum ditemukan. Pastikan SQL sudah dijalankan di Supabase.');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="refresh-cw"></i> Cek Ulang'; lucide.createIcons({ nodes: [btn] }); }
            }
        } catch {
            Toast.error('Gagal menghubungi server.');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="refresh-cw"></i> Cek Ulang'; lucide.createIcons({ nodes: [btn] }); }
        }
    }
};
