// Calcula y actualiza los badges (subtabs y padre) para Bordado y Estampado
window.updateArtesBadges = function () {
    if (!rawData || rawData.length <= 1) return;
    let b_pdsX = 0, b_pdsProg = 0;
    let e_pdsX = 0, e_pdsProg = 0;
    const idxEv = findHeaderIndexCaseInsensitive('estado_enumerado');

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        let ev = '';
        try {
            if (idxEv !== -1 && row && row[idxEv] !== undefined) ev = row[idxEv];
            else ev = getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO ENUMERADO') || '';
        } catch (e) { ev = getVal(row, 'estado_enumerado') || ''; }
        const evNorm = (ev || '').toString().toUpperCase().trim();
        if (evNorm === '') continue; // estado_enumerado diferente de vac?o

        // estado_habilitado: ocultar filas en OK (incluye variantes como "OK S/DESTINO")
        const rawHabil = getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || getVal(row, 'ESTADO HABILITADO') || '';
        const habilNorm = (rawHabil || '').toString().toUpperCase().replace(/\s+/g, ' ').trim();
        if (/^OK(\s|$)/.test(habilNorm)) continue;

        // Bordado
        try {
            const rawNbd = getVal(row, 'n.BDxpda') || getVal(row, 'N.BDXPDA') || getVal(row, 'n.BDxpda ') || '';
            const nbdNorm = (rawNbd || '').toString().toUpperCase().trim();
            const aplicaBordado = (nbdNorm !== '' && nbdNorm.indexOf('NO LLEVA') === -1 && /\d/.test(nbdNorm));
            if (aplicaBordado) {
                let rawEstadoB = getVal(row, 'estado_bordado') || '';
                let estadoBNorm = (rawEstadoB || '').toString().trim();
                if (estadoBNorm === '') estadoBNorm = 'X PROG';
                const pdsVal = parseFloat(getVal(row, 'PDS') || getVal(row, 'PDS GIRADAS') || 0) || 0;
                if (estadoBNorm.toUpperCase().indexOf('PROG') !== -1 && estadoBNorm.toUpperCase() !== 'X PROG') b_pdsProg += pdsVal;
                else b_pdsX += pdsVal;
            }
        } catch (e) { }

        // Estampado
        try {
            const rawNest = getVal(row, 'n.ESTAMPxpda') || getVal(row, 'N.ESTAMPXPDA') || getVal(row, 'n.ESTAMP xpda') || '';
            const nestNorm = (rawNest || '').toString().toUpperCase().trim();
            if (nestNorm.indexOf('NO LLEVA') === -1) {
                let rawEstadoE = getVal(row, 'estado_estampado') || '';
                let estadoENorm = (rawEstadoE || '').toString().trim();
                if (estadoENorm === '') estadoENorm = 'X PROG';
                const pdsVal2 = parseFloat(getVal(row, 'PDS') || getVal(row, 'PDS GIRADAS') || 0) || 0;
                if (estadoENorm.toUpperCase().indexOf('PROG') !== -1 && estadoENorm.toUpperCase() !== 'X PROG') e_pdsProg += pdsVal2;
                else e_pdsX += pdsVal2;
            }
        } catch (e) { }
    }

    try { document.getElementById('artes-bordado-xprog-count').innerText = `[${formatThousands(b_pdsX || 0, 0)}pds]`; } catch (e) { }
    try { document.getElementById('artes-bordado-prog-count').innerText = `[${formatThousands(b_pdsProg || 0, 0)}pds]`; } catch (e) { }
    try { document.getElementById('artes-pds-bordado').innerText = `[${formatThousands((b_pdsX || 0) + (b_pdsProg || 0), 0)}pds]`; } catch (e) { }

    try { document.getElementById('artes-estampado-xprog-count').innerText = `[${formatThousands(e_pdsX || 0, 0)}pds]`; } catch (e) { }
    try { document.getElementById('artes-estampado-prog-count').innerText = `[${formatThousands(e_pdsProg || 0, 0)}pds]`; } catch (e) { }
    try { document.getElementById('artes-pds-estampado').innerText = `[${formatThousands((e_pdsX || 0) + (e_pdsProg || 0), 0)}pds]`; } catch (e) { }
};

function updateMainNavCounts() {
    if (!rawData || rawData.length < 2) return;

    let countBloqueo = 0;
    let countLavado = 0;
    let countCorte = 0;
    let countCorteBloques = 0;
    let countEnumerado = 0;
    let countArtes = 0;
    let countHabilitado = 0;

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];

        const rutaTela = (getVal(row, 'RUTA TELA') || '').toString().toUpperCase().trim();
        const estadoBloqueo = (getVal(row, 'estado_bloqueo') || '').toString().toUpperCase().trim() || 'X PROG';
        const estadoLavada = (getVal(row, 'estado_lavada') || '').toString().toUpperCase().trim();
        const estadoCorte = ((getVal(row, 'STATUS_CORTE') || getVal(row, 'STATUS') || getVal(row, 'status') || getVal(row, 'estado_corte') || getVal(row, 'ESTADO CORTE') || getVal(row, 'ESTADO_CORTE') || '') + '').toUpperCase().trim() || 'X PROG';
        const estadoBloques = (getVal(row, 'ESTADO BLOQUES') || getVal(row, 'ESTADO_BLOQUES') || getVal(row, 'estado_bloques') || '').toString().toUpperCase().trim();
        const estadoCorteBloques = (getVal(row, 'estado_corte_bloques') || getVal(row, 'ESTADO_CORTE_BLOQUES') || getVal(row, 'ESTADO CORTE BLOQUES') || '').toString().toUpperCase().trim() || 'X PROG';
        const estadoEnumerado = (getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO_ENUMERADO') || getVal(row, 'ESTADO ENUMERADO') || '').toString().toUpperCase().trim();
        const estadoHabilitado = (getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || '').toString().toUpperCase().trim();
        const planta = (getVal(row, 'PLANTA') || '').toString().toUpperCase().trim();

        // Bloqueo: union de X PROG + PROG (solo ruta LAVADA)
        if (rutaTela === 'LAVADA' && (estadoBloqueo === 'X PROG' || estadoBloqueo === 'PROG')) {
            countBloqueo++;
        }

        // Lavanderia: estado_bloqueo OK y estado_lavada diferente de OK
        if (estadoBloqueo === 'OK' && estadoLavada !== 'OK') {
            countLavado++;
        }

        // Corte Pzas: union de sub-tabs visibles
        if (estadoCorte === 'X PROG' || estadoCorte === 'PROG 1T' || estadoCorte === 'PROG 2T' || estadoCorte === 'PROG 3T') {
            countCorte++;
        }

        // Corte Bloques: filas elegibles del modulo en sub-tabs X PROG/PROG
        if (estadoBloques === 'OK CORTE' && (estadoCorteBloques === 'X PROG' || estadoCorteBloques === 'PROG')) {
            countCorteBloques++;
        }

        // Enumerado: corte OK y aun no OK ENM / OK S/ENM / OK PAQUETEO
        if (estadoCorte === 'OK' && estadoEnumerado !== 'OK ENM' && estadoEnumerado !== 'OK S/ENM' && estadoEnumerado !== 'OK PAQUETEO') {
            countEnumerado++;
        }

        // Artes: filas que participan en Bordado o Estampado
        if (estadoEnumerado !== '' && estadoHabilitado !== 'OK') {
            const nBd = (getVal(row, 'n.BDxpda') || getVal(row, 'N.BDXPDA') || getVal(row, 'n.BDxpda ') || '').toString().toUpperCase().trim();
            const nEstamp = (getVal(row, 'n.ESTAMPxpda') || getVal(row, 'N.ESTAMPXPDA') || getVal(row, 'n.ESTAMP xpda') || '').toString().toUpperCase().trim();
            const aplicaBordado = (nBd !== '' && nBd.indexOf('NO LLEVA') === -1 && /\d/.test(nBd));
            const aplicaEstampado = (nEstamp.indexOf('NO LLEVA') === -1);
            if (aplicaBordado || aplicaEstampado) countArtes++;
        }

        // Habilitado: union de sub-tabs del modulo
        const habilProg = (estadoHabilitado === '' || estadoHabilitado === 'X PROG' || estadoHabilitado === 'PROG 1T' || estadoHabilitado === 'PROG 2T' || estadoHabilitado === 'PROG 3T');
        const habilEnumOk = (estadoEnumerado === 'OK ENM' || estadoEnumerado === 'OK S/ENM' || estadoEnumerado === 'OK PAQUETEO');
        const habilSDestino = ((planta === 'S/DESTINO' && estadoHabilitado !== 'OK') || estadoHabilitado === 'OK S/DESTINO');
        if (habilProg || habilEnumOk || habilSDestino) countHabilitado++;
    }

    const setCount = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setCount('count-bloqueo', countBloqueo);
    setCount('count-lavado', countLavado);
    setCount('count-corte', countCorte);
    setCount('count-corte-bloques', countCorteBloques);
    setCount('count-enumerado', countEnumerado);
    setCount('count-artes', countArtes);
    setCount('count-habilitado', countHabilitado);
}

function updateCounters() {
    let b_kgX = 0, b_pdsX = 0;
    let b_kgP = 0, b_pdsP = 0;
    let l_kgEnLav = 0, l_pdsEnLav = 0;
    // Corte sub-tabs pds counters
    let corte_pds = {
        'X PROG': 0,
        'PROG 1T': 0,
        'PROG 2T': 0,
        'PROG 3T': 0
    };
    let corte_bloques_count = 0;

    // Asegurar que los badges de pesta?as principales reflejen el total real de cada vista.
    try { updateMainNavCounts(); } catch (e) { }

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const ruta = row[colMap["RUTA TELA"]];

        const kgVal = parseFloat(row[colMap["KG GIRADOS"]]) || 0;
        const pdsVal = parseFloat(row[colMap["PDS GIRADAS"]]) || 0;

        // Contadores de Bloqueo: solo se cuentan para filas cuya ruta sea LAVADA
        if (ruta === "LAVADA") {
            const estBloq = row[colMap["estado_bloqueo"]] || "X PROG";
            const estBloqNorm = (estBloq === "" || estBloq === undefined) ? "X PROG" : estBloq;

            if (estBloqNorm === "X PROG") { b_kgX += kgVal; b_pdsX += pdsVal; }
            else if (estBloqNorm === "PROG") { b_kgP += kgVal; b_pdsP += pdsVal; }
        }

        // Contador de Lavanderia: debe reflejar exactamente la vista Lavanderia
        // (RUTA TELA = LAVADA, estado_bloqueo = OK y estado_lavada != OK)
        const estBloqAll = row[colMap["estado_bloqueo"]];
        const estBloqAllNorm = (!estBloqAll || estBloqAll === "") ? "X PROG" : estBloqAll;
        const rutaLavNorm = String(getVal(row, 'RUTA TELA') || getVal(row, 'RUTA_TELA') || getVal(row, 'RUTA') || '').toUpperCase().trim();
        if (rutaLavNorm === 'LAVADA' && estBloqAllNorm === "OK") {
            const estLav = row[colMap["estado_lavada"]];
            const estLavUpper = String(estLav || '').toUpperCase().trim();
            if (estLavUpper !== 'OK') { l_kgEnLav += kgVal; l_pdsEnLav += pdsVal; }
        }

        // Contadores para sub-tabs de Corte: tomar STATUS / estado_corte (normalizar vac?os a 'X PROG')
        const estadoCorteRaw = row[colMap["STATUS_CORTE"]] || row[colMap["STATUS"]] || row[colMap["status"]] || row[colMap["estado_corte"]] || row[colMap["ESTADO CORTE"]] || row[colMap["ESTADO_CORTE"]];
        const estadoCorteNorm = (!estadoCorteRaw || estadoCorteRaw === "") ? 'X PROG' : String(estadoCorteRaw);
        const isCorteOk = String(estadoCorteRaw).toUpperCase() === 'OK';
        if (corte_pds.hasOwnProperty(estadoCorteNorm)) {
            corte_pds[estadoCorteNorm] += pdsVal;
        }
        // contador espec?fico para Corte Bloques: filas cuyo estado_bloques == 'OK CORTE'
        try {
            const estadoBloquesRaw = row[colMap["ESTADO BLOQUES"]] || row[colMap["ESTADO_BLOQUES"]] || row[colMap["estado_bloques"]] || '';
            const estadoBloquesNorm = (estadoBloquesRaw || '').toString().toUpperCase().trim();
            if (estadoBloquesNorm === 'OK CORTE') {
                corte_bloques_count = (corte_bloques_count || 0) + 1;
            }
        } catch (e) { }
    }

    // Formatea n?meros en miles para las prendas (pds)
    document.getElementById('kg-xprog').innerText = `[${b_kgX.toFixed(1)}kg - ${formatThousands(b_pdsX, 0)}pds]`;
    document.getElementById('kg-prog').innerText = `[${b_kgP.toFixed(1)}kg - ${formatThousands(b_pdsP, 0)}pds]`;
    const lblEnLav = document.getElementById('kg-enlav');
    if (lblEnLav) lblEnLav.innerText = `[${l_kgEnLav.toFixed(1)}kg - ${formatThousands(l_pdsEnLav, 0)}pds]`;

    // Actualizar badges de Corte
    const elX = document.getElementById('corte-pds-xprog');
    if (elX) elX.innerText = `[${formatThousands(corte_pds['X PROG'], 0)}pds]`;
    const el1 = document.getElementById('corte-pds-1t');
    if (el1) el1.innerText = `[${formatThousands(corte_pds['PROG 1T'], 0)}pds]`;
    const el2 = document.getElementById('corte-pds-2t');
    if (el2) el2.innerText = `[${formatThousands(corte_pds['PROG 2T'], 0)}pds]`;
    const el3 = document.getElementById('corte-pds-3t');
    if (el3) el3.innerText = `[${formatThousands(corte_pds['PROG 3T'], 0)}pds]`;

    // Contador para Transfer: sumar pds seg?n estado_transfer
    let transfer_pds = {
        'X PROG': 0,
        'PROG': 0
    };
    let transferCount = 0;

    // Contador para Habilitado: filas con estado_enumerado = 'OK ENM' o 'OK S/ENM'
    let habilitadoCount = 0;
    // Mostrar contador para Corte Bloques (PROG 1T)
    try {
        const elCb = document.getElementById('count-corte-bloques');
        if (elCb) elCb.innerText = (typeof corte_bloques_count !== 'undefined') ? corte_bloques_count : 0;
    } catch (e) { }
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const ev = (row && (row[findHeaderIndexCaseInsensitive('estado_enumerado')])) || '';
        const evNorm = (ev || '').toString().toUpperCase().trim();

        // Contar Habilitado: estado_enumerado = 'OK ENM', 'OK S/ENM' o 'OK PAQUETEO'
        if (evNorm === 'OK ENM' || evNorm === 'OK S/ENM' || evNorm === 'OK PAQUETEO') {
            habilitadoCount++;
        }

        // Contar Transfer: estado_enumerado diferente a vac?o
        if (evNorm !== '') {
            // No contar filas con estado_habilitado = 'OK' en Transfer
            const habilitadoBadgeCheck = (getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || '').toString().toUpperCase().trim();
            if (habilitadoBadgeCheck === 'OK') continue;

            // Si n.transfxpda indica NO LLEVA no considerar la fila en el contador/badges de Transfer
            const rawNTrans = getVal(row, 'n.transfxpda');
            let nTransfValCheck = '';
            if (rawNTrans !== undefined && rawNTrans !== null && rawNTrans.toString().trim() !== '') {
                nTransfValCheck = rawNTrans.toString();
            } else {
                const clienteChk = (getVal(row, 'CLIENTE') || '').toString().trim();
                const estiloChk = (getVal(row, 'ESTILO') || '').toString().trim();
                const avgChk = avgTransfByClienteEstilo(clienteChk, estiloChk);
                nTransfValCheck = (avgChk !== null) ? avgChk : '';
            }
            nTransfValCheck = nTransfValCheck.toUpperCase().trim();
            if (nTransfValCheck === 'NO LLEVA') {
                // skip counting for Transfer
                continue;
            }
            // Si tipo-transfer indica NO LLEVA, no considerar la fila
            const tipoTransferBadge = (getVal(row, 'tipo-transfer') || '').toString().toUpperCase().trim();
            if (tipoTransferBadge === 'NO LLEVA') {
                continue;
            }

            // Sumar pds para Transfer seg?n estado_transfer
            const estadoTransfer = (row && (row[findHeaderIndexCaseInsensitive('estado_transfer')])) || '';
            const estadoTransferNorm = (!estadoTransfer || estadoTransfer.toString().trim() === '') ? 'X PROG' : estadoTransfer.toString().toUpperCase().trim();
            // Por Programar (X PROG): estado_transfer diferente a OK y tipo-transfer diferente a 'En prenda'
            if (estadoTransferNorm !== 'OK') {
                if (tipoTransferBadge !== 'EN PRENDA') {
                    const pds = parseFloat(row[colMap["PDS GIRADAS"]]) || 0;
                    transfer_pds['X PROG'] += pds;
                    transferCount++;
                }
            }
            // Programado (PROG): estado_transfer = PROG
            if (estadoTransferNorm === 'PROG') {
                const pds = parseFloat(row[colMap["PDS GIRADAS"]]) || 0;
                transfer_pds['PROG'] += pds;
            }
        }
    }
    const elH = document.getElementById('count-habilitado');
    if (elH) elH.innerText = habilitadoCount;

    // Actualizar contador y badges de Transfer
    const elT = document.getElementById('count-transfer');
    if (elT) elT.innerText = transferCount;
    const elTX = document.getElementById('transfer-pds-xprog');
    if (elTX) elTX.innerText = `[${formatThousands(transfer_pds['X PROG'], 0)}pds]`;
    const elTP = document.getElementById('transfer-pds-prog');
    if (elTP) elTP.innerText = `[${formatThousands(transfer_pds['PROG'], 0)}pds]`;
}

// Calcula promedio de n.transfxpda para un par CLIENTE+ESTILO
function avgTransfByClienteEstilo(cliente, estilo) {
    if (!cliente && !estilo) return null;
    const vals = [];
    let hasNoLleva = false;

    for (let i = 1; i < rawData.length; i++) {
        const r = rawData[i];
        const c = normalizeClientForTransfer(getVal(r, 'CLIENTE') || '');
        const e = (getVal(r, 'ESTILO') || '').toString().trim();
        if (c === cliente && e === estilo) {
            // Obtener valor usando getVal (igual que tipo-transfer)
            const v = (getVal(r, 'n.transfxpda') || getVal(r, 'N.TRANSFXPDA') || getVal(r, 'ntransfxpda') || '').toString().trim();

            if (!v) continue;
            const sUpper = v.toUpperCase();
            // Detectar "NO LLEVA" con variaciones
            if (sUpper === 'NO LLEVA' || sUpper.includes('NO LLEVA')) {
                hasNoLleva = true;
                continue;
            }
            if (sUpper === 'LLEVA?' || sUpper === 'LLEVA') continue;
            const n = parseFloat(v);
            if (!isNaN(n)) vals.push(n);
        }
    }

    // Prioridad: si hay "NO LLEVA", retornarlo (indica que el estilo no necesita transfer)
    if (hasNoLleva && vals.length === 0) return 'NO LLEVA';
    if (vals.length > 0) {
        const sum = vals.reduce((a, b) => a + b, 0);
        const avg = sum / vals.length;
        return Math.round(avg).toString();
    }
    if (hasNoLleva) return 'NO LLEVA';
    return null;
}
