// Shared formatting helpers used by the main PCP dashboard.
function formatDateCustom(val) {
    const mesesEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    if (typeof val === 'string' && val.includes('Date(')) {
        const match = val.match(/Date\((\d+),(\d+),(\d+)\)/);
        if (match) {
            const year = String(match[1]).slice(-2);
            const month = parseInt(match[2]);
            const day = String(match[3]).padStart(2, '0');

            return `${day}/${mesesEs[month]}/${year}`;
        }
    }

    if (typeof val === 'number' && val > 30000) {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        const day = String(date.getDate()).padStart(2, '0');
        const month = mesesEs[date.getMonth()];
        const year = String(date.getFullYear()).slice(-2);

        return `${day}/${month}/${year}`;
    }

    return val;
}

function formatValue(val, type) {
    if (type === 'date') {
        return formatDateCustom(val);
    }
    return val;
}

function convertToDateInputFormat(rawValue) {
    if (!rawValue || rawValue === '') return '';
    try {
        if (typeof rawValue === 'number' && rawValue > 30000) {
            const d = new Date(Math.round((rawValue - 25569) * 86400 * 1000));
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        if (typeof rawValue === 'string') {
            const m = rawValue.match(/Date\((\d+),(\d+),(\d+)\)/);
            if (m) {
                const year = m[1];
                const month = String(parseInt(m[2]) + 1).padStart(2, '0');
                const day = String(m[3]).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }

            const txt = rawValue.trim();
            const mesesEsMap = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
            const mEs = txt.match(/^(\d{1,2})[\/\-]([A-Za-z]{3,})[\/\-](\d{2,4})$/);
            if (mEs) {
                const day = String(parseInt(mEs[1], 10)).padStart(2, '0');
                const monKey = mEs[2].slice(0, 3).toLowerCase();
                const monNum = mesesEsMap[monKey];
                let yearNum = parseInt(mEs[3], 10);
                if (!isNaN(monNum) && !isNaN(yearNum)) {
                    if (yearNum < 100) yearNum += 2000;
                    const year = String(yearNum);
                    const month = String(monNum).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            }

            const mNum = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (mNum) {
                const day = String(parseInt(mNum[1], 10)).padStart(2, '0');
                const month = String(parseInt(mNum[2], 10)).padStart(2, '0');
                let yearNum = parseInt(mNum[3], 10);
                if (!isNaN(yearNum)) {
                    if (yearNum < 100) yearNum += 2000;
                    return `${yearNum}-${month}-${day}`;
                }
            }

            const parsed = new Date(rawValue);
            if (!isNaN(parsed.getTime())) {
                const year = parsed.getFullYear();
                const month = String(parsed.getMonth() + 1).padStart(2, '0');
                const day = String(parsed.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
    } catch (e) { }
    return '';
}

function formatDateShortFromInput(val) {
    if (!val) return '';
    try {
        const mesesEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const parts = val.split('-');
        if (parts.length !== 3) return '';
        const year = parts[0];
        const month = parseInt(parts[1], 10) - 1;
        const day = parts[2];
        const yearShort = year.slice(-2);
        const mon = mesesEs[month] || '';
        return `${day}/${mon}/${yearShort}`;
    } catch (e) { return ''; }
}

function compareDates(dateStr1, dateStr2) {
    const monthMap = {
        'ene': 0, 'enero': 0,
        'feb': 1, 'febrero': 1,
        'mar': 2, 'marzo': 2,
        'abr': 3, 'abril': 3,
        'may': 4, 'mayo': 4,
        'jun': 5, 'junio': 5,
        'jul': 6, 'julio': 6,
        'ago': 7, 'agosto': 7,
        'sep': 8, 'septiembre': 8,
        'oct': 9, 'octubre': 9,
        'nov': 10, 'noviembre': 10,
        'dic': 11, 'diciembre': 11
    };

    const parseDateStr = (str) => {
        const parts = str.split('/');
        if (parts.length !== 2 && parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const month = monthMap[parts[1].toLowerCase()];
        if (month === undefined) return null;
        let year = parts.length === 3 ? parseInt(parts[2], 10) : new Date().getFullYear();
        if (parts.length === 3 && year < 100) {
            year = year < 50 ? 2000 + year : 1900 + year;
        }
        return new Date(year, month, day);
    };

    const date1 = parseDateStr(dateStr1);
    const date2 = parseDateStr(dateStr2);

    if (!date1 || !date2) return dateStr1.localeCompare(dateStr2);
    return date1 - date2;
}

function formatThousands(val, decimals = 0) {
    if (val === null || val === undefined || isNaN(val)) return val;
    if (decimals > 0) {
        return Number(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    return Math.round(val).toLocaleString('en-US');
}
