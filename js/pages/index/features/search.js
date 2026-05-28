window.clearAllSearchFilters = function () {
    try { hideAllContextMenus(); } catch (e) { /* ignore */ }

    try {
        window._searchOpPtdaFilter = null;
        window._ocSearchState = null;

        if (typeof bloqueoHeaderFilters !== 'undefined' && Array.isArray(bloqueoHeaderFilters)) bloqueoHeaderFilters = [];
        if (typeof corteHeaderFilters !== 'undefined' && Array.isArray(corteHeaderFilters)) corteHeaderFilters = [];
        if (typeof enumeradoHeaderFilters !== 'undefined' && Array.isArray(enumeradoHeaderFilters)) enumeradoHeaderFilters = [];
        if (typeof habilitadoHeaderFilters !== 'undefined' && Array.isArray(habilitadoHeaderFilters)) habilitadoHeaderFilters = [];
        if (typeof lavadoHeaderFilters !== 'undefined' && Array.isArray(lavadoHeaderFilters)) lavadoHeaderFilters = [];
        if (typeof corteBloquesHeaderFilters !== 'undefined' && Array.isArray(corteBloquesHeaderFilters)) corteBloquesHeaderFilters = [];
        if (typeof transferHeaderFilters !== 'undefined' && Array.isArray(transferHeaderFilters)) transferHeaderFilters = [];
        if (typeof artesHeaderFilters !== 'undefined' && Array.isArray(artesHeaderFilters)) artesHeaderFilters = [];

        if (typeof bloqueoHeaderFilter !== 'undefined') bloqueoHeaderFilter = null;
        if (typeof corteHeaderFilter !== 'undefined') corteHeaderFilter = null;
        if (typeof enumeradoHeaderFilter !== 'undefined') enumeradoHeaderFilter = null;
        if (typeof habilitadoHeaderFilter !== 'undefined') habilitadoHeaderFilter = null;
        if (typeof lavadoHeaderFilter !== 'undefined') lavadoHeaderFilter = null;
        if (typeof corteBloquesHeaderFilter !== 'undefined') corteBloquesHeaderFilter = null;
        if (typeof transferHeaderFilter !== 'undefined') transferHeaderFilter = null;
        if (typeof artesHeaderFilter !== 'undefined') artesHeaderFilter = null;
    } catch (e) {
        console.error('clearAllSearchFilters: error limpiando filtros', e);
    }

    const searchInput = document.getElementById('search-oc-input');
    if (searchInput) searchInput.value = '';
    const msgEl = document.getElementById('search-oc-msg');
    if (msgEl) {
        msgEl.textContent = '';
        msgEl.style.display = 'none';
    }
    try { clearTimeout(window._searchOcMsgTimer); } catch (e) { }
    try { if (typeof window.cerrarModalOcSearchHabilitadoOk === 'function') window.cerrarModalOcSearchHabilitadoOk(); } catch (e) { }

    try { renderBloqueo(); } catch (e) { }
    try { renderLavado(); } catch (e) { }
    try { renderCorte(); } catch (e) { }
    try { renderCorteBloques(); } catch (e) { }
    try { renderEnumerado(); } catch (e) { }
    try { renderArtes(); } catch (e) { }
    try { renderHabilitado(); } catch (e) { }
    try { updateAllFilterIndicators(); } catch (e) { }
    try { updateCounters(); } catch (e) { }
};

window.buscarOC = function (ocQuery) {
    const msgEl = document.getElementById('search-oc-msg');
    function showMsg(text, isSuccess) {
        if (!msgEl) return;
        msgEl.textContent = text;
        msgEl.className = 'search-oc-msg' + (isSuccess ? ' success' : '');
        msgEl.style.display = 'block';
        clearTimeout(window._searchOcMsgTimer);
        window._searchOcMsgTimer = setTimeout(() => { msgEl.style.display = 'none'; }, 2600);
    }

    if (!ocQuery || !rawData || rawData.length < 2) { showMsg('Sin datos cargados', false); return; }
    const q = ocQuery.toString().trim().toUpperCase();
    if (q === '') return;
    const currentDataStamp = Number(window._ocSearchDataStamp || 0);
    const prevSearchState = window._ocSearchState; const canReuseState = !!(prevSearchState && prevSearchState.query === q && prevSearchState.rawDataLen === rawData.length && Number(prevSearchState.dataStamp || 0) === currentDataStamp && Array.isArray(prevSearchState.results) && prevSearchState.results.length > 0);

    if (!canReuseState) {
        window._ocSearchState = null;
        // -- Limpiar TODOS los filtros de la busqueda anterior --
        try {
            // Bloqueo
            if (Array.isArray(bloqueoHeaderFilters)) {
                bloqueoHeaderFilters = bloqueoHeaderFilters.filter(f => f.field !== 'OP-PTDA' && f.field !== 'OC');
            }
            bloqueoHeaderFilter = null;
            // Corte
            if (Array.isArray(corteHeaderFilters)) {
                corteHeaderFilters = corteHeaderFilters.filter(f => f.field !== 'OP-PTDA' && f.field !== 'OC');
            }
            corteHeaderFilter = null;
            // Enumerado
            if (Array.isArray(enumeradoHeaderFilters)) {
                enumeradoHeaderFilters = enumeradoHeaderFilters.filter(f => f.field !== 'OP-PTDA' && f.field !== 'OC');
            }
            enumeradoHeaderFilter = null;
            // Habilitado
            if (Array.isArray(habilitadoHeaderFilters)) {
                habilitadoHeaderFilters = habilitadoHeaderFilters.filter(f => f.field !== 'OP-PTDA' && f.field !== 'OC');
            }
            habilitadoHeaderFilter = null;
            // Lavado
            if (lavadoHeaderFilter && (lavadoHeaderFilter.field === 'OP-PTDA' || lavadoHeaderFilter.field === 'OC')) lavadoHeaderFilter = null;
            // Corte Bloques
            if (corteBloquesHeaderFilter && (corteBloquesHeaderFilter.field === 'OP-PTDA' || corteBloquesHeaderFilter.field === 'OC')) corteBloquesHeaderFilter = null;
            // Transfer
            if (Array.isArray(transferHeaderFilters)) {
                transferHeaderFilters = transferHeaderFilters.filter(f => f.field !== 'OP-PTDA' && f.field !== 'OC');
            }
            transferHeaderFilter = null;
            // Artes
            if (Array.isArray(artesHeaderFilters)) {
                artesHeaderFilters = artesHeaderFilters.filter(f => f.field !== 'OP-PTDA' && f.field !== 'OC');
            }
            artesHeaderFilter = null;
        } catch (e) { console.error('buscarOC: error limpiando filtros anteriores', e); }
    }

    function rowOCCandidates(row) {
        const out = [];
        const push = (val) => {
            const s = (val || '').toString().trim().toUpperCase();
            if (!s) return;
            if (out.indexOf(s) === -1) out.push(s);
        };

        push(getVal(row, 'OC'));

        const op = (getVal(row, 'OP') || '').toString().trim();
        const corte = (getVal(row, 'CORTE') || '').toString().trim();
        if (op && corte) push(op + '-' + corte);

        return out;
    }

    function est(row, col) {
        let v = '';
        try {
            const idx = findHeaderIndexCaseInsensitive(col);
            if (idx !== -1 && row[idx] !== undefined) v = row[idx];
            else v = getVal(row, col) || '';
        } catch (e) { v = getVal(row, col) || ''; }
        return (v || '').toString().toUpperCase().trim();
    }

    const order = [];

    ['X PROG', 'PROG'].forEach(sub => {
        order.push({
            vista: 'bloqueo', subtab: sub,
            check: (row) => {
                const ruta = est(row, 'RUTA TELA');
                if (ruta !== 'LAVADA') return false;
                let eb = est(row, 'estado_bloqueo');
                if (eb === '') eb = 'X PROG';
                return eb === sub;
            },
            go: () => {
                const btn = document.getElementById(sub === 'X PROG' ? 'btn-xprog' : 'btn-prog');
                const navBtn = getNavBtn('bloqueo');
                if (navBtn) switchView('bloqueo', navBtn);
                if (btn) filterBloqueo(sub, btn);
            }
        });
    });

    order.push({
        vista: 'lavado', subtab: 'EN LAV',
        check: (row) => {
            let eb = est(row, 'estado_bloqueo');
            if (eb === '') eb = 'X PROG';
            if (eb !== 'OK') return false;
            const el = est(row, 'estado_lavada');
            return el !== 'OK';
        },
        go: () => {
            const navBtn = getNavBtn('lavado');
            if (navBtn) switchView('lavado', navBtn);
            const btn = document.getElementById('btn-enlav');
            if (btn) filterLavado('EN LAV', btn);
        }
    });

    ['X PROG', 'PROG 1T', 'PROG 2T', 'PROG 3T'].forEach(sub => {
        order.push({
            vista: 'corte', subtab: sub,
            check: (row) => {
                const ec = est(row, 'estado_corte') || est(row, 'STATUS_CORTE') || est(row, 'STATUS');
                const ecNorm = (ec === '') ? 'X PROG' : ec;
                if (ecNorm === 'OK') return false;
                return ecNorm === sub;
            },
            go: () => {
                const btnMap = { 'X PROG': 'corte-btn-xprog', 'PROG 1T': 'corte-btn-1t', 'PROG 2T': 'corte-btn-2t', 'PROG 3T': 'corte-btn-3t' };
                const navBtn = getNavBtn('corte');
                if (navBtn) switchView('corte', navBtn);
                const btn = document.getElementById(btnMap[sub]);
                if (btn) filterCorte(sub, btn);
            }
        });
    });

    ['X PROG', 'PROG'].forEach(sub => {
        order.push({
            vista: 'corte-bloques', subtab: sub,
            check: (row) => {
                const estadoBloques = est(row, 'estado_bloques') || est(row, 'ESTADO_BLOQUES') || est(row, 'ESTADO BLOQUES');
                if (estadoBloques !== 'OK CORTE') return false;
                let ecb = est(row, 'estado_corte_bloques') || est(row, 'ESTADO_CORTE_BLOQUES');
                if (ecb === '') ecb = 'X PROG';
                return ecb === sub;
            },
            go: () => {
                const navBtn = getNavBtn('corte-bloques');
                if (navBtn) switchView('corte-bloques', navBtn);
                const btn = document.getElementById(sub === 'X PROG' ? 'corte-bloques-btn-xprog' : 'corte-bloques-btn-prog');
                if (btn) filterCorteBloques(sub, btn);
            }
        });
    });

    order.push({
        vista: 'enumerado', subtab: 'Por enumerar',
        check: (row) => {
            const ec = est(row, 'estado_corte') || est(row, 'STATUS_CORTE') || est(row, 'STATUS');
            if (ec !== 'OK') return false;
            const ev = est(row, 'estado_enumerado');
            return ev !== 'OK ENM' && ev !== 'OK S/ENM' && ev !== 'OK PAQUETEO';
        },
        go: () => {
            const navBtn = getNavBtn('enumerado');
            if (navBtn) switchView('enumerado', navBtn);
        }
    });

    ['X PROG', 'PROG 1T', 'PROG 2T', 'PROG 3T'].forEach(sub => {
        order.push({
            vista: 'habilitado', subtab: sub,
            check: (row) => {
                let hv = est(row, 'estado_habilitado');
                if (hv === '') hv = 'X PROG';
                if (sub === 'X PROG') return hv === '' || hv === 'X PROG';
                return hv === sub;
            },
            go: () => {
                const btnMap = { 'X PROG': 'habilitado-btn-xprog', 'PROG 1T': 'habilitado-btn-1t', 'PROG 2T': 'habilitado-btn-2t', 'PROG 3T': 'habilitado-btn-3t' };
                const navBtn = getNavBtn('habilitado');
                if (navBtn) switchView('habilitado', navBtn);
                const btn = document.getElementById(btnMap[sub]);
                if (btn) filterHabilitado(sub, btn);
            }
        });
    });

    order.push({
        vista: 'habilitado', subtab: 'S/DESTINO',
        check: (row) => {
            const planta = (getVal(row, 'PLANTA') || '').toString().toUpperCase().trim();
            const hv = est(row, 'estado_habilitado');
            return (planta === 'S/DESTINO' && hv !== 'OK') || hv === 'OK S/DESTINO';
        },
        go: () => {
            const navBtn = getNavBtn('habilitado');
            if (navBtn) switchView('habilitado', navBtn);
            const btn = document.getElementById('habilitado-btn-sdestino');
            if (btn) filterHabilitado('S/DESTINO', btn);
        }
    });

    function getNavBtn(viewName) {
        return [...document.querySelectorAll('.nav-tab')].find(b => {
            const oc = b.getAttribute('onclick') || '';
            return oc.indexOf("switchView('" + viewName + "'") !== -1;
        }) || null;
    }

    function applySearchFilter(vista, opPtda) {
        const field = 'OP-PTDA';
        const value = String(opPtda || '').trim();
        if (!value) return;
        const replaceArrayFilter = (filters, nextFilter) => {
            const safeFilters = Array.isArray(filters) ? filters : [];
            return [...safeFilters.filter(f => f.field !== 'OC' && f.field !== 'OP-PTDA'), nextFilter];
        };
        try {
            if (vista === 'bloqueo') {
                const nf = { field, value };
                bloqueoHeaderFilters = replaceArrayFilter(bloqueoHeaderFilters, nf);
                bloqueoHeaderFilter = bloqueoHeaderFilters[0] || null;
                renderBloqueo();
            } else if (vista === 'corte') {
                const nf = { field, value };
                corteHeaderFilters = replaceArrayFilter(corteHeaderFilters, nf);
                corteHeaderFilter = corteHeaderFilters[0] || null;
                renderCorte();
            } else if (vista === 'enumerado') {
                const nf = { field, value };
                enumeradoHeaderFilters = replaceArrayFilter(enumeradoHeaderFilters, nf);
                enumeradoHeaderFilter = enumeradoHeaderFilters[0] || null;
                renderEnumerado();
            } else if (vista === 'habilitado') {
                const nf = { field, value };
                habilitadoHeaderFilters = replaceArrayFilter(habilitadoHeaderFilters, nf);
                habilitadoHeaderFilter = habilitadoHeaderFilters[0] || null;
                renderHabilitado();
            } else if (vista === 'lavado') {
                lavadoHeaderFilter = { field, value };
                renderLavado();
            } else if (vista === 'corte-bloques') {
                corteBloquesHeaderFilter = { field, value };
                renderCorteBloques();
            } else if (vista === 'artes') {
                const nf = { field, value };
                artesHeaderFilters = replaceArrayFilter(artesHeaderFilters, nf);
                artesHeaderFilter = artesHeaderFilters[0] || null;
                try { renderArtes(); } catch (e) { }
            }
        } catch (e) { console.error('applySearchFilter error:', e); }
    }

    function matchesOC(oc, query) {
        const ocNorm = (oc || '').toString().trim().toUpperCase();
        if (!ocNorm) return false;

        const hi = query.lastIndexOf('-');
        if (hi > 0) {
            const qOp = query.substring(0, hi);
            const qCorte = query.substring(hi + 1);
            const ohi = ocNorm.lastIndexOf('-');
            if (ohi > 0) {
                const ocOp = ocNorm.substring(0, ohi);
                const ocCorte = ocNorm.substring(ohi + 1);
                if (ocOp !== qOp) return false;

                if (/^\d{1,2}$/.test(qCorte)) {
                    if (ocCorte === qCorte) return true;
                    if (ocCorte.length >= 3 && ocCorte.indexOf(qCorte) === 0) return true;
                    return false;
                }

                return ocCorte.indexOf(qCorte) === 0;
            }
        }

        return ocNorm.indexOf(query) !== -1;
    }

    function collectOcHabilitadoOkMatches() {
        const rows = [];
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            const ocCandidates = rowOCCandidates(row);
            const matchedOc = ocCandidates.find(oc => matchesOC(oc, q));
            if (!matchedOc) continue;
            if (est(row, 'estado_habilitado') !== 'OK') continue;
            const clienteRaw = getVal(row, 'CLIENTE') || getVal(row, 'CLI') || '';
            const cliente = (typeof normalizeClientName === 'function' ? normalizeClientName(clienteRaw) : clienteRaw) || '-';
            const colorRaw = getVal(row, 'COLOR') || '';
            const color = typeof abbreviateHeather === 'function' ? abbreviateHeather(colorRaw) : (colorRaw || '-');
            const pdsRaw = parseFloat(getVal(row, 'PDS GIRADAS') || getVal(row, 'PDS') || 0) || 0;
            rows.push({
                cliente: cliente || '-',
                oc: matchedOc || '-',
                color: color || '-',
                pds: `${formatThousands(pdsRaw, 0)} pds`,
                fIngReal: formatOcSearchFIngRealLabel(getRawFIngRealFromRow(row)),
                planta: String(getVal(row, 'PLANTA') || '').trim() || 'XASIG',
                linea: String(getVal(row, 'LINEA') || '').trim() || 'XASIG'
            });
        }
        return rows;
    }

    let searchState = canReuseState ? prevSearchState : null;
    if (!searchState) {
        try { if (typeof window.cerrarModalOcSearchHabilitadoOk === 'function') window.cerrarModalOcSearchHabilitadoOk(); } catch (e) { }
        const matches = [];
        const seen = new Set();
        for (const entry of order) {
            for (let i = 1; i < rawData.length; i++) {
                const row = rawData[i];
                const ocCandidates = rowOCCandidates(row);
                const matchedOc = ocCandidates.find(oc => matchesOC(oc, q));
                if (!matchedOc || !entry.check(row)) continue;
                const opTela = String(getVal(row, 'OP TELA') || getVal(row, 'OP') || '').trim();
                const partida = String(getVal(row, 'PARTIDA') || getVal(row, 'CORTE') || '').trim();
                const opPtda = opTela + '-' + partida;
                const matchKey = matchedOc || ((opPtda && opPtda !== '-') ? opPtda : ('ROW_' + i));
                const key = entry.vista + '|' + entry.subtab + '|' + matchKey;
                if (seen.has(key)) continue;
                seen.add(key);
                matches.push({ vista: entry.vista, subtab: entry.subtab, go: entry.go, opPtda: opPtda, matchedOc: matchedOc });
            }
        }
        if (matches.length === 0) {
            const okMatches = collectOcHabilitadoOkMatches();
            window._ocSearchState = { query: q, rawDataLen: rawData.length, dataStamp: currentDataStamp, results: [], index: -1, okModalShown: okMatches.length > 0 };
            if (okMatches.length) {
                showMsg('\u2714 Encontrada en Habilitado OK (' + okMatches.length + ')', true);
                if (typeof window.abrirModalOcSearchHabilitadoOk === 'function') {
                    try { window.abrirModalOcSearchHabilitadoOk(ocQuery.trim(), okMatches); } catch (e) { console.error('buscarOC modal OK sin resultados error', e); }
                }
            } else {
                showMsg('OC "' + ocQuery.trim() + '" no encontrada', false);
            }
            return;
        }
        searchState = { query: q, rawDataLen: rawData.length, dataStamp: currentDataStamp, results: matches, index: -1, okModalShown: true };
        window._ocSearchState = searchState;
    }
    try { if (typeof window.cerrarModalOcSearchHabilitadoOk === 'function') window.cerrarModalOcSearchHabilitadoOk(); } catch (e) { }
    searchState.index = (searchState.index + 1) % searchState.results.length;
    const currentResult = searchState.results[searchState.index];
    currentResult.go();
    applySearchFilter(currentResult.vista, currentResult.opPtda);
    showMsg('\u2714 Encontrado en ' + currentResult.vista.replace('-', ' ') + ' -> ' + currentResult.subtab + ' (' + (searchState.index + 1) + '/' + searchState.results.length + ')', true);
};
