/**
 * TenderBuild — Experience Global Page
 */
const ExperiencePage = {
    personnel: [],
    experiences: [],

    async render() {
        return `
        <div class="page-header">
            <div>
                <h2>Pengalaman Personil</h2>
                <p>Rekapitulasi daftar pengalaman kerja dari seluruh personil</p>
            </div>
            <button class="btn btn-primary" onclick="ExperiencePage.addExperienceStart()">
                <i data-lucide="plus"></i> Tambah Pengalaman
            </button>
        </div>

        <div class="card" style="margin-bottom: 24px; padding: 16px;">
            <div class="search-box" style="max-width: 400px;">
                <i data-lucide="search"></i>
                <input type="text" id="exp-search" placeholder="Cari nama kegiatan, personil, atau lokasi..." oninput="ExperiencePage.filter()">
            </div>
        </div>

        <div id="exp-list"></div>
        `;
    },

    async afterRender() {
        this.loadData();
    },

    async loadData() {
        const el = document.getElementById('exp-list');
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        try {
            const res = await API.getPersonnel();
            this.personnel = res.data || [];
            
            // Flatten experiences
            this.experiences = [];
            this.personnel.forEach(p => {
                if (p.experience_history) {
                    p.experience_history.forEach(exp => {
                        this.experiences.push({
                            ...exp,
                            personnel_nama: p.nama,
                            personnel_id: p.id
                        });
                    });
                }
            });

            // Sort by year descending
            this.experiences.sort((a, b) => (b.tahun || 0) - (a.tahun || 0));
            this.filter();
        } catch(e) {
            el.innerHTML = `<div class="empty-state"><p style="color:var(--danger);">${e.message}</p></div>`;
        }
    },

    filter() {
        const q = document.getElementById('exp-search').value.toLowerCase();
        const filtered = this.experiences.filter(exp => {
            const searchStr = `${exp.nama_kegiatan} ${exp.personnel_nama} ${exp.lokasi} ${exp.pengguna_jasa} ${exp.perusahaan}`.toLowerCase();
            return searchStr.includes(q);
        });
        this.renderTable(filtered);
    },

    renderTable(data) {
        const el = document.getElementById('exp-list');
        if (!data.length) {
            el.innerHTML = `<div class="empty-state"><i data-lucide="briefcase"></i><p>Tidak ada data pengalaman.</p></div>`;
            lucide.createIcons();
            return;
        }

        const rows = data.map((exp, i) => `
        <tr>
            <td style="color:var(--text-muted);text-align:center;">${i + 1}</td>
            <td>
                <div style="font-weight:700;color:var(--text-primary);">${Fmt.escape(exp.nama_kegiatan)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">
                    Personil: <a href="#personnel" onclick="localStorage.setItem('tb_personnel_open', '${exp.personnel_id}')" style="color:var(--accent);text-decoration:none;font-weight:600;">${Fmt.escape(exp.personnel_nama)}</a>
                </div>
            </td>
            <td><span class="badge badge-info">${exp.tahun || '-'}</span></td>
            <td>${Fmt.escape(exp.lokasi || '-')}</td>
            <td>
                <div style="font-weight:500;">${Fmt.escape(exp.pengguna_jasa || '-')}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">via: ${Fmt.escape(exp.perusahaan || '-')}</div>
            </td>
            <td>
                <div style="font-weight:600;">${Fmt.escape(exp.posisi || '-')}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">${Fmt.escape(exp.waktu_pelaksanaan || '-')}</div>
            </td>
            <td style="text-align:center;">
                ${exp.surat_referensi_url 
                    ? `<a href="${exp.surat_referensi_url}" target="_blank" class="btn btn-secondary btn-icon btn-sm" title="Lihat Surat Referensi"><i data-lucide="file-text"></i></a>` 
                    : `<span style="color:var(--text-muted);font-size:0.8rem;">-</span>`}
            </td>
        </tr>
        `).join('');

        el.innerHTML = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th width="50" style="text-align:center;">No</th>
                        <th>Nama Kegiatan & Personil</th>
                        <th width="80">Tahun</th>
                        <th width="150">Lokasi</th>
                        <th width="200">Pengguna Jasa / Perusahaan</th>
                        <th width="200">Posisi / Waktu</th>
                        <th width="80" style="text-align:center;">Ref.</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        `;
        lucide.createIcons();
    },

    addExperienceStart() {
        if (!this.personnel.length) {
            Toast.error('Belum ada data personil. Tambahkan personil terlebih dahulu.');
            return;
        }
        
        const options = this.personnel.map(p => `<option value="${p.id}">${Fmt.escape(p.nama)}</option>`).join('');
        const body = `
            <div class="form-group">
                <label class="form-label">Pilih Personil *</label>
                <select class="form-select" id="sel-personnel">
                    ${options}
                </select>
            </div>
        `;
        Modal.open('Tambah Pengalaman', body, `
            <button class="btn btn-secondary" onclick="Modal.close()">Batal</button>
            <button class="btn btn-primary" onclick="ExperiencePage.goToAddForm()">Lanjut</button>
        `);
    },

    goToAddForm() {
        const pid = document.getElementById('sel-personnel').value;
        Modal.close();
        // Use the existing PersonnelPage form
        PersonnelPage.addExpForm(pid);
        
        // Wrap the save function to also refresh this page
        const originalSave = PersonnelPage.saveExp;
        PersonnelPage.saveExp = async (id) => {
            await originalSave.call(PersonnelPage, id);
            this.loadData();
            // Restore original save
            PersonnelPage.saveExp = originalSave;
        };
    }
};
