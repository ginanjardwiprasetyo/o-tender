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

    open(title, bodyHTML, footerHTML = '') {
        if (!this.overlay) this.init();
        this.titleEl.textContent = title;
        this.bodyEl.innerHTML = bodyHTML;
        this.footerEl.innerHTML = footerHTML;
        this.overlay.classList.remove('hidden');
        if (window.lucide) lucide.createIcons({ nodes: [this.bodyEl, this.footerEl] });
        // Focus first input if present
        const firstInput = this.bodyEl.querySelector('input, select, textarea');
        if (firstInput) setTimeout(() => firstInput.focus(), 100);
    },

    close() {
        if (this.overlay) this.overlay.classList.add('hidden');
    },

    /** Convenience: confirm dialog */
    confirm(title, message, onConfirm) {
        const body = `<p style="color:var(--text-secondary);font-size:0.9rem;">${message}</p>`;
        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Batal</button>
            <button class="btn btn-danger" id="modal-confirm-btn">Ya, Lanjutkan</button>
        `;
        this.open(title, body, footer);
        document.getElementById('modal-confirm-btn').addEventListener('click', () => {
            onConfirm();
            this.close();
        });
    }
};
