/**
 * TenderBuild — Company Detail Page
 */
const CompanyDetailPage = {
    companyId: null,
    companyData: null,

    async render(params) {
        this.companyId = params[0];
        return `
        <div class="page-header">
            <div>
                <a href="#company" style="color:var(--text-muted);text-decoration:none;font-size:0.85rem;display:inline-flex;align-items:center;gap:4px;margin-bottom:8px;">
                    <i data-lucide="arrow-left" style="width:14px;height:14px;"></i> Kembali ke Perusahaan
                </a>
                <h2 id="cd-title">Memuat...</h2>
            </div>
        </div>

        <div id="cd-content">
            <div class="page-loading"><div class="spinner"></div></div>
        </div>
        `;
    },

    async afterRender() {
        this.loadData();
    },

    async loadData() {
        const el = document.getElementById('cd-content');
        try {
            const res = await API.getCompanyById(this.companyId);
            this.companyData = res.data;
            document.getElementById('cd-title').textContent = this.companyData.nama_perusahaan;
            this.renderDetail();
        } catch(e) {
            el.innerHTML = `<div class="empty-state"><i data-lucide="alert-circle" style="color:var(--danger);"></i><p style="color:var(--danger);">${e.message}</p></div>`;
            lucide.createIcons();
        }
    },

    renderDetail() {
        const c = this.companyData;
        const el = document.getElementById('cd-content');

        let attachments = c.attachments || [];
        if (typeof attachments === 'string') {
            try { attachments = JSON.parse(attachments); } catch(e) { attachments = []; }
        }
        if (typeof attachments === 'string') {
            try { attachments = JSON.parse(attachments); } catch(e) { attachments = []; }
        }
        if (!Array.isArray(attachments)) attachments = [];

        el.innerHTML = `
        <div class="card" style="padding:24px; margin-bottom:24px;">
            <div style="display:flex; gap:24px; align-items:flex-start; flex-wrap:wrap;">
                <div style="width:120px; height:120px; border-radius:12px; background:var(--bg-primary); display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid var(--border-color); flex-shrink:0;">
                    ${c.foto_logo_url 
                        ? `<img src="${Fmt.url(c.foto_logo_url)}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                           <i data-lucide="building-2" style="width:48px;height:48px;color:var(--text-muted);display:none;"></i>` 
                        : `<i data-lucide="building-2" style="width:48px;height:48px;color:var(--text-muted);"></i>`}
                </div>
                <div style="flex:1; min-width:300px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                        <div>
                            <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">Singkatan</span>
                            <div style="font-weight:600;font-size:1.1rem;">${c.singkatan || '-'}</div>
                        </div>
                        <div>
                            <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">Direktur</span>
                            <div style="font-weight:600;font-size:1.1rem;">${c.direktur || '-'}</div>
                        </div>
                        <div>
                            <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">NPWP Usaha</span>
                            <div>${c.npwp_usaha || '-'}</div>
                        </div>
                        <div>
                            <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">NPWP Direktur</span>
                            <div>${c.npwp_direktur || '-'}</div>
                        </div>
                        <div>
                            <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">Email</span>
                            <div>${c.email || '-'}</div>
                        </div>
                        <div>
                            <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">Website</span>
                            <div>${c.website ? `<a href="${c.website}" target="_blank">${c.website}</a>` : '-'}</div>
                        </div>
                        <div>
                            <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">No. HP</span>
                            <div>${c.no_hp || '-'}</div>
                        </div>
                        <div>
                            <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">KBLI</span>
                            <div>${c.kbli || '-'}</div>
                        </div>
                        <div style="grid-column:1/-1;">
                            <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;">Alamat Lengkap</span>
                            <div>${c.alamat || '-'}</div>
                            <div style="font-size:0.85rem;color:var(--text-muted);margin-top:2px;">
                                ${c.kota || ''} ${c.provinsi ? `, ${c.provinsi}` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="margin-top:24px; border-top:1px solid var(--border-color); padding-top:20px;">
                <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:8px;">Kop Surat</span>
                <div style="width:100%;min-height:60px;border:1px dashed var(--border-color);border-radius:8px;padding:12px;background:white;display:flex;align-items:center;justify-content:center;">
                    ${c.kop_is_image && c.kop_image_url 
                        ? `<img src="${Fmt.url(c.kop_image_url)}" style="max-width:100%;max-height:120px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                           <span style="font-size:0.75rem;color:var(--text-muted);display:none;">Belum dikonfigurasi</span>` 
                        : (c.kop_nama ? `<div style="text-align:center;"><strong>${c.kop_nama}</strong><br><small>${c.kop_alamat||''}</small></div>` : '<span style="font-size:0.7rem;color:var(--text-muted);">Belum dikonfigurasi</span>')}
                </div>
            </div>
 
            <div style="margin-top:24px; border-top:1px solid var(--border-color); padding-top:20px; display:flex; gap:40px; flex-wrap:wrap;">
                <div>
                    <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:8px;">Tanda Tangan</span>
                    <div style="width:160px;height:100px;border:1px dashed var(--border-color);border-radius:8px;display:flex;align-items:center;justify-content:center;background:white;">
                        ${c.ttd_image_url 
                            ? `<img src="${Fmt.url(c.ttd_image_url)}" style="max-height:80px;max-width:140px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                               <span style="font-size:0.7rem;color:var(--text-muted);display:none;">Belum diupload</span>` 
                            : '<span style="font-size:0.7rem;color:var(--text-muted);">Belum diupload</span>'}
                    </div>
                </div>
                <div>
                    <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:8px;">Cap/Stempel</span>
                    <div style="width:160px;height:100px;border:1px dashed var(--border-color);border-radius:8px;display:flex;align-items:center;justify-content:center;background:white;">
                        ${c.cap_image_url 
                            ? `<img src="${Fmt.url(c.cap_image_url)}" style="max-height:80px;max-width:140px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                               <span style="font-size:0.7rem;color:var(--text-muted);display:none;">Belum diupload</span>` 
                            : '<span style="font-size:0.7rem;color:var(--text-muted);">Belum diupload</span>'}
                    </div>
                </div>
            </div>

            <div style="margin-top:24px; border-top:1px solid var(--border-color); padding-top:20px;">
                <span style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:8px;">Dokumen Lampiran</span>
                ${attachments && attachments.length > 0 ? `
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:12px;">
                    ${attachments.map(att => `
                        <a href="${Fmt.url(att.url)}" target="_blank" style="display:flex; align-items:center; gap:12px; padding:12px; background:white; border:1px solid var(--border-color); border-radius:8px; text-decoration:none; color:inherit; transition:all 0.2s;">
                            <div style="width:36px; height:36px; background:var(--bg-secondary); border-radius:6px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                <i data-lucide="file-text" style="width:18px; height:18px; color:var(--accent);"></i>
                            </div>
                            <div style="overflow:hidden;">
                                <div style="font-weight:600; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Fmt.escape(att.name)}</div>
                                <div style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Fmt.escape(att.filename || 'Dokumen')}</div>
                            </div>
                        </a>
                    `).join('')}
                </div>
                ` : '<div style="font-size:0.85rem; color:var(--text-muted); font-style:italic;">Belum ada dokumen lampiran.</div>'}
            </div>
        </div>
        `;
        lucide.createIcons();
    }
};
