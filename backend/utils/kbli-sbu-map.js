/**
 * KBLI → SBU mapping (sumber: https://infiniti.id/subklasifikasi-konstruksi)
 * Dipakai untuk infer SBU ketika pengumuman hanya mencantumkan KBLI/NIB
 * dan/atau ada typo / format aneh seperti "BG002KBLI 41012".
 */
const KBLI_TO_SBU = require('../data/kbli-sbu.json');

// ponytail: keep regex broad — legacy SBU prefixes (EL,ME,MK,SP,TI,PR,EE,SE,RE,RK,KP,KK) + new GT/ST/PA/IN/AR/AL/AT/IT
const SBU_PREFIXES = 'BG|BS|PL|PB|GT|ST|KP|KK|RK|RE|EL|ME|SP|TI|MK|PR|EE|SE|AR|AL|AT|IT|IN|PA';
const SBU_REGEX = new RegExp('\\b(' + SBU_PREFIXES + ')[\\s-]*0*(\\d{1,3})\\b', 'gi');

function normalizeSbuText(text) {
  if (!text) return '';
  // "BG002KBLI" -> "BG002 KBLI", "BG009KBLI 41019" split
  return String(text).replace(/([A-Z]{2}\d{1,3})(KBLI|NIB|SBU)/gi, '$1 $2');
}

function extractSbuCodes(text) {
  if (!text || text === '-') return [];
  const norm = normalizeSbuText(text);
  const codes = [];
  let m;
  SBU_REGEX.lastIndex = 0;
  while ((m = SBU_REGEX.exec(norm)) !== null) {
    const code = m[1].toUpperCase() + m[2].padStart(3, '0');
    if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

function extractKbliCodes(text) {
  if (!text) return [];
  const str = String(text);
  const hasKbliContext = /KBLI|NIB/i.test(str);
  const found = new Set();

  // 1) KBLI-anchored: "KBLI 41012", "KBLI:41012", "KBLI- 41012"
  const anchored = /KBLI[^\d]{0,10}(\d{5})/gi;
  let m;
  while ((m = anchored.exec(str)) !== null) {
    const k = m[1];
    if (KBLI_TO_SBU[k]) found.add(k);
    else if (/^\d{5}$/.test(k)) found.add(k); // unknown KBLI still keep
  }

  // 2) Any 5-digit that is a known KBLI — but only if document mentions KBLI/NIB at all
  //    avoids picking up harga/tahun. Also handles "41012 atau 41019" where second has no prefix.
  if (hasKbliContext) {
    const all5 = str.match(/\b\d{5}\b/g) || [];
    for (const n of all5) {
      if (KBLI_TO_SBU[n]) found.add(n);
    }
  }

  // 3) Fallback without KBLI keyword: if a known KBLI appears next to SBU-ish context like "Klasifikasi", keep it
  if (!hasKbliContext) {
    const all5 = str.match(/\b\d{5}\b/g) || [];
    for (const n of all5) {
      if (KBLI_TO_SBU[n]) {
        // only if flanked by construction words to avoid noise
        const idx = str.indexOf(n);
        const ctx = str.substring(Math.max(0, idx - 40), idx + 40).toLowerCase();
        if (ctx.includes('klasifikasi') || ctx.includes('konstruksi') || ctx.includes('gedung') || ctx.includes('kualifikasi')) {
          found.add(n);
        }
      }
    }
  }

  return [...found];
}

function sbusFromKbli(kbliList) {
  const out = [];
  for (const k of kbliList) {
    const sbus = KBLI_TO_SBU[k] || [];
    for (const s of sbus) if (!out.includes(s)) out.push(s);
  }
  return out;
}

/**
 * Resolve SBU from raw text: coba kode SBU langsung, lalu fallback/merge via KBLI.
 * Selalu merge keduanya (union) supaya "BG002KBLI 41012" tetap dapat BG002 + GT002 dari KBLI.
 */
function resolveSbu(text) {
  if (!text || text === '-') return [];
  const direct = extractSbuCodes(text);
  const kbliCodes = extractKbliCodes(text);
  const viaKbli = sbusFromKbli(kbliCodes);
  const merged = [...direct];
  for (const s of viaKbli) if (!merged.includes(s)) merged.push(s);
  return merged;
}

function resolveSbuString(text) {
  const arr = resolveSbu(text);
  return arr.length ? arr.join(', ') : '-';
}

module.exports = {
  KBLI_TO_SBU,
  extractSbuCodes,
  extractKbliCodes,
  sbusFromKbli,
  resolveSbu,
  resolveSbuString,
};
