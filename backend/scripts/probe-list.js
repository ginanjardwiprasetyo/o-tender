// Probe jalur list LPSE dari dalam runner GitHub Actions (lewat Tailscale exit node).
// Dipakai workflow .github/workflows/probe.yml - tujuannya jawab 2 pertanyaan:
//   1. Apakah HTTP GET/POST ke spse.inaproc.id berhasil dari IP exit node?
//   2. Berapa baris sebenarnya per LPSE (length=1000) vs yang masuk sekarang (length=25)?
const { getLPSEList, getBaseUrl } = require('../utils/lpse-mapper');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
// ponytail: WAJIB ada timeout - tanpa ini fetch menggantung ber-menit-menit di runner
// (jalur ke spse.inaproc.id memang hang, bukan cepat gagal).
const TO = (ms) => AbortSignal.timeout(ms);
const HEADERS = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125"',
    'Sec-Fetch-Mode': 'navigate',
    'Upgrade-Insecure-Requests': '1',
};

async function postList(baseUrl, slug, listUrl, cookie, token, length) {
    const u = new URL(listUrl);
    const q = new URLSearchParams();
    for (const k of ['kategoriId', 'rekanan', 'tahun', 'instansiId']) q.set(k, u.searchParams.get(k) || '');
    const body = new URLSearchParams({
        draw: '1', start: '0', length: String(length),
        'search[value]': '', 'search[regex]': 'false',
        'order[0][column]': '5', 'order[0][dir]': 'desc',
        authenticityToken: token,
    });
    for (let i = 0; i < 6; i++) {
        body.set(`columns[${i}][data]`, String(i));
        body.set(`columns[${i}][name]`, '');
        body.set(`columns[${i}][searchable]`, 'true');
        body.set(`columns[${i}][orderable]`, 'true');
        body.set(`columns[${i}][search][value]`, '');
        body.set(`columns[${i}][search][regex]`, 'false');
    }
    const res = await fetch(`${baseUrl}/dt/lelang?${q}`, {
        method: 'POST',
        headers: {
            ...HEADERS,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            Cookie: cookie,
            Referer: listUrl,
        },
        body,
        signal: TO(8000),
    });
    const j = await res.json().catch(() => null);
    return { status: res.status, rows: Array.isArray(j && j.data) ? j.data.length : null };
}

async function probe(slug) {
    const baseUrl = getBaseUrl(slug);
    const listUrl = `${baseUrl}/lelang?kategoriId=2&tahun=2026&instansiId=&rekanan=&kontrak_status=&kontrak_tipe=`;
    const out = { slug };
    const t0 = Date.now();
    let html = '', cookie = '';
    try {
        const r = await fetch(listUrl, { headers: HEADERS, signal: TO(8000) });
        out.get_status = r.status;
        cookie = (r.headers.getSetCookie ? r.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
        html = await r.text();
    } catch (e) {
        out.get_err = (e.cause && e.cause.code) || e.code || e.name || e.message;
    }
    out.get_ms = Date.now() - t0;
    if (!html) return out;

    out.blocked = /just a moment|verifikasi singkat|akses ditolak|anda tidak diizinkan/i.test(
        html.replace(/<[^>]*>/g, ' ')
    );
    const m = html.match(/authenticity[Tt]oken["'\s:=]+([a-f0-9]{32,})/);
    out.has_token = !!m;
    if (!m) return out;

    const t1 = Date.now();
    try {
        const a = await postList(baseUrl, slug, listUrl, cookie, m[1], 25);
        out.post25_ms = Date.now() - t1;
        out.rows_25 = a.rows;
        const b = await postList(baseUrl, slug, listUrl, cookie, m[1], 1000);
        out.rows_1000 = b.rows;
        out.kurang = (b.rows || 0) - (a.rows || 0);
    } catch (e) {
        out.post_err = (e.cause && e.cause.code) || e.code || e.name || e.message;
        out.post_ms = Date.now() - t1;
    }
    return out;
}

(async () => {
    console.log('[probe] mulai - membaca IP exit node...');
    console.log(`[probe] exit-node IP: ${await fetch('https://api.ipify.org', { signal: TO(5000) }).then(r => r.text()).catch(e => e.name)}`);
    const lpse = await getLPSEList();
    let t25 = 0, t1000 = 0, ok = 0;
    for (const l of lpse) {
        const slug = l.nama_lpse;
        const r = await probe(slug).catch(e => ({ slug, fatal: e.message }));
        if (r.rows_1000 != null) { t25 += r.rows_25 || 0; t1000 += r.rows_1000; ok++; }
        console.log(`[probe] ${slug.padEnd(18)} ${JSON.stringify(r)}`);
    }
    console.log(`[probe] TOTAL masuk sekarang (length=25): ${t25} | sebenarnya (length=1000): ${t1000} | hilang: ${t1000 - t25} | LPSE terjawab: ${ok}/${lpse.length}`);
    process.exit(0);
})();
