function getVisibleRowsWithSameOpPtda(rowIndex) {
    const result = [];
    if (!rawData || !rawData[rowIndex]) return result;

    const row = rawData[rowIndex];
    const opTela = String(row[colMap["OP TELA"]] || "").trim().toLowerCase();
    const partida = String(row[colMap["PARTIDA"]] || "").trim().toLowerCase();
    const key = opTela + "-" + partida;

    // Obtener F. GIRADO de la fila actual para comparar
    const fGiradoRef = String(getVal(row, "F. GIRADO") || "").trim().toLowerCase();

    // Obtener ?ndices de filas visibles en tbody-corte
    const visibleRowIndices = new Set();
    try {
        const tbodyCorte = document.getElementById('tbody-corte');
        if (tbodyCorte) {
            const rows = tbodyCorte.querySelectorAll('tr[data-row-index]');
            rows.forEach(tr => {
                const idx = parseInt(tr.getAttribute('data-row-index'));
                if (!isNaN(idx)) visibleRowIndices.add(idx);
            });
        }
    } catch (e) { console.error('Error obteniendo filas visibles:', e); }

    // Buscar filas con el mismo OP-PTDA Y el mismo F. GIRADO
    for (let i = 1; i < rawData.length; i++) {
        if (!visibleRowIndices.has(i)) continue;

        const r = rawData[i];
        const otherOpTela = String(r[colMap["OP TELA"]] || "").trim().toLowerCase();
        const otherPartida = String(r[colMap["PARTIDA"]] || "").trim().toLowerCase();
        const otherKey = otherOpTela + "-" + otherPartida;

        const otherFGirado = String(getVal(r, "F. GIRADO") || "").trim().toLowerCase();

        if (otherKey === key && otherFGirado === fGiradoRef) {
            result.push(i);
        }
    }

    return result;
}

// Helper: Obtener todas las filas visibles en Corte con el mismo OP-PTDA
// (sin restringir por F. GIRADO). Se usa en sub-tabs PROG cuando se regresa a X PROG.
function getVisibleRowsWithSameOpPtdaOnly(rowIndex) {
    const result = [];
    if (!rawData || !rawData[rowIndex]) return result;

    const row = rawData[rowIndex];
    const opTela = String(row[colMap["OP TELA"]] || "").trim().toLowerCase();
    const partida = String(row[colMap["PARTIDA"]] || "").trim().toLowerCase();
    const key = opTela + "-" + partida;
    if (!opTela || !partida) return [rowIndex];

    try {
        const tbodyCorte = document.getElementById('tbody-corte');
        if (!tbodyCorte) return [rowIndex];

        const rows = tbodyCorte.querySelectorAll('tr[data-row-index]');
        rows.forEach(tr => {
            const idx = parseInt(tr.getAttribute('data-row-index'));
            if (isNaN(idx) || !rawData[idx]) return;
            const r = rawData[idx];
            const otherOpTela = String(r[colMap["OP TELA"]] || "").trim().toLowerCase();
            const otherPartida = String(r[colMap["PARTIDA"]] || "").trim().toLowerCase();
            const otherKey = otherOpTela + "-" + otherPartida;
            if (otherKey === key) result.push(idx);
        });
    } catch (e) {
        console.error('Error obteniendo filas visibles por OP-PTDA:', e);
    }

    if (!result.includes(rowIndex)) result.unshift(rowIndex);
    return result;
}

// Handler para cuando se selecciona equipo_corte en X PROG
window.handleEquipoCorteChange = function (rowIndex, value, selectElement) {
    console.log(`[handleEquipoCorteChange] rowIndex=${rowIndex}, value=${value}`);

    // Obtener todas las filas del mismo OP-PTDA visibles en la vista
    const rowsToUpdate = getVisibleRowsWithSameOpPtda(rowIndex);
    console.log(`[handleEquipoCorteChange] Filas a propagar:`, rowsToUpdate);

    // Propagar el cambio a todas las filas del mismo OP-PTDA
    rowsToUpdate.forEach(idx => {
        // DEBUG: Verificar datos de la fila
        const rowData = rawData[idx];
        if (rowData) {
            const opTela = String(rowData[colMap["OP TELA"]] || "").trim();
            const partida = String(rowData[colMap["PARTIDA"]] || "").trim();
            console.log(`[handleEquipoCorteChange] Propagando a rawData[${idx}] = OP-PTDA: ${opTela}-${partida}`);
        }

        // Guardar en pendingProgramarCorte
        if (!pendingProgramarCorte[idx]) {
            pendingProgramarCorte[idx] = {};
        }
        pendingProgramarCorte[idx].equipo_corte = value;

        // Actualizar visualmente los selects de las otras filas
        try {
            const tbodyCorte = document.getElementById('tbody-corte');
            if (tbodyCorte) {
                const tr = tbodyCorte.querySelector('tr[data-row-index="' + idx + '"]');
                if (tr) {
                    // Actualizar select de equipo_corte
                    const equipoSelect = tr.querySelector('select[onchange*="handleEquipoCorteChange"]');
                    if (equipoSelect && equipoSelect.value !== value) {
                        equipoSelect.value = value;
                    }

                    // Habilitar/deshabilitar select de STATUS_CORTE
                    const statusSelect = tr.querySelector('select[data-rowindex="' + idx + '"]:not([onchange*="handleEquipoCorteChange"])');
                    if (statusSelect) {
                        if (value && value.trim() !== '') {
                            statusSelect.disabled = false;
                            statusSelect.removeAttribute('title');
                        } else {
                            statusSelect.disabled = true;
                            statusSelect.setAttribute('title', 'Primero seleccione equipo_corte');
                            // Limpiar el pending si no tiene status_corte
                            if (pendingProgramarCorte[idx]) {
                                delete pendingProgramarCorte[idx].equipo_corte;
                                if (!pendingProgramarCorte[idx].status_corte) {
                                    delete pendingProgramarCorte[idx];
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) { console.error('Error actualizando fila:', idx, e); }
    });

    // Actualizar el bot?n Programar
    updateProgramarButton();
};

// Handler para cambios de STATUS_CORTE en Corte Pzas
window.handleStatusCorteChange = function (rowIndex, colName, value, selectElement) {
    // Si NO estamos en la vista Corte (ej: Enumerado, Habilitado), guardar directamente con updateRow
    try {
        const onCorteView = document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active');
        if (!onCorteView) {
            updateRow(rowIndex, colName, value, selectElement);
            return;
        }
    } catch (e) {
        // En caso de error, usar updateRow como fallback seguro
        updateRow(rowIndex, colName, value, selectElement);
        return;
    }

    const valUpper = (value || '').toUpperCase().trim();
    const isProgSubtab = (currentCorteFilter === 'PROG 1T' || currentCorteFilter === 'PROG 2T' || currentCorteFilter === 'PROG 3T');

    // LÃ³gica especial por sub-tab de Corte
    if (currentCorteFilter !== 'X PROG') {
        // En PROG 1T/2T/3T: si el usuario selecciona X PROG,
        // devolver todas las filas visibles del mismo OP-PTDA a Por Programar.
        if (isProgSubtab && valUpper === 'X PROG') {
            const rowsToUpdate = getVisibleRowsWithSameOpPtdaOnly(rowIndex);
            const tbodyCorte = document.getElementById('tbody-corte');
            const updates = rowsToUpdate.map(idx => {
                let targetSelect = null;
                if (idx === rowIndex) {
                    targetSelect = selectElement || null;
                } else if (tbodyCorte) {
                    const tr = tbodyCorte.querySelector('tr[data-row-index="' + idx + '"]');
                    if (tr) {
                        targetSelect = tr.querySelector('select[data-rowindex="' + idx + '"]:not([onchange*="handleEquipoCorteChange"])');
                    }
                }
                return { idx, targetSelect };
            });

            window._suppressCorteStatusAutoSwitch = true;
            try {
                updates.forEach(item => {
                    updateRow(item.idx, colName, 'X PROG', item.targetSelect, true);
                });
            } finally {
                window._suppressCorteStatusAutoSwitch = false;
            }

            try {
                const btnXProg = document.getElementById('corte-btn-xprog');
                if (btnXProg) filterCorte('X PROG', btnXProg);
                else {
                    currentCorteFilter = 'X PROG';
                    renderCorte();
                }
            } catch (e) {
                setTimeout(() => { renderCorte(); }, 300);
            }
            return;
        }

        // Si no estamos en X PROG, usar el comportamiento normal
        updateRow(rowIndex, colName, value, selectElement);
        return;
    }

    // Obtener todas las filas del mismo OP-PTDA visibles en la vista
    const rowsToUpdate = getVisibleRowsWithSameOpPtda(rowIndex);

    // Propagar el cambio a todas las filas del mismo OP-PTDA
    rowsToUpdate.forEach(idx => {
        if (valUpper === 'X PROG') {
            // Si vuelve a X PROG, quitar de pendientes
            if (pendingProgramarCorte[idx]) {
                delete pendingProgramarCorte[idx].status_corte;
                delete pendingProgramarCorte[idx].colName;
                if (!pendingProgramarCorte[idx].equipo_corte) {
                    delete pendingProgramarCorte[idx];
                }
            }
        } else if (valUpper === 'PROG 1T' || valUpper === 'PROG 2T' || valUpper === 'PROG 3T') {
            // Guardar en pendientes
            if (!pendingProgramarCorte[idx]) {
                pendingProgramarCorte[idx] = {};
            }
            pendingProgramarCorte[idx].status_corte = value;
            pendingProgramarCorte[idx].colName = colName;
        }

        // Actualizar visualmente los selects de las otras filas
        try {
            const tbodyCorte = document.getElementById('tbody-corte');
            if (tbodyCorte) {
                const tr = tbodyCorte.querySelector('tr[data-row-index="' + idx + '"]');
                if (tr) {
                    const statusSelect = tr.querySelector('select[data-rowindex="' + idx + '"]:not([onchange*="handleEquipoCorteChange"])');
                    if (statusSelect && statusSelect.value !== value) {
                        statusSelect.value = value;
                        // Actualizar clase visual
                        if (valUpper === 'X PROG') {
                            statusSelect.className = 'table-select';
                        } else if (valUpper.startsWith('PROG ')) {
                            statusSelect.className = 'table-select sel-PROG';
                        }
                    }
                }
            }
        } catch (e) { console.error('Error actualizando fila:', idx, e); }
    });

    // Actualizar el bot?n Programar
    updateProgramarButton();
};

// Actualiza la visibilidad y contador del bot?n Programar
window.updateProgramarButton = function () {
    const btnProgramar = document.getElementById('btn-programar-corte');
    const badge = document.getElementById('badge-programar-count');
    if (!btnProgramar) return;

    // Contar filas que tienen AMBOS: equipo_corte Y status_corte (PROG 1T/2T/3T)
    let count = 0;
    for (const rowIndex in pendingProgramarCorte) {
        const data = pendingProgramarCorte[rowIndex];
        if (data.equipo_corte && data.equipo_corte.trim() !== '' &&
            data.status_corte && data.status_corte.toUpperCase().startsWith('PROG ')) {
            count++;
        }
    }

    if (count > 0) {
        btnProgramar.style.display = 'inline-flex';
        if (badge) badge.textContent = count;
    } else {
        btnProgramar.style.display = 'none';
        if (badge) badge.textContent = '0';
    }
};

// Funci?n para programar todas las filas pendientes
window.programarFilasCorte = async function () {
    // Filtrar solo las filas que tienen ambos campos completos
    const filasAProgramar = [];
    for (const rowIndex in pendingProgramarCorte) {
        const data = pendingProgramarCorte[rowIndex];
        if (data.equipo_corte && data.equipo_corte.trim() !== '' &&
            data.status_corte && data.status_corte.toUpperCase().startsWith('PROG ')) {
            const idx = parseInt(rowIndex);
            // DEBUG: Verificar que el ?ndice corresponde a los datos correctos
            const rowData = rawData[idx];
            const opTela = rowData ? String(rowData[colMap["OP TELA"]] || "").trim() : 'N/A';
            const partida = rowData ? String(rowData[colMap["PARTIDA"]] || "").trim() : 'N/A';
            console.log(`[programarFilasCorte] Preparando fila: rawData[${idx}] = OP-PTDA: ${opTela}-${partida}, equipo: ${data.equipo_corte}, status: ${data.status_corte}`);

            filasAProgramar.push({
                rowIndex: idx,
                equipo_corte: data.equipo_corte,
                status_corte: data.status_corte,
                colName: data.colName || 'STATUS_CORTE'
            });
        }
    }

    if (filasAProgramar.length === 0) {
        alert('No hay filas para programar. Debe seleccionar equipo_corte y STATUS_CORTE.');
        return;
    }

    // Mostrar loader o deshabilitar bot?n
    const btnProgramar = document.getElementById('btn-programar-corte');
    if (btnProgramar) {
        btnProgramar.disabled = true;
        btnProgramar.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
    }

    try {
        // Funci?n auxiliar para encontrar ?ndice de columna
        function findColIndexNormalized(name) {
            if (!rawData || rawData.length === 0) return -1;
            const headers = rawData[0];
            const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const target = norm(name);
            for (let i = 0; i < headers.length; i++) {
                if (norm(headers[i]) === target) return i;
            }
            return -1;
        }

        // Funci?n para obtener el nombre exacto de la columna en el header
        function getExactColName(colName) {
            let writeIdx = colMap[colName];
            if (writeIdx === undefined || writeIdx === -1) {
                writeIdx = findColIndexNormalized(colName);
            }
            if (writeIdx !== undefined && writeIdx !== -1 && rawData[0] && rawData[0][writeIdx]) {
                return rawData[0][writeIdx];
            }
            return colName;
        }

        // Guardar cada fila en una sola llamada batch para reducir inconsistencias
        // por concurrencia y alinear con la resolucion por claves del backend.
        for (const fila of filasAProgramar) {
            const rowData = rawData[fila.rowIndex] || [];

            // Actualizar rawData localmente para equipo_corte
            let equipoIdx = colMap['equipo_corte'];
            if (equipoIdx === undefined || equipoIdx === -1) {
                equipoIdx = findColIndexNormalized('equipo_corte');
                if (equipoIdx !== -1) colMap['equipo_corte'] = equipoIdx;
            }
            if (equipoIdx !== undefined && equipoIdx !== -1) {
                rowData[equipoIdx] = fila.equipo_corte;
            }

            // Actualizar rawData localmente para STATUS_CORTE
            let statusIdx = colMap[fila.colName];
            if (statusIdx === undefined || statusIdx === -1) {
                statusIdx = findColIndexNormalized(fila.colName);
                if (statusIdx !== -1) colMap[fila.colName] = statusIdx;
            }
            if (statusIdx !== undefined && statusIdx !== -1) {
                rowData[statusIdx] = fila.status_corte;
            }

            const equipoColName = getExactColName('equipo_corte');
            const statusColName = getExactColName(fila.colName);
            const updates = [
                { colName: equipoColName, value: fila.equipo_corte },
                { colName: statusColName, value: fila.status_corte }
            ];

            // *** F.PROGBAC: Guardar fecha si RUTA TELA = ACABADA y status = PROG 1T/2T/3T ***
            try {
                const statusNorm = (fila.status_corte || '').toUpperCase().trim();
                if (statusNorm === 'PROG 1T' || statusNorm === 'PROG 2T' || statusNorm === 'PROG 3T') {
                    const idxRutaTela = findColIndexNormalized('RUTA TELA');
                    const rutaTela = (idxRutaTela !== -1 && rowData[idxRutaTela])
                        ? String(rowData[idxRutaTela]).toUpperCase().trim() : '';

                    if (rutaTela === 'ACABADA') {
                        const idxFProgbac = findColIndexNormalized('F.PROGBAC');
                        if (idxFProgbac !== -1) {
                            const today = new Date();
                            const dd = String(today.getDate()).padStart(2, '0');
                            const mm = String(today.getMonth() + 1).padStart(2, '0');
                            const yyyy = today.getFullYear();
                            const fechaHoy = dd + '/' + mm + '/' + yyyy;

                            rowData[idxFProgbac] = fechaHoy;
                            colMap['F.PROGBAC'] = idxFProgbac;
                            updates.push({ colName: getExactColName('F.PROGBAC'), value: fechaHoy });

                            console.log('F.PROGBAC incluido en batch:', fechaHoy, 'para rawDataIndex', fila.rowIndex, '(ACABADA desde programarFilasCorte)');
                        }
                    }
                }
            } catch (e) { console.error('Error preparando F.PROGBAC en programarFilasCorte:', e); }

            // NOTA: row es el indice de rawData (0-based de datos, excluyendo encabezado),
            // y el backend lo normaliza a indice de Google Sheets con +1.
            const payload = {
                action: 'batchUpdateRow',
                row: fila.rowIndex,
                sourceOp: String(getVal(rowData, 'OP') || '').trim(),
                sourceCorte: String(getVal(rowData, 'CORTE') || '').trim(),
                sourceOpTela: String(getVal(rowData, 'OP TELA') || '').trim(),
                sourcePartida: String(getVal(rowData, 'PARTIDA') || '').trim(),
                sourceColor: String(getVal(rowData, 'COLOR') || '').trim(),
                updates: updates
            };

            console.log(`[programarFilasCorte] Guardando batch: rawDataIndex=${fila.rowIndex}, updates=${updates.length}`);
            await window.PcpProgramaService.actualizarFilaBatch(payload, { noCors: true, headers: {} }).catch(e => console.error('Error guardando batch programar corte', e));

            // Evita rafagas muy agresivas contra Apps Script.
            await new Promise(resolve => setTimeout(resolve, 40));
        }

        // Espera breve para que Apps Script consolide los cambios antes de re-render.
        await new Promise(resolve => setTimeout(resolve, 900));

        // Limpiar pendientes
        pendingProgramarCorte = {};

        // Ocultar bot?n
        if (btnProgramar) {
            btnProgramar.style.display = 'none';
            btnProgramar.disabled = false;
            btnProgramar.innerHTML = '<i class="ph ph-check-circle"></i> Programar <span class="kg-badge" id="badge-programar-count" style="background: rgba(255,255,255,0.3); color: white;">0</span>';
        }

        // Invalidar cachÃ© de bÃºsqueda OC y, si hay query activa, reenfocar resultado actualizado.
        try { window._ocSearchState = null; } catch (e) { }
        try { window._ocSearchDataStamp = Date.now(); } catch (e) { }
        const searchInputAfterProgramar = document.getElementById('search-oc-input');
        const ocQueryActiva = searchInputAfterProgramar ? String(searchInputAfterProgramar.value || '').trim() : '';

        // Re-renderizar la vista manteni?ndose en X PROG
        renderCorte();
        updateCounters();
        scheduleSheetResync(2200);

        if (ocQueryActiva !== '') {
            setTimeout(() => {
                try { buscarOC(ocQueryActiva); } catch (e) { console.error('Error refrescando bÃºsqueda OC post-programar:', e); }
            }, 160);
        }

    } catch (error) {
        console.error('Error al programar filas:', error);
        alert('Ocurri? un error al guardar. Por favor intente nuevamente.');
        if (btnProgramar) {
            btnProgramar.disabled = false;
            btnProgramar.innerHTML = '<i class="ph ph-check-circle"></i> Programar <span class="kg-badge" id="badge-programar-count" style="background: rgba(255,255,255,0.3); color: white;">' + filasAProgramar.length + '</span>';
        }
    }
};

// ========== FUNCIONES PARA BOT?N PROGRAMAR EN BLOQUEO ==========

// Actualiza la visibilidad y contador del bot?n Programar Bloqueo
