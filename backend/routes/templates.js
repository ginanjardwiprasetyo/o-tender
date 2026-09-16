/**
 * Template Routes — Document template management
 */
const express = require('express');
const router = express.Router();
const db = require('../config/db');

const FIELDS = [
    'nama_template', 'kategori', 'html_content',
    'kop_logo_url', 'kop_nama', 'kop_alamat', 'kop_kontak',
    'kop_is_image', 'kop_image_url',
    'ttd_nama', 'ttd_jabatan', 'ttd_image_url', 'cap_image_url',
    'paper_size', 'margin_top', 'margin_bottom', 'margin_left', 'margin_right',
    'fit_layout'
];

// GET all
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM templates ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET one
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Template tidak ditemukan' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST create
router.post('/', async (req, res) => {
    try {
        const { nama_template } = req.body;
        if (!nama_template) return res.status(400).json({ success: false, error: 'Nama template wajib diisi' });

        const cols = FIELDS.filter(f => req.body[f] !== undefined);
        const vals = cols.map(f => req.body[f]);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

        const { rows } = await db.query(
            `INSERT INTO templates (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            vals
        );
        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT update
router.put('/:id', async (req, res) => {
    try {
        const cols = FIELDS.filter(f => req.body[f] !== undefined);
        if (!cols.length) return res.status(400).json({ success: false, error: 'Tidak ada data untuk diupdate' });

        const sets = cols.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const vals = cols.map(f => req.body[f]);
        vals.push(req.params.id);

        const { rows } = await db.query(
            `UPDATE templates SET ${sets} WHERE id = $${vals.length} RETURNING *`,
            vals
        );
        if (!rows[0]) return res.status(404).json({ success: false, error: 'Template tidak ditemukan' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// SEED DEFAULT TENDER TEMPLATES
const DEFAULT_TEMPLATES = [
    {
        nama_template: 'Surat Penawaran Harga (LPSE/Konstruksi)',
        kategori: 'Penawaran',
        paper_size: 'A4',
        margin_top: 25, margin_bottom: 25, margin_left: 30, margin_right: 25,
        html_content: `<p style="text-align:right;">{{tanggal_surat}}</p>
{{header_surat}}
<br>
<p>Kepada Yth.:<br>
<strong>Pokja Pemilihan {{pokja}}</strong><br>
{{instansi}}<br>
{{alamat_pokja}}</p>

<p style="text-align:justify;">Sehubungan dengan pengumuman pendaftaran dan pengambilan Dokumen Pemilihan nomor: {{nomor_dokpil}} tanggal {{tanggal_dokpil}} dan setelah kami pelajari dengan saksama Dokumen Pemilihan serta Lembar Data Pemilihan (LDP), dengan ini kami mengajukan penawaran untuk paket pekerjaan <strong>{{nama_paket}}</strong> (Kode Tender: {{kode_tender}}).</p>

<p style="text-align:justify;">Penawaran ini sudah memperhatikan ketentuan dan persyaratan yang tercantum dalam Dokumen Pemilihan untuk melaksanakan pekerjaan tersebut di atas.</p>

<p style="text-align:justify;">Penawaran ini berlaku selama {{masa_berlaku_penawaran}} ({{terbilang_masa_berlaku}}) hari kalender sejak batas akhir pemasukan dokumen penawaran.</p>

<p style="text-align:justify;">Jumlah nilai penawaran yang kami ajukan adalah sebesar <strong>{{nilai_penawaran}}</strong> (<em>{{terbilang_penawaran}}</em>) sudah termasuk PPN dan pajak-pajak berlaku lainnya.</p>

<p style="text-align:justify;">Jangka waktu pelaksanaan pekerjaan yang kami sanggupi adalah selama {{jangka_waktu}} ({{terbilang_jangka_waktu}}) hari kalender terhitung sejak Surat Perintah Mulai Kerja (SPMK).</p>

<p style="text-align:justify;">Dengan disampaikannya Surat Penawaran ini, maka kami menyatakan sanggup dan akan tunduk pada semua ketentuan yang tercantum dalam Dokumen Pemilihan.</p>

<br>
{{ttd_direktur}}`
    },
    {
        nama_template: 'Pakta Integritas',
        kategori: 'Pernyataan',
        paper_size: 'A4',
        margin_top: 25, margin_bottom: 25, margin_left: 30, margin_right: 25,
        html_content: `<h3 style="text-align:center; font-size:14pt; margin-bottom:20px; text-decoration:underline;">PAKTA INTEGRITAS</h3>

<p>Saya yang bertanda tangan di bawah ini:</p>
<table style="width:100%; margin-bottom:15px; border-collapse:collapse;">
  <tr><td style="width:160px; padding:3px 0;">Nama</td><td style="width:10px;">:</td><td><strong>{{direktur}}</strong></td></tr>
  <tr><td style="padding:3px 0;">Jabatan</td><td>:</td><td>Direktur</td></tr>
  <tr><td style="padding:3px 0;">Bertindak Untuk & Atas Nama</td><td>:</td><td><strong>{{nama_perusahaan}}</strong></td></tr>
  <tr><td style="padding:3px 0;">Alamat</td><td>:</td><td>{{alamat}}</td></tr>
</table>

<p style="text-align:justify;">Dalam rangka pengadaan pekerjaan <strong>{{nama_paket}}</strong> (Kode Tender: {{kode_tender}}) pada {{instansi}}, dengan ini menyatakan bahwa kami:</p>

<ol style="line-height:1.8; text-align:justify;">
  <li>Tidak akan melakukan praktik Korupsi, Kolusi, dan Nepotisme (KKN);</li>
  <li>Akan melaporkan kepada PA/KPA/APIP jika mengetahui ada indikasi KKN dalam proses pengadaan ini;</li>
  <li>Akan mengikuti proses pengadaan secara bersih, transparan, dan profesional untuk memberikan hasil kerja terbaik sesuai ketentuan peraturan perundang-undangan;</li>
  <li>Apabila melanggar hal-hal yang dinyatakan dalam PAKTA INTEGRITAS ini, bersedia menerima sanksi administratif, sanksi pencantuman dalam Daftar Hitam, digugat secara perdata dan/atau dilaporkan secara pidana.</li>
</ol>

<br>
<table style="width:100%;">
  <tr>
    <td style="width:50%;"></td>
    <td style="width:50%; text-align:center;">
      <p>{{tanggal_surat}}</p>
      {{ttd_direktur}}
    </td>
  </tr>
</table>`
    },
    {
        nama_template: 'Pakta Komitmen Keselamatan Kerja Konstruksi (SMKK/RKK)',
        kategori: 'Pernyataan',
        paper_size: 'A4',
        margin_top: 25, margin_bottom: 25, margin_left: 30, margin_right: 25,
        html_content: `<h3 style="text-align:center; font-size:14pt; margin-bottom:5px; text-transform:uppercase;">PAKTA KOMITMEN KESELAMATAN KONSTRUKSI</h3>
<h4 style="text-align:center; font-size:11pt; margin-top:0; font-weight:normal; text-transform:uppercase;">(Rencana Keselamatan Konstruksi - RKK)</h4>
<br>

<p>Saya yang bertanda tangan di bawah ini:</p>
<table style="width:100%; margin-bottom:15px;">
  <tr><td style="width:160px; padding:3px 0;">Nama</td><td style="width:10px;">:</td><td><strong>{{direktur}}</strong></td></tr>
  <tr><td style="padding:3px 0;">Jabatan</td><td>:</td><td>Direktur</td></tr>
  <tr><td style="padding:3px 0;">Bertindak Untuk & Atas Nama</td><td>:</td><td><strong>{{nama_perusahaan}}</strong></td></tr>
</table>

<p style="text-align:justify;">Dalam rangka pelaksanaan Pekerjaan <strong>{{nama_paket}}</strong> pada {{instansi}}, berjanji akan menerapkan Sistem Manajemen Keselamatan Konstruksi (SMKK) dengan komitmen:</p>

<ol style="line-height:1.8; text-align:justify;">
  <li>Memenuhi ketentuan Keselamatan Konstruksi sesuai standar dan peraturan perundang-undangan yang berlaku;</li>
  <li>Menggunakan tenaga kerja kompeten bersertifikat dan menyediakan Alat Pelindung Diri (APD) serta Alat Pelindung Kerja (APK) yang sesuai standar;</li>
  <li>Menggunakan peralatan yang memenuhi standar keselamatan kerja;</li>
  <li>Memfasilitasi sarana dan prasarana Kesehatan Kerja (K3) di lingkungan proyek;</li>
  <li>Melakukan identifikasi bahaya, penilaian risiko, dan pengendalian risiko (IBPRP) secara disiplin dan konsisten.</li>
</ol>

<br>
<table style="width:100%;">
  <tr>
    <td style="width:50%;"></td>
    <td style="width:50%; text-align:center;">
      <p>{{tanggal_surat}}</p>
      {{ttd_direktur}}
    </td>
  </tr>
</table>`
    },
    {
        nama_template: 'Surat Pernyataan Kebenaran Dokumen & Bebas Blacklist',
        kategori: 'Pernyataan',
        paper_size: 'A4',
        margin_top: 25, margin_bottom: 25, margin_left: 30, margin_right: 25,
        html_content: `<h3 style="text-align:center; font-size:13pt; margin-bottom:20px; text-decoration:underline; text-transform:uppercase;">SURAT PERNYATAAN KUALIFIKASI & KEBENARAN DOKUMEN</h3>

<p>Yang bertanda tangan di bawah ini:</p>
<table style="width:100%; margin-bottom:15px;">
  <tr><td style="width:160px; padding:3px 0;">Nama</td><td style="width:10px;">:</td><td><strong>{{direktur}}</strong></td></tr>
  <tr><td style="padding:3px 0;">Jabatan</td><td>:</td><td>Direktur</td></tr>
  <tr><td style="padding:3px 0;">Nama Perusahaan</td><td>:</td><td><strong>{{nama_perusahaan}}</strong></td></tr>
  <tr><td style="padding:3px 0;">Alamat Perusahaan</td><td>:</td><td>{{alamat}}</td></tr>
</table>

<p style="text-align:justify;">Dengan ini menyatakan dengan sesungguhnya bahwa untuk mengikuti proses pengadaan paket pekerjaan <strong>{{nama_paket}}</strong> (Kode Tender: {{kode_tender}}):</p>

<ol style="line-height:1.8; text-align:justify;">
  <li>Pengurus/Pegawai/Personil perusahaan kami tidak berstatus Aparatur Sipil Negara (ASN / PNS / TNI / Polri) dan keikutsertaan kami tidak menimbulkan pertentangan kepentingan.</li>
  <li>Data kualifikasi yang diisikan dan dokumen penawaran yang disampaikan adalah benar dan sah. Apabila dikemudian hari ditemukan pemalsuan data, kami bersedia dikenakan sanksi administratif, sanksi Daftar Hitam, gugatan perdata, dan/atau pelaporan pidana.</li>
  <li>Perusahaan <strong>{{nama_perusahaan}}</strong> beserta manajemennya tidak dalam pengawasan pengadilan, tidak pailit, dan kegiatan usahanya tidak sedang dihentikan.</li>
  <li>Perusahaan kami beserta pengurus tidak masuk dalam Daftar Hitam (Blacklist) Pengadaan Barang/Jasa Pemerintah.</li>
</ol>

<br>
<table style="width:100%;">
  <tr>
    <td style="width:50%;"></td>
    <td style="width:50%; text-align:center;">
      <p>{{tanggal_surat}}</p>
      {{ttd_direktur}}
    </td>
  </tr>
</table>`
    },
    {
        nama_template: 'Formulir Isian Perhitungan SKP (Sisa Kemampuan Paket)',
        kategori: 'Administrasi',
        paper_size: 'A4',
        margin_top: 25, margin_bottom: 25, margin_left: 30, margin_right: 25,
        html_content: `<h3 style="text-align:center; font-size:13pt; margin-bottom:5px; text-transform:uppercase;">FORMULIR ISIAN PERHITUNGAN SISA KEMAMPUAN PAKET (SKP)</h3>
<h4 style="text-align:center; font-size:11pt; margin-top:0; font-weight:normal; color:#333;">PENYEDIA JASA KUALIFIKASI USAHA KECIL</h4>
<br>

<p>Yang bertanda tangan di bawah ini:</p>
<table style="width:100%; margin-bottom:15px;">
  <tr><td style="width:160px; padding:3px 0;">Nama Perusahaan</td><td style="width:10px;">:</td><td><strong>{{nama_perusahaan}}</strong></td></tr>
  <tr><td style="padding:3px 0;">Nama Pimpinan</td><td>:</td><td><strong>{{direktur}}</strong></td></tr>
  <tr><td style="padding:3px 0;">Jabatan</td><td>:</td><td>Direktur</td></tr>
</table>

<p><strong>1. Data Pekerjaan yang Sedang Dilaksanakan:</strong></p>
<table style="width:100%; border-collapse:collapse; margin-bottom:15px; border:1px solid #000;">
  <thead>
    <tr style="background:#f2f2f2; text-align:center; font-size:10pt;">
      <th style="width:30px; border:1px solid #000; padding:6px;">No</th>
      <th style="border:1px solid #000; padding:6px;">Nama Paket Pekerjaan</th>
      <th style="border:1px solid #000; padding:6px;">Lokasi</th>
      <th style="border:1px solid #000; padding:6px;">Nilai Kontrak (Rp)</th>
      <th style="border:1px solid #000; padding:6px;">Waktu Pelaksanaan</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align:center; border:1px solid #000; padding:6px;">1</td>
      <td style="border:1px solid #000; padding:6px;">- NIHIL -</td>
      <td style="border:1px solid #000; padding:6px;">-</td>
      <td style="text-align:right; border:1px solid #000; padding:6px;">-</td>
      <td style="text-align:center; border:1px solid #000; padding:6px;">-</td>
    </tr>
  </tbody>
</table>

<p><strong>2. Perhitungan Sisa Kemampuan Paket (SKP):</strong></p>
<div style="background:#f9f9f9; padding:12px; border:1px solid #ccc; font-size:11pt; margin-bottom:20px; border-radius:4px;">
  SKP = 5 - N (Jumlah Paket Berjalan)<br>
  SKP = 5 - 0<br>
  <strong>SKP = 5 Paket</strong>
</div>

<p style="text-align:justify;">Demikian formulir SKP ini kami buat dengan sebenarnya untuk digunakan dalam pengadaan paket pekerjaan {{nama_paket}}.</p>

<br>
<table style="width:100%;">
  <tr>
    <td style="width:50%;"></td>
    <td style="width:50%; text-align:center;">
      <p>{{tanggal_surat}}</p>
      {{ttd_direktur}}
    </td>
  </tr>
</table>`
    },
    {
        nama_template: 'Surat Pernyataan Kesediaan Personil Manajerial',
        kategori: 'Pernyataan',
        paper_size: 'A4',
        margin_top: 25, margin_bottom: 25, margin_left: 30, margin_right: 25,
        html_content: `<h3 style="text-align:center; font-size:13pt; margin-bottom:20px; text-decoration:underline; text-transform:uppercase;">SURAT PERNYATAAN KESEDIAAN PERSONIL MANAJERIAL</h3>

<p>Yang bertanda tangan di bawah ini:</p>
<table style="width:100%; margin-bottom:15px;">
  <tr><td style="width:160px; padding:3px 0;">Nama Personil</td><td style="width:10px;">:</td><td><strong>{{nama_personil}}</strong></td></tr>
  <tr><td style="padding:3px 0;">Jabatan Ditugaskan</td><td>:</td><td><strong>{{jabatan_personil}}</strong></td></tr>
</table>

<p style="text-align:justify;">Dengan ini menyatakan bahwa saya bersedia untuk ditugaskan secara penuh (full-time) sebagai <strong>{{jabatan_personil}}</strong> pada paket pekerjaan <strong>{{nama_paket}}</strong> pada {{instansi}} sesuai dengan alokasi waktu dan jadwal pelaksanaan kerja.</p>

<p style="text-align:justify;">Demikian Surat Pernyataan Kesediaan ini dibuat dengan sebenarnya dan penuh rasa tanggung jawab.</p>

<br>
{{ttd_gabungan}}`
    },
    {
        nama_template: 'Surat Pernyataan Kesediaan Peralatan Utama',
        kategori: 'Dukungan',
        paper_size: 'A4',
        margin_top: 25, margin_bottom: 25, margin_left: 30, margin_right: 25,
        html_content: `<h3 style="text-align:center; font-size:13pt; margin-bottom:20px; text-decoration:underline; text-transform:uppercase;">SURAT PERNYATAAN KESEDIAAN PERALATAN UTAMA</h3>

<p>Yang bertanda tangan di bawah ini:</p>
<table style="width:100%; margin-bottom:15px;">
  <tr><td style="width:160px; padding:3px 0;">Nama</td><td style="width:10px;">:</td><td><strong>{{direktur}}</strong></td></tr>
  <tr><td style="padding:3px 0;">Jabatan</td><td>:</td><td>Direktur</td></tr>
  <tr><td style="padding:3px 0;">Bertindak Untuk & Atas Nama</td><td>:</td><td><strong>{{nama_perusahaan}}</strong></td></tr>
</table>

<p style="text-align:justify;">Dengan ini menyatakan bahwa perusahaan kami memiliki dan sanggup menyediakan peralatan utama yang dibutuhkan untuk pelaksanaan pekerjaan <strong>{{nama_paket}}</strong> (Kode Tender: {{kode_tender}}), sesuai spesifikasi dan jumlah yang dipersyaratkan dalam Dokumen Pemilihan.</p>

<p style="text-align:justify;">Demikian Surat Pernyataan Kesediaan Peralatan ini kami buat dengan penuh rasa tanggung jawab.</p>

<br>
<table style="width:100%;">
  <tr>
    <td style="width:50%;"></td>
    <td style="width:50%; text-align:center;">
      <p>{{tanggal_surat}}</p>
      {{ttd_direktur}}
    </td>
  </tr>
</table>`
    }
];

// POST seed templates
router.post('/seed', async (req, res) => {
    try {
        let inserted = 0;
        for (const tpl of DEFAULT_TEMPLATES) {
            const { rows: existing } = await db.query('SELECT id FROM templates WHERE nama_template = $1', [tpl.nama_template]);
            if (existing.length === 0) {
                await db.query(
                    `INSERT INTO templates (nama_template, kategori, html_content, paper_size, margin_top, margin_bottom, margin_left, margin_right)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [tpl.nama_template, tpl.kategori, tpl.html_content, tpl.paper_size, tpl.margin_top, tpl.margin_bottom, tpl.margin_left, tpl.margin_right]
                );
                inserted++;
            }
        }
        res.json({ success: true, message: `Berhasil menambahkan ${inserted} template standar tender.`, inserted });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE
router.delete('/:id', async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM templates WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ success: false, error: 'Template tidak ditemukan' });
        res.json({ success: true, message: 'Template berhasil dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
