window.updateRow = function (rowIndex, colName, value, selectElement, skipPropagation, skipEnumPrompt) {
    const parsedRowIndex = Number.isInteger(rowIndex) ? rowIndex : parseInt(rowIndex, 10);
    let statusSavedByBatch = false;
    // Log para debugging
    console.log('updateRow llamado:', { rowIndex: parsedRowIndex, colName, value, skipPropagation: !!skipPropagation, skipEnumPrompt: !!skipEnumPrompt });

    // PROTECCI?N: No permitir escritura en la fila de encabezados (rawData[0])
    if (!Number.isInteger(parsedRowIndex) || parsedRowIndex < 1 || !rawData[parsedRowIndex]) {
        console.error('PROTECCI?N: Intento de escribir en fila inv?lida o encabezados. rowIndex=' + parsedRowIndex + ', colName=' + colName + ', value=' + value);
        return;
    }
    rowIndex = parsedRowIndex;

    if (colName.includes('estado_') || (typeof colName === 'string' && (colName.toUpperCase() === 'STATUS' || colName.toUpperCase() === 'STATUS_CORTE'))) {
        try {
            if (selectElement) {
                selectElement.className = "table-select";
                const v = (value || '').toString();
                // Aplicar clases m?s flexibles: cualquier variante que contenga 'PROG' se considera programado
                if (v.toUpperCase().includes('PROG')) selectElement.classList.add("sel-PROG");
                if (v === "OK" || v === 'OK ENM' || v === 'OK S/ENM' || v === 'OK PAQUETEO') selectElement.classList.add("sel-OK");
                if (v === "EN LAV") selectElement.classList.add("sel-ENLAV");
            }
        } catch (e) { console.error('Error actualizando clase del select:', e); }
    }

    // Asegurar que colMap tiene el ?ndice correcto para colName; intentar variantes normalizadas si es necesario
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

    // Resolver la columna de validacion aunque en la hoja este como VALIDA o VALIDACION.
    if (typeof colName === 'string') {
        const colNameUp = colName.toUpperCase().trim();
        if (colNameUp === 'VALIDACION' || colNameUp === 'VALIDA') {
            let idxVal = findHeaderIndexCaseInsensitive('VALIDACION');
            if (idxVal === -1) idxVal = findHeaderIndexCaseInsensitive('VALIDA');
            if (idxVal !== -1) {
                colMap['VALIDACION'] = idxVal;
                colMap['VALIDA'] = idxVal;
            }
        }
    }

    if (colMap[colName] === undefined || colMap[colName] === -1) {
        const found = findColIndexNormalized(colName);
        if (found !== -1) colMap[colName] = found;
    }

    let writeIdx = colMap[colName];
    const isStatusCorteColumn = (colName === 'estado_corte' || (typeof colName === 'string' && colName.toUpperCase() === 'STATUS') || (typeof colName === 'string' && colName.toUpperCase() === 'STATUS_CORTE'));
    let previousStatusCorteValue = '';
    if (isStatusCorteColumn) {
        try {
            const fromWriteIdx = (writeIdx !== undefined && writeIdx !== -1 && rawData[rowIndex] && rawData[rowIndex][writeIdx] !== undefined)
                ? String(rawData[rowIndex][writeIdx] || '').trim()
                : '';
            if (fromWriteIdx) {
                previousStatusCorteValue = fromWriteIdx;
            } else {
                previousStatusCorteValue = String(
                    getVal(rawData[rowIndex], 'STATUS_CORTE') ||
                    getVal(rawData[rowIndex], 'STATUS') ||
                    getVal(rawData[rowIndex], 'status') ||
                    getVal(rawData[rowIndex], 'estado_corte') ||
                    getVal(rawData[rowIndex], 'ESTADO CORTE') ||
                    getVal(rawData[rowIndex], 'ESTADO_CORTE') ||
                    ''
                ).trim();
            }
        } catch (e) {
            previousStatusCorteValue = '';
        }
    }

    // Evitar escribir por Ã­ndice en filas reciÃ©n insertadas localmente que aÃºn no existen en sheet.
    // Mantener el bloqueo solo durante una ventana corta real de sincronizaciÃ³n.
    if (rawData[rowIndex] && rawData[rowIndex]._inserted) {
        const insertedAt = Number(rawData[rowIndex]._inserted) || Date.now();
        const nowTs = Date.now();
        const pendingMs = nowTs - insertedAt;
        if (pendingMs < 2000) {
            if (!window._lastPendingSyncWarning || (nowTs - window._lastPendingSyncWarning) > 1500) {
                window._lastPendingSyncWarning = nowTs;
                if (typeof showToast === 'function') {
                    showToast('Sincronizando filas nuevas. Espere 2 segundos y reintente.', 'error');
                } else {
                    alert('Sincronizando filas nuevas con el sheet. Espere 2 segundos y vuelva a intentar.');
                }
            }
            try {
                if (selectElement && writeIdx !== undefined && writeIdx !== -1) {
                    selectElement.value = String(rawData[rowIndex][writeIdx] || '');
                }
            } catch (e) { }
            try { scheduleSheetResync(900); } catch (e) { }
            return;
        }

        // Si ya pasÃ³ la ventana de sincronizaciÃ³n, liberar el flag temporal.
        try { delete rawData[rowIndex]._inserted; } catch (e) { rawData[rowIndex]._inserted = undefined; }
    }

    // Corta cualquier escritura de estados en filas sin llave OP/CORTE para evitar filas parciales.
    try {
        const isStatusLikeCol = (typeof colName === 'string')
            && (colName.toUpperCase().includes('STATUS') || colName.toLowerCase().startsWith('estado_'));
        if (isStatusLikeCol) {
            const opKey = String(getVal(rawData[rowIndex], 'OP') || '').trim();
            const corteKey = String(getVal(rawData[rowIndex], 'CORTE') || '').trim();
            if (!opKey || !corteKey) {
                const nowTs2 = Date.now();
                if (!window._lastPendingSyncWarning || (nowTs2 - window._lastPendingSyncWarning) > 1500) {
                    window._lastPendingSyncWarning = nowTs2;
                    if (typeof showToast === 'function') showToast('Fila no sincronizada. Recargando datos del sheet...', 'error');
                    else alert('Fila no sincronizada. Recargando datos del sheet...');
                }
                try { scheduleSheetResync(900); } catch (e) { }
                return;
            }
        }
    } catch (e) { }

    // Validaci?n espec?fica solicitada:
    // En la vista Corte, cuando estamos en sub-tab PROG (1T/2T/3T) y
    // el usuario intenta marcar STATUS_CORTE = 'OK', validar que
    // tanto 'estado_bloques' como 'estado_coll_tap' NO est?n en 'LLEVA?'.
    try {
        const valNorm = (value || '').toString().toUpperCase().trim();
        const onCorteView = document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active');
        const isProgSubtab = (currentCorteFilter && currentCorteFilter.toString().toUpperCase().startsWith('PROG ') && currentCorteFilter !== 'X PROG');
        const isProgTurno = (currentCorteFilter === 'PROG 1T' || currentCorteFilter === 'PROG 2T' || currentCorteFilter === 'PROG 3T');
        const isProgTarget = (valNorm === 'PROG 1T' || valNorm === 'PROG 2T' || valNorm === 'PROG 3T');

        const isStatusCol = (colName === 'estado_corte' || (typeof colName === 'string' && colName.toUpperCase() === 'STATUS') || (typeof colName === 'string' && colName.toUpperCase().includes('STATUS_CORTE')));
        const isDirectUiChange = !!(selectElement && document.body && document.body.contains(selectElement));

        // Confirmacion extra: al marcar OK en PROG 1T/2T/3T preguntar si ya esta enumerado
        if (isStatusCol && valNorm === 'OK' && onCorteView && isProgTurno && !skipEnumPrompt && isDirectUiChange) {
            askEnumeradoConfirmModal().then(function (isEnumerado) {
                try {
                    window.updateRow(rowIndex, colName, value, selectElement, skipPropagation, true);
                    if (isEnumerado) {
                        const fake = document.createElement('select');
                        fake.className = 'table-select';
                        window.updateRow(rowIndex, 'estado_enumerado', 'OK ENM', fake, true, true);
                    }
                } catch (e) {
                    console.error('Error aplicando confirmacion de enumerado:', e);
                }
            }).catch(function (e) {
                console.error('Error en modal de enumerado:', e);
                window.updateRow(rowIndex, colName, value, selectElement, skipPropagation, true);
            });
            return;
        }

        // VALIDACIÃ“N 1: Nunca permitir programar (PROG 1T/2T/3T) si no tiene equipo_corte
        if (isStatusCol && isProgTarget) {
            const equipoCorteIdx = findColIndexNormalized('equipo_corte');
            let equipoCorte = (equipoCorteIdx !== -1 && rawData[rowIndex] && rawData[rowIndex][equipoCorteIdx]) ? String(rawData[rowIndex][equipoCorteIdx]).trim() : '';
            try {
                if (!equipoCorte && typeof pendingProgramarCorte !== 'undefined' && pendingProgramarCorte[rowIndex] && pendingProgramarCorte[rowIndex].equipo_corte) {
                    equipoCorte = String(pendingProgramarCorte[rowIndex].equipo_corte || '').trim();
                }
            } catch (e) { }

            if (!equipoCorte || equipoCorte === '') {
                // Revertir selecci?n visual al valor anterior
                const prev = (writeIdx !== undefined && writeIdx !== -1 && rawData[rowIndex] && rawData[rowIndex][writeIdx]) ? rawData[rowIndex][writeIdx] : '';
                try { if (selectElement) selectElement.value = prev; } catch (e) { }
                try { if (selectElement) { selectElement.style.border = '2px solid #ef4444'; setTimeout(() => { selectElement.style.border = ''; }, 1600); } } catch (e) { }
                alert('Debe seleccionar equipo_corte antes de programar (PROG 1T/2T/3T).');
                return; // cancelar guardado
            }
        }

        // VALIDACI?N 2: Al marcar STATUS_CORTE = 'OK' en sub-tabs PROG
        // - Primero: impedir si estado_bloqueo o estado_lavada no son 'OK'
        if (isStatusCol && valNorm === 'OK' && onCorteView && isProgSubtab) {
            // Obtener valor de RUTA TELA para excepciones (p.ej. ACABADA)
            const idxRuta = findColIndexNormalized('RUTA TELA');
            const rutaRaw = (idxRuta !== -1 && rawData[rowIndex] && rawData[rowIndex][idxRuta]) ? String(rawData[rowIndex][idxRuta]).toUpperCase().trim() : '';

            // Si la ruta es ACABADA, no requerimos que est? OK en estado_lavada;
            // en ese caso s?lo exigimos que BLOQUES y COLL/TAP est?n completados
            let estBloqRaw = '';
            let estLavRaw = '';
            if (rutaRaw !== 'ACABADA') {
                const idxEstBloq = findColIndexNormalized('estado_bloqueo');
                const idxEstLav = findColIndexNormalized('estado_lavada');
                estBloqRaw = (idxEstBloq !== -1 && rawData[rowIndex] && rawData[rowIndex][idxEstBloq]) ? String(rawData[rowIndex][idxEstBloq]).toUpperCase().trim() : '';
                estLavRaw = (idxEstLav !== -1 && rawData[rowIndex] && rawData[rowIndex][idxEstLav]) ? String(rawData[rowIndex][idxEstLav]).toUpperCase().trim() : '';
            }

            const needBloquear = (rutaRaw === 'ACABADA') ? false : (estBloqRaw !== 'OK');
            const needLavar = (rutaRaw === 'ACABADA') ? false : (estLavRaw !== 'OK');

            if (needBloquear || needLavar) {
                // Mensaje espec?fico seg?n el caso
                let msg = '';
                if (needBloquear && needLavar) msg = 'Por bloquear y por lavar';
                else if (needBloquear) msg = 'Por bloquear';
                else msg = 'Por lavar';

                // Revertir selecci?n visual al valor anterior
                const prev = (writeIdx !== undefined && writeIdx !== -1 && rawData[rowIndex] && rawData[rowIndex][writeIdx]) ? rawData[rowIndex][writeIdx] : '';
                try { if (selectElement) selectElement.value = prev; } catch (e) { }
                try { if (selectElement) { selectElement.style.border = '2px solid #ef4444'; setTimeout(() => { selectElement.style.border = ''; }, 1600); } } catch (e) { }
                alert(msg);
                return; // cancelar guardado
            }

            // Si pasa la validaci?n anterior, continuar con la validaci?n existente
            // localizar ?ndices normalizados para las dos columnas
            const findBestIndexForRow = function (rIdx, names) {
                // findColIndexNormalized est? definido m?s arriba en este scope
                // Priorizar la columna existente cuyo valor en la fila no est? vac?a
                for (let n of names) {
                    const idx = findColIndexNormalized(n);
                    if (idx !== -1) {
                        const cell = (rawData[rIdx] && rawData[rIdx][idx]) ? String(rawData[rIdx][idx]).trim() : '';
                        if (cell !== '') return idx;
                    }
                }
                // Si no hay ninguna no-vac?a, devolver la primera columna existente (si existe)
                for (let n of names) {
                    const idx = findColIndexNormalized(n);
                    if (idx !== -1) return idx;
                }
                return -1;
            };

            const bloqCandidates = ['ESTADO BLOQUES', 'ESTADO_BLOQUES', 'estado_bloques'];
            const collCandidates = ['ESTADO COLL TAP', 'ESTADO_COLL_TAP', 'estado_coll_tap'];

            const idxBloqFinal = findBestIndexForRow(rowIndex, bloqCandidates);
            const idxCollFinal = findBestIndexForRow(rowIndex, collCandidates);

            const bloqVal = (idxBloqFinal !== -1 && rawData[rowIndex] && rawData[rowIndex][idxBloqFinal]) ? String(rawData[rowIndex][idxBloqFinal]).toUpperCase().trim() : '';
            const collVal = (idxCollFinal !== -1 && rawData[rowIndex] && rawData[rowIndex][idxCollFinal]) ? String(rawData[rowIndex][idxCollFinal]).toUpperCase().trim() : '';

            // Validar que no est?n en 'LLEVA?' O que no est?n vac?os
            if (bloqVal === 'LLEVA?' || collVal === 'LLEVA?' || bloqVal === '' || collVal === '') {
                // Revertir selecci?n visual al valor anterior y avisar al usuario
                const prev = (writeIdx !== undefined && writeIdx !== -1 && rawData[rowIndex] && rawData[rowIndex][writeIdx]) ? rawData[rowIndex][writeIdx] : '';
                try { if (selectElement) selectElement.value = prev; } catch (e) { }
                try { if (selectElement) { selectElement.style.border = '2px solid #ef4444'; setTimeout(() => { selectElement.style.border = ''; }, 1600); } } catch (e) { }
                alert('Completar BLOQUES/COLL/TAP');
                return; // cancelar guardado y propagaci?n
            }
        }

        // VALIDACIÃ“N 3: No permitir vaciar equipo_corte si la fila estÃ¡ programada en PROG 1T/2T/3T.
        const isEquipoCol = (typeof colName === 'string' && colName.toUpperCase().replace(/[^A-Z0-9]/g, '') === 'EQUIPOCORTE');
        if (isEquipoCol) {
            const nextEquipo = String(value || '').trim();
            if (nextEquipo === '') {
                const estadoCandidates = ['STATUS_CORTE', 'STATUS', 'status', 'estado_corte', 'ESTADO CORTE', 'ESTADO_CORTE'];
                let estadoActual = '';
                for (let k = 0; k < estadoCandidates.length; k++) {
                    const idxEstado = findColIndexNormalized(estadoCandidates[k]);
                    if (idxEstado !== -1 && rawData[rowIndex]) {
                        const v = String(rawData[rowIndex][idxEstado] || '').toUpperCase().trim();
                        if (v !== '') { estadoActual = v; break; }
                    }
                }
                if (estadoActual === 'PROG 1T' || estadoActual === 'PROG 2T' || estadoActual === 'PROG 3T') {
                    const prevEq = (writeIdx !== undefined && writeIdx !== -1 && rawData[rowIndex] && rawData[rowIndex][writeIdx]) ? rawData[rowIndex][writeIdx] : '';
                    try { if (selectElement) selectElement.value = prevEq; } catch (e) { }
                    try { if (selectElement) { selectElement.style.border = '2px solid #ef4444'; setTimeout(() => { selectElement.style.border = ''; }, 1600); } } catch (e) { }
                    alert('No se puede dejar equipo_corte vacÃ­o mientras STATUS_CORTE estÃ© en PROG 1T/2T/3T.');
                    return;
                }
            }
        }
    } catch (e) {
        console.error('Error validaci?n OK Corte:', e);
    }

    if (writeIdx !== undefined && writeIdx !== -1) rawData[rowIndex][writeIdx] = value;
    try { window._ocSearchDataStamp = Date.now(); } catch (e) { }
    try { updateCounters(); } catch (e) { console.error('Error en updateCounters:', e); }

    // --- FIX: asegurar que 'estado_enumerado' se actualiza en rawData aunque colMap falle ---
    try {
        const normKey = (colName || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normKey === 'estadoenumerado' || colName === 'estado_enumerado') {
            const idxEv = findHeaderIndexCaseInsensitive('estado_enumerado');
            if (idxEv !== -1) {
                const vNorm = (value || '').toString().trim();
                rawData[rowIndex][idxEv] = vNorm;
                // ensure colMap is aware for future ops
                colMap['estado_enumerado'] = idxEv;
                writeIdx = idxEv;
            }
        }
    } catch (e) { console.error('Error asegurando rawData para estado_enumerado', e); }

    // --- FIX: asegurar writeIdx para cualquier columna si a?n no se resolvi? ---
    try {
        if (writeIdx === undefined || writeIdx === -1) {
            const idxFallback = findHeaderIndexCaseInsensitive(colName);
            if (idxFallback !== -1) {
                writeIdx = idxFallback;
                colMap[colName] = idxFallback;
                rawData[rowIndex][idxFallback] = value;
            }
        }
    } catch (e) { console.error('Error en fallback writeIdx:', e); }

    // Loguear intento de guardado para depuraci?n (ver Network/Console)
    try {
        const payloadPreview = { row: rowIndex, colName: (rawData[0] && rawData[0][writeIdx]) ? rawData[0][writeIdx] : colName, value };
        console.log('Sending update to backend (preview):', payloadPreview);
    } catch (e) { console.log('Preview log failed', e); }

    // Si cambiamos el bloqueo a PROG, acumular filas para guardar con el bot?n "Programar"
    // en lugar de guardar inmediatamente (para evitar problemas de timing)
    if (colName === 'estado_bloqueo') {
        try {
            if (value === 'PROG' && colMap["OP TELA"] !== undefined && colMap["PARTIDA"] !== undefined) {
                const opTela = String(rawData[rowIndex][colMap["OP TELA"]] || "").trim().toLowerCase();
                const partida = String(rawData[rowIndex][colMap["PARTIDA"]] || "").trim().toLowerCase();
                const key = opTela + "-" + partida;

                // Obtener ?ndices de filas visibles en la tabla actual (tbody-bloqueo)
                let visibleRowIndices = new Set();
                try {
                    const tbodyBloqueo = document.getElementById('tbody-bloqueo');
                    if (tbodyBloqueo) {
                        const rows = tbodyBloqueo.querySelectorAll('tr[data-row-index]');
                        rows.forEach(tr => {
                            const idx = parseInt(tr.getAttribute('data-row-index'));
                            if (!isNaN(idx)) visibleRowIndices.add(idx);
                        });
                    }
                    console.log('Filas visibles en tbody-bloqueo:', visibleRowIndices.size, 'filas');
                } catch (e) { console.error('Error obteniendo filas visibles:', e); }

                // Recolectar TODAS las filas del mismo OP-PTDA que est?n visibles
                // (incluyendo la fila actual)
                let filasDelGrupo = [rowIndex]; // Incluir la fila actual

                for (let j = 1; j < rawData.length; j++) {
                    if (j === rowIndex) continue;

                    const row = rawData[j];

                    // Solo procesar filas que est?n visibles en la tabla actual
                    if (!visibleRowIndices.has(j)) continue;

                    const otherOpTela = String(row[colMap["OP TELA"]] || "").trim().toLowerCase();
                    const otherPartida = String(row[colMap["PARTIDA"]] || "").trim().toLowerCase();

                    if ((otherOpTela + "-" + otherPartida) === key) {
                        filasDelGrupo.push(j);
                        // Actualizar rawData localmente para reflejar el cambio visual
                        rawData[j][colMap['estado_bloqueo']] = 'PROG';
                    }
                }

                // Agregar al mapa de pendientes (reemplaza si ya exist?a)
                pendingProgramarBloqueo[key] = filasDelGrupo;

                console.log('Filas acumuladas para programar:', key, '=', filasDelGrupo.length, 'filas:', filasDelGrupo);

                // Actualizar el bot?n "Programar"
                updateBtnProgramarBloqueo();

                // Actualizar visualmente SOLO los selects de las filas afectadas (sin re-renderizar)
                // para que las filas NO se muevan al subtab "Programado" a?n
                try {
                    const tbodyBloqueo = document.getElementById('tbody-bloqueo');
                    if (tbodyBloqueo) {
                        filasDelGrupo.forEach(idx => {
                            const tr = tbodyBloqueo.querySelector(`tr[data-row-index="${idx}"]`);
                            if (tr) {
                                const selectBloq = tr.querySelector('select[onchange*="estado_bloqueo"]');
                                if (selectBloq) {
                                    selectBloq.value = 'PROG';
                                    selectBloq.className = 'table-select sel-PROG';
                                }
                            }
                        });
                    }
                } catch (e) { console.error('Error actualizando selects visualmente:', e); }

                // NO guardar en backend aqu? - se har? al presionar el bot?n "Programar"
                return; // Salir para no ejecutar el fetch al final de updateRow
            }
        } catch (err) {
            console.error('Error acumulando PROG:', err);
        }

        // Volver a renderizar las vistas seg?n el nuevo estado de bloqueo
        // Si NO es PROG (es OK u otro), guardar normalmente
        if (value !== 'PROG') {
            setTimeout(() => {
                renderBloqueo();
                renderLavado();
                renderCorte();
            }, 600);
        }
    }

    if (colName === 'estado_lavada') {
        setTimeout(() => {
            renderLavado();
            renderCorte();
        }, 600);
    }

    if (colName === 'estado_enumerado') {
        // Si cambiamos estado_enumerado, actualizar Enumerado y Habilitado
        setTimeout(() => {
            renderEnumerado();
            renderHabilitado();
        }, 600);
    }

    if (colName === 'estado_transfer') {
        // Si cambiamos estado_transfer, actualizar Transfer
        setTimeout(() => {
            renderTransfer();
        }, 600);
    }

    if (typeof colName === 'string' && (colName.toUpperCase() === 'VALIDACION' || colName.toUpperCase() === 'VALIDA')) {
        // Recalcular al instante los totales PDS de Habilitado al marcar/desmarcar VALIDA.
        setTimeout(() => {
            renderHabilitado();
        }, 150);
    }

    if (colName === 'estado_rib') {
        // Propagar cambios en vista Corte, sub-tabs PROG (1T/2T/3T)
        try {
            const onCorteView = document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active');
            const isProgSubtab = (currentCorteFilter && currentCorteFilter.toString().toUpperCase().startsWith('PROG ') && currentCorteFilter !== 'X PROG');

            if (onCorteView && isProgSubtab && !skipPropagation) {
                propagateToSameOPAndCorteSeries(rowIndex, 'estado_rib', value);
                // Re-renderizar la vista despu?s de propagar
                setTimeout(() => { renderCorte(); }, 300);
            }
        } catch (e) { console.error('Error propagando estado_rib:', e); }

        // Cuando se cambia RIB, re-renderizar Bloqueo para habilitar/deshabilitar el select
        try { setTimeout(() => { renderBloqueo(); }, 200); } catch (e) { }
    }

    if (colName === 'n.transfxpda') {
        // Si cambi el n.transfxpda (por ejemplo a 'NO LLEVA'), actualizar Transfer
        setTimeout(() => {
            renderTransfer();
        }, 600);
    }

    // Manejo de cambios en ESTADO_BLOQUES
    if (colName === 'ESTADO_BLOQUES' || colName === 'ESTADO BLOQUES' || colName === 'estado_bloques') {
        console.log('Detectado cambio en ESTADO_BLOQUES');
        try {
            const onCorteView = document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active');
            const isProgSubtab = (currentCorteFilter && currentCorteFilter.toString().toUpperCase().startsWith('PROG ') && currentCorteFilter !== 'X PROG');

            console.log('Vista Corte activa:', onCorteView, 'Sub-tab PROG:', isProgSubtab, 'Filter:', currentCorteFilter, 'skipPropagation:', !!skipPropagation);

            if (onCorteView && isProgSubtab && !skipPropagation) {
                console.log('Llamando a propagateToSameOPAndCorteSeries para ESTADO_BLOQUES');
                propagateToSameOPAndCorteSeries(rowIndex, colName, value);
                // Re-renderizar la vista despu?s de propagar
                setTimeout(() => { renderCorte(); }, 300);
            }
        } catch (e) { console.error('Error propagando ESTADO_BLOQUES:', e); }
    }

    // Manejo de cambios en ESTADO_COLL_TAP
    if (colName === 'ESTADO_COLL_TAP' || colName === 'ESTADO COLL TAP' || colName === 'estado_coll_tap') {
        console.log('Detectado cambio en ESTADO_COLL_TAP');
        try {
            const onCorteView = document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active');
            const isProgSubtab = (currentCorteFilter && currentCorteFilter.toString().toUpperCase().startsWith('PROG ') && currentCorteFilter !== 'X PROG');

            console.log('Vista Corte activa:', onCorteView, 'Sub-tab PROG:', isProgSubtab, 'Filter:', currentCorteFilter, 'skipPropagation:', !!skipPropagation);

            if (onCorteView && isProgSubtab && !skipPropagation) {
                console.log('Llamando a propagateToSameOPAndCorteSeries para ESTADO_COLL_TAP');
                propagateToSameOPAndCorteSeries(rowIndex, colName, value);
                // Re-renderizar la vista despu?s de propagar
                setTimeout(() => { renderCorte(); }, 300);
            }
        } catch (e) { console.error('Error propagando ESTADO_COLL_TAP:', e); }
    }

    if (colName === 'estado_corte_bloques') {
        // Si cambiamos estado_corte_bloques: comportamiento l?nea-a-l?nea.
        // 1) Reflejar inmediatamente el valor seleccionado en la celda (evita que quede invisible)
        // 2) Actualizar contadores locales
        // 3) Seguir guardando en el sheet (petici?n se env?a m?s abajo como siempre)
        try {
            if (selectElement) {
                const txt = (selectElement.options && selectElement.selectedIndex >= 0 && selectElement.options[selectElement.selectedIndex]) ? selectElement.options[selectElement.selectedIndex].text : String(value);
                const td = selectElement.closest && selectElement.closest('td');
                if (td) td.innerText = txt;
            }
        } catch (e) { console.error('Error actualizando UI estado_corte_bloques:', e); }

        try { updateCorteBloquesCounters(); } catch (e) { }

        // Re-renderizar la vista en breve para mantener consistencia visual
        setTimeout(() => {
            renderCorteBloques();
        }, 600);
    }

    if (colName === 'estado_corte' || (typeof colName === 'string' && colName.toUpperCase() === 'STATUS') || (typeof colName === 'string' && colName.toUpperCase() === 'STATUS_CORTE')) {
        try {
            // Normalizar nombre de columna para buscar ?ndices
            const opTelaIdx = (colMap["OP TELA"] !== undefined) ? colMap["OP TELA"] : findColIndexNormalized('OP TELA');
            const partidaIdx = (colMap["PARTIDA"] !== undefined) ? colMap["PARTIDA"] : findColIndexNormalized('PARTIDA');

            // Decidir si debemos propagar el cambio a todas las filas con la misma OP-PTDA.
            // Regla: cuando el cambio viene de un select visible (edicion manual por fila),
            // NO propagar a otras filas.
            const valNorm = (value || '').toString().toUpperCase().trim();
            const onCorteView = document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active');
            const isProgSubtab = (currentCorteFilter && currentCorteFilter.toString().toUpperCase().startsWith('PROG ') && currentCorteFilter !== 'X PROG');
            const isProgTarget = (valNorm === 'PROG 1T' || valNorm === 'PROG 2T' || valNorm === 'PROG 3T');
            const isDirectUiChange = !!(selectElement && document.body && document.body.contains(selectElement));
            const resolvedStatusColName = (writeIdx !== undefined && writeIdx !== -1 && rawData[0] && rawData[0][writeIdx]) ? rawData[0][writeIdx] : colName;

            // Al marcar OK desde Corte PROG 1T/2T/3T:
            // TURNO CORTE = estado_corte anterior (antes de OK)
            // FECHA CORTE = fecha y hora actual en formato dd/mmm/yy HH:mm (24h)
            if (valNorm === 'OK' && onCorteView && isProgSubtab) {
                try {
                    const estadoCorteAnterior = String(previousStatusCorteValue || '').trim();
                    const turnoCorteValue = (estadoCorteAnterior && estadoCorteAnterior.toUpperCase() !== 'OK')
                        ? estadoCorteAnterior
                        : String(currentCorteFilter || '').trim();
                    const updates = [{ colName: resolvedStatusColName, value: value }];
                    const idxTurnoCorte = findColIndexNormalized('TURNO CORTE');
                    if (idxTurnoCorte !== -1 && turnoCorteValue) {
                        rawData[rowIndex][idxTurnoCorte] = turnoCorteValue;
                        const turnoColName = (rawData[0] && rawData[0][idxTurnoCorte]) ? rawData[0][idxTurnoCorte] : 'TURNO CORTE';
                        updates.push({ colName: turnoColName, value: turnoCorteValue });
                    }

                    const idxFechaCorte = findColIndexNormalized('FECHA CORTE');
                    if (idxFechaCorte !== -1) {
                        const now = new Date();
                        const monthsShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                        const fechaCorte = `${String(now.getDate()).padStart(2, '0')}/${monthsShort[now.getMonth()]}/${String(now.getFullYear()).slice(-2)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        rawData[rowIndex][idxFechaCorte] = fechaCorte;
                        const fechaColName = (rawData[0] && rawData[0][idxFechaCorte]) ? rawData[0][idxFechaCorte] : 'FECHA CORTE';
                        updates.push({ colName: fechaColName, value: fechaCorte });
                    }

                    const rowDataForKeys = rawData[rowIndex] || [];
                    window.PcpProgramaService.actualizarFilaBatch({
                        row: rowIndex,
                        sourceOp: String(getVal(rowDataForKeys, 'OP') || '').trim(),
                        sourceCorte: String(getVal(rowDataForKeys, 'CORTE') || '').trim(),
                        sourceOpTela: String(getVal(rowDataForKeys, 'OP TELA') || '').trim(),
                        sourcePartida: String(getVal(rowDataForKeys, 'PARTIDA') || '').trim(),
                        sourceColor: String(getVal(rowDataForKeys, 'COLOR') || '').trim(),
                        sourcePds: String(getVal(rowDataForKeys, 'PDS GIRADAS') || '').trim(),
                        updates: updates
                    }, { noCors: true, headers: {} }).catch(e => console.error('Error guardando STATUS/TURNO/FECHA CORTE:', e));
                    statusSavedByBatch = true;
                } catch (e) {
                    console.error('Error registrando TURNO/FECHA CORTE al marcar OK:', e);
                }
            }

            const shouldPropagate = !skipPropagation && !isDirectUiChange && !(valNorm === 'OK' && onCorteView && isProgSubtab);

            // *** F.PROGBAC: Preparar fecha si RUTA TELA = ACABADA y valor = PROG 1T/2T/3T ***
            const idxRutaTela = findColIndexNormalized('RUTA TELA');
            const rutaTela = (idxRutaTela !== -1 && rawData[rowIndex] && rawData[rowIndex][idxRutaTela]) ? String(rawData[rowIndex][idxRutaTela]).toUpperCase().trim() : '';
            const idxFProgbac = findColIndexNormalized('F.PROGBAC');
            let fechaHoyCorte = null;

            // Obtener ?ndices de filas visibles en la tabla actual (tbody-corte)
            let visibleRowIndicesCorte = new Set();
            try {
                const tbodyCorte = document.getElementById('tbody-corte');
                if (tbodyCorte) {
                    const rows = tbodyCorte.querySelectorAll('tr[data-row-index]');
                    rows.forEach(tr => {
                        const idx = parseInt(tr.getAttribute('data-row-index'));
                        if (!isNaN(idx)) visibleRowIndicesCorte.add(idx);
                    });
                }
            } catch (e) { console.error('Error obteniendo filas visibles Corte:', e); }

            if ((valNorm === 'PROG 1T' || valNorm === 'PROG 2T' || valNorm === 'PROG 3T') && rutaTela === 'ACABADA' && idxFProgbac !== -1) {
                const today = new Date();
                const dd = String(today.getDate()).padStart(2, '0');
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const yyyy = today.getFullYear();
                fechaHoyCorte = dd + '/' + mm + '/' + yyyy;
                colMap['F.PROGBAC'] = idxFProgbac;

                // Guardar F.PROGBAC para la fila actual
                rawData[rowIndex][idxFProgbac] = fechaHoyCorte;
                const rowDataForKeys = rawData[rowIndex] || [];
                window.PcpProgramaService.actualizarCampoConOrigen(rowIndex, 'F.PROGBAC', fechaHoyCorte, {
                    sourceOp: String(getVal(rowDataForKeys, 'OP') || '').trim(),
                    sourceCorte: String(getVal(rowDataForKeys, 'CORTE') || '').trim(),
                    sourceOpTela: String(getVal(rowDataForKeys, 'OP TELA') || '').trim(),
                    sourcePartida: String(getVal(rowDataForKeys, 'PARTIDA') || '').trim(),
                    sourceColor: String(getVal(rowDataForKeys, 'COLOR') || '').trim(),
                    sourcePds: String(getVal(rowDataForKeys, 'PDS GIRADAS') || '').trim()
                }, { noCors: true, headers: {} }).catch(e => console.error('Error guardando F.PROGBAC:', e));
                console.log('F.PROGBAC guardado:', fechaHoyCorte, 'para fila', rowIndex, '(RUTA TELA = ACABADA)');
            }

            if (shouldPropagate && opTelaIdx !== -1 && partidaIdx !== -1) {
                const opTelaBase = String(rawData[rowIndex][opTelaIdx] || '').trim().toLowerCase();
                const partidaBase = String(rawData[rowIndex][partidaIdx] || '').trim().toLowerCase();
                const key = opTelaBase + '-' + partidaBase;

                // Obtener el equipo_corte de la fila actual para propagarlo tambi?n
                const equipoCorteIdx = findColIndexNormalized('equipo_corte');
                const equipoCorteValue = (equipoCorteIdx !== -1 && rawData[rowIndex] && rawData[rowIndex][equipoCorteIdx]) ? rawData[rowIndex][equipoCorteIdx] : '';
                let skippedNoEquipo = 0;

                for (let j = 1; j < rawData.length; j++) {
                    if (j === rowIndex) continue;
                    // Solo procesar filas que est?n visibles en la tabla actual
                    if (!visibleRowIndicesCorte.has(j)) continue;

                    const otherOp = String(rawData[j][opTelaIdx] || '').trim().toLowerCase();
                    const otherPart = String(rawData[j][partidaIdx] || '').trim().toLowerCase();
                    if ((otherOp + '-' + otherPart) === key) {
                        // No propagar estados PROG a filas sin equipo_corte.
                        if (isProgTarget && equipoCorteIdx !== -1) {
                            const targetEquipo = (rawData[j] && rawData[j][equipoCorteIdx]) ? String(rawData[j][equipoCorteIdx]).trim() : '';
                            if (!targetEquipo) {
                                skippedNoEquipo++;
                                continue;
                            }
                        }

                        const prev = rawData[j][writeIdx];
                        if (prev !== value) {
                            rawData[j][writeIdx] = value;
                            // Guardar el cambio en backend (no-cors). Usar nombre exacto de cabecera resuelto
                            window.PcpProgramaService.actualizarCampo(j, resolvedStatusColName, value, { noCors: true, headers: {} }).catch(e => console.error('Error guardando propagado estado_corte', e));
                        }

                        // Propagar tambi?n el equipo_corte si estamos en sub-tab X PROG
                        if (onCorteView && currentCorteFilter === 'X PROG' && equipoCorteIdx !== -1 && equipoCorteValue) {
                            const prevEquipo = rawData[j][equipoCorteIdx];
                            if (prevEquipo !== equipoCorteValue) {
                                rawData[j][equipoCorteIdx] = equipoCorteValue;
                                // Guardar el cambio de equipo_corte en backend
                                window.PcpProgramaService.actualizarCampo(j, 'equipo_corte', equipoCorteValue, { noCors: true, headers: {} }).catch(e => console.error('Error guardando propagado equipo_corte', e));
                            }
                        }

                        // *** F.PROGBAC: Propagar fecha a filas agrupadas visibles si aplica (ACABADA + PROG 1T/2T/3T) ***
                        if (fechaHoyCorte && idxFProgbac !== -1) {
                            rawData[j][idxFProgbac] = fechaHoyCorte;
                            window.PcpProgramaService.actualizarCampoConOrigen(j, 'F.PROGBAC', fechaHoyCorte, {
                                sourceOp: String(rawData[j][colMap["OP"]] || getVal(rawData[j], 'OP') || '').trim(),
                                sourceCorte: String(rawData[j][colMap["CORTE"]] || getVal(rawData[j], 'CORTE') || '').trim(),
                                sourceOpTela: String(rawData[j][colMap["OP TELA"]] || getVal(rawData[j], 'OP TELA') || '').trim(),
                                sourcePartida: String(rawData[j][colMap["PARTIDA"]] || getVal(rawData[j], 'PARTIDA') || '').trim(),
                                sourceColor: String(rawData[j][colMap["COLOR"]] || getVal(rawData[j], 'COLOR') || '').trim(),
                                sourcePds: String(rawData[j][colMap["PDS GIRADAS"]] || getVal(rawData[j], 'PDS GIRADAS') || '').trim()
                            }, { noCors: true, headers: {} }).catch(e => console.error('Error guardando F.PROGBAC propagado:', e));
                            console.log('F.PROGBAC propagado:', fechaHoyCorte, 'para fila', j, '(estado_corte)');
                        }
                    }
                }

                if (isProgTarget && skippedNoEquipo > 0) {
                    const msgSkip = `Se omitieron ${skippedNoEquipo} fila(s) sin equipo_corte para evitar programar sin equipo.`;
                    try {
                        const isDirectUiChange = !!(selectElement && document.body && document.body.contains(selectElement));
                        if (isDirectUiChange) {
                            if (typeof showToast === 'function') showToast(msgSkip, 'warning');
                            else alert(msgSkip);
                        } else {
                            console.warn(msgSkip);
                        }
                    } catch (e) { console.warn(msgSkip); }
                }
            }

            // Determinar comportamiento seg?n nuevo valor: si es OK -> mostrar Enumerado,
            // si es un PROG -> ir a Corte y seleccionar sub-tab correspondiente.
            const tabMap = {
                'X PROG': 'corte-btn-xprog',
                'PROG 1T': 'corte-btn-1t',
                'PROG 2T': 'corte-btn-2t',
                'PROG 3T': 'corte-btn-3t'
            };
            const suppressAutoSwitch = !!window._suppressCorteStatusAutoSwitch;
            if (!suppressAutoSwitch) {
                if (valNorm === 'OK') {
                    // Si el cambio a OK se realiz? desde un sub-tab de Corte PROG (1T/2T/3T),
                    // mantener la vista y el sub-tab actuales para no desorientar al usuario
                    // y NO propagar (comportamiento aplicado arriba).
                    if (onCorteView && isProgSubtab) {
                        setTimeout(() => { renderEnumerado(); renderCorte(); }, 600);
                    } else {
                        // Seleccionar la vista Enumerado si existe
                        let enumBtn = null;
                        document.querySelectorAll('.nav-tab').forEach(nb => {
                            const onclickAttr = nb.getAttribute('onclick') || '';
                            if (onclickAttr.indexOf("switchView('enumerado'") !== -1) enumBtn = nb;
                        });
                        if (enumBtn) switchView('enumerado', enumBtn);
                        setTimeout(() => { renderEnumerado(); renderCorte(); }, 600);
                    }
                } else {
                    // Ir a Corte y seleccionar sub-tab correspondiente
                    const btnId = tabMap[valNorm] || tabMap['X PROG'];
                    const subBtn = document.getElementById(btnId);

                    let mainNavBtn = null;
                    document.querySelectorAll('.nav-tab').forEach(nb => {
                        const onclickAttr = nb.getAttribute('onclick') || '';
                        if (onclickAttr.indexOf("switchView('corte'") !== -1) mainNavBtn = nb;
                    });
                    if (mainNavBtn) switchView('corte', mainNavBtn);

                    if (subBtn) {
                        filterCorte(valNorm, subBtn);
                    } else {
                        setTimeout(() => { renderCorte(); }, 600);
                    }
                }
            }
        } catch (err) {
            console.error('Error al propagar estado_corte:', err);
            setTimeout(() => {
                renderCorte();
                renderEnumerado();
            }, 600);
        }
    }

    // Propagar equipo_corte cuando se cambia en sub-tab X PROG
    if (colName === 'equipo_corte') {
        try {
            const onCorteView = document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active');

            // Solo propagar si estamos en vista Corte y sub-tab X PROG
            if (onCorteView && currentCorteFilter === 'X PROG') {
                const opTelaIdx = (colMap["OP TELA"] !== undefined) ? colMap["OP TELA"] : findColIndexNormalized('OP TELA');
                const partidaIdx = (colMap["PARTIDA"] !== undefined) ? colMap["PARTIDA"] : findColIndexNormalized('PARTIDA');

                if (opTelaIdx !== -1 && partidaIdx !== -1) {
                    const opTelaBase = String(rawData[rowIndex][opTelaIdx] || '').trim().toLowerCase();
                    const partidaBase = String(rawData[rowIndex][partidaIdx] || '').trim().toLowerCase();
                    const key = opTelaBase + '-' + partidaBase;

                    for (let j = 1; j < rawData.length; j++) {
                        if (j === rowIndex) continue;
                        const otherOp = String(rawData[j][opTelaIdx] || '').trim().toLowerCase();
                        const otherPart = String(rawData[j][partidaIdx] || '').trim().toLowerCase();

                        if ((otherOp + '-' + otherPart) === key) {
                            const prev = rawData[j][writeIdx];
                            if (prev !== value) {
                                rawData[j][writeIdx] = value;
                                // Guardar el cambio en backend
                                window.PcpProgramaService.actualizarCampoConOrigen(j, 'equipo_corte', value, {
                                    sourceOp: String(rawData[j][opIdx] || getVal(rawData[j], 'OP') || '').trim(),
                                    sourceCorte: String(rawData[j][corteIdx] || getVal(rawData[j], 'CORTE') || '').trim(),
                                    sourceOpTela: String(rawData[j][opTelaIdx] || getVal(rawData[j], 'OP TELA') || '').trim(),
                                    sourcePartida: String(rawData[j][partidaIdx] || getVal(rawData[j], 'PARTIDA') || '').trim(),
                                    sourceColor: String(rawData[j][colorIdx] || getVal(rawData[j], 'COLOR') || '').trim(),
                                    sourcePds: String(rawData[j][pdsIdx] || getVal(rawData[j], 'PDS GIRADAS') || '').trim()
                                }, { noCors: true, headers: {} }).catch(e => console.error('Error guardando propagado equipo_corte', e));
                            }
                        }
                    }
                }
            }

            // Re-renderizar la vista Corte despu?s de propagar
            setTimeout(() => { renderCorte(); }, 600);
        } catch (err) {
            console.error('Error propagando equipo_corte:', err);
            setTimeout(() => { renderCorte(); }, 600);
        }
    }

    // Guardar el cambio original (si no fue guardado por la propagaci?n)
    // Enviar al backend el nombre exacto de la cabecera si podemos
    // localizarlo para asegurar que el sheet reciba la columna correcta.
    try {
        const isStatusColForFinalSave = (colName === 'estado_corte' || (typeof colName === 'string' && colName.toUpperCase() === 'STATUS') || (typeof colName === 'string' && colName.toUpperCase() === 'STATUS_CORTE'));
        if (statusSavedByBatch && isStatusColForFinalSave) return;

        let sendColName = colName;
        if (writeIdx !== undefined && writeIdx !== -1 && rawData[0] && rawData[0][writeIdx]) {
            sendColName = rawData[0][writeIdx];
        } else {
            // intentar resolver por normalizaci?n usando findHeaderIndexCaseInsensitive
            const found = findHeaderIndexCaseInsensitive(colName);
            if (found !== -1 && rawData[0] && rawData[0][found]) {
                sendColName = rawData[0][found];
                writeIdx = found;
            } else {
                // ?ltimo intento: b?squeda inline normalizada
                const foundInline = (function (name) {
                    if (!rawData || rawData.length === 0) return -1;
                    const headers = rawData[0];
                    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const target = norm(name);
                    for (let i = 0; i < headers.length; i++) {
                        if (norm(headers[i]) === target) return i;
                    }
                    return -1;
                })(colName);
                if (foundInline !== -1 && rawData[0] && rawData[0][foundInline]) sendColName = rawData[0][foundInline];
            }
        }

        console.log('Guardando en backend:', { row: rowIndex, colName: sendColName, value: value, writeIdx: writeIdx });
        const rowDataForKeys = rawData[rowIndex] || [];
        window.PcpProgramaService.actualizarCampoConOrigen(rowIndex, sendColName, value, {
            sourceOp: String(getVal(rowDataForKeys, 'OP') || '').trim(),
            sourceCorte: String(getVal(rowDataForKeys, 'CORTE') || '').trim(),
            sourceOpTela: String(getVal(rowDataForKeys, 'OP TELA') || '').trim(),
            sourcePartida: String(getVal(rowDataForKeys, 'PARTIDA') || '').trim(),
            sourceColor: String(getVal(rowDataForKeys, 'COLOR') || '').trim(),
            sourcePds: String(getVal(rowDataForKeys, 'PDS GIRADAS') || '').trim()
        }, { noCors: true, headers: {} }).catch(e => console.error("Error guardando", e));
    } catch (e) {
        console.error('Error preparando guardado:', e);
        // Intento de emergencia: enviar con colName original
        try {
            const rowDataForKeys = rawData[rowIndex] || [];
            window.PcpProgramaService.actualizarCampoConOrigen(rowIndex, colName, value, {
                sourceOp: String(getVal(rowDataForKeys, 'OP') || '').trim(),
                sourceCorte: String(getVal(rowDataForKeys, 'CORTE') || '').trim(),
                sourceOpTela: String(getVal(rowDataForKeys, 'OP TELA') || '').trim(),
                sourcePartida: String(getVal(rowDataForKeys, 'PARTIDA') || '').trim(),
                sourceColor: String(getVal(rowDataForKeys, 'COLOR') || '').trim(),
                sourcePds: String(getVal(rowDataForKeys, 'PDS GIRADAS') || '').trim()
            }, { noCors: true, headers: {} }).catch(e2 => console.error("Error guardando (emergencia)", e2));
        } catch (e2) { console.error('Error total guardando:', e2); }
    }
};

