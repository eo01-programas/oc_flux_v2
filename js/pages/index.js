
    // --- CONFIGURACI?N ---
    const SHEET_ID = window.PCP_CONFIG.SHEET_ID;
    let rawData = [];
    let colMap = {};
    let currentBloqueoFilter = 'X PROG';
    // Filtros aplicados desde el encabezado (ahora soportan m?ltiples filtros)
    // Formato: Array de { field: 'CLIENTE', value: 'ABC' }
    let bloqueoHeaderFilters = []; // M?ltiples filtros para Bloqueo
    let corteHeaderFilters = []; // M?ltiples filtros para Corte
    let enumeradoHeaderFilters = []; // M?ltiples filtros para Enumerado
    let habilitadoHeaderFilters = []; // M?ltiples filtros para Habilitado
    let lavadoHeaderFilters = []; // M?ltiples filtros para Lavado
    let corteBloquesHeaderFilters = []; // M?ltiples filtros para Corte Bloques
    let transferHeaderFilters = []; // M?ltiples filtros para Transfer
    let artesHeaderFilters = []; // M?ltiples filtros para Artes

    // Variables de compatibilidad (para c?digo existente que use el formato antiguo)
    // Estas variables se actualizan autom?ticamente cuando se modifica el array
    let bloqueoHeaderFilter = null;
    let corteHeaderFilter = null;
    let enumeradoHeaderFilter = null;
    let habilitadoHeaderFilter = null;
    let lavadoHeaderFilter = null;
    let corteBloquesHeaderFilter = null;
    let transferHeaderFilter = null;
    let artesHeaderFilter = null;

    let currentLavadoFilter = 'EN LAV';
    let currentCorteFilter = 'X PROG';
    let currentCorteBloquesFilter = 'X PROG';
    let currentTransferFilter = 'X PROG';
    let currentHabilitadoFilter = 'X PROG';
    let isHabilitadoIngresosMode = false;
    let habilitadoIngresosDateFilter = '';
    let habilitadoIngresosPlantFilter = '';
    let habilitadoHeaderNormalHtml = '';
    let habilitadoHoja3Rows = [];
    let habilitadoHoja3RowsByTurn = {};
    let habilitadoHoja3TurnoActual = '';
    let habilitadoHoja3LoadRequestId = 0;
    const HABILITADO_HOJA3_MIN_ROWS = 2;

    // Mapa para rastrear filas pendientes de programar en Corte Pzas (X PROG)
    // Formato: { rowIndex: { equipo_corte: 'valor', status_corte: 'PROG 1T/2T/3T' } }
    let pendingProgramarCorte = {};

    // Mapa para rastrear filas pendientes de programar en Bloqueo (X PROG)
    // Formato: { opPtdaKey: [rowIndex1, rowIndex2, ...] }
    let pendingProgramarBloqueo = {};

    // Mapa para rastrear filas pendientes de programar en Habilitado (X PROG)
    // Formato: { rowIndex: { estado_habilitado: 'PROG 1T/2T/3T' } }
    let pendingProgramarHabilitado = {};

    // Variables para el modal de tendido
    let modalTendidoData = {
        rowIndex: null,
        oc: '',
        op: '',
        corte: '',
        color: '',
        pdsTotal: 0
    };

    // Variables para el modal "Nuevo corte"
    let modalNuevoCorteData = {
        sourceRowIndex: null,
        op: '',
        corteBase: '',
        opTela: '',
        partida: '',
        color: '',
        colorNorm: '',
        pdsTotal: 0,
        estadoCorteTarget: '',
        rows: []
    };

    // Variables para modal de cambio de equipo_corte desde OC (click derecho)
    let modalCorteOcEquipoData = {
        rowIndices: [],
        opPtda: '',
        targetRowIndex: null,
        scope: 'group',
        turno: 'PROG 1T'
    };
    let corteOcContextMenuRowIndex = null;
    let modalDevolucionHabilitadoData = { matches: [] };

    // Maneja cambios en n.BDxpda para Asignar Artes. Si 'Para todo' est? marcado,
    // aplica el mismo valor a todos los selects visibles en '#tbody-artes-asignar'.
    window.handleNBDChange = function (selectElement) {
        const chk = document.getElementById('chk-artes-para-todo');
        const val = selectElement.value;
        if (chk && chk.checked) {
            // Mostrar modal de carga
            const modal = document.getElementById('modal-loading-artes');
            resetLoadingModalProgress();
            if (modal) modal.classList.add('active');
            const _startTime = Date.now();

            const all = Array.from(document.querySelectorAll('#tbody-artes-asignar select.sel-nbd-artes'));

            // Buscar ?ndice de la columna
            let idx = getColIndex('n.BDxpda');
            if (idx === -1) {
                for (const k in colMap) { if (k.toString().toUpperCase().indexOf('N.BDXPDA') !== -1) { idx = colMap[k]; break; } }
            }

            // Recolectar TODAS las filas a actualizar de TODOS los grupos
            const allRowsToUpdate = [];
            const clienteNorm = normalizeClientForTransfer;

            all.forEach(s => {
                const cliente = s.dataset.cliente;
                const estilo = s.dataset.estilo;
                s.disabled = true;
                s.value = val;
                for (let i = 1; i < rawData.length; i++) {
                    const rCliente = normalizeClientForTransfer(getVal(rawData[i], 'CLIENTE') || '');
                    const rEstilo = (getVal(rawData[i], 'ESTILO') || '').toString().trim();
                    if (rCliente === cliente && rEstilo === estilo) {
                        if (idx !== -1 && idx !== undefined) rawData[i][idx] = val;
                        allRowsToUpdate.push(i);
                    }
                }
            });

            // Enviar peticiones secuencialmente con delay suficiente
            let completedCount = 0;
            const totalCount = allRowsToUpdate.length;

            if (totalCount === 0) {
                if (modal) modal.classList.remove('active');
                all.forEach(s => s.disabled = false);
                chk.checked = false;
                return;
            }

            allRowsToUpdate.forEach((rowIndex, i) => {
                setTimeout(() => {
                    window.PcpProgramaService.actualizarCampo(rowIndex, 'n.BDxpda', val, { noCors: true }).then(() => {
                        completedCount++;
                        updateLoadingModalProgress(completedCount, totalCount, _startTime);
                        if (completedCount === totalCount) {
                            all.forEach(s => s.disabled = false);
                            updateCounters();
                            renderArtes();
                            if (modal) modal.classList.remove('active');
                        }
                    }).catch(err => {
                        console.error('Error al guardar n.BDxpda fila', rowIndex, err);
                        completedCount++;
                        updateLoadingModalProgress(completedCount, totalCount, _startTime);
                        if (completedCount === totalCount) {
                            all.forEach(s => s.disabled = false);
                            if (modal) modal.classList.remove('active');
                        }
                    });
                }, i * 200); // 200ms entre cada petici?n
            });

            chk.checked = false;
        } else {
            updateClienteEstiloArtes(selectElement.getAttribute('data-cliente'), selectElement.getAttribute('data-estilo'), selectElement.value, 'n.BDxpda', selectElement);
        }
    };

    // Maneja cambios en n.ESTAMPxpda para Asignar Artes. Si 'Para todo' est? marcado,
    // aplica el mismo valor a todos los selects visibles en '#tbody-artes-asignar'.
    window.handleNESTChange = function (selectElement) {
        const chk = document.getElementById('chk-artes-para-todo');
        const val = selectElement.value;
        if (chk && chk.checked) {
            // Mostrar modal de carga
            const modal = document.getElementById('modal-loading-artes');
            resetLoadingModalProgress();
            if (modal) modal.classList.add('active');
            const _startTime = Date.now();

            const all = Array.from(document.querySelectorAll('#tbody-artes-asignar select.sel-nest-artes'));

            // Buscar ?ndice de la columna
            let idx = getColIndex('n.ESTAMPxpda');
            if (idx === -1) {
                for (const k in colMap) { if (k.toString().toUpperCase().indexOf('N.ESTAMPXPDA') !== -1) { idx = colMap[k]; break; } }
            }

            // Recolectar TODAS las filas a actualizar de TODOS los grupos
            const allRowsToUpdate = [];

            all.forEach(s => {
                const cliente = s.dataset.cliente;
                const estilo = s.dataset.estilo;
                s.disabled = true;
                s.value = val;
                for (let i = 1; i < rawData.length; i++) {
                    const rCliente = normalizeClientForTransfer(getVal(rawData[i], 'CLIENTE') || '');
                    const rEstilo = (getVal(rawData[i], 'ESTILO') || '').toString().trim();
                    if (rCliente === cliente && rEstilo === estilo) {
                        if (idx !== -1 && idx !== undefined) rawData[i][idx] = val;
                        allRowsToUpdate.push(i);
                    }
                }
            });

            // Enviar peticiones secuencialmente con delay suficiente
            let completedCount = 0;
            const totalCount = allRowsToUpdate.length;

            if (totalCount === 0) {
                if (modal) modal.classList.remove('active');
                all.forEach(s => s.disabled = false);
                chk.checked = false;
                return;
            }

            allRowsToUpdate.forEach((rowIndex, i) => {
                setTimeout(() => {
                    window.PcpProgramaService.actualizarCampo(rowIndex, 'n.ESTAMPxpda', val, { noCors: true }).then(() => {
                        completedCount++;
                        updateLoadingModalProgress(completedCount, totalCount, _startTime);
                        if (completedCount === totalCount) {
                            all.forEach(s => s.disabled = false);
                            updateCounters();
                            renderArtes();
                            if (modal) modal.classList.remove('active');
                        }
                    }).catch(err => {
                        console.error('Error al guardar n.ESTAMPxpda fila', rowIndex, err);
                        completedCount++;
                        updateLoadingModalProgress(completedCount, totalCount, _startTime);
                        if (completedCount === totalCount) {
                            all.forEach(s => s.disabled = false);
                            if (modal) modal.classList.remove('active');
                        }
                    });
                }, i * 200); // 200ms entre cada petici?n
            });

            chk.checked = false;
        } else {
            updateClienteEstiloArtes(selectElement.getAttribute('data-cliente'), selectElement.getAttribute('data-estilo'), selectElement.value, 'n.ESTAMPxpda', selectElement);
        }
    };

    document.addEventListener('DOMContentLoaded', initApp);

    function initApp() {
        const script = document.createElement('script');
        script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:loadDataCallback`;
        script.onerror = () => showError("Error de conexi?n con Google Sheets.");
        document.body.appendChild(script);

        // Cargar equipos de corte en segundo plano
        cargarEquiposCorteBackground();
        // Configurar men? contextual del encabezado de Bloqueo, Corte, Enumerado, Lavado, CorteBloques, Transfer y Artes
        try { setupBloqueoHeaderFilterMenu(); } catch (e) { console.error('setupBloqueoHeaderFilterMenu error', e); }
        try { setupCorteHeaderFilterMenu(); } catch (e) { console.error('setupCorteHeaderFilterMenu error', e); }
        try { setupEnumeradoHeaderFilterMenu(); } catch (e) { console.error('setupEnumeradoHeaderFilterMenu error', e); }
        try { setupLavadoHeaderFilterMenu(); } catch (e) { console.error('setupLavadoHeaderFilterMenu error', e); }
        try { setupCorteBloquesHeaderFilterMenu(); } catch (e) { console.error('setupCorteBloquesHeaderFilterMenu error', e); }
        try { setupTransferHeaderFilterMenu(); } catch (e) { console.error('setupTransferHeaderFilterMenu error', e); }
        try { setupArtesHeaderFilterMenu(); } catch (e) { console.error('setupArtesHeaderFilterMenu error', e); }

        // Inicializar men? flotante desplegable
        initFloatingMenu();
    }

    window.loadDataCallback = function (jsonResponse) {
        try {
            if (!jsonResponse || !jsonResponse.table) throw new Error("Datos inv?lidos.");

            let headerRowIndex = -1;
            const rowsRaw = jsonResponse.table.rows.map(r => r.c.map(cell => (cell && cell.v !== null) ? cell.v : ""));

            const gvizHeaders = jsonResponse.table.cols.map(col => col.label || col.id);

            // DEBUG: Ver los headers que vienen del gviz
            console.log('=== DEBUG GVIZ DATA ===');
            console.log('gvizHeaders:', gvizHeaders);
            console.log('Total columnas:', gvizHeaders.length);
            console.log('Columna 20 (n.transfxpda):', gvizHeaders[20]);

            // DEBUG: Ver primera fila de ATHLETA
            rowsRaw.forEach((row, idx) => {
                if (row[3] && row[3].toString().toUpperCase().includes('ATHLETA')) {
                    console.log('ATHLETA Fila', idx, '| Col 20 (n.transfxpda):', row[20]);
                }
            });
            console.log('========================');

            if (gvizHeaders.includes("OP TELA")) {
                rawData = [gvizHeaders, ...rowsRaw];
            } else {
                for (let i = 0; i < rowsRaw.length; i++) {
                    if (rowsRaw[i].includes("OP TELA")) {
                        headerRowIndex = i;
                        break;
                    }
                }
                if (headerRowIndex !== -1) {
                    // FIX: Usar los headers reales pero mantener todos los rows para alineaci?n correcta
                    const actualHeaders = rowsRaw[headerRowIndex];
                    rawData = [actualHeaders, ...rowsRaw];
                    console.warn('FALLBACK loading path usado. Headers en rowsRaw[' + headerRowIndex + ']. Alineaci?n corregida.');
                } else {
                    rawData = [gvizHeaders, ...rowsRaw];
                }
            }

            // Limpieza de nombres de cabecera (trim)
            if (rawData.length > 0) {
                rawData[0] = rawData[0].map(h => h ? h.toString().trim() : "");
            }

            mapColumns();
            renderAllViews();
            try {
                const eqBtn = document.getElementById('eqcorte-btn');
                if (eqBtn) eqBtn.style.display = (currentCorteFilter === 'X PROG') ? 'inline-flex' : 'none';
            } catch (e) { }
            document.getElementById('loader').style.display = 'none';
            // Forzar un re-render breve despu?s de ocultar el loader
            try { setTimeout(function () { try { renderArtes(); } catch (e) { } }, 200); } catch (e) { }
        } catch (error) {
            console.error(error);
            showError("Error procesando datos: " + error.message);
        }
    };

    function updatePrioridad(rowIndex, value, selectElement, viewName = '') {
        // Normalizar valor de P: permitir 'D' o nÃºmeros; guardar en mayÃºscula.
        let normalizedValue = String(value || '').trim().toUpperCase();
        if (normalizedValue !== '' && normalizedValue !== 'D') {
            normalizedValue = normalizedValue.replace(/[^\d]/g, '');
        }
        if (selectElement) selectElement.value = normalizedValue;
        value = normalizedValue;

        // Determinar vista actual
        const isBloqueoView = document.getElementById('view-bloqueo') && document.getElementById('view-bloqueo').classList.contains('active');
        const isLavadoView = document.getElementById('view-lavado') && document.getElementById('view-lavado').classList.contains('active');
        const isCorteView = document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active');
        const isEnumeradoView = document.getElementById('view-enumerado') && document.getElementById('view-enumerado').classList.contains('active');
        const isHabilitadoView = document.getElementById('view-habilitado') && document.getElementById('view-habilitado').classList.contains('active');
        const fallbackView = isBloqueoView ? 'bloqueo' : (isLavadoView ? 'lavado' : (isCorteView ? 'corte' : (isEnumeradoView ? 'enumerado' : (isHabilitadoView ? 'habilitado' : ''))));
        const priorityView = String(viewName || fallbackView || '').trim().toLowerCase();
        const priorityColName = resolvePriorityWriteColumn(priorityView);

        // Solo propagar en las vistas especificadas
        const shouldPropagate = isBloqueoView || isLavadoView || isCorteView;

        if (!shouldPropagate) {
            // Para otras vistas, solo actualizar la fila actual
            updateRow(rowIndex, priorityColName, value, selectElement);
            try {
                if (isHabilitadoView) setTimeout(() => { renderHabilitado(); }, 120);
            } catch (e) { }
            return;
        }

        // Obtener OP-PTDA de la fila actual
        const row = rawData[rowIndex];
        if (!row) return;

        const opTela = String(row[colMap["OP TELA"]] || "").trim().toLowerCase();
        const partida = String(row[colMap["PARTIDA"]] || "").trim().toLowerCase();
        const currentOpPtda = opTela + "-" + partida;

        // Encontrar ?ndice de la columna de prioridad para la vista actual
        const idxPriority = findPriorityHeaderIndex(priorityView);
        if (idxPriority === -1) return;

        // 1. PRIMERO: Actualizar INMEDIATAMENTE todas las filas en rawData (UI local)
        const rowsToUpdate = [];
        for (let i = 1; i < rawData.length; i++) {
            const r = rawData[i];
            const opT = String(r[colMap["OP TELA"]] || "").trim().toLowerCase();
            const part = String(r[colMap["PARTIDA"]] || "").trim().toLowerCase();
            const opPtda = opT + "-" + part;

            if (opPtda === currentOpPtda) {
                rawData[i][idxPriority] = value;
                rowsToUpdate.push(i);
            }
        }

        // 2. SEGUNDO: Re-renderizar INMEDIATAMENTE para mostrar el cambio visual
        updateCounters();
        if (isBloqueoView) renderBloqueo();
        else if (isLavadoView) renderLavado();
        else if (isCorteView) renderCorte();

        // 3. TERCERO: Guardar en el backend de forma AS?NCRONA (sin bloquear UI)
        // Enviar todas las actualizaciones sin esperar respuesta
        rowsToUpdate.forEach(i => {
            window.PcpProgramaService.actualizarCampo(i, priorityColName, value, { noCors: true, headers: {} }).catch(e => console.error('Error guardando prioridad fila', i, e));
        });
    }

    // ===============================
    // FUNCIONES DEL MODAL DE TENDIDO
    // ===============================

    function collectModalTendidoInputValues() {
        const values = [];
        const numTendidos = (modalTendidoData && modalTendidoData.tendidos) ? modalTendidoData.tendidos.length : 0;
        for (let i = 0; i < numTendidos; i++) {
            const input = document.getElementById(`pds-tendido-${i}`);
            values.push(input ? input.value : '');
        }
        return values;
    }

    let tendidoDeleteInFlight = false;
    function toggleEliminarTendidoLoading(show) {
        const modal = document.getElementById('modal-loading-eliminar-tendido');
        if (!modal) return;
        modal.style.display = show ? 'flex' : 'none';
    }

    async function deleteTendidoInSheet(opValue, corteValue, fallbackExcelRow) {
        const excelRow = parseInt(fallbackExcelRow, 10);
        if (!Number.isInteger(excelRow) || excelRow < 2) {
            throw new Error('Fila de eliminaciÃ³n invÃ¡lida para tendido: ' + fallbackExcelRow);
        }
        await window.PcpProgramaService.eliminarTendido(excelRow, opValue, corteValue, { noCors: true, headers: {} });
    }

    function scheduleSheetResync(delayMs) {
        const wait = Number.isFinite(delayMs) ? delayMs : 700;
        setTimeout(() => {
            try { loadData(); } catch (e) { console.error('Error recargando datos del sheet', e); }
        }, wait);
    }

    function renderModalTendidoRows(prefillValues) {
        const tbody = document.getElementById('modal-tendido-tbody');
        if (!tbody) return;

        const tendidos = (modalTendidoData && Array.isArray(modalTendidoData.tendidos)) ? modalTendidoData.tendidos : [];
        const total = parseFloat(modalTendidoData && modalTendidoData.pdsTotal) || 0;

        let html = '';
        for (let i = 0; i < tendidos.length; i++) {
            const tendido = tendidos[i];
            const isLast = (i === tendidos.length - 1);
            const btnAddHtml = isLast
                ? `<button class="btn-tendido" onclick="agregarTendidoModal()" title="Agregar tendido">+</button>`
                : '';
            const btnDeleteHtml = (isLast && tendidos.length > 1)
                ? `<button class="btn-tendido-delete" onclick="eliminarUltimoTendidoModal()" title="Eliminar Ãºltimo tendido"><i class="ph ph-trash"></i></button>`
                : '';

            const rawValue = (prefillValues && prefillValues[i] !== undefined && prefillValues[i] !== null) ? String(prefillValues[i]) : '';
            const safeValue = rawValue.replace(/"/g, '&quot;');
            const valueAttr = safeValue !== '' ? ` value="${safeValue}"` : '';

            const placeholder = (tendidos.length === 1)
                ? 'Ingrese PDS'
                : (isLast ? 'Ingrese PDS (diferencia)' : 'Ingrese PDS');
            const oninputAttr = (tendidos.length > 1 && !isLast) ? ' oninput="recalcularTendidosModal()"' : '';

            html += `<tr>
                        <td style="font-weight: 600; text-align: center;">${btnAddHtml}${tendido}</td>
                        <td>
                            <div class="tendido-pds-wrap">
                                <input type="number" id="pds-tendido-${i}"${valueAttr} placeholder="${placeholder}"${oninputAttr} min="0" max="${total}">
                                ${btnDeleteHtml}
                            </div>
                        </td>
                    </tr>`;
        }

        tbody.innerHTML = html;
        if (tendidos.length <= 1) {
            const residualDelete = tbody.querySelector('.btn-tendido-delete');
            if (residualDelete) residualDelete.remove();
        }
    }

    window.eliminarUltimoTendidoModal = async function () {
        if (tendidoDeleteInFlight) return;
        tendidoDeleteInFlight = true;
        try {
            if (!modalTendidoData || !Array.isArray(modalTendidoData.tendidos) || modalTendidoData.tendidos.length <= 1) {
                alert('Debe existir al menos un tendido.');
                return;
            }

            const lastIdx = modalTendidoData.tendidos.length - 1;
            const lastTendido = modalTendidoData.tendidos[lastIdx];
            const currentValues = collectModalTendidoInputValues();
            const lastPds = parseFloat(currentValues[lastIdx]) || 0;

            const isPersistedRow = (
                modalTendidoData.modo === 'editar' &&
                Array.isArray(modalTendidoData.tendidoRows) &&
                lastIdx < modalTendidoData.tendidoRows.length &&
                typeof modalTendidoData.tendidoRows[lastIdx] === 'number'
            );

            const confirmMsg = isPersistedRow
                ? `Se eliminarÃ¡ el tendido ${lastTendido} del sheet. Â¿Continuar?`
                : `Â¿Quitar el tendido ${lastTendido} del modal?`;
            if (!confirm(confirmMsg)) return;

            if (isPersistedRow) {
                const rowIdxRaw = modalTendidoData.tendidoRows[lastIdx];
                const opIdx = colMap["OP"];
                const corteIdx = colMap["CORTE"];
                const targetOp = String(modalTendidoData.op || '').trim();
                const targetCorte = String(lastTendido || '').trim();

                const rowMatchesTarget = function (idx) {
                    if (!Number.isInteger(idx) || idx < 1 || idx >= rawData.length) return false;
                    const row = rawData[idx];
                    if (!row) return false;
                    const rowOp = (opIdx !== undefined && opIdx !== -1) ? String(row[opIdx] || '').trim() : '';
                    const rowCorte = (corteIdx !== undefined && corteIdx !== -1) ? String(row[corteIdx] || '').trim() : '';
                    if (targetOp && rowOp !== targetOp) return false;
                    if (targetCorte && rowCorte !== targetCorte) return false;
                    return true;
                };

                let localDeleteIdx = Number.isInteger(rowIdxRaw) ? rowIdxRaw : -1;
                if (!rowMatchesTarget(localDeleteIdx)) {
                    for (let i = 1; i < rawData.length; i++) {
                        if (rowMatchesTarget(i)) {
                            localDeleteIdx = i;
                            break;
                        }
                    }
                }
                if (!Number.isInteger(localDeleteIdx) || localDeleteIdx < 1 || localDeleteIdx >= rawData.length) {
                    localDeleteIdx = Number.isInteger(rowIdxRaw) ? rowIdxRaw : -1;
                }

                const rowToDelete = (localDeleteIdx >= 1 && localDeleteIdx < rawData.length) ? rawData[localDeleteIdx] : null;
                const opToDelete = targetOp || ((rowToDelete && opIdx !== undefined && opIdx !== -1) ? String(rowToDelete[opIdx] || '').trim() : '');
                const corteToDelete = targetCorte || ((rowToDelete && corteIdx !== undefined && corteIdx !== -1) ? String(rowToDelete[corteIdx] || '').trim() : '');
                const excelRow = (localDeleteIdx >= 1)
                    ? localDeleteIdx + 1
                    : (Number.isInteger(rowIdxRaw) ? rowIdxRaw + 1 : null);

                if (!Number.isInteger(excelRow) || excelRow < 2) {
                    alert('No se pudo resolver la fila del tendido a eliminar.');
                    return;
                }

                try {
                    toggleEliminarTendidoLoading(true);
                    await deleteTendidoInSheet(opToDelete, corteToDelete, excelRow);
                } catch (e) {
                    console.error('Error eliminando tendido del sheet', e);
                    alert('No se pudo eliminar el tendido en el sheet. Intente nuevamente.');
                    return;
                } finally {
                    toggleEliminarTendidoLoading(false);
                }

                if (localDeleteIdx >= 1 && localDeleteIdx < rawData.length) {
                    rawData.splice(localDeleteIdx, 1);
                }

                modalTendidoData.tendidoRows.splice(lastIdx, 1);
                for (let j = 0; j < modalTendidoData.tendidoRows.length; j++) {
                    if (typeof modalTendidoData.tendidoRows[j] === 'number' && modalTendidoData.tendidoRows[j] > localDeleteIdx) {
                        modalTendidoData.tendidoRows[j] = modalTendidoData.tendidoRows[j] - 1;
                    }
                }
                if (typeof modalTendidoData.rowIndex === 'number' && modalTendidoData.rowIndex > localDeleteIdx) {
                    modalTendidoData.rowIndex = modalTendidoData.rowIndex - 1;
                }
                modalTendidoData.pdsTotal = Math.max(0, (parseFloat(modalTendidoData.pdsTotal) || 0) - lastPds);
            }

            modalTendidoData.tendidos.splice(lastIdx, 1);
            const remainingValues = currentValues.slice(0, lastIdx);
            renderModalTendidoRows(remainingValues);

            const subtitleEl = document.getElementById('modal-tendido-subtitle');
            if (subtitleEl) {
                subtitleEl.innerText = `COLOR: ${modalTendidoData.color} | PDS: ${formatThousands(parseFloat(modalTendidoData.pdsTotal) || 0, 0)}`;
            }

            try {
                if ((modalTendidoData.tendidos || []).length > 1) recalcularTendidosModal();
            } catch (e) { }

            try {
                updateCounters();
                renderCorte();
                scheduleSheetResync(900);
            } catch (e) { }
        } catch (e) {
            console.error('Error eliminando ultimo tendido', e);
            alert('No se pudo eliminar el tendido.');
        } finally {
            tendidoDeleteInFlight = false;
        }
    };

    function esSubtabProgCorteParaTendido() {
        const filterNorm = String(currentCorteFilter || '').toUpperCase().trim();
        return (filterNorm === 'PROG 1T' || filterNorm === 'PROG 2T' || filterNorm === 'PROG 3T');
    }

    function esCorteInicialBloqueadoParaTendido(corteValue) {
        const corteStr = String(corteValue || '').trim();
        if (!/^\d+$/.test(corteStr)) return false;
        const corteNum = parseInt(corteStr, 10);
        return (
            (corteNum >= 3000 && corteNum <= 3099) ||
            (corteNum >= 5000 && corteNum <= 5099) ||
            (corteNum >= 8000 && corteNum <= 8099)
        );
    }

    function debeBloquearDivisionTendido(corteValue) {
        return esSubtabProgCorteParaTendido() && esCorteInicialBloqueadoParaTendido(corteValue);
    }

    function parseTendidoHintFromCorte(corteValue) {
        const corteStr = String(corteValue || '').trim();
        const lastTwoChars = corteStr.slice(-2);
        const looksLikeTendido = /^0[1-9]$|^[1-9]\d$/.test(lastTwoChars) && corteStr.length > 2;
        const corteBase = looksLikeTendido ? corteStr.slice(0, -2) : corteStr;

        const corteNum = /^\d+$/.test(corteStr) ? parseInt(corteStr, 10) : NaN;
        const baseNum = /^\d+$/.test(corteBase) ? parseInt(corteBase, 10) : NaN;
        const maxCorteBase = 199;
        // Si CORTE supera el maximo de corte base, no puede ser un corte "base" puro.
        const forcedExistingByMaxBase =
            looksLikeTendido &&
            Number.isFinite(corteNum) &&
            Number.isFinite(baseNum) &&
            corteNum > maxCorteBase &&
            baseNum >= 1 &&
            baseNum <= maxCorteBase;

        return {
            corteStr: corteStr,
            corteBase: corteBase,
            looksLikeTendido: looksLikeTendido,
            forcedExistingByMaxBase: forcedExistingByMaxBase
        };
    }

    window.abrirModalTendido = function (rowIndex, op, corte, color, pdsTotal) {
        const parsedRowIndex = parseInt(rowIndex, 10);
        const rowIndexResolved = Number.isInteger(parsedRowIndex) ? parsedRowIndex : rowIndex;
        let opResolved = String(op || '').trim();
        let corteResolved = String(corte || '').trim();
        let colorResolved = String(color || '').trim();
        let opTelaResolved = '';
        let partidaResolved = '';
        let pdsResolved = parseFloat(pdsTotal);
        if (!Number.isFinite(pdsResolved)) pdsResolved = 0;

        try {
            if (Number.isInteger(parsedRowIndex) && parsedRowIndex >= 1 && Array.isArray(rawData) && rawData[parsedRowIndex]) {
                const row = rawData[parsedRowIndex];
                const rowOp = String(getVal(row, 'OP') || '').trim();
                const rowCorte = String(getVal(row, 'CORTE') || '').trim();
                const rowOpTela = String(getVal(row, 'OP TELA') || '').trim();
                const rowPartida = String(getVal(row, 'PARTIDA') || '').trim();
                const rowColor = String(abbreviateHeather(getVal(row, 'COLOR') || '') || '').trim();
                const rowPds = parseFloat(getVal(row, 'PDS GIRADAS') || getVal(row, 'PDS') || 0);

                if (rowOp) opResolved = rowOp;
                if (rowCorte) corteResolved = rowCorte;
                if (rowOpTela) opTelaResolved = rowOpTela;
                if (rowPartida) partidaResolved = rowPartida;
                if (rowColor) colorResolved = rowColor;
                if (Number.isFinite(rowPds)) pdsResolved = rowPds;
            }
        } catch (e) {
            console.warn('abrirModalTendido: no se pudo resolver la fila desde rawData', e);
        }

        if (!opResolved || !corteResolved) {
            alert('No se pudo obtener OP/CORTE de la fila seleccionada.');
            return;
        }

        if (debeBloquearDivisionTendido(corteResolved)) {
            alert('No se permite dividir en tendidos los cortes iniciales 3000-3099, 5000-5099 y 8000-8099.');
            return;
        }

        // Detectar si realmente pertenece a un grupo de tendidos existente.
        // No basta con terminar en 01/02...; validamos por OP + OP TELA + PARTIDA (+ COLOR).
        const corteHint = parseTendidoHintFromCorte(corteResolved);
        const looksLikeTendido = corteHint.looksLikeTendido;
        let isTendidoExistente = false;
        if (looksLikeTendido) {
            const corteBase = corteHint.corteBase;
            const opNorm = String(opResolved || '').trim().toUpperCase();
            const opTelaNorm = String(opTelaResolved || '').trim().toUpperCase();
            const partidaNorm = String(partidaResolved || '').trim().toUpperCase();
            const colorNorm = String(colorResolved || '').trim().toUpperCase();
            const currentCorteNorm = String(corteResolved || '').trim();
            const escapeRegExp = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const matchRegex = new RegExp(`^${escapeRegExp(corteBase)}(\\d{2})$`);
            const firstTendidoCode = `${corteBase}01`;
            let tendidoMatches = 0;
            let hasSiblingTendido = false;
            let hasBaseRowSameContext = false;
            let hasFirstTendidoSameContext = false;

            for (let i = 1; i < rawData.length; i++) {
                const r = rawData[i];
                if (!r) continue;

                const rowOp = String(getVal(r, 'OP') || '').trim().toUpperCase();
                if (rowOp !== opNorm) continue;

                if (opTelaNorm) {
                    const rowOpTela = String(getVal(r, 'OP TELA') || '').trim().toUpperCase();
                    if (rowOpTela !== opTelaNorm) continue;
                }

                if (partidaNorm) {
                    const rowPartida = String(getVal(r, 'PARTIDA') || '').trim().toUpperCase();
                    if (rowPartida !== partidaNorm) continue;
                }

                if (colorNorm) {
                    const rowColorNorm = String(abbreviateHeather(getVal(r, 'COLOR') || '') || '').trim().toUpperCase();
                    if (rowColorNorm !== colorNorm) continue;
                }

                const rowCorte = String(getVal(r, 'CORTE') || '').trim();
                if (rowCorte === firstTendidoCode) hasFirstTendidoSameContext = true;
                if (rowCorte === corteBase) hasBaseRowSameContext = true;
                if (matchRegex.test(rowCorte)) {
                    tendidoMatches++;
                    if (rowCorte !== currentCorteNorm) hasSiblingTendido = true;
                }
                if (hasSiblingTendido && hasBaseRowSameContext) break;
            }

            // Evidencia fuerte de tendido existente:
            // - corte fuera de rango base (forzado), o
            // - existe la fila ...01 en el mismo contexto, o
            // - existe fila base en el mismo contexto, o
            // Esto evita falsos positivos como CORTE=110 tratado como base=1
            // cuando no existe ...01 para esa base/contexto.
            const isCurrentFirstTendido = (currentCorteNorm === firstTendidoCode);
            const hasStrongSiblingEvidence = hasFirstTendidoSameContext && (hasSiblingTendido || tendidoMatches > 1 || isCurrentFirstTendido);
            isTendidoExistente = !!(corteHint.forcedExistingByMaxBase || hasStrongSiblingEvidence || hasBaseRowSameContext);
        }

        if (isTendidoExistente) {
            // Modo EDICIÃ“N: mostrar los tendidos ya existentes
            abrirModalTendidoEdicion(rowIndexResolved, opResolved, corteResolved, colorResolved, opTelaResolved, partidaResolved);
        } else {
            // Modo CREACIÃ“N: crear nuevos tendidos
            // Mantener el CORTE real de la fila; no truncar por heurÃ­stica.
            abrirModalTendidoCreacion(rowIndexResolved, opResolved, corteResolved, colorResolved, pdsResolved, opTelaResolved, partidaResolved);
        }
    };

    window.abrirModalTendidoCreacion = function (rowIndex, op, corte, color, pdsTotal, opTela, partida) {
        modalTendidoData = {
            rowIndex: rowIndex,
            oc: `${op}-${corte}`,
            op: op,
            corte: corte,
            opTela: String(opTela || '').trim(),
            partida: String(partida || '').trim(),
            color: color,
            colorNorm: String(color || '').trim().toUpperCase(),
            pdsTotal: pdsTotal,
            modo: 'crear',
            tendidos: []
        };

        document.getElementById('modal-tendido-title').innerText = `OC: ${op}-${corte}`;
        document.getElementById('modal-tendido-subtitle').innerText = `COLOR: ${color} | PDS: ${formatThousands(pdsTotal, 0)}`;

        const tbody = document.getElementById('modal-tendido-tbody');
        const tendido1 = `${corte}01`;

        modalTendidoData.tendidos = [tendido1];

        renderModalTendidoRows();
        document.getElementById('modal-tendido').classList.add('active');
    };

    window.abrirModalTendidoEdicion = function (rowIndex, op, corte, color, opTela, partida) {
        const corteHint = parseTendidoHintFromCorte(corte);
        const corteBase = corteHint.looksLikeTendido ? corteHint.corteBase : String(corte || '').trim();
        const corteIdx = colMap["CORTE"];
        const pdsIdx = colMap["PDS GIRADAS"];
        const opIdx = colMap["OP"];
        const opTelaNorm = String(opTela || '').trim().toUpperCase();
        const partidaNorm = String(partida || '').trim().toUpperCase();
        const colorNorm = String(color || '').trim().toUpperCase();
        const escapeRegExp = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matchRegex = new RegExp(`^${escapeRegExp(corteBase)}(\\d{2})$`);

        const tendidos = [];
        const tendidoRows = [];
        const tendidoPds = [];

        for (let i = 1; i < rawData.length; i++) {
            // Filtrar por OP + OP TELA + PARTIDA (+ COLOR) para no mezclar OCs parecidas
            const rowOp = String(rawData[i][opIdx] || '').trim();
            if (rowOp !== String(op).trim()) continue;

            if (opTelaNorm) {
                const rowOpTela = String(getVal(rawData[i], 'OP TELA') || '').trim().toUpperCase();
                if (rowOpTela !== opTelaNorm) continue;
            }

            if (partidaNorm) {
                const rowPartida = String(getVal(rawData[i], 'PARTIDA') || '').trim().toUpperCase();
                if (rowPartida !== partidaNorm) continue;
            }

            if (colorNorm) {
                const rowColorNorm = String(abbreviateHeather(getVal(rawData[i], 'COLOR') || '') || '').trim().toUpperCase();
                if (rowColorNorm !== colorNorm) continue;
            }

            const rowCorte = String(rawData[i][corteIdx] || '');
            const match = rowCorte.match(matchRegex);
            if (match) {
                tendidos.push(rowCorte);
                tendidoRows.push(i);
                tendidoPds.push(parseFloat(rawData[i][pdsIdx]) || 0);
            }
        }

        const sortedIndices = Array.from(Array(tendidos.length).keys()).sort((a, b) => {
            const numA = parseInt(tendidos[a].slice(-2));
            const numB = parseInt(tendidos[b].slice(-2));
            return numA - numB;
        });

        const sortedTendidos = sortedIndices.map(i => tendidos[i]);
        const sortedRows = sortedIndices.map(i => tendidoRows[i]);
        const sortedPds = sortedIndices.map(i => tendidoPds[i]);
        const totalPds = sortedPds.reduce((a, b) => a + b, 0);

        modalTendidoData = {
            rowIndex: rowIndex,
            tendidoRows: sortedRows,
            oc: `${op}-${corteBase}`,
            op: op,
            corte: corteBase,
            opTela: String(opTela || '').trim(),
            partida: String(partida || '').trim(),
            color: color,
            colorNorm: String(color || '').trim().toUpperCase(),
            pdsTotal: totalPds,
            modo: 'editar',
            tendidos: sortedTendidos
        };

        document.getElementById('modal-tendido-title').innerText = `OC: ${op}-${corteBase}`;
        document.getElementById('modal-tendido-subtitle').innerText = `COLOR: ${color} | PDS: ${formatThousands(totalPds, 0)}`;

        const tbody = document.getElementById('modal-tendido-tbody');
        renderModalTendidoRows(sortedPds);
        document.getElementById('modal-tendido').classList.add('active');
    };

    window.recalcularTendidosModal = function () {
        const total = modalTendidoData.pdsTotal;
        const numTendidos = modalTendidoData.tendidos ? modalTendidoData.tendidos.length : 2;

        let sumaParcial = 0;
        for (let i = 0; i < numTendidos - 1; i++) {
            const input = document.getElementById(`pds-tendido-${i}`);
            if (input) {
                const val = parseFloat(input.value) || 0;
                sumaParcial += val;
            }
        }

        const ultimoInput = document.getElementById(`pds-tendido-${numTendidos - 1}`);
        if (ultimoInput) {
            const diferencia = total - sumaParcial;
            ultimoInput.value = Math.max(0, diferencia);
        }
    };

    window.agregarTendidoModal = function () {
        if (!modalTendidoData.tendidos) {
            alert('Error: No hay datos de tendidos');
            return;
        }

        const corte = modalTendidoData.corte;
        if (debeBloquearDivisionTendido(corte)) {
            alert('No se permite dividir en tendidos los cortes iniciales 3000-3099, 5000-5099 y 8000-8099.');
            return;
        }
        // Buscar el sufijo m?ximo existente en rawData para este OP+corteBase
        // para evitar conflictos con tendidos que existan pero no est?n visibles
        let maxSuffix = 0;
        const corteIdx = colMap["CORTE"];
        const opIdx = colMap["OP"];
        const opVal = String(modalTendidoData.op || '').trim();
        const opTelaNorm = String(modalTendidoData.opTela || '').trim().toUpperCase();
        const partidaNorm = String(modalTendidoData.partida || '').trim().toUpperCase();
        const colorNorm = String(modalTendidoData.colorNorm || '').trim().toUpperCase();
        const escapeRegExp = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matchRegex = new RegExp(`^${escapeRegExp(corte)}(\\d{2})$`);
        for (let i = 1; i < rawData.length; i++) {
            const rowOp = String(rawData[i][opIdx] || '').trim();
            if (rowOp !== opVal) continue;

            if (opTelaNorm) {
                const rowOpTela = String(getVal(rawData[i], 'OP TELA') || '').trim().toUpperCase();
                if (rowOpTela !== opTelaNorm) continue;
            }

            if (partidaNorm) {
                const rowPartida = String(getVal(rawData[i], 'PARTIDA') || '').trim().toUpperCase();
                if (rowPartida !== partidaNorm) continue;
            }

            if (colorNorm) {
                const rowColorNorm = String(abbreviateHeather(getVal(rawData[i], 'COLOR') || '') || '').trim().toUpperCase();
                if (rowColorNorm !== colorNorm) continue;
            }

            const rowCorte = String(rawData[i][corteIdx] || '');
            const m = rowCorte.match(matchRegex);
            if (m) {
                const suf = parseInt(m[1]);
                if (suf > maxSuffix) maxSuffix = suf;
            }
        }
        // Tambi?n considerar los tendidos ya agregados en el modal (a?n no guardados)
        modalTendidoData.tendidos.forEach(t => {
            const m = String(t).match(matchRegex);
            if (m) {
                const suf = parseInt(m[1]);
                if (suf > maxSuffix) maxSuffix = suf;
            }
        });
        const siguienteNum = String(maxSuffix + 1).padStart(2, '0');
        const nuevoTendido = `${corte}${siguienteNum}`;

        modalTendidoData.tendidos.push(nuevoTendido);

        const oldValues = collectModalTendidoInputValues();
        renderModalTendidoRows(oldValues);
        if ((modalTendidoData.tendidos || []).length > 1) recalcularTendidosModal();
    };

    window.cerrarModalTendido = function () {
        document.getElementById('modal-tendido').classList.remove('active');
        modalTendidoData = { rowIndex: null, oc: '', op: '', corte: '', color: '', pdsTotal: 0 };
    };

    function esSubtabProgCorteNuevoCorte(filterState) {
        const v = String(filterState || '').toUpperCase().trim();
        return (v === 'PROG 1T' || v === 'PROG 2T' || v === 'PROG 3T');
    }

    function esSubtabPorProgramarNuevoCorte(filterState) {
        const v = String(filterState || '').toUpperCase().trim();
        return v === 'X PROG';
    }

    function esEstadoDestinoNuevoCorte(value) {
        return esSubtabProgCorteNuevoCorte(value);
    }

    function normalizarEstadoDestinoNuevoCorte(value) {
        const v = String(value || '').toUpperCase().trim();
        return esEstadoDestinoNuevoCorte(v) ? v : 'PROG 1T';
    }

    function estadoCorteFilaNuevoCorte(row) {
        const raw = (getVal(row, 'STATUS_CORTE') || getVal(row, 'STATUS') || getVal(row, 'status') || getVal(row, 'ESTADO CORTE') || getVal(row, 'ESTADO_CORTE') || getVal(row, 'estado_corte') || '');
        const v = String(raw || '').toUpperCase().trim();
        return v || 'X PROG';
    }

    function escapeRegExpNuevoCorte(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function getCorteBaseNuevoCorte(corteValue) {
        const corteStr = String(corteValue || '').trim();
        if (!corteStr) return '';
        const lastTwo = corteStr.slice(-2);
        const isTendido = /^0[1-9]$|^[1-9]\d$/.test(lastTwo) && corteStr.length > 2;
        return isTendido ? corteStr.slice(0, -2) : corteStr;
    }

    function splitOcNuevoCorte(value) {
        const txt = String(value || '').trim().toUpperCase();
        const dash = txt.indexOf('-');
        if (dash <= 0 || dash >= txt.length - 1) return { op: '', corte: '' };
        return {
            op: txt.slice(0, dash).trim(),
            corte: txt.slice(dash + 1).trim()
        };
    }

    function getVisibleCorteRowIndicesNuevoCorte() {
        const out = [];
        try {
            const viewCorte = document.getElementById('view-corte');
            const tbody = document.getElementById('tbody-corte');
            if (!viewCorte || !viewCorte.classList.contains('active') || !tbody) return out;

            const visibleRows = tbody.querySelectorAll('tr[data-row-index]');
            visibleRows.forEach(tr => {
                if (tr.offsetParent === null || getComputedStyle(tr).display === 'none') return;
                const idx = parseInt(tr.getAttribute('data-row-index'), 10);
                if (!Number.isInteger(idx) || idx < 1 || !rawData[idx]) return;
                out.push(idx);
            });
        } catch (e) { }
        return out;
    }

    function findSourceRowNuevoCorte(ocQuery) {
        const q = splitOcNuevoCorte(ocQuery);
        if (!q.op || !q.corte) return { anyRow: -1, targetRow: -1 };
        const queryBase = String(getCorteBaseNuevoCorte(q.corte) || '').trim().toUpperCase();

        const evalMatch = (i) => {
            const row = rawData[i];
            if (!row) return null;

            const op = String(getVal(row, 'OP') || '').trim().toUpperCase();
            const corte = String(getVal(row, 'CORTE') || '').trim().toUpperCase();
            if (!op || !corte) return null;
            if (op !== q.op) return null;

            const rowBase = String(getCorteBaseNuevoCorte(corte) || '').trim().toUpperCase();
            const isExact = (corte === q.corte);
            const isBaseMatch = (!isExact && rowBase && queryBase && rowBase === queryBase);
            if (!isExact && !isBaseMatch) return null;
            return { isExact: isExact };
        };

        let visibleExactRow = -1;
        let visibleBaseRow = -1;
        const visibleRows = getVisibleCorteRowIndicesNuevoCorte();
        for (let i = 0; i < visibleRows.length; i++) {
            const idx = visibleRows[i];
            const match = evalMatch(idx);
            if (!match) continue;
            if (match.isExact) {
                visibleExactRow = idx;
                break;
            }
            if (visibleBaseRow === -1) visibleBaseRow = idx;
        }
        const visiblePicked = visibleExactRow !== -1 ? visibleExactRow : visibleBaseRow;
        if (visiblePicked !== -1) {
            return {
                anyRow: visiblePicked,
                targetRow: visiblePicked
            };
        }

        let anyExactRow = -1;
        let anyBaseRow = -1;
        for (let i = 1; i < rawData.length; i++) {
            const match = evalMatch(i);
            if (!match) continue;

            if (match.isExact) {
                anyExactRow = i;
                break;
            } else {
                if (anyBaseRow === -1) anyBaseRow = i;
            }
        }
        const picked = anyExactRow !== -1 ? anyExactRow : anyBaseRow;
        return {
            anyRow: picked,
            targetRow: picked
        };
    }

    function getNextTendidoNuevoCorte() {
        if (!modalNuevoCorteData || modalNuevoCorteData.sourceRowIndex === null) return '';
        const base = String(modalNuevoCorteData.corteBase || '').trim();
        const op = String(modalNuevoCorteData.op || '').trim();
        const opTelaNorm = String(modalNuevoCorteData.opTela || '').trim().toUpperCase();
        const partidaNorm = String(modalNuevoCorteData.partida || '').trim().toUpperCase();
        const colorNorm = String(modalNuevoCorteData.colorNorm || '').trim().toUpperCase();
        if (!base || !op) return '';

        const corteIdx = findHeaderIndexCaseInsensitive('CORTE');
        const opIdx = findHeaderIndexCaseInsensitive('OP');
        if (corteIdx === -1 || opIdx === -1) return '';

        const re = new RegExp(`^${escapeRegExpNuevoCorte(base)}(\\d{2})$`);
        let maxSuffix = 0;

        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row) continue;
            const rowOp = String(row[opIdx] || '').trim();
            if (rowOp !== op) continue;

            if (opTelaNorm) {
                const rowOpTela = String(getVal(row, 'OP TELA') || '').trim().toUpperCase();
                if (rowOpTela !== opTelaNorm) continue;
            }

            if (partidaNorm) {
                const rowPartida = String(getVal(row, 'PARTIDA') || '').trim().toUpperCase();
                if (rowPartida !== partidaNorm) continue;
            }

            if (colorNorm) {
                const rowColorNorm = String(abbreviateHeather(getVal(row, 'COLOR') || '') || '').trim().toUpperCase();
                if (rowColorNorm !== colorNorm) continue;
            }

            const rowCorte = String(row[corteIdx] || '').trim();
            const m = rowCorte.match(re);
            if (!m) continue;
            const suf = parseInt(m[1], 10) || 0;
            if (suf > maxSuffix) maxSuffix = suf;
        }

        (modalNuevoCorteData.rows || []).forEach(item => {
            const m = String(item && item.corte ? item.corte : '').match(re);
            if (!m) return;
            const suf = parseInt(m[1], 10) || 0;
            if (suf > maxSuffix) maxSuffix = suf;
        });

        return `${base}${String(maxSuffix + 1).padStart(2, '0')}`;
    }

    function collectModalNuevoCorteValues() {
        const out = [];
        const rows = (modalNuevoCorteData && Array.isArray(modalNuevoCorteData.rows)) ? modalNuevoCorteData.rows : [];
        for (let i = 0; i < rows.length; i++) {
            const pdsInput = document.getElementById(`nuevo-corte-pds-${i}`);
            const estadoSelect = document.getElementById(`nuevo-corte-estado-${i}`);
            const eqSelect = document.getElementById(`nuevo-corte-equipo-${i}`);
            out.push({
                pds: pdsInput ? pdsInput.value : '',
                estado: estadoSelect ? estadoSelect.value : '',
                equipo: eqSelect ? eqSelect.value : ''
            });
        }
        return out;
    }

    function renderModalNuevoCorteRows(prefillValues) {
        const tbody = document.getElementById('modal-nuevo-corte-tbody');
        if (!tbody) return;

        const rows = (modalNuevoCorteData && Array.isArray(modalNuevoCorteData.rows)) ? modalNuevoCorteData.rows : [];
        if (rows.length === 0) {
            const msg = modalNuevoCorteData && modalNuevoCorteData.sourceRowIndex !== null
                ? 'Agregue filas con + para crear nuevos cortes'
                : 'Busque una OC para comenzar';
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--gray-500);">${msg}</td></tr>`;
            return;
        }

        let equiposHtml = '<option value="">-- Seleccionar --</option>';
        const equipos = Array.isArray(equiposCorteData) ? equiposCorteData : [];
        equipos.forEach(eq => {
            const nombre = String(eq && eq.nombre ? eq.nombre : '').trim();
            if (!nombre) return;
            const safe = nombre.replace(/"/g, '&quot;');
            equiposHtml += `<option value="${safe}">${safe}</option>`;
        });

        let html = '';
        for (let i = 0; i < rows.length; i++) {
            const item = rows[i] || {};
            const isLast = (i === rows.length - 1);
            const btnAddHtml = isLast ? `<button class="btn-tendido" onclick="agregarFilaNuevoCorte()" title="Agregar tendido">+</button>` : '';
            const btnDeleteHtml = (isLast && rows.length > 1)
                ? `<button class="btn-tendido-delete" onclick="eliminarUltimaFilaNuevoCorte()" title="Eliminar ultimo tendido"><i class="ph ph-trash"></i></button>`
                : '';

            const prefill = (prefillValues && prefillValues[i]) ? prefillValues[i] : {};
            const pdsVal = (prefill.pds !== undefined && prefill.pds !== null) ? String(prefill.pds) : '';
            const estadoVal = normalizarEstadoDestinoNuevoCorte((prefill.estado !== undefined && prefill.estado !== null) ? String(prefill.estado) : (item.estado || ''));
            const eqVal = (prefill.equipo !== undefined && prefill.equipo !== null) ? String(prefill.equipo) : (item.equipo || '');
            const pdsSafe = pdsVal.replace(/"/g, '&quot;');
            const corteSafe = String(item.corte || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            html += `<tr>
                        <td style="font-weight:600; text-align:center;">${btnAddHtml}${corteSafe}</td>
                        <td>
                            <div class="tendido-pds-wrap">
                                <input type="number" id="nuevo-corte-pds-${i}" value="${pdsSafe}" placeholder="Ingrese PDS" min="0">
                                ${btnDeleteHtml}
                            </div>
                        </td>
                        <td>
                            <select id="nuevo-corte-estado-${i}" class="table-select" style="width:100%;">
                                <option value="PROG 1T" ${estadoVal === 'PROG 1T' ? 'selected' : ''}>PROG 1T</option>
                                <option value="PROG 2T" ${estadoVal === 'PROG 2T' ? 'selected' : ''}>PROG 2T</option>
                                <option value="PROG 3T" ${estadoVal === 'PROG 3T' ? 'selected' : ''}>PROG 3T</option>
                            </select>
                        </td>
                        <td>
                            <select id="nuevo-corte-equipo-${i}" class="table-select" style="width:100%;">
                                ${equiposHtml}
                            </select>
                        </td>
                    </tr>`;
        }

        tbody.innerHTML = html;
        for (let i = 0; i < rows.length; i++) {
            const prefill = (prefillValues && prefillValues[i]) ? prefillValues[i] : {};
            const estadoVal = normalizarEstadoDestinoNuevoCorte((prefill.estado !== undefined && prefill.estado !== null) ? String(prefill.estado) : String((rows[i] && rows[i].estado) || ''));
            const eqVal = (prefill.equipo !== undefined && prefill.equipo !== null) ? String(prefill.equipo) : String((rows[i] && rows[i].equipo) || '');
            const selEstado = document.getElementById(`nuevo-corte-estado-${i}`);
            const sel = document.getElementById(`nuevo-corte-equipo-${i}`);
            if (selEstado) selEstado.value = estadoVal;
            if (sel) sel.value = eqVal;
        }
    }

    window.abrirModalNuevoCorte = function () {
        const target = String(currentCorteFilter || '').toUpperCase().trim();
        if (!esSubtabPorProgramarNuevoCorte(target)) {
            alert('Nuevo corte solo esta disponible en Por Programar.');
            return;
        }

        try {
            if (!Array.isArray(equiposCorteData) || equiposCorteData.length === 0) {
                cargarEquiposCorteBackground();
            }
        } catch (e) { }

        modalNuevoCorteData = {
            sourceRowIndex: null,
            op: '',
            corteBase: '',
            opTela: '',
            partida: '',
            color: '',
            colorNorm: '',
            pdsTotal: 0,
            estadoCorteTarget: '',
            rows: []
        };

        const subtitle = document.getElementById('modal-nuevo-corte-subtitle');
        if (subtitle) subtitle.innerText = 'Busque una OC y asigne estado_corte/equipo_corte por tendido';
        const info = document.getElementById('modal-nuevo-corte-oc-info');
        if (info) {
            info.style.display = 'none';
            info.innerText = '';
        }
        const input = document.getElementById('modal-nuevo-corte-oc-input');
        if (input) {
            input.value = '';
            setTimeout(() => { try { input.focus(); } catch (e) { } }, 80);
        }
        renderModalNuevoCorteRows();
        const modal = document.getElementById('modal-nuevo-corte');
        if (modal) modal.classList.add('active');
    };

    window.buscarOCNuevoCorte = function (ocQuery) {
        const input = document.getElementById('modal-nuevo-corte-oc-input');
        const info = document.getElementById('modal-nuevo-corte-oc-info');
        const queryRaw = (ocQuery !== undefined && ocQuery !== null) ? ocQuery : (input ? input.value : '');
        const query = String(queryRaw || '').trim().toUpperCase();
        const activeSubtab = String(currentCorteFilter || '').toUpperCase().trim();

        if (!query) {
            alert('Ingrese una OC valida. Ejemplo: 40644-2');
            return;
        }
        if (!esSubtabPorProgramarNuevoCorte(activeSubtab)) {
            alert('Debe estar en Por Programar.');
            return;
        }

        const result = findSourceRowNuevoCorte(query);
        if (result.targetRow === -1) {
            modalNuevoCorteData.sourceRowIndex = null;
            modalNuevoCorteData.rows = [];
            renderModalNuevoCorteRows();
            if (info) {
                info.style.display = 'block';
                info.innerText = `No se encontro la OC ${query}.`;
            }
            return;
        }

        const row = rawData[result.targetRow];
        const op = String(getVal(row, 'OP') || '').trim();
        const corteRaw = String(getVal(row, 'CORTE') || '').trim();
        const corteBase = getCorteBaseNuevoCorte(corteRaw);
        const opTela = String(getVal(row, 'OP TELA') || '').trim();
        const partida = String(getVal(row, 'PARTIDA') || '').trim();
        const color = abbreviateHeather(getVal(row, 'COLOR') || '');
        const colorNorm = String(color || '').trim().toUpperCase();
        const pdsTotal = parseFloat(getVal(row, 'PDS GIRADAS') || getVal(row, 'PDS') || 0) || 0;
        const equipoDefault = String(getVal(row, 'equipo_corte') || getVal(row, 'EQUIPO CORTE') || getVal(row, 'EQUIPO_CORTE') || '').trim();
        const estadoDefault = normalizarEstadoDestinoNuevoCorte(estadoCorteFilaNuevoCorte(row));

        modalNuevoCorteData.sourceRowIndex = result.targetRow;
        modalNuevoCorteData.op = op;
        modalNuevoCorteData.corteBase = corteBase;
        modalNuevoCorteData.opTela = opTela;
        modalNuevoCorteData.partida = partida;
        modalNuevoCorteData.color = color;
        modalNuevoCorteData.colorNorm = colorNorm;
        modalNuevoCorteData.pdsTotal = pdsTotal;
        modalNuevoCorteData.estadoCorteTarget = '';
        modalNuevoCorteData.rows = [];

        const firstCode = getNextTendidoNuevoCorte();
        if (!firstCode) {
            alert('No se pudo generar el nuevo corte. Revise la OC seleccionada.');
            renderModalNuevoCorteRows();
            return;
        }
        modalNuevoCorteData.rows.push({ corte: firstCode, estado: estadoDefault, equipo: equipoDefault });
        renderModalNuevoCorteRows();

        if (info) {
            info.style.display = 'block';
            info.innerText = `OC: ${op}-${corteRaw} | OP-PTDA: ${opTela || '-'}-${partida || '-'} | COLOR: ${color || '-'} | PDS: ${formatThousands(pdsTotal, 0)} | Estado default: ${estadoDefault}`;
        }
    };

    window.agregarFilaNuevoCorte = function () {
        if (!modalNuevoCorteData || modalNuevoCorteData.sourceRowIndex === null) {
            alert('Primero busque una OC.');
            return;
        }

        const previousValues = collectModalNuevoCorteValues();
        const nextCode = getNextTendidoNuevoCorte();
        if (!nextCode) {
            alert('No se pudo generar el siguiente tendido.');
            return;
        }

        let defaultEquipo = '';
        let defaultEstado = 'PROG 1T';
        if (previousValues.length > 0) {
            defaultEquipo = String(previousValues[previousValues.length - 1].equipo || '').trim();
            defaultEstado = normalizarEstadoDestinoNuevoCorte(previousValues[previousValues.length - 1].estado || '');
        }
        if (!defaultEquipo && modalNuevoCorteData.rows.length > 0) {
            defaultEquipo = String(modalNuevoCorteData.rows[modalNuevoCorteData.rows.length - 1].equipo || '').trim();
        }
        if (modalNuevoCorteData.rows.length > 0 && (!defaultEstado || !esEstadoDestinoNuevoCorte(defaultEstado))) {
            defaultEstado = normalizarEstadoDestinoNuevoCorte(modalNuevoCorteData.rows[modalNuevoCorteData.rows.length - 1].estado || '');
        }

        modalNuevoCorteData.rows.push({ corte: nextCode, estado: defaultEstado, equipo: defaultEquipo });
        previousValues.push({ pds: '', estado: defaultEstado, equipo: defaultEquipo });
        renderModalNuevoCorteRows(previousValues);
    };

    window.eliminarUltimaFilaNuevoCorte = function () {
        if (!modalNuevoCorteData || !Array.isArray(modalNuevoCorteData.rows) || modalNuevoCorteData.rows.length <= 1) return;
        const prevValues = collectModalNuevoCorteValues();
        modalNuevoCorteData.rows.pop();
        prevValues.pop();
        renderModalNuevoCorteRows(prevValues);
    };

    window.limpiarModalNuevoCorte = function () {
        if (!modalNuevoCorteData || !Array.isArray(modalNuevoCorteData.rows)) return;
        for (let i = 0; i < modalNuevoCorteData.rows.length; i++) {
            const pdsInput = document.getElementById(`nuevo-corte-pds-${i}`);
            const estadoSelect = document.getElementById(`nuevo-corte-estado-${i}`);
            const eqSelect = document.getElementById(`nuevo-corte-equipo-${i}`);
            if (pdsInput) pdsInput.value = '';
            if (estadoSelect) estadoSelect.value = 'PROG 1T';
            if (eqSelect) eqSelect.value = '';
        }
    };

    window.cerrarModalNuevoCorte = function () {
        const modal = document.getElementById('modal-nuevo-corte');
        if (modal) modal.classList.remove('active');
        modalNuevoCorteData = {
            sourceRowIndex: null,
            op: '',
            corteBase: '',
            opTela: '',
            partida: '',
            color: '',
            colorNorm: '',
            pdsTotal: 0,
            estadoCorteTarget: '',
            rows: []
        };
    };

    window.guardarModalNuevoCorte = async function () {
        if (!modalNuevoCorteData || modalNuevoCorteData.sourceRowIndex === null || !rawData[modalNuevoCorteData.sourceRowIndex]) {
            alert('Primero busque una OC valida.');
            return;
        }

        const rowsValues = collectModalNuevoCorteValues();
        if (!rowsValues.length || !modalNuevoCorteData.rows.length) {
            alert('No hay filas para guardar.');
            return;
        }

        const clearColumns = [
            'estado_corte_bloques', 'estado_bloques', 'estado_rib', 'estado_enumerado', 'estado_coll_tap', 'estado_rectilineo',
            'estado_habilitado', 'estado_transfer', 'estado_bordado', 'estado_estampado', 'estado_ingreso',
            'F.ING.REAL', 'OBSERVACIONES', 'VALIDA', 'VALIDACION'
        ];

        const sourceRow = rawData[modalNuevoCorteData.sourceRowIndex];
        const idxCorte = findHeaderIndexCaseInsensitive('CORTE');
        const idxPds = findHeaderIndexCaseInsensitive('PDS GIRADAS');
        const idxEquipo = findHeaderIndexCaseInsensitive('equipo_corte');
        const idxEstado = findHeaderIndexCaseInsensitive('estado_corte');
        const clearIdxs = clearColumns
            .map(name => findHeaderIndexCaseInsensitive(name))
            .filter(idx => idx !== -1);

        let createdCount = 0;
        const createdByEstado = { 'PROG 1T': 0, 'PROG 2T': 0, 'PROG 3T': 0 };
        for (let i = 0; i < modalNuevoCorteData.rows.length; i++) {
            const rowCfg = modalNuevoCorteData.rows[i] || {};
            const corteCode = String(rowCfg.corte || '').trim();
            const pdsNum = parseFloat(rowsValues[i] && rowsValues[i].pds) || 0;
            const estadoDestino = normalizarEstadoDestinoNuevoCorte(rowsValues[i] && rowsValues[i].estado);
            const equipoVal = String(rowsValues[i] && rowsValues[i].equipo || '').trim();

            if (!corteCode) {
                alert(`Fila ${i + 1}: corte invalido.`);
                return;
            }
            if (!(pdsNum > 0)) {
                alert(`Fila ${i + 1}: ingrese un PDS valido.`);
                return;
            }
            if (!esEstadoDestinoNuevoCorte(estadoDestino)) {
                alert(`Fila ${i + 1}: seleccione estado_corte (PROG 1T/PROG 2T/PROG 3T).`);
                return;
            }
            if (!equipoVal) {
                alert(`Fila ${i + 1}: seleccione equipo_corte.`);
                return;
            }

            const newRow = [...sourceRow];
            if (idxCorte !== -1) newRow[idxCorte] = corteCode;
            if (idxPds !== -1) newRow[idxPds] = pdsNum;
            if (idxEquipo !== -1) newRow[idxEquipo] = equipoVal;
            if (idxEstado !== -1) newRow[idxEstado] = estadoDestino;
            clearIdxs.forEach(idx => { newRow[idx] = ''; });
            try { newRow._inserted = Date.now(); } catch (e) { }
            rawData.push(newRow);

            const payload = {
                action: 'duplicateRow',
                sourceRow: modalNuevoCorteData.sourceRowIndex,
                sourceOp: String(getVal(sourceRow, 'OP') || '').trim(),
                sourceCorte: String(getVal(sourceRow, 'CORTE') || '').trim(),
                sourceOpTela: String(getVal(sourceRow, 'OP TELA') || '').trim(),
                sourcePartida: String(getVal(sourceRow, 'PARTIDA') || '').trim(),
                sourceColor: String(getVal(sourceRow, 'COLOR') || '').trim(),
                newCorte: corteCode,
                newPds: pdsNum,
                estadoCorte: estadoDestino,
                equipoCorte: equipoVal,
                clearColumns: clearColumns
            };
            window.PcpProgramaService.duplicarFila(payload, { noCors: true, headers: {} }).catch(e => console.error('Error creando nuevo corte', e));

            createdCount++;
            createdByEstado[estadoDestino] = (createdByEstado[estadoDestino] || 0) + 1;
        }

        try {
            window._ocSearchState = null;
            window._ocSearchDataStamp = Date.now();
        } catch (e) { }

        await new Promise(resolve => setTimeout(resolve, 350));
        cerrarModalNuevoCorte();
        updateCounters();
        renderCorte();
        scheduleSheetResync(1200);
        const resumenEstados = ['PROG 1T', 'PROG 2T', 'PROG 3T']
            .filter(k => (createdByEstado[k] || 0) > 0)
            .map(k => `${k}: ${createdByEstado[k]}`)
            .join(' | ');
        alert(`Se crearon ${createdCount} nuevo(s) corte(s). ${resumenEstados}`);
    };

    // Modal para mostrar informaci?n OC (RUTA, EQUIPO_CORTE, ESTADO_ENUMERADO)
    window.abrirModalOC = function (rowIndex) {
        try {
            console.log('abrirModalOC called, rowIndex=', rowIndex, 'isHabilitadoView=', isHabilitadoView && isHabilitadoView());
            if (!isHabilitadoView || !isHabilitadoView()) { console.log('abrirModalOC: not in habilitado view'); return; }
            if (typeof rawData === 'undefined') { console.warn('abrirModalOC: rawData undefined'); return; }
            const row = rawData[rowIndex];
            if (!row) return;
            const op = getVal(row, 'OP') || '';
            const corte = getVal(row, 'CORTE') || '';
            const oc = (op || corte) ? `${op}-${corte}` : '';
            const colorRaw = getVal(row, 'COLOR') || '';
            const color = abbreviateHeather(colorRaw);
            const ruta = getVal(row, 'RUTA TELA') || getVal(row, 'RUTA') || '';
            const equipo = getVal(row, 'EQUIPO CORTE') || getVal(row, 'EQUIPO_CORTE') || getVal(row, 'equipo_corte') || '';
            const estadoEnum = getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO_ENUMERADO') || getVal(row, 'ESTADO ENUMERADO') || '';
            const estadoCorte = getVal(row, 'STATUS_CORTE') || getVal(row, 'STATUS') || getVal(row, 'status') || getVal(row, 'ESTADO CORTE') || getVal(row, 'ESTADO_CORTE') || getVal(row, 'estado_corte') || '';

            document.getElementById('modal-oc-title').innerText = `${oc} ${color}`;
            document.getElementById('modal-oc-subtitle').innerText = '';

            const tbody = document.getElementById('modal-oc-tbody');
            let html = '';
            html += `<tr><td style="font-weight:700;">RUTA</td><td title="${ruta}">${ruta}</td></tr>`;
            html += `<tr><td style="font-weight:700;">EQUIPO_CORTE</td><td title="${equipo}">${equipo}</td></tr>`;
            html += `<tr><td style="font-weight:700;">ESTADO_CORTE</td><td title="${estadoCorte}">${estadoCorte}</td></tr>`;
            html += `<tr><td style="font-weight:700;">ESTADO_ENUMERADO</td><td title="${estadoEnum}">${estadoEnum}</td></tr>`;
            tbody.innerHTML = html;
            document.getElementById('modal-oc').classList.add('active');
        } catch (e) { console.error('abrirModalOC error', e); }
    };

    window.cerrarModalOC = function () {
        try {
            document.getElementById('modal-oc').classList.remove('active');
            const tbody = document.getElementById('modal-oc-tbody'); if (tbody) tbody.innerHTML = '';
        } catch (e) { }
    };

    window.abrirModalOcSearchHabilitadoOk = function (query, items) {
        try {
            const modal = document.getElementById('modal-oc-search-ok');
            const subtitle = document.getElementById('modal-oc-search-ok-subtitle');
            const tbody = document.getElementById('modal-oc-search-ok-tbody');
            if (!modal || !tbody) return;
            const rows = Array.isArray(items) ? items : [];
            if (subtitle) subtitle.innerText = `OC buscada: ${query || '-'} | Coincidencias con estado_habilitado = OK: ${rows.length}`;
            tbody.innerHTML = '';
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:18px; color:var(--gray-500);">No se encontraron cortes con estado_habilitado = OK.</td></tr>';
            } else {
                rows.forEach(item => {
                    const tr = document.createElement('tr');
                    ['cliente', 'oc', 'color', 'pds', 'fIngReal', 'planta', 'linea'].forEach(key => {
                        const td = document.createElement('td');
                        td.textContent = item && item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '' ? String(item[key]) : '-';
                        tr.appendChild(td);
                    });
                    const tdEstado = document.createElement('td');
                    const pill = document.createElement('span');
                    pill.textContent = 'OK';
                    pill.style.display = 'inline-flex';
                    pill.style.alignItems = 'center';
                    pill.style.padding = '4px 10px';
                    pill.style.borderRadius = '999px';
                    pill.style.border = '1px solid rgba(16,185,129,0.32)';
                    pill.style.background = 'var(--success-light)';
                    pill.style.color = '#047857';
                    pill.style.fontSize = '11px';
                    pill.style.fontWeight = '700';
                    tdEstado.appendChild(pill);
                    tr.appendChild(tdEstado);
                    tbody.appendChild(tr);
                });
            }
            modal.classList.add('active');
        } catch (e) { console.error('abrirModalOcSearchHabilitadoOk error', e); }
    };

    window.cerrarModalOcSearchHabilitadoOk = function () {
        try {
            const modal = document.getElementById('modal-oc-search-ok');
            if (modal) modal.classList.remove('active');
            const tbody = document.getElementById('modal-oc-search-ok-tbody');
            if (tbody) tbody.innerHTML = '';
        } catch (e) { }
    };

    // ===============================
    // FUNCIONES DEL MODAL DE LAVADORA (desde Corte PROG)
    // ===============================

    window.abrirModalLavadoFromCorte = function (rowIndex) {
        try {
            const row = rawData[rowIndex] || [];
            const estado = getVal(row, 'estado_lavada') || '';
            const ruta = getVal(row, 'RUTA TELA') || getVal(row, 'RUTA') || '';
            const opTela = String(getVal(row, 'OP TELA') || '').trim();
            const partida = String(getVal(row, 'PARTIDA') || '').trim();
            const opPtda = `${opTela}-${partida}`;

            document.getElementById('modal-lavadora-title').innerText = `OP-PTDA: ${opPtda}`;
            document.getElementById('modal-lavadora-sub').innerText = `Estado actual: ${estado || '(vac?o)'}`;
            document.getElementById('modal-lavadora-ruta').innerText = ruta || '-';
            const sel = document.getElementById('modal-lavadora-select');
            if (sel) sel.value = '';

            window._pendingWasherUpdate = { rowIndex, prev: estado };
            const m = document.getElementById('modal-lavadora');
            if (m) m.classList.add('active');
        } catch (e) { console.error('Error abriendo modal lavadora', e); }
    };

    function cerrarModalLavado() {
        const m = document.getElementById('modal-lavadora');
        if (m) m.classList.remove('active');
        // limpiar pending
        window._pendingWasherUpdate = null;
    }

    function onModalLavadoraApply() {
        try {
            const sel = document.getElementById('modal-lavadora-select');
            if (!sel) return;
            const val = sel.value || '';
            if (val === '') { alert('Seleccione una opci?n.'); return; }
            // Abrir modal de confirmaci?n
            const modal = document.getElementById('modal-confirm-washer');
            window._pendingWasherUpdate = window._pendingWasherUpdate || {};
            window._pendingWasherUpdate.value = val;
            try {
                const txt = document.getElementById('modal-confirm-washer-text');
                if (txt) {
                    if (val === 'EN LAV (devolucion)') txt.innerText = 'Aplica para toda la partida?';
                    else txt.innerText = '?Est? seguro que desea actualizar el estado de lavado?';
                }
            } catch (e) { }
            if (modal) modal.classList.add('active');
        } catch (e) { console.error('Error aplicando en modal lavadora', e); }
    }

    function cerrarModalConfirmWasher() {
        const m = document.getElementById('modal-confirm-washer');
        if (m) m.classList.remove('active');
    }

    function handleConfirmWasher(confirmed) {
        const pending = window._pendingWasherUpdate;
        const modal = document.getElementById('modal-confirm-washer');
        if (!pending) { if (modal) modal.classList.remove('active'); return; }

        const val = pending.value || '';

        // If the selected action is the special 'EN LAV (devolucion)'
        // we treat the confirm dialog as: Si = aplicar a toda la partida, No = aplicar solo la fila
        if (val === 'EN LAV (devolucion)') {
            if (modal) modal.classList.remove('active');
            try {
                const fake = document.createElement('select'); fake.className = 'table-select';
                if (confirmed) {
                    // Aplicar a todas las filas con mismo OP-PTDA
                    const rowIdx = pending.rowIndex;
                    const opTela = String(getVal(rawData[rowIdx], 'OP TELA') || getVal(rawData[rowIdx], 'OP') || '').trim();
                    const partida = String(getVal(rawData[rowIdx], 'PARTIDA') || '').trim();
                    for (let i = 1; i < rawData.length; i++) {
                        try {
                            const rOp = String(getVal(rawData[i], 'OP TELA') || getVal(rawData[i], 'OP') || '').trim();
                            const rPart = String(getVal(rawData[i], 'PARTIDA') || '').trim();
                            if (rOp === opTela && rPart === partida) {
                                window.updateRow(i, 'estado_lavada', val, fake);
                            }
                        } catch (e) { /* ignore row errors */ }
                    }
                } else {
                    // Aplicar s?lo a la fila
                    const rowIndex = pending.rowIndex;
                    window.updateRow(rowIndex, 'estado_lavada', val, fake);
                }
            } catch (e) { console.error('Error actualizando estado_lavada en batch/single', e); }

            // Cerrar modal de edici?n
            cerrarModalLavado();
            window._pendingWasherUpdate = null;
            return;
        }

        // Comportamiento por defecto para otras opciones: confirmar o cancelar
        if (!confirmed) {
            if (modal) modal.classList.remove('active');
            // keep modal lavadora open so user can choose again
            return;
        }

        // Confirmado: escribir en estado_lavada (solo fila)
        try {
            if (modal) modal.classList.remove('active');
            const rowIndex = pending.rowIndex;
            const value = pending.value || 'EN LAV';
            try {
                const fake = document.createElement('select');
                fake.className = 'table-select';
                window.updateRow(rowIndex, 'estado_lavada', value, fake);
            } catch (e) { console.error('Error actualizando estado_lavada', e); }
        } catch (e) { console.error('Error en handleConfirmWasher', e); }
        // Cerrar modal de edici?n
        cerrarModalLavado();
        window._pendingWasherUpdate = null;
    }

    function askEnumeradoConfirmModal() {
        return new Promise(function (resolve) {
            try {
                window._resolveEnumeradoConfirm = resolve;
                const modal = document.getElementById('modal-confirm-enumerado');
                if (modal) modal.classList.add('active');
                else resolve(false);
            } catch (e) {
                console.error('Error abriendo modal confirm enumerado', e);
                resolve(false);
            }
        });
    }

    window.cerrarModalConfirmEnumerado = function () {
        const modal = document.getElementById('modal-confirm-enumerado');
        if (modal) modal.classList.remove('active');
        const resolver = window._resolveEnumeradoConfirm;
        window._resolveEnumeradoConfirm = null;
        if (typeof resolver === 'function') resolver(false);
    };

    window.handleConfirmEnumerado = function (confirmed) {
        const modal = document.getElementById('modal-confirm-enumerado');
        if (modal) modal.classList.remove('active');
        const resolver = window._resolveEnumeradoConfirm;
        window._resolveEnumeradoConfirm = null;
        if (typeof resolver === 'function') resolver(!!confirmed);
    };

    function askDepuradoConfirmModal() {
        return new Promise(function (resolve) {
            try {
                window._resolveDepuradoConfirm = resolve;
                const modal = document.getElementById('modal-confirm-depurado');
                if (modal) modal.classList.add('active');
                else resolve(false);
            } catch (e) {
                console.error('Error abriendo modal confirm depurado', e);
                resolve(false);
            }
        });
    }

    window.cerrarModalConfirmDepurado = function () {
        const modal = document.getElementById('modal-confirm-depurado');
        if (modal) modal.classList.remove('active');
        const resolver = window._resolveDepuradoConfirm;
        window._resolveDepuradoConfirm = null;
        if (typeof resolver === 'function') resolver(false);
    };

    window.handleConfirmDepurado = function (confirmed) {
        const modal = document.getElementById('modal-confirm-depurado');
        if (modal) modal.classList.remove('active');
        const resolver = window._resolveDepuradoConfirm;
        window._resolveDepuradoConfirm = null;
        if (typeof resolver === 'function') resolver(!!confirmed);
    };

    // FUNCIONES PARA MODAL INGRESO A COSTURA
    let currentIngresoCosturaRowIndex = -1;
    let currentIngresoCosturaData = {};

    window.abrirModalIngresoCostura = function (rowIndex, estadoHabTarget) {
        try {
            currentIngresoCosturaRowIndex = rowIndex;
            const row = rawData[rowIndex];

            // Obtener datos de la fila
            const cliente = getVal(row, 'CLIENTE') || '';
            const op = getVal(row, 'OP') || '';
            const corte = getVal(row, 'CORTE') || '';
            const color = getVal(row, 'COLOR') || '';
            const pds = getVal(row, 'PDS GIRADAS') || '';
            const opTela = getVal(row, 'OP TELA') || '';
            const partida = getVal(row, 'PARTIDA') || '';

            // Obtener PLANTA y LINEA
            const planta = normalizeHabilitadoPlantaValue(getVal(row, 'PLANTA') || '');
            const linea = getVal(row, 'LINEA') || '';

            // Guardar datos actuales
            currentIngresoCosturaData = {
                rowIndex: rowIndex,
                cliente: cliente,
                op: op,
                corte: corte,
                color: color,
                pds: pds,
                opTela: opTela,
                partida: partida,
                planta: planta,
                linea: linea,
                estadoHabTarget: estadoHabTarget || 'OK'
            };

            // Llenar el modal
            document.getElementById('modal-ingreso-costura-sub').textContent = `${cliente} ${op}-${corte} ${color} ${pds}`;

            // Establecer valor de PLANTA en el select
            const plantaSelect = document.getElementById('modal-ingreso-planta');
            syncIngresoCosturaPlantaOptions(estadoHabTarget || 'OK');
            // Eliminar opciones din?micas anteriores
            plantaSelect.querySelectorAll('option[data-dynamic]').forEach(opt => opt.remove());
            const plantaValidation = validateHabilitadoPlantaForEstado(planta, estadoHabTarget || 'OK');
            const plantaModalValue = plantaValidation.valid ? plantaValidation.normalizedPlanta : '';
            if (plantaModalValue) {
                // Si el valor del sheet no existe como opci?n en el select, agregarlo din?micamente
                const existeOpcion = Array.from(plantaSelect.options).some(opt => opt.value === plantaModalValue);
                if (!existeOpcion) {
                    const newOpt = document.createElement('option');
                    newOpt.value = plantaModalValue;
                    newOpt.textContent = plantaModalValue;
                    newOpt.setAttribute('data-dynamic', 'true');
                    // Insertar despu?s de la primera opci?n (-- Seleccione --)
                    plantaSelect.insertBefore(newOpt, plantaSelect.options[1]);
                }
                plantaSelect.value = plantaModalValue;
            } else {
                plantaSelect.value = '';
            }

            // Pre-cargar LINEA existente del sheet (el usuario puede modificarlo)
            document.getElementById('modal-ingreso-linea').value = linea;

            // Abrir modal
            document.getElementById('modal-ingreso-costura').classList.add('active');

            // Enfocar en el campo de LINEA
            setTimeout(() => {
                const inputLinea = document.getElementById('modal-ingreso-linea');
                if (inputLinea) inputLinea.focus();
            }, 100);
        } catch (e) {
            console.error('Error en abrirModalIngresoCostura:', e);
            alert('Error al abrir el modal');
        }
    };

    window.cerrarModalIngresoCostura = function () {
        document.getElementById('modal-ingreso-costura').classList.remove('active');
        currentIngresoCosturaRowIndex = -1;
        currentIngresoCosturaData = {};
    };

    window.guardarModalIngresoCostura = function () {
        try {
            const linea = document.getElementById('modal-ingreso-linea').value.trim();
            let planta = document.getElementById('modal-ingreso-planta').value.trim();

            if (!linea) {
                alert('Por favor ingrese la l?nea');
                return;
            }

            // Si no se seleccion? nada del desplegable, usar el valor existente del sheet
            if (!planta && currentIngresoCosturaData.planta) {
                planta = currentIngresoCosturaData.planta;
            }

            const estadoHabTarget = currentIngresoCosturaData.estadoHabTarget || 'OK';
            const plantaValidation = validateHabilitadoPlantaForEstado(planta, estadoHabTarget);
            planta = plantaValidation.normalizedPlanta;
            if (!plantaValidation.valid) {
                alert(plantaValidation.message);
                return;
            }
            if (!planta) {
                alert('Por favor seleccione la planta');
                return;
            }

            // Obtener fecha y hora actual
            const ahora = new Date();
            const dd = String(ahora.getDate()).padStart(2, '0');
            const mm = String(ahora.getMonth() + 1).padStart(2, '0');
            const yyyy = ahora.getFullYear();
            const hh = String(ahora.getHours()).padStart(2, '0');
            const min = String(ahora.getMinutes()).padStart(2, '0');
            const ss = String(ahora.getSeconds()).padStart(2, '0');
            const fechaHora = `${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss}`;

            // Enviar datos al backend para guardar todos de una vez
            const rowIndex = currentIngresoCosturaRowIndex;

            // PROTECCI?N: Verificar que el rowIndex sea v?lido
            if (rowIndex < 1 || !rawData[rowIndex]) {
                console.error('PROTECCI?N guardarModalIngresoCostura: rowIndex inv?lido=' + rowIndex);
                alert('Error: ?ndice de fila inv?lido. Recargue la p?gina e intente de nuevo.');
                return;
            }

            // Crear array de actualizaciones incluyendo PLANTA y LINEA
            const updates = [
                { colName: 'PLANTA', value: planta },
                { colName: 'LINEA', value: linea },
                { colName: 'estado_habilitado', value: estadoHabTarget }
            ];

            // Solo guardar F.ING.REAL cuando el estado seleccionado es OK
            if (estadoHabTarget === 'OK') {
                updates.splice(2, 0, { colName: 'F.ING.REAL', value: fechaHora });
            }

            const sourceData = Object.assign({}, currentIngresoCosturaData);

            // Cerrar el modal inmediatamente
            cerrarModalIngresoCostura();

            // Guardar todos los datos
            guardarVariosDatosIngresoCostura(rowIndex, updates, sourceData);

        } catch (e) {
            console.error('Error en guardarModalIngresoCostura:', e);
            alert('Error al guardar');
        }
    };

    window.guardarVariosDatosIngresoCostura = function (rowIndex, updates, sourceData) {
        try {
            const norm = (v) => String(v || '').trim().toUpperCase();
            const fallbackRowIndex = Number.isInteger(rowIndex) ? rowIndex : parseInt(rowIndex, 10);

            const source = sourceData || {};
            const sourceKeys = {
                op: norm(source.op),
                corte: norm(source.corte),
                opTela: norm(source.opTela),
                partida: norm(source.partida),
                color: norm(source.color)
            };
            const hasAnySourceKey = !!(sourceKeys.op || sourceKeys.corte || sourceKeys.opTela || sourceKeys.partida || sourceKeys.color);

            let targetRowIndex = fallbackRowIndex;
            if (hasAnySourceKey && Array.isArray(rawData)) {
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
                    const match = (!sourceKeys.op || rowOp === sourceKeys.op)
                        && (!sourceKeys.corte || rowCorte === sourceKeys.corte)
                        && (!sourceKeys.opTela || rowOpTela === sourceKeys.opTela)
                        && (!sourceKeys.partida || rowPartida === sourceKeys.partida)
                        && (!sourceKeys.color || rowColor === sourceKeys.color);
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
                if (bestMatch !== null) targetRowIndex = bestMatch;
            }

            // PROTECCION: No permitir escritura en encabezados
            if (!Number.isInteger(targetRowIndex) || targetRowIndex < 1 || !rawData[targetRowIndex]) {
                console.error('PROTECCION guardarVariosDatosIngresoCostura: rowIndex invalido=' + targetRowIndex);
                alert('Error: indice de fila invalido. Recargue la pagina.');
                return;
            }

            // 1) Actualizar rawData localmente para mantener consistencia
            updates.forEach(update => {
                try {
                    const idx = findHeaderIndexCaseInsensitive(update.colName);
                    if (idx !== -1 && rawData[targetRowIndex]) {
                        rawData[targetRowIndex][idx] = update.value;
                    }
                } catch (e) { console.error('Error actualizando rawData local:', e); }
            });

            // 2) Re-renderizar inmediatamente para que la fila desaparezca de la vista
            //    (estado_habilitado = 'OK' ya no cumple el filtro de "Por Programar")
            renderHabilitado();

            // 3) Preparar las actualizaciones con nombres de columna reales del encabezado
            const batchUpdates = updates.map(update => {
                let sendColName = update.colName;
                try {
                    const idx = findHeaderIndexCaseInsensitive(update.colName);
                    if (idx !== -1 && rawData[0] && rawData[0][idx]) {
                        sendColName = rawData[0][idx];
                    }
                } catch (e) { }
                return { colName: sendColName, value: update.value };
            });

            // 4) Enviar UNA sola solicitud al backend con todas las actualizaciones
            const params = {
                action: 'batchUpdateRow',
                row: targetRowIndex,
                updates: batchUpdates,
                sourceOp: String(source.op || '').trim(),
                sourceCorte: String(source.corte || '').trim(),
                sourceOpTela: String(source.opTela || '').trim(),
                sourcePartida: String(source.partida || '').trim(),
                sourceColor: String(source.color || '').trim()
            };

            window.PcpProgramaService.actualizarFilaBatch(params, { noCors: true, headers: {} })
                .then(() => {
                    showToast('Datos guardados correctamente', 'success');
                })
                .catch(e => {
                    console.error('Error guardando datos de ingreso costura:', e);
                    showToast('Error al guardar. Los datos se reintentaran al recargar.', 'error');
                });
        } catch (e) {
            console.error('Error en guardarVariosDatosIngresoCostura:', e);
            alert('Error al guardar los datos');
        }
    };

    // Notificaci?n tipo toast no bloqueante
    function showToast(message, type) {
        const toast = document.createElement('div');
        toast.textContent = message;
        const bgColor = type === 'error' ? '#ef4444' : '#22c55e';
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;padding:12px 24px;border-radius:8px;color:#fff;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:opacity 0.4s;opacity:1;background:' + bgColor;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; }, 2500);
        setTimeout(() => { toast.remove(); }, 3000);
    }

    window.guardarDatoIngresoCostura = function (rowIndex, colName, value, callback) {
        try {
            window.PcpProgramaService.actualizarCampo(rowIndex, colName, value, { noCors: true, headers: {} })
                .then(() => {
                    if (callback) callback();
                })
                .catch(e => {
                    console.error(`Error guardando ${colName}:`, e);
                });
        } catch (e) {
            console.error('Error en guardarDatoIngresoCostura:', e);
        }
    };

    window.limpiarModalTendido = function () {
        const numTendidos = modalTendidoData.tendidos ? modalTendidoData.tendidos.length : 2;
        for (let i = 0; i < numTendidos; i++) {
            const input = document.getElementById(`pds-tendido-${i}`);
            if (input) input.value = '';
        }
    };

    window.guardarModalTendido = function () {
        const numTendidos = modalTendidoData.tendidos ? modalTendidoData.tendidos.length : 2;
        const pdsValues = [];

        for (let i = 0; i < numTendidos; i++) {
            const input = document.getElementById(`pds-tendido-${i}`);
            const pds = parseFloat(input ? input.value : 0) || 0;
            pdsValues.push(pds);
        }

        if (pdsValues.some(v => v <= 0)) {
            alert('Por favor ingrese valores v?lidos para todos los tendidos.');
            return;
        }

        if (modalTendidoData.modo === 'crear') {
            guardarModalTendidoCreacion(pdsValues);
        } else if (modalTendidoData.modo === 'editar') {
            guardarModalTendidoEdicion(pdsValues);
        }
    };

    window.guardarModalTendidoCreacion = function (pdsValues) {
        const rowIndex = modalTendidoData.rowIndex;
        if (rowIndex === null || !rawData[rowIndex]) {
            alert('Error: No se encontr? la fila original.');
            cerrarModalTendido();
            return;
        }

        const originalRow = rawData[rowIndex];
        const corte = modalTendidoData.corte;
        const corteIdx = colMap["CORTE"];
        const pdsIdx = colMap["PDS GIRADAS"];

        if (corteIdx === undefined || corteIdx === -1 || pdsIdx === undefined || pdsIdx === -1) {
            alert('Error: No se encontraron las columnas CORTE o PDS GIRADAS.');
            cerrarModalTendido();
            return;
        }

        try {
            // Construir array de tendidos para enviar al servidor
            const tendidosData = [];
            let alertMsg = 'Se han creado los tendidos:';

            for (let i = 0; i < pdsValues.length; i++) {
                const tendidoNum = String(i + 1).padStart(2, '0');
                const tendido = `${corte}${tendidoNum}`;
                const pds = pdsValues[i];

                tendidosData.push({ corte: tendido, pds: pds });
                alertMsg += `\n? ${tendido} con ${formatThousands(pds, 0)} PDS`;
            }

            // Actualizar rawData localmente
            // Primer tendido reemplaza la fila original
            const newRow1 = [...originalRow];
            newRow1[corteIdx] = tendidosData[0].corte;
            newRow1[pdsIdx] = tendidosData[0].pds;
            try { newRow1._inserted = Date.now(); } catch (e) { }
            rawData[rowIndex] = newRow1;

            // Tendidos adicionales se agregan AL FINAL de rawData
            // (coincide con el servidor que los a?ade al final del sheet)
            for (let i = 1; i < tendidosData.length; i++) {
                const newRow = [...originalRow];
                newRow[corteIdx] = tendidosData[i].corte;
                newRow[pdsIdx] = tendidosData[i].pds;
                try { newRow._inserted = Date.now(); } catch (e) { }

                rawData.push(newRow);
            }

            // Obtener el estado_corte actual de la fila para preservarlo en los tendidos
            const estadoCorteIdx = colMap["estado_corte"] ?? colMap["ESTADO_CORTE"] ?? colMap["STATUS_CORTE"] ?? colMap["STATUS"] ?? colMap["status"] ?? -1;
            const estadoCorteVal = (estadoCorteIdx !== -1 && originalRow[estadoCorteIdx]) ? String(originalRow[estadoCorteIdx]) : null;

            // Enviar todos los tendidos al servidor en UNA SOLA llamada at?mica
            const payload = {
                action: "createTendidos",
                sourceRow: rowIndex,
                sourceOp: String(getVal(originalRow, 'OP') || '').trim(),
                sourceCorte: String(getVal(originalRow, 'CORTE') || '').trim(),
                sourceOpTela: String(getVal(originalRow, 'OP TELA') || '').trim(),
                sourcePartida: String(getVal(originalRow, 'PARTIDA') || '').trim(),
                sourceColor: String(getVal(originalRow, 'COLOR') || '').trim(),
                tendidos: tendidosData
            };
            if (estadoCorteIdx !== -1) payload.estadoCorte = estadoCorteVal || '';

            window.PcpProgramaService.crearTendidos(payload, { noCors: true, headers: {} }).catch(e => console.error("Error guardando tendidos", e));

        } catch (e) {
            console.error('Error guardando tendidos:', e);
            alert('Error al guardar los tendidos.');
            return;
        }

        // Registrar la base como creada para que se muestre priorizada
        try { addCreatedTendidoBase(corte, modalTendidoData.op, modalTendidoData.opTela, modalTendidoData.partida, modalTendidoData.colorNorm || modalTendidoData.color); } catch (e) { }

        // Cerrar modal y re-renderizar
        cerrarModalTendido();
        updateCounters();
        renderCorte();
        scheduleSheetResync(900);

        alert(alertMsg);
    };

    window.guardarModalTendidoEdicion = function (pdsValues) {
        const tendidoRows = modalTendidoData.tendidoRows || [];

        if (tendidoRows.length === 0) {
            alert('Error: No se encontraron los tendidos existentes.');
            cerrarModalTendido();
            return;
        }

        const pdsIdx = colMap["PDS GIRADAS"];
        const corteIdx = colMap["CORTE"];

        if (pdsIdx === undefined || pdsIdx === -1 || corteIdx === undefined || corteIdx === -1) {
            alert('Error: No se encontr? la columna PDS GIRADAS o CORTE.');
            cerrarModalTendido();
            return;
        }

        try {
            let alertMsg = 'Se han actualizado los tendidos:';
            const corte = modalTendidoData.corte;

            // Actualizar tendidos existentes
            for (let i = 0; i < Math.min(pdsValues.length, tendidoRows.length); i++) {
                const rowIdx = tendidoRows[i];
                const pds = pdsValues[i];
                const tendidoNum = String(i + 1).padStart(2, '0');
                const tendido = `${corte}${tendidoNum}`;

                rawData[rowIdx][pdsIdx] = pds;
                const sourceUpdateRow = rawData[rowIdx];

                window.PcpProgramaService.actualizarCampoConOrigen(
                    rowIdx,
                    "PDS GIRADAS",
                    pds,
                    {
                        sourceOp: String(getVal(sourceUpdateRow, 'OP') || '').trim(),
                        sourceCorte: String(getVal(sourceUpdateRow, 'CORTE') || '').trim(),
                        sourceOpTela: String(getVal(sourceUpdateRow, 'OP TELA') || '').trim(),
                        sourcePartida: String(getVal(sourceUpdateRow, 'PARTIDA') || '').trim(),
                        sourceColor: String(getVal(sourceUpdateRow, 'COLOR') || '').trim()
                    },
                    { noCors: true, headers: {} }
                ).catch(e => console.error(`Error guardando PDS tendido ${i + 1}`, e));

                alertMsg += `\n? ${tendido} con ${formatThousands(pds, 0)} PDS`;
            }
            // Registrar la base como creada (en caso de a?adir nuevos tendidos)
            try { addCreatedTendidoBase(corte, modalTendidoData.op, modalTendidoData.opTela, modalTendidoData.partida, modalTendidoData.colorNorm || modalTendidoData.color); } catch (e) { }

            // Crear nuevos tendidos si hay m?s valores que filas existentes
            if (pdsValues.length > tendidoRows.length) {
                // Usar la fila que el usuario clicke? (modalTendidoData.rowIndex) como fuente,
                // NO tendidoRows[0], ya que ese puede tener un estado_corte diferente (ej. OK)
                const clickedRowIdx = modalTendidoData.rowIndex;
                const sourceRowIdx = (clickedRowIdx && rawData[clickedRowIdx]) ? clickedRowIdx : tendidoRows[0];
                const sourceRow = rawData[sourceRowIdx];

                // Obtener el estado_corte de la fila clickeada para preservarlo en las nuevas filas
                const ecIdx = colMap["estado_corte"] ?? colMap["ESTADO_CORTE"] ?? colMap["STATUS_CORTE"] ?? colMap["STATUS"] ?? colMap["status"] ?? -1;
                const ecVal = (ecIdx !== -1 && sourceRow[ecIdx]) ? String(sourceRow[ecIdx]) : null;

                // Agregar nuevos tendidos AL FINAL de rawData
                // (coincide con el servidor que los a?ade al final del sheet)
                for (let i = tendidoRows.length; i < pdsValues.length; i++) {
                    const pds = pdsValues[i];
                    const tendidoNum = String(i + 1).padStart(2, '0');
                    const tendido = `${corte}${tendidoNum}`;

                    const newRow = [...sourceRow];
                    newRow[corteIdx] = tendido;
                    newRow[pdsIdx] = pds;
                    try { newRow._inserted = Date.now(); } catch (e) { }

                    rawData.push(newRow);

                    const dupPayload = {
                        action: "duplicateRow",
                        sourceRow: sourceRowIdx,
                        sourceOp: String(getVal(sourceRow, 'OP') || '').trim(),
                        sourceCorte: String(getVal(sourceRow, 'CORTE') || '').trim(),
                        sourceOpTela: String(getVal(sourceRow, 'OP TELA') || '').trim(),
                        sourcePartida: String(getVal(sourceRow, 'PARTIDA') || '').trim(),
                        sourceColor: String(getVal(sourceRow, 'COLOR') || '').trim(),
                        newCorte: tendido,
                        newPds: pds
                    };
                    // Siempre enviar estadoCorte para forzar el valor correcto en la nueva fila
                    if (ecIdx !== -1) dupPayload.estadoCorte = ecVal || '';

                    window.PcpProgramaService.duplicarFila(dupPayload, { noCors: true, headers: {} }).catch(e => console.error(`Error creando tendido ${i + 1}`, e));

                    alertMsg += `\n? ${tendido} con ${formatThousands(pds, 0)} PDS`;
                }
            }

        } catch (e) {
            console.error('Error guardando cambios de tendidos:', e);
            alert('Error al guardar los cambios.');
            return;
        }

        // Cerrar modal y re-renderizar
        cerrarModalTendido();
        updateCounters();
        renderCorte();
        scheduleSheetResync(900);

        alert(alertMsg);
    };

    // ===============================
    // MENU CONTEXTUAL OC (CLICK DERECHO) Y MODAL CAMBIO EQUIPO_CORTE
    // ===============================
    window.showCorteOcContextMenu = function (event, rowIndex) {
        try {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            const viewCorte = document.getElementById('view-corte');
            const corteFilterNorm = String(currentCorteFilter || '').toUpperCase().trim();
            const isProgSubtab = (corteFilterNorm === 'PROG 1T' || corteFilterNorm === 'PROG 2T' || corteFilterNorm === 'PROG 3T');
            if (!viewCorte || !viewCorte.classList.contains('active') || !isProgSubtab || isHabilitadoView()) return false;
            if (!Number.isInteger(rowIndex) || rowIndex < 1 || !rawData || !rawData[rowIndex]) return false;

            const menu = document.getElementById('corte-oc-context-menu');
            if (!menu) return false;

            corteOcContextMenuRowIndex = rowIndex;
            menu.classList.add('active');

            const menuWidth = menu.offsetWidth || 240;
            const menuHeight = menu.offsetHeight || 44;
            const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
            const maxTop = Math.max(8, window.innerHeight - menuHeight - 8);
            const left = Math.min(Math.max(8, event.clientX), maxLeft);
            const top = Math.min(Math.max(8, event.clientY), maxTop);

            menu.style.left = left + 'px';
            menu.style.top = top + 'px';
        } catch (e) {
            console.error('Error showCorteOcContextMenu:', e);
        }
        return false;
    };

    window.hideCorteOcContextMenu = function () {
        const menu = document.getElementById('corte-oc-context-menu');
        if (menu) menu.classList.remove('active');
        corteOcContextMenuRowIndex = null;
    };

    window.abrirModalEquipoCorteOCDesdeMenu = function () {
        const rowIndex = corteOcContextMenuRowIndex;
        hideCorteOcContextMenu();
        if (!Number.isInteger(rowIndex) || rowIndex < 1) return;
        abrirModalEquipoCorteOC(rowIndex);
    };

    document.addEventListener('click', function (e) {
        const menu = document.getElementById('corte-oc-context-menu');
        if (menu && !menu.contains(e.target)) {
            hideCorteOcContextMenu();
        }
    });

    function getEquipoCorteColumnIndex() {
        let idx = findHeaderIndexCaseInsensitive('equipo_corte');
        if (idx === -1) idx = findHeaderIndexCaseInsensitive('EQUIPO CORTE');
        if (idx === -1) idx = findHeaderIndexCaseInsensitive('EQUIPO_CORTE');
        return idx;
    }

    function getEstadoCorteColumnIndex() {
        let idx = findHeaderIndexCaseInsensitive('estado_corte');
        if (idx === -1) idx = findHeaderIndexCaseInsensitive('STATUS_CORTE');
        if (idx === -1) idx = findHeaderIndexCaseInsensitive('STATUS');
        if (idx === -1) idx = findHeaderIndexCaseInsensitive('ESTADO CORTE');
        if (idx === -1) idx = findHeaderIndexCaseInsensitive('ESTADO_CORTE');
        return idx;
    }

    function getEstadoCorteValueForModalOC(rowIndex) {
        if (!rawData || !rawData[rowIndex]) return 'PROG 1T';
        const idxEstado = getEstadoCorteColumnIndex();
        let raw = '';
        if (idxEstado !== -1) raw = rawData[rowIndex][idxEstado];
        if (!raw) {
            raw = getVal(rawData[rowIndex], 'estado_corte') ||
                getVal(rawData[rowIndex], 'STATUS_CORTE') ||
                getVal(rawData[rowIndex], 'STATUS') ||
                getVal(rawData[rowIndex], 'ESTADO CORTE') ||
                getVal(rawData[rowIndex], 'ESTADO_CORTE') ||
                '';
        }
        const norm = String(raw || '').toUpperCase().trim();
        if (norm === 'PROG 1T' || norm === 'PROG 2T' || norm === 'PROG 3T') return norm;
        return 'PROG 1T';
    }

    function getVisibleCorteRowsSameOpPtda(rowIndex) {
        const out = [];
        if (!rawData || !rawData[rowIndex]) return out;

        const opTelaIdx = (colMap["OP TELA"] !== undefined) ? colMap["OP TELA"] : findHeaderIndexCaseInsensitive('OP TELA');
        const partidaIdx = (colMap["PARTIDA"] !== undefined) ? colMap["PARTIDA"] : findHeaderIndexCaseInsensitive('PARTIDA');
        if (opTelaIdx === -1 || partidaIdx === -1) return out;

        const baseOp = String(rawData[rowIndex][opTelaIdx] || '').trim().toLowerCase();
        const basePart = String(rawData[rowIndex][partidaIdx] || '').trim().toLowerCase();
        const key = baseOp + '-' + basePart;

        const tbody = document.getElementById('tbody-corte');
        if (!tbody) return out;

        const visibleRows = tbody.querySelectorAll('tr[data-row-index]');
        visibleRows.forEach(tr => {
            // Respetar solo filas visibles en la interaccion actual
            if (tr.offsetParent === null || getComputedStyle(tr).display === 'none') return;
            const idx = parseInt(tr.getAttribute('data-row-index'), 10);
            if (!Number.isInteger(idx) || idx < 1 || !rawData[idx]) return;
            const op = String(rawData[idx][opTelaIdx] || '').trim().toLowerCase();
            const part = String(rawData[idx][partidaIdx] || '').trim().toLowerCase();
            if ((op + '-' + part) === key) out.push(idx);
        });

        return out;
    }

    window.updateModalEquipoCorteOCInfo = function () {
        const info = document.getElementById('modal-corte-oc-equipo-info');
        const scopeSelect = document.getElementById('modal-corte-oc-equipo-scope');
        if (!info) return;

        const scope = String(scopeSelect && scopeSelect.value ? scopeSelect.value : (modalCorteOcEquipoData.scope || 'group')).trim().toLowerCase();
        modalCorteOcEquipoData.scope = (scope === 'single') ? 'single' : 'group';

        if (modalCorteOcEquipoData.scope === 'single') {
            info.innerText = 'El cambio se aplicara a esta unica fila visible en este subtab.';
        } else {
            info.innerText = 'El cambio se aplicara a todas las filas visibles del mismo OP-PTDA en este subtab.';
        }
    };

    window.abrirModalEquipoCorteOC = function (rowIndex) {
        try {
            const viewCorte = document.getElementById('view-corte');
            if (!viewCorte || !viewCorte.classList.contains('active')) return;
            const corteFilterNorm = String(currentCorteFilter || '').toUpperCase().trim();
            const isProgSubtab = (corteFilterNorm === 'PROG 1T' || corteFilterNorm === 'PROG 2T' || corteFilterNorm === 'PROG 3T');
            if (!isProgSubtab || isHabilitadoView()) return;
            if (!rawData || rowIndex < 1 || !rawData[rowIndex]) return;

            if (!Array.isArray(equiposCorteData) || equiposCorteData.length === 0) {
                try { cargarEquiposCorteBackground(); } catch (e) { }
            }

            const row = rawData[rowIndex];
            const opTela = String(getVal(row, 'OP TELA') || '').trim();
            const partida = String(getVal(row, 'PARTIDA') || '').trim();
            const opPtda = `${opTela}-${partida}`;
            const rowIndices = getVisibleCorteRowsSameOpPtda(rowIndex);
            if (!rowIndices.length) rowIndices.push(rowIndex);

            const idxEquipo = getEquipoCorteColumnIndex();
            const equipoValues = new Set();
            rowIndices.forEach(idx => {
                if (idxEquipo !== -1 && rawData[idx]) {
                    const ev = String(rawData[idx][idxEquipo] || '').trim();
                    if (ev) equipoValues.add(ev);
                }
            });
            const singleEquipo = (equipoValues.size === 1) ? Array.from(equipoValues)[0] : '';

            modalCorteOcEquipoData = {
                rowIndices: rowIndices,
                opPtda: opPtda,
                targetRowIndex: rowIndex,
                scope: 'group',
                turno: 'PROG 1T'
            };

            const subtitle = document.getElementById('modal-corte-oc-equipo-subtitle');
            if (subtitle) subtitle.innerText = `OP-PTDA: ${opPtda || '-'} | Filas visibles: ${rowIndices.length}`;

            const scopeSel = document.getElementById('modal-corte-oc-equipo-scope');
            if (scopeSel) {
                scopeSel.value = 'group';
            }

            const sel = document.getElementById('modal-corte-oc-equipo-select');
            if (sel) {
                let options = '<option value="">-- Seleccionar --</option>';
                const equipos = Array.isArray(equiposCorteData) ? equiposCorteData.slice() : [];
                equipos.sort((a, b) => (parseInt(a.eq, 10) || 999) - (parseInt(b.eq, 10) || 999));
                equipos.forEach(eq => {
                    const nombre = String(eq && eq.nombre ? eq.nombre : '').trim();
                    if (!nombre) return;
                    const safe = nombre.replace(/"/g, '&quot;');
                    options += `<option value="${safe}">${safe}</option>`;
                });
                if (singleEquipo && !equipos.some(e => String((e && e.nombre) || '').trim() === singleEquipo)) {
                    const safeSingle = singleEquipo.replace(/"/g, '&quot;');
                    options = `<option value="${safeSingle}">${safeSingle}</option>` + options;
                }
                sel.innerHTML = options;
                sel.value = singleEquipo || '';
            }

            const turnoSel = document.getElementById('modal-corte-oc-turno-select');
            if (turnoSel) {
                const turnoActual = getEstadoCorteValueForModalOC(rowIndex);
                turnoSel.value = turnoActual;
                modalCorteOcEquipoData.turno = turnoActual;
            }

            updateModalEquipoCorteOCInfo();

            const modal = document.getElementById('modal-corte-oc-equipo');
            if (modal) modal.classList.add('active');
        } catch (e) {
            console.error('Error abrirModalEquipoCorteOC:', e);
        }
    };

    window.cerrarModalEquipoCorteOC = function () {
        const modal = document.getElementById('modal-corte-oc-equipo');
        if (modal) modal.classList.remove('active');
        modalCorteOcEquipoData = { rowIndices: [], opPtda: '', targetRowIndex: null, scope: 'group', turno: 'PROG 1T' };
    };

    window.guardarModalEquipoCorteOC = function () {
        try {
            const sel = document.getElementById('modal-corte-oc-equipo-select');
            const value = String(sel && sel.value ? sel.value : '').trim();
            if (!value) {
                alert('Seleccione un equipo_corte.');
                return;
            }

            const turnoSel = document.getElementById('modal-corte-oc-turno-select');
            const turnoValue = String(turnoSel && turnoSel.value ? turnoSel.value : '').trim().toUpperCase();
            if (turnoValue !== 'PROG 1T' && turnoValue !== 'PROG 2T' && turnoValue !== 'PROG 3T') {
                alert('Seleccione un turno valido.');
                return;
            }
            modalCorteOcEquipoData.turno = turnoValue;

            const scopeSel = document.getElementById('modal-corte-oc-equipo-scope');
            const scope = String(scopeSel && scopeSel.value ? scopeSel.value : (modalCorteOcEquipoData.scope || 'group')).trim().toLowerCase();
            modalCorteOcEquipoData.scope = (scope === 'single') ? 'single' : 'group';

            const rows = (modalCorteOcEquipoData.scope === 'single')
                ? [modalCorteOcEquipoData.targetRowIndex]
                : ((modalCorteOcEquipoData && Array.isArray(modalCorteOcEquipoData.rowIndices))
                    ? modalCorteOcEquipoData.rowIndices.slice()
                    : []);
            if (!rows.length) {
                cerrarModalEquipoCorteOC();
                return;
            }

            const idxEquipo = getEquipoCorteColumnIndex();
            if (idxEquipo === -1) {
                alert('No se encontro la columna equipo_corte en la hoja.');
                return;
            }

            const idxEstado = getEstadoCorteColumnIndex();
            if (idxEstado === -1) {
                alert('No se encontro la columna estado_corte en la hoja.');
                return;
            }

            const sendColName = (rawData[0] && rawData[0][idxEquipo]) ? rawData[0][idxEquipo] : 'equipo_corte';
            const sendEstadoColName = (rawData[0] && rawData[0][idxEstado]) ? rawData[0][idxEstado] : 'estado_corte';
            const changedRows = [];
            rows.forEach(idx => {
                if (!Number.isInteger(idx) || idx < 1 || !rawData[idx]) return;
                const prevEquipo = String(rawData[idx][idxEquipo] || '').trim();
                const prevTurno = String(rawData[idx][idxEstado] || '').trim().toUpperCase();
                const rowInfo = { idx: idx, equipoChanged: false, turnoChanged: false };
                if (prevEquipo !== value) {
                    rawData[idx][idxEquipo] = value;
                    rowInfo.equipoChanged = true;
                }
                if (prevTurno !== turnoValue) {
                    rawData[idx][idxEstado] = turnoValue;
                    rowInfo.turnoChanged = true;
                }
                if (typeof pendingProgramarCorte !== 'undefined' && pendingProgramarCorte[idx]) {
                    pendingProgramarCorte[idx].equipo_corte = value;
                    if (turnoValue) pendingProgramarCorte[idx].status_corte = turnoValue;
                }
                if (rowInfo.equipoChanged || rowInfo.turnoChanged) changedRows.push(rowInfo);
            });

            cerrarModalEquipoCorteOC();
            renderCorte();

            changedRows.forEach((item, i) => {
                setTimeout(() => {
                    if (item.equipoChanged) {
                        window.PcpProgramaService.actualizarCampo(item.idx, sendColName, value, { noCors: true, headers: {} }).catch(e => console.error('Error guardando equipo_corte por OC', e));
                    }
                    if (item.turnoChanged) {
                        window.PcpProgramaService.actualizarCampo(item.idx, sendEstadoColName, turnoValue, { noCors: true, headers: {} }).catch(e => console.error('Error guardando estado_corte por OC', e));
                    }
                }, i * 120);
            });
        } catch (e) {
            console.error('Error guardarModalEquipoCorteOC:', e);
            alert('No se pudo guardar el equipo_corte.');
        }
    };

    // ===============================
    // FUNCIONES DEL MODAL EQ_CORTE
    // ===============================

    let equiposCorteData = [];

    window.abrirModalEQCorte = function () {
        // Cargar datos de la hoja EQ_Corte
        cargarEquiposCorte();
    };

    function cargarEquiposCorteBackground() {
        // Cargar equipos sin mostrar el modal (para uso en select)
        const script = document.createElement('script');
        script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:loadEQCorteCallback&sheet=EQ_Corte`;
        script.onerror = () => {
            console.error("Error cargando hoja EQ_Corte en background");
            // Datos por defecto en caso de error
            equiposCorteData = [{ eq: 1, nombre: "Mesa 1" }, { eq: 2, nombre: "Mesa 2" }];
        };
        document.body.appendChild(script);
    }

    function cargarEquiposCorte() {
        // Mostrar loading en modal
        document.getElementById('modal-eq-corte-tbody').innerHTML = '<tr><td colspan="2" style="text-align:center;padding:20px;">Cargando equipos...</td></tr>';
        document.getElementById('modal-eq-corte').classList.add('active');

        // Usar el mismo m?todo que funciona para los datos principales
        const script = document.createElement('script');
        script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:loadEQCorteCallback&sheet=EQ_Corte`;
        script.onerror = () => {
            console.error("Error cargando hoja EQ_Corte");
            // Datos por defecto en caso de error
            equiposCorteData = [
                { eq: 1, nombre: "Mesa 1" },
                { eq: 2, nombre: "Mesa 2" }
            ];
            renderModalEQCorte();
        };
        document.body.appendChild(script);
    }

    // Callback para recibir los datos de la hoja EQ_Corte
    window.loadEQCorteCallback = function (jsonResponse) {
        try {
            if (!jsonResponse || !jsonResponse.table) {
                throw new Error("Datos inv?lidos de EQ_Corte");
            }

            const rows = jsonResponse.table.rows;
            equiposCorteData = [];

            // Procesar las filas (saltar el header)
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (row && row.c && row.c.length >= 2) {
                    const eqValue = row.c[0] ? (row.c[0].v || row.c[0].f || "") : "";
                    const nombreValue = row.c[1] ? (row.c[1].v || row.c[1].f || "") : "";

                    // Solo agregar si tiene datos v?lidos
                    if (eqValue && nombreValue) {
                        equiposCorteData.push({
                            eq: parseInt(eqValue) || eqValue,
                            nombre: String(nombreValue)
                        });
                    }
                }
            }

            // Si no hay datos, usar valores por defecto
            if (equiposCorteData.length === 0) {
                equiposCorteData = [
                    { eq: 1, nombre: "Mesa 1" },
                    { eq: 2, nombre: "Mesa 2" }
                ];
            }

            renderModalEQCorte();

        } catch (error) {
            console.error("Error procesando datos EQ_Corte:", error);
            // Datos por defecto en caso de error
            equiposCorteData = [
                { eq: 1, nombre: "Mesa 1" },
                { eq: 2, nombre: "Mesa 2" }
            ];
            renderModalEQCorte();
        }
    };

    function renderModalEQCorte() {
        const tbody = document.getElementById('modal-eq-corte-tbody');
        let html = '';

        equiposCorteData.forEach((equipo, index) => {
            const isLast = (index === equiposCorteData.length - 1);
            const btnHTML = isLast ? '<button class="btn-tendido" onclick="agregarEquipoCorte()" style="margin-right: 6px;" title="Agregar equipo">+</button>' : '';
            html += `
                        <tr>
                            <td style="text-align: center; font-weight: 600;">${btnHTML}${equipo.eq}</td>
                            <td><input type="text" value="${equipo.nombre}" onchange="equiposCorteData[${index}].nombre = this.value" style="width: 100%; padding: 6px; border: 1px solid var(--gray-300); border-radius: 4px;"></td>
                        </tr>
                    `;
        });

        tbody.innerHTML = html;
    }

    window.agregarEquipoCorte = function () {
        // Calcular el siguiente n?mero EQ basado en los datos existentes
        let nextEQ = 1;
        if (equiposCorteData.length > 0) {
            const maxEQ = Math.max(...equiposCorteData.map(e => parseInt(e.eq) || 0));
            nextEQ = maxEQ + 1;
        }

        equiposCorteData.push({
            eq: nextEQ,
            nombre: `Equipo ${nextEQ}`
        });
        renderModalEQCorte();
    };

    window.cerrarModalEQCorte = function () {
        document.getElementById('modal-eq-corte').classList.remove('active');
    };

    window.guardarModalEQCorte = function () {
        // Validar que todos los nombres est?n completos
        const nombresVacios = equiposCorteData.some(e => !e.nombre || e.nombre.trim() === '');
        if (nombresVacios) {
            alert('Por favor complete todos los nombres de equipos.');
            return;
        }

        try {
            // Guardar datos actuales antes de cerrar
            const datosGuardados = JSON.parse(JSON.stringify(equiposCorteData));

            // Enviar cada equipo al backend
            equiposCorteData.forEach((equipo, index) => {
                window.PcpProgramaService.actualizarEquipoCorte(equipo.eq, equipo.nombre, index + 1, { noCors: true, headers: {} }).catch(e => console.error(`Error guardando equipo ${equipo.eq}`, e));
            });

            alert(`Se han guardado ${equiposCorteData.length} equipos de corte.`);
            cerrarModalEQCorte();

            // Actualizar la tabla inmediatamente con los datos guardados
            equiposCorteData = datosGuardados;

            // Si estamos en la vista Corte Pzas, actualizar la tabla
            if (document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active')) {
                renderCorte();
            }

            // Tambi?n recargar desde Google Sheets en background para mantener sincronizaci?n
            setTimeout(() => {
                cargarEquiposCorteBackground();
            }, 1000);

        } catch (e) {
            console.error('Error guardando equipos:', e);
            alert('Error al guardar los equipos.');
        }
    };

