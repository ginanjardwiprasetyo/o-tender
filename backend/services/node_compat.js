/**
 * Kompatibilitas Node lama.
 *
 * pdfjs-dist v6 (dipakai utk rasterize PDF & baca teks) memanggil
 * Promise.withResolvers() — API Node 22+. Server produksi masih Node 20
 * (image ghcr.io/puppeteer/puppeteer:23.0.0) → "Promise.withResolvers is not
 * a function" → seluruh proses scan efek gagal.
 *
 * Shim ini supaya jalan di Node 20 tanpa ganti base image (ganti image = ganti
 * versi Chrome = output PDF bisa berubah).
 */
if (typeof Promise.withResolvers !== 'function') {
    Promise.withResolvers = function withResolvers() {
        let resolve, reject;
        const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
        return { promise, resolve, reject };
    };
}

module.exports = {};
