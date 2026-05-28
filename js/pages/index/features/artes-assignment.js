window.updateClienteEstiloArtes = function (cliente, estilo, value, colName, selectElement) {
    if (!cliente) return;
    // Si el estilo no provisto y no esta en modo 'para todo', no hacemos nada
    const paraTodo = !!document.getElementById('chk-artes-para-todo') && document.getElementById('chk-artes-para-todo').checked;
    if (!estilo && !paraTodo) return;

    // Mostrar modal de carga al inicio
    const modal = document.getElementById('modal-loading-artes');
    resetLoadingModalProgress();
    if (modal) modal.classList.add('active');

    // intentar encontrar indice de columna por nombre en colMap
    let idx = getColIndex(colName);
    if (idx === -1) {
        // intenta buscar en colMap por variantes
        for (const k in colMap) { if (k.toString().toUpperCase().indexOf(colName.toUpperCase()) !== -1) { idx = colMap[k]; break; } }
    }
    if (idx === -1 && typeof findHeaderIndexCaseInsensitive === 'function') {
        idx = findHeaderIndexCaseInsensitive(colName);
    }
    if (idx === -1 || idx === undefined) {
        // no se encontro columna; solo actualizar localmente (comparar clientes normalizados)
        const clienteNorm = normalizeClientForTransfer(cliente || '');
        for (let i = 1; i < rawData.length; i++) {
            const rCliente = normalizeClientForTransfer(getVal(rawData[i], 'CLIENTE') || '');
            const rEstilo = (getVal(rawData[i], 'ESTILO') || '').toString().trim();
            if (rCliente === clienteNorm && (paraTodo || rEstilo === estilo)) {
                rawData[i][idx] = value;
            }
        }
        alert('Actualizado localmente. Columna no identificada para guardar en servidor.');
        if (modal) modal.classList.remove('active');
        return;
    }

    // Recolectar filas a actualizar.
    // Si 'Para todo' esta activo -> aplicar a TODO lo filtrado por los selects actuales (cliente/estilo/haydato).
    // Si no -> aplicar a todas las filas del mismo estilo para el cliente.
    const rowsToUpdate = [];
    const clienteNorm = normalizeClientForTransfer(cliente || '');
    const uiFilterCliente = document.getElementById('filter-artes-cliente')?.value || '';
    const uiSelectedEstilos = window.getArtesSelectedEstilos();
    const uiFilterHayDato = document.getElementById('filter-artes-haydato')?.value || '';
    for (let i = 1; i < rawData.length; i++) {
        const rCliente = normalizeClientForTransfer(getVal(rawData[i], 'CLIENTE') || '');
        const rEstilo = (getVal(rawData[i], 'ESTILO') || '').toString().trim();
        if (rCliente !== clienteNorm) continue;

        if (paraTodo) {
            // respetar filtros UI: multi-select de estilos
            if (uiSelectedEstilos.has('__NONE__')) continue;
            if (uiSelectedEstilos.size > 0 && !uiSelectedEstilos.has(rEstilo)) continue;

            if (uiFilterHayDato === 'CON' || uiFilterHayDato === 'SIN') {
                const normTipo = String(getVal(rawData[i], 'tipo-bordado') || '').trim().toUpperCase();
                const normBD = String(getVal(rawData[i], 'n.BDxpda') || '').trim().toUpperCase();
                const normEST = String(getVal(rawData[i], 'n.ESTAMPxpda') || '').trim().toUpperCase();
                const normTipoTransfer = String(getVal(rawData[i], 'tipo-transfer') || getVal(rawData[i], 'tipo_transfer') || getVal(rawData[i], 'TIPO-TRANSFER') || '').trim().toUpperCase();
                const normNTransf = String(getVal(rawData[i], 'n.transfxpda') || getVal(rawData[i], 'N.TRANSFXPDA') || getVal(rawData[i], 'ntransfxpda') || '').trim().toUpperCase();
                const hasDatoAsignar = function (vNorm) {
                    return vNorm !== '' && vNorm !== 'LLEVA?';
                };
                const allFiveWithData = hasDatoAsignar(normTipo)
                    && hasDatoAsignar(normBD)
                    && hasDatoAsignar(normEST)
                    && hasDatoAsignar(normTipoTransfer)
                    && hasDatoAsignar(normNTransf);
                if (uiFilterHayDato === 'CON' && !allFiveWithData) continue;
                if (uiFilterHayDato === 'SIN' && allFiveWithData) continue;
            }

            rowsToUpdate.push(i);
        } else {
            // aplicar unicamente a filas con el mismo estilo
            if (rEstilo === estilo) rowsToUpdate.push(i);
        }
    }
    if (rowsToUpdate.length === 0) { alert('No se encontraron filas para actualizar'); if (modal) modal.classList.remove('active'); return; }

    if (selectElement) selectElement.disabled = true;
    // Actualizar localmente primero para respuesta inmediata
    rowsToUpdate.forEach(rowIndex => { rawData[rowIndex][idx] = value; });
    // Enviar peticiones con tracking de progreso
    let completedCount = 0;
    const totalCount = rowsToUpdate.length;
    const _startTime = Date.now();
    const promises = rowsToUpdate.map(rowIndex => {
        return window.PcpProgramaService.actualizarCampo(rowIndex, colName, value, { noCors: true }).then(() => {
            completedCount++;
            updateLoadingModalProgress(completedCount, totalCount, _startTime);
        }).catch(err => {
            console.error('Err saving row', rowIndex, err);
            completedCount++;
            updateLoadingModalProgress(completedCount, totalCount, _startTime);
        });
    });
    Promise.all(promises).then(() => {
        if (selectElement) selectElement.disabled = false;
        updateCounters();
        renderArtes();
        if (modal) modal.classList.remove('active');
    }).catch(() => {
        if (selectElement) selectElement.disabled = false;
        renderArtes();
        if (modal) modal.classList.remove('active');
    });
};

window.guardarCambiosAsignarArtes = function () { alert('Los cambios se guardan autom?ticamente al seleccionar un valor para cada estilo.'); };
