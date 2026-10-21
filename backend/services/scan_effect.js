/**
 * Efek "scan" untuk PDF — bikin dokumen hasil generate terlihat seperti hasil pindai.
 *
 * Pendekatan: rasterize tiap halaman (pdf.js → canvas), terapkan pipeline efek
 * (paper tone → defocus → grain → speckle → vignette → skew → JPEG), lalu bangun
 * ulang PDF (pdf-lib). Teks jadi image-only — konsekuensi wajar "scan penuh".
 *
 * Tanpa dependency baru: pdfjs-dist + @napi-rs/canvas + pdf-lib sudah ada.
 */
require('./node_compat');   // shim Promise.withResolvers utk Node < 22
const crypto = require('crypto');
const { createCanvas } = require('@napi-rs/canvas');
const { PDFDocument } = require('pdf-lib');

const DEFAULTS = {
    dpi: 150,          // resolusi raster (72 = 1pt)
    blur: 0.4,         // defocus gaussian (px)
    grayscale: 0.4,    // 0..1 → progressively grey
    sepia: 0.18,       // 0..1 → warna kertas hangat
    paperTone: 0.12,   // 0..1 → overlay tinta hangat (multiply)
    grain: 0.08,       // 0..1 → intensitas butiran kertas
    speckle: 0.00012,  // fraksi piksel → titik debu
    edgeShadow: 0.15,  // 0..1 → vignette tepi (bayang tutup scanner)
    skew: 0.6,         // maks derajat kemiringan per halaman
    jpegQuality: 70,   // 1..100 → artefak kompresi
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

        // 1) render halaman
        const raster = createCanvas(w, h);
        const rctx = raster.getContext('2d');
        rctx.fillStyle = '#ffffff';
        rctx.fillRect(0, 0, w, h);
        await page.render({ canvasContext: rctx, viewport: vp }).promise;

        // 2) kemiringan (bikin ruang extra biar tidak terpotong)
        const ang = (rand() * 2 - 1) * (o.skew * Math.PI / 180);
        const cosA = Math.abs(Math.cos(ang)), sinA = Math.abs(Math.sin(ang));
        const padX = Math.ceil((cosA * w + sinA * h - w) / 2) + 4;
        const padY = Math.ceil((sinA * w + cosA * h - h) / 2) + 4;
        const cw = w + padX * 2;
        const ch = h + padY * 2;
        const skewC = createCanvas(cw, ch);
        const sctx = skewC.getContext('2d');
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(0, 0, cw, ch);
        sctx.translate(cw / 2, ch / 2);
        sctx.rotate(ang);
        sctx.drawImage(raster, -w / 2, -h / 2, w, h);
        sctx.setTransform(1, 0, 0, 1, 0, 0);

        // 3) defocus + grey + sepia (gambar ke diri sendiri → blur)
        const soft = createCanvas(cw, ch);
        const softCtx = soft.getContext('2d');
        softCtx.fillStyle = '#ffffff';
        softCtx.fillRect(0, 0, cw, ch);
        softCtx.filter = `grayscale(${o.grayscale}) sepia(${o.sepia}) blur(${o.blur}px)`;
        softCtx.drawImage(skewC, 0, 0);
        softCtx.filter = 'none';

        const ctx = soft.getContext('2d');

        // 4) paper tone (multiply →insic warmer, seperti kertas foto)
        if (o.paperTone > 0) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = `rgba(250,242,224,${o.paperTone})`;
            ctx.fillRect(0, 0, cw, ch);
            ctx.globalCompositeOperation = 'source-over';
        }

        // 5) grain (butiran kertas)
        if (o.grain > 0) {
            const n = Math.round(cw * ch * o.grain * 0.15);
            for (let i = 0; i < n; i++) {
                const x = rand() * cw, y = rand() * ch;
                const dark = rand() > 0.45;
                ctx.fillStyle = dark
                    ? `rgba(40,35,30,${0.03 + rand() * 0.07})`
                    : `rgba(255,255,255,${0.03 + rand() * 0.06})`;
                ctx.fillRect(x, y, 1 + (rand() > 0.85 ? 1 : 0), 1);
            }
        }

        // 6) speckle debu
        if (o.speckle > 0) {
            const n = Math.round(cw * ch * o.speckle);
            for (let i = 0; i < n; i++) {
                const x = rand() * cw, y = rand() * ch;
                const r = 0.4 + rand() * 1.4;
                ctx.fillStyle = `rgba(30,25,20,${0.10 + rand() * 0.22})`;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 7) vignette tepi (bayang tutup scanner)
        if (o.edgeShadow > 0) {
            const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.28, cw / 2, ch / 2, Math.hypot(cw, ch) * 0.55);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, `rgba(0,0,0,${o.edgeShadow})`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, cw, ch);
        }

        // 8) JPEG (artefak kompresi scanner)
        const jpg = soft.toBuffer('image/jpeg', o.jpegQuality);
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
