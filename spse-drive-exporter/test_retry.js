// Cek cepat retry — jalankan: node test_retry.js (dari spse-drive-exporter/)
const assert = require('assert');
const withRetry = require('./retry.js');

(async () => {
  const noSleep = async () => {};

  // 1) gagal 2x lalu sukses → hasil sukses, 3 panggilan
  let calls = 0;
  const retries = [];
  const ok = await withRetry(async () => {
    calls++;
    if (calls < 3) throw new Error('sementara');
    return 'HASIL';
  }, { tries: 3, sleep: noSleep, onRetry: (i, e) => retries.push([i, e.message]) });
  assert.strictEqual(ok, 'HASIL');
  assert.strictEqual(calls, 3);
  assert.deepStrictEqual(retries, [[1, 'sementara'], [2, 'sementara']]);

  // 2) gagal terus → lempar error terakhir, tepat sebanyak `tries`
  calls = 0;
  await assert.rejects(
    withRetry(async () => { calls++; throw new Error('mati'); }, { tries: 3, sleep: noSleep }),
    /mati/
  );
  assert.strictEqual(calls, 3);

  // 3) tries=1 → langsung lempar tanpa retry
  calls = 0;
  await assert.rejects(
    withRetry(async () => { calls++; throw new Error('sekali'); }, { tries: 1, sleep: noSleep }),
    /sekali/
  );
  assert.strictEqual(calls, 1);

  console.log('OK: withRetry - 3 kasus lulus');
})().catch((e) => { console.error(e); process.exit(1); });
