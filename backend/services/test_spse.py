from DrissionPage import ChromiumPage, ChromiumOptions
import time
co = ChromiumOptions()
co.set_argument('--headless=new')
page = ChromiumPage(co)
page.get("https://spse.padang.go.id/eproc4/lelang?kategoriId=2&tahun=2024")
time.sleep(5)
print(len(page.eles('tag:table')))
tables = page.eles('tag:table')
for t in tables:
    print(t.attr('id'), t.attr('class'))
page.quit()
