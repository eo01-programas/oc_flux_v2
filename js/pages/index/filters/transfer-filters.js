// ============ FUNCIONES DEL MENU CONTEXTUAL PARA TRANSFER ============
let transferContextMenuField = null;

window.showTransferContextMenu = function (event, fieldName) {
    event.preventDefault();
    event.stopPropagation();

    transferContextMenuField = fieldName;
    const menu = document.getElementById('transfer-context-menu');
    const fieldLabel = document.getElementById('transfer-filter-field');
    const input = document.getElementById('transfer-filter-input');
    const select = document.getElementById('transfer-filter-select');

    if (!menu || !fieldLabel) return;
    fieldLabel.textContent = fieldName;

    const useDropdown = ['HOD', 'F.ING.COST', 'CLIENTE', 'RUTA', 'OC', 'COLOR'].includes(fieldName);
    if (useDropdown) {
        select.style.display = 'block';
        input.style.display = 'none';
        populateTransferFilterSelect(fieldName);
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

window.hideTransferContextMenu = function () {
    const menu = document.getElementById('transfer-context-menu');
    if (menu) menu.classList.remove('active');
    transferContextMenuField = null;
};

window.clearTransferFilter = function () {
    transferHeaderFilters = [];
    transferHeaderFilter = null;
    hideTransferContextMenu();
    renderTransfer();
};

window.applyTransferFilter = function () {
    if (!transferContextMenuField) { hideTransferContextMenu(); return; }

    const input = document.getElementById('transfer-filter-input');
    const select = document.getElementById('transfer-filter-select');
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
    const existingIdx = transferHeaderFilters.findIndex(f => f.field.toUpperCase() === transferContextMenuField.toUpperCase());
    const newFilter = { field: transferContextMenuField, value: filterValue };
    if (existingIdx !== -1) {
        transferHeaderFilters[existingIdx] = newFilter;
    } else {
        transferHeaderFilters.push(newFilter);
    }
    transferHeaderFilter = transferHeaderFilters[0] || null;
    hideTransferContextMenu();
    renderTransfer();
};

function populateTransferFilterSelect(fieldName) {
    const select = document.getElementById('transfer-filter-select');
    if (!select) return;
    while (select.options.length > 1) select.remove(1);

    const values = new Set();
    let hasEmptyValue = false;

    const passesCurrentFilters = (row, excludeField) => {
        if (!transferHeaderFilter || transferHeaderFilter.field.toUpperCase() === excludeField.toUpperCase()) return true;

        const f = transferHeaderFilter.field;
        const v = String(transferHeaderFilter.value).toUpperCase().trim();
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
        const tipoTransfer = (getVal(row, 'tipo-transfer') || '').toString().toUpperCase().trim();
        if (!tipoTransfer) continue;

        const estadoTransfer = (getVal(row, 'estado_transfer') || '').toString().toUpperCase().trim();
        if (currentTransferFilter === 'X PROG') {
            if (estadoTransfer !== '' && estadoTransfer !== 'X PROG') continue;
        } else if (currentTransferFilter === 'PROG') {
            if (estadoTransfer === '' || estadoTransfer === 'X PROG' || estadoTransfer === 'OK') continue;
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

function setupTransferHeaderFilterMenu() {
    const allowedFields = ['HOD', 'F.ING.COST', 'CLIENTE', 'RUTA', 'OC', 'COLOR'];
    const thead = document.querySelector('#table-container-transfer-normal table thead');
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
            if (matchedField) showTransferContextMenu(event, matchedField);
        };
    });
}
