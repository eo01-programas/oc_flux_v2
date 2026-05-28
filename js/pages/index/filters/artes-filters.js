// ============ FUNCIONES DEL MENU CONTEXTUAL PARA ARTES ============
let artesContextMenuField = null;

window.showArtesContextMenu = function (event, fieldName) {
    event.preventDefault();
    event.stopPropagation();

    artesContextMenuField = fieldName;
    const menu = document.getElementById('artes-context-menu');
    const fieldLabel = document.getElementById('artes-filter-field');
    const input = document.getElementById('artes-filter-input');
    const select = document.getElementById('artes-filter-select');

    if (!menu || !fieldLabel) return;
    fieldLabel.textContent = fieldName;

    const useDropdown = ['HOD', 'STATUS', 'CLIENTE', 'F.ING.COST', 'COLOR'].includes(fieldName);
    if (useDropdown) {
        select.style.display = 'block';
        input.style.display = 'none';
        populateArtesFilterSelect(fieldName);
    } else {
        select.style.display = 'none';
        input.style.display = 'block';
        input.value = '';
        input.focus();
    }

    menu.classList.add('active');
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
};

window.hideArtesContextMenu = function () {
    const menu = document.getElementById('artes-context-menu');
    if (menu) menu.classList.remove('active');
    artesContextMenuField = null;
};

window.clearArtesFilter = function () {
    artesHeaderFilters = [];
    artesHeaderFilter = null;
    hideArtesContextMenu();
    renderArtes();
};

window.applyArtesFilter = function () {
    if (!artesContextMenuField) { hideArtesContextMenu(); return; }

    const input = document.getElementById('artes-filter-input');
    const select = document.getElementById('artes-filter-select');
    let filterValue = '';
    let isFromSelect = false;

    if (select && select.style.display !== 'none') {
        isFromSelect = true;
        if (select.selectedIndex === 0) {
            alert('Por favor seleccione un valor para filtrar.');
            return;
        }
        filterValue = select.value;
    } else if (input && input.style.display !== 'none') {
        filterValue = input.value.trim();
    }

    if (!isFromSelect && filterValue === '') {
        alert('Por favor ingrese un valor para filtrar.');
        return;
    }

    // Agregar o actualizar filtro en el array
    const existingIdx = artesHeaderFilters.findIndex(f => f.field.toUpperCase() === artesContextMenuField.toUpperCase());
    const newFilter = { field: artesContextMenuField, value: filterValue };
    if (existingIdx !== -1) {
        artesHeaderFilters[existingIdx] = newFilter;
    } else {
        artesHeaderFilters.push(newFilter);
    }
    artesHeaderFilter = artesHeaderFilters[0] || null;
    hideArtesContextMenu();
    renderArtes();
};

function populateArtesFilterSelect(fieldName) {
    const select = document.getElementById('artes-filter-select');
    if (!select) return;
    while (select.options.length > 1) select.remove(1);

    const values = new Set();
    let hasEmptyValue = false;

    // Determinar que tipo de artes estamos filtrando (Bordado o Estampado)
    const isBordado = window.currentArtesFilter === 'BORDADO';
    const isEstampado = window.currentArtesFilter === 'ESTAMPADO';
    const idxEstadoEnumerado = findHeaderIndexCaseInsensitive('estado_enumerado');
    const getArtesStatusValue = function (row) {
        let ev = '';
        try {
            if (idxEstadoEnumerado !== -1 && row && row[idxEstadoEnumerado] !== undefined) {
                ev = row[idxEstadoEnumerado];
            } else {
                ev = getVal(row, 'estado_enumerado') || getVal(row, 'ESTADO ENUMERADO') || getVal(row, 'ESTADO_ENumerado') || '';
            }
        } catch (e) {
            ev = getVal(row, 'estado_enumerado') || '';
        }
        const evNorm = (ev || '').toString().toUpperCase().trim();
        return getHabilitadoStatusValue(row, evNorm) || '';
    };

    // Funcion auxiliar para verificar si una fila pasa los filtros actuales (excepto el campo que estamos poblando)
    const passesCurrentFilters = (row, excludeField) => {
        const filtersToCheck = artesHeaderFilters && artesHeaderFilters.length > 0
            ? artesHeaderFilters
            : (artesHeaderFilter ? [artesHeaderFilter] : []);
        if (filtersToCheck.length === 0) return true;
        for (let afi = 0; afi < filtersToCheck.length; afi++) {
            const af = filtersToCheck[afi];
            if (af.field.toUpperCase() === excludeField.toUpperCase()) continue;
            const f = af.field;
            const v = String(af.value).toUpperCase().trim();
            try {
                let cellValue = '';
                if (f === 'HOD') cellValue = formatValue(getVal(row, 'HOD'), 'date') || '';
                else if (f === 'F.ING.COST') {
                    const rawFIng = getVal(row, 'F.ING.COST');
                    const dateValue = convertToDateInputFormat(rawFIng);
                    cellValue = formatDateShortFromInput(dateValue) || '';
                }
                else if (f === 'CLIENTE') cellValue = normalizeClientName(getVal(row, 'CLIENTE')) || '';
                else if (f === 'STATUS') cellValue = getArtesStatusValue(row) || '';
                else if (f === 'OC') {
                    const op = String(getVal(row, 'OP') || '').trim();
                    const corte = String(getVal(row, 'CORTE') || '').trim();
                    cellValue = op + '-' + corte;
                }
                else if (f === 'COLOR') cellValue = String(getVal(row, 'COLOR') || '');

                const cellValueUpper = String(cellValue).toUpperCase();
                if (v === '') { if (cellValueUpper !== '') return false; }
                else { if (cellValueUpper.indexOf(v) === -1) return false; }
            } catch (e) { return false; }
        }
        return true;
    };

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];

        if (isBordado) {
            const tipoBordado = (getVal(row, 'tipo-bordado') || '').toString().toUpperCase().trim();
            if (!tipoBordado) continue;
            const estadoBordado = (getVal(row, 'estado_bordado') || '').toString().toUpperCase().trim();
            const currentSubFilter = window.currentArtesBordadoFilter || 'X PROG';
            if (currentSubFilter === 'X PROG') {
                if (estadoBordado !== '' && estadoBordado !== 'X PROG') continue;
            } else if (currentSubFilter === 'PROG') {
                if (estadoBordado === '' || estadoBordado === 'X PROG' || estadoBordado === 'OK') continue;
            }
        } else if (isEstampado) {
            const tipoEstampado = (getVal(row, 'tipo-estampado') || '').toString().toUpperCase().trim();
            if (!tipoEstampado) continue;
            const estadoEstampado = (getVal(row, 'estado_estampado') || '').toString().toUpperCase().trim();
            const currentSubFilter = window.currentArtesEstampadoFilter || 'X PROG';
            if (currentSubFilter === 'X PROG') {
                if (estadoEstampado !== '' && estadoEstampado !== 'X PROG') continue;
            } else if (currentSubFilter === 'PROG') {
                if (estadoEstampado === '' || estadoEstampado === 'X PROG' || estadoEstampado === 'OK') continue;
            }
        } else {
            continue;
        }

        // Verificar si pasa los filtros actuales (excepto el campo actual)
        if (!passesCurrentFilters(row, fieldName)) continue;

        let fieldValue = '';
        switch (fieldName) {
            case 'HOD': fieldValue = formatValue(getVal(row, 'HOD'), 'date') || ''; break;
            case 'F.ING.COST':
                const rawFIng = getVal(row, 'F.ING.COST');
                const dateValue = convertToDateInputFormat(rawFIng);
                fieldValue = formatDateShortFromInput(dateValue) || '';
                break;
            case 'STATUS':
                fieldValue = getArtesStatusValue(row) || '';
                break;
            case 'CLIENTE': fieldValue = normalizeClientName(getVal(row, 'CLIENTE')) || ''; break;
            case 'OC':
                const op = String(getVal(row, 'OP') || '').trim();
                const corte = String(getVal(row, 'CORTE') || '').trim();
                fieldValue = (op + '-' + corte) || '';
                break;
            case 'COLOR': fieldValue = String(getVal(row, 'COLOR') || '').trim(); break;
        }
        if (fieldValue) {
            values.add(fieldValue);
        } else {
            hasEmptyValue = true;
        }
    }

    const sortedValues = Array.from(values).sort((a, b) => {
        if (fieldName === 'HOD' || fieldName === 'F.ING.COST') {
            return compareDates(a, b);
        }
        return a.localeCompare(b);
    });
    sortedValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });

    if (hasEmptyValue) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '(VAC?O)';
        select.appendChild(option);
    }
}

function setupArtesHeaderFilterMenu() {
    const allowedFields = ['HOD', 'STATUS', 'CLIENTE', 'F.ING.COST', 'OC', 'COLOR'];

    // Configurar para tabla Bordado
    const theadBordado = document.querySelector('#table-container-artes-bordado table thead');
    if (theadBordado) {
        theadBordado.querySelectorAll('th').forEach(th => {
            th.oncontextmenu = function (event) {
                let headerText = th.textContent.trim().replace(/\s+/g, ' ');
                let matchedField = null;
                for (let field of allowedFields) {
                    if (headerText.indexOf(field) === 0 || field.indexOf(headerText) === 0) {
                        matchedField = field;
                        break;
                    }
                }
                if (matchedField) showArtesContextMenu(event, matchedField);
            };
        });
    }

    // Configurar para tabla Estampado
    const theadEstampado = document.querySelector('#table-container-artes-estampado table thead');
    if (theadEstampado) {
        theadEstampado.querySelectorAll('th').forEach(th => {
            th.oncontextmenu = function (event) {
                let headerText = th.textContent.trim().replace(/\s+/g, ' ');
                let matchedField = null;
                for (let field of allowedFields) {
                    if (headerText.indexOf(field) === 0 || field.indexOf(headerText) === 0) {
                        matchedField = field;
                        break;
                    }
                }
                if (matchedField) showArtesContextMenu(event, matchedField);
            };
        });
    }
}
