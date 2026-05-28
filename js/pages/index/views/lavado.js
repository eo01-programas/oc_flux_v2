function renderLavado() {
    const tbody = document.getElementById('tbody-lavado');
    tbody.innerHTML = "";
    let count = 0;
    // Recolectar ?ndices v?lidos y ordenarlos por OP-PTDA (y fecha)
    let validIndices = [];
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const rutaTela = (getVal(row, 'RUTA TELA') || getVal(row, 'RUTA_TELA') || getVal(row, 'RUTA') || '').toString().toUpperCase().trim();
        // Lavanderia: solo filas con RUTA TELA = LAVADA
        if (rutaTela !== 'LAVADA') continue;

        const estadoBloq = row[colMap["estado_bloqueo"]];
        const estadoBloqNorm = (!estadoBloq || estadoBloq === "") ? "X PROG" : estadoBloq;

        // Mostrar solo filas cuyo estado_bloqueo sea OK
        if (estadoBloqNorm !== 'OK') continue;

        const estadoLav = row[colMap["estado_lavada"]];
        const estadoLavNorm = (!estadoLav || estadoLav === "") ? "EN LAV" : String(estadoLav);
        const estUpper = String(estadoLavNorm).toUpperCase();
        // Mostrar solo filas cuyo estado_lavada sea diferente de OK
        if (estUpper === 'OK') continue;

        validIndices.push(i);
    }

    validIndices = sortLavadoData(validIndices);

    // Aplicar filtro de encabezado si existe
    try {
        if (lavadoHeaderFilter && lavadoHeaderFilter.field && lavadoHeaderFilter.value !== undefined && lavadoHeaderFilter.value !== null) {
            const f = lavadoHeaderFilter.field;
            const v = String(lavadoHeaderFilter.value).toUpperCase().trim();
            validIndices = validIndices.filter(idx => {
                const r = rawData[idx] || [];
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
                    }
                    const cellValueUpper = String(cellValue).toUpperCase();
                    if (v === '') {
                        return cellValueUpper === '';
                    } else {
                        return cellValueUpper.indexOf(v) !== -1;
                    }
                } catch (e) { return false; }
            });
        }
    } catch (e) { console.error('Error applying lavadoHeaderFilter', e); }

    // Agrupar por OP-PTDA alternando clases para sombreado
    let lastOpPtda = null;
    let currentGroup = 'a';

    validIndices.forEach(i => {
        count++;
        const row = rawData[i];
        const opTela = String(row[colMap["OP TELA"]] || "").trim();
        const partida = String(row[colMap["PARTIDA"]] || "").trim();
        const currentOpPtda = opTela + "-" + partida;

        if (lastOpPtda !== null && currentOpPtda !== lastOpPtda) {
            currentGroup = (currentGroup === 'a') ? 'b' : 'a';
        }
        lastOpPtda = currentOpPtda;

        const tr = createRow(row, i, "lavado", currentGroup);

        // Agregar celda P al inicio (Lavanderia siempre muestra P en "Por Lavar")
        const pCell = document.createElement('td');
        pCell.innerHTML = createPrioridadCell(i, row, 'lavado').replace(/<td.*?>|<\/td>/g, '');
        tr.insertBefore(pCell, tr.firstChild);

        // Si P = 1, aplicar color rojo claro
        const idxP = findPriorityHeaderIndex('lavado');
        if (idxP !== -1) {
            const pValue = String(row[idxP] || '').trim();
            if (pValue === '1') {
                tr.classList.add('priority-1');
            }
        }

        tbody.appendChild(tr);
    });
    try { updateMainNavCounts(); } catch (e) { }

    // Inicializar eventos de los selectores de fecha
    initializeDateInputs();

    // Marcar columna filtrada visualmente
    markFilteredColumn('view-lavado', lavadoHeaderFilter ? lavadoHeaderFilter.field : null);
}

