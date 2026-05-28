window.printBloqueoProgramado = function () {
    try {
        if (currentBloqueoFilter !== 'PROG') {
            const progBtn = document.getElementById('btn-prog');
            if (progBtn) filterBloqueo('PROG', progBtn);
        }
        // Actualizar fecha de impresi?n en formato personalizado
        const now = new Date();
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const dia = now.getDate();
        const mes = meses[now.getMonth()];
        const anio = now.getFullYear();
        let horas = now.getHours();
        const minutos = String(now.getMinutes()).padStart(2, '0');
        const ampm = horas >= 12 ? 'pm' : 'am';
        horas = horas % 12 || 12;
        const fechaStr = `${dia}/${mes}/${anio}, ${String(horas).padStart(2, '0')}:${minutos}${ampm}`;
        const dateEl = document.getElementById('print-date-bloqueo');
        if (dateEl) dateEl.textContent = fechaStr;

        // Formatear fechas F.GIRADO y HOD sin a?o para impresi?n
        const tbody = document.getElementById('tbody-bloqueo');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => {
                const cells = tr.querySelectorAll('td');
                // F.GIRADO es columna 3 (index 2), HOD es columna 4 (index 3) cuando P est? visible
                [2, 3].forEach(idx => {
                    if (cells[idx]) {
                        const cell = cells[idx];
                        const originalText = cell.getAttribute('data-full-date') || cell.textContent;
                        if (!cell.getAttribute('data-full-date')) {
                            cell.setAttribute('data-full-date', originalText);
                        }
                        // Quitar el a?o: "12/Ene/26" -> "12/Ene"
                        const parts = originalText.split('/');
                        if (parts.length >= 2) {
                            cell.textContent = parts[0] + '/' + parts[1];
                        }
                    }
                });
            });
        }

        document.body.classList.add('print-bloqueo-prog');
        setTimeout(() => { window.print(); }, 50);
    } catch (e) {
        console.error('Error printing Bloqueo Programado', e);
    }
};

window.addEventListener('afterprint', function () {
    document.body.classList.remove('print-bloqueo-prog');
    document.body.classList.remove('print-corte-prog');
    // Restaurar fechas completas despu?s de imprimir
    const tbody = document.getElementById('tbody-bloqueo');
    if (tbody) {
        tbody.querySelectorAll('tr').forEach(tr => {
            const cells = tr.querySelectorAll('td');
            [2, 3].forEach(idx => {
                if (cells[idx]) {
                    const fullDate = cells[idx].getAttribute('data-full-date');
                    if (fullDate) cells[idx].textContent = fullDate;
                }
            });
        });
    }
    // Limpiar contenedor de impresi?n de Corte
    const printContainer = document.getElementById('print-corte-container');
    if (printContainer) printContainer.innerHTML = '';
});

// Funci?n para imprimir Corte PROG (3 turnos)
window.printCorteProg = async function () {
    try {
        const container = document.getElementById('print-corte-container');
        if (!container) return;
        container.innerHTML = '';

        // Generar fecha/hora actual
        const now = new Date();
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const dia = now.getDate();
        const mes = meses[now.getMonth()];
        const anio = now.getFullYear();
        let horas = now.getHours();
        const minutos = String(now.getMinutes()).padStart(2, '0');
        const ampm = horas >= 12 ? 'pm' : 'am';
        horas = horas % 12 || 12;
        const fechaStr = `${dia}/${mes}/${anio}, ${String(horas).padStart(2, '0')}:${minutos}${ampm}`;

        // Columnas a mostrar (excluyendo STATUS_CORTE, BLOQUES?, COLL o TAP?, F. GIRADO, HOD)
        // Columnas visibles: RSV, P, F.ING.COST, CLIENTE, RUTA, OC, COLOR, OP-PTDA, PDS, PRENDA, ART., TIPO CERT., RIB
        const columnsToShow = ['RSV', 'P', 'F.ING.COST', 'CLI', 'RUTA', 'OC', 'COLOR', 'OP-PTDA', 'PDS', 'PRENDA', 'ART.', 'TIPO CERT.', 'RIB'];

        const turnos = ['PROG 1T', 'PROG 2T', 'PROG 3T'];
        const cloneHoja3RowsForPrint = (rows) => {
            return (rows || []).map((r) => ({
                cliente: String((r && r.cliente) || '').trim(),
                ops: String((r && r.ops) || '').trim(),
                color: String((r && r.color) || '').trim(),
                pds: String((r && r.pds) || '').trim(),
                comentario: String((r && r.comentario) || '').trim(),
                comentario_general: String((r && r.comentario_general) || '').trim()
            }));
        };
        const hasHoja3RowData = (row) => {
            if (!row) return false;
            return !!(
                row.cliente || row.ops || row.color || row.pds || row.comentario || row.comentario_general
            );
        };
        const getCorteNotasRowsByTurn = async (turno) => {
            const turnoNorm = (typeof normalizeHabilitadoHoja3Turno === 'function')
                ? normalizeHabilitadoHoja3Turno(turno)
                : String(turno || '').toUpperCase().trim();
            if (!turnoNorm) return [];

            let rows = [];
            try {
                if (typeof habilitadoHoja3RowsByTurn !== 'undefined' && Array.isArray(habilitadoHoja3RowsByTurn[turnoNorm])) {
                    rows = cloneHoja3RowsForPrint(habilitadoHoja3RowsByTurn[turnoNorm]);
                }
            } catch (e) { }
            if ((!rows || rows.length === 0)
                && typeof currentHabilitadoFilter !== 'undefined'
                && String(currentHabilitadoFilter || '').toUpperCase().trim() === turnoNorm
                && typeof habilitadoHoja3Rows !== 'undefined'
                && Array.isArray(habilitadoHoja3Rows)) {
                rows = cloneHoja3RowsForPrint(habilitadoHoja3Rows);
            }

            if ((!rows || rows.length === 0) && typeof fetchHoja3RowsByTurn === 'function') {
                try {
                    const fetched = await fetchHoja3RowsByTurn(turnoNorm);
                    if (Array.isArray(fetched)) rows = cloneHoja3RowsForPrint(fetched);
                } catch (e) {
                    console.error('Error cargando notas para impresiÃ³n de corte', e);
                }
            }

            return (rows || []).filter(hasHoja3RowData);
        };
        const createCorteNotasPrintBlock = (turno, rows) => {
            const block = document.createElement('div');
            block.className = 'print-notes-block';
            block.style.cssText = 'display:block;margin-top:10px;break-inside:avoid;page-break-inside:avoid;';

            const title = document.createElement('div');
            title.className = 'print-notes-title';
            title.style.cssText = 'font-size:12px;font-weight:700;margin:0 0 4px 0;';
            const isEmptyNotes = !Array.isArray(rows) || rows.length === 0;
            title.textContent = isEmptyNotes ? `Notas ${turno} (sin registros)` : `Notas ${turno}`;
            block.appendChild(title);

            const table = document.createElement('table');
            table.className = 'print-notes-table';
            table.style.cssText = 'width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px;';

            const thead = document.createElement('thead');
            const trHead = document.createElement('tr');
            ['CLIENTE', 'OPS', 'COLOR', 'PDS', 'COMENTARIO', 'COMENTARIOS GENERALES'].forEach((label) => {
                const th = document.createElement('th');
                th.textContent = label;
                th.style.cssText = 'border:1px solid #cbd5e1;padding:3px 4px;background:#0f172a;color:#fff;';
                trHead.appendChild(th);
            });
            thead.appendChild(trHead);
            table.appendChild(thead);

            const tbodyNotas = document.createElement('tbody');
            const rowsToRender = (!isEmptyNotes)
                ? rows
                : [{ cliente: '', ops: '', color: '', pds: '', comentario: 'SIN NOTAS REGISTRADAS', comentario_general: '' }];

            rowsToRender.forEach((row) => {
                const tr = document.createElement('tr');
                const cells = [
                    row.cliente || '',
                    row.ops || '',
                    row.color || '',
                    row.pds || '',
                    row.comentario || '',
                    row.comentario_general || ''
                ];
                cells.forEach((val) => {
                    const td = document.createElement('td');
                    td.textContent = val;
                    td.style.cssText = 'border:1px solid #cbd5e1;padding:3px 4px;white-space:normal;vertical-align:top;';
                    tr.appendChild(td);
                });
                tbodyNotas.appendChild(tr);
            });
            table.appendChild(tbodyNotas);
            block.appendChild(table);
            return block;
        };

        const notasRowsByTurn = {};
        for (const turno of turnos) {
            notasRowsByTurn[turno] = await getCorteNotasRowsByTurn(turno);
        }

        turnos.forEach((turno, turnoIdx) => {
            // Recolectar filas para este turno
            let validIndices = [];
            for (let i = 1; i < rawData.length; i++) {
                const row = rawData[i];
                const estadoCorteVal = (row[colMap["STATUS_CORTE"]] || row[colMap["STATUS"]] || row[colMap["status"]] || row[colMap["estado_corte"]] || row[colMap["ESTADO CORTE"]] || row[colMap["ESTADO_CORTE"]]) || "";
                const estadoCorteNorm = (!estadoCorteVal || estadoCorteVal === '') ? 'X PROG' : String(estadoCorteVal);
                if (estadoCorteNorm === turno) {
                    validIndices.push(i);
                }
            }

            // Ordenar con el mismo criterio de la vista HTML (renderCorte en sub-tabs PROG)
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
                const equipoA = String(rawData[a][colMap["EQUIPO CORTE"]] || rawData[a][colMap["EQUIPO_CORTE"]] || rawData[a][colMap["equipo_corte"]] || "").trim();
                const equipoB = String(rawData[b][colMap["EQUIPO CORTE"]] || rawData[b][colMap["EQUIPO_CORTE"]] || rawData[b][colMap["equipo_corte"]] || "").trim();

                const findEqOrder = (nombre) => {
                    const equipo = equiposCorteData.find(eq => eq.nombre === nombre);
                    return equipo ? (parseInt(equipo.eq) || 999) : 999;
                };

                const orderA = findEqOrder(equipoA);
                const orderB = findEqOrder(equipoB);
                if (orderA !== orderB) return orderA - orderB;

                const pA = (typeof pRankByIdx[a] === 'number') ? pRankByIdx[a] : P_FALLBACK_NUM;
                const pB = (typeof pRankByIdx[b] === 'number') ? pRankByIdx[b] : P_FALLBACK_NUM;
                if (pA !== pB) return pA - pB;

                const opTelaA = String(rawData[a][colMap["OP TELA"]] || '').trim();
                const partidaA = String(rawData[a][colMap["PARTIDA"]] || '').trim();
                const opPtdaA = opTelaA + '-' + partidaA;

                const opTelaB = String(rawData[b][colMap["OP TELA"]] || '').trim();
                const partidaB = String(rawData[b][colMap["PARTIDA"]] || '').trim();
                const opPtdaB = opTelaB + '-' + partidaB;

                if (opPtdaA !== opPtdaB) return opPtdaA.localeCompare(opPtdaB);

                const rawA = String(rawData[a][corteIdxForMap] || '').trim();
                const rawB = String(rawData[b][corteIdxForMap] || '').trim();

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

                const baseA = pa.base || '';
                const baseB = pb.base || '';
                const aHas = baseHasInserted[baseA] || false;
                const bHas = baseHasInserted[baseB] || false;
                if (aHas !== bHas) return aHas ? -1 : 1;

                const numA = parseInt(pa.base.replace(/[^0-9]/g, ''), 10);
                const numB = parseInt(pb.base.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(numA) && !isNaN(numB)) {
                    if (numA !== numB) return numA - numB;
                } else {
                    const cmp = (pa.base || '').localeCompare(pb.base || '');
                    if (cmp !== 0) return cmp;
                }

                return (pa.suf || 0) - (pb.suf || 0);
            });

            // Crear secci?n para este turno
            const section = document.createElement('div');
            section.className = 'print-shift-section';

            // Encabezado del turno
            const header = document.createElement('div');
            header.className = 'print-shift-header';
            header.textContent = `Programaci?n Corte - ${turno}`;
            section.appendChild(header);

            // Fecha
            const dateDiv = document.createElement('div');
            dateDiv.className = 'print-shift-date';
            dateDiv.textContent = fechaStr;
            section.appendChild(dateDiv);

            // Tabla
            const table = document.createElement('table');
            table.className = 'print-corte-main-table';
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            columnsToShow.forEach(col => {
                const th = document.createElement('th');
                th.textContent = (col === 'F.ING' ? 'F.ING.Prog' : col);
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            let lastEquipo = null;
            let lastOpPtda = null;
            let currentGroup = 'a';

            validIndices.forEach(i => {
                const row = rawData[i];
                const equipoCorte = String(row[colMap["EQUIPO CORTE"]] || row[colMap["EQUIPO_CORTE"]] || row[colMap["equipo_corte"]] || "").trim();

                // Insertar fila de encabezado de equipo si cambia
                if (equipoCorte !== lastEquipo) {
                    const eqRow = document.createElement('tr');
                    eqRow.className = 'equipo-header';
                    const eqCell = document.createElement('td');
                    eqCell.colSpan = columnsToShow.length;
                    // Calcular PDS del equipo
                    let pdsEquipo = 0;
                    validIndices.forEach(idx => {
                        const r = rawData[idx];
                        const eq = String(r[colMap["EQUIPO CORTE"]] || r[colMap["EQUIPO_CORTE"]] || r[colMap["equipo_corte"]] || "").trim();
                        if (eq === equipoCorte) {
                            pdsEquipo += parseFloat(getVal(r, "PDS GIRADAS") || getVal(r, "PDS") || 0) || 0;
                        }
                    });
                    eqCell.textContent = (equipoCorte || 'SIN EQUIPO ASIGNADO') + ' [' + formatThousands(pdsEquipo, 0) + 'pds]';
                    eqRow.appendChild(eqCell);
                    tbody.appendChild(eqRow);
                    lastEquipo = equipoCorte;
                    lastOpPtda = null;
                }

                // Alternar grupo por OP-PTDA
                const opTela = String(row[colMap["OP TELA"]] || "").trim();
                const partida = String(row[colMap["PARTIDA"]] || "").trim();
                const currentOpPtda = opTela + '-' + partida;
                if (lastOpPtda !== null && currentOpPtda !== lastOpPtda) {
                    currentGroup = (currentGroup === 'a') ? 'b' : 'a';
                }
                lastOpPtda = currentOpPtda;

                const tr = document.createElement('tr');
                tr.className = 'group-' + currentGroup;

                // Construir celdas
                columnsToShow.forEach(col => {
                    const td = document.createElement('td');
                    let cellValue = '';
                    switch (col) {
                        case 'RSV':
                            cellValue = String(getVal(row, 'RSV') || '').trim();
                            break;
                        case 'P':
                            const idxP = findPriorityHeaderIndex('corte');
                            cellValue = idxP !== -1 ? String(row[idxP] || '').trim() : '';
                            break;
                        case 'F.ING.COST':
                            cellValue = formatValue(getVal(row, 'F.ING.COST'), 'date') || '';
                            break;
                        case 'CLI':
                            cellValue = normalizeClientName(getVal(row, 'CLIENTE')) || '';
                            break;
                        case 'RUTA':
                            const rutaTela = (getVal(row, 'RUTA TELA') || '').toString().toUpperCase().trim();
                            if (rutaTela === 'LAVADA') {
                                const lavadaState = getLavadaRouteState(row);
                                if (lavadaState === 'LV-OK') cellValue = 'LV-OK';
                                else if (lavadaState === 'X PEDIR') cellValue = 'X PEDIR';
                                else if (lavadaState === 'X BLOQ') cellValue = 'X BLOQ';
                                else if (lavadaState === 'X LAVAR') cellValue = 'X LAVAR';
                            } else if (rutaTela === 'ACABADA') {
                                cellValue = 'AC';
                            }
                            break;
                        case 'OC':
                            const op = getVal(row, 'OP');
                            const corte = getVal(row, 'CORTE');
                            cellValue = op + '-' + corte;
                            break;
                        case 'COLOR':
                            cellValue = abbreviateHeather(getVal(row, 'COLOR') || '');
                            break;
                        case 'OP-PTDA':
                            cellValue = currentOpPtda;
                            break;
                        case 'PDS':
                            const pds = parseFloat(getVal(row, 'PDS GIRADAS') || getVal(row, 'PDS') || 0) || 0;
                            cellValue = formatThousands(pds, 0);
                            break;
                        case 'PRENDA':
                            cellValue = normalizePrenda(getVal(row, 'PRENDA') || '');
                            break;
                        case 'ART.':
                            cellValue = getVal(row, 'ART?CULO') || '';
                            break;
                        case 'TIPO CERT.':
                            cellValue = normalizeTipoCert(getVal(row, 'TIPO CERTIFICADO') || '');
                            break;
                        case 'RIB':
                            const ribVal = getVal(row, 'RIB') || '';
                            cellValue = ribVal === 'NO LLEVA' ? '' : (ribVal ? 'SI' : '');
                            break;
                    }
                    td.textContent = cellValue;
                    tr.appendChild(td);
                });

                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            section.appendChild(table);

            const notasRows = notasRowsByTurn[turno] || [];
            section.appendChild(createCorteNotasPrintBlock(turno, notasRows));
            container.appendChild(section);
        });

        document.body.classList.add('print-corte-prog');
        setTimeout(() => { window.print(); }, 100);
    } catch (e) {
        console.error('Error printing Corte PROG', e);
    }
};

