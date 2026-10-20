// Retry sederhana utk kegagalan sementara (jaringan, 5xx, 429, token expired).
// Dipakai background.js (importScripts) dan test_retry.js (node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.withRetry = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return async function withRetry(fn, opts) {
    const { tries = 3, delayMs = 1000, sleep, onRetry } = opts || {};
    const wait = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (attempt >= tries) throw e;
        if (onRetry) onRetry(attempt, e);
        await wait(delayMs * attempt);
      }
    }
  };
});
