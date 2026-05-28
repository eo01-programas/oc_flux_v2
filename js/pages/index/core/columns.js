function getColIndex(name) {
    if (!rawData || rawData.length === 0) return -1;
    const headers = rawData[0];
    const target = name.toLowerCase().trim();
    return headers.findIndex(h => h.toLowerCase().trim() === target);
}

function mapColumns() {
    if (!rawData || rawData.length === 0) return;
    // Reconstruimos colMap usando b?squeda flexible
    colMap = {};
    const knownColumns = [
        "HOD", "F.ING.COST", "CLIENTE", "OP TELA", "PARTIDA",
        "OP", "CORTE", "COLOR", "KG GIRADOS", "PDS GIRADAS", "ART?CULO",
        "NRO. MOLDE", "TIPO CERTIFICADO", "estado_bloqueo", "estado_rib",
        "estado_lavada", "RUTA TELA", "ESTILO", "PRENDA", "F. GIRADO", "RIB",
        "F.PROGBAC",
        /* Posibles columnas adicionales para Corte */
        "EQUIPO CORTE", "EQUIPO_CORTE", "EQUIPO_CORTE", "equipo_corte",
        /* Nuevo nombre solicitado: STATUS_CORTE. Mantener variantes antiguas por compatibilidad */
        "STATUS_CORTE", "STATUS", "status", "ESTADO CORTE", "ESTADO_CORTE", "estado_corte",
        "ESTADO BLOQUES", "ESTADO_BLOQUES", "ESTADO_BLOQUES", "estado_bloques",
        "ESTADO COLL TAP", "ESTADO_COLL_TAP", "ESTADO_COLL_TAP", "estado_coll_tap",
        /* Columnas para Transfer */
        "n.transfxpda", "N.TRANSFXPDA", "estado_transfer", "ESTADO_TRANSFER",
        /* Columnas nuevas para Artes asignar */
        "n.BDxpda", "n.BDxpda", "n.ESTAMPxpda", "n.ESTAMPxpda", "tipo-bordado", "TIPO-BORDADO", "tipo_bordado", "TIPO_BORDADO",
        /* Estado de artes */
        "estado_bordado", "ESTADO_BORDADO", "estado_estampado", "ESTADO_ESTAMPADO"
        , "tipo-transfer", "TIPO-TRANSFER", "tipo_transfer"
        , "estado_enumerado", "ESTADO_ENUMERADO"
        , "estado_habilitado", "ESTADO_HABILITADO"
        , "VALIDACION", "VALIDA"
        , "PLANTA", "LINEA"
    ];
    knownColumns.forEach(col => {
        const idx = getColIndex(col);
        if (idx !== -1) colMap[col] = idx;
    });

    // Mapear "F. DESPACHO" de la hoja a "HOD" en el c?digo
    try {
        const idxFDesp = findHeaderIndexCaseInsensitive('F. DESPACHO');
        if (idxFDesp !== -1) {
            colMap['HOD'] = idxFDesp;  // Mapear HOD al ?ndice de "F. DESPACHO"
            colMap['F. DESPACHO'] = idxFDesp;  // Mantener tambi?n el nombre original por compatibilidad
        }
    } catch (e) { /* ignore if helper not yet available */ }

    // Asegurar mapeo robusto para la columna 'estado_corte_bloques' y variantes
    try {
        const idxEcb = findHeaderIndexCaseInsensitive('estado_corte_bloques');
        if (idxEcb !== -1) colMap['estado_corte_bloques'] = idxEcb;
        const idxEcb2 = findHeaderIndexCaseInsensitive('ESTADO_CORTE_BLOQUES');
        if (idxEcb2 !== -1) colMap['ESTADO_CORTE_BLOQUES'] = idxEcb2;
        const idxEcb3 = findHeaderIndexCaseInsensitive('ESTADO CORTE BLOQUES');
        if (idxEcb3 !== -1) colMap['ESTADO CORTE BLOQUES'] = idxEcb3;
    } catch (e) { /* ignore if helper not yet available */ }
    // Asegurar mapeo robusto para la columna 'n.ESTAMPxpda' y variantes
    try {
        const idxNest = findHeaderIndexCaseInsensitive('n.ESTAMPxpda');
        if (idxNest !== -1) colMap['n.ESTAMPxpda'] = idxNest;
        const idxNest2 = findHeaderIndexCaseInsensitive('N.ESTAMPXPDA');
        if (idxNest2 !== -1) colMap['N.ESTAMPXPDA'] = idxNest2;
        const idxNest3 = findHeaderIndexCaseInsensitive('n.ESTAMP xpda');
        if (idxNest3 !== -1) colMap['n.ESTAMP xpda'] = idxNest3;
    } catch (e) { /* ignore if helper not yet available */ }
}

function findHeaderIndexCaseInsensitive(name) {
    if (!rawData || rawData.length === 0) return -1;
    const headers = rawData[0];
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = norm(name);
    for (let i = 0; i < headers.length; i++) {
        if (norm(headers[i]) === target) return i;
    }
    return -1;
}

function getPriorityColumnNameForView(viewName) {
    const key = String(viewName || '').trim().toLowerCase();
    if (key === 'bloqueo' || key === 'lavado' || key === 'lavanderia') return 'Pb';
    if (key === 'corte' || key === 'corte pzas' || key === 'cortepzas' || key === 'enumerado') return 'Pc';
    if (key === 'habilitado') return 'Pr';
    return 'P';
}

function resolvePriorityWriteColumn(viewName) {
    const preferred = getPriorityColumnNameForView(viewName);
    const preferredIdx = findHeaderIndexCaseInsensitive(preferred);
    if (preferredIdx !== -1) return preferred;
    return 'P';
}

function findPriorityHeaderIndex(viewName) {
    const preferred = getPriorityColumnNameForView(viewName);
    let idx = findHeaderIndexCaseInsensitive(preferred);
    if (idx === -1 && preferred !== 'P') idx = findHeaderIndexCaseInsensitive('P');
    return idx;
}

function getPriorityValueFromRow(row, viewName) {
    const idx = findPriorityHeaderIndex(viewName);
    if (idx === -1 || !row || row[idx] === undefined || row[idx] === null) return '';
    return String(row[idx]).trim();
}

function getVal(row, colName) {
    if (!colName) return "";
    let idx = colMap[colName];
    if (idx !== undefined && idx !== -1) return row[idx] || "";

    const variants = [
        colName,
        colName.toLowerCase(),
        colName.toUpperCase(),
        colName.replace(/[^a-zA-Z0-9]/g, ''),
        colName.toLowerCase().replace(/[^a-z0-9]/g, ''),
        colName.toUpperCase().replace(/[^A-Z0-9]/g, '')
    ];
    for (let k of variants) {
        idx = colMap[k];
        if (idx !== undefined && idx !== -1) return row[idx] || "";
    }

    try {
        const found = findHeaderIndexCaseInsensitive(colName);
        if (found !== -1) return row[found] || "";
    } catch (e) { }

    return "";
}
