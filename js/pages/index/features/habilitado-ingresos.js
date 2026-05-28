function ensureHabilitadoHeaderNormalSnapshot() {
    if (habilitadoHeaderNormalHtml) return;
    const thead = document.querySelector('#table-habilitado thead');
    if (thead) habilitadoHeaderNormalHtml = thead.innerHTML;
}

function setHabilitadoHeaderForIngresosMode(enabled) {
    ensureHabilitadoHeaderNormalSnapshot();
    const thead = document.querySelector('#table-habilitado thead');
    const table = document.getElementById('table-habilitado');
    if (!thead) return;

    if (enabled) {
        if (thead.getAttribute('data-mode') !== 'ingresos') {
            thead.innerHTML = `<tr>
                        <th style="width: 68px; text-align: center;">F.ING.REAL</th>
                        <th style="width: 62px; text-align: center;">HOD</th>
                        <th class="col-planta" style="width: 77px; text-align:center;">PLANTA</th>
                        <th class="col-linea" style="width: 69px; text-align:center;">LINEA</th>
                        <th style="width: 45px; text-align:center;">CLI</th>
                        <th class="col-oc" style="width: 65px;">OC</th>
                        <th class="col-color" style="width: 120px;">COLOR</th>
                        <th style="width: 45px; text-align:center;">PDS</th>
                        <th style="width: 55px;" class="col-pda">PDA</th>
                        <th style="width: 90px;" class="col-cert">CERT</th>
                        <th class="col-comp-otros" style="width: 100px; text-align:left;">COMP/OTROS</th>
                    <th class="col-observaciones" style="width: 185px; text-align:left;">OBSERVACIONES</th>
                    </tr>`;
        }
        thead.setAttribute('data-mode', 'ingresos');
        if (table) table.setAttribute('data-mode', 'ingresos');
    } else {
        if (habilitadoHeaderNormalHtml && thead.getAttribute('data-mode') === 'ingresos') {
            thead.innerHTML = habilitadoHeaderNormalHtml;
        }
        thead.setAttribute('data-mode', 'normal');
        if (table) table.setAttribute('data-mode', 'normal');
    }
}

function updateHabilitadoIngresosControls() {
    const btn = document.getElementById('btn-habilitado-ingresos');
    if (btn) btn.classList.toggle('active', !!isHabilitadoIngresosMode);

    const wrap = document.getElementById('habilitado-ingresos-filters');
    if (wrap) wrap.style.display = isHabilitadoIngresosMode ? 'flex' : 'none';

    const btnProgramar = document.getElementById('btn-programar-habilitado');
    if (btnProgramar) {
        if (isHabilitadoIngresosMode) {
            btnProgramar.style.display = 'none';
        } else {
            try { if (typeof updateProgramarHabilitadoButton === 'function') updateProgramarHabilitadoButton(); } catch (e) { }
        }
    }
}

function renderHabilitadoIngresosDateOptions(rowsOk) {
    const select = document.getElementById('habilitado-ingresos-date-filter');
    if (!select) return;

    const byKey = new Map();
    let hasEmpty = false;

    rowsOk.forEach(obj => {
        const row = obj.row || obj;
        const rawFIngReal = getRawFIngRealFromRow(row);
        const key = getFIngRealDayMonthKey(rawFIngReal);
        const label = getFIngRealDayMonthLabel(rawFIngReal);
        if (key && label) {
            if (!byKey.has(key)) byKey.set(key, label);
        } else {
            hasEmpty = true;
        }
    });

    const sorted = Array.from(byKey.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    // Filtro por defecto: ayer (dd/mmm) cuando el usuario aÃºn no eligiÃ³ uno.
    if (!habilitadoIngresosDateFilter) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayLabel = formatDayMonthEsFromDate(yesterday);
        const hasYesterday = sorted.some((entry) => entry[1] === yesterdayLabel);
        if (hasYesterday) habilitadoIngresosDateFilter = yesterdayLabel;
    }

    if (habilitadoIngresosDateFilter === '__EMPTY__' && !hasEmpty) {
        habilitadoIngresosDateFilter = '';
    }
    if (habilitadoIngresosDateFilter && habilitadoIngresosDateFilter !== '__EMPTY__') {
        const exists = sorted.some((entry) => entry[1] === habilitadoIngresosDateFilter);
        if (!exists) habilitadoIngresosDateFilter = '';
    }

    let html = '<option value="">Todos</option>';
    sorted.forEach((entry) => {
        const label = entry[1];
        const selected = (habilitadoIngresosDateFilter === label) ? ' selected' : '';
        html += `<option value="${escapeHtmlHabilitadoIngresos(label)}"${selected}>${escapeHtmlHabilitadoIngresos(label)}</option>`;
    });
    if (hasEmpty) {
        const selected = (habilitadoIngresosDateFilter === '__EMPTY__') ? ' selected' : '';
        html += `<option value="__EMPTY__"${selected}>VACIO</option>`;
    }

    select.innerHTML = html;
    if (!habilitadoIngresosDateFilter) select.value = '';
}

function getHabilitadoIngresosPlantValue(row) {
    return String(getVal(row, 'PLANTA') || '').trim();
}

function renderHabilitadoIngresosPlantPills(rowsBase) {
    const container = document.getElementById('habilitado-ingresos-plant-pills');
    if (!container) return;

    const seen = new Set();
    const plants = [];
    let hasEmpty = false;

    (rowsBase || []).forEach((obj) => {
        const row = obj.row || obj;
        const planta = getHabilitadoIngresosPlantValue(row);
        if (!planta) {
            hasEmpty = true;
            return;
        }
        if (seen.has(planta)) return;
        seen.add(planta);
        plants.push(planta);
    });

    plants.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const options = [{ value: '', label: 'Todas' }]
        .concat(plants.map((planta) => ({ value: planta, label: planta })));
    if (hasEmpty) options.push({ value: '__EMPTY__', label: 'VACIO' });

    if (!options.some((opt) => opt.value === habilitadoIngresosPlantFilter)) {
        habilitadoIngresosPlantFilter = '';
    }

    container.innerHTML = options.map((opt) => {
        const active = opt.value === habilitadoIngresosPlantFilter ? ' active' : '';
        return `<button type="button" class="habilitado-ingresos-plant-pill${active}" data-value="${escapeHtmlHabilitadoIngresos(opt.value)}">${escapeHtmlHabilitadoIngresos(opt.label)}</button>`;
    }).join('');

    container.querySelectorAll('.habilitado-ingresos-plant-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
            window.onHabilitadoIngresosPlantFilterChange(btn.getAttribute('data-value') || '');
        });
    });
}

function updateHabilitadoIngresosPdsPill(rowsFiltered) {
    const pill = document.getElementById('habilitado-ingresos-pds-pill');
    if (!pill) return;

    let totalPds = 0;
    (rowsFiltered || []).forEach((obj) => {
        const row = obj.row || obj;
        totalPds += parseFloat(getVal(row, 'PDS GIRADAS')) || 0;
    });

    pill.innerHTML = `PDS: <strong>${escapeHtmlHabilitadoIngresos(formatThousands(totalPds, 0))}pds</strong>`;
}

function renderHabilitadoIngresosView(tbody) {
    setHabilitadoHeaderForIngresosMode(true);
    updateHabilitadoIngresosControls();

    const rowsOk = [];
    const idxHabil = findHeaderIndexCaseInsensitive('estado_habilitado');

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        let habilVal = '';
        if (idxHabil !== -1 && row[idxHabil] !== undefined) habilVal = row[idxHabil];
        else habilVal = getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || '';
        const habilNorm = String(habilVal || '').toUpperCase().trim();
        if (habilNorm === 'OK') rowsOk.push({ idx: i, row: row });
    }

    const getOcSortKey = (row) => {
        const ocDirecto = String(getVal(row, 'OC') || '').trim();
        if (ocDirecto) return ocDirecto.toLowerCase();
        const op = String(getVal(row, 'OP') || '').trim();
        const corte = String(getVal(row, 'CORTE') || '').trim();
        if (op || corte) return `${op}-${corte}`.toLowerCase();
        const opTela = String(getVal(row, 'OP TELA') || '').trim();
        const partida = String(getVal(row, 'PARTIDA') || '').trim();
        return `${opTela}-${partida}`.toLowerCase();
    };

    rowsOk.sort((a, b) => {
        const cmpOc = getOcSortKey(a.row).localeCompare(getOcSortKey(b.row), undefined, { numeric: true, sensitivity: 'base' });
        if (cmpOc !== 0) return cmpOc;
        const dateA = parseDateFromAnyHabilitado(getVal(a.row, 'HOD'));
        const dateB = parseDateFromAnyHabilitado(getVal(b.row, 'HOD'));
        const timeA = dateA ? dateA.getTime() : 0;
        const timeB = dateB ? dateB.getTime() : 0;
        return timeB - timeA;
    });

    renderHabilitadoIngresosDateOptions(rowsOk);

    const rowsAfterDateFilter = rowsOk.filter((obj) => {
        if (!habilitadoIngresosDateFilter) return true;
        const rawFIngReal = getRawFIngRealFromRow(obj.row);
        const label = getFIngRealDayMonthLabel(rawFIngReal);
        if (habilitadoIngresosDateFilter === '__EMPTY__') return !label;
        return label === habilitadoIngresosDateFilter;
    });

    renderHabilitadoIngresosPlantPills(rowsAfterDateFilter);

    const filteredRows = rowsAfterDateFilter.filter((obj) => {
        if (!habilitadoIngresosPlantFilter) return true;
        const planta = getHabilitadoIngresosPlantValue(obj.row);
        if (habilitadoIngresosPlantFilter === '__EMPTY__') return !planta;
        return planta === habilitadoIngresosPlantFilter;
    });

    updateHabilitadoIngresosPdsPill(filteredRows);

    if (filteredRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:16px;">No hay ingresos habilitados con estado OK para el filtro seleccionado.</td></tr>';
        try { markFilteredColumns('view-habilitado', []); } catch (e) { }
        return;
    }

    let lastOpPtda = null;
    let currentRowGroup = 'a';
    filteredRows.forEach((obj) => {
        const i = obj.idx;
        const row = obj.row;
        const tr = document.createElement('tr');

        const opTela = String(getVal(row, 'OP TELA') || '').trim();
        const partida = String(getVal(row, 'PARTIDA') || '').trim();
        const currentOpPtda = `${opTela}-${partida}`;
        if (lastOpPtda !== null && currentOpPtda !== lastOpPtda) {
            currentRowGroup = (currentRowGroup === 'a') ? 'b' : 'a';
        }
        lastOpPtda = currentOpPtda;
        tr.classList.add(`group-${currentRowGroup}`);

        const idxP = findPriorityHeaderIndex('habilitado');
        if (idxP !== -1) {
            const pValue = String(row[idxP] || '').trim();
            if (pValue === '1') tr.classList.add('priority-1');
        }

        const rawFIngReal = getRawFIngRealFromRow(row);
        const fIngReal = getFIngRealDayMonthLabel(rawFIngReal) || '-';
        const fIngRealTime = getFIngRealTimeLabel(rawFIngReal);
        const hod = formatValue(getVal(row, 'HOD'), 'date') || '';
        const cli = normalizeClientName(getVal(row, 'CLIENTE')) || '';
        const op = String(getVal(row, 'OP') || '').trim();
        const corte = String(getVal(row, 'CORTE') || '').trim();
        const oc = `${op}-${corte}`;
        const color = abbreviateHeather(getVal(row, 'COLOR')) || '';
        const pdsRaw = parseFloat(getVal(row, 'PDS GIRADAS')) || 0;
        const pds = formatThousands(pdsRaw, 0);
        const prenda = normalizePrenda(getVal(row, 'PRENDA')) || '';
        const tipoCert = normalizeTipoCert(getVal(row, 'TIPO CERTIFICADO')) || '';

        const ribVal = String(getVal(row, 'estado_rib') || getVal(row, 'RIB') || '').trim();
        const bloqVal = String(getVal(row, 'estado_bloques') || getVal(row, 'ESTADO_BLOQUES') || '').trim();
        const collVal = String(getVal(row, 'estado_coll_tap') || getVal(row, 'COLL o TAP?') || '').trim();
        const trsfTipo = String(getVal(row, 'tipo-transfer') || getVal(row, 'TIPO-TRANSFER') || getVal(row, 'tipo_transfer') || '').trim();
        const trsfVal = String(getVal(row, 'estado_transfer') || getVal(row, 'ESTADO_TRANSFER') || '').trim();
        const bordVal = String(getVal(row, 'estado_bordado') || '').trim();
        const estmVal = String(getVal(row, 'estado_estampado') || '').trim();
        const compOtros = getCompOtrosNormalizedParts({
            rib: ribVal,
            bloq: bloqVal,
            coll: collVal,
            trsfTipo: trsfTipo,
            trsfEstado: trsfVal,
            bord: bordVal,
            estm: estmVal
        }).join(' | ');

        const observaciones = String(getVal(row, 'OBSERVACIONES') || getVal(row, 'OBSERVACION') || getVal(row, 'OBS') || '').trim();
        const planta = String(getVal(row, 'PLANTA') || '').trim() || 'XASIG';
        const linea = String(getVal(row, 'LINEA') || '').trim() || 'XASIG';

        tr.setAttribute('data-row-index', i);
        tr.innerHTML = `
                    <td class="date-cell" style="text-align:center;" title="${escapeHtmlHabilitadoIngresos(fIngRealTime ? 'Hora ingreso: ' + fIngRealTime : '')}">${escapeHtmlHabilitadoIngresos(fIngReal)}</td>
                    <td class="date-cell" style="text-align:center;">${escapeHtmlHabilitadoIngresos(hod)}</td>
                    <td class="cell-planta" style="text-align:center;">${escapeHtmlHabilitadoIngresos(planta)}</td>
                    <td class="linea-cell" style="text-align:center;">${escapeHtmlHabilitadoIngresos(linea)}</td>
                    <td style="text-align:center;" title="${escapeHtmlHabilitadoIngresos(cli)}">${escapeHtmlHabilitadoIngresos(cli)}</td>
                    <td class="op-cell oc-cell" title="${escapeHtmlHabilitadoIngresos(oc)}">${escapeHtmlHabilitadoIngresos(oc)}</td>
                    <td class="cell-color" title="${escapeHtmlHabilitadoIngresos(color)}">${escapeHtmlHabilitadoIngresos(color)}</td>
                    <td class="kg-cell pds-cell" style="text-align:center;">${escapeHtmlHabilitadoIngresos(pds)}</td>
                    <td class="cell-pda" title="${escapeHtmlHabilitadoIngresos(prenda)}">${escapeHtmlHabilitadoIngresos(prenda)}</td>
                    <td class="cell-cert" title="${escapeHtmlHabilitadoIngresos(tipoCert)}">${escapeHtmlHabilitadoIngresos(tipoCert)}</td>
                    <td class="wrap-text col-comp-otros" style="text-align:left;" title="${escapeHtmlHabilitadoIngresos(compOtros)}">${escapeHtmlHabilitadoIngresos(compOtros)}</td>
                    <td class="wrap-text observaciones-cell col-observaciones" style="text-align:left;" title="${escapeHtmlHabilitadoIngresos(observaciones)}" ondblclick="editObservaciones(this, ${i})"><span class="observaciones-display">${escapeHtmlHabilitadoIngresos(observaciones)}</span></td>
                `;
        tbody.appendChild(tr);
    });

    try { markFilteredColumns('view-habilitado', []); } catch (e) { }
}

window.toggleHabilitadoIngresosMode = function () {
    isHabilitadoIngresosMode = !isHabilitadoIngresosMode;
    if (!isHabilitadoIngresosMode) {
        habilitadoIngresosDateFilter = '';
        habilitadoIngresosPlantFilter = '';
    }
    renderHabilitado();
};

window.onHabilitadoIngresosDateFilterChange = function (value) {
    habilitadoIngresosDateFilter = value || '';
    if (isHabilitadoIngresosMode) renderHabilitado();
};

window.onHabilitadoIngresosPlantFilterChange = function (value) {
    habilitadoIngresosPlantFilter = value || '';
    if (isHabilitadoIngresosMode) renderHabilitado();
};

