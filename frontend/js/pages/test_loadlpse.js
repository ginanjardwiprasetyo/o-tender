// Check: loadLPSE — gagal sekali tetap bisa retry; panggilan paralel di-coalesce jadi 1 request; silent tanpa toast
const fs = require('fs');
const path = require('path');
const assert = require('assert');

let calls = 0, failNext = true;
global.API = { getLPSEList: () => { calls++; return failNext ? Promise.reject(new Error('down')) : Promise.resolve({ data: [{ kd_lpse: '1', nama_lpse: 'A' }] }); } };
const toasts = [];
global.Toast = { error: (m) => toasts.push(m) };

const src = fs.readFileSync(path.join(__dirname, 'tender-browse.js'), 'utf8');
const Page = new Function(src + '; return TenderBrowsePage;')();

(async () => {
    await Page.loadLPSE(true);
    assert.strictEqual(Page._lpseLoaded, false, 'gagal → belum loaded');
    assert.strictEqual(calls, 1);

    failNext = false;
    await Promise.all([Page.loadLPSE(true), Page.loadLPSE(true), Page.loadLPSE(true)]);
    assert.strictEqual(calls, 2, '3 panggilan paralel = 1 request retry');
    assert.strictEqual(Page._lpseLoaded, true);
    assert.strictEqual(Page.lpseList.length, 1);
    assert.strictEqual(toasts.length, 0, 'silent tidak memunculkan toast');

    await Page.loadLPSE();
    assert.strictEqual(calls, 2, 'sudah loaded → tanpa request baru');
    console.log('OK test_loadlpse');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
