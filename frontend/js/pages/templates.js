/**
 * TenderBuild — Document Templates Page
 */
const TemplatesPage = {
    templates: [],

    async render() {
        return `
        <div class="page-header">
            <div><h2>Template Dokumen</h2><p>Kelola format kop surat, narasi, tanda tangan, dan layout dokumen</p></div>
            <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary" onclick="TemplatesPage.seedDefaultTemplates()"><i data-lucide="sparkles"></i> Muat Template Standar Tender</button>
                <button class="btn btn-primary" onclick="TemplatesPage.openEditor()"><i data-lucide="plus"></i> Buat Template</button>
            </div>
        </div>
        <div id="tpl-list"><div class="page-loading"><div class="spinner"></div></div></div>`;
    },

    async afterRender() { this.loadData(); },

    async loadData() {
        const el = document.getElementById('tpl-list');
        if (!el) return;
        try {
            const res = await API.getTemplates();
            this.templates = res.data || [];
            this.renderList();
        } catch (e) {
            el.innerHTML = '<div class="empty-state"><i data-lucide="layout"></i><p>Gagal memuat template</p></div>';
            lucide.createIcons();
        }
    },

    async seedDefaultTemplates() {
        Modal.confirm('Muat Template Standar', 'Apakah Anda ingin menambahkan 7 template standar dokumen penawaran tender (Surat Penawaran, Pakta Integritas, K3/RKK, Kebenaran Dokumen, SKP, Personil, Peralatan)?', async () => {
            try {
                const res = await API.seedTemplates();
                Toast.success(res.message || 'Template standar berhasil ditambahkan!');
                this.loadData();
            } catch (e) {
                Toast.error('Gagal memuat template standar: ' + e.message);
            }
        });
    },

    renderList() {
        const el = document.getElementById('tpl-list');
        if (!el) return;
        if (!this.templates.length) {
            el.innerHTML = `<div class="empty-state">
                <div style="width:64px;height:64px;border-radius:16px;background:rgba(59,130,246,0.1);color:var(--accent);display:flex;align-items:center;justify-content:center;margin:0 auto 16px auto;">
                    <i data-lucide="layout-template" style="width:32px;height:32px;"></i>
                </div>
                <h3>Belum Ada Template</h3>
                <p style="max-width:440px;margin:8px auto 20px auto;">Buat template baru atau gunakan tombol di bawah untuk memuat 7 template standar tender konstruksi (Penawaran, Pakta Integritas, RKK, Kebenaran Dokumen, SKP, Personil, Peralatan).</p>
                <div style="display:flex; gap:12px; justify-content:center;">
                    <button class="btn btn-secondary" onclick="TemplatesPage.seedDefaultTemplates()"><i data-lucide="sparkles"></i> Muat Template Standar Tender</button>
                    <button class="btn btn-primary" onclick="TemplatesPage.openEditor()"><i data-lucide="plus"></i> Buat Template Manual</button>
                </div>
            </div>`;
            lucide.createIcons(); return;
        }

        el.innerHTML = this.templates.map(t => `
        <div class="card" style="margin-bottom:12px; padding:16px 20px; cursor:pointer;" onclick="TemplatesPage.openEditor('${t.id}')">
            <div style="display:flex; align-items:center; gap:16px; justify-content:space-between; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:0;">
                    <div style="width:48px; height:48px; border-radius:var(--radius-md); background:rgba(59,130,246,0.1); color:var(--accent); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i data-lucide="file-text"></i>
                    </div>
                    <div style="min-width:0;">
                        <div style="font-weight:600; font-size:0.95rem;">${Fmt.escape(t.nama_template)}</div>
                        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">
                            ${t.kategori ? '<span class="badge badge-info">' + Fmt.escape(t.kategori) + '</span> • ' : ''}
                            Ukuran Kertas: ${t.paper_size || 'A4'} • Margin: ${t.margin_top || 25}mm
                        </div>
                    </div>
                </div>
                <div class="table-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-secondary btn-sm" onclick="TemplatesPage.preview('${t.id}')"><i data-lucide="eye"></i> Preview</button>
                    <button class="btn btn-secondary btn-icon btn-sm" onclick="TemplatesPage.openEditor('${t.id}')" title="Edit"><i data-lucide="pencil"></i></button>
                    <button class="btn btn-danger btn-icon btn-sm" onclick="TemplatesPage.remove('${t.id}')" title="Hapus"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        </div>`).join('');
        lucide.createIcons();
    },

    // ─── VARIABLES ────────────────────────────────────
    VARS: [
        { key: '{{nama_perusahaan}}', label: 'Nama Perusahaan' },
        { key: '{{singkatan}}', label: 'Singkatan Perusahaan' },
        { key: '{{direktur}}', label: 'Direktur Perusahaan' },
        { key: '{{kota_perusahaan}}', label: 'Kota/Kab Perusahaan' },
        { key: '{{alamat}}', label: 'Alamat Perusahaan' },
        { key: '{{npwp}}', label: 'NPWP Perusahaan' },
        { key: '{{nama_paket}}', label: 'Nama Paket Tender' },
        { key: '{{kode_tender}}', label: 'Kode Tender' },
        { key: '{{nilai_pagu}}', label: 'Nilai Pagu' },
        { key: '{{nilai_hps}}', label: 'Nilai HPS' },
        { key: '{{terbilang}}', label: 'Terbilang (Rupiah)' },
        { key: '{{instansi}}', label: 'Instansi/KLPD' },
        { key: '{{pokja}}', label: 'Nama Pokja Pemilihan' },
        { key: '{{lokasi}}', label: 'Lokasi Pekerjaan' },
        { key: '{{jangka_waktu}}', label: 'Jangka Waktu (hari)' },
        { key: '{{header_surat}}', label: 'Header Surat (No, Lamp, Hal)' },
        { key: '{{nomor_surat}}', label: 'Nomor Surat' },
        { key: '{{tanggal_surat}}', label: 'Tanggal Surat (Kota, tgl)' },
        { key: '{{perihal}}', label: 'Perihal' },
        { key: '{{lampiran}}', label: 'Lampiran' },
        { key: '{{nama_personil}}', label: 'Nama Personil Pelaksana' },
        { key: '{{jabatan_personil}}', label: 'Jabatan Personil' },
        { key: '{{ttd_gabungan}}', label: 'TTD Pihak 1 & 2 (Bersampingan)' },
        { key: '{{ttd_direktur}}', label: 'TTD Direktur Saja' },
        { key: '{{ttd_personil}}', label: 'TTD Personil Saja' },
    ],

    // ─── EDITOR ───────────────────────────────────────
    async openEditor(id) {
        let t = {};
        if (id) {
            try {
                const res = await API.request(`/templates/${id}`);
                t = res.data;
            } catch (e) { Toast.error(e.message); return; }
        }

        const title = id ? 'Edit Template' : 'Buat Template Baru';
        const varChips = this.VARS.map(v =>
            `<span class="badge badge-info" style="cursor:pointer; margin:2px;" onclick="TemplatesPage.insertVar('${v.key}')" title="${v.label}">${v.key}</span>`
        ).join('');

        const body = `
        <div style="max-height:75vh; overflow-y:auto; padding-right:8px;">
            <!-- Info Dasar -->
            <div class="form-row">
                <div class="form-group"><label class="form-label">Nama Template <span style="color:var(--danger)">*</span></label>
                    <input class="form-input" id="tpl-nama" value="${Fmt.escape(t.nama_template || '')}" placeholder="Surat Penawaran, Pakta Integritas, dll.">
                </div>
                <div class="form-group"><label class="form-label">Kategori</label>
                    <select class="form-select" id="tpl-kategori">
                        ${['', 'Penawaran', 'Pernyataan', 'Dukungan', 'Administrasi', 'Lainnya'].map(v =>
                            `<option ${t.kategori === v ? 'selected' : ''}>${v || '-- Pilih --'}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- NARASI -->
            <div style="border:1px solid var(--border-color); border-radius:var(--radius-md); padding:16px; margin-bottom:16px; background:var(--bg-secondary);">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i data-lucide="align-left" style="width:16px; height:16px; color:var(--accent);"></i>
                        <span style="font-weight:700; font-size:0.9rem;">Narasi / Isi Surat (HTML / Teks)</span>
                    </div>
                    <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer;" title="Mengecilkan font agar muat dalam satu halaman">
                        <input type="checkbox" id="tpl-fit-layout" ${t.fit_layout ? 'checked' : ''}> Mampatkan Narasi (Fit to Layout)
                    </label>
                </div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px;">Klik tag variabel di bawah untuk menyisipkan ke dalam isi surat:</p>
                <div style="margin-bottom:10px; display:flex; flex-wrap:wrap; gap:3px;">${varChips}</div>
                
                <div style="display:grid; grid-template-columns:1fr; gap:12px;">
                    <div>
                        <textarea class="form-textarea" id="tpl-narasi" rows="12" style="font-family:monospace; font-size:0.85rem;" oninput="TemplatesPage.updateLiveEditorPreview()" placeholder="Ketik isi surat di sini...">${Fmt.escape(t.html_content || '')}</textarea>
                    </div>
                    <div>
                        <div style="font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Live Preview Tampilan:</div>
                        <div id="tpl-live-preview" style="background:white; color:#000; padding:16px; border:1px solid var(--border-color); border-radius:6px; min-height:150px; max-height:250px; overflow-y:auto; font-family:'Times New Roman', serif; font-size:11pt; line-height:1.4; text-align:justify;"></div>
                    </div>
                </div>
            </div>

            <!-- LAYOUT -->
            <div style="border:1px solid var(--border-color); border-radius:var(--radius-md); padding:16px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                    <i data-lucide="ruler" style="width:16px; height:16px; color:var(--accent);"></i>
                    <span style="font-weight:700; font-size:0.9rem;">Layout Halaman & Margin Paper</span>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Ukuran Kertas</label>
                        <select class="form-select" id="tpl-paper">
                            <option ${(t.paper_size || 'A4') === 'A4' ? 'selected' : ''}>A4</option>
                            <option ${t.paper_size === 'F4' ? 'selected' : ''}>F4</option>
                        </select>
                    </div>
                    <div class="form-group"><label class="form-label">Margin Atas (mm)</label>
                        <input type="number" class="form-input" id="tpl-mt" value="${t.margin_top ?? 25}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Margin Kiri (mm)</label>
                        <input type="number" class="form-input" id="tpl-ml" value="${t.margin_left ?? 30}">
                    </div>
                    <div class="form-group"><label class="form-label">Margin Kanan (mm)</label>
                        <input type="number" class="form-input" id="tpl-mr" value="${t.margin_right ?? 25}">
                    </div>
                </div>
                <div class="form-group"><label class="form-label">Margin Bawah (mm)</label>
                    <input type="number" class="form-input" id="tpl-mb" value="${t.margin_bottom ?? 25}" style="max-width:200px;">
                </div>
            </div>
        </div>`;

        const footer = `
            <button class="btn btn-secondary" onclick="TemplatesPage.preview(null, true)"><i data-lucide="eye"></i> Preview Layar Penuh</button>
            <button class="btn btn-secondary" onclick="Modal.close()">Batal</button>
            <button class="btn btn-primary" onclick="TemplatesPage.save('${id || ''}')">Simpan Template</button>`;

        Modal.open(title, body, footer);
        const modalEl = document.getElementById('modal');
        if (modalEl) modalEl.style.maxWidth = '900px';
        lucide.createIcons();
        setTimeout(() => this.updateLiveEditorPreview(), 100);
    },

    updateLiveEditorPreview() {
        const ta = document.getElementById('tpl-narasi');
        const prev = document.getElementById('tpl-live-preview');
        if (!ta || !prev) return;
        let txt = ta.value || '<em style="color:#999;">Belum ada isi surat...</em>';
        prev.innerHTML = txt;
    },

    insertVar(varKey) {
        const ta = document.getElementById('tpl-narasi');
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const text = ta.value;
        ta.value = text.substring(0, start) + varKey + text.substring(end);
        ta.selectionStart = ta.selectionEnd = start + varKey.length;
        ta.focus();
        this.updateLiveEditorPreview();
    },

    _collectFormData() {
        return {
            nama_template: document.getElementById('tpl-nama')?.value?.trim(),
            kategori: document.getElementById('tpl-kategori')?.value || null,
            html_content: document.getElementById('tpl-narasi')?.value || '',
            fit_layout: document.getElementById('tpl-fit-layout')?.checked || false,
            paper_size: document.getElementById('tpl-paper')?.value || 'A4',
            margin_top: parseInt(document.getElementById('tpl-mt')?.value) || 25,
            margin_bottom: parseInt(document.getElementById('tpl-mb')?.value) || 25,
            margin_left: parseInt(document.getElementById('tpl-ml')?.value) || 30,
            margin_right: parseInt(document.getElementById('tpl-mr')?.value) || 25,
        };
    },

    async _uploadIfNeeded(fileInputId, hiddenInputId, category) {
        const fileInput = document.getElementById(fileInputId);
        const file = fileInput?.files?.[0];
        if (file) {
            const res = await API.uploadFile(file, category);
            const hidden = document.getElementById(hiddenInputId);
            if (hidden) hidden.value = res.url;
            return res.url;
        }
        return document.getElementById(hiddenInputId)?.value || null;
    },

    async save(id) {
        const btn = document.querySelector('#modal-footer .btn-primary');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...'; }

        try {
            const data = this._collectFormData();
            if (!data.nama_template) throw new Error('Nama template wajib diisi');

            if (id) { await API.updateTemplate(id, data); Toast.success('Template diperbarui'); }
            else { await API.createTemplate(data); Toast.success('Template baru dibuat'); }
            Modal.close();
            // Reset modal width
            const modalEl = document.getElementById('modal');
            if (modalEl) modalEl.style.maxWidth = '';
            this.loadData();
        } catch (e) {
            Toast.error(e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = 'Simpan Template'; }
        }
    },

    // ─── PREVIEW ──────────────────────────────────────
    async preview(id, fromForm) {
        let t;
        if (fromForm) {
            t = this._collectFormData();
        } else {
            try {
                const res = await API.request(`/templates/${id}`);
                t = res.data;
            } catch (e) { Toast.error(e.message); return; }
        }

        const paperW = t.paper_size === 'F4' ? '215mm' : '210mm';
        
        // Formatting fixes for variables and alignment
        let narasi = (t.html_content || '');
        
        // Header Table Solution for alignment
        const headerTable = `
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:inherit; font-family:inherit;">
            <tr><td style="width:80px; padding:2px 0; vertical-align:top;">Nomor</td><td style="width:15px; padding:2px 0; vertical-align:top;">:</td><td style="padding:2px 0; vertical-align:top;">001/SP/CV-GM/V/2026</td></tr>
            <tr><td style="padding:2px 0; vertical-align:top;">Lampiran</td><td style="padding:2px 0; vertical-align:top;">:</td><td style="padding:2px 0; vertical-align:top;">-</td></tr>
            <tr><td style="padding:2px 0; vertical-align:top;">Perihal</td><td style="padding:2px 0; vertical-align:top;">:</td><td style="padding:2px 0; vertical-align:top;">Penawaran Pekerjaan Pembangunan Jembatan Gantung</td></tr>
        </table>`;

        narasi = narasi
            .replace(/{{header_surat}}/g, headerTable)
            .replace(/{{nomor_surat}}/g, '001/SP/CV-GM/V/2026')
            .replace(/{{perihal}}/g, 'Penawaran Pekerjaan Pembangunan Jembatan Gantung')
            .replace(/{{lampiran}}/g, '-')
            .replace(/{{tanggal_surat}}/g, 'Surabaya, 15 Mei 2026')
            .replace(/{{kota_perusahaan}}/g, 'Surabaya')
            .replace(/{{nama_perusahaan}}/g, 'CV. GRAHA MITRA UTAMA')
            .replace(/{{direktur}}/g, 'Ahmad Sutojo, S.T.')
            .replace(/{{nama_paket}}/g, 'Pembangunan Jembatan Gantung')
            .replace(/{{kode_tender}}/g, '12345678')
            .replace(/{{nilai_pagu}}/g, 'Rp 1.500.000.000,00')
            .replace(/{{terbilang}}/g, 'Satu Miliar Lima Ratus Juta Rupiah')
            .replace(/\n/g, '<br>');

        const html = `
        <div style="background:#e2e8f0; padding:24px; border-radius:var(--radius-md); overflow:auto; max-height:70vh;">
            <div style="width:${paperW}; max-width:100%; margin:0 auto; background:white; box-shadow:0 4px 24px rgba(0,0,0,0.12); padding:${t.margin_top||25}mm ${t.margin_right||25}mm ${t.margin_bottom||25}mm ${t.margin_left||30}mm; font-family:'Times New Roman', serif; font-size:${t.fit_layout ? '11pt' : '12pt'}; color:#000; line-height:${t.fit_layout ? '1.3' : '1.5'}; min-height:400px;">
                <!-- KOP (Dummy for Preview) -->
                <div style="text-align:center; border-bottom:3px double #000; padding-bottom:12px; margin-bottom:20px; color:#94a3b8; border-color:#cbd5e1; font-style:italic;">
                    <div style="font-size:16pt; font-weight:bold; text-transform:uppercase;">[KOP SURAT PERUSAHAAN]</div>
                    <div style="font-size:10pt;">Alamat Perusahaan akan tampil otomatis di sini</div>
                </div>

                <!-- NARASI -->
                <div style="text-align:justify;">${narasi || '<span style="color:#999;">— Narasi belum diisi —</span>'}</div>

            </div>
        </div>`;

        // Dummy signature handling for preview
        let finalHtml = html
            .replace(/{{ttd_gabungan}}/g, '<div style="text-align:center;color:#94a3b8;border:2px dashed #cbd5e1;padding:20px;border-radius:8px;margin-top:20px;">[Tanda Tangan Pihak 1 & Pihak 2 Akan Muncul Disini]</div>')
            .replace(/{{ttd_direktur}}/g, '<div style="text-align:center;color:#94a3b8;border:2px dashed #cbd5e1;padding:20px;border-radius:8px;margin-top:20px;width:250px;margin-left:auto;">[Tanda Tangan Direktur Akan Muncul Disini]</div>')
            .replace(/{{ttd_personil}}/g, '<div style="text-align:center;color:#94a3b8;border:2px dashed #cbd5e1;padding:20px;border-radius:8px;margin-top:20px;width:250px;">[Tanda Tangan Personil Akan Muncul Disini]</div>');

        if (fromForm) {
            // Show in a new overlay on top of existing modal
            const overlay = document.createElement('div');
            overlay.id = 'tpl-preview-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;';
            overlay.innerHTML = `<div style="background:var(--bg-secondary);border-radius:var(--radius-lg);max-width:900px;width:100%;max-height:95vh;display:flex;flex-direction:column;">
                <div style="padding:16px 24px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;">Preview Template</h3>
                    <button class="btn btn-secondary btn-sm" onclick="document.getElementById('tpl-preview-overlay').remove()">✕ Tutup</button>
                </div>
                <div style="padding:16px;overflow-y:auto;flex:1;">${finalHtml}</div>
            </div>`;
            document.body.appendChild(overlay);
        } else {
            Modal.open('Preview: ' + Fmt.escape(t.nama_template), finalHtml, '<button class="btn btn-secondary" onclick="Modal.close()">Tutup</button>');
            const modalEl = document.getElementById('modal');
            if (modalEl) modalEl.style.maxWidth = '900px';
        }
    },

    remove(id) {
        Modal.confirm('Hapus Template', 'Yakin ingin menghapus template ini?', async () => {
            try { await API.deleteTemplate(id); Toast.success('Template dihapus'); this.loadData(); }
            catch (e) { Toast.error(e.message); }
        });
    }
};
