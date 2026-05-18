/**
 * TenderBuild — Company Management Page
 */
const CompanyPage = {
    companies: [],

    async render() {
        return `
        <div class="page-header">
            <div>
                <h2>Data Perusahaan</h2>
                <p>Kelola data profil perusahaan dan direktur</p>
            </div>
            <button class="btn btn-primary" onclick="CompanyPage.openForm()"><i data-lucide="plus"></i> Tambah Perusahaan</button>
        </div>
        
        <div class="toolbar">
            <div class="search-box">
                <i data-lucide="search"></i>
                <input type="text" id="comp-search" placeholder="Cari nama, singkatan, atau direktur..." oninput="CompanyPage.debounceSearch()">
            </div>
        </div>

        <div id="comp-list"></div>
        `;
    },

    async afterRender() {
        this.loadData();
    },

    debounceTimer: null,
    debounceSearch() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.loadData(), 400);
    },

    async loadData() {
        const el = document.getElementById('comp-list');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        try {
            const search = document.getElementById('comp-search')?.value?.trim();
            const res = await API.getCompanies(search ? { search } : {});
            this.companies = res.data || [];
            this.renderList();
        } catch(e) {
            el.innerHTML = `<div class="empty-state"><i data-lucide="building-2"></i><p>Gagal memuat data: ${e.message}</p></div>`;
            lucide.createIcons();
        }
    },

    renderList() {
        const el = document.getElementById('comp-list');
        if (!el) return;
        if (!this.companies.length) {
            el.innerHTML = `<div class="empty-state"><i data-lucide="building-2"></i><p>Belum ada data perusahaan.</p><p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">Klik <strong>Tambah Perusahaan</strong> untuk menambahkan.</p></div>`;
            lucide.createIcons();
            return;
        }

        const cards = this.companies.map(c => `
        <div class="card" style="margin-bottom:12px; padding:16px 20px; cursor:pointer;" onclick="location.hash='#company-detail/${c.id}'">
            <div style="display:flex; align-items:center; gap:16px; justify-content:space-between; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:0;">
                    <div style="width:48px; height:48px; border-radius:var(--radius-md); background:var(--gradient-1); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.1rem; color:white; flex-shrink:0;">
                        ${c.singkatan ? c.singkatan.charAt(0).toUpperCase() : (c.nama_perusahaan||'?')[0].toUpperCase()}
                    </div>
                    <div style="min-width:0;">
                        <div style="font-weight:600; font-size:0.95rem;">${Fmt.escape(c.nama_perusahaan)}</div>
                        <div style="font-size:0.78rem; color:var(--text-muted);">
                            ${c.singkatan ? Fmt.escape(c.singkatan) + ' • ' : ''}
                            Direktur: ${c.direktur ? Fmt.escape(c.direktur) : '-'} • 
                            NPWP: ${c.npwp_usaha ? Fmt.escape(c.npwp_usaha) : '-'}
                        </div>
                    </div>
                </div>
                <div class="table-actions" onclick="event.stopPropagation()">
                    <a href="#company-detail/${c.id}" class="btn btn-secondary btn-sm"><i data-lucide="eye"></i> Detail</a>
                    <button class="btn btn-secondary btn-icon btn-sm" onclick="CompanyPage.openForm('${c.id}')" title="Edit"><i data-lucide="pencil"></i></button>
                    <button class="btn btn-danger btn-icon btn-sm" onclick="CompanyPage.remove('${c.id}')" title="Hapus"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        </div>
        `).join('');
        el.innerHTML = cards;
        lucide.createIcons();
    },

    openForm(id) {
        const c = id ? this.companies.find(x => x.id === id) : {};
        const title = id ? 'Edit Perusahaan' : 'Tambah Perusahaan Baru';
        const body = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px; max-height:75vh; overflow-y:auto; padding-right:12px;">
            <!-- KOLOM KIRI: IDENTITAS & KONTAK -->
            <div style="display:flex; flex-direction:column; gap:20px;">
                <section style="background:var(--bg-secondary); padding:20px; border-radius:12px; border:1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                        <i data-lucide="info" style="width:18px; height:18px; color:var(--accent);"></i>
                        <span style="font-weight:700; font-size:0.9rem; text-transform:uppercase; letter-spacing:0.5px;">Identitas Perusahaan</span>
                    </div>
                    
                    <div style="display:flex; gap:16px; margin-bottom:16px;">
                        <div style="width:80px; height:80px; border:2px dashed var(--border-color); border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:var(--bg-primary); position:relative; flex-shrink:0;">
                            <img id="prev-comp-logo" src="${Fmt.url(c.foto_logo_url || '')}" style="width:100%; height:100%; object-fit:contain; display:${c.foto_logo_url ? 'block' : 'none'};">
                            <i id="icon-comp-logo" data-lucide="building-2" style="width:24px; height:24px; color:var(--text-muted); display:${c.foto_logo_url ? 'none' : 'block'};"></i>
                            
                            <!-- Tombol X Hapus Logo -->
                            <button id="del-comp-logo" type="button" onclick="CompanyPage.deleteImageField('f-comp-logo-url', 'prev-comp-logo', 'icon-comp-logo', 'del-comp-logo', event)" style="position:absolute; top:4px; right:4px; background:rgba(239,68,68,0.9); color:white; width:20px; height:20px; border-radius:50%; border:none; display:${c.foto_logo_url ? 'flex' : 'none'}; align-items:center; justify-content:center; cursor:pointer; font-size:10px; z-index:10;" title="Hapus Gambar">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>

                            <label for="f-comp-logo-file" style="position:absolute; bottom:0; right:0; background:var(--accent); color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; border:2px solid white;">
                                <i data-lucide="camera" style="width:12px; height:12px;"></i>
                            </label>
                            <input type="file" id="f-comp-logo-file" accept="image/*" style="display:none;" onchange="CompanyPage.previewFile(this, 'prev-comp-logo', 'icon-comp-logo')">
                            <input type="hidden" id="f-comp-logo-url" value="${c.foto_logo_url || ''}">
                        </div>
                        <div style="flex:1;">
                            <div class="form-group" style="margin-bottom:0;"><label class="form-label">Nama Lengkap Perusahaan <span style="color:var(--danger);">*</span></label>
                                <input class="form-input" id="f-comp-nama" value="${Fmt.escape(c.nama_perusahaan||'')}" placeholder="PT. Nama Perusahaan">
                            </div>
                            <div style="margin-top:6px; font-size:0.7rem; color:var(--text-muted);">Format: PT/CV. Nama Perusahaan</div>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Singkatan</label>
                            <input class="form-input" id="f-comp-singkatan" value="${Fmt.escape(c.singkatan||'')}" placeholder="PT. NP">
                        </div>
                        <div class="form-group"><label class="form-label">KBLI</label>
                            <input class="form-input" id="f-comp-kbli" value="${Fmt.escape(c.kbli||'')}" placeholder="41011, 42211">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Nama Direktur Utama</label>
                            <input class="form-input" id="f-comp-direktur" value="${Fmt.escape(c.direktur||'')}" placeholder="Nama Lengkap & Gelar">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group"><label class="form-label">NPWP Badan Usaha</label>
                            <input class="form-input" id="f-comp-npwp" value="${Fmt.escape(c.npwp_usaha||'')}" placeholder="00.000.000.0-000.000">
                        </div>
                        <div class="form-group"><label class="form-label">NPWP Direktur</label>
                            <input class="form-input" id="f-comp-npwp-dir" value="${Fmt.escape(c.npwp_direktur||'')}" placeholder="00.000.000.0-000.000">
                        </div>
                    </div>
                </section>

                <section style="background:var(--bg-secondary); padding:20px; border-radius:12px; border:1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                        <i data-lucide="map-pin" style="width:18px; height:18px; color:var(--accent);"></i>
                        <span style="font-weight:700; font-size:0.9rem; text-transform:uppercase; letter-spacing:0.5px;">Kontak & Lokasi</span>
                    </div>

                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Email Kantor</label>
                            <input type="email" class="form-input" id="f-comp-email" value="${Fmt.escape(c.email||'')}" placeholder="info@perusahaan.com">
                        </div>
                        <div class="form-group"><label class="form-label">No. HP / WhatsApp</label>
                            <input class="form-input" id="f-comp-hp" value="${Fmt.escape(c.no_hp||'')}" placeholder="081234567xxx">
                        </div>
                    </div>

                    <div class="form-group"><label class="form-label">Website</label>
                        <input class="form-input" id="f-comp-web" value="${Fmt.escape(c.website||'')}" placeholder="https://www.perusahaan.com">
                    </div>

                    <div class="form-group"><label class="form-label">Alamat Lengkap</label>
                        <textarea class="form-textarea" id="f-comp-alamat" rows="2" placeholder="Jl. Nama Jalan No. XX, Kelurahan, Kecamatan">${Fmt.escape(c.alamat||'')}</textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Kota / Kabupaten</label>
                            <input class="form-input" id="f-comp-kota" value="${Fmt.escape(c.kota||'')}" placeholder="Surakarta">
                        </div>
                        <div class="form-group"><label class="form-label">Provinsi</label>
                            <input class="form-input" id="f-comp-prov" value="${Fmt.escape(c.provinsi||'')}" placeholder="Jawa Tengah">
                        </div>
                    </div>
                </section>
            </div>

            <!-- KOLOM KANAN: KOP, TTD & LAMPIRAN -->
            <div style="display:flex; flex-direction:column; gap:20px;">
                <section style="background:var(--bg-secondary); padding:20px; border-radius:12px; border:1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <i data-lucide="printer" style="width:18px; height:18px; color:var(--accent);"></i>
                            <span style="font-weight:700; font-size:0.9rem; text-transform:uppercase; letter-spacing:0.5px;">Kop Surat & Legalisasi</span>
                        </div>
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; color:var(--accent); font-weight:600;">
                            <input type="checkbox" id="f-comp-kop-is-image" ${c.kop_is_image ? 'checked' : ''} onchange="document.getElementById('comp-kop-text-fields').style.display = this.checked ? 'none' : 'block'; document.getElementById('comp-kop-image-field').style.display = this.checked ? 'block' : 'none';"> Gunakan Gambar Kop
                        </label>
                    </div>

                    <div id="comp-kop-image-field" style="display:${c.kop_is_image ? 'block' : 'none'};">
                        <div class="form-group"><label class="form-label">Upload Gambar Kop Surat</label>
                            <input type="file" class="form-input" id="f-comp-kop-img-file" accept="image/*" onchange="CompanyPage.previewFile(this, 'prev-comp-kop', 'icon-comp-kop')">
                            
                            <div style="margin-top:8px; width:100%; height:100px; border:1px solid var(--border-color); border-radius:8px; display:flex; align-items:center; justify-content:center; background:white; overflow:hidden; position:relative;">
                                <img id="prev-comp-kop" src="${Fmt.url(c.kop_image_url || '')}" style="max-width:100%; max-height:90px; display:${c.kop_image_url ? 'block' : 'none'}; object-fit:contain;">
                                <span id="icon-comp-kop" style="font-size:0.75rem; color:var(--text-muted); display:${c.kop_image_url ? 'none' : 'block'};">Pratinjau Kop Surat</span>
                                
                                <!-- Tombol X Hapus Kop -->
                                <button id="del-comp-kop" type="button" onclick="CompanyPage.deleteImageField('f-comp-kop-img-url', 'prev-comp-kop', 'icon-comp-kop', 'del-comp-kop', event)" style="position:absolute; top:6px; right:6px; background:rgba(239,68,68,0.9); color:white; width:22px; height:22px; border-radius:50%; border:none; display:${c.kop_image_url ? 'flex' : 'none'}; align-items:center; justify-content:center; cursor:pointer; z-index:10;" title="Hapus Kop Surat">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                            </div>
                            <input type="hidden" id="f-comp-kop-img-url" value="${c.kop_image_url || ''}">
                        </div>
                    </div>

                    <div id="comp-kop-text-fields" style="display:${c.kop_is_image ? 'none' : 'block'};">
                        <div class="form-group"><label class="form-label">Nama di Kop</label>
                            <input class="form-input" id="f-comp-kop-nama" value="${Fmt.escape(c.kop_nama || '')}" placeholder="PT. CONTOH PERUSAHAAN UTAMA">
                        </div>
                        <div class="form-group"><label class="form-label">Alamat & Info Kop</label>
                            <input class="form-input" id="f-comp-kop-alamat" value="${Fmt.escape(c.kop_alamat || '')}" placeholder="Jl. Raya No. 1, Kota">
                        </div>
                        <div class="form-group"><label class="form-label">Kontak di Kop</label>
                            <input class="form-input" id="f-comp-kop-kontak" value="${Fmt.escape(c.kop_kontak || '')}" placeholder="Telp: (021) 123456 | Email: info@perusahaan.com">
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-top:16px;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label">Tanda Tangan Direktur</label>
                            <input type="file" class="form-input" id="f-comp-ttd-file" accept="image/*" onchange="CompanyPage.previewFile(this, 'prev-comp-ttd', 'icon-comp-ttd')">
                            
                            <div style="margin-top:6px; height:80px; border:1px solid var(--border-color); border-radius:8px; display:flex; align-items:center; justify-content:center; background:white; overflow:hidden; position:relative;">
                                <img id="prev-comp-ttd" src="${Fmt.url(c.ttd_image_url || '')}" style="max-height:70px; display:${c.ttd_image_url ? 'block' : 'none'}; object-fit:contain;">
                                <span id="icon-comp-ttd" style="font-size:0.7rem; color:var(--text-muted); display:${c.ttd_image_url ? 'none' : 'block'};">TTD PNG</span>
                                
                                <!-- Tombol X Hapus Ttd -->
                                <button id="del-comp-ttd" type="button" onclick="CompanyPage.deleteImageField('f-comp-ttd-url', 'prev-comp-ttd', 'icon-comp-ttd', 'del-comp-ttd', event)" style="position:absolute; top:4px; right:4px; background:rgba(239,68,68,0.9); color:white; width:20px; height:20px; border-radius:50%; border:none; display:${c.ttd_image_url ? 'flex' : 'none'}; align-items:center; justify-content:center; cursor:pointer; z-index:10;" title="Hapus Tanda Tangan">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                            </div>
                            <input type="hidden" id="f-comp-ttd-url" value="${c.ttd_image_url || ''}">
                        </div>

                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label">Cap/Stempel</label>
                            <input type="file" class="form-input" id="f-comp-cap-file" accept="image/*" onchange="CompanyPage.previewFile(this, 'prev-comp-cap', 'icon-comp-cap')">
                            
                            <div style="margin-top:6px; height:80px; border:1px solid var(--border-color); border-radius:8px; display:flex; align-items:center; justify-content:center; background:white; overflow:hidden; position:relative;">
                                <img id="prev-comp-cap" src="${Fmt.url(c.cap_image_url || '')}" style="max-height:70px; display:${c.cap_image_url ? 'block' : 'none'}; object-fit:contain;">
                                <span id="icon-comp-cap" style="font-size:0.7rem; color:var(--text-muted); display:${c.cap_image_url ? 'none' : 'block'};">STAMP</span>
                                
                                <!-- Tombol X Hapus Cap -->
                                <button id="del-comp-cap" type="button" onclick="CompanyPage.deleteImageField('f-comp-cap-url', 'prev-comp-cap', 'icon-comp-cap', 'del-comp-cap', event)" style="position:absolute; top:4px; right:4px; background:rgba(239,68,68,0.9); color:white; width:20px; height:20px; border-radius:50%; border:none; display:${c.cap_image_url ? 'flex' : 'none'}; align-items:center; justify-content:center; cursor:pointer; z-index:10;" title="Hapus Cap">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                            </div>
                            <input type="hidden" id="f-comp-cap-url" value="${c.cap_image_url || ''}">
                        </div>
                    </div>
                </section>

                <section style="background:var(--bg-secondary); padding:20px; border-radius:12px; border:1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                        <i data-lucide="file-text" style="width:18px; height:18px; color:var(--accent);"></i>
                        <span style="font-weight:700; font-size:0.9rem; text-transform:uppercase; letter-spacing:0.5px;">Dokumen Lampiran</span>
                    </div>
                    
                    <div id="comp-attachments-container" style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;"></div>
                    
                    <div style="background:var(--bg-primary); padding:16px; border-radius:8px; border:1px solid var(--border-color);">
                        <div class="form-group"><label class="form-label">Nama Dokumen</label>
                            <input type="text" class="form-input" id="f-comp-att-name" placeholder="Misal: Company Profile 2026">
                        </div>
                        <div class="form-group"><label class="form-label">Pilih File (PDF/Gambar)</label>
                            <input type="file" class="form-input" id="f-comp-att-file" accept=".pdf,image/*">
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="CompanyPage.addAttachment()" style="width:100%;"><i data-lucide="plus"></i> Tambahkan Dokumen</button>
                    </div>
                    <input type="hidden" id="f-comp-attachments-data" value="">
                </section>
            </div>
        </div>`;
        const footer = `<button class="btn btn-secondary" onclick="Modal.close()">Batal</button><button class="btn btn-primary" onclick="CompanyPage.save('${id||''}')">Simpan</button>`;
        Modal.open(title, body, footer);
        
        const modalEl = document.getElementById('modal');
        if (modalEl) modalEl.style.maxWidth = '1200px';

        let attsVal = c.attachments || [];
        if (typeof attsVal === 'string') {
            try { attsVal = JSON.parse(attsVal); } catch(e) { attsVal = []; }
        }
        if (typeof attsVal === 'string') {
            try { attsVal = JSON.parse(attsVal); } catch(e) { attsVal = []; }
        }
        if (!Array.isArray(attsVal)) attsVal = [];
        document.getElementById('f-comp-attachments-data').value = JSON.stringify(attsVal);

        this.renderAttachments();
        lucide.createIcons();
    },

    renderAttachments() {
        const container = document.getElementById('comp-attachments-container');
        if (!container) return;
        try {
            let atts = document.getElementById('f-comp-attachments-data').value || '[]';
            if (typeof atts === 'string') {
                try { atts = JSON.parse(atts); } catch(e) { atts = []; }
            }
            if (typeof atts === 'string') {
                try { atts = JSON.parse(atts); } catch(e) { atts = []; }
            }
            if (!Array.isArray(atts)) atts = [];

            if (atts.length === 0) {
                container.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">Belum ada lampiran.</div>';
                return;
            }
            container.innerHTML = atts.map((att, idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-secondary); border-radius:6px; border:1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                        <i data-lucide="file-text" style="width:16px; height:16px; color:var(--accent); flex-shrink:0;"></i>
                        <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.85rem; font-weight:500;">
                            ${Fmt.escape(att.name)}
                        </div>
                    </div>
                    <div style="display:flex; gap:6px;">
                        ${att.url ? `<a href="${Fmt.url(att.url)}" target="_blank" class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem;">Lihat</a>` : `<span style="font-size:0.75rem; color:var(--warning);">Menunggu Simpan</span>`}
                        <button type="button" class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="CompanyPage.removeAttachment(${idx})">Hapus</button>
                    </div>
                </div>
            `).join('');
            lucide.createIcons();
        } catch (e) { console.error(e); }
    },

    async addAttachment() {
        const nameInput = document.getElementById('f-comp-att-name');
        const fileInput = document.getElementById('f-comp-att-file');
        
        if (!nameInput.value.trim() || !fileInput.files || !fileInput.files[0]) {
            Toast.error('Pilih file dan masukkan nama dokumen');
            return;
        }

        const btn = document.querySelector('button[onclick="CompanyPage.addAttachment()"]');
        const origText = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span>...';

        try {
            // Langsung upload file
            const res = await API.uploadFile(fileInput.files[0], 'companies/attachments');
            
            const dataInput = document.getElementById('f-comp-attachments-data');
            let atts = dataInput.value || '[]';
            if (typeof atts === 'string') {
                try { atts = JSON.parse(atts); } catch(e) { atts = []; }
            }
            if (typeof atts === 'string') {
                try { atts = JSON.parse(atts); } catch(e) { atts = []; }
            }
            if (!Array.isArray(atts)) atts = [];
            
            atts.push({
                name: nameInput.value.trim(),
                url: res.url,
                filename: fileInput.files[0].name
            });
            
            dataInput.value = JSON.stringify(atts);
            
            // Reset fields
            nameInput.value = '';
            fileInput.value = '';
            
            this.renderAttachments();
        } catch (err) {
            Toast.error('Gagal mengunggah dokumen: ' + err.message);
        } finally {
            btn.disabled = false; btn.innerHTML = origText;
        }
    },

    async removeAttachment(idx) {
        const dataInput = document.getElementById('f-comp-attachments-data');
        try {
            let atts = dataInput.value || '[]';
            if (typeof atts === 'string') {
                try { atts = JSON.parse(atts); } catch(e) { atts = []; }
            }
            if (typeof atts === 'string') {
                try { atts = JSON.parse(atts); } catch(e) { atts = []; }
            }
            if (!Array.isArray(atts)) atts = [];

            const targetAtt = atts[idx];
            if (targetAtt && targetAtt.url) {
                Toast.info('Menghapus berkas dari cloud storage...');
                await API.deleteFile(targetAtt.url).catch(e => console.warn('Failed to delete file from Supabase:', e.message));
            }

            atts.splice(idx, 1);
            dataInput.value = JSON.stringify(atts);
            this.renderAttachments();
            Toast.success('Dokumen berhasil dihapus');
        } catch(e) {
            Toast.error('Gagal menghapus dokumen: ' + e.message);
        }
    },

    previewFile(input, imgId, iconId) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.getElementById(imgId);
                const icon = document.getElementById(iconId);
                if (img) { img.src = e.target.result; img.style.display = 'block'; }
                if (icon) { icon.style.display = 'none'; }
                
                // Tampilkan tombol hapus instan
                let btnId = '';
                if (imgId === 'prev-comp-logo') btnId = 'del-comp-logo';
                else if (imgId === 'prev-comp-kop') btnId = 'del-comp-kop';
                else if (imgId === 'prev-comp-ttd') btnId = 'del-comp-ttd';
                else if (imgId === 'prev-comp-cap') btnId = 'del-comp-cap';
                
                const btn = document.getElementById(btnId);
                if (btn) btn.style.display = 'flex';
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    async deleteImageField(urlInputId, imgId, iconId, btnId, event) {
        if (event) event.preventDefault();
        
        // Cari input file terkait untuk dibersihkan
        let fileInputId = '';
        if (urlInputId === 'f-comp-logo-url') fileInputId = 'f-comp-logo-file';
        else if (urlInputId === 'f-comp-kop-img-url') fileInputId = 'f-comp-kop-img-file';
        else if (urlInputId === 'f-comp-ttd-url') fileInputId = 'f-comp-ttd-file';
        else if (urlInputId === 'f-comp-cap-url') fileInputId = 'f-comp-cap-file';
        
        const fileInput = document.getElementById(fileInputId);
        const urlInput = document.getElementById(urlInputId);
        const url = urlInput ? urlInput.value : '';
        
        const resetUI = () => {
            if (urlInput) urlInput.value = '';
            if (fileInput) fileInput.value = '';
            
            const img = document.getElementById(imgId);
            const icon = document.getElementById(iconId);
            const btn = document.getElementById(btnId);
            
            if (img) { img.src = ''; img.style.display = 'none'; }
            if (icon) { icon.style.display = 'block'; }
            if (btn) { btn.style.display = 'none'; }
        };
        
        if (url) {
            Modal.confirm('Hapus Berkas', 'Yakin ingin menghapus berkas ini secara permanen dari Supabase Storage?', async () => {
                try {
                    Toast.info('Menghapus berkas dari cloud storage...');
                    await API.deleteFile(url);
                    resetUI();
                    Toast.success('Berkas berhasil dihapus secara permanen dari cloud!');
                } catch (err) {
                    Toast.error('Gagal menghapus berkas: ' + err.message);
                }
            });
        } else {
            // Berkas baru dipilih secara lokal tetapi belum diupload ke cloud
            resetUI();
            Toast.info('Pilihan berkas lokal dihapus.');
        }
    },

    async save(id) {
        const btn = document.querySelector('#modal-footer .btn-primary');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...'; }

        try {
            // Upload images if selected
            const logoFile = document.getElementById('f-comp-logo-file')?.files?.[0];
            if (logoFile) {
                const res = await API.uploadFile(logoFile, 'companies');
                document.getElementById('f-comp-logo-url').value = res.url;
            }
            const kopImgFile = document.getElementById('f-comp-kop-img-file')?.files?.[0];
            if (kopImgFile) {
                const res = await API.uploadFile(kopImgFile, 'companies');
                document.getElementById('f-comp-kop-img-url').value = res.url;
            }
            const ttdFile = document.getElementById('f-comp-ttd-file')?.files?.[0];
            if (ttdFile) {
                const res = await API.uploadFile(ttdFile, 'companies');
                document.getElementById('f-comp-ttd-url').value = res.url;
            }
            const capFile = document.getElementById('f-comp-cap-file')?.files?.[0];
            if (capFile) {
                const res = await API.uploadFile(capFile, 'companies');
                document.getElementById('f-comp-cap-url').value = res.url;
            }

            const data = {
                nama_perusahaan: document.getElementById('f-comp-nama').value.trim(),
                singkatan: document.getElementById('f-comp-singkatan').value.trim() || null,
                direktur: document.getElementById('f-comp-direktur').value.trim() || null,
                npwp_usaha: document.getElementById('f-comp-npwp').value.trim() || null,
                npwp_direktur: document.getElementById('f-comp-npwp-dir').value.trim() || null,
                email: document.getElementById('f-comp-email').value.trim() || null,
                no_hp: document.getElementById('f-comp-hp').value.trim() || null,
                website: document.getElementById('f-comp-web').value.trim() || null,
                kbli: document.getElementById('f-comp-kbli').value.trim() || null,
                alamat: document.getElementById('f-comp-alamat').value.trim() || null,
                kota: document.getElementById('f-comp-kota').value.trim() || null,
                provinsi: document.getElementById('f-comp-prov').value.trim() || null,
                foto_logo_url: document.getElementById('f-comp-logo-url')?.value || null,
                ttd_image_url: document.getElementById('f-comp-ttd-url')?.value || null,
                cap_image_url: document.getElementById('f-comp-cap-url')?.value || null,
                kop_is_image: document.getElementById('f-comp-kop-is-image')?.checked || false,
                kop_image_url: document.getElementById('f-comp-kop-img-url')?.value || null,
                kop_nama: document.getElementById('f-comp-kop-nama')?.value?.trim() || null,
                kop_alamat: document.getElementById('f-comp-kop-alamat')?.value?.trim() || null,
                kop_kontak: document.getElementById('f-comp-kop-kontak')?.value?.trim() || null,
                attachments: (() => {
                    const val = document.getElementById('f-comp-attachments-data')?.value || '[]';
                    let atts = val;
                    if (typeof atts === 'string') {
                        try { atts = JSON.parse(atts); } catch(e) { atts = []; }
                    }
                    if (typeof atts === 'string') {
                        try { atts = JSON.parse(atts); } catch(e) { atts = []; }
                    }
                    return Array.isArray(atts) ? atts : [];
                })()
            };

            if (!data.nama_perusahaan) { throw new Error('Nama perusahaan wajib diisi'); }

            if (id) { await API.updateCompany(id, data); Toast.success('Perusahaan diperbarui'); }
            else { await API.createCompany(data); Toast.success('Perusahaan baru ditambahkan'); }

            Modal.close();
            this.loadData();
        } catch (err) {
            Toast.error(err.message);
            if (btn) { btn.disabled = false; btn.innerHTML = 'Simpan'; }
        }
    },

    remove(id) {
        Modal.confirm('Hapus Perusahaan', 'Yakin ingin menghapus perusahaan ini?', async () => {
            try {
                await API.deleteCompany(id);
                Toast.success('Perusahaan berhasil dihapus');
                this.loadData();
            } catch (e) { Toast.error(e.message); }
        });
    }
};
