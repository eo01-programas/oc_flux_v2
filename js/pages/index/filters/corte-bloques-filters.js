// ============ FUNCIONES DEL MENU CONTEXTUAL PARA CORTE BLOQUES ============
let corteBloquesContextMenuField = null;

window.showCorteBloquesContextMenu = function (event, fieldName) {
    event.preventDefault();
    event.stopPropagation();

    corteBloquesContextMenuField = fieldName;
    const menu = document.getElementById('corte-bloques-context-menu');
    const fieldLabel = document.getElementById('corte-bloques-filter-field');
    const input = document.getElementById('corte-bloques-filter-input');
    const select = document.getElementById('corte-bloques-filter-select');

    if (!menu || !fieldLabel) return;
    fieldLabel.textContent = fieldName;

    const useDropdown = ['HOD', 'F.ING.COST', 'CLIENTE', 'RUTA', 'OP-PTDA', 'OC', 'COLOR'].includes(fieldName);
    if (useDropdown) {
        select.style.display = 'block';
        input.style.display = 'none';
        populateCorteBloquesFilterSelect(fieldName);
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

window.hideCorteBloquesContextMenu = function () {
    const menu = document.getElementById('corte-bloques-context-menu');
    if (menu) menu.classList.remove('active');
    corteBloquesContextMenuField = null;
};

window.clearCorteBloquesFilter = function () {
    corteBloquesHeaderFilter = null;
    hideCorteBloquesContextMenu();
    renderCorteBloques();
};

window.applyCorteBloquesFilter = function () {
    if (!corteBloquesContextMenuField) { hideCorteBloquesContextMenu(); return; }

    const input = document.getElementById('corte-bloques-filter-input');
    const select = document.getElementById('corte-bloques-filter-select');
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

    corteBloquesHeaderFilter = { field: corteBloquesContextMenuField, value: filterValue };
    hideCorteBloquesContextMenu();
    renderCorteBloques();
};

function populateCorteBloquesFilterSelect(fieldName) {
    const select = document.getElementById('corte-bloques-filter-select');
    if (!select) return;
    while (select.options.length > 1) select.remove(1);

    const values = new Set();
    let hasEmptyValue = false;

    const passesCurrentFilters = (row, excludeField) => {
        if (!corteBloquesHeaderFilter || corteBloquesHeaderFilter.field.toUpperCase() === excludeField.toUpperCase()) return true;

        const f = corteBloquesHeaderFilter.field;
        const v = String(corteBloquesHeaderFilter.value).toUpperCase().trim();
        try {
            let cellValue = '';
            if (f === 'HOD') cellValue = formatValue(getVal(row, 'HOD'), 'date') || '';
            else if (f === 'F.ING.COST') {
                const rawFIng = getVal(row, 'F.ING.COST');
                const dateValue = convertToDateInputFormat(rawFIng);
                cellValue = formatDateShortFromInput(dateValue) || '';
            }
            else if (f === 'CLIENTE') cellValue = normalizeClientName(getVal(row, 'CLIENTE')) || '';
            else if (f === 'RUTA') {
                const rutaTela = (getVal(row, 'RUTA TELA') || '').toString().toUpperCase().trim();
                if (rutaTela === 'LAVADA') cellValue = 'LAVADA';
                else if (rutaTela === 'ACABADA') cellValue = 'ACABADA';
            }
            else if (f === 'OP-PTDA') {
                const opTela = String(getVal(row, 'OP TELA') || '').trim();
                const partida = String(getVal(row, 'PARTIDA') || '').trim();
                cellValue = opTela + '-' + partida;
            }
            else if (f === 'OC') {
                const op = String(getVal(row, 'OP') || '').trim();
                const corte = String(getVal(row, 'CORTE') || '').trim();
                cellValue = op + '-' + corte;
            }
            else if (f === 'COLOR') cellValue = String(getVal(row, 'COLOR') || '');

            const cellValueUpper = String(cellValue).toUpperCase();
            if (v === '') return cellValueUpper === '';
            return cellValueUpper.indexOf(v) !== -1;
        } catch (e) { return false; }
    };

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const estadoBloqueo = (getVal(row, 'estado_bloqueo') || '').toString().toUpperCase().trim();
        const tieneBloque = (getVal(row, 'BLOQUES?') || '').toString().toUpperCase().trim();
        if (tieneBloque !== 'SI') continue;

        const estadoBloqs = (getVal(row, 'ESTADO_BLOQS') || '').toString().toUpperCase().trim();
        if (currentCorteBloquesFilter === 'X PROG') {
            if (estadoBloqs !== '' && estadoBloqs !== 'X PROG') continue;
        } else if (currentCorteBloquesFilter === 'PROG') {
            if (estadoBloqs === '' || estadoBloqs === 'X PROG' || estadoBloqs === 'OK') continue;
        }

        if (!passesCurrentFilters(row, fieldName)) continue;

        let fieldValue = '';
        switch (fieldName) {
            case 'HOD': fieldValue = formatValue(getVal(row, 'HOD'), 'date') || ''; break;
            case 'F.ING.COST':
                const rawFIng = getVal(row, 'F.ING.COST');
                const dateValue = convertToDateInputFormat(rawFIng);
                fieldValue = formatDateShortFromInput(dateValue) || '';
                break;
            case 'CLIENTE': fieldValue = normalizeClientName(getVal(row, 'CLIENTE')) || ''; break;
            case 'RUTA':
                const rutaTela = (getVal(row, 'RUTA TELA') || '').toString().toUpperCase().trim();
                if (rutaTela === 'LAVADA') fieldValue = 'LAVADA';
                else if (rutaTela === 'ACABADA') fieldValue = 'ACABADA';
                break;
            case 'OP-PTDA':
                const opTela = String(getVal(row, 'OP TELA') || '').trim();
                const partida = String(getVal(row, 'PARTIDA') || '').trim();
                fieldValue = (opTela + '-' + partida) || '';
                break;
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

function setupCorteBloquesHeaderFilterMenu() {
    const allowedFields = ['HOD', 'F.ING.COST', 'CLIENTE', 'RUTA', 'OP-PTDA', 'OC', 'COLOR'];
    const thead = document.querySelector('#view-corte-bloques table thead');
    if (!thead) return;

    thead.querySelectorAll('th').forEach(th => {
        th.oncontextmenu = function (event) {
            let headerText = th.textContent.trim().replace(/\s+/g, ' ');
            let matchedField = null;
            for (let field of allowedFields) {
                if (headerText.indexOf(field) === 0 || field.indexOf(headerText) === 0) {
                    matchedField = field;
                    break;
                }
            }
            if (matchedField) showCorteBloquesContextMenu(event, matchedField);
        };
    });
}
