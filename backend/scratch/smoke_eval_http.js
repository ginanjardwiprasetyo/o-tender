// Smoke test: vonis win/lose berbasis bukti + scrapeTender HTTP-first
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../config/db');
const { checkWinLose } = require('../services/eval_scraper');
const { scrapeTender } = require('../services/scraper');

function assert(cond, msg) {
    if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; }
    else console.log('OK:', msg);
}

(async () => {
    const { rows: companies } = await db.query('SELECT nama_perusahaan FROM companies');
    const companyNames = companies.map(c => c.nama_perusahaan).filter(Boolean);
    console.log('companyNames =', JSON.stringify(companyNames));

    // 1. Kasus nyata: pemenang CV. CITRA PERKASA — kita di tabel peserta → Kalah + alasan per perusahaan
    const r1 = await checkWinLose('slemankab', '10166213000', companyNames);
    console.log('checkWinLose slemankab/10166213000 =', JSON.stringify(r1));
    assert(r1.success === true, 'verdict tercapai (halaman valid)');
    assert(r1.isMenang === false, 'bukan Menang (pemenang CITRA PERKASA)');
    assert(Array.isArray(r1.peserta) && r1.peserta.length > 0, 'peserta[] per perusahaan terisi: ' + JSON.stringify(r1.peserta));
    assert(r1.peserta.some(p => p.alasan), 'ada alasan asli dari laman hasil');

    // 2. Kasus tidak valid: kode salah → success:false, TANPA vonis palsu
    const r2 = await checkWinLose('slemankab', '99999999999', companyNames);
    console.log('checkWinLose kode tak dikenal =', JSON.stringify(r2));
    assert(r2.success === false, 'halaman tidak valid → success:false (tanpa vonis)');

    // 3. companyNames kosong → tidak boleh pernah Menang/Kalah
    const r3 = await checkWinLose('slemankab', '10166213000', []);
    assert(r3.success === false, 'companyNames kosong → success:false (tanpa vonis)');

    // 4. scrapeTender HTTP-first: sukses tanpa warn "HTTP detail failed"
    const data = await scrapeTender('slemankab', '10166213000');
    console.log('scrapeTender details[Nama Tender] =', data.details['Nama Tender']);
    console.log('scrapeTender pagu/hps/sbu/upload/schedules =',
        data.details['Nilai Pagu Paket'], '|', data.details['Nilai HPS Paket'], '|',
        data.sbu, '|', data.uploadDate, '|', (data.schedules || []).length, 'stages');
    assert(!!data.details['Nama Tender'], 'details[Nama Tender] terisi (map label→value)');
    assert(Array.isArray(data.schedules) && data.schedules.length > 0, 'schedules terisi');
    assert(data.uploadDate && data.uploadDate !== '-', 'uploadDate terisi: ' + data.uploadDate);

    console.log(process.exitCode ? 'SMOKE TEST FAILED' : 'SMOKE TEST PASSED');
    process.exit(process.exitCode || 0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
