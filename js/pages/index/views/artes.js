window.renderArtes = function () {
    if (window.currentArtesFilter === 'ASIGNAR') renderArtesAsignar();
    else if (window.currentArtesFilter === 'ESTAMPADO') renderArtesEstampado();
    else renderArtesBordado();
};

window.renderArtesBordado = function () {
    const tbody = document.getElementById('tbody-artes-bordado');
    if (!tbody) return; tbody.innerHTML = '';
    let lastOpPtda = null;
    let currentGroup = 'a'; // Para alternar sombreado de filas
    // actualizar badges de sub-tabs Bordado (sumar PDS en lugar de contar filas)
    let pdsX = 0, pdsProg = 0;
    const idxEv = findHeaderIndexCaseInsensitive('estado_enumerado');
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        let ev = '';
        try {
            if (idxEv !== -1 && row && row[idxEv] !== undefined) ev = row[idxEv];
            else ev = getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO ENUMERADO') || getVal(row, 'ESTADO_ENumerado') || '';
        } catch (e) { ev = getVal(row, 'estado_enumerado') || '' }
        const evNorm = (ev || '').toString().toUpperCase().trim();
        // Permitir tambien estado_enumerado vacio (manteniendo las demas condiciones)

        // estado_habilitado: ocultar filas en OK (incluye variantes como "OK S/DESTINO")
        const rawHabil = getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || getVal(row, 'ESTADO HABILITADO') || '';
        const habilNorm = (rawHabil || '').toString().toUpperCase().replace(/\s+/g, ' ').trim();
        if (/^OK(\s|$)/.test(habilNorm)) continue;

        // Filtrar por n.BDxpda: mostrar solo valores numericos y excluir vacios/NO LLEVA
        const rawNbd = getVal(row, 'n.BDxpda') || getVal(row, 'N.BDXPDA') || getVal(row, 'n.BDxpda ') || '';
        const nbdNorm = (rawNbd || '').toString().toUpperCase().trim();
        if (nbdNorm === '' || nbdNorm.indexOf('NO LLEVA') !== -1 || !/\d/.test(nbdNorm)) continue;

        // determinar estado_bordado normalizado (vac?o => 'X PROG')
        let rawEstadoB = getVal(row, 'estado_bordado') || '';
        let estadoBNorm = (rawEstadoB || '').toString().trim();
        if (estadoBNorm === '') estadoBNorm = 'X PROG';
        // contar PDS para badges (sumar PDS GIRADAS / PDS)
        const pdsVal = parseFloat(getVal(row, 'PDS') || getVal(row, 'PDS GIRADAS') || 0) || 0;
        if (estadoBNorm.toUpperCase().indexOf('PROG') !== -1 && estadoBNorm.toUpperCase() !== 'X PROG') pdsProg += pdsVal;
        else pdsX += pdsVal;

        // Aplicar filtro por sub-tab (X PROG / PROG)
        if (window.currentArtesBordadoFilter) {
            if (window.currentArtesBordadoFilter === 'PROG') {
                if (!(estadoBNorm.toUpperCase().indexOf('PROG') !== -1 && estadoBNorm.toUpperCase() !== 'X PROG')) continue;
            } else {
                // X PROG
                if (!(estadoBNorm.toUpperCase() === 'X PROG' || estadoBNorm === '')) continue;
            }
        }

        // Aplicar filtros de encabezado si existen (soporta m?ltiples - Bordado)
        const bordadoFilters = artesHeaderFilters && artesHeaderFilters.length > 0
            ? artesHeaderFilters
            : (artesHeaderFilter ? [artesHeaderFilter] : []);
        if (window.currentArtesFilter === 'BORDADO' && bordadoFilters.length > 0) {
            let matchesAll = true;
            for (let afi = 0; afi < bordadoFilters.length; afi++) {
                const currentAF = bordadoFilters[afi];
                if (!currentAF.field || currentAF.value === undefined || currentAF.value === null) continue;
                const f = currentAF.field;
                const v = String(currentAF.value).toUpperCase().trim();
                let cellValue = '';
                try {
                    if (f === 'HOD') {
                        cellValue = formatValue(getVal(row, 'HOD'), 'date') || '';
                    } else if (f === 'STATUS') {
                        cellValue = getHabilitadoStatusValue(row, evNorm) || '';
                    } else if (f === 'F.ING.COST') {
                        cellValue = formatValue(getVal(row, 'F.ING.COST'), 'date') || '';
                    } else if (f === 'CLIENTE') {
                        cellValue = normalizeClientName(getVal(row, 'CLIENTE')) || '';
                    } else if (f === 'OC') {
                        const op = String(getVal(row, 'OP') || '').trim();
                        const corte = String(getVal(row, 'CORTE') || '').trim();
                        cellValue = (op + '-' + corte) || '';
                    } else if (f === 'COLOR') {
                        cellValue = String(getVal(row, 'COLOR') || '') || '';
                    }
                    const cellValueUpper = String(cellValue).toUpperCase();
                    let matchesFilter = false;
                    if (v === '') {
                        matchesFilter = cellValueUpper === '';
                    } else {
                        matchesFilter = cellValueUpper.indexOf(v) !== -1;
                    }
                    if (!matchesFilter) { matchesAll = false; break; }
                } catch (e) { matchesAll = false; break; }
            }
            if (!matchesAll) continue;
        }

        const tr = document.createElement('tr');

        // HOD (formateada)
        const tdFDesp = document.createElement('td'); tdFDesp.className = 'date-cell';
        tdFDesp.innerText = formatValue(getVal(row, 'HOD') || getVal(row, 'F DESPACHO') || '', 'date');
        tr.appendChild(tdFDesp);

        // F.ING.COST - usar date picker si estamos en X PROG
        const tdFCost = document.createElement('td'); tdFCost.className = 'date-cell';
        if (window.currentArtesBordadoFilter === 'X PROG') {
            const rawFIngCost = getVal(row, 'F.ING.COST') || getVal(row, 'F ING COST') || '';
            const dateValue = convertToDateInputFormat(rawFIngCost);
            tdFCost.innerHTML = `<input type="date" class="short-year" value="${dateValue}" onchange="handleDateChange(this, ${i}, 'F.ING.COST')"><span class="date-yy">${formatDateShortFromInput(dateValue) || 'mm/dd/aaaa'}</span>`;
            // Inicializar evento onclick del span
            setTimeout(() => {
                const inputEl = tdFCost.querySelector('input.short-year');
                const spanEl = tdFCost.querySelector('span.date-yy');
                if (inputEl && spanEl) {
                    spanEl.onclick = function (e) {
                        e.stopPropagation();
                        inputEl.showPicker ? inputEl.showPicker() : inputEl.click();
                    };
                }
            }, 0);
        } else {
            tdFCost.innerText = formatValue(getVal(row, 'F.ING.COST') || getVal(row, 'F ING COST') || '', 'date');
        }
        tr.appendChild(tdFCost);

        // STATUS (igual que Habilitado)
        const statusValue = getHabilitadoStatusValue(row, evNorm);
        const tdStatus = document.createElement('td');
        tdStatus.style.textAlign = 'center';
        tdStatus.title = statusValue || '';
        const statusUpper = (statusValue || '').toString().toUpperCase();
        if (statusUpper.indexOf('X CORTAR') !== -1) {
            tdStatus.innerHTML = `<span class="pill pill-pda">${statusValue}</span>`;
        } else if (statusUpper.indexOf('PROC CORTE') !== -1) {
            tdStatus.innerHTML = `<span class="pill pill-pza">${statusValue}</span>`;
        } else if (statusUpper.indexOf('X PEDIR') !== -1) {
            tdStatus.innerHTML = `<span class="pill pill-xpedir">${statusValue}</span>`;
        } else if (statusUpper.indexOf('X ENM') !== -1) {
            tdStatus.innerHTML = `<span class="pill pill-pda">${statusValue}</span>`;
        } else if (statusUpper.indexOf('X HAB') !== -1) {
            tdStatus.innerHTML = `<span class="pill pill-ok-dark">${statusValue}</span>`;
        } else if (statusUpper.indexOf('X BLOQ') !== -1) {
            tdStatus.innerHTML = `<span class="pill pill-pda">${statusValue}</span>`;
        } else if (statusUpper.indexOf('X LAVAR') !== -1) {
            tdStatus.innerHTML = `<span class="pill pill-pda">${statusValue}</span>`;
        } else {
            tdStatus.innerText = statusValue || '';
        }
        tr.appendChild(tdStatus);

        // CLIENTE (normalizado)
        const tdCliente = document.createElement('td'); tdCliente.innerText = normalizeClientForTransfer(getVal(row, 'CLIENTE') || ''); tr.appendChild(tdCliente);

        // OC
        const tdOC = document.createElement('td');
        tdOC.className = 'op-cell oc-cell';
        let ocVal = getVal(row, 'OC') || '';
        if ((!ocVal || String(ocVal).trim() === '')) {
            const opVal = getVal(row, 'OP') || getVal(row, 'OP TELA') || getVal(row, 'OP-PTDA') || '';
            const corteVal = getVal(row, 'CORTE') || getVal(row, 'PARTIDA') || '';
            if (opVal && corteVal) ocVal = `${String(opVal).trim()}-${String(corteVal).trim()}`;
        }
        tdOC.innerText = ocVal; tr.appendChild(tdOC);

        // COLOR
        const tdColor = document.createElement('td'); tdColor.innerText = abbreviateHeather(getVal(row, 'COLOR') || ''); tr.appendChild(tdColor);

        // PDS
        const tdPds = document.createElement('td'); tdPds.style.textAlign = 'center'; tdPds.innerText = getVal(row, 'PDS') || getVal(row, 'PDS GIRADAS') || ''; tr.appendChild(tdPds);

        // PRENDA
        const tdPrenda = document.createElement('td'); tdPrenda.innerText = getVal(row, 'PRENDA') || ''; tr.appendChild(tdPrenda);

        // TIPO CERT.
        const tdTipo = document.createElement('td'); tdTipo.innerText = getVal(row, 'TIPO CERT.') || getVal(row, 'TIPO CERTIFICADO') || ''; tr.appendChild(tdTipo);

        // n.BDxpda (nuevo)
        const tdNbd = document.createElement('td');
        const valNbd = getVal(row, 'n.BDxpda') || '';
        tdNbd.innerText = valNbd;
        tr.appendChild(tdNbd);

        // tipo-bordado (dato desde sheet, no editable)
        const tdTipoBordado = document.createElement('td');
        tdTipoBordado.classList.add('col-bordado');
        tdTipoBordado.classList.add('col-bordado');
        const valTipoBordado = getVal(row, 'tipo-bordado') || getVal(row, 'TIPO-BORDADO') || getVal(row, 'tipo_bordado') || '';
        tdTipoBordado.innerText = valTipoBordado;
        tr.appendChild(tdTipoBordado);

        // estado_bordado -> select editable (X PROG / PROG)
        const tdEst = document.createElement('td');
        const selEst = document.createElement('select');
        selEst.className = 'table-select';
        selEst.innerHTML = `<option value="X PROG" ${estadoBNorm === 'X PROG' ? 'selected' : ''}>X PROG</option><option value="PROG" ${estadoBNorm.toUpperCase().indexOf('PROG') !== -1 && estadoBNorm.toUpperCase() !== 'X PROG' ? 'selected' : ''}>PROG</option>`;
        selEst.onchange = function () { updateRow(i, 'estado_bordado', this.value, this); setTimeout(() => { renderArtesBordado(); updateCounters(); }, 300); };
        tdEst.appendChild(selEst);
        tr.appendChild(tdEst);

        // Alternar sombreado por OP-PTDA
        const opTela = String(row[colMap["OP TELA"]] || "").trim();
        const partida = String(row[colMap["PARTIDA"]] || "").trim();
        const currentOpPtda = `${opTela}-${partida}`;
        if (lastOpPtda !== null && currentOpPtda !== lastOpPtda) {
            currentGroup = (currentGroup === 'a') ? 'b' : 'a';
        }
        lastOpPtda = currentOpPtda;
        tr.classList.add(`group-${currentGroup}`);

        tbody.appendChild(tr);
    }
    // actualizar badges de subtabs
    try { document.getElementById('artes-bordado-xprog-count').innerText = `[${formatThousands(pdsX, 0)}pds]`; } catch (e) { }
    try { document.getElementById('artes-bordado-prog-count').innerText = `[${formatThousands(pdsProg, 0)}pds]`; } catch (e) { }
    // actualizar badge del bot?n padre (suma de X PROG + PROG)
    try { document.getElementById('artes-pds-bordado').innerText = `[${formatThousands((pdsX || 0) + (pdsProg || 0), 0)}pds]`; } catch (e) { }

    // Inicializar eventos de los selectores de fecha
    initializeDateInputs();

    // Marcar columnas filtradas visualmente
    markFilteredColumns('view-artes', artesHeaderFilters.length > 0 ? artesHeaderFilters : (artesHeaderFilter ? [artesHeaderFilter] : []));
};

window.renderArtesEstampado = function () {
    const tbody = document.getElementById('tbody-artes-estampado');
    if (!tbody) return; tbody.innerHTML = '';

    // Recolectar ?ndices v?lidos seg?n las reglas previas
    let pdsX = 0, pdsProg = 0;
    const validIndices = [];
    const idxEv = findHeaderIndexCaseInsensitive('estado_enumerado');
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        let ev = '';
        try {
            if (idxEv !== -1 && row && row[idxEv] !== undefined) ev = row[idxEv];
            else ev = getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO ENUMERADO') || getVal(row, 'ESTADO_ENumerado') || '';
        } catch (e) { ev = getVal(row, 'estado_enumerado') || '' }
        const evNorm = (ev || '').toString().toUpperCase().trim();
        if (evNorm === '') continue; // estado_enumerado diferente de vac?o

        // estado_habilitado: ocultar filas en OK (incluye variantes como "OK S/DESTINO")
        const rawHabil = getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || getVal(row, 'ESTADO HABILITADO') || '';
        const habilNorm = (rawHabil || '').toString().toUpperCase().replace(/\s+/g, ' ').trim();
        if (/^OK(\s|$)/.test(habilNorm)) continue;

        const rawNest = getVal(row, 'n.ESTAMPxpda') || getVal(row, 'N.ESTAMPXPDA') || getVal(row, 'n.ESTAMP xpda') || getVal(row, 'n.ESTAMPxpda ') || '';
        const nestNorm = (rawNest || '').toString().toUpperCase().trim();
        // Mostrar solo cuando n.ESTAMPxpda tenga algun numero; ocultar vacios y NO LLEVA
        if (nestNorm === '' || nestNorm.indexOf('NO LLEVA') !== -1 || !/\d/.test(nestNorm)) continue;

        let rawEstado = getVal(row, 'estado_estampado') || '';
        let estadoNorm = (rawEstado || '').toString().trim();
        if (estadoNorm === '') estadoNorm = 'X PROG';
        const grupoKey = (estadoNorm.toUpperCase().indexOf('PROG') !== -1 && estadoNorm.toUpperCase() !== 'X PROG') ? 'PROG' : 'X PROG';

        const pdsVal = parseFloat(getVal(row, 'PDS') || getVal(row, 'PDS GIRADAS') || 0) || 0;
        if (grupoKey === 'X PROG') pdsX += pdsVal; else pdsProg += pdsVal;
        validIndices.push(i);
    }

    // ordenar por OP-PTDA para mantener consistencia visual
    let sorted = validIndices;
    try { sorted = sortBloqueoData(sorted); } catch (e) { /* ignore */ }

    // Renderizar lista plana seg?n sub-tab activo (no headers)
    let lastOpPtda = null;
    let currentGroupClass = 'a';
    sorted.forEach(i => {
        const row = rawData[i];
        let rawEstado = getVal(row, 'estado_estampado') || '';
        let estadoNorm = (rawEstado || '').toString().trim();
        if (estadoNorm === '') estadoNorm = 'X PROG';
        const grupoKey = (estadoNorm.toUpperCase().indexOf('PROG') !== -1 && estadoNorm.toUpperCase() !== 'X PROG') ? 'PROG' : 'X PROG';

        if (grupoKey !== window.currentArtesEstampadoFilter) return; // mostrar solo el sub-tab activo

        // Aplicar filtros de encabezado si existen (solo si estamos en Estampado)
        if (window.currentArtesFilter === 'ESTAMPADO') {
            const estampFilters = artesHeaderFilters.length > 0 ? artesHeaderFilters : (artesHeaderFilter ? [artesHeaderFilter] : []);
            if (estampFilters.length > 0) {
                let matchesAll = true;
                for (let fi = 0; fi < estampFilters.length; fi++) {
                    const f = estampFilters[fi].field;
                    const v = String(estampFilters[fi].value).toUpperCase().trim();
                    let cellValue = '';
                    try {
                        if (f === 'HOD') {
                            cellValue = formatValue(getVal(row, 'HOD'), 'date') || '';
                        } else if (f === 'F.ING.COST') {
                            cellValue = formatValue(getVal(row, 'F.ING.COST'), 'date') || '';
                        } else if (f === 'STATUS') {
                            let evForStatus = '';
                            try {
                                if (idxEv !== -1 && row && row[idxEv] !== undefined) evForStatus = row[idxEv];
                                else evForStatus = getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO ENUMERADO') || getVal(row, 'ESTADO_ENumerado') || '';
                            } catch (e) {
                                evForStatus = getVal(row, 'estado_enumerado') || '';
                            }
                            const evNormForStatus = (evForStatus || '').toString().toUpperCase().trim();
                            cellValue = getHabilitadoStatusValue(row, evNormForStatus) || '';
                        } else if (f === 'CLIENTE') {
                            cellValue = normalizeClientName(getVal(row, 'CLIENTE')) || '';
                        } else if (f === 'OC') {
                            const op = String(getVal(row, 'OP') || '').trim();
                            const corte = String(getVal(row, 'CORTE') || '').trim();
                            cellValue = (op + '-' + corte) || '';
                        } else if (f === 'COLOR') {
                            cellValue = String(getVal(row, 'COLOR') || '') || '';
                        }
                        const cellValueUpper = String(cellValue).toUpperCase();
                        let matchesFilter = false;
                        if (v === '') {
                            matchesFilter = cellValueUpper === '';
                        } else {
                            matchesFilter = cellValueUpper.indexOf(v) !== -1;
                        }
                        if (!matchesFilter) { matchesAll = false; break; }
                    } catch (e) { matchesAll = false; break; }
                }
                if (!matchesAll) return;
            }
        }

        const opTela = String(getVal(row, 'OP TELA') || '').trim();
        const partida = String(getVal(row, 'PARTIDA') || '').trim();
        const currentOpPtda = `${opTela}-${partida}`;
        if (lastOpPtda !== null && currentOpPtda !== lastOpPtda) {
            currentGroupClass = (currentGroupClass === 'a') ? 'b' : 'a';
        }
        lastOpPtda = currentOpPtda;

        const tr = document.createElement('tr');
        tr.className = `grupo-${currentGroupClass}`;

        // HOD
        const tdFDesp = document.createElement('td'); tdFDesp.className = 'date-cell'; tdFDesp.innerText = formatValue(getVal(row, 'HOD') || getVal(row, 'F DESPACHO') || '', 'date'); tr.appendChild(tdFDesp);
        // F.ING.COST - usar date picker si estamos en X PROG
        const tdFCost = document.createElement('td'); tdFCost.className = 'date-cell';
        if (window.currentArtesEstampadoFilter === 'X PROG') {
            const rawFIngCost = getVal(row, 'F.ING.COST') || getVal(row, 'F ING COST') || '';
            const dateValue = convertToDateInputFormat(rawFIngCost);
            tdFCost.innerHTML = `<input type="date" class="short-year" value="${dateValue}" onchange="handleDateChange(this, ${i}, 'F.ING.COST')"><span class="date-yy">${formatDateShortFromInput(dateValue) || 'mm/dd/aaaa'}</span>`;
            // Inicializar evento onclick del span
            setTimeout(() => {
                const inputEl = tdFCost.querySelector('input.short-year');
                const spanEl = tdFCost.querySelector('span.date-yy');
                if (inputEl && spanEl) {
                    spanEl.onclick = function (e) {
                        e.stopPropagation();
                        inputEl.showPicker ? inputEl.showPicker() : inputEl.click();
                    };
                }
            }, 0);
        } else {
            tdFCost.innerText = formatValue(getVal(row, 'F.ING.COST') || getVal(row, 'F ING COST') || '', 'date');
        }
        tr.appendChild(tdFCost);
        // CLIENTE
        const tdCliente = document.createElement('td'); tdCliente.innerText = normalizeClientForTransfer(getVal(row, 'CLIENTE') || ''); tr.appendChild(tdCliente);
        // OC
        const tdOC = document.createElement('td'); tdOC.className = 'op-cell oc-cell'; let ocVal = getVal(row, 'OC') || ''; if ((!ocVal || String(ocVal).trim() === '')) { const opVal = getVal(row, 'OP') || getVal(row, 'OP TELA') || getVal(row, 'OP-PTDA') || ''; const corteVal = getVal(row, 'CORTE') || getVal(row, 'PARTIDA') || ''; if (opVal && corteVal) ocVal = `${String(opVal).trim()}-${String(corteVal).trim()}`; } tdOC.innerText = ocVal; tr.appendChild(tdOC);
        // COLOR
        const tdColor = document.createElement('td'); tdColor.innerText = abbreviateHeather(getVal(row, 'COLOR') || ''); tr.appendChild(tdColor);
        // PDS
        const tdPds = document.createElement('td'); tdPds.style.textAlign = 'center'; tdPds.innerText = formatThousands(parseFloat(getVal(row, 'PDS') || getVal(row, 'PDS GIRADAS') || 0) || 0, 0); tr.appendChild(tdPds);
        // PRENDA
        const tdPrenda = document.createElement('td'); tdPrenda.innerText = getVal(row, 'PRENDA') || ''; tr.appendChild(tdPrenda);
        // TIPO CERT.
        const tdTipo = document.createElement('td'); tdTipo.innerText = getVal(row, 'TIPO CERT.') || getVal(row, 'TIPO CERTIFICADO') || ''; tr.appendChild(tdTipo);
        // n.ESTAMPxpda
        const tdNest = document.createElement('td'); const valNest = getVal(row, 'n.ESTAMPxpda') || getVal(row, 'N.ESTAMPXPDA') || getVal(row, 'n.ESTAMP xpda') || ''; tdNest.innerText = valNest; tr.appendChild(tdNest);

        // estado_estampado -> select editable (X PROG / PROG)
        const tdEst = document.createElement('td');
        const selEst = document.createElement('select'); selEst.className = 'table-select';
        selEst.innerHTML = `<option value="X PROG" ${estadoNorm === 'X PROG' ? 'selected' : ''}>X PROG</option><option value="PROG" ${estadoNorm.toUpperCase().indexOf('PROG') !== -1 && estadoNorm.toUpperCase() !== 'X PROG' ? 'selected' : ''}>PROG</option>`;
        selEst.onchange = function () { updateRow(i, 'estado_estampado', this.value, this); setTimeout(() => { renderArtesEstampado(); updateCounters(); }, 300); };
        tdEst.appendChild(selEst); tr.appendChild(tdEst);

        tbody.appendChild(tr);
    });

    // actualizar badges de subtabs Estampado
    try { document.getElementById('artes-estampado-xprog-count').innerText = `[${formatThousands(pdsX || 0, 0)}pds]`; } catch (e) { }
    try { document.getElementById('artes-estampado-prog-count').innerText = `[${formatThousands(pdsProg || 0, 0)}pds]`; } catch (e) { }
    // actualizar badge del bot?n padre (suma de X PROG + PROG)
    try { document.getElementById('artes-pds-estampado').innerText = `[${formatThousands((pdsX || 0) + (pdsProg || 0), 0)}pds]`; } catch (e) { }

    // Inicializar eventos de los selectores de fecha
    initializeDateInputs();

    // Marcar columnas filtradas visualmente
    markFilteredColumns('view-artes', artesHeaderFilters.length > 0 ? artesHeaderFilters : (artesHeaderFilter ? [artesHeaderFilter] : []));
};

window.renderArtesAsignar = function () {
    const tbody = document.getElementById('tbody-artes-asignar');
    if (!tbody) return; tbody.innerHTML = '';

    // Poblar select de cliente y multi-select de estilo
    const selectCliente = document.getElementById('filter-artes-cliente');
    const filterCliente = document.getElementById('filter-artes-cliente')?.value || '';
    const selectedEstilos = window.getArtesSelectedEstilos();
    const filterNone = selectedEstilos.has('__NONE__');

    if (selectCliente && selectCliente.options.length <= 1) {
        const clientes = new Set();
        for (let i = 1; i < rawData.length; i++) {
            const clienteRaw = getVal(rawData[i], 'CLIENTE');
            const clienteNorm = normalizeClientForTransfer(clienteRaw || '');
            if (clienteNorm) clientes.add(clienteNorm);
        }
        Array.from(clientes).sort().forEach(c => {
            const opt = document.createElement('option'); opt.value = c; opt.textContent = c; selectCliente.appendChild(opt);
        });
    }

    // Reconstruir la lista de estilos del multi-select seg?n el cliente seleccionado
    {
        const estilos = new Set();
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            const clienteRow = normalizeClientForTransfer(getVal(row, 'CLIENTE') || '');
            if (filterCliente && clienteRow !== filterCliente) continue;
            const estilo = getVal(row, 'ESTILO'); if (estilo) estilos.add(estilo);
        }
        populateArtesEstiloOptions(estilos);
    }

    // Agrupar por CLIENTE|ESTILO
    const grupo = new Map();
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const cliente = normalizeClientForTransfer(getVal(row, 'CLIENTE') || '');
        const estilo = getVal(row, 'ESTILO') || '';
        if (!estilo) continue;
        if (filterCliente && cliente !== filterCliente) continue;
        // Multi-select de estilos
        if (filterNone) continue;
        if (selectedEstilos.size > 0 && !selectedEstilos.has('__NONE__') && !selectedEstilos.has(estilo)) continue;
        const key = cliente + '|' + estilo;
        if (!grupo.has(key)) grupo.set(key, { cliente, estilo, rows: [] });
        grupo.get(key).rows.push(i);
    }

    Array.from(grupo.values()).sort((a, b) => (a.cliente || '').localeCompare(b.cliente) || (a.estilo || '').localeCompare(b.estilo)).forEach(g => {
        // calcular representativos para tipo-bordado, n.BDxpda y n.ESTAMPxpda
        function calcularRepresentativo(colName) {
            let idx = getColIndex(colName);
            if (idx === -1) {
                for (const k in colMap) { if (k.toString().toUpperCase().indexOf(colName.toUpperCase()) !== -1) { idx = colMap[k]; break; } }
            }

            const valores = [];
            const counts = {};
            let hasNoLleva = false;
            let emptyCount = 0;

            for (const rIdx of g.rows) {
                const rv = (idx !== -1 && idx !== undefined) ? rawData[rIdx][idx] : getVal(rawData[rIdx], colName);
                const v = (rv === undefined || rv === null) ? '' : String(rv).trim();

                if (v === '' || v.toUpperCase() === 'LLEVA?') {
                    emptyCount++;
                    continue;
                }

                if (v.toUpperCase() === 'NO LLEVA') {
                    hasNoLleva = true;
                    continue;
                }

                valores.push(v);
                const vNorm = v.toUpperCase();
                counts[vNorm] = (counts[vNorm] || 0) + 1;
            }

            // Si todas las filas est?n vac?as, retornar LLEVA?
            if (emptyCount === g.rows.length) return 'LLEVA?';

            // Si hay "NO LLEVA", priorizar
            if (hasNoLleva) return 'NO LLEVA';

            // Si no hay valores despu?s de filtrar vac?os y NO LLEVA
            if (valores.length === 0) return 'LLEVA?';

            // Verificar si son num?ricos para calcular promedio
            const numericos = valores.map(v => parseFloat(v)).filter(n => !isNaN(n));

            if (numericos.length > 0 && numericos.length === valores.length) {
                // Todos son num?ricos, calcular promedio y redondear
                const promedio = numericos.reduce((a, b) => a + b, 0) / numericos.length;
                const redondeado = Math.round(promedio);
                // Asegurar que est? en el rango 1-4
                if (redondeado >= 1 && redondeado <= 4) return String(redondeado);
                return String(redondeado);
            }

            // Si son textos, retornar el m?s frecuente
            let best = ''; let bestC = 0;
            for (const k in counts) {
                if (counts[k] > bestC) { best = k; bestC = counts[k]; }
            }
            return best || 'LLEVA?';
        }

        const normalizarTipoBordado = function (value) {
            const raw = String(value || '').trim();
            const norm = raw.toUpperCase().replace(/\s+/g, ' ').trim();
            if (!norm || norm === 'LLEVA?') return 'LLEVA?';
            if (norm.indexOf('NO LLEVA') !== -1) return 'NO LLEVA';
            if (norm.indexOf('EN PRENDA') !== -1) return 'En prenda';
            if (norm.indexOf('EN PIEZA') !== -1) return 'En pieza';
            return raw;
        };

        const repTipoBordado = normalizarTipoBordado(calcularRepresentativo('tipo-bordado'));
        const repBD = calcularRepresentativo('n.BDxpda');
        const repEST = calcularRepresentativo('n.ESTAMPxpda');
        const repTipoTransfer = calcularRepresentativo('tipo-transfer');
        const repNTransf = calcularRepresentativo('n.transfxpda');

        // aplicar filtro HayDato (CON/SIN) usando las 5 columnas de Asignar Artes
        const uiFilterHayDato = document.getElementById('filter-artes-haydato')?.value || '';
        const hasDatoAsignar = function (v) {
            const norm = String(v || '').trim().toUpperCase();
            return norm !== '' && norm !== 'LLEVA?';
        };
        const tipoHasDato = hasDatoAsignar(repTipoBordado);
        const bdHasDato = hasDatoAsignar(repBD);
        const estHasDato = hasDatoAsignar(repEST);
        const trfTipoHasDato = hasDatoAsignar(repTipoTransfer);
        const trfNHasDato = hasDatoAsignar(repNTransf);
        const allFiveWithData = tipoHasDato && bdHasDato && estHasDato && trfTipoHasDato && trfNHasDato;

        if (uiFilterHayDato === 'CON') {
            if (!allFiveWithData) return;
        } else if (uiFilterHayDato === 'SIN') {
            if (allFiveWithData) return;
        }

        const getGroupOps = function (rowIndices) {
            const ops = [];
            const seen = new Set();
            (rowIndices || []).forEach(rowIndex => {
                const opRaw = getVal(rawData[rowIndex], 'OP') || '';
                const op = String(opRaw).trim();
                if (!op) return;
                const key = op.toUpperCase();
                if (seen.has(key)) return;
                seen.add(key);
                ops.push(op);
            });
            return ops;
        };

        const tr = document.createElement('tr');
        const tdCliente = document.createElement('td'); tdCliente.textContent = normalizeClientForTransfer(g.cliente || ''); tr.appendChild(tdCliente);
        const tdEstilo = document.createElement('td'); tdEstilo.innerHTML = `<strong>${g.estilo}</strong>`; tr.appendChild(tdEstilo);

        // Agregar columna OP (mostrar todas las OP Ãºnicas del grupo)
        const tdOP = document.createElement('td');
        const ops = getGroupOps(g.rows);
        const opValue = ops.join(', ');
        tdOP.textContent = opValue;
        if (ops.length > 1) tdOP.title = opValue;
        tr.appendChild(tdOP);

        const tdTipoBordado = document.createElement('td');
        tdTipoBordado.classList.add('col-bordado');
        const selTipoB = document.createElement('select'); selTipoB.className = 'table-select sel-tipobord-artes';
        selTipoB.setAttribute('data-cliente', g.cliente); selTipoB.setAttribute('data-estilo', g.estilo);
        selTipoB.innerHTML = `<option value="LLEVA?">LLEVA?</option><option value="NO LLEVA">NO LLEVA</option><option value="En prenda">En prenda</option><option value="En pieza">En pieza</option>`;
        if (repTipoBordado && repTipoBordado !== '') {
            const existeTipo = Array.from(selTipoB.options).some(opt => opt.value.toUpperCase() === repTipoBordado.toUpperCase());
            if (existeTipo) {
                selTipoB.value = Array.from(selTipoB.options).find(opt => opt.value.toUpperCase() === repTipoBordado.toUpperCase()).value;
            } else {
                const newOptTipo = document.createElement('option');
                newOptTipo.value = repTipoBordado;
                newOptTipo.textContent = repTipoBordado;
                selTipoB.appendChild(newOptTipo);
                selTipoB.value = repTipoBordado;
            }
        } else {
            selTipoB.value = 'LLEVA?';
        }
        selTipoB.onchange = function () { updateClienteEstiloArtes(this.getAttribute('data-cliente'), this.getAttribute('data-estilo'), this.value, 'tipo-bordado', this); };
        tdTipoBordado.appendChild(selTipoB); tr.appendChild(tdTipoBordado);

        const tdBord = document.createElement('td');
        tdBord.classList.add('col-bordado');
        const selB = document.createElement('select'); selB.className = 'table-select sel-nbd-artes';
        selB.setAttribute('data-cliente', g.cliente); selB.setAttribute('data-estilo', g.estilo);
        selB.innerHTML = `<option value="LLEVA?">LLEVA?</option><option value="NO LLEVA">NO LLEVA</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>`;
        // Asignar valor representativo al select
        if (repBD && repBD !== '') {
            // Verificar si el valor existe como opci?n
            const existeOpcion = Array.from(selB.options).some(opt => opt.value.toUpperCase() === repBD.toUpperCase());
            if (existeOpcion) {
                selB.value = Array.from(selB.options).find(opt => opt.value.toUpperCase() === repBD.toUpperCase()).value;
            } else {
                // Agregar opci?n personalizada si no existe
                const newOpt = document.createElement('option');
                newOpt.value = repBD;
                newOpt.textContent = repBD;
                selB.appendChild(newOpt);
                selB.value = repBD;
            }
        } else {
            selB.value = 'LLEVA?';
        }
        selB.onchange = function () { handleNBDChange(this); };
        tdBord.appendChild(selB); tr.appendChild(tdBord);

        const tdEst = document.createElement('td');
        tdEst.classList.add('col-estampado');
        const selE = document.createElement('select'); selE.className = 'table-select sel-nest-artes';
        selE.setAttribute('data-cliente', g.cliente); selE.setAttribute('data-estilo', g.estilo);
        selE.innerHTML = `<option value="LLEVA?">LLEVA?</option><option value="NO LLEVA">NO LLEVA</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>`;
        // Asignar valor representativo al select
        if (repEST && repEST !== '') {
            // Verificar si el valor existe como opci?n
            const existeOpcionE = Array.from(selE.options).some(opt => opt.value.toUpperCase() === repEST.toUpperCase());
            if (existeOpcionE) {
                selE.value = Array.from(selE.options).find(opt => opt.value.toUpperCase() === repEST.toUpperCase()).value;
            } else {
                // Agregar opci?n personalizada si no existe
                const newOptE = document.createElement('option');
                newOptE.value = repEST;
                newOptE.textContent = repEST;
                selE.appendChild(newOptE);
                selE.value = repEST;
            }
        } else {
            selE.value = 'LLEVA?';
        }
        selE.onchange = function () { handleNESTChange(this); };
        tdEst.appendChild(selE); tr.appendChild(tdEst);

        const tdTipoTrf = document.createElement('td');
        tdTipoTrf.classList.add('col-transfer');
        const selTipoTrf = document.createElement('select'); selTipoTrf.className = 'table-select sel-tipo-transfer-artes';
        selTipoTrf.setAttribute('data-cliente', g.cliente); selTipoTrf.setAttribute('data-estilo', g.estilo);
        selTipoTrf.innerHTML = `<option value="LLEVA?">LLEVA?</option><option value="NO LLEVA">NO LLEVA</option><option value="En pieza">En pieza</option><option value="En prenda">En prenda</option>`;
        if (repTipoTransfer && repTipoTransfer !== '') {
            const existeTipoTrf = Array.from(selTipoTrf.options).some(opt => opt.value.toUpperCase() === repTipoTransfer.toUpperCase());
            if (existeTipoTrf) {
                selTipoTrf.value = Array.from(selTipoTrf.options).find(opt => opt.value.toUpperCase() === repTipoTransfer.toUpperCase()).value;
            } else {
                const newOptTipoTrf = document.createElement('option');
                newOptTipoTrf.value = repTipoTransfer;
                newOptTipoTrf.textContent = repTipoTransfer;
                selTipoTrf.appendChild(newOptTipoTrf);
                selTipoTrf.value = repTipoTransfer;
            }
        } else {
            selTipoTrf.value = 'LLEVA?';
        }
        selTipoTrf.onchange = function () {
            updateClienteEstiloArtes(this.getAttribute('data-cliente'), this.getAttribute('data-estilo'), this.value, 'tipo-transfer', this);
        };
        tdTipoTrf.appendChild(selTipoTrf); tr.appendChild(tdTipoTrf);

        const tdNTrf = document.createElement('td');
        tdNTrf.classList.add('col-transfer');
        const selNTrf = document.createElement('select'); selNTrf.className = 'table-select sel-ntransf-artes';
        selNTrf.setAttribute('data-cliente', g.cliente); selNTrf.setAttribute('data-estilo', g.estilo);
        selNTrf.innerHTML = `<option value="LLEVA?">LLEVA?</option><option value="NO LLEVA">NO LLEVA</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>`;
        if (repNTransf && repNTransf !== '') {
            const existeNTrf = Array.from(selNTrf.options).some(opt => opt.value.toUpperCase() === repNTransf.toUpperCase());
            if (existeNTrf) {
                selNTrf.value = Array.from(selNTrf.options).find(opt => opt.value.toUpperCase() === repNTransf.toUpperCase()).value;
            } else {
                const newOptNTrf = document.createElement('option');
                newOptNTrf.value = repNTransf;
                newOptNTrf.textContent = repNTransf;
                selNTrf.appendChild(newOptNTrf);
                selNTrf.value = repNTransf;
            }
        } else {
            selNTrf.value = 'LLEVA?';
        }
        selNTrf.onchange = function () {
            updateClienteEstiloArtes(this.getAttribute('data-cliente'), this.getAttribute('data-estilo'), this.value, 'n.transfxpda', this);
        };
        tdNTrf.appendChild(selNTrf); tr.appendChild(tdNTrf);

        tbody.appendChild(tr);
    });
};

