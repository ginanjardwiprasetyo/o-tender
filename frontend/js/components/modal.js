/**
 * TenderBuild — Modal Component
 */
const Modal = {
    overlay: null,
    titleEl: null,
    bodyEl: null,
    footerEl: null,

    init() {
        this.overlay = document.getElementById('modal-overlay');
        this.titleEl = document.getElementById('modal-title');
        this.bodyEl = document.getElementById('modal-body');
        this.footerEl = document.getElementById('modal-footer');
        document.getElementById('modal-close').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    },

    open(title, bodyHTML, footerHTML = '', opts = {}) {
        if (!this.overlay) this.init();
        this.titleEl.textContent = title;
        this.bodyEl.innerHTML = bodyHTML;
        this.footerEl.innerHTML = footerHTML;
        // Ukuran menyesuaikan konten bila diminta (mis. popup alasan)
        this.overlay.querySelector('.modal').style.maxWidth = opts.maxWidth || '';
        this.overlay.classList.remove('hidden');
        if (window.lucide) lucide.createIcons({ nodes: [this.bodyEl, this.footerEl] });
        // Focus first input if present
        const firstInput = this.bodyEl.querySelector('input, select, textarea');
        if (firstInput) setTimeout(() => firstInput.focus(), 100);
    },

    close() {
        if (this.overlay) this.overlay.classList.add('hidden');
        document.dispatchEvent(new CustomEvent('modal:close'));
    },

    /**
     * Dialog konfirmasi — dipakai utk SEMUA aksi hapus (keamanan).
     * @param {string} title
     * @param {string} message  penjelasan (plain text / html)
     * @param {Function} onConfirm  aksi async (boleh async → tombol disabled sblm selesai)
     * @param {object} opts  { confirmLabel, cancelLabel, tone:'danger'|'warning', detail, icon }
     *        `detail` = nama item yg dihapus → otomatis di-escape (bisa berisi data user)
     */
    confirm(title, message, onConfirm, opts = {}) {
        const tone = opts.tone || 'danger';
        const icon = opts.icon || (tone === 'warning' ? 'alert-triangle' : 'trash-2');
        const confirmLabel = opts.confirmLabel || (tone === 'warning' ? 'Ya, Lanjutkan' : 'Ya, Hapus');
        const detail = opts.detail ? Fmt.escape(String(opts.detail)) : '';
        const body = `
        <div class="modal-confirm">
            <div class="modal-confirm-icon ${tone}"><i data-lucide="${icon}"></i></div>
            <div class="modal-confirm-text">
                <p>${message}</p>
                ${detail ? `<div class="modal-confirm-detail"><i data-lucide="info"></i><span>${detail}</span></div>` : ''}
            </div>
        </div>`;
        const footer = `
            <button class="btn btn-secondary" id="modal-cancel-btn">${opts.cancelLabel || 'Batal'}</button>
            <button class="btn btn-danger" id="modal-confirm-btn">
                <i data-lucide="${icon}"></i> ${confirmLabel}
            </button>`;
        this.open(title, body, footer, { maxWidth: '440px' });
        const btn = document.getElementById('modal-confirm-btn');
        const cancel = document.getElementById('modal-cancel-btn');
        // Fokus ke "Batal" → Enter/ESC tidak langsung menghapus
        if (cancel) setTimeout(() => cancel.focus(), 60);
        btn.addEventListener('click', async () => {
            // Kunci tombol biar ga bisa dobel-klik saat proses berjalan
            btn.disabled = true;
            const html = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-sm"></span> Memproses...';
            try {
                await onConfirm();
                this.close();
            } catch (e) {
                btn.disabled = false;
                btn.innerHTML = html;
                if (window.Toast) Toast.error(e.message || 'Gagal menghapus');
            }
        });
    }
};
