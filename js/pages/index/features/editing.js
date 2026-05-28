function handleDateChange(inputEl, rowIndex, colName) {
    try { updateShortYearDisplay(inputEl); } catch (e) { }
    // Convertir fecha ISO (YYYY-MM-DD) a formato dd/mmm/yy para enviar al Sheet
    let valueToSend = inputEl.value;
    if (valueToSend && valueToSend.includes('-')) {
        try {
            const mesesEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const parts = valueToSend.split('-');
            if (parts.length === 3) {
                const year = parts[0];
                const month = parseInt(parts[1], 10) - 1; // 0-11
                const day = parts[2];
                const yearShort = year.slice(-2);
                const mon = mesesEs[month] || '';
                // Formato: dd/mmm/yy (ejemplo: 16/Ene/26)
                valueToSend = `${day}/${mon}/${yearShort}`;

                // Actualizar inmediatamente rawData con el valor formateado
                const writeIdx = colMap[colName];
                if (writeIdx !== undefined && writeIdx !== -1 && rawData[rowIndex]) {
                    rawData[rowIndex][writeIdx] = valueToSend;
                }
            }
        } catch (e) { console.error('Error convirtiendo fecha:', e); }
    }
    updateRow(rowIndex, colName, valueToSend, inputEl);
}

function handleFHabDateChange(inputEl, rowIndex) {
    // F.HAB se guarda en F.ING.REAL como fecha completa para mantener el formato del sheet.
    let valueToSend = inputEl.value;
    let formattedValue = '';

    if (valueToSend && valueToSend.includes('-')) {
        try {
            const parts = valueToSend.split('-');
            if (parts.length === 3) {
                const year = parts[0];
                const month = String(parseInt(parts[1], 10)).padStart(2, '0');
                const day = String(parseInt(parts[2], 10)).padStart(2, '0');
                formattedValue = `${day}/${month}/${year}, 0:00:00`;
            }
        } catch (e) { console.error('Error convirtiendo F.HAB:', e); }
    }

    const groupKey = getOcGroupKey(rowIndex);
    const isFirstTouch = groupKey && (typeof touchedFHabOcGroups !== 'undefined' ? !touchedFHabOcGroups.has(groupKey) : true);

    // Decidir qu? filas actualizar: si es la primera vez del grupo, propagar a visibles del mismo grupo
    const rowsToUpdate = isFirstTouch
        ? getVisibleHabilitadoRowsWithSameOcGroup(rowIndex)
        : [rowIndex];

    if (isFirstTouch && typeof touchedFHabOcGroups !== 'undefined') {
        touchedFHabOcGroups.add(groupKey);
    }

    const valueToSave = formattedValue || valueToSend;

    rowsToUpdate.forEach(idx => {
        if (formattedValue) {
            const writeIdx = colMap['F.ING.REAL'];
            if (writeIdx !== undefined && writeIdx !== -1 && rawData[idx]) {
                rawData[idx][writeIdx] = formattedValue;
            }
        }

        // Actualizar visualmente otros inputs si est?n en el DOM
        if (idx !== rowIndex) {
            try {
                const tbodyHab = document.getElementById('tbody-habilitado');
                if (tbodyHab) {
                    const tr = tbodyHab.querySelector('tr[data-row-index="' + idx + '"]');
                    if (tr) {
                        const otherInput = tr.querySelector('.f-hab-cell input[type="date"]');
                        if (otherInput) otherInput.value = inputEl.value;
                    }
                }
            } catch (e) { }
        }

        updateRow(idx, 'F.ING.REAL', valueToSave, (idx === rowIndex ? inputEl : null));
    });

    setTimeout(() => { try { renderHabilitado(); } catch (e) { } }, 120);
}

// --- HELPER PARA CREAR CELDA "P" CON CUADRO DE TEXTO ---
function createPrioridadCell(rowIndex, row, viewName = '') {
    const priorityView = String(viewName || '').trim().toLowerCase();
    let pValue = '';
    try {
        pValue = getPriorityValueFromRow(row, priorityView);
    } catch (e) { }
    const safeView = priorityView.replace(/'/g, "\\'");

    return `<td class="p-cell">
                <input type="text" class="prioridad-input" value="${pValue}" 
                    onchange="updatePrioridad(${rowIndex}, this.value, this, '${safeView}')" 
                    onblur="updatePrioridad(${rowIndex}, this.value, this, '${safeView}')">
            </td>`;
}

function editHodDate(cell, rowIndex) {
    if (rowIndex < 1 || !rawData[rowIndex]) {
        console.error('PROTECCION editHodDate: rowIndex invalido=' + rowIndex);
        return;
    }
    if (cell.querySelector('input')) return;

    const currentRaw = getVal(rawData[rowIndex], 'HOD') || getVal(rawData[rowIndex], 'F DESPACHO') || '';
    const currentDisplay = formatValue(currentRaw, 'date') || '';
    const initialValue = convertToDateInputFormat(currentRaw);

    const input = document.createElement('input');
    input.type = 'date';
    input.className = 'short-year';
    input.value = initialValue;
    input.style.cssText = 'width: 130px; padding: 2px 4px; border: 1px solid var(--primary); border-radius: 4px; font-size: 11px; outline: none;';

    const span = document.createElement('span');
    span.className = 'date-yy';
    span.style.marginLeft = '6px';
    span.style.cursor = 'pointer';

    cell.innerHTML = '';
    cell.appendChild(input);
    cell.appendChild(span);
    try { updateShortYearDisplay(input); } catch (e) { }

    let finished = false;
    const finish = (saveChanges) => {
        if (finished) return;
        finished = true;

        if (saveChanges && input.value) {
            handleDateChange(input, rowIndex, 'HOD');
            const idxHod = findHeaderIndexCaseInsensitive('HOD');
            const newRaw = (idxHod !== -1 && rawData[rowIndex]) ? rawData[rowIndex][idxHod] : '';
            const newDisplay = formatValue(newRaw, 'date') || formatDateShortFromInput(input.value) || '';
            cell.setAttribute('data-value', newDisplay);
            cell.textContent = newDisplay;
        } else {
            cell.setAttribute('data-value', currentDisplay);
            cell.textContent = currentDisplay;
        }
    };

    input.addEventListener('change', () => finish(true));
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finish(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
        }
    });

    span.onclick = function (e) {
        e.stopPropagation();
        try { input.showPicker ? input.showPicker() : input.click(); } catch (err) { input.click(); }
    };

    input.focus();
    try { input.showPicker ? input.showPicker() : input.click(); } catch (e) { }
}

// --- FUNCI?N PARA EDITAR LINEA CON DOBLE CLICK ---
function editLinea(cell, rowIndex) {
    // PROTECCION: No permitir escritura en encabezados
    if (rowIndex < 1 || !rawData[rowIndex]) {
        console.error('PROTECCION editLinea: rowIndex invalido=' + rowIndex);
        return;
    }
    // Verificar si ya est? en modo edici?n
    if (cell.querySelector('input')) return;

    const currentValue = cell.getAttribute('data-value') || '';
    const span = cell.querySelector('.linea-display');
    if (!span) return;

    // Crear input
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 30;
    input.inputMode = 'text';
    input.value = currentValue;
    input.className = 'linea-input';
    input.style.cssText = 'width: 40px; text-align: center; padding: 2px 4px; border: 1px solid var(--primary); border-radius: 4px; font-size: 11px; outline: none;';

    // Ocultar span y mostrar input
    span.style.display = 'none';
    cell.appendChild(input);
    input.focus();
    input.select();

    const normalizeLineaValue = (rawVal) => {
        let newValue = String(rawVal || '').trim();
        // Aceptar texto libre en Habilitado: 2, 10, 49E, OTROS, etc.
        if (newValue !== '') {
            return newValue.toUpperCase();
        }
        return '';
    };

    const getOcGroupInfo = (idx) => {
        if (!rawData || !rawData[idx]) return { ocNorm: '', opNorm: '' };
        const row = rawData[idx];
        const op = String(getVal(row, 'OP') || '').trim();
        const corte = String(getVal(row, 'CORTE') || '').trim();
        let oc = String(getVal(row, 'OC') || '').trim();
        if (!oc && (op || corte)) oc = `${op}-${corte}`;
        const ocNorm = oc.toUpperCase();
        const opNorm = (op || (ocNorm.split('-')[0] || '')).toUpperCase().trim();
        return { ocNorm, opNorm };
    };

    const persistLineaValue = (targetRowIndex, newValue, targetCell) => {
        const idxLinea = findHeaderIndexCaseInsensitive('LINEA');
        if (idxLinea !== -1 && rawData[targetRowIndex]) {
            rawData[targetRowIndex][idxLinea] = newValue;
        }

        if (targetCell) {
            targetCell.setAttribute('data-value', newValue);
            const targetSpan = targetCell.querySelector('.linea-display');
            if (targetSpan) {
                targetSpan.textContent = newValue || 'XASIG';
                targetSpan.style.display = '';
            }
        }

        // Guardar en el backend
        updateRow(targetRowIndex, 'LINEA', newValue, null);
    };

    const findNextLineaCellInSameOcGroup = () => {
        const currentTr = cell.closest('tr');
        if (!currentTr) return null;

        const currentGroup = getOcGroupInfo(rowIndex);
        let nextTr = currentTr.nextElementSibling;

        while (nextTr) {
            const nextLineaCell = nextTr.querySelector('td.linea-cell[data-row]');
            if (!nextLineaCell) {
                nextTr = nextTr.nextElementSibling;
                continue;
            }

            const nextRowIndex = parseInt(nextLineaCell.getAttribute('data-row'));
            if (isNaN(nextRowIndex)) {
                nextTr = nextTr.nextElementSibling;
                continue;
            }

            const nextGroup = getOcGroupInfo(nextRowIndex);
            const sameExactOc = !!(currentGroup.ocNorm && nextGroup.ocNorm && currentGroup.ocNorm === nextGroup.ocNorm);
            const sameOp = !!(currentGroup.opNorm && nextGroup.opNorm && currentGroup.opNorm === nextGroup.opNorm);

            if (sameExactOc || sameOp) {
                return { cell: nextLineaCell, rowIndex: nextRowIndex };
            }

            // Se cerro el grupo de OC, no continuar bajando
            break;
        }

        return null;
    };

    let finished = false;
    const finishEdit = (moveNext) => {
        if (finished) return;
        finished = true;

        const newValue = normalizeLineaValue(input.value);
        input.remove();
        persistLineaValue(rowIndex, newValue, cell);

        if (moveNext) {
            const next = findNextLineaCellInSameOcGroup();
            if (next && next.cell) {
                // Copiar el valor en la siguiente fila del mismo grupo y dejarla lista para seguir con Enter
                persistLineaValue(next.rowIndex, newValue, next.cell);
                setTimeout(() => {
                    try { editLinea(next.cell, next.rowIndex); } catch (e) { console.error('Error avanzando LINEA:', e); }
                }, 0);
            }
        }
    };

    // Guardar al presionar Enter
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishEdit(true);
        } else if (e.key === 'Escape') {
            // Cancelar edici?n
            span.style.display = '';
            input.remove();
            finished = true;
        }
    });

    // Guardar al perder foco
    input.addEventListener('blur', () => finishEdit(false));

    // Mantener el texto en mayusculas y respetar el limite del campo
    input.addEventListener('input', () => {
        input.value = input.value.toUpperCase().slice(0, 30);
    });
}

// --- FUNCION PARA EDITAR PDS CON DOBLE CLICK EN HABILITADO ---
function editPds(cell, rowIndex) {
    // PROTECCION: No permitir escritura en encabezados
    if (rowIndex < 1 || !rawData[rowIndex]) {
        console.error('PROTECCION editPds: rowIndex invalido=' + rowIndex);
        return;
    }
    // Evitar abrir mas de un editor en la misma celda
    if (cell.querySelector('input')) return;

    const idxPdsGiradas = findHeaderIndexCaseInsensitive('PDS GIRADAS');
    const idxPds = findHeaderIndexCaseInsensitive('PDS');
    const targetColIndex = (idxPdsGiradas !== -1) ? idxPdsGiradas : idxPds;
    if (targetColIndex === -1) {
        console.error('editPds: no se encontro columna PDS GIRADAS / PDS');
        return;
    }

    const currentRaw = rawData[rowIndex][targetColIndex];
    const currentValue = Math.max(0, Math.round(parseFloat(currentRaw) || 0));

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.value = String(currentValue);
    input.className = 'pds-input';
    input.style.cssText = 'width: 72px; text-align: center; padding: 2px 4px; border: 1px solid var(--primary); border-radius: 4px; font-size: 11px; outline: none;';

    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (keepChanges) => {
        if (finished) return;
        finished = true;

        let newValue = currentValue;
        if (keepChanges) {
            const parsed = parseInt(input.value, 10);
            if (Number.isInteger(parsed) && parsed >= 0) newValue = parsed;
        }

        cell.setAttribute('data-value', String(newValue));
        cell.textContent = formatThousands(newValue, 0);

        if (keepChanges && newValue !== currentValue) {
            rawData[rowIndex][targetColIndex] = newValue;
            const colToSave = (targetColIndex === idxPdsGiradas) ? 'PDS GIRADAS' : 'PDS';
            updateRow(rowIndex, colToSave, newValue, null);
            setTimeout(() => { try { renderHabilitado(); } catch (e) { } }, 120);
        }
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finish(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
        }
    });

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('input', () => {
        input.value = String(input.value || '').replace(/[^\d]/g, '');
    });
}

// --- FUNCI?N PARA EDITAR OBSERVACIONES CON DOBLE CLICK ---
function editObservaciones(cell, rowIndex) {
    let effectiveRowIndex = rowIndex;
    try {
        const tr = (cell && typeof cell.closest === 'function') ? cell.closest('tr[data-row-index]') : null;
        const domRowIndex = tr ? parseInt(tr.getAttribute('data-row-index'), 10) : NaN;
        if (Number.isInteger(domRowIndex) && domRowIndex >= 1) effectiveRowIndex = domRowIndex;
    } catch (e) { }

    // PROTECCI?N: No permitir escritura en encabezados
    if (effectiveRowIndex < 1 || !rawData[effectiveRowIndex]) {
        console.error('PROTECCI?N editObservaciones: rowIndex inv?lido=' + effectiveRowIndex);
        return;
    }
    // Evitar abrir m?s de un editor en la misma celda
    if (cell.querySelector('textarea')) return;

    const span = cell.querySelector('.observaciones-display');
    const currentValue = String(
        getVal(rawData[effectiveRowIndex], 'OBSERVACIONES')
        || getVal(rawData[effectiveRowIndex], 'OBSERVACION')
        || getVal(rawData[effectiveRowIndex], 'OBS')
        || ''
    );

    const textarea = document.createElement('textarea');
    textarea.value = currentValue;
    textarea.className = 'observaciones-input';
    textarea.rows = 2;
    textarea.style.cssText = 'width:100%; min-height:44px; resize:vertical; padding:4px 6px; border:1px solid var(--primary); border-radius:4px; font-size:10px; font-family:Calibri,sans-serif; outline:none; box-sizing:border-box;';

    if (span) span.style.display = 'none';
    cell.appendChild(textarea);
    cell.style.padding = '2px';
    textarea.focus();
    try { textarea.setSelectionRange(textarea.value.length, textarea.value.length); } catch (e) { }

    const finish = (keepChanges) => {
        if (keepChanges) {
            const newValue = textarea.value.trim();
            if (newValue !== currentValue.trim()) {
                let idxObs = findHeaderIndexCaseInsensitive('OBSERVACIONES');
                let obsColName = 'OBSERVACIONES';
                if (idxObs === -1) {
                    idxObs = findHeaderIndexCaseInsensitive('OBSERVACION');
                    if (idxObs !== -1) obsColName = 'OBSERVACION';
                }
                if (idxObs === -1) {
                    idxObs = findHeaderIndexCaseInsensitive('OBS');
                    if (idxObs !== -1) obsColName = 'OBS';
                }
                if (idxObs !== -1 && rawData[effectiveRowIndex]) {
                    rawData[effectiveRowIndex][idxObs] = newValue;
                }
                if (span) span.textContent = newValue;
                cell.title = newValue;
                updateRow(effectiveRowIndex, obsColName, newValue, null);
            } else if (span) {
                span.textContent = currentValue;
            }
        } else if (span) {
            span.textContent = currentValue;
        }

        if (span) span.style.display = '';
        textarea.remove();
        cell.style.padding = '';
    };

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            finish(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
        }
    });

    textarea.addEventListener('blur', () => finish(true));
}

