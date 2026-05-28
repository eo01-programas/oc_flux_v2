// Bases de tendidos creadas en esta sesion / previamente: persistidas en localStorage
try {
    const saved = localStorage.getItem('createdTendidoBases');
    window._createdTendidoBases = new Set(saved ? JSON.parse(saved) : []);
} catch (e) { window._createdTendidoBases = new Set(); }
try {
    const savedCtx = localStorage.getItem('createdTendidoContexts');
    window._createdTendidoContexts = new Set(savedCtx ? JSON.parse(savedCtx) : []);
} catch (e) { window._createdTendidoContexts = new Set(); }

function buildCreatedTendidoContextKey(base, op, opTela, partida, color) {
    const baseNorm = String(base || '').trim().toUpperCase();
    const opNorm = String(op || '').trim().toUpperCase();
    const opTelaNorm = String(opTela || '').trim().toUpperCase();
    const partidaNorm = String(partida || '').trim().toUpperCase();
    const colorRaw = (typeof abbreviateHeather === 'function') ? abbreviateHeather(color || '') : (color || '');
    const colorNorm = String(colorRaw || '').trim().toUpperCase();
    if (!baseNorm || !opNorm) return '';
    return `${opNorm}::${baseNorm}::${opTelaNorm}::${partidaNorm}::${colorNorm}`;
}

function hasCreatedTendidoContext(base, op, opTela, partida, color) {
    try {
        const key = buildCreatedTendidoContextKey(base, op, opTela, partida, color);
        return !!(key && window._createdTendidoContexts && window._createdTendidoContexts.has(key));
    } catch (e) {
        return false;
    }
}

function addCreatedTendidoBase(base, op, opTela, partida, color) {
    if (!base) return;
    try {
        window._createdTendidoBases.add(base);
        localStorage.setItem('createdTendidoBases', JSON.stringify(Array.from(window._createdTendidoBases)));

        const key = buildCreatedTendidoContextKey(base, op, opTela, partida, color);
        if (key) {
            window._createdTendidoContexts.add(key);
            localStorage.setItem('createdTendidoContexts', JSON.stringify(Array.from(window._createdTendidoContexts)));
        }
    } catch (e) { console.error('Error saving created tendido base', e); }
}

