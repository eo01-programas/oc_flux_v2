async function propagateToSameOPAndCorteSeries(rowIndex, colName, value) {
    // Mostrar modal de carga
    const modalPropagacion = document.getElementById('modal-loading-propagacion');
    const statusText = document.getElementById('propagacion-status');
    if (modalPropagacion) {
        modalPropagacion.style.display = 'flex';
        if (statusText) statusText.textContent = 'Buscando filas relacionadas...';
    }

    try {
        console.log('=== INICIANDO PROPAGACI?N ===');
        console.log('Fila:', rowIndex, 'Columna:', colName, 'Valor:', value);

        // Funci?n auxiliar para normalizar nombres de columnas
        const findColIndexNormalized = function (name) {
            if (!rawData || rawData.length === 0) return -1;
            const headers = rawData[0];
            const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const target = norm(name);
            for (let i = 0; i < headers.length; i++) {
                if (norm(headers[i]) === target) return i;
            }
            return -1;
        };

        // Obtener ?ndices de columnas necesarias
        const opIdx = findColIndexNormalized('OP');
        const corteIdx = findColIndexNormalized('CORTE');

        // Para la columna objetivo, intentar primero el nombre exacto, luego variantes
        let colIdx = -1;

        // Si colName ya est? en colMap, usarlo
        if (colMap[colName] !== undefined && colMap[colName] !== -1) {
            colIdx = colMap[colName];
            console.log('Usando colIdx desde colMap:', colIdx);
        } else {
            // Intentar encontrar la columna
            colIdx = findColIndexNormalized(colName);

            // Si no encuentra la columna, intentar con variantes seg?n el tipo
            if (colIdx === -1) {
                console.log('No se encontr? columna con nombre:', colName, '- intentando variantes');

                if (colName.includes('BLOQUES') || colName.includes('bloques')) {
                    const variants = ['estado_bloques', 'ESTADO_BLOQUES', 'ESTADO BLOQUES'];
                    for (let v of variants) {
                        colIdx = findColIndexNormalized(v);
                        if (colIdx !== -1) {
                            console.log('Encontrada variante:', v, 'en ?ndice:', colIdx);
                            break;
                        }
                    }
                } else if (colName.includes('COLL') || colName.includes('TAP') || colName.includes('coll') || colName.includes('tap')) {
                    const variants = ['estado_coll_tap', 'ESTADO_COLL_TAP', 'ESTADO COLL TAP'];
                    for (let v of variants) {
                        colIdx = findColIndexNormalized(v);
                        if (colIdx !== -1) {
                            console.log('Encontrada variante:', v, 'en ?ndice:', colIdx);
                            break;
                        }
                    }
                } else if (colName.includes('rib') || colName.includes('RIB')) {
                    const variants = ['estado_rib', 'ESTADO_RIB', 'ESTADO RIB'];
                    for (let v of variants) {
                        colIdx = findColIndexNormalized(v);
                        if (colIdx !== -1) {
                            console.log('Encontrada variante:', v, 'en ?ndice:', colIdx);
                            break;
                        }
                    }
                }
            }
        }

        console.log('?ndices encontrados - OP:', opIdx, 'CORTE:', corteIdx, 'Columna objetivo:', colIdx);

        if (opIdx === -1 || corteIdx === -1 || colIdx === -1) {
            console.warn('No se encontraron columnas necesarias para propagar', { opIdx, corteIdx, colIdx });
            if (colIdx === -1) {
                console.warn('Headers disponibles:', rawData[0]);
            }
            if (modalPropagacion) modalPropagacion.style.display = 'none';
            return;
        }

        // Obtener valores de la fila actual
        const currentOP = String(rawData[rowIndex][opIdx] || '').trim();
        const currentCorte = String(rawData[rowIndex][corteIdx] || '').trim();

        console.log('Valores actuales - OP:', currentOP, 'CORTE:', currentCorte);

        if (!currentOP || !currentCorte) {
            console.warn('Fila sin OP o CORTE, no se propagar?');
            if (modalPropagacion) modalPropagacion.style.display = 'none';
            return;
        }

        // Extraer el n?mero base del corte (todos menos el ?ltimo d?gito)
        // Ejemplos: 101 -> 10, 403 -> 40, 1202 -> 120
        const corteNum = currentCorte.match(/\d+/);
        if (!corteNum) {
            console.warn('CORTE no contiene n?meros:', currentCorte);
            if (modalPropagacion) modalPropagacion.style.display = 'none';
            return;
        }

        const corteNumStr = corteNum[0];
        const corteBase = corteNumStr.slice(0, -1); // Remover ?ltimo d?gito

        console.log('Serie de corte identificada:', corteBase + 'x');

        // En Corte PROG 1T/2T/3T solo propagar a filas visibles actualmente en la tabla.
        const onCorteView = !!(document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active'));
        const corteFilterNorm = String(currentCorteFilter || '').toUpperCase().trim();
        const isProgTurno = (corteFilterNorm.startsWith('PROG ') && corteFilterNorm !== 'X PROG');
        const restrictToVisibleRows = onCorteView && isProgTurno;
        const visibleRows = new Set();
        if (restrictToVisibleRows) {
            try {
                const tbody = document.getElementById('tbody-corte');
                if (tbody) {
                    const trs = tbody.querySelectorAll('tr[data-row-index]');
                    trs.forEach(tr => {
                        const idx = parseInt(tr.getAttribute('data-row-index'));
                        if (!isNaN(idx)) visibleRows.add(idx);
                    });
                }
            } catch (e) {
                console.error('Error leyendo filas visibles para propagacion:', e);
            }
        }

        // Recopilar todas las filas que deben actualizarse
        const rowsToUpdate = [];

        // Buscar todas las filas con el mismo OP y mismo corteBase
        for (let j = 1; j < rawData.length; j++) {
            if (j === rowIndex) continue; // Saltar la fila actual
            if (restrictToVisibleRows && !visibleRows.has(j)) continue;

            const otherOP = String(rawData[j][opIdx] || '').trim();
            const otherCorte = String(rawData[j][corteIdx] || '').trim();

            // Verificar si tiene el mismo OP
            if (otherOP !== currentOP) continue;

            // Verificar si el corte pertenece a la misma serie
            const otherCorteNum = otherCorte.match(/\d+/);
            if (!otherCorteNum) continue;

            const otherCorteNumStr = otherCorteNum[0];
            const otherCorteBase = otherCorteNumStr.slice(0, -1);

            // Si el corteBase coincide, agregar a la lista
            if (otherCorteBase === corteBase) {
                rowsToUpdate.push({ rowIdx: j, corte: otherCorte });
            }
        }

        if (rowsToUpdate.length === 0) {
            console.log('No hay filas adicionales para propagar');
            if (modalPropagacion) modalPropagacion.style.display = 'none';
            return;
        }

        // Actualizar mensaje de estado
        if (statusText) statusText.textContent = `Guardando ${rowsToUpdate.length} filas...`;

        // Crear array de promesas para todas las actualizaciones
        const updatePromises = rowsToUpdate.map((item, index) => {
            const j = item.rowIdx;
            const prevValue = rawData[j][colIdx];
            console.log(`Fila ${j} (Corte: ${item.corte}): ${prevValue} -> ${value}`);

            rawData[j][colIdx] = value;

            // Determinar el nombre de columna correcto para enviar al backend
            const sendColName = (rawData[0] && rawData[0][colIdx]) ? rawData[0][colIdx] : colName;

            // Guardar cambio en el backend con un peque?o delay escalonado
            return new Promise((resolve) => {
                setTimeout(() => {
                    window.PcpProgramaService.actualizarCampo(j, sendColName, value, { noCors: true, headers: {} }).then(() => {
                        if (statusText) statusText.textContent = `Guardando... (${index + 1}/${rowsToUpdate.length})`;
                        resolve();
                    }).catch(e => {
                        console.error('Error guardando propagaci?n:', e);
                        resolve(); // Resolver de todas formas para no bloquear
                    });
                }, index * 50); // 50ms de delay entre cada petici?n
            });
        });

        // Esperar a que todas las actualizaciones terminen
        await Promise.all(updatePromises);

        console.log(`? Propagaci?n completada: ${rowsToUpdate.length} filas actualizadas para ${colName} en OP ${currentOP}, serie ${corteBase}x`);

        // Peque?a pausa antes de ocultar el modal
        if (statusText) statusText.textContent = '?Guardado completado!';
        await new Promise(resolve => setTimeout(resolve, 400));

    } catch (e) {
        console.error('Error en propagateToSameOPAndCorteSeries:', e);
    } finally {
        // Ocultar modal de carga
        if (modalPropagacion) modalPropagacion.style.display = 'none';
    }
}

// =============================================
// PROPAGACI?N DE RIB EN CORTE PZAS PROG 1T/2T/3T
// Al cambiar RIB, replicar a todas las filas con mismo OP-PTDA
// =============================================
window.handleRibChangeCorte = function (rowIndex, value, selectElement) {
    // 1. Actualizar la fila actual
    updateRow(rowIndex, 'estado_rib', value, selectElement, true);

    // 2. Solo propagar en sub-tabs PROG 1T/2T/3T de la vista Corte
    const corteFilterNorm = String(currentCorteFilter || '').toUpperCase().trim();
    const isProgSubtab = (corteFilterNorm.startsWith('PROG ') && corteFilterNorm !== 'X PROG');
    if (!isProgSubtab) return;

    // 3. Obtener OP-PTDA de la fila actual
    const currentRow = rawData[rowIndex];
    if (!currentRow) return;
    const opTela = String(getVal(currentRow, 'OP TELA') || '').trim();
    const partida = String(getVal(currentRow, 'PARTIDA') || '').trim();
    const currentOpPtda = opTela + '-' + partida;
    if (!currentOpPtda || currentOpPtda === '-') return;

    // 4. Buscar todas las filas visibles en tbody-corte con mismo OP-PTDA
    const tbody = document.getElementById('tbody-corte');
    if (!tbody) return;
    const allRows = tbody.querySelectorAll('tr[data-row-index]');
    allRows.forEach(tr => {
        const idx = parseInt(tr.getAttribute('data-row-index'));
        if (idx === rowIndex || isNaN(idx)) return; // saltar la fila actual
        const r = rawData[idx];
        if (!r) return;
        const ot = String(getVal(r, 'OP TELA') || '').trim();
        const pt = String(getVal(r, 'PARTIDA') || '').trim();
        const opPtda = ot + '-' + pt;
        if (opPtda !== currentOpPtda) return; // diferente OP-PTDA

        // Verificar que esta fila no sea NO LLEVA
        const ribOriginal = getVal(r, 'RIB') || 'NO LLEVA';
        if (ribOriginal === 'NO LLEVA') return;

        // Buscar el select de RIB en esta fila y actualizar
        const ribSelect = tr.querySelector('select[onchange*="handleRibChangeCorte"], select[onchange*="estado_rib"]');
        if (ribSelect) {
            ribSelect.value = value;
            // Actualizar en rawData y guardar en servidor
            updateRow(idx, 'estado_rib', value, ribSelect, true);
        }
    });
};

// =============================================
// PROPAGACI?N DE BLOQUES? EN CORTE PZAS PROG 1T/2T/3T
// Al cambiar BLOQUES?, replicar a todas las filas con mismo OP-PTDA
// =============================================
window.handleBloquesChangeCorte = function (rowIndex, value, selectElement) {
    // 1. Actualizar la fila actual
    updateRow(rowIndex, 'ESTADO_BLOQUES', value, selectElement, true);

    // 2. Solo propagar en sub-tabs PROG 1T/2T/3T de la vista Corte
    const corteFilterNorm = String(currentCorteFilter || '').toUpperCase().trim();
    const isProgSubtab = (corteFilterNorm.startsWith('PROG ') && corteFilterNorm !== 'X PROG');
    if (!isProgSubtab) return;

    // 3. Obtener OP-PTDA de la fila actual
    const currentRow = rawData[rowIndex];
    if (!currentRow) return;
    const opTela = String(getVal(currentRow, 'OP TELA') || '').trim();
    const partida = String(getVal(currentRow, 'PARTIDA') || '').trim();
    const currentOpPtda = opTela + '-' + partida;
    if (!currentOpPtda || currentOpPtda === '-') return;

    // 4. Buscar todas las filas visibles en tbody-corte con mismo OP-PTDA
    const tbody = document.getElementById('tbody-corte');
    if (!tbody) return;
    const allRows = tbody.querySelectorAll('tr[data-row-index]');
    allRows.forEach(tr => {
        const idx = parseInt(tr.getAttribute('data-row-index'));
        if (idx === rowIndex || isNaN(idx)) return;
        const r = rawData[idx];
        if (!r) return;
        const ot = String(getVal(r, 'OP TELA') || '').trim();
        const pt = String(getVal(r, 'PARTIDA') || '').trim();
        const opPtda = ot + '-' + pt;
        if (opPtda !== currentOpPtda) return;

        // Buscar el select de BLOQUES en esta fila y actualizar
        const bloqSelect = tr.querySelector('select[onchange*="handleBloquesChangeCorte"]');
        if (bloqSelect) {
            bloqSelect.value = value;
            updateRow(idx, 'ESTADO_BLOQUES', value, bloqSelect, true);
        }
    });
};

// =============================================
// PROPAGACI?N DE COLL o TAP? EN CORTE PZAS PROG 1T/2T/3T
// Al cambiar COLL o TAP?, replicar a todas las filas con mismo OP-PTDA
// =============================================
window.handleCollTapChangeCorte = function (rowIndex, value, selectElement) {
    // 1. Actualizar la fila actual
    updateRow(rowIndex, 'ESTADO_COLL_TAP', value, selectElement, true);

    // 2. Solo propagar en sub-tabs PROG 1T/2T/3T de la vista Corte
    const corteFilterNorm = String(currentCorteFilter || '').toUpperCase().trim();
    const isProgSubtab = (corteFilterNorm.startsWith('PROG ') && corteFilterNorm !== 'X PROG');
    if (!isProgSubtab) return;

    // 3. Obtener OP-PTDA de la fila actual
    const currentRow = rawData[rowIndex];
    if (!currentRow) return;
    const opTela = String(getVal(currentRow, 'OP TELA') || '').trim();
    const partida = String(getVal(currentRow, 'PARTIDA') || '').trim();
    const currentOpPtda = opTela + '-' + partida;
    if (!currentOpPtda || currentOpPtda === '-') return;

    // 4. Buscar todas las filas visibles en tbody-corte con mismo OP-PTDA
    const tbody = document.getElementById('tbody-corte');
    if (!tbody) return;
    const allRows = tbody.querySelectorAll('tr[data-row-index]');
    allRows.forEach(tr => {
        const idx = parseInt(tr.getAttribute('data-row-index'));
        if (idx === rowIndex || isNaN(idx)) return;
        const r = rawData[idx];
        if (!r) return;
        const ot = String(getVal(r, 'OP TELA') || '').trim();
        const pt = String(getVal(r, 'PARTIDA') || '').trim();
        const opPtda = ot + '-' + pt;
        if (opPtda !== currentOpPtda) return;

        // Buscar el select de COLL_TAP en esta fila y actualizar
        const collSelect = tr.querySelector('select[onchange*="handleCollTapChangeCorte"]');
        if (collSelect) {
            collSelect.value = value;
            updateRow(idx, 'ESTADO_COLL_TAP', value, collSelect, true);
        }
    });
};

