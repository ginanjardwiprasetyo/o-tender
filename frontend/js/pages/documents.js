/**
 * TenderBuild — Documents Page (Surat & Template)
 */
const DocumentsPage = {
    letters: [],
    companies: [],
    templates: [],
    personnel: [],
    equipments: [],

    async render() {
        return `
        <div class="page-header">
            <div>
                <h2>Surat & Dokumen</h2>
                <p>Generator nomor surat otomatis dan manajemen dokumen perusahaan</p>
            </div>
            <button class="btn btn-primary" onclick="DocumentsPage.openForm()"><i data-lucide="plus"></i> Buat Surat Baru</button>
        </div>
        
        <div class="toolbar" style="flex-wrap:wrap;">
            <div class="search-box" style="min-width:200px;">
                <i data-lucide="search"></i>
                <input type="text" id="doc-search" placeholder="Nomor atau perihal..." oninput="DocumentsPage.debounceSearch()">
            </div>
            <select class="form-select" id="doc-filter-comp" onchange="DocumentsPage.loadData()" style="width:200px;padding:9px 36px 9px 14px;">
                <option value="">Semua Perusahaan</option>
            </select>
            <select class="form-select" id="doc-filter-tahun" onchange="DocumentsPage.loadData()" style="width:120px;padding:9px 36px 9px 14px;">
                <option value="2026" selected>2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
            </select>
        </div>

        <div id="doc-list"></div>
        `;
    },

    async afterRender() {
        // Load companies, templates, and personnel for select
        try {
            const [compRes, tplRes, persRes, eqRes] = await Promise.all([
                API.getCompanies(),
                API.getTemplates(),
                API.getPersonnel(),
                API.getEquipments()
            ]);
            
            this.companies = compRes.data || [];
            this.templates = tplRes.data || [];
            this.personnel = persRes.data || [];
            this.equipments = eqRes.data || [];
            
            const filterSelect = document.getElementById('doc-filter-comp');
            const opts = this.companies.map(c => `<option value="${c.id}">${Fmt.escape(c.nama_perusahaan)}</option>`).join('');
            if (filterSelect) filterSelect.innerHTML += opts;
        } catch(e) {
            console.error('Failed to load data for docs', e);
        }

        this.loadData();
    },

    debounceTimer: null,
    debounceSearch() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.loadData(), 400);
    },

    async loadData() {
        const el = document.getElementById('doc-list');
        if (!el) return;
        el.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        
        try {
            const search = document.getElementById('doc-search')?.value || '';
            const company_id = document.getElementById('doc-filter-comp')?.value || '';
            const tahun = document.getElementById('doc-filter-tahun')?.value || '';

            const res = await API.getLetters({ search, company_id, tahun });
            this.letters = res.data || [];
            this.renderList();
        } catch(e) {
            el.innerHTML = `<div class="empty-state"><i data-lucide="file-text"></i><p>Gagal memuat surat: ${e.message}</p></div>`;
            lucide.createIcons();
        }
    },

    renderList() {
        const el = document.getElementById('doc-list');
        if (!el) return;
        if (!this.letters.length) {
            el.innerHTML = `<div class="empty-state"><i data-lucide="file-text"></i><p>Belum ada data surat.</p><p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">Klik <strong>Buat Surat Baru</strong> untuk membuat nomor surat otomatis.</p></div>`;
            lucide.createIcons();
            return;
        }

        const rows = this.letters.map((l, i) => `
        <tr>
            <td style="color:var(--text-muted);text-align:center;">${i + 1}</td>
            <td>
                <div style="font-weight:700;color:var(--accent);font-size:0.95rem;line-height:1.4;">${Fmt.escape(l.nomor_surat)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">
                    ${Fmt.escape(l.singkatan || l.nama_perusahaan || '')}
                </div>
            </td>
            <td>${l.tanggal ? Fmt.date(l.tanggal) : '-'}</td>
            <td>${Fmt.escape(l.perihal || '-')}</td>
            <td style="text-align:center;">
                <button class="btn btn-danger btn-sm btn-icon" onclick="DocumentsPage.remove('${l.id}')"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>
        `).join('');

        el.innerHTML = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th width="50" style="text-align:center;">No</th>
                        <th width="280">Nomor Surat</th>
                        <th width="150">Tanggal</th>
                        <th>Perihal</th>
                        <th width="60" style="text-align:center;">Aksi</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
        lucide.createIcons();
    },

    openForm() {
        const compOpts = this.companies.map(c => `<option value="${c.id}">${Fmt.escape(c.nama_perusahaan)}</option>`).join('');
        const tplOpts = this.templates.map(t => `<option value="${t.id}">${Fmt.escape(t.nama_template)}</option>`).join('');
        const persOpts = this.personnel.map(p => `<option value="${p.id}">${Fmt.escape(p.nama)}</option>`).join('');
        const eqOpts = this.equipments.map(e => `<option value="${e.id}">${Fmt.escape(e.jenis)} - ${Fmt.escape(e.merk_type || '')}</option>`).join('');
        const today = new Date().toISOString().split('T')[0];
        
        const body = `
        <div class="form-row">
            <div class="form-group"><label class="form-label">Perusahaan Pengirim <span style="color:var(--danger);">*</span></label>
                <select class="form-select" id="f-doc-comp" onchange="DocumentsPage.onCompanyChange()" required>
                    <option value="">-- Pilih Perusahaan --</option>
                    ${compOpts}
                </select>
            </div>
            <div class="form-group"><label class="form-label">Pilih Template (Bisa >1)</label>
                <select class="form-select" id="f-doc-templates" multiple size="4" onchange="DocumentsPage.onTemplatesChange()" style="height:auto;">
                    ${tplOpts}
                </select>
                <small style="color:var(--text-muted);">Tahan Ctrl/Cmd untuk pilih banyak</small>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Pilih Peralatan Pendukung (Bisa >1)</label>
            <select class="form-select" id="f-doc-equipments" multiple size="3" onchange="DocumentsPage.renderAttachments()" style="height:auto;">
                ${eqOpts}
            </select>
        </div>

        <div style="border-top:1px dashed var(--border-color); margin:16px 0; padding-top:16px;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px;">Data Surat</div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Kode Surat <span style="color:var(--danger);">*</span></label>
                    <div style="display:flex; gap:8px;">
                        <input type="text" class="form-input" id="f-doc-kode" placeholder="SK, SP, ST" style="text-transform:uppercase; flex:1;">
                        <button type="button" class="btn btn-secondary" id="doc-cek-btn" onclick="DocumentsPage.checkNumber()"><i data-lucide="hash"></i> Gen No.</button>
                    </div>
                </div>
                <div class="form-group"><label class="form-label">Tanggal Surat <span style="color:var(--danger);">*</span></label>
                    <input type="date" class="form-input" id="f-doc-tgl" value="${today}">
                </div>
            </div>
            
            <div id="doc-preview-box" class="hidden" style="margin-bottom:12px; padding:12px; background:rgba(14, 165, 233, 0.05); border:1px solid rgba(14, 165, 233, 0.2); border-radius:var(--radius-md);">
                <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Nomor Surat Tergenerate:</span>
                <span id="doc-preview-num" style="font-weight:700; font-size:1rem; color:var(--accent); margin-left:8px;"></span>
            </div>

            <div class="form-group"><label class="form-label">Perihal <span style="color:var(--danger);">*</span></label>
                <input type="text" class="form-input" id="f-doc-perihal" placeholder="Perihal surat...">
            </div>
            <div class="form-group"><label class="form-label">Lampiran</label>
                <input type="text" class="form-input" id="f-doc-lampiran" value="-" placeholder="1 (Satu) Berkas">
            </div>
        </div>

        <div style="border-top:1px dashed var(--border-color); margin:16px 0; padding-top:16px;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px;">Penandatangan & Personil</div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Penandatangan 1 (Pihak 1/Direktur) <span style="color:var(--danger);">*</span></label>
                    <select class="form-select" id="f-doc-ttd1-type">
                        <option value="direktur">Direktur Perusahaan (dari Data Perusahaan)</option>
                    </select>
                </div>
                <div class="form-group"><label class="form-label">Penandatangan 2 (Pihak 2/Personil)</label>
                    <select class="form-select" id="f-doc-ttd2" onchange="DocumentsPage.renderAttachments()">
                        <option value="">-- Tidak Ada / Kosong --</option>
                        ${persOpts}
                    </select>
                </div>
            </div>
        </div>

        <div id="doc-dynamic-vars-section" style="display:none; border-top:1px dashed var(--border-color); margin:16px 0; padding-top:16px;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px;">Variabel Tambahan Template</div>
            <div id="doc-dynamic-vars-container" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"></div>
        </div>

        <div id="doc-attachments-section" style="display:none; border-top:1px dashed var(--border-color); margin:16px 0; padding-top:16px;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px;">Sertakan Lampiran Dokumen</div>
            <div id="doc-attachments-container"></div>
        </div>
        `;
        
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Batal</button>
            <button class="btn btn-primary" id="doc-save-btn" onclick="DocumentsPage.generateDocument()">Generate & Simpan Surat</button>`;
        
        Modal.open('Buat Dokumen Surat', body, footer);
        
        // Large modal style
        const modalEl = document.querySelector('.modal');
        if(modalEl) { modalEl.style.maxWidth = '800px'; modalEl.style.width = '90%'; }
        
        lucide.createIcons();
    },

    _genData: null,

    onCompanyChange() {
        this.renderAttachments();
    },

    renderAttachments() {
        const compId = document.getElementById('f-doc-comp')?.value;
        const persId = document.getElementById('f-doc-ttd2')?.value;
        const eqIds = Array.from(document.getElementById('f-doc-equipments')?.selectedOptions || []).map(o => o.value);
        
        const comp = this.companies.find(c => c.id === compId);
        const pers = this.personnel.find(p => p.id === persId);
        const selectedEqs = this.equipments.filter(e => eqIds.includes(e.id));
        
        let allAtts = [];
        
        if (comp && comp.attachments) {
            allAtts = allAtts.concat(comp.attachments.map(a => ({ ...a, group: 'Perusahaan' })));
        }
        
        if (pers) {
            if (pers.file_ktp) allAtts.push({ name: 'KTP - ' + pers.nama, url: pers.file_ktp, group: 'Personil' });
            if (pers.file_npwp) allAtts.push({ name: 'NPWP - ' + pers.nama, url: pers.file_npwp, group: 'Personil' });
            if (pers.file_ijazah_url) allAtts.push({ name: 'Ijazah - ' + pers.nama, url: pers.file_ijazah_url, group: 'Personil' });
            if (pers.file_ska_url) allAtts.push({ name: 'SKA/SKT - ' + pers.nama, url: pers.file_ska_url, group: 'Personil' });
        }

        selectedEqs.forEach(eq => {
            if (eq.file_url) {
                allAtts.push({ name: 'Dokumen Alat - ' + eq.jenis, url: eq.file_url, group: 'Peralatan' });
            }
        });
        
        const attContainer = document.getElementById('doc-attachments-container');
        const attSection = document.getElementById('doc-attachments-section');
        
        if (allAtts.length === 0) {
            attSection.style.display = 'none';
            attContainer.innerHTML = '';
            return;
        }
        
        attSection.style.display = 'block';
        attContainer.innerHTML = allAtts.map((att, i) => `
            <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; cursor:pointer; padding:8px; background:var(--bg-secondary); border-radius:6px;">
                <input type="checkbox" class="doc-attachment-cb" value='${Fmt.escape(JSON.stringify(att))}'>
                <i data-lucide="file-text" style="width:16px; height:16px; color:var(--accent);"></i>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-size:0.85rem; font-weight:500;">${Fmt.escape(att.name)}</span>
                    <span style="font-size:0.65rem; color:var(--text-muted);">${att.group}</span>
                </div>
            </label>
        `).join('');
        lucide.createIcons();
    },

    onTemplatesChange() {
        const select = document.getElementById('f-doc-templates');
        const selectedIds = Array.from(select.selectedOptions).map(opt => opt.value);
        
        let allVars = new Set();
        selectedIds.forEach(id => {
            const t = this.templates.find(x => x.id === id);
            if (t && t.html_content) {
                // Extract all {{variable}}
                const matches = t.html_content.match(/\{\{([^}]+)\}\}/g);
                if (matches) {
                    matches.forEach(m => {
                        const vName = m.replace(/[{}]/g, '').trim();
                        // Filter out standard variables that we fill automatically
                        const standardVars = ['header_surat', 'nomor_surat', 'perihal', 'lampiran', 'tanggal_surat', 'kota_perusahaan', 'nama_perusahaan', 'direktur', 'ttd_direktur', 'ttd_personil', 'cap_perusahaan'];
                        if (!standardVars.includes(vName)) {
                            allVars.add(vName);
                        }
                    });
                }
            }
        });

        const varSection = document.getElementById('doc-dynamic-vars-section');
        const varContainer = document.getElementById('doc-dynamic-vars-container');
        
        if (allVars.size === 0) {
            varSection.style.display = 'none';
            varContainer.innerHTML = '';
            return;
        }

        varSection.style.display = 'block';
        varContainer.innerHTML = Array.from(allVars).map(vName => `
            <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" style="text-transform:capitalize;">${Fmt.escape(vName.replace(/_/g, ' '))}</label>
                <input type="text" class="form-input doc-dynamic-var" data-var="${Fmt.escape(vName)}" placeholder="Isi ${Fmt.escape(vName)}...">
            </div>
        `).join('');
    },

    async generateDocument() {
        const compId = document.getElementById('f-doc-comp')?.value;
        const tgl = document.getElementById('f-doc-tgl')?.value;
        const kode = document.getElementById('f-doc-kode')?.value?.toUpperCase().trim();
        const perihal = document.getElementById('f-doc-perihal')?.value?.trim();
        const lampiran = document.getElementById('f-doc-lampiran')?.value?.trim() || '-';
        
        const templateIds = Array.from(document.getElementById('f-doc-templates').selectedOptions).map(o => o.value);
        const persId = document.getElementById('f-doc-ttd2')?.value;
        
        if (!compId || templateIds.length === 0 || !perihal) {
            Toast.warning('Pilih Perusahaan, Template, dan isi Perihal');
            return;
        }

        // If no generated number yet, we can't save the letter properly, or we can just gen one if Kode is filled
        let generatedNo = this._genData ? this._genData.nomor_surat : null;
        let nomorUrut = this._genData ? this._genData.nomor_urut : 0;
        let bln = this._genData ? this._genData.bulan : new Date(tgl).getMonth() + 1;
        let thn = this._genData ? this._genData.tahun : new Date(tgl).getFullYear();

        if (!generatedNo && kode) {
            try {
                const res = await API.getNextLetterNumber(compId, kode, thn);
                generatedNo = res.data.nomor_surat;
                nomorUrut = res.data.nomor_urut;
                bln = res.data.bulan;
                thn = res.data.tahun;
            } catch(e) {
                Toast.error('Gagal generate nomor otomatis: ' + e.message);
                return;
            }
        }

        const btn = document.getElementById('doc-save-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Generate...'; }

        try {
            // Collect dynamic vars
            const dynamicVars = {};
            document.querySelectorAll('.doc-dynamic-var').forEach(input => {
                dynamicVars[input.getAttribute('data-var')] = input.value;
            });

            // Save letter record
            const letterData = {
                company_id: compId,
                nomor_urut: nomorUrut,
                kode_surat: kode || 'DOC',
                bulan: bln,
                tahun: thn,
                nomor_surat: generatedNo || '-',
                tanggal: tgl,
                perihal: perihal,
                konten: JSON.stringify({ templates: templateIds, variables: dynamicVars, personnel: persId })
            };
            await API.createLetter(letterData);
            
            // Build the HTML for printing
            this.buildAndPrint(compId, templateIds, persId, {
                nomor_surat: generatedNo || '-',
                perihal,
                lampiran,
                tanggal: tgl,
                ...dynamicVars
            });

            Toast.success('Dokumen berhasil digenerate dan disimpan!');
            this._genData = null;
            Modal.close();
            this.loadData();
        } catch(err) {
            Toast.error(err.message);
            if (btn) { btn.disabled = false; btn.innerHTML = 'Generate & Simpan Surat'; }
        }
    },

    buildAndPrint(compId, templateIds, persId, vars) {
        const comp = this.companies.find(c => c.id === compId);
        const pers = this.personnel.find(p => p.id === persId);
        
        // Prepare standard variables
        const kota = comp?.kota || '';
        const tglFormat = vars.tanggal ? Fmt.date(vars.tanggal) : '';
        const tglSurat = kota ? `${kota}, ${tglFormat}` : tglFormat;
        
        const headerSurat = `
            <table style="width:100%; max-width:500px; margin-bottom:20px;">
                <tr><td style="width:80px; vertical-align:top;">Nomor</td><td style="width:10px; vertical-align:top;">:</td><td>${Fmt.escape(vars.nomor_surat)}</td></tr>
                <tr><td style="vertical-align:top;">Lampiran</td><td style="vertical-align:top;">:</td><td>${Fmt.escape(vars.lampiran)}</td></tr>
                <tr><td style="vertical-align:top;">Perihal</td><td style="vertical-align:top;">:</td><td><strong>${Fmt.escape(vars.perihal)}</strong></td></tr>
            </table>
        `;

        // TTD blocks
        const imgCap = comp?.cap_image_url ? `<img src="${Fmt.url(comp.cap_image_url)}" style="position:absolute; left:-20px; top:20px; max-width:100px; opacity:0.8; z-index:-1;">` : '';
        const imgTtdDir = comp?.ttd_image_url ? `<img src="${Fmt.url(comp.ttd_image_url)}" style="max-height:80px; position:relative; z-index:1;">` : '<br><br><br>';
        
        const ttdDirektur = `
            <div style="text-align:center; position:relative; display:inline-block;">
                ${imgCap}
                <div style="margin-bottom:10px;"><strong>${Fmt.escape(comp?.nama_perusahaan || 'Perusahaan')}</strong></div>
                ${imgTtdDir}
                <div style="margin-top:10px; font-weight:bold; text-decoration:underline;">${Fmt.escape(comp?.direktur || 'Nama Direktur')}</div>
                <div>Direktur</div>
            </div>
        `;
        
        let ttdPersonil = '';
        if (pers) {
            ttdPersonil = `
                <div style="text-align:center; display:inline-block;">
                    <div style="margin-bottom:10px;"><strong>Pelaksana</strong></div>
                    <br><br><br>
                    <div style="margin-top:10px; font-weight:bold; text-decoration:underline;">${Fmt.escape(pers.nama)}</div>
                    <div>${Fmt.escape(pers.jabatan || 'Personil')}</div>
                </div>
            `;
        }
        
        // Gabungan
        const ttdGabungan = `
            <table style="width:100%; margin-top:40px;">
                <tr>
                    <td style="width:50%; text-align:center; vertical-align:bottom;">${ttdPersonil}</td>
                    <td style="width:50%; text-align:center; vertical-align:bottom;">${ttdDirektur}</td>
                </tr>
            </table>
        `;

        // Kop Surat
        let kopHtml = '';
        if (comp) {
            if (comp.kop_is_image && comp.kop_image_url) {
                kopHtml = `<img src="${Fmt.url(comp.kop_image_url)}" style="width:100%; max-height:150px; object-fit:contain; margin-bottom:20px; border-bottom:3px solid black; padding-bottom:10px;">`;
            } else {
                kopHtml = `
                    <div style="text-align:center; margin-bottom:20px; border-bottom:3px solid black; padding-bottom:10px;">
                        <h2 style="margin:0; font-size:24px;">${Fmt.escape(comp.kop_nama || comp.nama_perusahaan)}</h2>
                        <p style="margin:5px 0;">${Fmt.escape(comp.kop_alamat || comp.alamat || '')}</p>
                        <p style="margin:0; font-size:12px;">${Fmt.escape(comp.kop_kontak || '')}</p>
                    </div>
                `;
            }
        }

        // Selected Attachments
        const selectedAtts = Array.from(document.querySelectorAll('.doc-attachment-cb:checked')).map(cb => JSON.parse(cb.value));

        // Compile full HTML
        let fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${Fmt.escape(vars.nomor_surat)}</title>
            <style>
                @page { size: A4; margin: 20mm; }
                body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; color: black; }
                .page-break { page-break-after: always; }
                .doc-page { position: relative; min-height: 250mm; }
                .attachment-page { display: flex; align-items: center; justify-content: center; height: 100vh; }
                .attachment-img { max-width: 100%; max-height: 100%; object-fit: contain; }
                * { box-sizing: border-box; }
            </style>
        </head>
        <body>
        `;

        templateIds.forEach((tId, idx) => {
            const t = this.templates.find(x => x.id === tId);
            if (!t) return;
            
            let content = t.html_content || '';
            
            // Replace vars
            content = content.replace(/\{\{header_surat\}\}/g, headerSurat);
            content = content.replace(/\{\{tanggal_surat\}\}/g, tglSurat);
            content = content.replace(/\{\{kota_perusahaan\}\}/g, Fmt.escape(kota));
            content = content.replace(/\{\{nama_perusahaan\}\}/g, Fmt.escape(comp?.nama_perusahaan || ''));
            content = content.replace(/\{\{direktur\}\}/g, Fmt.escape(comp?.direktur || ''));
            content = content.replace(/\{\{ttd_direktur\}\}/g, ttdDirektur);
            content = content.replace(/\{\{ttd_personil\}\}/g, ttdPersonil);
            content = content.replace(/\{\{ttd_gabungan\}\}/g, ttdGabungan);
            
            // Custom vars
            Object.keys(vars).forEach(k => {
                content = content.replace(new RegExp(`\\\\{\\\\{ ?${k} ?\\\\}\\\\}`, 'g'), Fmt.escape(vars[k]));
            });

            // Replace any un-filled vars with empty space
            content = content.replace(/\{\{[^}]+\}\}/g, '.........');

            fullHtml += `<div class="doc-page">${kopHtml}${content}</div>`;
            
            // Page break except for last item if no attachments
            if (idx < templateIds.length - 1 || selectedAtts.length > 0) {
                fullHtml += '<div class="page-break"></div>';
            }
        });

        // Add attachments
        selectedAtts.forEach((att, idx) => {
            // We can only reliably print images in the browser
            if (att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                fullHtml += `<div class="attachment-page"><img src="${Fmt.url(att.url)}" class="attachment-img"></div>`;
                if (idx < selectedAtts.length - 1) fullHtml += '<div class="page-break"></div>';
            } else {
                fullHtml += `<div class="attachment-page"><h3>Lampiran Dokumen PDF: ${Fmt.escape(att.name)}</h3><p><em>(Harap gabungkan file PDF ini secara manual: ${Fmt.url(att.url)})</em></p></div>`;
                if (idx < selectedAtts.length - 1) fullHtml += '<div class="page-break"></div>';
            }
        });

        fullHtml += '</body></html>';

        // Open in new window to print
        const printWin = window.open('', '_blank');
        printWin.document.open();
        printWin.document.write(fullHtml);
        printWin.document.close();
        
        // Wait for images to load before printing
        setTimeout(() => {
            printWin.focus();
            printWin.print();
        }, 500);
    },

    remove(id) {
        Modal.confirm('Hapus Surat', 'Hapus dokumen surat ini? Nomor urut tidak akan berubah.', async () => {
            try {
                await API.deleteLetter(id);
                Toast.success('Surat dihapus');
                this.loadData();
            } catch(e) { Toast.error(e.message); }
        });
    }
};
