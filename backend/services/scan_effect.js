/**
 * Efek "scan" realistis utk PDF (flatbed A4): kertas off-white, pencahayaan pemindai
 * tak rata + warp halus kertas, ink bleed alami di teks & cap, derau piksel scanner,
 * vignette tepi lembut, artefak JPEG. Tetap satu rantai (pdf.js → canvas → pdf-lib),
 * tanpa dependency baru.
 *
 * Pipeline per halaman:
 *   render → skew halus → blur mikro (cap tetap biru) → ink bleed (multiply halo) →
 *   pencahayaan tak rata + pita warp (multiply) → per-pixel: kertas off-white + derau →
 *   vignette tepi → debu → JPEG.
 */
require('./node_compat');   // shim Promise.withResolvers utk Node < 22
const crypto = require('crypto');
const { createCanvas } = require('@napi-rs/canvas');
const { PDFDocument } = require('pdf-lib');

const DEFAULTS = {
    dpi: 150,          // resolusi raster (72 = 1pt)
    blur: 0.35,        // defocus optik (px)
    skew: 0.7,         // derajat kemiringan maks per halaman
    bleed: 0.34,       // alpha halo ink bleed (teks & cap)
    lightAmt: 0.055,   // pencahayaan tak rata tepi (model lampu flatbed, 2-6%)
    warpAmt: 0.022,    // amplitudo pita warp kertas (kertas tak rata)
    noise: 0.034,      // derau piksel scanner (fraksi 255)
    edgeShadow: 0.06,  // vignette tepi jauh (bayang tutup scanner)
    dust: 26,          // jumlah titik debu per halaman
    jpegQuality: 74,   // artefak kompresi scanner
};

/** PRNG deterministik (mulberry32) — dokumen sama selalu tampil sama. */
function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function seedOf(buf) {
    return crypto.createHash('sha1').update(buf).digest().readUInt32BE(0);
}

/** Ukuran canvas setelah rotasi ang (+ pad 4px). */
function rotatedSize(w, h, ang) {
    const cosA = Math.abs(Math.cos(ang)), sinA = Math.abs(Math.sin(ang));
    const padX = Math.ceil((cosA * w + sinA * h - w) / 2) + 4;
    const padY = Math.ceil((sinA * w + cosA * h - h) / 2) + 4;
    return [w + padX * 2, h + padY * 2];
}

/**
 * Terapkan efek scan ke PDF.
 * @param {Buffer} pdfBytes
 * @param {object} opts  lihat DEFAULTS
 * @returns {Promise<{bytes: Buffer, pages: number}>}
 */
async function applyScanEffect(pdfBytes, opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const src = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true }).promise;

    const out = await PDFDocument.create();
    const rand = mulberry32(seedOf(pdfBytes));

    for (let p = 1; p <= src.numPages; p++) {
        const page = await src.getPage(p);
        const vp = page.getViewport({ scale: o.dpi / 72 });
        const w = Math.ceil(vp.width);
        const h = Math.ceil(vp.height);

        // 1) render halaman (warna utuh — cap tetap biru)
        const raster = createCanvas(w, h);
        const rctx = raster.getContext('2d');
        rctx.fillStyle = '#ffffff';
        rctx.fillRect(0, 0, w, h);
        await page.render({ canvasContext: rctx, viewport: vp }).promise;

        // 2) kemiringan halus (canvas padded biar tidak terpotong)
        const ang = (rand() * 2 - 1) * (o.skew * Math.PI / 180);
        const [cw, ch] = rotatedSize(w, h, ang);
        const skewC = createCanvas(cw, ch);
        const sctx = skewC.getContext('2d');
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(0, 0, cw, ch);
        sctx.translate(cw / 2, ch / 2);
        sctx.rotate(ang);
        sctx.drawImage(raster, -w / 2, -h / 2, w, h);
        sctx.setTransform(1, 0, 0, 1, 0, 0);

        // 3) defocus mikro + desat kecil — TANPA grayscale/sepia (cap biru tetap hidup)
        const ctx = createCanvas(cw, ch).getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);
        ctx.filter = `blur(${o.blur}px) saturate(0.95)`;
        ctx.drawImage(skewC, 0, 0);
        ctx.filter = 'none';

        // 4) ink bleed — halo gelap terfokus di sekitar tinta (teks & cap): copy dgn
        //    contrast tinggi menekankan tinta, blur melebarkannya, lalu multiply
        const bleedC = createCanvas(cw, ch);
        const bctx = bleedC.getContext('2d');
        bctx.fillStyle = '#ffffff';
        bctx.fillRect(0, 0, cw, ch);
        bctx.filter = `contrast(${3.0 + rand() * 0.8}) blur(${1.0 + rand() * 0.5}px)`;
        bctx.drawImage(ctx.canvas, 0, 0);
        bctx.filter = 'none';
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = o.bleed;
        ctx.drawImage(bleedC, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        // 5) pencahayaan flatbed tak rata + warp kertas: lapangan gelap kecil → pisahkan
        //    upsampel bilinear ke ukuran penuh → multiply (lemah di tepi kiri-kanan & atas-bawah)
        const lw = Math.max(2, Math.round(cw / 6)), lh = Math.max(2, Math.round(ch / 6));
        const lc = createCanvas(lw, lh);
        const lctx = lc.getContext('2d');
        const ld = lctx.createImageData(lw, lh);
        const warpF1 = 1.1 + rand() * 1.1;               // frekuensi pita warp (kertas tak datar)
        const warpPhi = rand() * Math.PI * 2, warpPhi2 = rand() * Math.PI * 2;
        for (let y = 0; y < lh; y++) {
            const ny = (y + 0.5) / lh, nyRel = Math.abs(ny - 0.5) * 2;
            for (let x = 0; x < lw; x++) {
                const nx = (x + 0.5) / lw, nxRel = Math.abs(nx - 0.5) * 2;
                // pake gelap di tepi kiri/kanan (arah jalannya lampu) + sedikit di atas/bawah
                const edgeX = o.lightAmt * Math.pow(nxRel, 2.6);
                const edgeY = o.lightAmt * 0.35 * Math.pow(nyRel, 2.2);
                // gelombang kertas: pita terang-gelap seluruh lebar (paper warp)
                const warp = o.warpAmt * (Math.sin(ny * warpF1 * Math.PI * 2 + warpPhi) * 0.7
                    + Math.sin(ny * warpF1 * Math.PI * 4 + warpPhi2) * 0.3);
                const v = Math.max(0.82, Math.min(1.02, 1.0 - edgeX - edgeY - warp + (rand() - 0.5) * 0.02));
                const g = v * 255;
                const i = (y * lw + x) * 4;
                ld.data[i] = g; ld.data[i + 1] = g; ld.data[i + 2] = g; ld.data[i + 3] = 255;
            }
        }
        lctx.putImageData(ld, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(lc, 0, 0, cw, ch);
        ctx.globalCompositeOperation = 'source-over';

        // 6) per-pixel: kertas off-white hangat + derau scanner — tint hanya piksel
        //    TERANG (v' = v·(1−t·v/255)); tinta & cap gelap tak tersentuh, tak keabu-abuan
        const imgd = ctx.getImageData(0, 0, cw, ch);
        const px = imgd.data;
        const tR = 0.022 + rand() * 0.005, tG = tR + 0.004, tB = tR + 0.014;  // putih → ~249/248/245
        for (let i = 0; i < px.length; i += 4) {
            const n = (rand() + rand() + rand() - 1.5) * o.noise * 255;  // derau brightness
            const c2 = (rand() + rand() - 1) * o.noise * 55;             // derau chroma lembut
            px[i]     = Math.min(255, Math.max(0, px[i]     * (1 - tR / 255 * px[i]) + n + c2));
            px[i + 1] = Math.min(255, Math.max(0, px[i + 1] * (1 - tG / 255 * px[i + 1]) + n));
            px[i + 2] = Math.min(255, Math.max(0, px[i + 2] * (1 - tB / 255 * px[i + 2]) + n - c2 * 0.6));
        }
        ctx.putImageData(imgd, 0, 0);

        // 7) vignette tepi jauh (bayang tutup scanner) — halus
        if (o.edgeShadow > 0) {
            const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.52, cw / 2, ch / 2, Math.hypot(cw, ch) * 0.58);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, `rgba(18,14,10,${o.edgeShadow * 0.85})`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, cw, ch);
        }

        // 8) debu & speckle (jumlah kecil per halaman)
        for (let i = 0; i < o.dust; i++) {
            const x = rand() * cw, y = rand() * ch;
            ctx.fillStyle = `rgba(30,25,20,${0.10 + rand() * 0.2})`;
            ctx.beginPath();
            ctx.arc(x, y, 0.4 + rand() * 1.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // 9) JPEG encode (artefak kompresi scanner)
        const jpg = ctx.canvas.toBuffer('image/jpeg', o.jpegQuality);
        const img = await out.embedJpg(jpg);
        const [pw, ph] = [vp.width / (o.dpi / 72), vp.height / (o.dpi / 72)];
        const p2 = out.addPage([pw, ph]);
        p2.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
    }

    if (typeof src.destroy === 'function') await src.destroy();
    else if (typeof src.cleanup === 'function') await src.cleanup();
    const bytes = Buffer.from(await out.save());
    return { bytes, pages: out.getPageCount() };
}

module.exports = { applyScanEffect, DEFAULTS };
