// ============ FUNCIONES DEL MENU CONTEXTUAL PARA LAVADO ============
let lavadoContextMenuField = null;

window.showLavadoContextMenu = function (event, fieldName) {
    event.preventDefault();
    event.stopPropagation();

    lavadoContextMenuField = fieldName;
    const menu = document.getElementById('lavado-context-menu');
    const fieldLabel = document.getElementById('lavado-filter-field');
    const input = document.getElementById('lavado-filter-input');
    const select = document.getElementById('lavado-filter-select');

    if (!menu || !fieldLabel) return;
    fieldLabel.textContent = fieldName;

    const useDropdown = ['HOD', 'F.ING.COST', 'CLIENTE', 'COLOR'].includes(fieldName);
    if (useDropdown) {
        select.style.display = 'block';
        input.style.display = 'none';
        populateLavadoFilterSelect(fieldName);
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

window.hideLavadoContextMenu = function () {
    const menu = document.getElementById('lavado-context-menu');
    if (menu) menu.classList.remove('active');
    lavadoContextMenuField = null;
};

window.clearLavadoFilter = function () {
    lavadoHeaderFilter = null;
    hideLavadoContextMenu();
    renderLavado();
};

window.applyLavadoFilter = function () {
    if (!lavadoContextMenuField) { hideLavadoContextMenu(); return; }

    const input = document.getElementById('lavado-filter-input');
    const select = document.getElementById('lavado-filter-select');
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

    lavadoHeaderFilter = { field: lavadoContextMenuField, value: filterValue };
    hideLavadoContextMenu();
    renderLavado();
};

function populateLavadoFilterSelect(fieldName) {
    const select = document.getElementById('lavado-filter-select');
    if (!select) return;
    while (select.options.length > 1) select.remove(1);

    const values = new Set();
    let hasEmptyValue = false;

    const passesCurrentFilters = (row, excludeField) => {
        if (!lavadoHeaderFilter || lavadoHeaderFilter.field.toUpperCase() === excludeField.toUpperCase()) return true;

        const f = lavadoHeaderFilter.field;
        const v = String(lavadoHeaderFilter.value).toUpperCase().trim();
        try {
            let cellValue = '';
            if (f === 'HOD') cellValue = formatValue(getVal(row, 'HOD'), 'date') || '';
            else if (f === 'F.ING.COST') {
                const rawFIng = getVal(row, 'F.ING.COST');
                const dateValue = convertToDateInputFormat(rawFIng);
                cellValue = formatDateShortFromInput(dateValue) || '';
            }
            else if (f === 'CLIENTE') cellValue = normalizeClientName(getVal(row, 'CLIENTE')) || '';
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
        const estadoLavada = (getVal(row, 'estado_lavada') || '').toString().toUpperCase().trim();
        if (estadoLavada === 'OK') continue;
        const rutaTela = (getVal(row, 'RUTA TELA') || '').toString().toUpperCase().trim();
        if (rutaTela !== 'LAVADA') continue;

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

function setupLavadoHeaderFilterMenu() {
    const allowedFields = ['HOD', 'F.ING.COST', 'CLIENTE', 'OP-PTDA', 'OC', 'COLOR'];
    const thead = document.querySelector('#view-lavado table thead');
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
            if (matchedField) showLavadoContextMenu(event, matchedField);
        };
    });
}
