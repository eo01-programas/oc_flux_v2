function renderTransfer() {
    const tbody = document.getElementById('tbody-transfer');
    if (!tbody) return;
    tbody.innerHTML = "";
    let count = 0;
    let lastOpPtda = null;
    let currentGroup = 'a'; // Para alternar sombreado de filas

    // Mostrar/ocultar columna P seg?n el sub-tab activo (solo en PROG)
    const showPColumn = (currentTransferFilter === 'PROG');
    try {
        const thP = document.getElementById('th-transfer-p');
        if (thP) thP.style.display = showPColumn ? '' : 'none';
    } catch (e) { }

    // Transfer muestra filas cuyo estado_enumerado = 'OK ENM' o 'OK S/ENM'
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];

        // Obtener estado_enumerado
        let ev = '';
        try {
            const idxEv = findHeaderIndexCaseInsensitive('estado_enumerado');
            if (idxEv !== -1 && rawData[i] && rawData[i][idxEv] !== undefined) ev = rawData[i][idxEv];
            else ev = getVal(row, 'estado_enumerado') || '';
        } catch (e) { ev = getVal(row, 'estado_enumerado') || ''; }

        const evNorm = (ev || '').toString().toUpperCase().trim();

        // Determinar filtro principal seg?n sub-tab activo
        let passMainFilter = false;
        if (currentTransferFilter === 'X PROG') {
            // Por Programar: estado_enumerado diferente a vac?o
            passMainFilter = evNorm !== '';
        } else {
            // Otros sub-tabs: estado_enumerado = 'OK ENM', 'OK S/ENM' o 'OK PAQUETEO'
            passMainFilter = (evNorm === 'OK ENM' || evNorm === 'OK S/ENM' || evNorm === 'OK PAQUETEO');
        }
        if (passMainFilter) {
            // No mostrar filas con estado_habilitado = 'OK'
            const habilitadoCheck = (getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || '').toString().toUpperCase().trim();
            if (habilitadoCheck === 'OK') continue;

            // Si la fila indica NO LLEVA en n.transfxpda, no mostrarla en Transfer
            const rawNTrans = getVal(row, 'n.transfxpda');
            let nTransfValCheck = '';
            if (rawNTrans !== undefined && rawNTrans !== null && rawNTrans.toString().trim() !== '') {
                nTransfValCheck = rawNTrans.toString();
            } else {
                const clienteChk = (getVal(row, 'CLIENTE') || '').toString().trim();
                const estiloChk = (getVal(row, 'ESTILO') || '').toString().trim();
                const avgChk = avgTransfByClienteEstilo(clienteChk, estiloChk);
                nTransfValCheck = (avgChk !== null) ? avgChk : '';
            }
            nTransfValCheck = nTransfValCheck.toUpperCase().trim();
            if (nTransfValCheck === 'NO LLEVA') continue;
            // Si la fila indica NO LLEVA en tipo-transfer, no mostrarla en Transfer
            const tipoTransferVal = (getVal(row, 'tipo-transfer') || '').toString().toUpperCase().trim();
            if (tipoTransferVal === 'NO LLEVA') continue;
            // Si tipo-transfer es 'En prenda', no mostrar en Por Programar
            if (currentTransferFilter === 'X PROG' && tipoTransferVal === 'EN PRENDA') continue;
            // Obtener estado_transfer (por defecto 'X PROG' si est? vac?o)
            let estadoTransfer = getVal(row, 'estado_transfer') || 'X PROG';
            estadoTransfer = (!estadoTransfer || estadoTransfer === '') ? 'X PROG' : estadoTransfer;

            // Filtrar seg?n el sub-tab activo
            let passSubFilter = false;
            if (currentTransferFilter === 'X PROG') {
                // Por Programar: estado_transfer diferente a OK
                passSubFilter = String(estadoTransfer).toUpperCase().trim() !== 'OK';
            } else {
                passSubFilter = (estadoTransfer === currentTransferFilter);
            }
            if (passSubFilter) {
                // Aplicar filtros de encabezado si existen (soporta m?ltiples)
                const tFiltersToApply = transferHeaderFilters && transferHeaderFilters.length > 0
                    ? transferHeaderFilters
                    : (transferHeaderFilter ? [transferHeaderFilter] : []);
                if (tFiltersToApply.length > 0) {
                    let matchesAll = true;
                    for (let tfi = 0; tfi < tFiltersToApply.length; tfi++) {
                        const currentTF = tFiltersToApply[tfi];
                        if (!currentTF.field || currentTF.value === undefined || currentTF.value === null) continue;
                        const f = currentTF.field;
                        const v = String(currentTF.value).toUpperCase().trim();
                        let cellValue = '';
                        try {
                            if (f === 'HOD') {
                                cellValue = formatValue(getVal(row, 'HOD'), 'date') || '';
                            } else if (f === 'F.ING.COST') {
                                cellValue = formatValue(getVal(row, 'F.ING.COST'), 'date') || '';
                            } else if (f === 'CLIENTE') {
                                cellValue = normalizeClientName(getVal(row, 'CLIENTE')) || '';
                            } else if (f === 'RUTA') {
                                const rutaTela = (getVal(row, 'RUTA TELA') || '').toString().toUpperCase().trim();
                                if (rutaTela === 'LAVADA') cellValue = 'LAVADA';
                                else if (rutaTela === 'ACABADA') cellValue = 'ACABADA';
                            } else if (f === 'OC') {
                                const op = String(getVal(row, 'OP') || '').trim();
                                const corte = String(getVal(row, 'CORTE') || '').trim();
                                cellValue = (op + '-' + corte) || '';
                            } else if (f === 'COLOR') {
                                cellValue = String(getVal(row, 'COLOR') || '') || '';
                            } else if (f === 'OP-PTDA') {
                                const opTela = String(getVal(row, 'OP TELA') || '').trim();
                                const partida = String(getVal(row, 'PARTIDA') || '').trim();
                                cellValue = opTela + '-' + partida;
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

                count++;

                // Crear fila
                const tr = document.createElement('tr');

                // HOD
                const tdFDesp = document.createElement('td');
                tdFDesp.className = 'date-cell';
                tdFDesp.innerText = formatValue(getVal(row, 'HOD') || getVal(row, 'F DESPACHO') || '', 'date');
                tr.appendChild(tdFDesp);

                // F.ING.COST - usar date picker si estamos en X PROG
                const tdFCost = document.createElement('td');
                tdFCost.className = 'date-cell';
                if (currentTransferFilter === 'X PROG') {
                    const rawFIngCost = getVal(row, 'F.ING.COST') || getVal(row, 'F. ING COST') || getVal(row, 'F ING COST') || '';
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
                    tdFCost.innerText = formatValue(getVal(row, 'F. ING COST') || getVal(row, 'F ING COST') || '', 'date');
                }
                tr.appendChild(tdFCost);

                // CLIENTE (normalizado para la vista Transfer)
                const tdCliente = document.createElement('td');
                tdCliente.innerText = normalizeClientForTransfer(getVal(row, 'CLIENTE') || '');
                tr.appendChild(tdCliente);

                // RUTA
                const tdRuta = document.createElement('td');
                const rutaVal = getVal(row, 'RUTA TELA') || getVal(row, 'RUTA') || '';
                tdRuta.innerHTML = renderRutaBadge(rutaVal, row);
                tr.appendChild(tdRuta);

                // OC: usar columna OC si existe, sino concatenar OP y CORTE (ej: 39579-29)
                const tdOC = document.createElement('td');
                tdOC.className = 'op-cell oc-cell';
                let ocVal = getVal(row, 'OC') || '';
                if ((!ocVal || String(ocVal).trim() === '')) {
                    const opVal = getVal(row, 'OP') || getVal(row, 'OP TELA') || getVal(row, 'OP-PTDA') || '';
                    const corteVal = getVal(row, 'CORTE') || getVal(row, 'PARTIDA') || '';
                    if (opVal && corteVal) ocVal = `${String(opVal).trim()}-${String(corteVal).trim()}`;
                    else if (opVal) ocVal = String(opVal).trim();
                    else ocVal = '';
                }
                tdOC.innerText = ocVal;
                tr.appendChild(tdOC);

                // COLOR
                const tdColor = document.createElement('td');
                tdColor.innerText = getVal(row, 'COLOR') || '';
                tr.appendChild(tdColor);

                // PDS
                const tdPds = document.createElement('td');
                tdPds.style.textAlign = 'center';
                const pdsVal = parseFloat(getVal(row, 'PDS GIRADAS') || getVal(row, 'PDS') || 0);
                tdPds.innerText = formatThousands(pdsVal, 0);
                tr.appendChild(tdPds);

                // PRENDA
                const tdPrenda = document.createElement('td');
                tdPrenda.innerText = getVal(row, 'PRENDA') || '';
                tr.appendChild(tdPrenda);

                // TIPO CERT.
                const tdCert = document.createElement('td');
                tdCert.innerText = getVal(row, 'TIPO CERT') || getVal(row, 'TIPO CERT.') || '';
                tr.appendChild(tdCert);

                // n.transfxpda: en sub-tabs 'Por Programar' (X PROG) y 'Programado' (PROG)
                // mostrar solo el dato (sin desplegable). En otros casos podr?a seguir siendo editable.
                const tdTransfxpda = document.createElement('td');
                const rawNTrans = getVal(row, 'n.transfxpda');
                let nTransfVal;
                if (rawNTrans !== undefined && rawNTrans !== null && rawNTrans.toString().trim() !== '') {
                    nTransfVal = rawNTrans.toString().trim();
                } else {
                    const clienteCur = (getVal(row, 'CLIENTE') || '').toString().trim();
                    const estiloCur = (getVal(row, 'ESTILO') || '').toString().trim();
                    const avgCur = avgTransfByClienteEstilo(clienteCur, estiloCur);
                    nTransfVal = (avgCur !== null) ? avgCur : 'LLEVA?';
                }
                // Normalize nTransf and tipo-transfer to detect 'NO LLEVA' values
                const nTransfNormForCheck = (nTransfVal || '').toString().toUpperCase().trim();
                const tipoTransferRaw = getVal(row, 'tipo-transfer') || getVal(row, 'tipo_transfer') || getVal(row, 'TIPO-TRANSFER') || '';
                const tipoTransferNorm = (tipoTransferRaw || '').toString().toUpperCase().trim();

                // If either n.transfxpda or tipo-transfer indicate NO LLEVA, skip this row
                if (nTransfNormForCheck.indexOf('NO LLEVA') !== -1 || tipoTransferNorm.indexOf('NO LLEVA') !== -1) {
                    continue;
                }

                // Si estamos en los sub-tabs normales de Transfer (X PROG o PROG), mostrar solo texto
                if (currentTransferFilter === 'X PROG' || currentTransferFilter === 'PROG') {
                    tdTransfxpda.style.textAlign = 'center';
                    tdTransfxpda.innerText = nTransfVal;
                } else {
                    // Comportamiento por defecto: mostrar select (mantener compatibilidad)
                    const selTransf = document.createElement('select');
                    selTransf.className = 'table-select';
                    selTransf.setAttribute('data-row-index', i);
                    const nSelNorm = (nTransfVal || '').toString().toUpperCase().trim();
                    selTransf.innerHTML = `
                                <option value="LLEVA?" ${(nSelNorm === '' || nSelNorm === 'LLEVA?') ? 'selected' : ''}>LLEVA?</option>
                                <option value="NO LLEVA" ${(nSelNorm.indexOf('NO LLEVA') !== -1) ? 'selected' : ''}>NO LLEVA</option>
                                <option value="1" ${(nSelNorm === '1') ? 'selected' : ''}>1</option>
                                <option value="2" ${(nSelNorm === '2') ? 'selected' : ''}>2</option>
                                <option value="3" ${(nSelNorm === '3') ? 'selected' : ''}>3</option>
                                <option value="4" ${(nSelNorm === '4') ? 'selected' : ''}>4</option>
                                <option value="5" ${(nSelNorm === '5') ? 'selected' : ''}>5</option>
                            `;
                    selTransf.onchange = function () { updateRow(i, 'n.transfxpda', this.value, this); };
                    tdTransfxpda.appendChild(selTransf);
                }
                tr.appendChild(tdTransfxpda);

                // tipo-transfer (columna nueva a?adida en la hoja)
                const tdTipoTransfer = document.createElement('td');
                tdTipoTransfer.innerText = getVal(row, 'tipo-transfer') || getVal(row, 'tipo_transfer') || '';
                tr.appendChild(tdTipoTransfer);

                // estado_transfer (select con valores X PROG, PROG y opcionalmente OK)
                const tdEstadoTransfer = document.createElement('td');
                const selEstado = document.createElement('select');
                selEstado.className = 'table-select';
                selEstado.setAttribute('data-row-index', i);
                // Mostrar la opci?n OK s?lo en el sub-tab 'PROG' o si el valor actual es 'OK'
                const showOkOption = (currentTransferFilter === 'PROG') || (estadoTransfer === 'OK');
                selEstado.innerHTML = `
                            <option value="X PROG" ${estadoTransfer === 'X PROG' ? 'selected' : ''}>X PROG</option>
                            <option value="PROG" ${estadoTransfer === 'PROG' ? 'selected' : ''}>PROG</option>
                            ${showOkOption ? `<option value="OK" ${estadoTransfer === 'OK' ? 'selected' : ''}>OK</option>` : ''}
                        `;
                // Aplicar clases visuales seg?n el valor actual
                if (estadoTransfer === 'PROG') { selEstado.classList.add('sel-PROG'); selEstado.classList.remove('sel-OK'); }
                else if (estadoTransfer === 'OK') { selEstado.classList.add('sel-OK'); selEstado.classList.remove('sel-PROG'); }
                else { selEstado.classList.remove('sel-PROG'); selEstado.classList.remove('sel-OK'); }
                selEstado.onchange = function () {
                    // Validar que n.transfxpda no est? vac?o o "LLEVA?" antes de cambiar a PROG
                    if (this.value === 'PROG') {
                        const rawNTransChk = getVal(row, 'n.transfxpda');
                        const nTransfValChk = ((rawNTransChk !== undefined && rawNTransChk !== null && rawNTransChk.toString().trim() !== '') ? rawNTransChk.toString().trim() : 'LLEVA?');
                        if (nTransfValChk === '' || nTransfValChk === 'LLEVA?') {
                            alert('Debe especificar el n?mero de transfer por prenda antes de cambiar a PROG');
                            this.value = estadoTransfer; // revertir al valor anterior
                            return;
                        }
                    }
                    updateRow(i, 'estado_transfer', this.value, this);
                    // Ajustar clases visuales
                    this.classList.remove('sel-PROG');
                    this.classList.remove('sel-OK');
                    if (this.value === 'PROG') this.classList.add('sel-PROG');
                    if (this.value === 'OK') this.classList.add('sel-OK');
                };
                tdEstadoTransfer.appendChild(selEstado);
                tr.appendChild(tdEstadoTransfer);

                // Agregar celda P al inicio si estamos en sub-tab PROG
                if (showPColumn) {
                    const pCell = document.createElement('td');
                    pCell.innerHTML = createPrioridadCell(i, row).replace(/<td.*?>|<\/td>/g, '');
                    tr.insertBefore(pCell, tr.firstChild);
                }

                // Alternar sombreado por OP-PTDA
                const opTela = String(row[colMap["OP TELA"]] || "").trim();
                const partida = String(row[colMap["PARTIDA"]] || "").trim();
                const currentOpPtda = `${opTela}-${partida}`;
                if (lastOpPtda !== null && currentOpPtda !== lastOpPtda) {
                    currentGroup = (currentGroup === 'a') ? 'b' : 'a';
                }
                lastOpPtda = currentOpPtda;
                tr.classList.add(`group-${currentGroup}`);

                // Si P = 1, aplicar color rojo claro
                const idxP = findHeaderIndexCaseInsensitive('P');
                if (idxP !== -1) {
                    const pValue = String(row[idxP] || '').trim();
                    if (pValue === '1') {
                        tr.classList.add('priority-1');
                    }
                }

                tbody.appendChild(tr);
            }
        }
    }
    const countTransferEl = document.getElementById('count-transfer');
    if (countTransferEl) countTransferEl.innerText = count;

    // Inicializar eventos de los selectores de fecha
    initializeDateInputs();

    // Marcar columnas filtradas visualmente
    markFilteredColumns('view-transfer', transferHeaderFilters.length > 0 ? transferHeaderFilters : (transferHeaderFilter ? [transferHeaderFilter] : []));
}

