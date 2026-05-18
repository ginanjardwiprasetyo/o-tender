/**
 * Normalize Indonesian date strings (e.g. "12 Maret 2026 09:00") to ISO (YYYY-MM-DD HH:mm)
 */
function normalizeDate(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr === 'null') return null;
    
    // If already ISO-ish (starts with 20xx-)
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;

    const months = {
        'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
        'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
        'september': '09', 'oktober': '10', 'november': '11', 'desember': '12',
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'mei': '05',
        'jun': '06', 'jul': '07', 'agu': '08', 'sep': '09', 'okt': '10', 'nov': '11', 'des': '12'
    };

    try {
        const cleaned = dateStr.toLowerCase().replace(/\s+/g, ' ');
        const parts = cleaned.split(' ');
        
        // Expected format: "12 Maret 2026 09:00" -> [12, maret, 2026, 09:00]
        if (parts.length >= 3) {
            let day = parts[0].padStart(2, '0');
            let month = months[parts[1]] || '01';
            let year = parts[2];
            let time = parts[3] || '00:00';
            
            // Validate year
            if (year.length === 4 && !isNaN(year)) {
                return `${year}-${month}-${day} ${time}`;
            }
        }
    } catch (e) {
        console.warn(`[Formatter] Failed to normalize date: ${dateStr}`);
    }

    return dateStr; // Fallback to raw
}

module.exports = { normalizeDate };
