function renderBloqueo() {
    const tbody = document.getElementById('tbody-bloqueo');
    tbody.innerHTML = "";
    let count = 0;

    // Mostrar/ocultar columna P seg?n el sub-tab activo
    const showPColumn = (currentBloqueoFilter === 'PROG');
    try {
        const thP = document.getElementById('th-bloqueo-p');
        if (thP) thP.style.display = showPColumn ? '' : 'none';
    } catch (e) { }

    let validIndices = [];
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const ruta = row[colMap["RUTA TELA"]];
        if (ruta !== "LAVADA") continue;

        const estadoBloq = row[colMap["estado_bloqueo"]] || "X PROG";
        const estadoBloqNorm = (estadoBloq === "" || estadoBloq === undefined) ? "X PROG" : estadoBloq;

        if (estadoBloqNorm === currentBloqueoFilter) {
            // Si estamos en 'Por Programar' (X PROG), excluir filas cuyo CORTE (parte entera antes de '-')
            // sea num?rico y mayor o igual a 9000
            try {
                if (currentBloqueoFilter === 'X PROG') {
                    const corteRaw = String(row[colMap["CORTE"]] || '').trim();
                    const corteBase = parseInt((corteRaw.split('-')[0] || '').trim());
                    if (!isNaN(corteBase) && corteBase >= 9000) {
                        continue; // omitir esta fila en X PROG
                    }
                }
            } catch (e) { /* ignore parsing issues */ }
            validIndices.push(i);
        }
    }

    validIndices = sortBloqueoData(validIndices, 'bloqueo');

    // Aplicar filtros de encabezado (soporta m?ltiples filtros con AND)
    try {
        const filtersToApply = bloqueoHeaderFilters && bloqueoHeaderFilters.length > 0
            ? bloqueoHeaderFilters
            : (bloqueoHeaderFilter ? [bloqueoHeaderFilter] : []);

        if (filtersToApply.length > 0) {
            validIndices = validIndices.filter(idx => {
                const r = rawData[idx] || [];
                // Todos los filtros deben pasar (AND)
                return filtersToApply.every(filter => {
                    if (!filter || !filter.field) return true;
                    const f = filter.field;
                    const v = String(filter.value).toUpperCase().trim();
                    try {
                        let cellValue = '';
                        if (f === 'RSV') {
                            cellValue = String(getVal(r, 'RSV') || '') || '';
                        } else if (f === 'F. GIRADO') {
                            cellValue = formatValue(getVal(r, 'F. GIRADO'), 'date') || '';
                        } else if (f === 'HOD') {
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
                        // Si el filtro es vac?o, mostrar solo si cellValue es vac?o
                        if (v === '') {
                            return cellValueUpper === '';
                        } else {
                            return cellValueUpper.indexOf(v) !== -1;
                        }
                    } catch (e) { return false; }
                });
            });
        }
    } catch (e) { console.error('Error applying bloqueoHeaderFilters', e); }

    let lastOpPtda = null;
    let currentGroup = 'a';

    validIndices.forEach(i => {
        count++;
        const row = rawData[i];

        // --- AGRUPAMIENTO SIN LIMPIEZA ---
        const opTela = String(row[colMap["OP TELA"]] || "").trim();
        const partida = String(row[colMap["PARTIDA"]] || "").trim();
        const currentOpPtda = opTela + "-" + partida;

        if (lastOpPtda !== null && currentOpPtda !== lastOpPtda) {
            currentGroup = (currentGroup === 'a') ? 'b' : 'a';
        }
        lastOpPtda = currentOpPtda;

        const tr = createRow(row, i, "bloqueo", currentGroup);

        // Agregar celda RSV al inicio
        const rsvCell = document.createElement('td');
        const rsvValue = String(getVal(row, "RSV") || "").trim();
        rsvCell.textContent = rsvValue;
        tr.insertBefore(rsvCell, tr.firstChild);

        // Si estamos en sub-tab PROG, agregar celda P al inicio (despu?s de RSV)
        if (showPColumn) {
            const pCell = document.createElement('td');
            pCell.innerHTML = createPrioridadCell(i, row, 'bloqueo').replace(/<td.*?>|<\/td>/g, '');
            tr.insertBefore(pCell, tr.firstChild.nextSibling);
        }

        // Si P = 1, aplicar color rojo claro
        const idxP = findPriorityHeaderIndex('bloqueo');
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

    // Inicializar men? contextual de filtro en encabezados (solo X PROG)
    if (currentBloqueoFilter === 'X PROG') {
        initializeBloqueoHeaderContextMenus();
    }

    // Marcar columnas filtradas visualmente (soporta m?ltiples filtros)
    markFilteredColumns('view-bloqueo', bloqueoHeaderFilters.length > 0 ? bloqueoHeaderFilters : (bloqueoHeaderFilter ? [bloqueoHeaderFilter] : []));
}
