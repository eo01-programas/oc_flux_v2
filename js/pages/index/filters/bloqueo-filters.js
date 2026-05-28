// Configura menu contextual en el encabezado de la vista Bloqueo
function setupBloqueoHeaderFilterMenu() {
    const view = document.getElementById('view-bloqueo');
    if (!view) return;
    const thead = view.querySelector('thead');
    if (!thead) return;

    // Crear contenedor de menu si no existe
    let menu = document.getElementById('bloq-header-filter-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'bloq-header-filter-menu';
        menu.style.position = 'absolute';
        menu.style.zIndex = 9999;
        menu.style.background = '#fff';
        menu.style.border = '1px solid #ccc';
        menu.style.padding = '6px';
        menu.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
        menu.style.display = 'none';
        document.body.appendChild(menu);
    }

    const fields = ['HOD', 'F.ING.COST', 'CLIENTE', 'OP-PTDA', 'OC', 'COLOR'];

    const buildMenu = () => {
        menu.innerHTML = '';
        const title = document.createElement('div');
        title.style.fontWeight = '600';
        title.style.marginBottom = '6px';
        title.innerText = 'Filtrar por (Bloqueo)';
        menu.appendChild(title);

        // helper: obtener valores unicos de una columna (formateados para fechas)
        const getUniqueValues = (colName, formatAsDate) => {
            const map = new Map(); // display -> timestamp
            const mesesEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

            const parseToTimestamp = (raw) => {
                if (raw === undefined || raw === null || raw === '') return NaN;
                // number (Excel serial)
                if (typeof raw === 'number' && raw > 30000) {
                    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
                    return d.getTime();
                }
                if (typeof raw === 'string') {
                    const s = raw.trim();
                    // Date(yyyy,mm,dd)
                    const m = s.match(/Date\((\d+),(\d+),(\d+)\)/);
                    if (m) {
                        const y = parseInt(m[1], 10);
                        const mo = parseInt(m[2], 10);
                        const day = parseInt(m[3], 10);
                        return new Date(y, mo, day).getTime();
                    }
                    // Formato dd/Mon/yy o dd/Mon/yyyy
                    const m2 = s.match(/(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})/);
                    if (m2) {
                        const day = parseInt(m2[1], 10);
                        const monAbbr = m2[2].slice(0, 3);
                        const yearRaw = m2[3];
                        const monthIdx = mesesEs.findIndex(x => x.toLowerCase() === monAbbr.toLowerCase());
                        let year = parseInt(yearRaw, 10);
                        if (yearRaw.length === 2) {
                            year = 2000 + year;
                        }
                        if (monthIdx !== -1) return new Date(year, monthIdx, day).getTime();
                    }
                    // Try ISO parse
                    const tryIso = Date.parse(s);
                    if (!isNaN(tryIso)) return tryIso;
                }
                return NaN;
            };

            try {
                for (let i = 1; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (!row) continue;
                    const rawVal = getVal(row, colName);
                    const display = formatAsDate ? String(formatValue(rawVal, 'date')) : String(rawVal);
                    if (display === 'undefined' || display === 'null' || String(display).trim() === '') continue;
                    if (!map.has(display)) {
                        const ts = parseToTimestamp(rawVal);
                        map.set(display, isNaN(ts) ? null : ts);
                    }
                }
            } catch (e) { /* ignore */ }

            // Convert map to array and sort by timestamp (nulls last), then by display
            const arr = Array.from(map.entries()).map(([display, ts]) => ({ display, ts }));
            arr.sort((a, b) => {
                if (a.ts === null && b.ts === null) return a.display.localeCompare(b.display);
                if (a.ts === null) return 1;
                if (b.ts === null) return -1;
                return a.ts - b.ts;
            });
            return arr.map(x => x.display);
        };

        fields.forEach(f => {
            const btn = document.createElement('div');
            btn.style.cursor = 'pointer';
            btn.style.padding = '4px 6px';
            btn.innerText = f;
            btn.onclick = () => {
                // Si es campo fecha, mostrar lista de fechas unicas en lugar de prompt
                if (f === 'HOD' || f === 'F.ING.COST') {
                    const colName = (f === 'HOD') ? 'HOD' : 'F.ING.COST';
                    const vals = getUniqueValues(colName, true);
                    // construir sub-lista
                    if (vals.length === 0) {
                        alert('No hay valores de fecha disponibles en la columna.');
                        hideMenu();
                        return;
                    }
                    menu.innerHTML = '';
                    const back = document.createElement('div');
                    back.style.cursor = 'pointer';
                    back.style.padding = '4px 6px';
                    back.style.fontWeight = '600';
                    back.innerText = '< Volver';
                    back.onclick = () => { buildMenu(); };
                    menu.appendChild(back);

                    const list = document.createElement('div');
                    list.style.maxHeight = '220px';
                    list.style.overflow = 'auto';
                    list.style.marginTop = '6px';
                    vals.forEach(v => {
                        const item = document.createElement('div');
                        item.style.cursor = 'pointer';
                        item.style.padding = '4px 6px';
                        item.innerText = v;
                        item.onclick = () => {
                            // Usar sistema de multiples filtros
                            const existingIdx = bloqueoHeaderFilters.findIndex(fil => fil.field.toUpperCase() === f.toUpperCase());
                            const newFilter = { field: f, value: v };
                            if (existingIdx !== -1) bloqueoHeaderFilters[existingIdx] = newFilter;
                            else bloqueoHeaderFilters.push(newFilter);
                            bloqueoHeaderFilter = bloqueoHeaderFilters[0] || null;
                            renderBloqueo();
                            hideMenu();
                        };
                        list.appendChild(item);
                    });
                    menu.appendChild(list);
                    return;
                }

                // campos no fecha: usar prompt simple
                const val = prompt(`Valor para filtrar ${f}:`, '');
                if (val !== null) {
                    // Usar sistema de multiples filtros
                    const existingIdx = bloqueoHeaderFilters.findIndex(fil => fil.field.toUpperCase() === f.toUpperCase());
                    const newFilter = { field: f, value: val };
                    if (existingIdx !== -1) bloqueoHeaderFilters[existingIdx] = newFilter;
                    else bloqueoHeaderFilters.push(newFilter);
                    bloqueoHeaderFilter = bloqueoHeaderFilters[0] || null;
                    renderBloqueo();
                }
                hideMenu();
            };
            menu.appendChild(btn);
        });

        const clear = document.createElement('div');
        clear.style.cursor = 'pointer';
        clear.style.padding = '6px 4px';
        clear.style.borderTop = '1px solid #eee';
        clear.style.marginTop = '6px';
        clear.innerText = 'Limpiar todos los filtros';
        clear.onclick = () => {
            bloqueoHeaderFilters = [];
            bloqueoHeaderFilter = null;
            renderBloqueo();
            hideMenu();
        };
        menu.appendChild(clear);
    };

    const hideMenu = () => { menu.style.display = 'none'; };

    buildMenu();

    // Mostrar menu al hacer click derecho en la fila de encabezado
    thead.addEventListener('contextmenu', function (e) {
        // Solo en sub-tab 'Por Programar'
        const btnX = document.getElementById('btn-xprog');
        const isXProgActive = btnX && btnX.classList.contains('active');
        if (!isXProgActive) return; // no mostrar menu si no esta en Por Programar

        e.preventDefault();
        menu.style.left = (e.pageX + 2) + 'px';
        menu.style.top = (e.pageY + 2) + 'px';
        menu.style.display = 'block';
    });

    // Ocultar al click fuera
    document.addEventListener('click', function (e) {
        if (!menu) return;
        if (e.target && menu.contains(e.target)) return;
        hideMenu();
    });
}

// =============================================
// FUNCIONES DE FILTRO CONTEXTUAL PARA BLOQUEO
// =============================================
let bloqueoContextMenuField = null;

window.showBloqueoContextMenu = function (event, fieldName) {
    event.preventDefault();
    event.stopPropagation();

    bloqueoContextMenuField = fieldName;
    const menu = document.getElementById('bloqueo-context-menu');
    if (!menu) return;

    const input = document.getElementById('bloqueo-filter-input');
    const select = document.getElementById('bloqueo-filter-select');

    document.getElementById('bloqueo-filter-field').textContent = fieldName;

    const dropdownFields = ['RSV', 'F. GIRADO', 'HOD', 'F.ING.COST', 'CLIENTE'];

    if (dropdownFields.includes(fieldName)) {
        input.style.display = 'none';
        select.style.display = 'block';
        select.value = '';
        populateBloqueoFilterSelect(fieldName);
        select.focus();
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

window.hideBloqueoContextMenu = function () {
    const menu = document.getElementById('bloqueo-context-menu');
    if (menu) menu.classList.remove('active');
    bloqueoContextMenuField = null;
};

window.clearBloqueoFilter = function () {
    bloqueoHeaderFilters = [];
    bloqueoHeaderFilter = null;
    hideBloqueoContextMenu();
    renderBloqueo();
};

window.applyBloqueoFilter = function () {
    if (!bloqueoContextMenuField) { hideBloqueoContextMenu(); return; }

    const input = document.getElementById('bloqueo-filter-input');
    const select = document.getElementById('bloqueo-filter-select');
    let filterValue = '';
    let isFromSelect = false;

    if (input.style.display !== 'none') filterValue = input.value.trim().toUpperCase();
    else if (select.style.display !== 'none') {
        filterValue = select.value.trim();
        isFromSelect = true;
    }

    // Permitir valores vacios solo si vienen del select (opcion VACIO)
    if (!filterValue && !isFromSelect) { alert('Por favor seleccione o ingrese un valor para filtrar'); return; }
    // Si viene del select pero no hay seleccion valida (opcion por defecto)
    if (isFromSelect && select.selectedIndex === 0) { alert('Por favor seleccione un valor para filtrar'); return; }

    // Usar sistema de multiples filtros
    const existingIdx = bloqueoHeaderFilters.findIndex(f => f.field.toUpperCase() === bloqueoContextMenuField.toUpperCase());
    const newFilter = { field: bloqueoContextMenuField, value: filterValue };
    if (existingIdx !== -1) bloqueoHeaderFilters[existingIdx] = newFilter;
    else bloqueoHeaderFilters.push(newFilter);
    bloqueoHeaderFilter = bloqueoHeaderFilters[0] || null;
    hideBloqueoContextMenu();
    renderBloqueo();
};

function populateBloqueoFilterSelect(fieldName) {
    const select = document.getElementById('bloqueo-filter-select');
    if (!select) return;
    while (select.options.length > 1) select.remove(1);

    const values = new Set();
    let hasEmptyValue = false;

    // Funcion auxiliar para verificar si una fila pasa los filtros actuales (excepto el campo que estamos poblando)
    const passesCurrentFilters = (row, excludeField) => {
        const filtersToCheck = bloqueoHeaderFilters.filter(f => f.field.toUpperCase() !== excludeField.toUpperCase());
        if (filtersToCheck.length === 0) return true;

        return filtersToCheck.every(filter => {
            if (!filter || !filter.field) return true;
            const f = filter.field;
            const v = String(filter.value).toUpperCase().trim();
            try {
                let cellValue = '';
                if (f === 'RSV') cellValue = String(getVal(row, 'RSV') || '');
                else if (f === 'F. GIRADO') cellValue = formatValue(getVal(row, 'F. GIRADO'), 'date') || '';
                else if (f === 'HOD') cellValue = formatValue(getVal(row, 'HOD'), 'date') || '';
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
        });
    };

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const rutaTela = (getVal(row, 'RUTA TELA') || '').toString().toUpperCase().trim();
        if (rutaTela !== 'LAVADA') continue;
        const estadoBloqueo = (getVal(row, 'estado_bloqueo') || '').toString().toUpperCase().trim();
        // Filtrar segun el sub-tab seleccionado
        if (currentBloqueoFilter === 'X PROG') {
            if (estadoBloqueo !== '' && estadoBloqueo !== 'X PROG') continue;
        } else {
            if (estadoBloqueo !== currentBloqueoFilter) continue;
        }

        // Verificar si pasa los filtros actuales (excepto el campo actual)
        if (!passesCurrentFilters(row, fieldName)) continue;

        let fieldValue = '';
        switch (fieldName) {
            case 'RSV': fieldValue = String(getVal(row, 'RSV') || '').trim(); break;
            case 'F. GIRADO': fieldValue = formatValue(getVal(row, 'F. GIRADO'), 'date') || ''; break;
            case 'HOD': fieldValue = formatValue(getVal(row, 'HOD'), 'date') || ''; break;
            case 'F.ING.COST':
                const rawFIng = getVal(row, 'F.ING.COST');
                const dateValue = convertToDateInputFormat(rawFIng);
                fieldValue = formatDateShortFromInput(dateValue) || '';
                break;
            case 'CLIENTE': fieldValue = normalizeClientName(getVal(row, 'CLIENTE')) || ''; break;
        }
        if (fieldValue) {
            values.add(fieldValue);
        } else {
            hasEmptyValue = true;
        }
    }

    // Si es fecha (HOD, F. GIRADO o F.ING.COST), ordenar por fecha; si no, alfabetico
    const sortedValues = Array.from(values).sort((a, b) => {
        if (fieldName === 'HOD' || fieldName === 'F. GIRADO' || fieldName === 'F.ING.COST') {
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

    // Agregar opcion VACIO si hay valores vacios
    if (hasEmptyValue) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '(VAC?O)';
        select.appendChild(option);
    }
}

function initializeBloqueoHeaderContextMenus() {
    const allowedFields = ['RSV', 'F. GIRADO', 'HOD', 'F.ING.COST', 'CLIENTE', 'OP-PTDA', 'OC', 'COLOR'];
    const thead = document.querySelector('#view-bloqueo table thead');
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
            if (matchedField) showBloqueoContextMenu(event, matchedField);
        };
    });
}
