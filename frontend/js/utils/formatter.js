/**
 * TenderBuild — Utility Formatters
 */
const Fmt = {
    /** Format number as Indonesian Rupiah */
    rupiah(num) {
        if (num == null || num === '' || num === '-') return '-';
        
        let value = 0;
        if (typeof num === 'number') {
            value = num;
        } else if (typeof num === 'string') {
            // If already formatted like "Rp 1.234", just return it
            if (num.trim().match(/^Rp\s*[\d\.,]+$/i)) return num.trim();
            
            // Clean string: remove everything except digits, comma, and dot
            let cleaned = num.replace(/[^0-9,\.]/g, '');
            // Handle Indonesian format: "1.234,56" or "1.234"
            // If it has a comma at the end (,00), it's a decimal separator.
            if (cleaned.includes(',') && cleaned.split(',')[1].length <= 2) {
                cleaned = cleaned.replace(/\./g, '').replace(',', '.');
            } else {
                // Otherwise treat dots as thousands separators and ignore commas
                cleaned = cleaned.replace(/\./g, '').replace(',', '');
            }
            value = parseFloat(cleaned);
        }

        if (isNaN(value) || value === 0) {
            // Fallback for strings that are not purely numeric but might contain info
            if (typeof num === 'string' && num.length > 0) return num;
            return '-';
        }
        
        return 'Rp ' + Math.floor(value).toLocaleString('id-ID');
    },

    /** Format date string to Indonesian locale */
    date(dateStr) {
        if (!dateStr || dateStr === '-') return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            // If it's already an Indonesian string or some other raw format, just return it
            return dateStr;
        }
        return d.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    },

    /** Short date format */
    dateShort(dateStr) {
        if (!dateStr || dateStr === '-') return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    },

    /** Date and Time format */
    dateTime(dateStr) {
        if (!dateStr || dateStr === '-') return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    },

    /** Relative time (misal: "2 hari lagi") */
    timeRelative(dateStr) {
        if (!dateStr) return '-';
        const now = new Date();
        const target = new Date(dateStr);
        const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
        if (diff === 0) return 'Hari ini';
        if (diff === 1) return 'Besok';
        if (diff === -1) return 'Kemarin';
        if (diff > 0) return `${diff} hari lagi`;
        return `${Math.abs(diff)} hari lalu`;
    },

    /** Truncate text */
    truncate(str, len = 50) {
        if (!str) return '-';
        return str.length > len ? str.substring(0, len) + '...' : str;
    },

    /** Badge HTML for status */
    statusBadge(status) {
        const map = {
            'Persiapan': 'badge-blue',
            'Pemasukan Dokumen': 'badge-yellow',
            'Evaluasi': 'badge-yellow',
            'Menang': 'badge-green',
            'Kalah': 'badge-red',
        };
        const cls = map[status] || 'badge-gray';
        return `<span class="badge ${cls}">${status || 'N/A'}</span>`;
    },

    /** Escape HTML */
    escape(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /** Normalize image/file URL for relative serving */
    url(path) {
        if (!path) return '';
        if (path.startsWith('http') || path.startsWith('data:')) return path;
        // If it has a leading slash, remove it to make it relative to index.html
        return path.startsWith('/') ? path.substring(1) : path;
    }
};
