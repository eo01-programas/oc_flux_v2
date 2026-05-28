// Configura menu contextual en el encabezado de la vista Enumerado (solo Por enumerar)
function setupEnumeradoHeaderFilterMenu() {
    const view = document.getElementById('view-enumerado');
    if (!view) return;
    const thead = view.querySelector('thead');
    if (!thead) return;

    let menu = document.getElementById('enumerado-header-filter-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'enumerado-header-filter-menu';
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
        title.innerText = 'Filtrar por (Enumerado)';
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
                    if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)).getTime();
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
                            const existIdx = enumeradoHeaderFilters.findIndex(fil => fil.field.toUpperCase() === f.toUpperCase());
                            const nf = { field: f, value: v };
                            if (existIdx !== -1) enumeradoHeaderFilters[existIdx] = nf;
                            else enumeradoHeaderFilters.push(nf);
                            enumeradoHeaderFilter = enumeradoHeaderFilters[0] || null;
                            renderEnumerado(); hideMenu();
                        };
                        list.appendChild(item);
                    });
                    menu.appendChild(list);
                    return;
                }

                const val = prompt(`Valor para filtrar ${f}:`, '');
                if (val !== null) {
                    const existIdx = enumeradoHeaderFilters.findIndex(fil => fil.field.toUpperCase() === f.toUpperCase());
                    const nf = { field: f, value: val };
                    if (existIdx !== -1) enumeradoHeaderFilters[existIdx] = nf;
                    else enumeradoHeaderFilters.push(nf);
                    enumeradoHeaderFilter = enumeradoHeaderFilters[0] || null;
                    renderEnumerado();
                }
                hideMenu();
            };
            menu.appendChild(btn);
        });

        const clear = document.createElement('div');
        clear.style.cursor = 'pointer'; clear.style.padding = '6px 4px'; clear.style.borderTop = '1px solid #eee'; clear.style.marginTop = '6px';
        clear.innerText = 'Limpiar filtro';
        clear.onclick = () => { enumeradoHeaderFilters = []; enumeradoHeaderFilter = null; renderEnumerado(); hideMenu(); };
        menu.appendChild(clear);
    };

    const hideMenu = () => { menu.style.display = 'none'; };

    buildMenu();

    thead.addEventListener('contextmenu', function (e) {
        const btnPor = document.getElementById('enumerado-btn-por');
        const isPorActive = btnPor && btnPor.classList.contains('active');
        if (!isPorActive) return;
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
// FUNCIONES DE FILTRO CONTEXTUAL PARA ENUMERADO
// =============================================
let enumeradoContextMenuField = null;

window.showEnumeradoContextMenu = function (event, fieldName) {
    event.preventDefault();
    event.stopPropagation();

    enumeradoContextMenuField = fieldName;
    const menu = document.getElementById('enumerado-context-menu');
    if (!menu) return;

    const input = document.getElementById('enumerado-filter-input');
    const select = document.getElementById('enumerado-filter-select');

    document.getElementById('enumerado-filter-field').textContent = fieldName;

    const dropdownFields = ['HOD', 'F.ING.COST', 'CLIENTE', 'RUTA'];

    if (dropdownFields.includes(fieldName)) {
        input.style.display = 'none';
        select.style.display = 'block';
        select.value = '';
        populateEnumeradoFilterSelect(fieldName);
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

window.hideEnumeradoContextMenu = function () {
    const menu = document.getElementById('enumerado-context-menu');
    if (menu) menu.classList.remove('active');
    enumeradoContextMenuField = null;
};

window.clearEnumeradoFilter = function () {
    enumeradoHeaderFilters = [];
    enumeradoHeaderFilter = null;
    hideEnumeradoContextMenu();
    renderEnumerado();
};

window.applyEnumeradoFilter = function () {
    if (!enumeradoContextMenuField) { hideEnumeradoContextMenu(); return; }

    const input = document.getElementById('enumerado-filter-input');
    const select = document.getElementById('enumerado-filter-select');
    let filterValue = '';
    let isFromSelect = false;

    if (input.style.display !== 'none') filterValue = input.value.trim().toUpperCase();
    else if (select.style.display !== 'none') {
        filterValue = select.value.trim();
        isFromSelect = true;
    }

    // Permitir valores vac?os solo si vienen del select (opci?n VAC?O)
    if (!filterValue && !isFromSelect) { alert('Por favor seleccione o ingrese un valor para filtrar'); return; }
    // Si viene del select pero no hay selecci?n v?lida (opci?n por defecto)
    if (isFromSelect && select.selectedIndex === 0) { alert('Por favor seleccione un valor para filtrar'); return; }

    // Agregar o actualizar filtro en el array
    const existingIdx = enumeradoHeaderFilters.findIndex(f => f.field.toUpperCase() === enumeradoContextMenuField.toUpperCase());
    const newFilter = { field: enumeradoContextMenuField, value: filterValue };
    if (existingIdx !== -1) {
        enumeradoHeaderFilters[existingIdx] = newFilter;
    } else {
        enumeradoHeaderFilters.push(newFilter);
    }
    enumeradoHeaderFilter = enumeradoHeaderFilters[0] || null;
    hideEnumeradoContextMenu();
    renderEnumerado();
};

function populateEnumeradoFilterSelect(fieldName) {
    const select = document.getElementById('enumerado-filter-select');
    if (!select) return;
    while (select.options.length > 1) select.remove(1);

    const values = new Set();
    let hasEmptyValue = false;

    // Funci?n auxiliar para verificar si una fila pasa los filtros actuales (excepto el campo que estamos poblando)
    const passesCurrentFilters = (row, excludeField) => {
        if (!enumeradoHeaderFilter || enumeradoHeaderFilter.field.toUpperCase() === excludeField.toUpperCase()) return true;

        const f = enumeradoHeaderFilter.field;
        const v = String(enumeradoHeaderFilter.value).toUpperCase().trim();
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
        const estadoCorte = (getVal(row, 'STATUS_CORTE') || getVal(row, 'STATUS') || getVal(row, 'estado_corte') || getVal(row, 'ESTADO_CORTE') || '').toString().toUpperCase().trim();
        if (estadoCorte !== 'OK') continue;
        const estadoEnumerado = (getVal(row, 'estado_enumerado') || '').toString().toUpperCase().trim();
        if (estadoEnumerado === 'OK ENM' || estadoEnumerado === 'OK PAQUETEO' || estadoEnumerado === 'OK S/ENM') continue;

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
            case 'CLIENTE': fieldValue = normalizeClientName(getVal(row, 'CLIENTE')) || ''; break;
            case 'RUTA':
                const rutaTela = (getVal(row, 'RUTA TELA') || '').toString().toUpperCase().trim();
                if (rutaTela === 'LAVADA') fieldValue = 'LAVADA';
                else if (rutaTela === 'ACABADA') fieldValue = 'ACABADA';
                break;
        }
        if (fieldValue) {
            values.add(fieldValue);
        } else {
            hasEmptyValue = true;
        }
    }

    // Si es fecha (HOD o F.ING.COST), ordenar por fecha; si no, alfab?tico
    const sortedValues = Array.from(values).sort((a, b) => {
        if (fieldName === 'HOD' || fieldName === 'F.ING.COST' || fieldName === 'F.HAB') {
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

    // Agregar opci?n VAC?O si hay valores vac?os
    if (hasEmptyValue) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '(VAC?O)';
        select.appendChild(option);
    }
}

function initializeEnumeradoHeaderContextMenus() {
    const allowedFields = ['HOD', 'F.ING.COST', 'CLIENTE', 'OP-PTDA', 'RUTA', 'OC', 'COLOR'];
    const thead = document.querySelector('#view-enumerado table thead');
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
            if (matchedField) showEnumeradoContextMenu(event, matchedField);
        };
    });
}
