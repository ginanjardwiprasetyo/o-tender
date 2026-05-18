/**
 * TenderBuild — Personnel Page (CRUD)
 */
const PersonnelPage = {
    data: [],

    async render() {
        return `
        <div class="page-header">
            <div><h2>Data Personil</h2><p>Database tenaga ahli & terampil perusahaan</p></div>
            <button class="btn btn-primary" onclick="PersonnelPage.openForm()">
                <i data-lucide="plus"></i> Tambah Personil
            </button>
        </div>
        <div class="toolbar">
            <div class="search-box"><i data-lucide="search"></i>
                <input type="text" id="ps-search" placeholder="Cari personil..." oninput="PersonnelPage.filter()">
            </div>
        </div>
        <div id="ps-list"><div class="page-loading"><div class="spinner"></div></div></div>`;
    },

    async afterRender() {
        this.loadData();

        // Check if we need to open a specific personnel
        const openId = localStorage.getItem('tb_personnel_open');
        if (openId) {
            localStorage.removeItem('tb_personnel_open');
            setTimeout(() => this.viewDetail(openId), 500);
        }
    },

    async loadData() {
        try {
            const res = await API.getPersonnel();
            this.data = res.data || [];
            this.renderList(this.data);
        } catch (e) {
            const listEl = document.getElementById('ps-list');
            if (listEl) listEl.innerHTML = '<div class="empty-state"><p>Gagal memuat data</p></div>';
        }
    },

    renderList(items) {
        const el = document.getElementById('ps-list');
        if (!el) return;
        if (!items.length) {
            el.innerHTML = '<div class="empty-state"><i data-lucide="users"></i><p>Belum ada data personil</p></div>';
            lucide.createIcons({ nodes: [el] }); return;
        }
        el.innerHTML = items.map((p, i) => `
        <div class="card" style="margin-bottom:12px;padding:16px 20px; cursor:pointer;" onclick="PersonnelPage.viewDetail('${p.id}')">
            <div style="display:flex;align-items:center;gap:16px;justify-content:space-between;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
                    <div style="width:40px;height:40px;border-radius:50%;background:var(--gradient-1);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;color:white;flex-shrink:0;">${(p.nama || '?')[0].toUpperCase()}</div>
                    <div style="min-width:0;">
                        <div style="font-weight:600;font-size:0.95rem;">${Fmt.escape(p.nama)}</div>
                        <div style="font-size:0.78rem;color:var(--text-muted);">
                            ${Fmt.escape(p.jabatan || '-')} • ${Fmt.escape(p.tingkat_pendidikan || '')} • ${p.tahun_pengalaman || 0} tahun pengalaman
                        </div>
                    </div>
                </div>
                <div class="table-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-secondary btn-sm" onclick="PersonnelPage.viewDetail('${p.id}')"><i data-lucide="eye"></i> Detail</button>
                    <button class="btn btn-secondary btn-icon btn-sm" onclick="PersonnelPage.openForm('${p.id}')" title="Edit"><i data-lucide="pencil"></i></button>
                    <button class="btn btn-danger btn-icon btn-sm" onclick="PersonnelPage.remove('${p.id}')" title="Hapus"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        </div>`).join('');
        lucide.createIcons({ nodes: [el] });
    },

    filter() {
        const q = document.getElementById('ps-search').value.toLowerCase();
        this.renderList(this.data.filter(p => (p.nama + ' ' + (p.jabatan || '') + ' ' + p.tingkat_pendidikan + ' ' + p.sertifikat_keahlian).toLowerCase().includes(q)));
    },

    openForm(id) {
        const p = id ? this.data.find(x => x.id === id) : {};
        const title = id ? 'Edit Personil' : 'Tambah Personil Baru';
        const body = `
        <div style="max-height: 60vh; overflow-y: auto; padding-right: 10px;">
            <div class="form-row">
                <div class="form-group"><label class="form-label">Nama Lengkap *</label><input class="form-input" id="f-nama" value="${Fmt.escape(p.nama || '')}"></div>
                <div class="form-group"><label class="form-label">Jabatan (di Perusahaan)</label><input class="form-input" id="f-jabatan" value="${Fmt.escape(p.jabatan || '')}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Tingkat Pendidikan</label>
                    <select class="form-select" id="f-pendidikan">
                        ${['', 'SMA/SMK', 'D3', 'S1', 'S2', 'S3'].map(v => `<option ${p.tingkat_pendidikan === v ? 'selected' : ''}>${v || '-- Pilih --'}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label class="form-label">Pengalaman (Tahun)</label><input type="number" class="form-input" id="f-pengalaman" value="${p.tahun_pengalaman || ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Tempat Lahir</label><input class="form-input" id="f-tmplahir" value="${Fmt.escape(p.tempat_lahir || '')}"></div>
                <div class="form-group"><label class="form-label">Tanggal Lahir</label><input type="date" class="form-input" id="f-tgllahir" value="${p.tanggal_lahir || ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Upload KTP (PDF/Image)</label>
                    <input type="file" class="form-input" id="f-ktp" accept="image/*,.pdf" style="margin-bottom:6px;">
                    <input type="hidden" id="f-ktp-url" value="${p.ktp_url || ''}">
                    
                    <div id="prev-ktp-container" style="display:${p.ktp_url ? 'flex' : 'none'}; align-items:center; gap:8px; background:var(--bg-tertiary); padding:6px 12px; border-radius:6px; border:1px solid var(--border-color); width:fit-content;">
                        <i data-lucide="file" style="width:16px; height:16px; color:var(--text-muted);"></i>
                        <a id="prev-ktp-link" href="${p.ktp_url || '#'}" target="_blank" style="font-size:0.8rem; font-weight:500;">Lihat KTP tersimpan</a>
                        <button type="button" onclick="PersonnelPage.deleteFileField('${id || ''}', 'ktp_url', 'prev-ktp-container', event)" class="btn btn-danger btn-sm" style="padding:2px 6px; font-size:0.7rem; border-radius:4px; display:inline-flex; align-items:center; gap:2px; height:20px; border:none; cursor:pointer;" title="Hapus KTP dari Cloud">
                            <i data-lucide="x" style="width:10px; height:10px;"></i> Hapus
                        </button>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Upload NPWP (PDF/Image)</label>
                    <input type="file" class="form-input" id="f-npwp" accept="image/*,.pdf" style="margin-bottom:6px;">
                    <input type="hidden" id="f-npwp-url" value="${p.npwp_url || ''}">
                    
                    <div id="prev-npwp-container" style="display:${p.npwp_url ? 'flex' : 'none'}; align-items:center; gap:8px; background:var(--bg-tertiary); padding:6px 12px; border-radius:6px; border:1px solid var(--border-color); width:fit-content;">
                        <i data-lucide="file" style="width:16px; height:16px; color:var(--text-muted);"></i>
                        <a id="prev-npwp-link" href="${p.npwp_url || '#'}" target="_blank" style="font-size:0.8rem; font-weight:500;">Lihat NPWP tersimpan</a>
                        <button type="button" onclick="PersonnelPage.deleteFileField('${id || ''}', 'npwp_url', 'prev-npwp-container', event)" class="btn btn-danger btn-sm" style="padding:2px 6px; font-size:0.7rem; border-radius:4px; display:inline-flex; align-items:center; gap:2px; height:20px; border:none; cursor:pointer;" title="Hapus NPWP dari Cloud">
                            <i data-lucide="x" style="width:10px; height:10px;"></i> Hapus
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
        const footer = `<button class="btn btn-secondary" onclick="Modal.close()">Batal</button><button class="btn btn-primary" onclick="PersonnelPage.save('${id || ''}')">Simpan</button>`;
        Modal.open(title, body, footer);
        lucide.createIcons();
    },

    async deleteFileField(id, fieldKey, containerId, event) {
        if (event) event.preventDefault();
        
        let fileInputId = fieldKey === 'ktp_url' ? 'f-ktp' : 'f-npwp';
        let urlInputId = fieldKey === 'ktp_url' ? 'f-ktp-url' : 'f-npwp-url';
        
        const fileInput = document.getElementById(fileInputId);
        const urlInput = document.getElementById(urlInputId);
        const url = urlInput ? urlInput.value : '';
        
        const resetUI = () => {
            if (urlInput) urlInput.value = '';
            if (fileInput) fileInput.value = '';
            const container = document.getElementById(containerId);
            if (container) container.style.display = 'none';
        };
        
        if (url) {
            Modal.confirm('Hapus Berkas', `Yakin ingin menghapus berkas ${fieldKey === 'ktp_url' ? 'KTP' : 'NPWP'} ini secara permanen dari Supabase Storage?`, async () => {
                try {
                    Toast.info('Menghapus berkas...');
                    await API.deleteFile(url);
                    resetUI();
                    
                    if (id) {
                        const updateData = {};
                        updateData[fieldKey] = null;
                        await API.updatePersonnel(id, updateData);
                        const index = this.data.findIndex(x => x.id === id);
                        if (index !== -1) this.data[index][fieldKey] = null;
                        this.renderList(this.data);
                    }
                    
                    Toast.success('Berkas berhasil dihapus secara permanen!');
                } catch (err) {
                    Toast.error('Gagal menghapus berkas: ' + err.message);
                }
            });
        } else {
            resetUI();
            Toast.info('Pilihan berkas lokal dihapus.');
        }
    },

    async save(id) {
        const btn = document.querySelector('#modal-footer .btn-primary');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...'; }

        try {
            const ktpFile = document.getElementById('f-ktp').files[0];
            const npwpFile = document.getElementById('f-npwp').files[0];
            let ktp_url = document.getElementById('f-ktp-url')?.value || null;
            let npwp_url = document.getElementById('f-npwp-url')?.value || null;

            if (ktpFile) {
                const oldKtp = id ? (this.data.find(x => x.id === id)?.ktp_url) : null;
                if (oldKtp && oldKtp !== ktp_url) {
                    await API.deleteFile(oldKtp).catch(err => console.warn('Failed to delete old KTP:', err.message));
                }
                const res = await API.uploadFile(ktpFile, 'personnel');
                ktp_url = res.url;
            }
            if (npwpFile) {
                const oldNpwp = id ? (this.data.find(x => x.id === id)?.npwp_url) : null;
                if (oldNpwp && oldNpwp !== npwp_url) {
                    await API.deleteFile(oldNpwp).catch(err => console.warn('Failed to delete old NPWP:', err.message));
                }
                const res = await API.uploadFile(npwpFile, 'personnel');
                npwp_url = res.url;
            }

            const data = {
                nama: document.getElementById('f-nama').value.trim(),
                jabatan: document.getElementById('f-jabatan').value.trim() || null,
                tingkat_pendidikan: document.getElementById('f-pendidikan').value || null,
                tempat_lahir: document.getElementById('f-tmplahir').value.trim() || null,
                tanggal_lahir: document.getElementById('f-tgllahir').value || null,
                tahun_pengalaman: parseInt(document.getElementById('f-pengalaman').value) || null,
                ktp_url,
                npwp_url
            };

            if (!data.nama) { throw new Error('Nama wajib diisi'); }

            if (id) { await API.updatePersonnel(id, data); Toast.success('Data personil diperbarui'); }
            else { await API.createPersonnel(data); Toast.success('Personil baru ditambahkan'); }
            Modal.close(); this.loadData();
        } catch (e) {
            Toast.error(e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = 'Simpan'; }
        }
    },

    async viewDetail(id) {
        try {
            const { data: p } = await API.getPersonnelById(id);

            const eduRows = (p.education_history || []).map(e => `
                <tr>
                    <td>${Fmt.escape(e.lembaga)}<br><small style="color:var(--text-muted);">${Fmt.escape(e.jenjang || '')} - ${Fmt.escape(e.jurusan || '')}</small></td>
                    <td>${Fmt.escape(e.tempat || '')}</td>
                    <td>${e.tahun_tamat || '-'}</td>
                    <td style="text-align:center;">${e.ijazah_url ? `<a href="${e.ijazah_url}" target="_blank" class="btn btn-secondary btn-icon btn-sm" title="Lihat Ijazah"><i data-lucide="file"></i></a>` : '-'}</td>
                    <td><button class="btn btn-danger btn-icon btn-sm" onclick="PersonnelPage.delEdu('${e.id}','${id}')"><i data-lucide="trash-2"></i></button></td>
                </tr>`).join('');

            const expRows = (p.experience_history || []).map(e => `
                <tr>
                    <td>${Fmt.escape(e.tahun || '')}</td>
                    <td>${Fmt.escape(e.nama_kegiatan || '')}</td>
                    <td>${Fmt.escape(e.posisi || '')}</td>
                    <td>${Fmt.escape(e.perusahaan || '')}</td>
                    <td style="text-align:center;">${e.surat_referensi_url ? `<a href="${e.surat_referensi_url}" target="_blank" class="btn btn-secondary btn-icon btn-sm" title="Surat Referensi"><i data-lucide="file-text"></i></a>` : '-'}</td>
                    <td><button class="btn btn-danger btn-icon btn-sm" onclick="PersonnelPage.delExp('${e.id}','${id}')"><i data-lucide="trash-2"></i></button></td>
                </tr>`).join('');

            const skaRows = (p.ska || []).map(e => `
                <tr>
                    <td>${Fmt.escape(e.nama_sertifikat)}</td>
                    <td>${Fmt.escape(e.no_registrasi || '')}</td>
                    <td>${Fmt.escape(e.sub_klasifikasi || '')}</td>
                    <td>${e.berlaku_sampai ? Fmt.date(e.berlaku_sampai) : '-'}</td>
                    <td style="text-align:center;">${e.file_url ? `<a href="${e.file_url}" target="_blank" class="btn btn-secondary btn-icon btn-sm" title="Sertifikat"><i data-lucide="award"></i></a>` : '-'}</td>
                    <td><button class="btn btn-danger btn-icon btn-sm" onclick="PersonnelPage.delSka('${e.id}','${id}')"><i data-lucide="trash-2"></i></button></td>
                </tr>`).join('');

            const body = `
            <div style="margin-bottom:20px; display:flex; gap:16px;">
                <div style="width:64px;height:64px;border-radius:50%;background:var(--gradient-1);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.5rem;color:white;flex-shrink:0;">${(p.nama || '?')[0].toUpperCase()}</div>
                <div>
                    <strong style="font-size:1.2rem;">${Fmt.escape(p.nama)}</strong>
                    <div style="color:var(--text-muted); font-size:0.9rem; margin-top:4px;">${Fmt.escape(p.jabatan || '-')} • ${p.tingkat_pendidikan || '-'} • ${p.tahun_pengalaman || 0} th pengalaman</div>
                    <div style="margin-top:8px; display:flex; gap:10px; flex-wrap:wrap;">
                        ${p.ktp_url ? `<a href="${p.ktp_url}" target="_blank" class="btn btn-secondary btn-sm"><i data-lucide="file"></i> KTP</a>` : ''}
                        ${p.npwp_url ? `<a href="${p.npwp_url}" target="_blank" class="btn btn-secondary btn-sm"><i data-lucide="file"></i> NPWP</a>` : ''}
                    </div>
                </div>
            </div>
            
            <div style="max-height: 50vh; overflow-y: auto; padding-right:10px;">
                <!-- SKA -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-weight:600;font-size:0.95rem; color:var(--text-primary);">Sertifikat Keahlian (SKA/SKT)</span>
                    <button class="btn btn-secondary btn-sm" onclick="PersonnelPage.addSkaForm('${id}')"><i data-lucide="plus"></i> Tambah SKA</button>
                </div>
                <div class="table-container" style="margin-bottom:24px;"><table><thead><tr><th>Nama Sertifikat</th><th>No. Registrasi</th><th>Sub Klas</th><th>Berlaku</th><th width="50">Berkas</th><th width="40"></th></tr></thead><tbody>${skaRows || '<tr><td colspan="6" class="text-center">Belum ada data SKA</td></tr>'}</tbody></table></div>
                
                <!-- Pendidikan -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-weight:600;font-size:0.95rem; color:var(--text-primary);">Riwayat Pendidikan</span>
                    <button class="btn btn-secondary btn-sm" onclick="PersonnelPage.addEduForm('${id}')"><i data-lucide="plus"></i> Tambah Pendidikan</button>
                </div>
                <div class="table-container" style="margin-bottom:24px;"><table><thead><tr><th>Lembaga</th><th>Tempat</th><th>Lulus</th><th width="50">Ijazah</th><th width="40"></th></tr></thead><tbody>${eduRows || '<tr><td colspan="5" class="text-center">Belum ada data pendidikan</td></tr>'}</tbody></table></div>
                
                <!-- Pengalaman -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-weight:600;font-size:0.95rem; color:var(--text-primary);">Pengalaman Kerja</span>
                    <button class="btn btn-secondary btn-sm" onclick="PersonnelPage.addExpForm('${id}')"><i data-lucide="plus"></i> Tambah Pengalaman</button>
                </div>
                <div class="table-container"><table><thead><tr><th>Thn</th><th>Kegiatan</th><th>Posisi</th><th>Perusahaan</th><th width="50">Ref.</th><th width="40"></th></tr></thead><tbody>${expRows || '<tr><td colspan="6" class="text-center">Belum ada data pengalaman</td></tr>'}</tbody></table></div>
            </div>
            `;
            Modal.open('Detail Personil', body, '<button class="btn btn-secondary" onclick="Modal.close()">Tutup</button>');
            const modalEl = document.getElementById('modal');
            if (modalEl) modalEl.style.maxWidth = '1200px';
            lucide.createIcons();
        } catch (e) { Toast.error(e.message); }
    },

    // ─── PENDIDIKAN ──────────────────────────────────
    addEduForm(pid) {
        const body = `
        <div class="form-group"><label class="form-label">Lembaga Pendidikan *</label><input class="form-input" id="f-edu-lembaga"></div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">Jenjang (SD/SMP/SMA/S1)</label><input class="form-input" id="f-edu-jenjang"></div>
            <div class="form-group"><label class="form-label">Jurusan</label><input class="form-input" id="f-edu-jurusan"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">Tempat</label><input class="form-input" id="f-edu-tempat"></div>
            <div class="form-group"><label class="form-label">Tahun Tamat</label><input type="number" class="form-input" id="f-edu-tahun"></div>
        </div>
        <div class="form-group">
            <label class="form-label">Upload Scan Ijazah (PDF/Image)</label>
            <input type="file" class="form-input" id="f-edu-file" accept="image/*,.pdf">
        </div>`;
        Modal.open('Tambah Riwayat Pendidikan', body,
            `<button class="btn btn-secondary" onclick="PersonnelPage.viewDetail('${pid}')">Kembali</button><button class="btn btn-primary" onclick="PersonnelPage.saveEdu('${pid}')">Simpan</button>`);
    },

    async saveEdu(pid) {
        const btn = document.querySelector('#modal-footer .btn-primary');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...'; }
        try {
            const file = document.getElementById('f-edu-file').files[0];
            let url = null;
            if (file) {
                const res = await API.uploadFile(file, 'personnel_docs');
                url = res.url;
            }

            await API.addEducation(pid, {
                lembaga: document.getElementById('f-edu-lembaga').value.trim(),
                jenjang: document.getElementById('f-edu-jenjang').value.trim() || null,
                jurusan: document.getElementById('f-edu-jurusan').value.trim() || null,
                tempat: document.getElementById('f-edu-tempat').value.trim() || null,
                tahun_tamat: parseInt(document.getElementById('f-edu-tahun').value) || null,
                ijazah_url: url
            });
            Toast.success('Pendidikan ditambahkan');
            this.viewDetail(pid);
        } catch (e) {
            Toast.error(e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = 'Simpan'; }
        }
    },
    async delEdu(id, pid) { try { await API.deleteEducation(id); Toast.success('Dihapus'); this.viewDetail(pid); } catch (e) { Toast.error(e.message); } },

    // ─── PENGALAMAN ──────────────────────────────────
    addExpForm(pid) {
        const body = `
        <div style="max-height: 50vh; overflow-y: auto; padding-right: 5px;">
            <div class="form-row">
                <div class="form-group"><label class="form-label">Tahun</label><input class="form-input" id="f-exp-tahun" placeholder="2020-2022"></div>
                <div class="form-group"><label class="form-label">Posisi Penugasan</label><input class="form-input" id="f-exp-posisi"></div>
            </div>
            <div class="form-group"><label class="form-label">Nama Kegiatan/Proyek *</label><input class="form-input" id="f-exp-kegiatan"></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Lokasi</label><input class="form-input" id="f-exp-lokasi"></div>
                <div class="form-group"><label class="form-label">Nama Perusahaan (Employer)</label><input class="form-input" id="f-exp-perusahaan"></div>
            </div>
            <div class="form-group"><label class="form-label">Pengguna Jasa / Instansi</label><input class="form-input" id="f-exp-pengguna"></div>
            <div class="form-group"><label class="form-label">Uraian Tugas</label><textarea class="form-textarea" id="f-exp-uraian" rows="2"></textarea></div>
            <div class="form-group"><label class="form-label">Waktu Pelaksanaan</label><input class="form-input" id="f-exp-waktu" placeholder="6 bulan"></div>
            <div class="form-group">
                <label class="form-label">Upload Surat Referensi (PDF/Image)</label>
                <input type="file" class="form-input" id="f-exp-file" accept="image/*,.pdf">
            </div>
        </div>`;
        Modal.open('Tambah Pengalaman Kerja', body,
            `<button class="btn btn-secondary" onclick="PersonnelPage.viewDetail('${pid}')">Kembali</button><button class="btn btn-primary" onclick="PersonnelPage.saveExp('${pid}')">Simpan</button>`);
    },

    async saveExp(pid) {
        const btn = document.querySelector('#modal-footer .btn-primary');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...'; }
        try {
            const file = document.getElementById('f-exp-file').files[0];
            let url = null;
            if (file) {
                const res = await API.uploadFile(file, 'personnel_docs');
                url = res.url;
            }

            await API.addExperience(pid, {
                tahun: document.getElementById('f-exp-tahun').value.trim(),
                nama_kegiatan: document.getElementById('f-exp-kegiatan').value.trim(),
                lokasi: document.getElementById('f-exp-lokasi').value.trim(),
                pengguna_jasa: document.getElementById('f-exp-pengguna').value.trim(),
                perusahaan: document.getElementById('f-exp-perusahaan').value.trim(),
                uraian_tugas: document.getElementById('f-exp-uraian').value.trim(),
                waktu_pelaksanaan: document.getElementById('f-exp-waktu').value.trim(),
                posisi: document.getElementById('f-exp-posisi').value.trim(),
                surat_referensi_url: url
            });
            Toast.success('Pengalaman kerja ditambahkan');
            this.viewDetail(pid);
        } catch (e) {
            Toast.error(e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = 'Simpan'; }
        }
    },
    async delExp(id, pid) { try { await API.deleteExperience(id); Toast.success('Dihapus'); this.viewDetail(pid); } catch (e) { Toast.error(e.message); } },

    // ─── SKA / SKT ───────────────────────────────────
    addSkaForm(pid) {
        const body = `
        <div class="form-group"><label class="form-label">Nama Sertifikat *</label><input class="form-input" id="f-ska-nama" placeholder="Ahli Teknik Bangunan Gedung - Madya"></div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">No. Registrasi</label><input class="form-input" id="f-ska-noreg"></div>
            <div class="form-group"><label class="form-label">Sub Klasifikasi</label><input class="form-input" id="f-ska-sub"></div>
        </div>
        <div class="form-group"><label class="form-label">Berlaku Sampai</label><input type="date" class="form-input" id="f-ska-tgl"></div>
        <div class="form-group">
            <label class="form-label">Upload File Sertifikat (PDF/Image)</label>
            <input type="file" class="form-input" id="f-ska-file" accept="image/*,.pdf">
        </div>`;
        Modal.open('Tambah SKA/SKT', body,
            `<button class="btn btn-secondary" onclick="PersonnelPage.viewDetail('${pid}')">Kembali</button><button class="btn btn-primary" onclick="PersonnelPage.saveSka('${pid}')">Simpan</button>`);
    },

    async saveSka(pid) {
        const btn = document.querySelector('#modal-footer .btn-primary');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...'; }
        try {
            const file = document.getElementById('f-ska-file').files[0];
            let url = null;
            if (file) {
                const res = await API.uploadFile(file, 'personnel_docs');
                url = res.url;
            }

            await API.addSka(pid, {
                nama_sertifikat: document.getElementById('f-ska-nama').value.trim(),
                no_registrasi: document.getElementById('f-ska-noreg').value.trim(),
                sub_klasifikasi: document.getElementById('f-ska-sub').value.trim(),
                berlaku_sampai: document.getElementById('f-ska-tgl').value || null,
                file_url: url
            });
            Toast.success('Sertifikat ditambahkan');
            this.viewDetail(pid);
        } catch (e) {
            Toast.error(e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = 'Simpan'; }
        }
    },
    async delSka(id, pid) { try { await API.deleteSka(id); Toast.success('Dihapus'); this.viewDetail(pid); } catch (e) { Toast.error(e.message); } },

    remove(id) {
        Modal.confirm('Hapus Personil', 'Yakin menghapus personil ini? Semua riwayat akan terhapus.', async () => {
            try { await API.deletePersonnel(id); Toast.success('Personil berhasil dihapus'); this.loadData(); }
            catch (e) { Toast.error(e.message); }
        });
    }
};
