function renderCorte() {
    const tbody = document.getElementById('tbody-corte');
    tbody.innerHTML = "";
    let count = 0;
    // Control de columnas finales (estado_bloques, estado_coll_tap)
    // - Si estamos en X PROG, ocultarlas.
    // - Si estamos en un sub-tab PROG (1T/2T/3T), mostrarlas y renombrarlas.
    const hideExtra = (currentCorteFilter === 'X PROG');
    const showAsProg = (currentCorteFilter && currentCorteFilter.toString().toUpperCase().startsWith('PROG ') && currentCorteFilter !== 'X PROG');

    // Mostrar/ocultar columna P seg?n el sub-tab activo (solo en PROG 1T/2T/3T)
    const showPColumn = showAsProg;
    try {
        const thP = document.getElementById('th-corte-p');
        if (thP) thP.style.display = showPColumn ? '' : 'none';
    } catch (e) { }

    const ths = document.querySelectorAll('#view-corte thead th');
    if (ths && ths.length >= 2) {
        // ?ltimas dos columnas de la tabla de Corte
        const thBloques = ths[ths.length - 2];
        const thCollTap = ths[ths.length - 1];
        thBloques.style.display = hideExtra ? 'none' : '';
        thCollTap.style.display = hideExtra ? 'none' : '';
        if (!hideExtra && showAsProg) {
            thBloques.innerText = 'BLOQUES?';
            thCollTap.innerText = 'COLL o TAP?';
        } else if (!hideExtra) {
            thBloques.innerText = 'estado_bloques';
            thCollTap.innerText = 'estado_coll_tap';
        }

        // Ajustar anchos de columnas OC y OP-PTDA cuando estamos en sub-tabs PROG
        // y ocultar columna EQUIPO_CORTE en PROG
        try {
            let ocTh = null;
            let opPtdaTh = null;
            let equipoCorteTh = null;
            ths.forEach(th => {
                const txt = (th.textContent || '').toString().trim().toUpperCase();
                if (txt === 'OC') ocTh = th;
                if (txt === 'OP-PTDA' || txt === 'OP-PTDA') opPtdaTh = th;
                if (txt === 'EQUIPO_CORTE') equipoCorteTh = th;
            });

            if (showAsProg) {
                if (ocTh) ocTh.style.width = '120px';
                if (opPtdaTh) opPtdaTh.style.width = '60px';
                if (equipoCorteTh) equipoCorteTh.style.display = 'none';
            } else {
                // valores por defecto cuando no es PROG (X PROG u otras vistas)
                if (ocTh) ocTh.style.width = '60px';
                if (opPtdaTh) opPtdaTh.style.width = '80px';
                if (equipoCorteTh) equipoCorteTh.style.display = '';
            }
        } catch (e) { /* ignore */ }
    }

    // Recolectar ?ndices v?lidos seg?n filtro de Corte (excluir OK)
    let validIndices = [];
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const estadoCorteVal = (row[colMap["STATUS_CORTE"]] || row[colMap["STATUS"]] || row[colMap["status"]] || row[colMap["estado_corte"]] || row[colMap["ESTADO CORTE"]] || row[colMap["ESTADO_CORTE"]]) || "";
        const isCorteOk = String(estadoCorteVal).toUpperCase() === 'OK';
        const estadoCorteNorm = (!estadoCorteVal || estadoCorteVal === '') ? 'X PROG' : String(estadoCorteVal);

        if (!isCorteOk && estadoCorteNorm === currentCorteFilter) {
            // Si estamos en el sub-tab 'X PROG' y hay filtros por RUTA activos,
            // aplicar filtrado: incluir la fila solo si su clave RUTA coincide
            try {
                if (currentCorteFilter === 'X PROG') {
                    const anyChecked = Object.values(routeFilters).some(v => v);
                    if (anyChecked) {
                        const routeKey = getRouteKeyForRow(row);
                        if (!routeFilters.hasOwnProperty(routeKey) || !routeFilters[routeKey]) {
                            continue; // no coincide con filtros activos
                        }
                    }
                    // Adem?s: excluir filas cuyo CORTE (parte base antes de '-')
                    // sea num?rico y mayor o igual a 9000 cuando estamos en X PROG
                    try {
                        const corteRaw = String(row[colMap["CORTE"]] || '').trim();
                        const corteBase = parseInt((corteRaw.split('-')[0] || '').trim());
                        if (!isNaN(corteBase) && corteBase >= 9000) {
                            continue; // omitir esta fila en X PROG
                        }
                    } catch (e) { /* ignore parsing issues */ }
                }
            } catch (e) { /* silent */ }

            validIndices.push(i);
        }
    }

    // Para 'X PROG' en Corte, ordenar por OP-PTDA (consistentemente con bloqueo/lavado)
    if (currentCorteFilter === 'X PROG') {
        try { validIndices = sortBloqueoData(validIndices, 'corte'); } catch (e) { /* ignore */ }
    }

    // Aplicar filtros de encabezado en Corte (soporta m?ltiples filtros con AND)
    try {
        // Usar el array de filtros m?ltiples
        const filtersToApply = corteHeaderFilters && corteHeaderFilters.length > 0
            ? corteHeaderFilters
            : (corteHeaderFilter ? [corteHeaderFilter] : []);

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
                        if (f === 'HOD') {
                            cellValue = formatValue(getVal(r, 'HOD'), 'date') || '';
                        } else if (f === 'F. GIRADO') {
                            cellValue = formatValue(getVal(r, 'F. GIRADO'), 'date') || '';
                        } else if (f === 'F.ING.COST') {
                            cellValue = formatValue(getVal(r, 'F.ING.COST'), 'date') || '';
                        } else if (f === 'CLIENTE') {
                            cellValue = normalizeClientName(getVal(r, 'CLIENTE')) || '';
                        } else if (f === 'RSV') {
                            cellValue = String(getVal(r, 'RSV') || '').trim();
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
                            if (rutaTela === 'LAVADA') {
                                const lavadaState = getLavadaRouteState(r);
                                if (lavadaState === 'LV-OK') cellValue = 'LV-OK';
                                else if (lavadaState === 'X PEDIR') cellValue = 'X PEDIR';
                                else if (lavadaState === 'X BLOQ') cellValue = 'X BLOQ';
                                else if (lavadaState === 'X LAVAR') cellValue = 'X LAVAR';
                            } else if (rutaTela === 'ACABADA') {
                                cellValue = 'AC';
                            }
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
    } catch (e) { console.error('Error applying corteHeaderFilters', e); }

    // Si estamos en PROG 1T/2T/3T, agrupar por EQUIPO_CORTE
    const isProgSubtab = showAsProg && (currentCorteFilter === 'PROG 1T' || currentCorteFilter === 'PROG 2T' || currentCorteFilter === 'PROG 3T');

    if (isProgSubtab) {
        // Ordenar validIndices por equipo_corte (seg?n orden EQ de equiposCorteData)
        // Antes de ordenar, detectar si alguna base de CORTE tiene tendidos creados
        // Use localStorage-backed set of created bases to prioritize them
        const corteIdxForMap = colMap["CORTE"];
        const baseHasInserted = {};
        try {
            validIndices.forEach(idx => {
                const val = String(rawData[idx][corteIdxForMap] || '').trim();
                const base = (/\d{2}$/.test(val.slice(-2)) ? val.slice(0, -2) : val) || '';
                if (base) {
                    baseHasInserted[base] = baseHasInserted[base] || (window._createdTendidoBases && window._createdTendidoBases.has(base));
                }
            });

            // Reordenar globalmente poniendo primero los ?ndices cuyas bases est?n registradas
            // en la lista de bases creadas. Esto hace que esas OC/bases aparezcan en primer lugar
            // en todo el tbody, antes de agrupar por equipo.
            const top = [];
            const rest = [];
            validIndices.forEach(idx => {
                try {
                    const val = String(rawData[idx][corteIdxForMap] || '').trim();
                    const base = (/\d{2}$/.test(val.slice(-2)) ? val.slice(0, -2) : val) || '';
                    if (base && window._createdTendidoBases && window._createdTendidoBases.has(base)) top.push(idx);
                    else rest.push(idx);
                } catch (e) { rest.push(idx); }
            });
            validIndices = top.concat(rest);
        } catch (e) { /* ignore */ }

        const pIdxForSort = findPriorityHeaderIndex('corte');
        const P_FALLBACK_NUM = 999999999;
        const pRankByIdx = {};
        const getPriorityOrFallback = (v) => {
            const clean = String(v == null ? '' : v).trim();
            if (!clean) return P_FALLBACK_NUM;
            const n = parseFloat(clean.replace(',', '.').replace(/[^0-9.-]/g, ''));
            return isNaN(n) ? P_FALLBACK_NUM : n;
        };
        validIndices.forEach(idx => {
            try {
                const row = rawData[idx] || [];
                const pVal = (pIdxForSort !== undefined && pIdxForSort !== -1) ? row[pIdxForSort] : getPriorityValueFromRow(row, 'corte');
                pRankByIdx[idx] = getPriorityOrFallback(pVal);
            } catch (e) {
                pRankByIdx[idx] = P_FALLBACK_NUM;
            }
        });

        validIndices.sort((a, b) => {
            // 1. Primero agrupar por equipo_corte (seg?n orden EQ de equiposCorteData)
            const equipoA = String(rawData[a][colMap["EQUIPO CORTE"]] || rawData[a][colMap["EQUIPO_CORTE"]] || rawData[a][colMap["equipo_corte"]] || "").trim();
            const equipoB = String(rawData[b][colMap["EQUIPO CORTE"]] || rawData[b][colMap["EQUIPO_CORTE"]] || rawData[b][colMap["equipo_corte"]] || "").trim();

            const findEqOrder = (nombre) => {
                const equipo = equiposCorteData.find(eq => eq.nombre === nombre);
                return equipo ? (parseInt(equipo.eq) || 999) : 999;
            };

            const orderA = findEqOrder(equipoA);
            const orderB = findEqOrder(equipoB);
            if (orderA !== orderB) return orderA - orderB;

            // 2. Dentro de cada equipo, ordenar por prioridad P (vacios al final)
            const pA = (typeof pRankByIdx[a] === 'number') ? pRankByIdx[a] : P_FALLBACK_NUM;
            const pB = (typeof pRankByIdx[b] === 'number') ? pRankByIdx[b] : P_FALLBACK_NUM;
            if (pA !== pB) return pA - pB;

            // 3. Dentro de cada equipo, ordenar por OP-PTDA
            const opTelaA = String(rawData[a][colMap["OP TELA"]] || '').trim();
            const partidaA = String(rawData[a][colMap["PARTIDA"]] || '').trim();
            const opPtdaA = opTelaA + '-' + partidaA;

            const opTelaB = String(rawData[b][colMap["OP TELA"]] || '').trim();
            const partidaB = String(rawData[b][colMap["PARTIDA"]] || '').trim();
            const opPtdaB = opTelaB + '-' + partidaB;

            if (opPtdaA !== opPtdaB) return opPtdaA.localeCompare(opPtdaB);

            // 4. Dentro del mismo OP-PTDA, ordenar por base de CORTE y sufijo (tendido)
            const corteIdx = colMap["CORTE"];
            const rawA = String(rawData[a][corteIdx] || '').trim();
            const rawB = String(rawData[b][corteIdx] || '').trim();

            const parseCorte = (s) => {
                if (!s) return { base: '', suf: 0 };
                const last2 = s.slice(-2);
                if (/^\d{2}$/.test(last2)) {
                    return { base: s.slice(0, -2), suf: parseInt(last2, 10) };
                }
                return { base: s, suf: 0 };
            };

            const pa = parseCorte(rawA);
            const pb = parseCorte(rawB);

            // Priorizar bases que tengan tendidos creados
            const baseA = pa.base || '';
            const baseB = pb.base || '';
            const aHas = baseHasInserted[baseA] || false;
            const bHas = baseHasInserted[baseB] || false;
            if (aHas !== bHas) return aHas ? -1 : 1;

            // Comparar base (num?rico si posible)
            const numA = parseInt(pa.base.replace(/[^0-9]/g, ''), 10);
            const numB = parseInt(pb.base.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                if (numA !== numB) return numA - numB;
            } else {
                const cmp = (pa.base || '').localeCompare(pb.base || '');
                if (cmp !== 0) return cmp;
            }

            // Finalmente ordenar por sufijo (tendido)
            return (pa.suf || 0) - (pb.suf || 0);
        });

        // Agrupar por equipo y renderizar con headers
        let lastEquipo = null;
        let lastOpPtda = null;
        let currentGroup = 'a';

        validIndices.forEach(i => {
            const row = rawData[i];
            const equipoCorte = String(row[colMap["EQUIPO CORTE"]] || row[colMap["EQUIPO_CORTE"]] || row[colMap["equipo_corte"]] || "").trim();

            // Si cambia el equipo, insertar fila de encabezado
            if (equipoCorte !== lastEquipo) {
                const headerRow = document.createElement('tr');
                headerRow.style.backgroundColor = '#FFE699';
                headerRow.style.color = '#1e40af';
                headerRow.style.fontWeight = '700';
                headerRow.style.fontSize = '13px';

                // Calcular colspan: en PROG son 15 columnas (sin equipo_corte ni las 2 finales que ya est?n)
                const colspan = '15';
                // Calcular suma de PDS para este equipo dentro del conjunto filtrado (validIndices)
                let pdsEquipo = 0;
                try {
                    pdsEquipo = validIndices.reduce((acc, idx2) => {
                        try {
                            const r = rawData[idx2];
                            const eq = String(r[colMap["EQUIPO CORTE"]] || r[colMap["EQUIPO_CORTE"]] || r[colMap["equipo_corte"]] || "").trim();
                            if (eq === equipoCorte) {
                                const pv = parseFloat(getVal(r, "PDS GIRADAS") || getVal(r, "PDS") || 0) || 0;
                                return acc + pv;
                            }
                        } catch (e) { /* ignore row parse errors */ }
                        return acc;
                    }, 0);
                } catch (e) { pdsEquipo = 0; }

                headerRow.innerHTML = `<td colspan="${colspan}" style="padding: 8px 12px; text-align: left;">
                            <i class="ph ph-package" style="margin-right: 8px;"></i>${equipoCorte || 'SIN EQUIPO ASIGNADO'} [${formatThousands(pdsEquipo, 0)}pds]
                        </td>`;
                tbody.appendChild(headerRow);

                lastEquipo = equipoCorte;
                lastOpPtda = null; // Reiniciar al cambiar de equipo
            }

            // Pintar por OP-PTDA dentro de cada equipo
            const opTela = String(row[colMap["OP TELA"]] || "").trim();
            const partida = String(row[colMap["PARTIDA"]] || "").trim();
            const currentOpPtda = `${opTela}-${partida}`;

            if (lastOpPtda !== null && currentOpPtda !== lastOpPtda) {
                currentGroup = (currentGroup === 'a') ? 'b' : 'a';
            }
            lastOpPtda = currentOpPtda;

            count++;
            const tr = createRow(row, i, "corte", currentGroup);
            // En sub-tabs PROG, eliminar celda de equipo_corte (posici?n 14, despu?s de RIB)
            const tds = tr.querySelectorAll('td');
            if (tds && tds.length >= 15) {
                // Eliminar celda equipo_corte (?ndice 14, despu?s de RIB y antes de STATUS_CORTE)
                tds[14].remove();
            }

            // Agregar celda P despu?s de RSV en sub-tabs PROG
            if (showPColumn) {
                const pCell = document.createElement('td');
                pCell.innerHTML = createPrioridadCell(i, row, 'corte').replace(/<td.*?>|<\/td>/g, '');
                // Insertar despu?s de la primera celda td (RSV)
                const allTds = tr.querySelectorAll('td');
                if (allTds && allTds.length > 0) {
                    const firstTd = allTds[0];
                    if (firstTd.nextSibling) {
                        tr.insertBefore(pCell, firstTd.nextSibling);
                    } else {
                        tr.appendChild(pCell);
                    }
                }
            }

            // Si P = 1, aplicar color rojo claro
            const idxP = findPriorityHeaderIndex('corte');
            if (idxP !== -1) {
                const pValue = String(row[idxP] || '').trim();
                if (pValue === '1') {
                    tr.classList.add('priority-1');
                }
            }

            tbody.appendChild(tr);
        });
    } else {
        // Comportamiento original para X PROG: agrupar por OP-PTDA
        validIndices = sortCorteData(validIndices);
        let lastOpPtda = null;
        let currentGroup = 'a';

        validIndices.forEach(i => {
            count++;
            const row = rawData[i];
            const opTela = String(row[colMap["OP TELA"]] || "").trim();
            const partida = String(row[colMap["PARTIDA"]] || "").trim();
            const currentOpPtda = `${opTela}-${partida}`;

            if (lastOpPtda !== null && currentOpPtda !== lastOpPtda) {
                currentGroup = (currentGroup === 'a') ? 'b' : 'a';
            }
            lastOpPtda = currentOpPtda;

            const tr = createRow(row, i, "corte", currentGroup);
            if (hideExtra) {
                for (let k = 0; k < 2; k++) {
                    const tds = tr.querySelectorAll('td');
                    if (tds && tds.length) tds[tds.length - 1].remove();
                }
            }

            // Si P = 1, aplicar color rojo claro
            const idxP = findPriorityHeaderIndex('corte');
            if (idxP !== -1) {
                const pValue = String(row[idxP] || '').trim();
                if (pValue === '1') {
                    tr.classList.add('priority-1');
                }
            }

            tbody.appendChild(tr);
        });
    }

    try { updateMainNavCounts(); } catch (e) { }

    // Inicializar eventos de los selectores de fecha
    initializeDateInputs();

    // Inicializar men? contextual de filtro en encabezados (X PROG y PROG 1T/2T/3T)
    if (currentCorteFilter === 'X PROG' || currentCorteFilter === 'PROG 1T' || currentCorteFilter === 'PROG 2T' || currentCorteFilter === 'PROG 3T') {
        initializeCorteHeaderContextMenus();
    }

    // Marcar columnas filtradas visualmente (soporta m?ltiples filtros)
    markFilteredColumns('view-corte', corteHeaderFilters.length > 0 ? corteHeaderFilters : (corteHeaderFilter ? [corteHeaderFilter] : []));

    // Mostrar/ocultar bot?n de impresi?n seg?n el subtab activo
    const btnPrintCorte = document.getElementById('btn-print-corte-prog');
    if (btnPrintCorte) {
        const isProg = (currentCorteFilter === 'PROG 1T' || currentCorteFilter === 'PROG 2T' || currentCorteFilter === 'PROG 3T');
        btnPrintCorte.style.display = isProg ? 'inline-flex' : 'none';
    }
}

