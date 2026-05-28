function initializeHabilitadoHeaderContextMenus() {
    const allowedFields = ['PLANTA', 'LINEA', 'HOD', 'F.ING.COST', 'F.ING', 'F.HAB', 'STATUS', 'CLIENTE', 'CLI', 'OP-PTDA', 'OC', 'COLOR', 'P'];

    const thead = document.querySelector('#view-habilitado table thead');
    if (!thead) return;

    const ths = thead.querySelectorAll('th');
    ths.forEach(th => {
        th.oncontextmenu = function (event) {
            // Obtener el texto del encabezado
            let headerText = th.textContent.trim().toUpperCase();

            // Limpiar el texto del encabezado (puede tener espacios extra o caracteres especiales)
            headerText = headerText.replace(/\s+/g, ' ').trim();

            // Verificar si es un campo permitido (buscar coincidencia exacta primero)
            let matchedField = null;
            for (let field of allowedFields) {
                if (headerText === field.toUpperCase() || headerText === field) {
                    matchedField = field;
                    break;
                }
            }

            // Si no hay coincidencia exacta, buscar parcial
            if (!matchedField) {
                for (let field of allowedFields) {
                    if (headerText.indexOf(field.toUpperCase()) === 0 || field.toUpperCase().indexOf(headerText) === 0) {
                        matchedField = field;
                        break;
                    }
                }
            }

            if (matchedField) {
                showHabilitadoContextMenu(event, matchedField);
            }
        };
    });
}

// Funciones para el menu contextual de filtro en Habilitado
const HABILITADO_FILTER_PLACEHOLDER = '__HAB_SELECT__';
const HABILITADO_FILTER_EMPTY = '__HAB_EMPTY__';
let habilitadoContextMenuField = null;
let habilitadoContextMenuX = 0;
let habilitadoContextMenuY = 0;

function matchesHabilitadoFilterValue(fieldName, fieldValue, filterValueRaw) {
    const fv = String(fieldValue || '').toUpperCase().trim();
    const rv = String(filterValueRaw || '').toUpperCase().trim();

    if (rv === HABILITADO_FILTER_PLACEHOLDER) return false;
    if (rv === HABILITADO_FILTER_EMPTY) return fv === '';

    if (fieldName === 'HOD' && rv.indexOf('||') !== -1) {
        const selectedDates = rv.split('||').map(v => v.trim()).filter(v => v !== '');
        if (selectedDates.length === 0) return false;
        return selectedDates.includes(fv);
    }

    if (fieldName === 'F.HAB') {
        const fvKey = getHabilitadoFHabDateKey(fv);
        const rvKey = getHabilitadoFHabDateKey(rv);
        if (fvKey && rvKey) return fvKey === rvKey;
        const fvNorm = normalizeHabilitadoFHabToken(fv);
        const rvNorm = normalizeHabilitadoFHabToken(rv);
        if (rvNorm === '') return fvNorm === '';
        return fvNorm === rvNorm;
    }

    if (rv === '') return fv === '';
    return fv.indexOf(rv) !== -1;
}

window.showHabilitadoContextMenu = function (event, fieldName) {
    event.preventDefault();
    event.stopPropagation();

    habilitadoContextMenuField = fieldName;
    habilitadoContextMenuX = event.clientX;
    habilitadoContextMenuY = event.clientY;

    const menu = document.getElementById('habilitado-context-menu');
    if (!menu) return;

    const input = document.getElementById('habilitado-filter-input');
    const select = document.getElementById('habilitado-filter-select');

    document.getElementById('habilitado-filter-field').textContent = (fieldName === 'F.ING' ? 'F.ING.Prog' : fieldName);

    const dropdownFields = ['HOD', 'F.ING.COST', 'F.ING', 'F.HAB', 'STATUS', 'CLIENTE', 'CLI', 'PLANTA', 'LINEA'];

    if (dropdownFields.includes(fieldName)) {
        input.style.display = 'none';
        select.style.display = 'block';
        select.value = HABILITADO_FILTER_PLACEHOLDER;

        if (fieldName === 'HOD') {
            select.multiple = true;
            select.size = 10;
        } else {
            select.multiple = false;
            select.size = 1;
        }

        populateHabilitadoFilterSelect(fieldName);
        select.focus();
    } else {
        select.multiple = false;
        select.size = 1;
        select.style.display = 'none';
        input.style.display = 'block';
        input.value = '';
        input.focus();
    }

    menu.classList.add('active');

    if (fieldName === 'PLANTA' || fieldName === 'LINEA') {
        const menuWidth = 220;
        menu.style.left = (habilitadoContextMenuX - menuWidth) + 'px';
    } else {
        menu.style.left = habilitadoContextMenuX + 'px';
    }
    menu.style.top = habilitadoContextMenuY + 'px';
};

function populateHabilitadoFilterSelect(fieldName) {
    const select = document.getElementById('habilitado-filter-select');
    if (!select) return;

    // Limpiar opciones existentes (excepto la primera)
    while (select.options.length > 1) {
        select.remove(1);
    }

    const values = new Set();
    let hasEmptyValue = false;
    const getActiveFilters = () => {
        const filtersToCheck = habilitadoHeaderFilters && habilitadoHeaderFilters.length > 0
            ? habilitadoHeaderFilters
            : (habilitadoHeaderFilter ? [habilitadoHeaderFilter] : []);
        return filtersToCheck;
    };

    // Iterar sobre los datos validos segun el sub-tab actual
    const idxHabil = findHeaderIndexCaseInsensitive('estado_habilitado');
    const idxEv = findHeaderIndexCaseInsensitive('estado_enumerado');

    // Funcion auxiliar para calcular STATUS de una fila
    const calcStatus = (row) => {
        let ev = '';
        try {
            if (idxEv !== -1 && row[idxEv] !== undefined) ev = row[idxEv];
            else ev = getVal(row, 'estado_enumerado') || '';
        } catch (e) { ev = ''; }
        const evNorm = (ev || '').toString().toUpperCase().trim();
        return getHabilitadoStatusValue(row, evNorm);
    };

    // Funcion auxiliar para verificar si una fila pasa los filtros actuales (excepto el campo que estamos poblando)
    const passesCurrentFilters = (row, excludeField) => {
        const filtersToCheck = getActiveFilters();
        const remainingFilters = filtersToCheck.filter(f => f.field.toUpperCase() !== excludeField.toUpperCase());
        if (remainingFilters.length === 0) return true;

        return remainingFilters.every((filter) => {
            const f = filter.field;
            const v = String(filter.value).toUpperCase().trim();
            try {
                let cellValue = '';
                if (f === 'HOD') cellValue = formatValue(getVal(row, 'HOD'), 'date') || '';
                else if (f === 'F.ING.COST') {
                    const rawFIng = getVal(row, 'F.ING.COST');
                    const dateValue = convertToDateInputFormat(rawFIng);
                    cellValue = formatDateShortFromInput(dateValue) || '';
                }
                else if (f === 'STATUS') cellValue = calcStatus(row) || '';
                else if (f === 'CLIENTE' || f === 'CLI') cellValue = normalizeClientName(getVal(row, 'CLIENTE')) || '';
                else if (f === 'F.ING') {
                    const rawFIngF = getVal(row, 'F.ING.COST');
                    cellValue = getHabilitadoDayMonthLabel(rawFIngF) || '';
                }
                else if (f === 'F.HAB') {
                    cellValue = getHabilitadoFHabDateKey(getRawFIngRealFromRow(row)) || '';
                }
                else if (f === 'PLANTA') {
                    cellValue = (getVal(row, 'PLANTA') || '').toString().trim();
                    if (cellValue === '') cellValue = 'XASIG';
                }
                else if (f === 'LINEA') {
                    cellValue = (getVal(row, 'LINEA') || '').toString().trim();
                    if (cellValue === '') cellValue = 'XASIG';
                }

                const cellValueUpper = String(cellValue).toUpperCase();
                return matchesHabilitadoFilterValue(f, cellValueUpper, v);
            } catch (e) { return false; }
        });
    };

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];

        // Filtrar segun el sub-tab actual
        let habilVal = '';
        if (idxHabil !== -1 && row[idxHabil] !== undefined) habilVal = row[idxHabil];
        else habilVal = getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || '';
        const habilNorm = (habilVal || '').toString().toUpperCase().trim();

        // Filtrar segun el sub-tab seleccionado
        if (currentHabilitadoFilter === 'X PROG') {
            if (habilNorm !== '' && habilNorm !== 'X PROG') continue;
        } else if (currentHabilitadoFilter === 'S/DESTINO') {
            const plantaPop = (getVal(row, 'PLANTA') || '').toString().toUpperCase().trim();
            if ((plantaPop !== 'S/DESTINO' || habilNorm === 'OK') && habilNorm !== 'OK S/DESTINO') continue;
        } else {
            // Para otros sub-tabs (PROG 1T, 2T, 3T), filtrar por ese estado
            if (habilNorm !== currentHabilitadoFilter) continue;
        }

        // Verificar si pasa los filtros actuales (excepto el campo actual)
        if (!passesCurrentFilters(row, fieldName)) continue;

        let fieldValue = '';

        switch (fieldName) {
            case 'HOD':
                fieldValue = formatValue(getVal(row, 'HOD'), 'date') || '';
                break;
            case 'F.ING.COST':
                const rawFIng = getVal(row, 'F.ING.COST');
                const dateValue = convertToDateInputFormat(rawFIng);
                fieldValue = formatDateShortFromInput(dateValue) || '';
                break;
            case 'STATUS':
                fieldValue = calcStatus(row);
                break;
            case 'CLIENTE':
                // Usar normalizeClientName para obtener el nombre corto del cliente
                fieldValue = normalizeClientName(getVal(row, 'CLIENTE')) || '';
                break;
            case 'CLI':
                fieldValue = normalizeClientName(getVal(row, 'CLIENTE')) || '';
                break;
            case 'F.ING':
                const rawFIngAlt = getVal(row, 'F.ING.COST');
                fieldValue = getHabilitadoDayMonthLabel(rawFIngAlt) || '';
                break;
            case 'F.HAB':
                fieldValue = getHabilitadoFHabDateKey(getRawFIngRealFromRow(row)) || '';
                break;
            case 'PLANTA':
                fieldValue = (getVal(row, 'PLANTA') || '').toString().trim();
                if (fieldValue === '') fieldValue = 'XASIG';
                break;
            case 'LINEA':
                fieldValue = (getVal(row, 'LINEA') || '').toString().trim();
                if (fieldValue === '') fieldValue = 'XASIG';
                break;
        }

        if (fieldValue) {
            values.add(fieldValue);
        } else {
            hasEmptyValue = true;
        }
    }

    // Agregar opciones al select, ordenadas
    // Si es fecha (HOD o F.ING.COST), ordenar por fecha; si no, alfabetico
    const sortedValues = Array.from(values).sort((a, b) => {
        if (fieldName === 'F.HAB') {
            return a.localeCompare(b);
        }
        if (fieldName === 'HOD' || fieldName === 'F.ING.COST' || fieldName === 'F.ING') {
            return compareDates(a, b);
        }
        return a.localeCompare(b);
    });
    sortedValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = (fieldName === 'F.HAB')
            ? (getFIngRealDayMonthLabel(value) || value)
            : value;
        select.appendChild(option);
    });

    // Agregar opcion VACIO si hay valores vacios
    if (hasEmptyValue) {
        const option = document.createElement('option');
        option.value = HABILITADO_FILTER_EMPTY;
        option.textContent = '(VACIO)';
        select.appendChild(option);
    }

    if (select.options.length > 0) {
        select.value = HABILITADO_FILTER_PLACEHOLDER;
    }
}

window.hideHabilitadoContextMenu = function () {
    const menu = document.getElementById('habilitado-context-menu');
    if (menu) menu.classList.remove('active');
    habilitadoContextMenuField = null;
};

window.clearHabilitadoFilter = function () {
    habilitadoHeaderFilters = [];
    habilitadoHeaderFilter = null;
    hideHabilitadoContextMenu();
    renderHabilitado();
};

window.applyHabilitadoFilter = function () {
    if (!habilitadoContextMenuField) {
        hideHabilitadoContextMenu();
        return;
    }

    const input = document.getElementById('habilitado-filter-input');
    const select = document.getElementById('habilitado-filter-select');

    let filterValue = '';
    let isFromSelect = false;

    if (input.style.display !== 'none') {
        filterValue = input.value.trim().toUpperCase();
    } else if (select.style.display !== 'none') {
        isFromSelect = true;

        if (habilitadoContextMenuField === 'HOD') {
            const selectedValues = Array.from(select.selectedOptions || [])
                .map(opt => String(opt.value || '').trim())
                .filter(v => v !== '' && v !== HABILITADO_FILTER_PLACEHOLDER);

            if (selectedValues.length === 0) {
                alert('Por favor seleccione al menos una fecha');
                return;
            }

            filterValue = selectedValues.join('||');
        } else {
            filterValue = select.value.trim();
        }
    }

    if (!filterValue && !isFromSelect) {
        alert('Por favor seleccione o ingrese un valor para filtrar');
        return;
    }
    if (isFromSelect && habilitadoContextMenuField !== 'HOD' && select.value === HABILITADO_FILTER_PLACEHOLDER) {
        alert('Por favor seleccione un valor para filtrar');
        return;
    }

    const existingIdx = habilitadoHeaderFilters.findIndex(f => f.field.toUpperCase() === habilitadoContextMenuField.toUpperCase());
    const newFilter = { field: habilitadoContextMenuField, value: filterValue };
    if (existingIdx !== -1) {
        habilitadoHeaderFilters[existingIdx] = newFilter;
    } else {
        habilitadoHeaderFilters.push(newFilter);
    }
    habilitadoHeaderFilter = habilitadoHeaderFilters[0] || null;

    hideHabilitadoContextMenu();
    renderHabilitado();
};

// Cerrar el menu contextual al hacer click fuera
document.addEventListener('click', function (e) {
    const menu = document.getElementById('habilitado-context-menu');
    if (menu && !menu.contains(e.target) && e.target !== document.querySelector('thead')) {
        hideHabilitadoContextMenu();
    }
    // Tambien cerrar otros menus contextuales
    const menuBloqueo = document.getElementById('bloqueo-context-menu');
    if (menuBloqueo && !menuBloqueo.contains(e.target)) hideBloqueoContextMenu();
    const menuCorte = document.getElementById('corte-context-menu');
    if (menuCorte && !menuCorte.contains(e.target)) hideCorteContextMenu();
    const menuEnumerado = document.getElementById('enumerado-context-menu');
    if (menuEnumerado && !menuEnumerado.contains(e.target)) hideEnumeradoContextMenu();
});
