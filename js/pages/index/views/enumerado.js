function renderEnumerado() {
    const tbody = document.getElementById('tbody-enumerado');
    if (!tbody) return;
    tbody.innerHTML = "";
    let count = 0;
    let pds_total = 0;

    // Enumerado: coleccionar filas cuyo estado_corte = 'OK' y estado_enumerado != 'OK ENM'/'OK S/ENM'
    const items = [];
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const estadoCorteVal = (row[colMap["STATUS_CORTE"]] || row[colMap["STATUS"]] || row[colMap["status"]] || row[colMap["estado_corte"]] || row[colMap["ESTADO CORTE"]] || row[colMap["ESTADO_CORTE"]]) || "";
        const isCorteOk = String(estadoCorteVal).toUpperCase() === 'OK';

        if (!isCorteOk) continue;

        // Intentar localizar la columna estado_enumerado de forma robusta
        let ev = '';
        try {
            const idxEv = findHeaderIndexCaseInsensitive('estado_enumerado');
            if (idxEv !== -1 && rawData[i] && rawData[i][idxEv] !== undefined) ev = rawData[i][idxEv];
            else ev = getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO_ENumerado') || getVal(row, 'ESTADO ENUMERADO') || '';
        } catch (e) { ev = getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO_ENumerado') || getVal(row, 'ESTADO ENUMERADO') || ''; }

        const evNorm = (ev || '').toString().toUpperCase().trim();
        // Excluir filas ya enumeradas
        if (evNorm === 'OK ENM' || evNorm === 'OK S/ENM' || evNorm === 'OK PAQUETEO') continue;

        // sumar prendas (PDS) para el badge
        const pdsVal = parseFloat(getVal(row, "PDS GIRADAS")) || 0;
        pds_total += pdsVal;

        // Obtener valor OC para ordenar y agrupar
        let ocVal = '';
        try {
            const idxOc = findHeaderIndexCaseInsensitive('OC');
            if (idxOc !== -1 && rawData[i] && rawData[i][idxOc] !== undefined) ocVal = String(rawData[i][idxOc]);
            else ocVal = (getVal(row, 'OC') || '').toString();
        } catch (e) { ocVal = (getVal(row, 'OC') || '').toString(); }

        // Obtener OP TELA y PARTIDA para agrupar filas
        let opTelaVal = '';
        let partidaVal = '';
        try {
            opTelaVal = String(getVal(row, 'OP TELA') || '').trim();
            partidaVal = String(getVal(row, 'PARTIDA') || '').trim();
        } catch (e) { }

        items.push({ row, i, oc: (ocVal || '').toString().trim(), opTelaPartida: opTelaVal + '|' + partidaVal });
        count++;
    }

    // Aplicar filtros de encabezado en Enumerado si existen (soporta m?ltiples)
    try {
        const enumFiltersToApply = enumeradoHeaderFilters && enumeradoHeaderFilters.length > 0
            ? enumeradoHeaderFilters
            : (enumeradoHeaderFilter ? [enumeradoHeaderFilter] : []);
        if (enumFiltersToApply.length > 0) {
            for (let idx = items.length - 1; idx >= 0; idx--) {
                const r = items[idx].row || [];
                let keepRow = true;
                for (let efi = 0; efi < enumFiltersToApply.length; efi++) {
                    const ef = enumFiltersToApply[efi];
                    const f = ef.field;
                    const v = String(ef.value).toUpperCase().trim();
                    let keep = false;
                    try {
                        let cellValue = '';
                        if (f === 'HOD') {
                            cellValue = formatValue(getVal(r, 'HOD'), 'date') || '';
                        } else if (f === 'F.ING.COST') {
                            cellValue = formatValue(getVal(r, 'F.ING.COST'), 'date') || '';
                        } else if (f === 'CLIENTE') {
                            cellValue = normalizeClientName(getVal(r, 'CLIENTE')) || '';
                        } else if (f === 'OP-PTDA') {
                            const opTela = String(getVal(r, 'OP TELA') || '').trim();
                            const partida = String(getVal(r, 'PARTIDA') || '').trim();
                            cellValue = (opTela + '-' + partida) || '';
                        } else if (f === 'OC') {
                            const op = String(getVal(r, 'OP') || '').trim();
                            const corte = String(getVal(r, 'CORTE') || '').trim();
                            cellValue = (op + '-' + corte) || '';
                        } else if (f === 'COLOR') {
                            cellValue = String(getVal(r, 'COLOR') || '') || '';
                        } else if (f === 'RUTA') {
                            const rutaTela = (getVal(r, 'RUTA TELA') || '').toString().toUpperCase().trim();
                            if (rutaTela === 'LAVADA') cellValue = 'LAVADA';
                            else if (rutaTela === 'ACABADA') cellValue = 'ACABADA';
                        }
                        const cellValueUpper = String(cellValue).toUpperCase();
                        if (v === '') {
                            keep = cellValueUpper === '';
                        } else {
                            keep = cellValueUpper.indexOf(v) !== -1;
                        }
                    } catch (e) { keep = false; }
                    if (!keep) { keepRow = false; break; }
                }
                if (!keepRow) items.splice(idx, 1);
            }
        }
    } catch (e) { console.error('Error applying enumeradoHeaderFilters', e); }

    // Ordenar por prioridad P (asc) sin romper el agrupado por OP TELA + PARTIDA
    const getEnumeradoPriorityRank = (row) => {
        const raw = getPriorityValueFromRow(row, 'enumerado');
        const n = parseInt(String(raw || '').trim(), 10);
        return isNaN(n) ? Number.POSITIVE_INFINITY : n;
    };

    const groupedByCorte = new Map();
    items.forEach(item => {
        const key = (item.opTelaPartida || '').toString();
        if (!groupedByCorte.has(key)) groupedByCorte.set(key, { rows: [], minP: Number.POSITIVE_INFINITY });
        const group = groupedByCorte.get(key);
        const pRank = getEnumeradoPriorityRank(item.row);
        group.rows.push({ item, pRank });
        if (pRank < group.minP) group.minP = pRank;
    });

    const sortedGroupKeys = Array.from(groupedByCorte.keys()).sort((a, b) => {
        const ga = groupedByCorte.get(a);
        const gb = groupedByCorte.get(b);
        if (ga.minP !== gb.minP) return ga.minP - gb.minP;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    const orderedItems = [];
    sortedGroupKeys.forEach(key => {
        const group = groupedByCorte.get(key);
        group.rows.sort((x, y) => {
            if (x.pRank !== y.pRank) return x.pRank - y.pRank;
            return (x.item.oc || '').localeCompare((y.item.oc || ''), undefined, { numeric: true, sensitivity: 'base' });
        });
        group.rows.forEach(entry => orderedItems.push(entry.item));
    });

    items.length = 0;
    items.push(...orderedItems);

    // Pintar filas alternando por grupos de OP TELA + PARTIDA
    let lastOpTelaPartida = null;
    let groupToggle = false;
    items.forEach(item => {
        const tr = createRow(item.row, item.i, "corte");
        // Quitar el bot?n de tendido ('+') en la columna OC para la vista Enumerado
        try {
            const tendidoBtn = tr.querySelector('button.btn-tendido');
            if (tendidoBtn) tendidoBtn.remove();
        } catch (e) { }
        // Quitar hiperv?nculo de OC en la vista Enumerado
        try {
            const ocLinks = tr.querySelectorAll('.oc-link');
            ocLinks.forEach(link => {
                link.classList.remove('oc-link');
                link.style.cursor = 'default';
                link.onclick = null;
                link.removeAttribute('onclick');
            });
        } catch (e) { }
        try {
            // La fila de createRow tipo "corte" genera columnas en este orden:
            // 0:RSV, 1:F.GIRADO, 2:HOD, 3:F.ING.COST, 4:CLIENTE, 5:RUTA, 6:OC, 7:COLOR,
            // 8:OP-PTDA, 9:PDS, 10:PRENDA, 11:ART?CULO, 12:TIPO CERT., 13:RIB,
            // 14:equipo_corte, 15:STATUS_CORTE, 16:BLOQUES?, 17:COLL o TAP?
            // Para Enumerado, eliminamos: RSV, F.GIRADO, OP-PTDA, ART?CULO, COLL o TAP?
            const tds = tr.querySelectorAll('td');
            // Eliminar en orden descendente para no alterar los ?ndices
            if (tds.length > 17) tds[17].remove(); // COLL o TAP?
            if (tds.length > 11) tds[11].remove(); // ART?CULO
            if (tds.length > 8) tds[8].remove();   // OP-PTDA
            if (tds.length > 1) tds[1].remove();   // F.GIRADO
            if (tds.length > 0) tds[0].remove();   // RSV
        } catch (e) { }

        // Agregar celda P al inicio en Enumerado
        const pCell = document.createElement('td');
        pCell.innerHTML = createPrioridadCell(item.i, item.row, 'enumerado').replace(/<td.*?>|<\/td>/g, '');
        tr.insertBefore(pCell, tr.firstChild);

        // Agregar celda de estado_enumerado con desplegable al final
        const estadoEnumCell = document.createElement('td');
        let estadoEnumVal = '';
        try {
            const idxEv = findHeaderIndexCaseInsensitive('estado_enumerado');
            if (idxEv !== -1 && item.row[idxEv] !== undefined) estadoEnumVal = item.row[idxEv] || '';
            else estadoEnumVal = getVal(item.row, 'estado_enumerado') || '';
        } catch (e) { estadoEnumVal = getVal(item.row, 'estado_enumerado') || ''; }
        estadoEnumVal = (estadoEnumVal || '').toString().trim();
        const enumClass = (estadoEnumVal === 'OK ENM' || estadoEnumVal === 'OK S/ENM' || estadoEnumVal === 'OK PAQUETEO') ? 'sel-OK' : '';
        estadoEnumCell.innerHTML = `
                    <select class="table-select ${enumClass}" onchange="updateRow(${item.i}, 'estado_enumerado', this.value, this)">
                        <option value="X ENM" ${(!estadoEnumVal || estadoEnumVal === 'X ENM') ? 'selected' : ''}>X ENM</option>
                        <option value="OK ENM" ${estadoEnumVal === 'OK ENM' ? 'selected' : ''}>OK ENM</option>
                    </select>
                `;
        tr.appendChild(estadoEnumCell);

        const opTelaPartidaNow = (item.opTelaPartida || '').toString();
        if (opTelaPartidaNow !== lastOpTelaPartida) {
            groupToggle = !groupToggle;
            lastOpTelaPartida = opTelaPartidaNow;
        }
        tr.classList.add(groupToggle ? 'group-a' : 'group-b');

        // Si P = 1, aplicar color rojo claro
        const idxP = findPriorityHeaderIndex('enumerado');
        if (idxP !== -1) {
            const pValue = String(item.row[idxP] || '').trim();
            if (pValue === '1') {
                tr.classList.add('priority-1');
            }
        }

        tbody.appendChild(tr);
    });
    try { updateMainNavCounts(); } catch (e) { }
    try {
        const el = document.getElementById('enumerado-pds-por');
        if (el) el.innerText = `[${formatThousands(pds_total, 0)}pds]`;
    } catch (e) { }

    // Inicializar eventos de los selectores de fecha
    initializeDateInputs();

    // Inicializar men? contextual de filtro en encabezados
    initializeEnumeradoHeaderContextMenus();

    // Marcar columnas filtradas visualmente
    markFilteredColumns('view-enumerado', enumeradoHeaderFilters.length > 0 ? enumeradoHeaderFilters : (enumeradoHeaderFilter ? [enumeradoHeaderFilter] : []));
}

