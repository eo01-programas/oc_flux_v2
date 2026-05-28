// ========== FUNCIONES PARA BOTON PROGRAMAR EN HABILITADO ==========

// Helper: Obtener la clave de grupo OP+CORTE(centena) para una fila
function getOcGroupKey(rowIndex) {
    if (!rawData || !rawData[rowIndex]) return null;
    const row = rawData[rowIndex];
    const op = String(getVal(row, 'OP') || '').trim();
    const corte = String(getVal(row, 'CORTE') || '').trim();
    const corteNum = parseInt(corte);
    if (!op || isNaN(corteNum)) return op + '-' + corte; // fallback
    const centena = Math.floor(corteNum / 100);
    return op + '-G' + centena;
}

// Helper: Obtener todas las filas visibles en Habilitado con el mismo grupo OP+CORTE(centena)
function getVisibleHabilitadoRowsWithSameOcGroup(rowIndex) {
    const result = [];
    const targetKey = getOcGroupKey(rowIndex);
    if (!targetKey) return [rowIndex];

    // Obtener indices de filas visibles en tbody-habilitado
    try {
        const tbodyHab = document.getElementById('tbody-habilitado');
        if (tbodyHab) {
            const rows = tbodyHab.querySelectorAll('tr[data-row-index]');
            rows.forEach(tr => {
                const idx = parseInt(tr.getAttribute('data-row-index'));
                if (!isNaN(idx) && getOcGroupKey(idx) === targetKey) {
                    result.push(idx);
                }
            });
        }
    } catch (e) { console.error('Error obteniendo filas visibles habilitado:', e); }

    if (result.length === 0) result.push(rowIndex);
    return result;
}

function getHabilitadoCorteSeriesRowIndices(rowIndex) {
    if (!rawData || !rawData[rowIndex]) return [rowIndex];
    const currentRow = rawData[rowIndex];
    const currentOP = String(getVal(currentRow, 'OP') || '').trim();
    const currentCorte = String(getVal(currentRow, 'CORTE') || '').trim();
    const currentCorteNum = currentCorte.match(/\d+/);
    if (!currentOP || !currentCorteNum) return [rowIndex];

    const currentBase = currentCorteNum[0].slice(0, -1);
    const indices = [];
    for (let j = 1; j < rawData.length; j++) {
        const row = rawData[j];
        if (!row) continue;
        const otherOP = String(getVal(row, 'OP') || '').trim();
        if (otherOP !== currentOP) continue;
        const otherCorte = String(getVal(row, 'CORTE') || '').trim();
        const otherCorteNum = otherCorte.match(/\d+/);
        if (!otherCorteNum) continue;
        if (otherCorteNum[0].slice(0, -1) === currentBase) indices.push(j);
    }

    return indices.length ? indices : [rowIndex];
}

// Sets para rastrear grupos OP+CORTE(centena) ya tocados en esta sesion
let touchedPlantaOcGroups = new Set();
let touchedOcGroups = new Set();
let touchedFHabOcGroups = new Set();

// Handler para cuando se selecciona estado_habilitado en X PROG
window.handleEstadoHabilitadoChange = function (rowIndex, value, selectElement) {
    // Solo usar logica de pending cuando estamos en X PROG
    if (currentHabilitadoFilter !== 'X PROG') {
        updateRow(rowIndex, 'estado_habilitado', value, selectElement);
        setTimeout(renderHabilitado, 300);
        return;
    }

    const valUpper = (value || '').toUpperCase();
    const groupKey = getOcGroupKey(rowIndex);

    // Determinar si propagar: solo en la primera interaccion del grupo
    const isFirstTouch = groupKey && !touchedOcGroups.has(groupKey);

    // Decidir que filas actualizar
    let rowsToUpdate;
    if (isFirstTouch) {
        // Primera interaccion: propagar a todo el grupo
        rowsToUpdate = getVisibleHabilitadoRowsWithSameOcGroup(rowIndex);
        touchedOcGroups.add(groupKey);
        console.log(`[handleEstadoHabilitadoChange] PROPAGANDO grupo ${groupKey}, rowIndex=${rowIndex}, value=${value}, filas:`, rowsToUpdate);
    } else {
        // Grupo ya tocado: cambio individual
        rowsToUpdate = [rowIndex];
        console.log(`[handleEstadoHabilitadoChange] INDIVIDUAL rowIndex=${rowIndex}, value=${value}`);
    }

    // Aplicar a las filas correspondientes
    rowsToUpdate.forEach(idx => {
        if (valUpper === 'X PROG' || valUpper === '') {
            // Si vuelve a X PROG, quitar de pendientes
            if (pendingProgramarHabilitado[idx]) {
                delete pendingProgramarHabilitado[idx];
            }
        } else if (valUpper === 'PROG 1T' || valUpper === 'PROG 2T' || valUpper === 'PROG 3T') {
            // Guardar en pendientes
            const sourceRow = rawData[idx] || [];
            pendingProgramarHabilitado[idx] = {
                estado_habilitado: value,
                sourceOp: String(getVal(sourceRow, 'OP') || '').trim(),
                sourceCorte: String(getVal(sourceRow, 'CORTE') || '').trim(),
                sourceOpTela: String(getVal(sourceRow, 'OP TELA') || '').trim(),
                sourcePartida: String(getVal(sourceRow, 'PARTIDA') || '').trim(),
                sourceColor: String(getVal(sourceRow, 'COLOR') || '').trim()
            };
        }

        // Actualizar visualmente los selects de las filas
        try {
            const tbodyHab = document.getElementById('tbody-habilitado');
            if (tbodyHab) {
                const tr = tbodyHab.querySelector('tr[data-row-index="' + idx + '"]');
                if (tr) {
                    const habSelect = tr.querySelector('select[data-rowindex="' + idx + '"]');
                    if (habSelect) {
                        if (habSelect.value !== value) {
                            habSelect.value = value;
                        }
                        // Actualizar clase visual
                        if (valUpper === 'X PROG' || valUpper === '') {
                            habSelect.className = 'table-select';
                        } else if (valUpper.startsWith('PROG ')) {
                            habSelect.className = 'table-select sel-PROG';
                        }
                    }
                }
            }
        } catch (e) { console.error('Error actualizando fila habilitado:', idx, e); }
    });

    // Actualizar el boton Programar
    updateProgramarHabilitadoButton();
};

window.handleHabilitadoSelectChange = function (rowIndex, value, selectElement, previousValue) {
    const nextValue = String(value || '').toUpperCase().trim();
    const prevValue = String(previousValue || 'X PROG').toUpperCase().trim() || 'X PROG';

    if (nextValue === 'OK' || nextValue === 'OK S/DESTINO') {
        abrirModalIngresoCostura(rowIndex, nextValue);
        if (selectElement) selectElement.value = prevValue;
        return;
    }

    if (nextValue !== 'DEPURADO') {
        handleEstadoHabilitadoChange(rowIndex, value, selectElement);
        return;
    }

    askDepuradoConfirmModal().then(async function (confirmed) {
        if (!confirmed) {
            if (selectElement) selectElement.value = prevValue;
            return;
        }

        const relatedRows = getHabilitadoCorteSeriesRowIndices(rowIndex);
        relatedRows.forEach(function (idx) {
            if (pendingProgramarHabilitado[idx]) delete pendingProgramarHabilitado[idx];
        });
        updateProgramarHabilitadoButton();

        updateRow(rowIndex, 'estado_habilitado', 'DEPURADO', selectElement, true, true);
        await propagateToSameOPAndCorteSeries(rowIndex, 'estado_habilitado', 'DEPURADO');

        setTimeout(function () {
            try { renderHabilitado(); } catch (e) { }
            try { updateCounters(); } catch (e) { }
        }, 300);
    }).catch(function (error) {
        console.error('Error confirmando depurado', error);
        if (selectElement) selectElement.value = prevValue;
    });
};

// Actualiza la visibilidad y contador del boton Programar Habilitado
window.updateProgramarHabilitadoButton = function () {
    const btnProgramar = document.getElementById('btn-programar-habilitado');
    const badge = document.getElementById('badge-programar-habilitado-count');
    if (!btnProgramar) return;

    // Contar filas que tienen estado_habilitado asignado (PROG 1T/2T/3T)
    let count = 0;
    for (const rowIndex in pendingProgramarHabilitado) {
        const data = pendingProgramarHabilitado[rowIndex];
        if (data.estado_habilitado && data.estado_habilitado.toUpperCase().startsWith('PROG ')) {
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

// Funcion para programar todas las filas pendientes de Habilitado
window.programarFilasHabilitado = async function () {
    // Filtrar solo las filas que tienen estado_habilitado asignado
    const filasAProgramar = [];
    for (const rowIndex in pendingProgramarHabilitado) {
        const data = pendingProgramarHabilitado[rowIndex];
        if (data.estado_habilitado && data.estado_habilitado.toUpperCase().startsWith('PROG ')) {
            const idx = parseInt(rowIndex);
            const rowData = rawData[idx];
            const opTela = rowData ? String(rowData[colMap["OP TELA"]] || "").trim() : 'N/A';
            const partida = rowData ? String(rowData[colMap["PARTIDA"]] || "").trim() : 'N/A';
            const rowOp = rowData ? getVal(rowData, 'OP') : '';
            const rowCorte = rowData ? getVal(rowData, 'CORTE') : '';
            const rowOpTela = rowData ? getVal(rowData, 'OP TELA') : '';
            const rowPartida = rowData ? getVal(rowData, 'PARTIDA') : '';
            const rowColor = rowData ? getVal(rowData, 'COLOR') : '';
            console.log(`[programarFilasHabilitado] Preparando fila: rawData[${idx}] = OP-PTDA: ${opTela}-${partida}, estado: ${data.estado_habilitado}`);

            filasAProgramar.push({
                rowIndex: idx,
                estado_habilitado: data.estado_habilitado,
                sourceOp: String(data.sourceOp || rowOp || '').trim(),
                sourceCorte: String(data.sourceCorte || rowCorte || '').trim(),
                sourceOpTela: String(data.sourceOpTela || rowOpTela || '').trim(),
                sourcePartida: String(data.sourcePartida || rowPartida || '').trim(),
                sourceColor: String(data.sourceColor || rowColor || '').trim()
            });
        }
    }

    if (filasAProgramar.length === 0) {
        alert('No hay filas para programar. Debe seleccionar estado_habilitado (PROG 1T/2T/3T).');
        return;
    }

    // Mostrar loader o deshabilitar boton
    const btnProgramar = document.getElementById('btn-programar-habilitado');
    if (btnProgramar) {
        btnProgramar.disabled = true;
        btnProgramar.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
    }

    try {
        // Funcion auxiliar para encontrar indice de columna
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

        // Funcion para obtener el nombre exacto de la columna en el header
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

        function resolveHabilitadoRowIndexByKeys(fallbackRowIndex, rowKeys) {
            const norm = s => String(s || '').trim().toUpperCase();
            const keyOp = norm(rowKeys && rowKeys.sourceOp);
            const keyCorte = norm(rowKeys && rowKeys.sourceCorte);
            const keyOpTela = norm(rowKeys && rowKeys.sourceOpTela);
            const keyPartida = norm(rowKeys && rowKeys.sourcePartida);
            const keyColor = norm(rowKeys && rowKeys.sourceColor);
            const hasAny = !!(keyOp || keyCorte || keyOpTela || keyPartida || keyColor);
            if (!hasAny || !Array.isArray(rawData)) return fallbackRowIndex;

            let bestMatch = null;
            let bestDistance = Number.MAX_SAFE_INTEGER;
            for (let i = 1; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row) continue;
                const rowOp = norm(getVal(row, 'OP'));
                const rowCorte = norm(getVal(row, 'CORTE'));
                const rowOpTela = norm(getVal(row, 'OP TELA'));
                const rowPartida = norm(getVal(row, 'PARTIDA'));
                const rowColor = norm(getVal(row, 'COLOR'));
                const match = (!keyOp || rowOp === keyOp)
                    && (!keyCorte || rowCorte === keyCorte)
                    && (!keyOpTela || rowOpTela === keyOpTela)
                    && (!keyPartida || rowPartida === keyPartida)
                    && (!keyColor || rowColor === keyColor);
                if (match) {
                    if (Number.isInteger(fallbackRowIndex)) {
                        const distance = Math.abs(i - fallbackRowIndex);
                        if (bestMatch === null || distance < bestDistance) {
                            bestMatch = i;
                            bestDistance = distance;
                        }
                    } else {
                        bestMatch = i;
                        break;
                    }
                }
            }

            if (bestMatch !== null) return bestMatch;
            return fallbackRowIndex;
        }

        const promises = [];

        // Guardar cada fila
        for (const fila of filasAProgramar) {
            const targetRowIndex = resolveHabilitadoRowIndexByKeys(fila.rowIndex, fila);

            // Actualizar rawData localmente para estado_habilitado
            let habilIdx = colMap['estado_habilitado'];
            if (habilIdx === undefined || habilIdx === -1) {
                habilIdx = findColIndexNormalized('estado_habilitado');
                if (habilIdx !== -1) colMap['estado_habilitado'] = habilIdx;
            }
            if (habilIdx !== undefined && habilIdx !== -1 && rawData[targetRowIndex]) {
                rawData[targetRowIndex][habilIdx] = fila.estado_habilitado;
            }

            // Guardar estado_habilitado en Google Sheets
            const habilColName = getExactColName('estado_habilitado');
            console.log(`[programarFilasHabilitado] Guardando estado_habilitado: rawDataIndex=${targetRowIndex}, col=${habilColName}, value=${fila.estado_habilitado}`);
            promises.push(
                window.PcpProgramaService.actualizarCampoConOrigen(targetRowIndex, habilColName, fila.estado_habilitado, {
                    sourceOp: String(fila.sourceOp || '').trim(),
                    sourceCorte: String(fila.sourceCorte || '').trim(),
                    sourceOpTela: String(fila.sourceOpTela || '').trim(),
                    sourcePartida: String(fila.sourcePartida || '').trim(),
                    sourceColor: String(fila.sourceColor || '').trim()
                }, { noCors: true, headers: {} }).catch(e => console.error('Error guardando estado_habilitado', e))
            );
        }

        // Esperar a que todas las peticiones se envien
        await Promise.all(promises);

        // Espera adicional para dar tiempo al backend
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('[programarFilasHabilitado] Guardado completado para', filasAProgramar.length, 'filas');

        // Limpiar pendientes
        pendingProgramarHabilitado = {};
        touchedPlantaOcGroups = new Set();
        touchedOcGroups = new Set();

        // Ocultar boton
        if (btnProgramar) {
            btnProgramar.style.display = 'none';
            btnProgramar.disabled = false;
            btnProgramar.innerHTML = '<i class="ph ph-check-circle"></i> Programar <span class="kg-badge" id="badge-programar-habilitado-count" style="background: rgba(255,255,255,0.3); color: white;">0</span>';
        }

        // Re-renderizar la vista manteniendose en X PROG
        renderHabilitado();
        updateCounters();

    } catch (error) {
        console.error('Error al programar filas de habilitado:', error);
        alert('Ocurri? un error al guardar. Por favor intente nuevamente.');
        if (btnProgramar) {
            btnProgramar.disabled = false;
            btnProgramar.innerHTML = '<i class="ph ph-check-circle"></i> Programar <span class="kg-badge" id="badge-programar-habilitado-count" style="background: rgba(255,255,255,0.3); color: white;">' + filasAProgramar.length + '</span>';
        }
    }
};
