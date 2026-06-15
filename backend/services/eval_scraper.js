const cheerio = require('cheerio');
const axios = require('axios');
const { getBaseUrl } = require('../utils/lpse-mapper');

async function checkWinLose(slug, kode, companyNames) {
    const base = getBaseUrl(slug);
    const pemenangUrl = `${base}/evaluasi/${kode}/pemenang`;
    const hasilUrl = `${base}/evaluasi/${kode}/hasil`;
    
    let isMenang = false;
    let alasanKalah = null;
    
    try {
        // Cek Pemenang
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
            'Referer': `${base}/lelang`,
        };
        const respPem = await axios.get(pemenangUrl, { headers, timeout: 15000 });
        const $pem = cheerio.load(respPem.data);
        
        let pemenangText = $pem('body').text().toLowerCase();
        
        for (const c of companyNames) {
            if (c && pemenangText.includes(c.toLowerCase())) {
                isMenang = true;
                break;
            }
        }
        
        if (!isMenang) {
            // Cek Hasil Evaluasi untuk alasan kalah
            const respHas = await axios.get(hasilUrl, { headers, timeout: 15000 });
            const $has = cheerio.load(respHas.data);
            
            $has('table tr').each((_, row) => {
                const cells = $has(row).find('td');
                if (cells.length > 2) {
                    const peserta = $has(cells[1]).text().toLowerCase();
                    const isOurCompany = companyNames.some(c => c && peserta.includes(c.toLowerCase()));
                    if (isOurCompany) {
                        // Alasan biasanya ada di kolom terakhir atau ada icon X dengan title
                        const alasan = $has(cells[cells.length - 1]).text().trim();
                        // or check for img src cross
                        let specificReason = [];
                        $has(cells).each((idx, cell) => {
                            const html = $has(cell).html() || '';
                            if (html.includes('cross.png') || html.includes('fa-times')) {
                                const title = $has(cell).find('img, i').attr('title');
                                if (title) specificReason.push(title);
                            }
                        });
                        alasanKalah = specificReason.length > 0 ? specificReason.join(', ') : alasan;
                    }
                }
            });
            if (!alasanKalah) alasanKalah = "Gugur/Tidak Lulus Evaluasi";
        }
        
        return { success: true, isMenang, alasanKalah };
    } catch (err) {
        console.error(`[EvalScraper] Error checking ${kode}: ${err.message}`);
        return { success: false, error: err.message };
    }
}

module.exports = { checkWinLose };
