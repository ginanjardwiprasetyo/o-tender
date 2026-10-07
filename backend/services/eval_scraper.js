const cheerio = require('cheerio');
const axios = require('axios');
const { getBaseUrl } = require('../utils/lpse-mapper');

// Normalisasi nama: huruf kecil, buang spasi/tanda baca → "CV.Utama" = "CV Utama"
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Inti nama tanpa awalan badan usaha: "GARREL MULTI PERKASA" = "CV Garrel Multi Perkasa"
const core = (s) => norm(s).replace(/^(cv|pt|persero|perum|koperasi)/, '');

function matchCompany(name, companyNames) {
    const n = norm(name);
    if (n.length < 5) return false; // nama kosong/terlalu pendek tidak boleh cocok
    const nc = core(name);
    return companyNames.some(c => {
        const cn = norm(c);
        if (!cn) return false;
        if (cn === n || (cn.length >= 8 && n.includes(cn))) return true; // nama panjang kita ada di dalam sel
        const cc = core(c);
        return nc.length >= 8 && cc.length >= 8 && nc.includes(cc); // banding tanpa awalan cv/pt
    });
}

function mkHeaders(base) {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
        'Referer': `${base}/lelang`,
    };
}

// Ambil pemenang dari halaman evaluasi. Return { valid, winner, error }.
// valid=false → halaman bukan halaman tender asli (403/portal/shell); winner=null → belum diumumkan.
async function getPemenang(slug, kode) {
    const base = getBaseUrl(slug);
    try {
        const resp = await axios.get(`${base}/evaluasi/${kode}/pemenang`, { headers: mkHeaders(base), timeout: 15000 });
        const $ = cheerio.load(resp.data);
        const text = $('body').text().toLowerCase();
        if (!text.includes('nama tender') || !text.includes('nama pemenang')) {
            return { valid: false, winner: null, error: 'Halaman pemenang tidak valid' };
        }
        let winner = null;
        $('table').each((_, tbl) => {
            if (winner) return;
            const $rows = $(tbl).find('tr');
            const heads = $rows.first().find('th,td').map((i, el) => $(el).text().trim().toLowerCase()).get();
            const idx = heads.indexOf('nama pemenang');
            if (idx === -1) return;
            $rows.slice(1).each((__, row) => {
                if (winner) return;
                const cells = $(row).find('td');
                if (cells.length > idx) {
                    const v = $(cells[idx]).text().trim();
                    if (v) winner = v;
                }
            });
        });
        return { valid: true, winner };
    } catch (err) {
        return { valid: false, winner: null, error: err.message };
    }
}

async function checkWinLose(slug, kode, companyNames) {
    const base = getBaseUrl(slug);
    const hasilUrl = `${base}/evaluasi/${kode}/hasil`;
    const headers = mkHeaders(base);

    try {
        // 1. Halaman Pemenang — wajib halaman tender asli, ekstrak kolom "Nama Pemenang"
        const pem = await getPemenang(slug, kode);
        if (!pem.valid) return { success: false, error: pem.error || 'Halaman pemenang tidak valid' };
        const winnerName = pem.winner;
        if (!winnerName) {
            // Pemenang belum diumumkan → tidak menulis apa pun (tetap Diproses)
            return { success: false, error: 'Pemenang belum diumumkan' };
        }

        // 2. Menang — nama kita yang ada di kolom Nama Pemenang
        if (matchCompany(winnerName, companyNames)) {
            return { success: true, isMenang: true, bukti: `Pemenang: ${winnerName}`, pemenang: winnerName, peserta: [{ nama: winnerName, alasan: '' }] };
        }

        // 3. Kalah — hanya jika kita benar-benar terdaftar sebagai peserta di halaman hasil.
        //    Alasan diambil PER BARIS nama perusahaan; tidak ada → kosong (tanpa teks karangan).
        const respHas = await axios.get(hasilUrl, { headers, timeout: 15000 });
        const $has = cheerio.load(respHas.data);
        const hasText = $has('body').text().toLowerCase();
        if (!hasText.includes('nama peserta')) {
            return { success: false, error: 'Halaman hasil evaluasi tidak valid' };
        }

        const pesertaDari = [];
        $has('table tr').each((_, row) => {
            const cells = $has(row).find('td');
            if (cells.length < 2) return;
            const pesertaNama = $has(cells[1]).text().trim();
            if (!matchCompany(pesertaNama, companyNames)) return;
            if (pesertaDari.some(p => p.nama === pesertaNama)) return;

            // Alasan dari baris perusahaan ini: icon cross/title bila ada, fallback kolom terakhir
            let alasan = '';
            const specificReason = [];
            cells.each((__, cell) => {
                const html = $has(cell).html() || '';
                if (html.includes('cross.png') || html.includes('fa-times')) {
                    const title = $has(cell).find('img, i').attr('title');
                    if (title) specificReason.push(title);
                }
            });
            const lastCell = $has(cells[cells.length - 1]).text().trim();
            if (specificReason.length > 0) alasan = specificReason.join(', ');
            else if (lastCell && lastCell !== '-' && lastCell.length <= 1000 && !/^Rp/i.test(lastCell)) alasan = lastCell;

            pesertaDari.push({ nama: pesertaNama, alasan });
        });

        if (pesertaDari.length === 0) {
            // Tidak terdaftar sebagai peserta → biarkan Diproses (bukan vonis)
            return { success: false, error: 'Perusahaan tidak terdaftar sebagai peserta' };
        }

        return { success: true, isMenang: false, pemenang: winnerName, peserta: pesertaDari };
    } catch (err) {
        console.error(`[EvalScraper] Error checking ${kode}: ${err.message}`);
        return { success: false, error: err.message };
    }
}

module.exports = { checkWinLose, getPemenang, matchCompany };
