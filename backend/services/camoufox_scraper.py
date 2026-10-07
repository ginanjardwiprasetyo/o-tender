#!/usr/bin/env python3
"""
Camoufox scraper - Firefox-based anti-detection browser.
Dipanggil dari Node.js via child_process:
  python3 camoufox_scraper.py --type list|detail --url URL --year YEAR
Output: JSON ke stdout, log diagnostik ke stderr.
"""

import sys, json, re, time, os
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--type', default='list')
parser.add_argument('--url', default='')
parser.add_argument('--year', default='')
args = parser.parse_args()

TYPE = args.type
URL = args.url
YEAR = args.year


def parse_currency(val):
    if not val:
        return 0
    s = str(val).lower().replace('rp', '').replace('.', '').replace(',', '.').strip()
    m = re.search(r'([\d.]+)\s*(t|m|jt|rb)\b', s)
    if m:
        n, u = float(m.group(1)), m.group(2)
        mul = {'t': 1e12, 'm': 1e9, 'jt': 1e6, 'rb': 1e3}.get(u, 1)
        return round(n * mul)
    m2 = re.search(r'[\d]+', s.split(',')[0])
    return int(m2.group()) if m2 else 0


def extract_sbu(text):
    if not text or text == '-':
        return '-'
    try:
        import importlib.util, os as _os
        spec = importlib.util.spec_from_file_location(
            "kbli_sbu_map",
            _os.path.join(_os.path.dirname(__file__), '../utils/kbli-sbu-map.js')
        )
        # JS not importable from Python — use regex fallback
        raise ImportError
    except Exception:
        pattern = r'\b(BG|BS|PL|PB|GT|ST|KP|KK|RK|RE|EL|ME|SP|TI|MK|PR|EE|SE|AR|AL|AT|IT|IN|PA)\s*0*(\d{1,3})\b'
        codes = []
        for m in re.finditer(pattern, text, re.IGNORECASE):
            code = m.group(1).upper() + m.group(2).zfill(3)
            if code not in codes:
                codes.append(code)
        return ', '.join(codes) if codes else '-'


def wait_for_cf(page, max_secs=30):
    """Tunggu halaman sampai lepas dari Cloudflare challenge."""
    for _ in range(max_secs):
        try:
            title = page.title()
            if not re.search(r'just a moment|verifikasi singkat', title, re.IGNORECASE):
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


try:
    from camoufox.sync_api import Camoufox
except ImportError:
    print(json.dumps({'error': 'camoufox_not_installed'}))
    sys.exit(0)


def scrape_list(browser, url):
    intercepted = []

    ctx = browser.new_context()
    page = ctx.new_page()

    def handle_response(response):
        if 'dt/lelang' in response.url or 'lelang/data' in response.url:
            try:
                data = response.json()
                if data and data.get('data'):
                    intercepted.extend(data['data'])
            except Exception:
                pass

    page.on('response', handle_response)
    try:
        page.goto(url, wait_until='domcontentloaded', timeout=60000)
    except Exception as e:
        print(f'[camoufox:list] goto error: {e}', file=sys.stderr)

    wait_for_cf(page, 30)

    # Tunggu sampai intercepted terisi (maks 30 detik lagi)
    for _ in range(30):
        if intercepted:
            break
        time.sleep(1)

    page.close()
    ctx.close()

    if intercepted:
        results = []
        for row in intercepted:
            if not isinstance(row, list) or len(row) < 11:
                continue
            kode = str(row[0]).strip()
            nama = re.sub(r'<[^>]*>', '', str(row[1] or '')).strip()
            results.append({
                'Kode Tender': kode,
                'kode_tender': kode,
                'Nama Paket': nama,
                'Instansi': row[2] or '',
                'Pagu': parse_currency(row[4]),
                'HPS': parse_currency(row[10] if len(row) > 10 else row[4]),
                'Status_Tender': row[3] or '',
                'Kategori Pekerjaan': 'Pekerjaan Konstruksi',
                'SBU': '-',
                'Batas Upload': '-',
            })
        print(json.dumps(results))
    else:
        print(json.dumps([]))
        try:
            title = page.title()
            print(f'[camoufox:list] NO_DATA title="{title}"', file=sys.stderr)
        except Exception:
            print('[camoufox:list] NO_DATA (page closed)', file=sys.stderr)


def scrape_detail(browser, url):
    url_parts = url.split('/')
    home_url = '/'.join(url_parts[:4]) + '/lelang'

    ctx = browser.new_context()
    page = ctx.new_page()

    try:
        # Buka homepage dulu (dapat cookies/session)
        page.goto(home_url, wait_until='domcontentloaded', timeout=30000)
        wait_for_cf(page, 20)

        page.goto(url, wait_until='domcontentloaded', timeout=30000)
        wait_for_cf(page, 15)

        try:
            title = page.title()
            body_text = page.inner_text('body')
        except Exception:
            print(json.dumps({'error': 'page_closed'}))
            return

        if re.search(r'just a moment|verifikasi singkat', title, re.IGNORECASE):
            print(json.dumps({'error': 'Cloudflare_Challenge: masih diblokir setelah 15 detik'}))
            return

        if re.search(r'akses ditolak|anda tidak diizinkan', body_text, re.IGNORECASE):
            print(json.dumps({'error': 'Akses Ditolak (WAF SPSE)'}))
            return

        # Parse tabel detail
        sbu, pagu, hps = '', '', ''
        details = {}

        rows = page.query_selector_all('table tr')
        for row in rows:
            cells = row.query_selector_all('th, td')
            pairs = []
            n = len(cells)
            if n == 2:
                pairs.append((cells[0].inner_text().strip(), cells[1].inner_text().strip()))
            elif n >= 4:
                for i in range(0, n - 1, 2):
                    pairs.append((cells[i].inner_text().strip(), cells[i+1].inner_text().strip()))
            elif n == 3:
                pairs.append((cells[0].inner_text().strip(), cells[2].inner_text().strip()))

            for label, value in pairs:
                if label and value and label != value:
                    details[label] = value
                lbl = label.lower()
                if 'sbu' in lbl or 'sertifikat badan usaha' in lbl:
                    sbu = value
                elif 'nilai pagu' in lbl or lbl == 'pagu':
                    pagu = value
                elif 'nilai hps' in lbl or lbl == 'hps':
                    hps = value

        # Jadwal - batas upload
        batas_upload = ''
        jadwal_url = url.replace('/pengumumanlelang', '/jadwal')
        try:
            page.goto(jadwal_url, wait_until='domcontentloaded', timeout=20000)
            wait_for_cf(page, 10)
            jadwal_rows = page.query_selector_all('tr')
            for r in jadwal_rows:
                cells = r.query_selector_all('td')
                if len(cells) >= 4:
                    stage = cells[1].inner_text().strip().lower()
                    end = cells[3].inner_text().strip()
                    if 'upload' in stage and 'penawaran' in stage:
                        batas_upload = end
                        break
        except Exception:
            pass

        # Gabungkan SBU dari teks syarat kualifikasi jika ada
        qual_idx = body_text.find('Syarat Kualifikasi')
        qual_text = body_text[qual_idx + 18:qual_idx + 3018] if qual_idx >= 0 else ''
        sbu_source = ' '.join(filter(None, [sbu, qual_text]))
        sbu_resolved = extract_sbu(sbu_source or sbu)

        result = {
            'sbu': sbu_resolved,
            'pagu': pagu,
            'hps': hps,
            'batas_upload': batas_upload,
            'details': details,
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({'error': str(e)}))
    finally:
        try:
            page.close()
            ctx.close()
        except Exception:
            pass


# headless=False bila ada DISPLAY (xvfb di Actions), headless bila tidak
headless = not bool(os.environ.get('DISPLAY'))

try:
    with Camoufox(headless=headless) as browser:
        if TYPE == 'list':
            scrape_list(browser, URL)
        else:
            scrape_detail(browser, URL)
except Exception as e:
    print(json.dumps({'error': str(e)}))
