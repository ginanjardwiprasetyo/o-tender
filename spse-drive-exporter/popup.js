document.addEventListener('DOMContentLoaded', () => {
  const destNameEl = document.getElementById('destName');
  const btnPick = document.getElementById('btnPick');
  const picker = document.getElementById('picker');
  const btnUp = document.getElementById('btnUp');
  const breadcrumb = document.getElementById('breadcrumb');
  const folderSearch = document.getElementById('folderSearch');
  const folderList = document.getElementById('folderList');
  const btnUseHere = document.getElementById('btnUseHere');
  const btnCancelPick = document.getElementById('btnCancelPick');
  const btnProcess = document.getElementById('btnProcess');
  const statusDiv = document.getElementById('status');

  let dest = { id: '', name: 'My Drive', path: ['My Drive'] };
  // navigasi: stack folder yang sedang dibuka di picker
  let nav = { id: '', name: 'My Drive', trail: [] }; // trail = ancestor sampai (id,name)
  let currentFolders = [];
  let loadToken = 0;

  function setStatus(text, cls) {
    statusDiv.textContent = text || '';
    statusDiv.className = cls || '';
  }

  // path penuh utk "Folder tujuan": ['My Drive', 'A', 'B', ...]
  function trailPath(trail, leaf) {
    if (!leaf || leaf === 'My Drive') return ['My Drive'];
    const names = trail.map((t) => t.name).filter((n) => n && n !== 'My Drive');
    return ['My Drive', ...names, leaf];
  }

  function renderDest() {
    const parts = dest.path && dest.path.length ? dest.path : trailPath([], dest.name);
    destNameEl.innerHTML = parts
      .map((p, i) => (i === 0 ? '<span class="root">' + escapeHtml(p) + '</span>' : escapeHtml(p)))
      .join(' / ');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadDest() {
    const st = await chrome.storage.local.get([
      'savedParentId',
      'savedParentName',
      'savedParentPath'
    ]);
    dest = {
      id: st.savedParentId || '',
      name: st.savedParentName || 'My Drive',
      path: Array.isArray(st.savedParentPath) && st.savedParentPath.length
        ? st.savedParentPath
        : null
    };
    if (!dest.path) {
      dest.path = dest.id
        ? ['My Drive', dest.name]
        : ['My Drive'];
    }
    renderDest();

    if (dest.id) {
      // selalu rebuild path penuh dari parent Drive (data lama / path kurang)
      chrome.runtime.sendMessage({ action: 'GET_FOLDER_PATH', folderId: dest.id }, (res) => {
        if (chrome.runtime.lastError) return;
        if (res && res.success && Array.isArray(res.path) && res.path.length) {
          dest.path = res.path;
          dest.name = res.path[res.path.length - 1] || dest.name;
          renderDest();
          chrome.storage.local.set({
            savedParentName: dest.name,
            savedParentPath: dest.path
          });
        } else {
          chrome.runtime.sendMessage({ action: 'GET_FOLDER_META', folderId: dest.id }, (r2) => {
            if (chrome.runtime.lastError) return;
            if (r2 && r2.success && r2.meta && r2.meta.name) {
              dest.name = r2.meta.name;
              if (dest.path.length) dest.path[dest.path.length - 1] = dest.name;
              renderDest();
              chrome.storage.local.set({
                savedParentName: dest.name,
                savedParentPath: dest.path
              });
            }
          });
        }
      });
    }
  }

  loadDest();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.savedParentId) dest.id = changes.savedParentId.newValue || '';
    if (changes.savedParentName) dest.name = changes.savedParentName.newValue || 'My Drive';
    if (changes.savedParentPath) {
      dest.path = Array.isArray(changes.savedParentPath.newValue)
        ? changes.savedParentPath.newValue
        : trailPath([], dest.name);
    }
    if (changes.savedParentId || changes.savedParentName || changes.savedParentPath) {
      renderDest();
    }
  });

  // ── Picker navigation ──────────────────────────────────────
  function openPicker() {
    picker.style.display = 'block';
    nav = { id: '', name: 'My Drive', trail: [] };
    folderSearch.value = '';
    setStatus('Navigasi folder: klik untuk masuk, lalu "Pakai folder ini".', 'busy');
    loadFolderList('');
  }

  function closePicker() {
    picker.style.display = 'none';
  }

  function renderBreadcrumb() {
    breadcrumb.innerHTML = '';
    const crumbs = [...nav.trail, { id: nav.id, name: nav.name }];
    crumbs.forEach((c, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = ' / ';
        breadcrumb.appendChild(sep);
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.name;
      b.title = crumbs.map((x) => x.name).join(' / ');
      if (i === crumbs.length - 1) {
        b.className = 'current';
        b.disabled = true;
      } else {
        b.addEventListener('click', () => {
          nav.trail = crumbs.slice(0, i).map((x) => ({ id: x.id, name: x.name }));
          nav.id = c.id;
          nav.name = c.name;
          folderSearch.value = '';
          loadFolderList('');
        });
      }
      breadcrumb.appendChild(b);
    });
    // geser ke ujung kanan agar level terakhir (current) selalu terlihat
    requestAnimationFrame(() => {
      breadcrumb.scrollLeft = breadcrumb.scrollWidth;
    });
    btnUp.disabled = nav.trail.length === 0;
  }

  btnUp.addEventListener('click', () => {
    if (!nav.trail.length) return;
    const parent = nav.trail.pop();
    nav.id = parent.id;
    nav.name = parent.name;
    folderSearch.value = '';
    loadFolderList('');
  });

  async function loadFolderList(query) {
    const my = ++loadToken;
    folderList.innerHTML = '<div class="empty"><span class="loader"></span> Memuat folder...</div>';
    btnUseHere.disabled = true;
    renderBreadcrumb();

    chrome.runtime.sendMessage(
      { action: 'LIST_FOLDERS', parentId: nav.id, query: query || '' },
      (res) => {
        if (my !== loadToken) return; // stale
        if (chrome.runtime.lastError) {
          showPickerError('Error: ' + chrome.runtime.lastError.message);
          return;
        }
        if (!res || !res.success) {
          showPickerError(
            'Gagal: ' + ((res && res.error) || 'unknown') +
            '<br><span style="color:#64748b;">Butuh login Google ulang (scope folder).</span>'
          );
          return;
        }
        renderFolders(res.folders || []);
      }
    );
  }

  function showPickerError(html) {
    folderList.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'err';
    box.innerHTML = html;
    folderList.appendChild(box);

    const reauth = document.createElement('button');
    reauth.type = 'button';
    reauth.className = 'reauth-btn';
    reauth.textContent = 'Login Google ulang';
    reauth.addEventListener('click', async () => {
      folderList.innerHTML = '<div class="empty"><span class="loader"></span> Membuka login Google...</div>';
      const r = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'REAUTH' }, resolve);
      });
      if (r && r.success) {
        setStatus('Login OK.', 'ok');
        loadFolderList(folderSearch.value.trim());
      } else {
        showPickerError('Login gagal: ' + ((r && r.error) || 'unknown'));
      }
    });
    folderList.appendChild(reauth);
    setStatus('Gagal memuat folder.', 'err');
  }

  function renderFolders(folders) {
    currentFolders = folders;
    folderList.innerHTML = '';

    // "folder ini" = nav sekarang; selalu bisa dipakai (termasuk root)
    btnUseHere.disabled = false;
    btnUseHere.textContent = nav.id
      ? 'Pakai "' + truncate(nav.name, 22) + '"'
      : 'Pakai My Drive (root)';

    if (!folders.length) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'Folder kosong di sini. Kamu tetap bisa pakai folder ini.';
      folderList.appendChild(e);
      return;
    }

    for (const f of folders) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'row' + (f.id === dest.id ? ' selected' : '');
      row.innerHTML =
        '<span class="icon">📁</span>' +
        '<span class="name"></span>' +
        '<span class="go">→ masuk</span>';
      row.querySelector('.name').textContent = f.name;
      if (f.id === dest.id) row.querySelector('.go').textContent = '✓ tujuan';

      // klik = masuk ke folder
      row.addEventListener('click', () => {
        nav.trail.push({ id: nav.id, name: nav.name });
        nav.id = f.id;
        nav.name = f.name;
        folderSearch.value = '';
        loadFolderList('');
      });

      // double-click = langsung jadikan tujuan (path = trail + folder ini)
      row.addEventListener('dblclick', () => {
        chooseDest(f.id, f.name, trailPath(nav.trail, f.name));
      });

      folderList.appendChild(row);
    }

    // saat search: tampilkan path hasil (supaya tahu folder itu di mana)
    if (folderSearch.value.trim() && folders.length) {
      setStatus(
        folders.length + ' hasil pencarian di seluruh Drive.\n' +
        'Klik = masuk \u2022 Double-click = langsung jadi tujuan \u2022 "Pakai folder ini" = lokasi sekarang.',
        'busy'
      );
    } else {
      setStatus(
        'Lokasi: ' + nav.name + '\n' +
        'Klik folder untuk masuk \u2022 Double-click = jadi tujuan \u2022 "Pakai folder ini" untuk set.',
        'busy'
      );
    }
  }

  function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function chooseDest(id, name, pathArr) {
    dest = {
      id: id || '',
      name: name || 'My Drive',
      path: pathArr && pathArr.length ? pathArr : trailPath([], name || 'My Drive')
    };
    chrome.storage.local.set({
      savedParentId: dest.id,
      savedParentName: dest.name,
      savedParentPath: dest.path
    });
    renderDest();
    closePicker();
    setStatus(
      'Folder tujuan: ' + dest.path.join(' / ') + '\nExport berikutnya otomatis ke sini.',
      'ok'
    );
  }

  btnPick.addEventListener('click', openPicker);
  btnCancelPick.addEventListener('click', closePicker);
  btnUseHere.addEventListener('click', () => {
    if (btnUseHere.disabled) return;
    if (!nav.id) {
      chooseDest('', 'My Drive', ['My Drive']);
    } else {
      chooseDest(nav.id, nav.name, trailPath(nav.trail, nav.name));
    }
  });

  let searchTimer = null;
  folderSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadFolderList(folderSearch.value.trim()), 280);
  });

  // ── Upload ─────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action !== 'UPLOAD_PROGRESS') return;
    if (msg.finished) {
      if (msg.error) {
        setStatus('Selesai: ' + msg.error + ' (' + msg.done + '/' + msg.total + ')', 'err');
      } else {
        setStatus('Selesai! ' + msg.done + '/' + msg.total + ' file \u2192 ' + (msg.dest || dest.name), 'ok');
      }
      btnProcess.disabled = false;
      btnProcess.innerHTML = 'Mulai Unggah';
    } else {
      const pct = msg.total ? Math.round((msg.current / msg.total) * 100) : 0;
      btnProcess.disabled = true;
      btnProcess.innerHTML =
        '<span class="loader"></span> Upload ' + msg.current + '/' + msg.total +
        '<span class="pct">' + pct + '%</span>';
      setStatus('Mengunggah ke ' + (msg.dest || dest.name) + ' ...', 'busy');
    }
  });

  btnProcess.addEventListener('click', async () => {
    btnProcess.disabled = true;
    btnProcess.innerHTML = '<span class="loader"></span> Menganalisis halaman...';
    setStatus('Mengekstrak data dari halaman...', 'busy');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/spse\.inaproc\.id/i.test(tab.url)) {
      setStatus('Buka dulu halaman dokumen SPSE (.../dokumen/...).', 'err');
      btnProcess.disabled = false;
      btnProcess.innerHTML = 'Mulai Unggah';
      return;
    }

    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, files: ['content.js'] },
      (results) => {
        if (!results || !results[0] || !results[0].result) {
          setStatus('Gagal mengambil data dari halaman.', 'err');
          btnProcess.disabled = false;
          btnProcess.innerHTML = 'Mulai Unggah';
          return;
        }
        const { folderName, downloadUrls } = results[0].result;
        if (!downloadUrls.length) {
          setStatus('Tidak ditemukan tombol [Download] di halaman ini.', 'err');
          btnProcess.disabled = false;
          btnProcess.innerHTML = 'Mulai Unggah';
          return;
        }
        setStatus(
          downloadUrls.length + ' berkas \u2022 folder "' + folderName + '"\n' +
          'Tujuan: ' + dest.name + '\nMulai unggah...',
          'busy'
        );
        btnProcess.innerHTML = '<span class="loader"></span> Upload 0/' + downloadUrls.length + '<span class="pct">0%</span>';

        chrome.runtime.sendMessage(
          {
            action: 'START_UPLOAD',
            payload: {
              folderName,
              downloadUrls,
              parentFolderId: dest.id,
              parentFolderName: dest.name,
              parentFolderPath: dest.path
            }
          },
          (response) => {
            if (chrome.runtime.lastError) {
              setStatus('Error: ' + chrome.runtime.lastError.message, 'err');
              btnProcess.disabled = false;
              btnProcess.innerHTML = 'Mulai Unggah';
              return;
            }
            if (response && !response.success) {
              setStatus('Gagal: ' + response.error, 'err');
              btnProcess.disabled = false;
              btnProcess.innerHTML = 'Mulai Unggah';
            } else if (response && response.success) {
              setStatus(
                'Selesai! ' + response.done + '/' + response.total +
                (response.failed ? ' (' + response.failed + ' gagal)' : ''),
                response.failed ? 'err' : 'ok'
              );
              btnProcess.disabled = false;
              btnProcess.innerHTML = 'Mulai Unggah';
            }
          }
        );
      }
    );
  });
});
