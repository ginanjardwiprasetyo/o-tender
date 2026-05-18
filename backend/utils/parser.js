/**
 * Parser Utilities
 */

/**
 * Parse pagu string — handles "6,3 M", "740,2 Jt", "6.300.000.000", etc.
 * Robust against Indonesian formatting (dot for thousands, comma for decimals)
 */
function parsePaguString(str) {
    if (!str) return 0;
    str = String(str).trim().replace(/^Rp\s*/i, '');

    // Shorthand: "6,3 M" = 6.3 billion, "740,2 Jt" = 740.2 million
    const m = str.match(/([\d,\.]+)\s*(T|M|Jt|Rb)/i);
    if (m) {
        const num = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
        const unit = m[2].toLowerCase();
        if (unit === 't')       return num * 1e12;
        if (unit === 'm')       return num * 1e9;
        if (unit === 'jt')      return num * 1e6;
        if (unit === 'rb')      return num * 1e3;
    }

    // Try to parse as plain number with Indonesian formatting
    // Remove all dots, then replace last comma with dot if it looks like decimal
    let cleanStr = str.replace(/\./g, '');
    if (cleanStr.includes(',')) {
        // If it ends with ,00 or similar, it's decimal
        cleanStr = cleanStr.replace(/,(\d{2})$/, '.$1');
        // If there's still a comma, it might be a mistyped decimal or something else
        cleanStr = cleanStr.replace(/,/g, '.');
    }
    const plain = parseFloat(cleanStr);
    return isNaN(plain) ? 0 : plain;
}

module.exports = {
    parsePaguString
};
