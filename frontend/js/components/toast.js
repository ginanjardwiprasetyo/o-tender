/**
 * TenderBuild — Toast Notification Component
 */
const Toast = {
    container: null,

    init() {
        this.container = document.getElementById('toast-container');
    },

    show(message, type = 'info', duration = 4000) {
        if (!this.container) this.init();
        // ponytail: notif baru menggantikan sticky lama (sticky bertahan hingga notif berikutnya)
        this.container.querySelectorAll('.toast-sticky').forEach(t => t.remove());
        const icons = {
            success: 'check-circle-2',
            error: 'alert-circle',
            warning: 'alert-triangle',
            info: 'info'
        };
        const toast = document.createElement('div');
        toast.className = `toast ${type}` + (duration === Infinity ? ' toast-sticky' : '');
        toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><span>${message}</span>`;
        this.container.appendChild(toast);
        if (window.lucide) lucide.createIcons({ nodes: [toast] });
        if (duration === Infinity) return toast;
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    warning(msg) { this.show(msg, 'warning'); },
    info(msg) { this.show(msg, 'info'); },
    // ponytail: notif menetap (mis. PDF jadi + link) hingga notif berikutnya datang
    sticky(msg, type = 'success') { this.show(msg, type, Infinity); }
};
