function escapeHtmlHabilitadoIngresos(txt) {
    return window.PcpTextUtils.escapeHtmlLoose(txt);
}

function parseDateFromAnyHabilitado(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (raw instanceof Date && !isNaN(raw.getTime())) return raw;

    const excelSerialToDate = (serial) => {
        const n = Number(serial);
        if (!isFinite(n) || n <= 0) return null;
        const wholeDays = Math.floor(n);
        const dayFraction = n - wholeDays;
        const base = new Date(1899, 11, 30);
        base.setDate(base.getDate() + wholeDays);
        const totalSeconds = Math.round(dayFraction * 86400);
        base.setSeconds(base.getSeconds() + totalSeconds);
        return isNaN(base.getTime()) ? null : base;
    };

    if (typeof raw === 'number' && raw > 30000) {
        return excelSerialToDate(raw);
    }

    const s = String(raw).trim();
    if (!s) return null;

    if (/^\d+(\.\d+)?$/.test(s)) {
        const serial = parseFloat(s);
        if (serial > 30000) {
            const serialDate = excelSerialToDate(serial);
            if (serialDate) return serialDate;
        }
    }

    const mDate = s.match(/Date\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?\)/i);
    if (mDate) {
        const y = parseInt(mDate[1], 10);
        const m = parseInt(mDate[2], 10);
        const d = parseInt(mDate[3], 10);
        const hh = parseInt(mDate[4] || '0', 10);
        const mm = parseInt(mDate[5] || '0', 10);
        const ss = parseInt(mDate[6] || '0', 10);
        const ms = parseInt(mDate[7] || '0', 10);
        const dt = new Date(y, m, d, hh, mm, ss, ms);
        return isNaN(dt.getTime()) ? null : dt;
    }

    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (iso) {
        const y = parseInt(iso[1], 10);
        const m = parseInt(iso[2], 10) - 1;
        const d = parseInt(iso[3], 10);
        const hh = parseInt(iso[4] || '0', 10);
        const mm = parseInt(iso[5] || '0', 10);
        const ss = parseInt(iso[6] || '0', 10);
        const dt = new Date(y, m, d, hh, mm, ss);
        return isNaN(dt.getTime()) ? null : dt;
    }

    const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2}|[A-Za-z]{3,})[\/\-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i);
    if (dm) {
        const day = parseInt(dm[1], 10);
        const monthRaw = String(dm[2]).toLowerCase();
        let month = -1;
        if (/^\d+$/.test(monthRaw)) {
            month = parseInt(monthRaw, 10) - 1;
        } else {
            const monthMap = {
                ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
                jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11
            };
            month = monthMap[monthRaw.slice(0, 3)] ?? -1;
        }
        let year = parseInt(dm[3], 10);
        if (year < 100) year += 2000;
        const hh = parseInt(dm[4] || '0', 10);
        const mm = parseInt(dm[5] || '0', 10);
        const ss = parseInt(dm[6] || '0', 10);
        if (month >= 0) {
            const dt = new Date(year, month, day, hh, mm, ss);
            return isNaN(dt.getTime()) ? null : dt;
        }
    }

    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed;
}

function isHabilitadoValidacionMarcada(row) {
    let idxValidacion = findHeaderIndexCaseInsensitive('VALIDACION');
    if (idxValidacion === -1) idxValidacion = findHeaderIndexCaseInsensitive('VALIDA');
    let raw = '';
    if (idxValidacion !== -1 && row && row[idxValidacion] !== undefined && row[idxValidacion] !== null) {
        raw = row[idxValidacion];
    } else {
        const validacionByName = getVal(row, 'VALIDACION') || getVal(row, 'VALIDA');
        if (validacionByName !== undefined && validacionByName !== null) raw = validacionByName;
    }
    const norm = String(raw).trim().toUpperCase();
    return raw === true || raw === 1 || norm === 'TRUE' || norm === 'VERDADERO' || norm === '1' || norm === 'SI' || norm === 'X';
}

function isHabilitadoHMarcada(row) {
    let idxH = findHeaderIndexCaseInsensitive('H');
    let raw = '';
    if (idxH !== -1 && row && row[idxH] !== undefined && row[idxH] !== null) {
        raw = row[idxH];
    } else {
        const hByName = getVal(row, 'H');
        if (hByName !== undefined && hByName !== null) raw = hByName;
    }
    const norm = String(raw).trim().toUpperCase();
    return raw === true || raw === 1 || norm === 'TRUE' || norm === 'VERDADERO' || norm === '1' || norm === 'SI' || norm === 'X';
}

function getHabilitadoTransferMultiplierValue(row) {
    const raw = getVal(row, 'n.transfxpda') || getVal(row, 'N.TRANSFXPDA') || getVal(row, 'n_transfxpda') || '';
    const text = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!text) return 0;
    const num = parseFloat(text.replace(/,/g, '.'));
    return Number.isFinite(num) ? num : 0;
}

function getHabilitadoPdsValue(row) {
    return parseFloat(getVal(row, 'PDS GIRADAS') || getVal(row, 'PDS') || 0) || 0;
}

function formatDayMonthEsFromDate(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const mesesEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mmm = mesesEs[dateObj.getMonth()] || '';
    return mmm ? `${dd}/${mmm}` : '';
}

function getHabilitadoDayMonthLabel(rawVal) {
    const dt = parseDateFromAnyHabilitado(rawVal);
    return formatDayMonthEsFromDate(dt);
}

function getFIngRealDayMonthLabel(rawVal) {
    return getHabilitadoDayMonthLabel(rawVal);
}

function getHabilitadoFHabDateKey(rawVal) {
    if (rawVal === null || rawVal === undefined || rawVal === '') return '';

    if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
        const year = rawVal.getUTCFullYear();
        const month = String(rawVal.getUTCMonth() + 1).padStart(2, '0');
        const day = String(rawVal.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const raw = String(rawVal).trim();
    if (!raw) return '';

    const normalizeYear = (yearRaw) => {
        let year = parseInt(yearRaw, 10);
        if (isNaN(year)) return '';
        if (year < 100) year += 2000;
        return String(year);
    };

    let match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[,\s]+.*)?$/);
    if (match) {
        const day = String(parseInt(match[1], 10)).padStart(2, '0');
        const month = String(parseInt(match[2], 10)).padStart(2, '0');
        const year = normalizeYear(match[3]);
        return year ? `${year}-${month}-${day}` : '';
    }

    match = raw.match(/^(\d{1,2})[\/\-]([A-Za-z]{3,})(?:[\/\-](\d{2,4}))?(?:[,\s]+.*)?$/i);
    if (match) {
        const dt = parseDateFromAnyHabilitado(raw);
        if (dt && !isNaN(dt.getTime())) {
            const year = dt.getUTCFullYear();
            const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
            const day = String(dt.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }

    match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s,].*)?$/);
    if (match) {
        const year = String(parseInt(match[1], 10));
        const month = String(parseInt(match[2], 10)).padStart(2, '0');
        const day = String(parseInt(match[3], 10)).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const dt = parseDateFromAnyHabilitado(raw);
    if (!dt || isNaN(dt.getTime())) return '';
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function normalizeHabilitadoFHabToken(value) {
    const raw = String(value === undefined || value === null ? '' : value).trim();
    if (!raw) return '';

    const dt = parseDateFromAnyHabilitado(raw);
    if (dt && !isNaN(dt.getTime())) {
        return formatDayMonthEsFromDate(dt).toUpperCase();
    }

    return raw.toUpperCase();
}

function getFIngRealInputValue(rawVal) {
    const dt = parseDateFromAnyHabilitado(rawVal);
    if (!dt || isNaN(dt.getTime())) return '';
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getFIngRealDayMonthKey(rawVal) {
    const dt = parseDateFromAnyHabilitado(rawVal);
    if (!dt || isNaN(dt.getTime())) return '';
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${mm}-${dd}`;
}

function getFIngRealTimeLabel(rawVal) {
    const dt = parseDateFromAnyHabilitado(rawVal);
    if (!dt || isNaN(dt.getTime())) return '';
    const rawStr = String(rawVal || '').trim();
    const hasTimeFromNumber = (typeof rawVal === 'number') && Math.abs(rawVal - Math.trunc(rawVal)) > 0.000001;
    const hasTimeFromText = /(?:\d{1,2}:\d{2})/.test(rawStr);
    const hasNonZeroClock = dt.getHours() !== 0 || dt.getMinutes() !== 0 || dt.getSeconds() !== 0;
    if (!hasTimeFromNumber && !hasTimeFromText && !hasNonZeroClock) return '';
    let hh = dt.getHours();
    const mm = String(dt.getMinutes()).padStart(2, '0');
    const suffix = hh >= 12 ? 'pm' : 'am';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    return `${String(hh).padStart(2, '0')}:${mm}${suffix}`;
}

function formatOcSearchFIngRealLabel(rawVal) {
    const dateLabel = getFIngRealDayMonthLabel(rawVal);
    const timeLabel = getFIngRealTimeLabel(rawVal);
    if (dateLabel && timeLabel) return `${dateLabel} ${timeLabel}`;
    if (dateLabel) return dateLabel;
    return String(rawVal || '').trim() || '-';
}

function getRawFIngRealFromRow(row) {
    const direct = getVal(row, 'F.ING.REAL') || getVal(row, 'F ING REAL') || getVal(row, 'F. ING. REAL') || '';
    if (direct !== '') return direct;

    const candidates = ['F.ING.REAL', 'F ING REAL', 'F. ING. REAL', 'F.ING REAL', 'FINGREAL'];
    for (const name of candidates) {
        const idx = findHeaderIndexCaseInsensitive(name);
        if (idx !== -1 && row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== '') {
            return row[idx];
        }
    }

    try {
        if (rawData && rawData.length > 0 && Array.isArray(rawData[0])) {
            const headers = rawData[0];
            const norm = (v) => String(v || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '');
            for (let i = 0; i < headers.length; i++) {
                const key = norm(headers[i]);
                const looksLikeFingReal = (
                    key === 'fingreal' ||
                    key.includes('fingreal') ||
                    key.includes('fingresoreal') ||
                    key.includes('fechaingresoreal') ||
                    (key.startsWith('fing') && key.includes('real'))
                );
                if (!looksLikeFingReal) continue;
                if (row[i] !== undefined && row[i] !== null && String(row[i]).trim() !== '') {
                    return row[i];
                }
            }
        }
    } catch (e) { }
    return '';
}

function normalizeCompStatusText(value) {
    return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
}

function normalizeCompStatusNorm(value) {
    return normalizeCompStatusText(value).toUpperCase();
}

function isCompStatusInactive(normVal) {
    const norm = String(normVal || '').toUpperCase().trim();
    if (!norm || norm === '-' || norm === 'X') return true;
    if (norm.indexOf('NO LLEVA') !== -1) return true;
    if (norm === 'OK' || norm.indexOf('OK ') === 0) return true;
    return false;
}

function getCompOtrosNormalizedParts(input) {
    const inObj = input || {};
    const out = [];

    const ribNorm = normalizeCompStatusNorm(inObj.rib);
    if (!isCompStatusInactive(ribNorm)) out.push('RIB');

    const collNorm = normalizeCompStatusNorm(inObj.coll);
    if (!isCompStatusInactive(collNorm)) out.push('COLL/TAP');

    const trsfTipoNorm = normalizeCompStatusNorm(inObj.trsfTipo);
    const trsfEstadoNorm = normalizeCompStatusNorm(inObj.trsfEstado);
    const trsfRawNorm = normalizeCompStatusNorm(inObj.trsfRaw);
    const hasEnPrenda = trsfTipoNorm.indexOf('EN PRENDA') !== -1 || trsfRawNorm.indexOf('EN PRENDA') !== -1 || trsfEstadoNorm.indexOf('EN PRENDA') !== -1;
    const hasEnPieza = trsfTipoNorm.indexOf('EN PIEZA') !== -1 || trsfRawNorm.indexOf('EN PIEZA') !== -1 || trsfEstadoNorm.indexOf('EN PIEZA') !== -1;
    if (hasEnPrenda && !hasEnPieza) out.push('TRSF: En prenda');

    return Array.from(new Set(out));
}
