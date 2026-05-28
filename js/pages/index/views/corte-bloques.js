function renderCorteBloques() {
    const tbody = document.getElementById('tbody-corte-bloques');
    if (!tbody) return;
    tbody.innerHTML = '';
    let count = 0;

    // Mostrar/ocultar columna P seg?n el sub-tab activo (solo en PROG)
    const showPColumn = (currentCorteBloquesFilter === 'PROG');
    try {
        const thP = document.getElementById('th-corte-bloques-p');
        if (thP) thP.style.display = showPColumn ? '' : 'none';
    } catch (e) { }

    let validIndices = [];
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const estadoCorteVal = (row[colMap["STATUS_CORTE"]] || row[colMap["STATUS"]] || row[colMap["status"]] || row[colMap["estado_corte"]] || row[colMap["ESTADO CORTE"]] || row[colMap["ESTADO_CORTE"]]) || "";
        const isCorteOk = String(estadoCorteVal).toUpperCase() === 'OK';
        const estadoCorteNorm = (!estadoCorteVal || estadoCorteVal === '') ? 'X PROG' : String(estadoCorteVal);

        // Mostrar solo filas cuyo estado_bloques === 'OK CORTE' (case-insensitive)
        const estadoBloquesRaw = getVal(row, 'ESTADO BLOQUES') || getVal(row, 'ESTADO_BLOQUES') || getVal(row, 'estado_bloques') || '';
        const estadoBloquesNorm = (estadoBloquesRaw || '').toString().toUpperCase().trim();

        if (estadoBloquesNorm === 'OK CORTE') {
            // Filtrar por estado_corte_bloques seg?n el sub-tab activo
            let estadoCorteBloqsRaw = getVal(row, 'estado_corte_bloques') || getVal(row, 'ESTADO_CORTE_BLOQUES') || getVal(row, 'ESTADO CORTE BLOQUES') || '';
            // Fallback robusto: buscar ?ndice de encabezado directamente si getVal no encontr? nada
            if ((!estadoCorteBloqsRaw || estadoCorteBloqsRaw === '') && typeof findHeaderIndexCaseInsensitive === 'function') {
                const idx = findHeaderIndexCaseInsensitive('estado_corte_bloques');
                if (idx !== -1 && row[idx] !== undefined) estadoCorteBloqsRaw = row[idx];
            }
            const estadoCorteBloqsNorm = (!estadoCorteBloqsRaw || estadoCorteBloqsRaw === '') ? 'X PROG' : String(estadoCorteBloqsRaw);

            if (estadoCorteBloqsNorm === currentCorteBloquesFilter) {
                validIndices.push(i);
            }
        }
    }

    validIndices = sortBloqueoData(validIndices);

    // Aplicar filtro de encabezado si existe
    try {
        if (corteBloquesHeaderFilter && corteBloquesHeaderFilter.field && corteBloquesHeaderFilter.value !== undefined && corteBloquesHeaderFilter.value !== null) {
            const f = corteBloquesHeaderFilter.field;
            const v = String(corteBloquesHeaderFilter.value).toUpperCase().trim();
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
                    } else if (f === 'RUTA') {
                        const rutaTela = (getVal(r, 'RUTA TELA') || '').toString().toUpperCase().trim();
                        if (rutaTela === 'LAVADA') cellValue = 'LAVADA';
                        else if (rutaTela === 'ACABADA') cellValue = 'ACABADA';
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
    } catch (e) { console.error('Error applying corteBloquesHeaderFilter', e); }

    let lastOpPtda = null;
    let currentGroup = 'a';

    validIndices.forEach(i => {
        count++;
        const row = rawData[i];
        const opTela = String(getVal(row, "OP TELA") || "").trim();
        const partida = String(getVal(row, "PARTIDA") || "").trim();
        const currentOpPtda = opTela + "-" + partida;
        if (lastOpPtda !== null && currentOpPtda !== lastOpPtda) {
            currentGroup = (currentGroup === 'a') ? 'b' : 'a';
        }
        lastOpPtda = currentOpPtda;

        const tr = createRow(row, i, 'corte', currentGroup);

        // Eliminar las primeras dos celdas (RSV y F.GIRADO) que no corresponden a Corte Bloques
        try {
            const tdsStart = tr.querySelectorAll('td');
            if (tdsStart.length >= 2) {
                tdsStart[0].remove(); // RSV
                tr.querySelectorAll('td')[0].remove(); // F.GIRADO (ahora es la primera)
            }
        } catch (e) { }

        // Quitar el bot?n de tendido ('+') que aparece dentro de la celda OC
        // en la vista Corte Bloques: no debe mostrarse aqu?.
        try {
            const tendidoBtn = tr.querySelector('button.btn-tendido');
            if (tendidoBtn) tendidoBtn.remove();
        } catch (e) { }

        // Remove RIB cell if present (select with onchange updateRow(...,'estado_rib'))
        try {
            const ribSelect = tr.querySelector('select[onchange*="estado_rib"]');
            if (ribSelect) {
                const td = ribSelect.closest('td');
                if (td) td.remove();
            }
        } catch (e) { }

        // En la vista "Corte Bloques" mostrar solo texto para `equipo_corte` y `STATUS_CORTE`.
        // Reemplazamos los <select> correspondientes por su valor visible.
        try {
            const selects = tr.querySelectorAll('select');
            selects.forEach(s => {
                const oc = s.getAttribute('onchange') || '';
                const on = oc.toString().toLowerCase();
                // equipo_corte -> updateRow(..., 'equipo_corte', ...)
                if (on.indexOf("'equipo_corte'") !== -1) {
                    const txt = (s.options && s.selectedIndex >= 0 && s.options[s.selectedIndex]) ? s.options[s.selectedIndex].text : (s.value || '');
                    const td = s.closest('td');
                    if (td) td.innerText = txt;
                }
                // STATUS_CORTE variants, avoid matching 'estado_corte_bloques'
                if ((on.indexOf("'status_corte'") !== -1 || on.indexOf("'status'") !== -1 || on.indexOf("'estado_corte'") !== -1) && on.indexOf("'estado_corte_bloques'") === -1) {
                    const txt = (s.options && s.selectedIndex >= 0 && s.options[s.selectedIndex]) ? s.options[s.selectedIndex].text : (s.value || '');
                    const td = s.closest('td');
                    if (td) td.innerText = txt;
                }
            });
        } catch (e) { }

        // Remove last two cells (estado_bloques and estado_coll_tap)
        try {
            for (let k = 0; k < 2; k++) {
                const tds = tr.querySelectorAll('td');
                if (tds && tds.length) tds[tds.length - 1].remove();
            }
        } catch (e) { }

        // Append the new column 'BLOQUES?' (value from estado_bloques) then 'ESTADO_BLOQS' como select
        try {
            const valBloq = getVal(row, 'ESTADO BLOQUES') || getVal(row, 'ESTADO_BLOQUES') || getVal(row, 'estado_bloques') || '';
            const tdBloq = document.createElement('td');
            tdBloq.title = valBloq;
            tdBloq.innerText = valBloq;
            tr.appendChild(tdBloq);

            let val = getVal(row, 'estado_corte_bloques') || getVal(row, 'ESTADO_CORTE_BLOQUES') || getVal(row, 'ESTADO CORTE BLOQUES') || '';
            // Fallback robusto para leer directamente de rawData si colMap no contiene la columna
            if ((!val || val === '') && typeof findHeaderIndexCaseInsensitive === 'function') {
                const idxVal = findHeaderIndexCaseInsensitive('estado_corte_bloques');
                if (idxVal !== -1 && row[idxVal] !== undefined) val = row[idxVal];
            }
            const valNorm = (!val || val === '') ? 'X PROG' : String(val);
            let selectClass = '';
            if (valNorm.toUpperCase().includes('PROG') && valNorm !== 'X PROG') selectClass = 'sel-PROG';
            if (valNorm === 'OK') selectClass = 'sel-OK';

            const td = document.createElement('td');
            // Ocultar la opci?n OK cuando el sub-tab activo sea 'X PROG' (Por Programar)
            const showOkOption = (typeof currentCorteBloquesFilter === 'undefined') ? true : (currentCorteBloquesFilter !== 'X PROG');
            td.innerHTML = `
                        <select class="table-select ${selectClass}" onchange="updateRow(${i}, 'estado_corte_bloques', this.value, this)">
                            <option value="X PROG" ${valNorm === 'X PROG' ? 'selected' : ''}>X PROG</option>
                            <option value="PROG" ${valNorm === 'PROG' ? 'selected' : ''}>PROG</option>
                            ${showOkOption ? `<option value="OK" ${valNorm === 'OK' ? 'selected' : ''}>OK</option>` : ''}
                        </select>
                    `;
            tr.appendChild(td);
        } catch (e) { }

        // Agregar celda P al inicio si estamos en sub-tab PROG
        if (showPColumn) {
            const pCell = document.createElement('td');
            pCell.innerHTML = createPrioridadCell(i, row).replace(/<td.*?>|<\/td>/g, '');
            tr.insertBefore(pCell, tr.firstChild);
        }

        // Si P = 1, aplicar color rojo claro
        const idxP = findHeaderIndexCaseInsensitive('P');
        if (idxP !== -1) {
            const pValue = String(row[idxP] || '').trim();
            if (pValue === '1') {
                tr.classList.add('priority-1');
            }
        }

        tbody.appendChild(tr);
    });

    try { updateMainNavCounts(); } catch (e) { }

    // Actualizar badges de pds seg?n el filtro
    updateCorteBloquesCounters();

    // Marcar columna filtrada visualmente
    markFilteredColumn('view-corte-bloques', corteBloquesHeaderFilter ? corteBloquesHeaderFilter.field : null);
}

function updateCorteBloquesCounters() {
    let pds_xprog = 0;
    let pds_prog = 0;

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const estadoBloquesRaw = getVal(row, 'ESTADO BLOQUES') || getVal(row, 'ESTADO_BLOQUES') || getVal(row, 'estado_bloques') || '';
        const estadoBloquesNorm = (estadoBloquesRaw || '').toString().toUpperCase().trim();

        if (estadoBloquesNorm === 'OK CORTE') {
            // Leer estado_corte_bloques robustamente
            let estadoCorteBloqsRaw = getVal(row, 'estado_corte_bloques') || getVal(row, 'ESTADO_CORTE_BLOQUES') || getVal(row, 'ESTADO CORTE BLOQUES') || '';
            if ((!estadoCorteBloqsRaw || estadoCorteBloqsRaw === '') && typeof findHeaderIndexCaseInsensitive === 'function') {
                const idx = findHeaderIndexCaseInsensitive('estado_corte_bloques');
                if (idx !== -1 && row[idx] !== undefined) estadoCorteBloqsRaw = row[idx];
            }
            const estadoCorteBloqsNorm = (!estadoCorteBloqsRaw || estadoCorteBloqsRaw === '') ? 'X PROG' : String(estadoCorteBloqsRaw).toUpperCase().trim();

            // Leer PDS con fallback a rawData si es necesario
            let pdsVal = parseFloat(getVal(row, 'PDS') || getVal(row, 'PDS GIRADAS') || 0) || 0;
            if ((pdsVal === 0 || isNaN(pdsVal)) && typeof findHeaderIndexCaseInsensitive === 'function') {
                let idxPds = findHeaderIndexCaseInsensitive('PDS GIRADAS');
                if (idxPds === -1) idxPds = findHeaderIndexCaseInsensitive('PDS');
                if (idxPds !== -1 && row[idxPds] !== undefined) pdsVal = parseFloat(row[idxPds]) || 0;
            }

            if (estadoCorteBloqsNorm === 'X PROG') pds_xprog += pdsVal;
            if (estadoCorteBloqsNorm === 'PROG') pds_prog += pdsVal;
        }
    }

    const elX = document.getElementById('corte-bloques-pds-xprog');
    if (elX) elX.innerText = `[${formatThousands(pds_xprog, 0)}pds]`;
    const elP = document.getElementById('corte-bloques-pds-prog');
    if (elP) elP.innerText = `[${formatThousands(pds_prog, 0)}pds]`;
}

