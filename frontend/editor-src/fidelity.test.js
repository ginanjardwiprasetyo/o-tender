/**
 * Tes fidelity editor template: style inline & token {{var}} harus selamat
 * dari pipeline CKEditor (kunci: plugin RawStyle di editor-src/rawstyle.js).
 *
 * Jalankan:  npm run build:editor && npm run test:editor
 * Exit code 1 = ada style yang hilang (template akan rusak saat disimpan).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const INPUT = [
    '<h3 style="text-align:center; font-size:14pt; margin-bottom:20px; text-decoration:underline; text-transform:uppercase;">PAKTA INTEGRITAS</h3>',
    '<p style="text-align:right;">Sleman, 15 Mei 2026</p>',
    '<p style="line-height:1.8; text-align:justify;">Isi paragraf <b>tebal</b> untuk {{nama_perusahaan}}.</p>',
    '<table style="width:100%; border-collapse:collapse; margin-bottom:15px;"><thead><tr><th style="border:1px solid #000; padding:6px; width:50%; text-align:center; background:#f2f2f2;">No</th></tr></thead><tbody><tr><td style="border:1px solid #000; padding:6px; background:#f2f2f2; text-align:left;">1</td></tr></tbody></table>',
    '<ol style="line-height:1.8;"><li>item satu</li></ol>',
    '<h4 style="text-align:center; font-size:11pt; margin-top:0; font-weight:normal; color:#333; text-transform:uppercase;">Judul Kecil</h4>',
    '<div style="background:#f9f9f9; padding:12px; border:1px solid #ccc; font-size:11pt; border-radius:4px;">Kotak</div>'
].join('');

const vendor = path.join(__dirname, '..', 'vendor', 'ckeditor5');
const js = fs.readFileSync(path.join(vendor, 'ckeditor.js'), 'utf8');
const css = fs.readFileSync(path.join(vendor, 'ckeditor.css'), 'utf8');
const html = `<!doctype html><html><head><style>${css}</style></head><body><div id="e"></div><script>${js}</script></body></html>`;

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
if (!w.ResizeObserver) w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
w.Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 });
w.Range.prototype.getClientRects = () => [];
w.document.execCommand = () => {};

const CHECKS = {
    'h3 text-align:center': /text-align:center/,
    'h3 font-size': /font-size:14pt/,
    'h3 underline': /text-decoration/,
    'h3 text-transform': /text-transform:uppercase/,
    'h3 margin-bottom': /margin-bottom/,
    'p text-align:right': /text-align:right/,
    'p line-height': /line-height:1\.8/,
    'token {{nama_perusahaan}}': /\{\{nama_perusahaan\}\}/,
    'td/th border': /border:1px solid #000/,
    'cell background': /background:#f2f2f2/,
    'th width': /width:50%/,
    'table border-collapse': /border-collapse/,
    'list line-height': /line-height:1\.8/,
    'h4 color': /color:#333/,
    'h4 font-weight': /font-weight/,
    'div border-radius': /border-radius:4px/
};

(async () => {
    console.log('create editor...');
    const ed = await w.ClassicEditor.create(w.document.getElementById('e'), { licenseKey: 'GPL' });
    ed.setData(INPUT);
    const out = ed.getData();
    let fail = 0;
    console.log('--- fidelity checks ---');
    for (const [name, re] of Object.entries(CHECKS)) {
        const ok = re.test(out);
        if (!ok) fail++;
        console.log((ok ? 'KEEP ' : 'LOST ') + name);
    }

    // text-align th/td milik tabel (bukan Alignment) — harus selamat supaya editor ↔ preview sinkron
    const thTag = (out.match(/<th(?=[\s>])[^>]*>/) || [''])[0];
    const tdTag = (out.match(/<td(?=[\s>])[^>]*>/) || [''])[0];
    const cellAlignOk = /text-align:center/.test(thTag) && /text-align:left/.test(tdTag);
    if (!cellAlignOk) fail++;
    console.log((cellAlignOk ? 'KEEP ' : 'LOST ') + 'th/td text-align selamat (' + thTag.slice(0, 90) + ')');

    // UI: tombol Alignment harus mengubah data (tanpa ditimpa style mentah)
    try {
        const model = ed.model;
        let target = null;
        for (const el of model.document.getRoot().getChildren()) {
            if (el.is && el.is('element') && el.getAttribute('alignment') === 'right') { target = el; break; }
        }
        if (!target) throw new Error('paragraf text-align:right tidak ditemukan di model');
        model.change(writer => {
            writer.setSelection(model.createRange(
                model.createPositionAt(target, 0),
                model.createPositionAt(target, target.endOffset)
            ));
        });
        ed.execute('alignment', { value: 'center' });
        const p = (ed.getData().match(/<p[^>]*>Sleman[^<]*/) || [''])[0];
        const ok = /text-align:center/.test(p) && !/text-align:right/.test(p);
        if (!ok) fail++;
        console.log((ok ? 'KEEP ' : 'LOST ') + 'UI alignment → data (' + p.slice(0, 90) + ')');
    } catch (e) {
        fail++;
        console.log('LOST UI alignment: ' + e.message);
    }

    // tombol Tanpa Border: border:none di data (tabel + sel), toggle lagi → border default balik
    try {
        if (!ed.ui.componentFactory.has('toggleTableBorder')) throw new Error('toggleTableBorder tidak terdaftar');
        const root2 = ed.model.document.getRoot();
        let table2 = null;
        for (const el of root2.getChildren()) if (el.is && el.is('element', 'table')) { table2 = el; break; }
        if (!table2) throw new Error('tabel tidak ada di model');
        const cell2 = table2.getChild(0).getChild(0);
        ed.model.change(writer => writer.setSelection(writer.createPositionAt(cell2, 0)));
        const toggleBtn = await ed.ui.componentFactory.create('toggleTableBorder');
        toggleBtn.fire('execute');
        const hid = ed.getData();
        const hideOk = (hid.match(/border:none/g) || []).length >= 3 && /border-collapse/.test(hid);
        if (!hideOk) fail++;
        console.log((hideOk ? 'KEEP ' : 'LOST ') + 'toggle → border:none di tabel+sel, border-collapse utuh');
        toggleBtn.fire('execute');
        const shown = ed.getData();
        const showOk = !/border:none/.test(shown) && (shown.match(/border:1px solid #000/g) || []).length >= 2 && /border-collapse/.test(shown);
        if (!showOk) fail++;
        console.log((showOk ? 'KEEP ' : 'LOST ') + 'toggle lagi → border default kembali');
    } catch (e) {
        fail++;
        console.log('LOST toggle border: ' + e.message);
    }

    // visual di editing view juga harus menampilkan style
    const view = w.document.querySelector('.ck-content');
    const viewOk = /text-align:\s*right|text-align:\s*center/.test(view.innerHTML)
        && /border/.test(view.innerHTML)
        && /text-transform/.test(view.innerHTML);
    if (!viewOk) fail++;
    console.log((viewOk ? 'KEEP ' : 'LOST ') + 'style tampil di editing view');

    console.log(fail ? `RESULT: ${fail} GAGAL` : 'RESULT: ALL KEPT');
    process.exit(fail ? 1 : 0);
})().catch(e => {
    console.error('ERR', e.message);
    process.exit(1);
});
