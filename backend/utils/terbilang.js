function terbilang(n) {
  const angka = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
  if (n === 0) return 'nol rupiah';
  function baca(m) {
    if (m < 10) return angka[m];
    if (m < 20) {
      if (m === 10) return 'sepuluh';
      if (m === 11) return 'sebelas';
      return angka[m - 10] + ' belas';
    }
    if (m < 100) return angka[Math.floor(m / 10)] + ' puluh' + (m % 10 ? ' ' + angka[m % 10] : '');
    if (m < 1000) return (Math.floor(m / 100) === 1 ? 'seratus' : angka[Math.floor(m / 100)] + ' ratus') + (m % 100 ? ' ' + baca(m % 100) : '');
    return '';
  }
  let ret = '';
  const satuan = ['', 'ribu', 'juta', 'miliar', 'triliun'];
  let i = 0;
  while (n > 0) {
    const part = n % 1000;
    if (part) {
      if (i === 1 && part === 1) ret = 'seribu' + (ret ? ' ' + ret : '');
      else {
        const s = baca(part);
        ret = s + (satuan[i] ? ' ' + satuan[i] : '') + (ret ? ' ' + ret : '');
      }
    }
    n = Math.floor(n / 1000);
    i++;
  }
  return ret.trim() + ' rupiah';
}
module.exports = { terbilang };
