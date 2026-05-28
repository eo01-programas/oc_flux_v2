function renderHabilitado() {
    const tbody = document.getElementById('tbody-habilitado');
    if (!tbody) return;
    tbody.innerHTML = "";
    if (isHabilitadoIngresosMode) {
        renderHabilitadoIngresosView(tbody);
        updateHabilitadoHoja3BlockVisibility();
        return;
    }
    setHabilitadoHeaderForIngresosMode(false);
    updateHabilitadoIngresosControls();
    let count = 0;
    let lastOpPtda = null;
    let currentRowGroup = 'a'; // Para alternar sombreado de filas

    // Contadores de PDS por sub-tab
    let pdsXProg = 0, pds1T = 0, pds2T = 0, pds3T = 0, pdsSDestino = 0;
    let pdsXHabilitar = 0;

    // Recopilar ?ndices v?lidos seg?n el sub-tab seleccionado
    // Para "Por Programar" (X PROG): todas las filas con estado_habilitado vac?o o X PROG
    // Para PROG 1T/2T/3T: filas programadas en ese turno, incluso con estado_enumerado vacio
    const validIndices = [];
    const idxEv = findHeaderIndexCaseInsensitive('estado_enumerado');
    const idxHabil = findHeaderIndexCaseInsensitive('estado_habilitado');
    let idxValidacion = findHeaderIndexCaseInsensitive('VALIDACION');
    if (idxValidacion === -1) idxValidacion = findHeaderIndexCaseInsensitive('VALIDA');

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        let ev = '';
        try {
            if (idxEv !== -1 && rawData[i] && rawData[i][idxEv] !== undefined) ev = rawData[i][idxEv];
            else ev = getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO_ENumerado') || getVal(row, 'ESTADO ENUMERADO') || '';
        } catch (e) { ev = getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO_ENumerado') || getVal(row, 'ESTADO ENUMERADO') || ''; }

        const evNorm = (ev || '').toString().toUpperCase().trim();

        // Obtener estado_habilitado para determinar inclusi?n
        let habilVal = '';
        if (idxHabil !== -1 && row[idxHabil] !== undefined) habilVal = row[idxHabil];
        else habilVal = getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || '';
        const habilNorm = (habilVal || '').toString().toUpperCase().trim();

        // Si VALIDA esta marcado, no debe sumar en los totales PDS de Habilitado.
        const validaMarcado = isHabilitadoValidacionMarcada(row);

        // Calcular PDS por sub-tab para los badges (SIEMPRE, independiente del filtro activo)
        const pdsVal = parseFloat(getVal(row, 'PDS GIRADAS')) || 0;
        // xHabilitar: suma de PDS GIRADAS donde
        // estado_enumerado = OK ENM | OK S/ENM | OK PAQUETEO
        // y estado_habilitado != OK | OK S/DESTINO | DEPURADO
        const esEnumOk = (evNorm === 'OK ENM' || evNorm === 'OK S/ENM' || evNorm === 'OK PAQUETEO');
        const esHabPendiente = (habilNorm !== 'OK' && habilNorm !== 'OK S/DESTINO' && habilNorm !== 'DEPURADO');
        if (esEnumOk && esHabPendiente) {
            pdsXHabilitar += pdsVal;
        }
        if (!validaMarcado) {
            if (habilNorm === '' || habilNorm === 'X PROG') {
                pdsXProg += pdsVal;
            } else if (habilNorm === 'PROG 1T') {
                pds1T += pdsVal;
            } else if (habilNorm === 'PROG 2T') {
                pds2T += pdsVal;
            } else if (habilNorm === 'PROG 3T') {
                pds3T += pdsVal;
            }
        }

        // Contar S/DESTINO: PLANTA = S/DESTINO y estado_habilitado != OK, o estado_habilitado = OK S/DESTINO
        const plantaCheck = (getVal(row, 'PLANTA') || '').toString().toUpperCase().trim();
        if (!validaMarcado && ((plantaCheck === 'S/DESTINO' && habilNorm !== 'OK') || habilNorm === 'OK S/DESTINO')) {
            pdsSDestino += pdsVal;
        }

        // Filtrar filas para el sub-tab activo
        if (currentHabilitadoFilter === 'X PROG') {
            if (habilNorm === '' || habilNorm === 'X PROG') {
                validIndices.push(i);
            }
        } else if (currentHabilitadoFilter === 'S/DESTINO') {
            // S/DESTINO: PLANTA = S/DESTINO y estado_habilitado != OK, o estado_habilitado = OK S/DESTINO
            if ((plantaCheck === 'S/DESTINO' && habilNorm !== 'OK') || habilNorm === 'OK S/DESTINO') {
                validIndices.push(i);
            }
        } else {
            // Para PROG 1T/2T/3T: filtrar solo por estado_habilitado
            if (habilNorm === currentHabilitadoFilter) {
                validIndices.push(i);
            }
        }
    }

    // Helper: clave de orden por OC (usa OC; fallback OP-CORTE; fallback OP TELA-PARTIDA)
    const getOcSortKey = (row) => {
        const ocDirecto = String(getVal(row, 'OC') || '').trim();
        if (ocDirecto) return ocDirecto.toLowerCase();
        const op = String(getVal(row, 'OP') || '').trim();
        const corte = String(getVal(row, 'CORTE') || '').trim();
        if (op || corte) return `${op}-${corte}`.toLowerCase();
        const opTela = String(getVal(row, 'OP TELA') || '').trim();
        const partida = String(getVal(row, 'PARTIDA') || '').trim();
        return `${opTela}-${partida}`.toLowerCase();
    };

    // Orden de prioridad para columna P en Habilitado:
    // 1) D primero, 2) nÃºmeros asc, 3) vacÃ­o/otros al final.
    const getPrioridadSortMeta = (raw) => {
        const v = String(raw || '').trim().toUpperCase();
        if (v === 'D') return { bucket: 0, num: 0, text: '' };
        if (/^\d+$/.test(v)) return { bucket: 1, num: parseInt(v, 10), text: '' };
        if (v === '') return { bucket: 3, num: Number.POSITIVE_INFINITY, text: '' };
        return { bucket: 2, num: Number.POSITIVE_INFINITY, text: v };
    };
    const comparePrioridadHabilitado = (rawA, rawB) => {
        const aMeta = getPrioridadSortMeta(rawA);
        const bMeta = getPrioridadSortMeta(rawB);
        if (aMeta.bucket !== bMeta.bucket) return aMeta.bucket - bMeta.bucket;
        if (aMeta.num !== bMeta.num) return aMeta.num - bMeta.num;
        return aMeta.text.localeCompare(bMeta.text, undefined, { sensitivity: 'base' });
    };

    // Ordenar ?ndices v?lidos: OC, luego OP TELA+PARTIDA, luego P y HOD
    validIndices.sort((a, b) => {
        const rowA = rawData[a];
        const rowB = rawData[b];

        // 1. Ordenar por OC
        const ocA = getOcSortKey(rowA);
        const ocB = getOcSortKey(rowB);
        const cmpOc = ocA.localeCompare(ocB, undefined, { numeric: true, sensitivity: 'base' });
        if (cmpOc !== 0) return cmpOc;

        // 2. Luego agrupar por OP TELA + PARTIDA
        const opTelaA = String(rowA[colMap["OP TELA"]] || "").trim();
        const partidaA = String(rowA[colMap["PARTIDA"]] || "").trim();
        const opPtdaA = (opTelaA + "-" + partidaA).toLowerCase();

        const opTelaB = String(rowB[colMap["OP TELA"]] || "").trim();
        const partidaB = String(rowB[colMap["PARTIDA"]] || "").trim();
        const opPtdaB = (opTelaB + "-" + partidaB).toLowerCase();

        const cmpOpPtda = opPtdaA.localeCompare(opPtdaB, undefined, { numeric: true, sensitivity: 'base' });
        if (cmpOpPtda !== 0) return cmpOpPtda;

        // 3. Dentro del mismo grupo, ordenar por columna P
        const idxP = findPriorityHeaderIndex('habilitado');
        let pA = '';
        let pB = '';
        if (idxP !== -1) {
            pA = String(rowA[idxP] || '').trim();
            pB = String(rowB[idxP] || '').trim();
        }
        const cmpP = comparePrioridadHabilitado(pA, pB);
        if (cmpP !== 0) return cmpP;

        // 4. Luego por fecha de despacho (m?s reciente primero)
        const dateA = rowA[colMap["HOD"]] || 0;
        const dateB = rowB[colMap["HOD"]] || 0;
        return dateB - dateA;
    });

    // Funci?n auxiliar para extraer el valor TRSF de una fila (para agrupamiento)
    const getTrsfGroupValue = (row) => {
        const tipoTransfer = getVal(row, 'tipo-transfer') || getVal(row, 'TIPO-TRANSFER') || getVal(row, 'tipo_transfer') || '';
        const rawNTrans = getVal(row, 'n.transfxpda') || getVal(row, 'N.TRANSFXPDA') || getVal(row, 'n_transfxpda') || '';
        const tipoTransNorm = (tipoTransfer || '').toString().toUpperCase().trim();
        const nTransNorm = (rawNTrans !== undefined && rawNTrans !== null) ? String(rawNTrans).trim() : '';

        // Retornar 'Pza' si el valor contiene "EN PIEZA", 'Otros' para el resto
        if (tipoTransNorm === 'EN PIEZA' && !isNaN(parseInt(nTransNorm)) && nTransNorm !== '') {
            return 'Pza';
        }
        return 'Otros';
    };

    // Verificar si estamos en un sub-tab PROG (1T/2T/3T)
    const isProgSubtab = (currentHabilitadoFilter === 'PROG 1T' || currentHabilitadoFilter === 'PROG 2T' || currentHabilitadoFilter === 'PROG 3T');

    // En PROG 1T/2T/3T, ordenar tambi?n por TRSF (Pza primero, luego Otros), luego OP TELA+PARTIDA
    if (isProgSubtab) {
        validIndices.sort((a, b) => {
            const rowA = rawData[a];
            const rowB = rawData[b];

            // 1. Ordenar por TRSF group (Pza primero)
            const groupA = getTrsfGroupValue(rowA);
            const groupB = getTrsfGroupValue(rowB);
            if (groupA !== groupB) {
                const orderA = groupA === 'Pza' ? 0 : 1;
                const orderB = groupB === 'Pza' ? 0 : 1;
                return orderA - orderB;
            }

            // 2. Dentro del mismo grupo, ordenar por P
            const idxP = findPriorityHeaderIndex('habilitado');
            let pA = '';
            let pB = '';
            if (idxP !== -1) {
                pA = String(rowA[idxP] || '').trim();
                pB = String(rowB[idxP] || '').trim();
            }
            const cmpP = comparePrioridadHabilitado(pA, pB);
            if (cmpP !== 0) return cmpP;

            // 3. Luego por OC
            const ocA = getOcSortKey(rowA);
            const ocB = getOcSortKey(rowB);
            const cmpOc = ocA.localeCompare(ocB, undefined, { numeric: true, sensitivity: 'base' });
            if (cmpOc !== 0) return cmpOc;

            // 4. Agrupar por OP TELA + PARTIDA
            const opTelaA = String(rowA[colMap["OP TELA"]] || "").trim();
            const partidaA = String(rowA[colMap["PARTIDA"]] || "").trim();
            const opPtdaA = (opTelaA + "-" + partidaA).toLowerCase();
            const opTelaB = String(rowB[colMap["OP TELA"]] || "").trim();
            const partidaB = String(rowB[colMap["PARTIDA"]] || "").trim();
            const opPtdaB = (opTelaB + "-" + partidaB).toLowerCase();
            const cmpOpPtda = opPtdaA.localeCompare(opPtdaB, undefined, { numeric: true, sensitivity: 'base' });
            if (cmpOpPtda !== 0) return cmpOpPtda;

            // 5. Luego por fecha
            const dateA = rowA[colMap["HOD"]] || 0;
            const dateB = rowB[colMap["HOD"]] || 0;
            return dateB - dateA;
        });
    }

    // Procesar filas ordenadas
    let lastTrsfGroup = null;

    validIndices.forEach(i => {
        const row = rawData[i];
        let ev = '';
        try {
            if (idxEv !== -1 && rawData[i] && rawData[i][idxEv] !== undefined) ev = rawData[i][idxEv];
            else ev = getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO_ENumerado') || getVal(row, 'ESTADO ENUMERADO') || '';
        } catch (e) { ev = getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO_ENumerado') || getVal(row, 'ESTADO ENUMERADO') || ''; }

        const evNorm = (ev || '').toString().toUpperCase().trim();

        // Obtener estado_habilitado para filtrar por sub-tab
        const habilValFilter = getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || '';
        const habilValNormFilter = (habilValFilter || '').toString().toUpperCase().trim();

        // Ya se filtr? en validIndices para todos los subtabs de Habilitado.

        // Filtrar seg?n el sub-tab seleccionado
        if (currentHabilitadoFilter === 'X PROG') {
            if (habilValNormFilter !== '' && habilValNormFilter !== 'X PROG') return;
        } else if (currentHabilitadoFilter === 'S/DESTINO') {
            const plantaFilt = (getVal(row, 'PLANTA') || '').toString().toUpperCase().trim();
            if ((plantaFilt !== 'S/DESTINO' || habilValNormFilter === 'OK') && habilValNormFilter !== 'OK S/DESTINO') return;
        } else if (currentHabilitadoFilter === 'PROG 1T') {
            if (habilValNormFilter !== 'PROG 1T') return;
        } else if (currentHabilitadoFilter === 'PROG 2T') {
            if (habilValNormFilter !== 'PROG 2T') return;
        } else if (currentHabilitadoFilter === 'PROG 3T') {
            if (habilValNormFilter !== 'PROG 3T') return;
        }

        // Aplicar filtros de encabezado si est?n configurados (soporta m?ltiples)
        const habFiltersToApply = habilitadoHeaderFilters && habilitadoHeaderFilters.length > 0
            ? habilitadoHeaderFilters
            : (habilitadoHeaderFilter ? [habilitadoHeaderFilter] : []);
        if (habFiltersToApply.length > 0) {
            for (let hfi = 0; hfi < habFiltersToApply.length; hfi++) {
                const currentHF = habFiltersToApply[hfi];
                let fieldValue = '';

                switch (currentHF.field) {
                    case 'P':
                        fieldValue = getPriorityValueFromRow(row, 'habilitado').toString().trim().toUpperCase();
                        break;
                    case 'HOD':
                        fieldValue = (formatValue(getVal(row, 'HOD'), 'date') || '').toString().trim().toUpperCase();
                        break;
                    case 'F.ING.COST':
                        const rawFIng = getVal(row, 'F.ING.COST');
                        const dateValue = convertToDateInputFormat(rawFIng);
                        fieldValue = (formatDateShortFromInput(dateValue) || '').toString().trim().toUpperCase();
                        break;
                    case 'STATUS':
                        fieldValue = (getHabilitadoStatusValue(row, evNorm) || '').toString().trim().toUpperCase();
                        break;
                    case 'H':
                        fieldValue = isHabilitadoHMarcada(row) ? 'TRUE' : 'FALSE';
                        break;
                    case 'CLIENTE':
                        fieldValue = (normalizeClientName(getVal(row, 'CLIENTE')) || '').toString().trim().toUpperCase();
                        break;
                    case 'CLI':
                        fieldValue = (normalizeClientName(getVal(row, 'CLIENTE')) || '').toString().trim().toUpperCase();
                        break;
                    case 'F.ING':
                        const rawFIngH = getVal(row, 'F.ING.COST');
                        fieldValue = (getHabilitadoDayMonthLabel(rawFIngH) || '').toString().trim().toUpperCase();
                        break;
                    case 'F.HAB':
                        fieldValue = (getHabilitadoFHabDateKey(getRawFIngRealFromRow(row)) || '').toString().trim().toUpperCase();
                        break;
                    case 'OP-PTDA':
                        const opTela = getVal(row, 'OP TELA') || getVal(row, 'OP') || '';
                        const partida = getVal(row, 'PARTIDA') || getVal(row, 'CORTE') || '';
                        fieldValue = `${opTela}-${partida}`.toUpperCase();
                        break;
                    case 'OC':
                        const opVal = getVal(row, 'OP') || '';
                        const corteVal = getVal(row, 'CORTE') || '';
                        fieldValue = `${opVal}-${corteVal}`.toUpperCase();
                        break;
                    case 'COLOR':
                        fieldValue = (getVal(row, 'COLOR') || '').toString().trim().toUpperCase();
                        break;
                    case 'PLANTA':
                        fieldValue = (getVal(row, 'PLANTA') || '').toString().trim().toUpperCase();
                        if (fieldValue === '') fieldValue = 'XASIG';
                        break;
                    case 'LINEA':
                        fieldValue = (getVal(row, 'LINEA') || '').toString().trim().toUpperCase();
                        if (fieldValue === '') fieldValue = 'XASIG';
                        break;
                }

                // Si el valor no contiene el filtro, saltarlo
                const filterValue = (currentHF.value || '').trim().toUpperCase();
                if (!matchesHabilitadoFilterValue(currentHF.field, fieldValue, filterValue)) return;
            }
        }

        // Si estamos en PROG 1T/2T/3T, agrupar por TRSF
        if (isProgSubtab) {
            const currentTrsfGroup = getTrsfGroupValue(row);

            // Si cambia el grupo de TRSF, insertar fila de encabezado
            if (currentTrsfGroup !== lastTrsfGroup) {
                const headerRow = document.createElement('tr');
                headerRow.style.backgroundColor = '#FFE699';
                headerRow.style.color = '#1e40af';
                headerRow.style.fontWeight = '700';
                headerRow.style.fontSize = '13px';

                // Calcular colspan: 18 columnas en Habilitado (incluye OBSERVACIONES, VALIDACION, H, F.HAB, PLANTA y LINEA)
                const colspan = '18';

                // Calcular suma de PDS y transferencias para este grupo de TRSF
                let pdsTrsf = 0;
                let transferTrsf = 0;
                try {
                    validIndices.forEach((idx2) => {
                        try {
                            const r = rawData[idx2];
                            const habilVal2 = getVal(r, 'estado_habilitado') || '';
                            const habilNorm2 = (habilVal2 || '').toString().toUpperCase().trim();

                            // Filtrar seg?n el sub-tab actual
                            let matchesFilter = false;
                            if (currentHabilitadoFilter === 'PROG 1T' && habilNorm2 === 'PROG 1T') matchesFilter = true;
                            else if (currentHabilitadoFilter === 'PROG 2T' && habilNorm2 === 'PROG 2T') matchesFilter = true;
                            else if (currentHabilitadoFilter === 'PROG 3T' && habilNorm2 === 'PROG 3T') matchesFilter = true;

                            if (matchesFilter && getTrsfGroupValue(r) === currentTrsfGroup && !isHabilitadoValidacionMarcada(r)) {
                                const pdsRow = getHabilitadoPdsValue(r);
                                const transfersRow = getHabilitadoTransferMultiplierValue(r) * pdsRow;
                                pdsTrsf += pdsRow;
                                transferTrsf += transfersRow;
                            }
                        } catch (e) { }
                    });
                } catch (e) { pdsTrsf = 0; transferTrsf = 0; }

                const groupLabel = currentTrsfGroup === 'Pza' ? 'LLEVA TRANSFER EN PIEZA' : 'No lleva transfer en pieza';
                headerRow.innerHTML = `<td colspan="${colspan}" style="padding: 8px 12px; text-align: left;">
                            <i class="ph ph-package" style="margin-right: 8px;"></i>${groupLabel} [${formatThousands(pdsTrsf, 0)}pds - ${formatThousands(transferTrsf, 0)}transfers]
                        </td>`;
                tbody.appendChild(headerRow);

                lastTrsfGroup = currentTrsfGroup;
                lastOpPtda = null; // Reiniciar al cambiar de grupo
                currentRowGroup = 'a'; // Reiniciar alternancia de colores
            }

            // Alternar color de filas dentro del mismo grupo de TRSF
            const opTela = String(row[colMap["OP TELA"]] || "").trim();
            const partida = String(row[colMap["PARTIDA"]] || "").trim();
            const currentOpPtda = `${opTela}-${partida}`;

            if (lastOpPtda !== null && currentOpPtda !== lastOpPtda) {
                currentRowGroup = (currentRowGroup === 'a') ? 'b' : 'a';
            }
            lastOpPtda = currentOpPtda;
        }

        count++;
        const tr = document.createElement('tr');

        // COLUMNA P - Prioridad
        const pCell = document.createElement('td');
        pCell.innerHTML = createPrioridadCell(i, row, 'habilitado').replace(/<td.*?>|<\/td>/g, '');

        // HOD
        const fDesp = formatValue(getVal(row, 'HOD'), 'date') || '';

        // F.ING.COST -> mantener lÃ³gica de date picker (usamos formato de input si es posible)
        const rawFIng = getVal(row, 'F.ING.COST');
        const rawFHab = getRawFIngRealFromRow(row);
        const fIngDisplay = getHabilitadoDayMonthLabel(rawFIng) || '-';
        const fIngHtml = `<td class="date-cell f-ing-cell" style="text-align:center;" title="${fIngDisplay}">${fIngDisplay}</td>`;

        // CLIENTE
        const cliente = normalizeClientName(getVal(row, 'CLIENTE')) || '';

        // OC (concatenado OP - CORTE) sin hiperv?nculo en Habilitado
        const op = getVal(row, 'OP') || '';
        const corte = getVal(row, 'CORTE') || '';
        const oc = (op || corte) ? `${op}-${corte}` : '';
        const ocHtml = `<td class="op-cell oc-cell" title="${oc}">${oc}</td>`;

        // COLOR
        const color = abbreviateHeather(getVal(row, 'COLOR')) || '';

        // PDS (PDS GIRADAS)
        const pdsRaw = parseFloat(getVal(row, 'PDS GIRADAS')) || 0;
        const pdsStr = formatThousands(pdsRaw, 0);

        // PRENDA
        const prenda = normalizePrenda(getVal(row, 'PRENDA')) || '';

        // TIPO CERTIFICADO
        const tipoCert = normalizeTipoCert(getVal(row, 'TIPO CERTIFICADO')) || '';

        // RIB -> normalizar y mostrar como pill seg?n valor
        const rawRib = getVal(row, 'RIB') || '';
        const estadoRib = getVal(row, 'estado_rib') || getVal(row, 'ESTADO_RIB') || '';
        const ribDisplay = (estadoRib || rawRib || '').toString();
        const ribNorm = (ribDisplay || '').toUpperCase().trim();
        let ribHtml = '';
        if (ribNorm === 'NO LLEVA') {
            // mostrar X con pill de texto rojo
            ribHtml = `<td style="text-align:center;" title="NO LLEVA"><span class="pill pill-x">X</span></td>`;
        } else if (ribNorm === 'NO PASO' || ribNorm === 'EN LAV' || (ribNorm.indexOf('LAV') !== -1 && ribNorm.indexOf('REP') !== -1)) {
            // mostrar con fondo rojo oscuro y letra blanca
            ribHtml = `<td style="text-align:center;" title="${ribDisplay}"><span class="pill pill-rib-alert">${ribDisplay}</span></td>`;
        } else if (ribNorm === 'EN CORTE') {
            // fondo verde claro
            ribHtml = `<td style="text-align:center;" title="${ribDisplay}"><span class="pill pill-pda">${ribDisplay}</span></td>`;
        } else if (ribNorm === 'EN HAB') {
            // fondo azul claro
            ribHtml = `<td style="text-align:center;" title="${ribDisplay}"><span class="pill pill-pza">${ribDisplay}</span></td>`;
        } else {
            ribHtml = `<td style="text-align:center;" title="${ribDisplay}">${ribDisplay}</td>`;
        }

        // BLOQUES? -> normalizar seg?n estado_bloques y estado_corte_bloques
        const estadoCorteBloques = getVal(row, 'estado_corte_bloques') || getVal(row, 'ESTADO_CORTE_BLOQUES') || getVal(row, 'ESTADO CORTE BLOQUES') || '';
        const estadoBloques = getVal(row, 'ESTADO BLOQUES') || getVal(row, 'ESTADO_BLOQUES') || getVal(row, 'estado_bloques') || '';
        const estadoBloquesNorm = (estadoBloques || '').toString().toUpperCase().trim();
        const estadoCorteBloquesNorm = (estadoCorteBloques || '').toString().toUpperCase().trim();
        let bloqHtml = '';
        try {
            if (estadoBloquesNorm === 'NO LLEVA') {
                // X con pill rojo (texto rojo)
                bloqHtml = `<td style="text-align:center;" title="NO LLEVA"><span class="pill pill-x">X</span></td>`;
            } else if (estadoBloquesNorm.indexOf('OK CORTE') !== -1 || estadoBloquesNorm === 'OK CORTE' || estadoBloquesNorm === 'OK CORTE') {
                // Evaluar estado_corte_bloques
                if (!estadoCorteBloquesNorm) {
                    // blank -> X PROG (fondo verde claro)
                    bloqHtml = `<td style="text-align:center;" title="X PROG"><span class="pill pill-pda">X PROG</span></td>`;
                } else if (estadoCorteBloquesNorm.indexOf('PROG') !== -1) {
                    // PROG -> blue light
                    bloqHtml = `<td style="text-align:center;" title="PROG"><span class="pill pill-pza">PROG</span></td>`;
                } else if (estadoCorteBloquesNorm.indexOf('OK') !== -1) {
                    // OK -> blue dark
                    bloqHtml = `<td style="text-align:center;" title="OK"><span class="pill pill-ok-dark">OK</span></td>`;
                } else {
                    bloqHtml = `<td style="text-align:center;" title="${estadoCorteBloques}">${estadoCorteBloques}</td>`;
                }
            } else {
                // fallback: mostrar estadoBloques tal cual
                bloqHtml = `<td style="text-align:center;" title="${estadoBloques}">${estadoBloques}</td>`;
            }
        } catch (e) { bloqHtml = `<td style="text-align:center;" title="${estadoBloques}">${estadoBloques}</td>`; }

        // COLL o TAP? -> estado_coll_tap (mostrar pill)
        const collVal = getVal(row, 'estado_coll_tap') || getVal(row, 'ESTADO_COLL_TAP') || getVal(row, 'ESTADO COLL TAP') || '';
        const collNorm = (collVal || '').toString().toUpperCase().trim();
        // SI "estado_coll_tap" = "NO LLEVA" -> mostrar 'X' con pill rojo oscuro
        // cualquier otro dato -> mostrar valor dentro de pill azul claro
        let collHtml = '';
        try {
            if (collNorm === 'NO LLEVA') {
                collHtml = `<td style="text-align:center;" title="NO LLEVA"><span class="pill pill-x">X</span></td>`;
            } else if (collVal !== '' && collVal !== null && collVal !== undefined) {
                collHtml = `<td style="text-align:center;" title="${collVal}"><span class="pill pill-pza">${String(collVal).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span></td>`;
            } else {
                collHtml = `<td style="text-align:center;" title=""><span class="pill">-</span></td>`;
            }
        } catch (e) { collHtml = `<td style="text-align:center;" title="${collVal}">${collVal}</td>`; }

        // TRSF -> l?gica basada en tipo-transfer, n.transfxpda y estado_transfer
        const tipoTransfer = getVal(row, 'tipo-transfer') || getVal(row, 'TIPO-TRANSFER') || getVal(row, 'tipo_transfer') || '';
        const rawNTrans = getVal(row, 'n.transfxpda') || getVal(row, 'N.TRANSFXPDA') || getVal(row, 'n_transfxpda') || '';
        const estadoTransfer = getVal(row, 'estado_transfer') || getVal(row, 'ESTADO_TRANSFER') || '';
        const tipoTransNorm = (tipoTransfer || '').toString().toUpperCase().trim();
        const nTransNorm = (rawNTrans !== undefined && rawNTrans !== null) ? String(rawNTrans).trim() : '';
        const estadoTransNorm = (estadoTransfer || '').toString().trim();

        let trsfDisplay = '';
        // Si tipo-transfer = "NO LLEVA" o n.transfxpda = "NO LLEVA" ? X
        if (tipoTransNorm === 'NO LLEVA' || nTransNorm.toUpperCase() === 'NO LLEVA') {
            trsfDisplay = 'X';
        } else if (tipoTransNorm === 'EN PIEZA' && !isNaN(parseInt(nTransNorm)) && nTransNorm !== '') {
            // tipo-transfer = "En pieza" y n.transfxpda es n?mero ? Pza(xN)-estado_transfer
            const num = parseInt(nTransNorm);
            const estado = estadoTransNorm !== '' ? estadoTransNorm : 'X PROG';
            trsfDisplay = `Pza(x${num})-${estado}`;
        } else if (tipoTransNorm === 'EN PRENDA' && !isNaN(parseInt(nTransNorm)) && nTransNorm !== '') {
            // tipo-transfer = "En prenda" y n.transfxpda es n?mero ? PDA[xN]-estado_transfer
            const num = parseInt(nTransNorm);
            const estado = estadoTransNorm !== '' ? estadoTransNorm : 'X PROG';
            trsfDisplay = `PDA[x${num}]-${estado}`;
        } else {
            // Caso por defecto: mostrar el valor original
            trsfDisplay = nTransNorm;
        }

        let trsfHtml = '';
        const trsfUpper = (trsfDisplay || '').toString().toUpperCase();
        if (trsfDisplay === 'X') {
            trsfHtml = `<td style="text-align:center;" title="NO LLEVA"><span class="pill pill-x">X</span></td>`;
        } else if (trsfUpper.indexOf('PZA') !== -1) {
            trsfHtml = `<td style="text-align:center;" title="${trsfDisplay}"><span class="pill pill-pza">${trsfDisplay}</span></td>`;
        } else if (trsfUpper.indexOf('PDA') !== -1) {
            trsfHtml = `<td style="text-align:center;" title="${trsfDisplay}"><span class="pill pill-pda">${trsfDisplay}</span></td>`;
        } else {
            trsfHtml = `<td style="text-align:center;" title="${trsfDisplay}">${trsfDisplay}</td>`;
        }

        // estado_bordado / estado_estampado / estado_habilitado (mostrar badge NO LLEVA si corresponde)
        const bordVal = getVal(row, 'estado_bordado') || getVal(row, 'ESTADO_BORDADO') || '';
        const estampVal = getVal(row, 'estado_estampado') || getVal(row, 'ESTADO_ESTAMPADO') || '';
        const habilVal = getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || '';

        // Normalizar estado_bordado seg?n estado_bordado y n.BDxpda
        const nbdRaw = getVal(row, 'n.BDxpda') || getVal(row, 'n.bordadoxpda') || getVal(row, 'N.BDXPDA') || '';
        const nbdNorm = (nbdRaw || '').toString().toUpperCase().trim();
        const bordValNorm = (bordVal || '').toString().toUpperCase().trim();
        let bordHtml = '';
        try {
            // Si estado_bordado = NO LLEVA o n.BDxpda = NO LLEVA -> X (pill rojo)
            if (bordValNorm === 'NO LLEVA' || nbdNorm === 'NO LLEVA') {
                bordHtml = `<td style="text-align:center;" title="NO LLEVA"><span class="pill pill-x">X</span></td>`;
                // Si estado_bordado = PROG -> PROG (pill verde claro)
            } else if (bordValNorm === 'PROG') {
                bordHtml = `<td style="text-align:center;" title="PROG"><span class="pill pill-pda">PROG</span></td>`;
                // Si estado_bordado est? vac?o y n.BDxpda tiene n?mero -> X PROG (pill verde claro)
            } else if ((bordValNorm === '' || bordValNorm === undefined) && nbdNorm !== '' && !isNaN(parseInt(nbdNorm))) {
                bordHtml = `<td style="text-align:center;" title="X PROG"><span class="pill pill-pda">X PROG</span></td>`;
                // Si estado_bordado = OK -> OK (pill azul claro)
            } else if (bordValNorm === 'OK') {
                bordHtml = `<td style="text-align:center;" title="OK"><span class="pill pill-pza">OK</span></td>`;
            } else {
                bordHtml = `<td style="text-align:center;" title="${bordVal}">${bordVal}</td>`;
            }
        } catch (e) { bordHtml = `<td style="text-align:center;" title="${bordVal}">${bordVal}</td>`; }

        // Revisar n.ESTAMPxpda (variantes) y forzar NO LLEVA en estado_estampado si aplica
        const nestRaw = getVal(row, 'n.ESTAMPxpda') || getVal(row, 'n.ESTAMP xpda') || getVal(row, 'N.ESTAMPXPDA') || getVal(row, 'n.ESTAMPxpda ') || '';
        const nestNorm = (nestRaw || '').toString().toUpperCase().trim();

        let estampHtml = '';
        const estampValNorm = (estampVal || '').toString().toUpperCase().trim();
        try {
            // Si estado_estampado = NO LLEVA o n.ESTAMPxpda = NO LLEVA -> X (pill rojo)
            if (nestNorm.indexOf('NO LLEVA') !== -1 || estampValNorm === 'NO LLEVA') {
                estampHtml = `<td style="text-align:center;" title="NO LLEVA"><span class="pill pill-x">X</span></td>`;
                // Si estado_estampado = PROG -> PROG (pill verde claro)
            } else if (estampValNorm === 'PROG') {
                estampHtml = `<td style="text-align:center;" title="PROG"><span class="pill pill-pda">PROG</span></td>`;
                // Si estado_estampado est? vac?o y n.ESTAMPxpda tiene n?mero -> X PROG (pill verde claro)
            } else if ((estampValNorm === '' || estampValNorm === undefined) && nestNorm !== '' && !isNaN(parseInt(nestNorm))) {
                estampHtml = `<td style="text-align:center;" title="X PROG"><span class="pill pill-pda">X PROG</span></td>`;
                // Si estado_estampado = OK -> OK (pill azul claro)
            } else if (estampValNorm === 'OK') {
                estampHtml = `<td style="text-align:center;" title="OK"><span class="pill pill-pza">OK</span></td>`;
            } else {
                estampHtml = `<td style="text-align:center;" title="${estampVal}">${estampVal}</td>`;
            }
        } catch (e) { estampHtml = `<td style="text-align:center;" title="${estampVal}">${estampVal}</td>`; }
        const escapeHtml = (txt) => String(txt || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const fHabDateValue = getFIngRealInputValue(rawFHab);
        const fHabDisplay = getFIngRealDayMonthLabel(rawFHab) || '-';
        const fHabHtml = `<td class="date-cell cell-fhab f-hab-cell" style="position:relative; cursor:pointer; overflow:visible;" onclick="openHabilitadoFIngPicker(this, event)" title="${escapeHtml(rawFHab || fHabDisplay)}">
                <input type="date" class="short-year" value="${escapeHtml(fHabDateValue)}" onchange="handleFHabDateChange(this, ${i})" style="position:absolute; inset:0; width:100%; height:100%; opacity:0; pointer-events:auto; cursor:pointer; z-index:2;">
                <span class="date-hab" style="position:relative; z-index:1;">${escapeHtml(fHabDisplay)}</span>
            </td>`;
        const extractCompText = (cellHtml) => {
            const plain = String(cellHtml || '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\s+/g, ' ')
                .trim();
            const plainNorm = plain.toUpperCase();
            if (!plain || plain === '-' || plainNorm === 'X' || plainNorm === 'NO LLEVA') return '';
            return plain;
        };
        const compItems = [];
        const ribComp = extractCompText(ribHtml);
        const bloqComp = extractCompText(bloqHtml);
        const collComp = extractCompText(collHtml);
        const trsfComp = extractCompText(trsfHtml);
        const bordComp = extractCompText(bordHtml);
        const estmComp = extractCompText(estampHtml);
        if (ribComp) compItems.push({ label: 'RIB', value: ribComp });
        if (bloqComp) compItems.push({ label: 'BLOQ?', value: bloqComp });
        if (collComp) compItems.push({ label: 'COLL/TAP', value: collComp });
        if (trsfComp) compItems.push({ label: 'TRSF', value: trsfComp });
        if (bordComp) compItems.push({ label: 'BORD', value: bordComp });
        if (estmComp) compItems.push({ label: 'ESTM', value: estmComp });
        const compOtrosText = compItems.map(item => `${item.label}: ${item.value}`).join(' | ');
        const compOtrosSafe = escapeHtml(compOtrosText);
        const compOtrosRich = compItems
            .map(item => `<strong>${item.label}:</strong> ${escapeHtml(item.value)}`)
            .join(' | ');
        const compOtrosHtml = `<td class="wrap-text col-comp-otros" style="text-align:left;" title="${compOtrosSafe}">${compOtrosRich}</td>`;
        const observacionesVal = getVal(row, 'OBSERVACIONES')
            || getVal(row, 'OBSERVACION')
            || getVal(row, 'OBS')
            || '';
        const observacionesText = String(observacionesVal || '').trim();
        const observacionesSafe = escapeHtml(observacionesText);
        const observacionesHtml = `<td class="wrap-text observaciones-cell col-observaciones" style="text-align:left;" title="${observacionesSafe}" ondblclick="editObservaciones(this, ${i})"><span class="observaciones-display">${observacionesSafe}</span></td>`;
        let idxValidacion = findHeaderIndexCaseInsensitive('VALIDACION');
        if (idxValidacion === -1) idxValidacion = findHeaderIndexCaseInsensitive('VALIDA');
        let validacionRaw = '';
        if (idxValidacion !== -1 && row[idxValidacion] !== undefined && row[idxValidacion] !== null) {
            validacionRaw = row[idxValidacion];
        } else {
            const validacionByName = getVal(row, 'VALIDACION') || getVal(row, 'VALIDA');
            if (validacionByName !== undefined && validacionByName !== null) validacionRaw = validacionByName;
        }
        const validacionNorm = String(validacionRaw).trim().toUpperCase();
        const validacionChecked = validacionRaw === true || validacionRaw === 1 || validacionNorm === 'TRUE' || validacionNorm === 'VERDADERO' || validacionNorm === '1' || validacionNorm === 'SI' || validacionNorm === 'X';
        const validacionHtml = `<td class="cell-validacion col-validacion"><input type="checkbox" class="validacion-checkbox" aria-label="Validacion" ${validacionChecked ? 'checked' : ''} onchange="updateRow(${i}, 'VALIDACION', this.checked, this)" /></td>`;

        let hRaw = '';
        let idxH = findHeaderIndexCaseInsensitive('H');
        if (idxH !== -1 && row[idxH] !== undefined && row[idxH] !== null) {
            hRaw = row[idxH];
        } else {
            const hByName = getVal(row, 'H');
            if (hByName !== undefined && hByName !== null) hRaw = hByName;
        }
        const hNorm = String(hRaw).trim().toUpperCase();
        const hChecked = hRaw === true || hRaw === 1 || hNorm === 'TRUE' || hNorm === 'VERDADERO' || hNorm === '1' || hNorm === 'SI' || hNorm === 'X';
        const hHtml = `<td class="cell-h col-h"><input type="checkbox" class="validacion-checkbox" aria-label="H" ${hChecked ? 'checked' : ''} disabled tabindex="-1" /></td>`;

        // estado_habilitado -> select editable con opciones X PROG, PROG 1T, PROG 2T, PROG 3T (y OK para PROG 1T/2T/3T y X PROG)
        const habilValNorm = (habilVal || '').toString().toUpperCase().trim();
        let habilClass = '';
        if (habilValNorm === 'PROG 1T' || habilValNorm === 'PROG 2T' || habilValNorm === 'PROG 3T') habilClass = 'sel-PROG';
        if (habilValNorm === 'OK' || habilValNorm === 'OK S/DESTINO') habilClass = 'sel-OK';

        // Mostrar opci?n OK en sub-tabs PROG 1T, PROG 2T, PROG 3T
        const showOkOption = (currentHabilitadoFilter === 'PROG 1T' || currentHabilitadoFilter === 'PROG 2T' || currentHabilitadoFilter === 'PROG 3T');

        let habilHtml = '';
        if (currentHabilitadoFilter === 'X PROG' || currentHabilitadoFilter === 'S/DESTINO') {
            // En X PROG / S/DESTINO: mostrar todas las opciones incluyendo OK (OK abre modal)
            habilHtml = `<td class="cell-hab">
                            <select class="table-select ${habilClass}" data-rowindex="${i}" onchange="handleHabilitadoSelectChange(${i}, this.value, this, '${habilValNorm || 'X PROG'}')">
                                <option value="X PROG" ${habilValNorm === 'X PROG' || habilValNorm === '' ? 'selected' : ''}>X PROG</option>
                                <option value="PROG 1T" ${habilValNorm === 'PROG 1T' ? 'selected' : ''}>PROG 1T</option>
                                <option value="PROG 2T" ${habilValNorm === 'PROG 2T' ? 'selected' : ''}>PROG 2T</option>
                                <option value="PROG 3T" ${habilValNorm === 'PROG 3T' ? 'selected' : ''}>PROG 3T</option>
                                <option value="OK" ${habilValNorm === 'OK' ? 'selected' : ''}>OK</option>
                                <option value="OK S/DESTINO" ${habilValNorm === 'OK S/DESTINO' ? 'selected' : ''}>OK S/DESTINO</option>
                                <option value="DEPURADO" ${habilValNorm === 'DEPURADO' ? 'selected' : ''}>DEPURADO</option>
                            </select>
                        </td>`;
        } else {
            // En otros sub-tabs: mostrar todas las opciones
            habilHtml = `<td class="cell-hab">
                            <select class="table-select ${habilClass}" data-rowindex="${i}" onchange="handleHabilitadoSelectChange(${i}, this.value, this, '${habilValNorm || 'X PROG'}')">
                                <option value="X PROG" ${habilValNorm === 'X PROG' || habilValNorm === '' ? 'selected' : ''}>X PROG</option>
                                <option value="PROG 1T" ${habilValNorm === 'PROG 1T' ? 'selected' : ''}>PROG 1T</option>
                                <option value="PROG 2T" ${habilValNorm === 'PROG 2T' ? 'selected' : ''}>PROG 2T</option>
                                <option value="PROG 3T" ${habilValNorm === 'PROG 3T' ? 'selected' : ''}>PROG 3T</option>
                                ${showOkOption ? `<option value="OK" ${habilValNorm === 'OK' ? 'selected' : ''}>OK</option>` : ''}
                                <option value="OK S/DESTINO" ${habilValNorm === 'OK S/DESTINO' ? 'selected' : ''}>OK S/DESTINO</option>
                                <option value="DEPURADO" ${habilValNorm === 'DEPURADO' ? 'selected' : ''}>DEPURADO</option>
                            </select>
                        </td>`;
        }

        // STATUS - Columna calculada seg?n RUTA TELA y estados
        const statusValue = getHabilitadoStatusValue(row, evNorm);

        // Aplicar estilo seg?n el valor de STATUS
        let statusHtml = '';
        const statusUpper = statusValue.toUpperCase();
        if (statusUpper.indexOf('X CORTAR') !== -1) {
            statusHtml = `<td title="${statusValue}"><span class="pill pill-pda">${statusValue}</span></td>`;
        } else if (statusUpper.indexOf('PROC CORTE') !== -1) {
            statusHtml = `<td title="${statusValue}"><span class="pill pill-pza">${statusValue}</span></td>`;
        } else if (statusUpper.indexOf('X PEDIR') !== -1) {
            statusHtml = `<td title="${statusValue}"><span class="pill pill-xpedir">${statusValue}</span></td>`;
        } else if (statusUpper.indexOf('X ENM') !== -1) {
            statusHtml = `<td title="${statusValue}"><span class="pill pill-pda">${statusValue}</span></td>`;
        } else if (statusUpper.indexOf('X HAB') !== -1) {
            statusHtml = `<td title="${statusValue}"><span class="pill pill-ok-dark">${statusValue}</span></td>`;
        } else if (statusUpper.indexOf('X BLOQ') !== -1) {
            statusHtml = `<td title="${statusValue}"><span class="pill pill-pda">${statusValue}</span></td>`;
        } else if (statusUpper.indexOf('X LAVAR') !== -1) {
            statusHtml = `<td title="${statusValue}"><span class="pill pill-pda">${statusValue}</span></td>`;
        } else {
            statusHtml = `<td title="${statusValue}">${statusValue}</td>`;
        }

        // PLANTA - Obtener valor y generar celda con dropdown
        const plantaVal = normalizeHabilitadoPlantaValue(getVal(row, 'PLANTA') || '');
        const plantaDisplay = plantaVal.toString().trim() || 'XASIG';
        const plantaHtml = `<td class="cell-planta" style="text-align:center;">
                        <select class="table-select planta-select" data-row="${i}" onchange="updatePlanta(${i}, this.value, this)">
                            <option value="" ${plantaVal === '' ? 'selected' : ''}>XASIG</option>
                            <option value="COFACO" ${plantaVal === 'COFACO' ? 'selected' : ''}>COFACO</option>
                            <option value="CITI1" ${plantaVal === 'CITI1' ? 'selected' : ''}>CITI1</option>
                            <option value="CITI2" ${plantaVal === 'CITI2' ? 'selected' : ''}>CITI2</option>
                            <option value="CITI3" ${plantaVal === 'CITI3' ? 'selected' : ''}>CITI3</option>
                            <option value="CITI4" ${plantaVal === 'CITI4' ? 'selected' : ''}>CITI4</option>
                            <option value="CITI5" ${plantaVal === 'CITI5' ? 'selected' : ''}>CITI5</option>
                            <option value="S/DESTINO" ${plantaVal === 'S/DESTINO' ? 'selected' : ''}>S/DESTINO</option>
                        </select>
                    </td>`;

        // LINEA - Obtener valor y generar celda editable con doble click
        const lineaVal = getVal(row, 'LINEA') || '';
        const lineaDisplay = lineaVal.toString().trim() || 'XASIG';
        const lineaHtml = `<td style="text-align:center;" class="linea-cell" data-row="${i}" data-value="${lineaVal}" ondblclick="editLinea(this, ${i})">
                        <span class="linea-display">${lineaDisplay}</span>
                    </td>`;

        const hodHtml = `<td class="date-cell hod-cell" data-value="${fDesp}" ondblclick="editHodDate(this, ${i})">${fDesp}</td>`;

        tr.innerHTML = `
                        <td class="p-cell">${pCell.innerHTML}</td>
                        ${hodHtml}
                        ${fIngHtml}
                        ${fHabHtml}
                        <td style="text-align:center;" title="${statusValue}">${statusHtml.replace(/<td[^>]*>|<\/td>/g, '')}</td>
                        <td style="text-align:center;" title="${cliente}">${cliente}</td>
                        ${ocHtml}
                        <td class="cell-color" title="${color}">${color}</td>
                        <td class="kg-cell pds-cell" style="text-align:center;" data-row="${i}" data-value="${pdsRaw}" ondblclick="editPds(this, ${i})">${pdsStr}</td>
                        <td class="cell-pda" title="${prenda}"><span class="oc-link" onclick="abrirModalOC(${i});">${prenda}</span></td>
                        <td class="cell-cert" title="${tipoCert}">${tipoCert}</td>
                    ${compOtrosHtml}
                    ${observacionesHtml}
                    ${validacionHtml}
                    ${hHtml}
                    ${plantaHtml}
                    ${lineaHtml}
                    ${habilHtml}
                `;

        // Agregar clase de grupo para sombreado alternado
        // En PROG 1T/2T/3T, usar currentRowGroup que se alterna por OP-PTDA dentro del grupo TRSF
        if (isProgSubtab) {
            tr.classList.add(`group-${currentRowGroup}`);
        } else {
            // En X PROG, alternar por OP-PTDA
            const opTela = String(row[colMap["OP TELA"]] || "").trim();
            const partida = String(row[colMap["PARTIDA"]] || "").trim();
            const currentOpPtda = `${opTela}-${partida}`;
            if (lastOpPtda !== null && currentOpPtda !== lastOpPtda) {
                currentRowGroup = (currentRowGroup === 'a') ? 'b' : 'a';
            }
            lastOpPtda = currentOpPtda;
            tr.classList.add(`group-${currentRowGroup}`);
        }

        // Asignar data-row-index al tr para poder encontrar filas por ?ndice
        tr.setAttribute('data-row-index', i);

        // Si P = 1, aplicar color rojo claro y transparente
        const idxP = findPriorityHeaderIndex('habilitado');
        if (idxP !== -1) {
            const pValue = String(row[idxP] || '').trim();
            if (pValue === '1') {
                tr.classList.add('priority-1');
            }
        }

        tbody.appendChild(tr);
    });
    try { updateMainNavCounts(); } catch (e) { }

    // Actualizar badges de PDS por sub-tab
    try { document.getElementById('habilitado-pds-xprog').innerText = `[${formatThousands(pdsXProg, 0)}pds]`; } catch (e) { }
    try { document.getElementById('habilitado-pds-1t').innerText = `[${formatThousands(pds1T, 0)}pds]`; } catch (e) { }
    try { document.getElementById('habilitado-pds-2t').innerText = `[${formatThousands(pds2T, 0)}pds]`; } catch (e) { }
    try { document.getElementById('habilitado-pds-3t').innerText = `[${formatThousands(pds3T, 0)}pds]`; } catch (e) { }
    try { document.getElementById('habilitado-pds-sdestino').innerText = `[${formatThousands(pdsSDestino, 0)}pds]`; } catch (e) { }
    try { document.getElementById('habilitado-xhab-total').innerText = `${formatThousands(pdsXHabilitar, 0)}pds`; } catch (e) { }

    // Inicializar eventos de los selectores de fecha
    initializeDateInputs();

    // Agregar event listeners para click derecho en los encabezados en todos los sub-tabs de Habilitado
    initializeHabilitadoHeaderContextMenus();

    // Marcar columnas filtradas visualmente
    markFilteredColumns('view-habilitado', habilitadoHeaderFilters.length > 0 ? habilitadoHeaderFilters : (habilitadoHeaderFilter ? [habilitadoHeaderFilter] : []));
    updateHabilitadoHoja3BlockVisibility();
}

