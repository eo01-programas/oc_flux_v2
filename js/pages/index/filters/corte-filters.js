// Configura menu contextual en el encabezado de la vista Corte (solo X PROG)
function setupCorteHeaderFilterMenu() {
    const view = document.getElementById('view-corte');
    if (!view) return;
    const thead = view.querySelector('thead');
    if (!thead) return;

    let menu = document.getElementById('corte-header-filter-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'corte-header-filter-menu';
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
        title.innerText = 'Filtrar por (Corte)';
        menu.appendChild(title);

        const getUniqueValues = (colName, formatAsDate) => {
            const map = new Map();
            const mesesEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

            const parseToTimestamp = (raw) => {
                if (raw === undefined || raw === null || raw === '') return NaN;
                if (typeof raw === 'number' && raw > 30000) {
                    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
                    return d.getTime();
                }
                if (typeof raw === 'string') {
                    const s = raw.trim();
                    const m = s.match(/Date\((\d+),(\d+),(\d+)\)/);
                    if (m) {
                        const y = parseInt(m[1], 10);
                        const mo = parseInt(m[2], 10);
                        const day = parseInt(m[3], 10);
                        return new Date(y, mo, day).getTime();
                    }
                    const m2 = s.match(/(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})/);
                    if (m2) {
                        const day = parseInt(m2[1], 10);
                        const monAbbr = m2[2].slice(0, 3);
                        const yearRaw = m2[3];
                        const monthIdx = mesesEs.findIndex(x => x.toLowerCase() === monAbbr.toLowerCase());
                        let year = parseInt(yearRaw, 10);
                        if (yearRaw.length === 2) year = 2000 + year;
                        if (monthIdx !== -1) return new Date(year, monthIdx, day).getTime();
                    }
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
            } catch (e) { }

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
                if (f === 'HOD' || f === 'F.ING.COST') {
                    const colName = (f === 'HOD') ? 'HOD' : 'F.ING.COST';
                    const vals = getUniqueValues(colName, true);
                    if (vals.length === 0) { alert('No hay valores de fecha disponibles en la columna.'); hideMenu(); return; }
                    menu.innerHTML = '';
                    const back = document.createElement('div');
                    back.style.cursor = 'pointer'; back.style.padding = '4px 6px'; back.style.fontWeight = '600'; back.innerText = '< Volver';
                    back.onclick = () => { buildMenu(); };
                    menu.appendChild(back);

                    const list = document.createElement('div');
                    list.style.maxHeight = '220px'; list.style.overflow = 'auto'; list.style.marginTop = '6px';
                    vals.forEach(v => {
                        const item = document.createElement('div');
                        item.style.cursor = 'pointer'; item.style.padding = '4px 6px'; item.innerText = v;
                        item.onclick = () => {
                            // Usar sistema de multiples filtros
                            const existingIdx = corteHeaderFilters.findIndex(fil => fil.field.toUpperCase() === f.toUpperCase());
                            const newFilter = { field: f, value: v };
                            if (existingIdx !== -1) corteHeaderFilters[existingIdx] = newFilter;
                            else corteHeaderFilters.push(newFilter);
                            corteHeaderFilter = corteHeaderFilters[0] || null;
                            renderCorte(); hideMenu();
                        };
                        list.appendChild(item);
                    });
                    menu.appendChild(list);
                    return;
                }

                const val = prompt(`Valor para filtrar ${f}:`, '');
                if (val !== null) {
                    // Usar sistema de multiples filtros
                    const existingIdx = corteHeaderFilters.findIndex(fil => fil.field.toUpperCase() === f.toUpperCase());
                    const newFilter = { field: f, value: val };
                    if (existingIdx !== -1) corteHeaderFilters[existingIdx] = newFilter;
                    else corteHeaderFilters.push(newFilter);
                    corteHeaderFilter = corteHeaderFilters[0] || null;
                    renderCorte();
                }
                hideMenu();
            };
            menu.appendChild(btn);
        });

        const clear = document.createElement('div');
        clear.style.cursor = 'pointer'; clear.style.padding = '6px 4px'; clear.style.borderTop = '1px solid #eee'; clear.style.marginTop = '6px';
        clear.innerText = 'Limpiar todos los filtros';
        clear.onclick = () => { corteHeaderFilters = []; corteHeaderFilter = null; renderCorte(); hideMenu(); };
        menu.appendChild(clear);
    };

    const hideMenu = () => { menu.style.display = 'none'; };

    buildMenu();

    thead.addEventListener('contextmenu', function (e) {
        const btnX = document.getElementById('corte-btn-xprog');
        const isXProgActive = btnX && btnX.classList.contains('active');
        if (!isXProgActive) return;
        e.preventDefault();
        menu.style.left = (e.pageX + 2) + 'px';
        menu.style.top = (e.pageY + 2) + 'px';
        menu.style.display = 'block';
    });

    document.addEventListener('click', function (e) {
        if (!menu) return;
        if (e.target && menu.contains(e.target)) return;
        hideMenu();
    });
}

// =============================================
// FUNCIONES DE FILTRO CONTEXTUAL PARA CORTE
// =============================================
let corteContextMenuField = null;

window.showCorteContextMenu = function (event, fieldName) {
    event.preventDefault();
    event.stopPropagation();

    corteContextMenuField = fieldName;
    const menu = document.getElementById('corte-context-menu');
    if (!menu) return;

    const input = document.getElementById('corte-filter-input');
    const select = document.getElementById('corte-filter-select');

    document.getElementById('corte-filter-field').textContent = fieldName;

    // Verificar si este campo ya tiene un filtro activo
    const activeBadge = document.getElementById('corte-filter-active-badge');
    const existingFilter = corteHeaderFilters.find(f => f.field.toUpperCase() === fieldName.toUpperCase());
    if (activeBadge) {
        if (existingFilter) {
            activeBadge.style.display = 'inline';
            activeBadge.textContent = `ACTIVO: ${existingFilter.value}`;
        } else {
            activeBadge.style.display = 'none';
        }
    }

    const dropdownFields = ['RSV', 'F. GIRADO', 'HOD', 'F.ING.COST', 'CLIENTE', 'RUTA'];

    if (dropdownFields.includes(fieldName)) {
        input.style.display = 'none';
        select.style.display = 'block';
        select.value = existingFilter ? existingFilter.value : '';
        populateCorteFilterSelect(fieldName);
        if (existingFilter) select.value = existingFilter.value;
        select.focus();
    } else {
        select.style.display = 'none';
        input.style.display = 'block';
        input.value = existingFilter ? existingFilter.value : '';
        input.focus();
    }

    menu.classList.add('active');
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
};

window.hideCorteContextMenu = function () {
    const menu = document.getElementById('corte-context-menu');
    if (menu) menu.classList.remove('active');
    corteContextMenuField = null;
};

window.clearCorteFilter = function () {
    // Limpiar todos los filtros de Corte
    corteHeaderFilters = [];
    corteHeaderFilter = null;
    hideCorteContextMenu();
    renderCorte();
};

// Limpiar un filtro especifico de Corte por campo
window.clearCorteFilterByField = function (fieldName) {
    corteHeaderFilters = corteHeaderFilters.filter(f => f.field.toUpperCase() !== fieldName.toUpperCase());
    corteHeaderFilter = corteHeaderFilters.length > 0 ? corteHeaderFilters[0] : null;
    renderCorte();
};

window.applyCorteFilter = function () {
    if (!corteContextMenuField) { hideCorteContextMenu(); return; }

    const input = document.getElementById('corte-filter-input');
    const select = document.getElementById('corte-filter-select');
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

    // Agregar o actualizar filtro en el array (reemplazar si ya existe para el mismo campo)
    const existingIdx = corteHeaderFilters.findIndex(f => f.field.toUpperCase() === corteContextMenuField.toUpperCase());
    const newFilter = { field: corteContextMenuField, value: filterValue };
    if (existingIdx !== -1) {
        corteHeaderFilters[existingIdx] = newFilter;
    } else {
        corteHeaderFilters.push(newFilter);
    }
    // Actualizar variable de compatibilidad
    corteHeaderFilter = corteHeaderFilters.length > 0 ? corteHeaderFilters[0] : null;
    hideCorteContextMenu();
    renderCorte();
};

function populateCorteFilterSelect(fieldName) {
    const select = document.getElementById('corte-filter-select');
    if (!select) return;
    while (select.options.length > 1) select.remove(1);

    const values = new Set();
    let hasEmptyValue = false;

    // Funcion auxiliar para verificar si una fila pasa los filtros actuales (excepto el campo que estamos poblando)
    const passesCurrentFilters = (row, excludeField) => {
        const filtersToCheck = corteHeaderFilters.filter(f => f.field.toUpperCase() !== excludeField.toUpperCase());
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
                else if (f === 'RUTA') {
                    const rutaTela = (getVal(row, 'RUTA TELA') || '').toString().toUpperCase().trim();
                    if (rutaTela === 'LAVADA') {
                        const lavadaState = getLavadaRouteState(row);
                        if (lavadaState === 'LV-OK') cellValue = 'LV-ok';
                        else if (lavadaState === 'X PEDIR') cellValue = 'x pedir';
                        else if (lavadaState === 'X BLOQ') cellValue = 'x bloq';
                        else if (lavadaState === 'X LAVAR') cellValue = 'x lavar';
                    } else if (rutaTela === 'ACABADA') {
                        cellValue = 'AC';
                    }
                }

                const cellValueUpper = String(cellValue).toUpperCase();
                if (v === '') return cellValueUpper === '';
                return cellValueUpper.indexOf(v) !== -1;
            } catch (e) { return false; }
        });
    };

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const estadoCorte = (getVal(row, 'STATUS_CORTE') || getVal(row, 'STATUS') || getVal(row, 'estado_corte') || getVal(row, 'ESTADO_CORTE') || '').toString().toUpperCase().trim();
        // Filtrar segun el sub-tab seleccionado
        if (currentCorteFilter === 'X PROG') {
            if (estadoCorte !== '' && estadoCorte !== 'X PROG') continue;
        } else {
            if (estadoCorte !== currentCorteFilter) continue;
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
            case 'RUTA':
                const rutaTela = (getVal(row, 'RUTA TELA') || '').toString().toUpperCase().trim();
                if (rutaTela === 'LAVADA') {
                    const lavadaState = getLavadaRouteState(row);
                    if (lavadaState === 'LV-OK') fieldValue = 'LV-ok';
                    else if (lavadaState === 'X PEDIR') fieldValue = 'x pedir';
                    else if (lavadaState === 'X BLOQ') fieldValue = 'x bloq';
                    else if (lavadaState === 'X LAVAR') fieldValue = 'x lavar';
                } else if (rutaTela === 'ACABADA') {
                    fieldValue = 'AC';
                }
                break;
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

function initializeCorteHeaderContextMenus() {
    const allowedFields = ['RSV', 'F. GIRADO', 'HOD', 'F.ING.COST', 'CLIENTE', 'OP-PTDA', 'RUTA', 'OC', 'COLOR'];
    const thead = document.querySelector('#view-corte table thead');
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
            if (matchedField) showCorteContextMenu(event, matchedField);
        };
    });
}
