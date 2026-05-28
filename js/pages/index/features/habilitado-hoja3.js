function isHabilitadoProgTurnSubtab() {
    return currentHabilitadoFilter === 'PROG 1T' || currentHabilitadoFilter === 'PROG 2T' || currentHabilitadoFilter === 'PROG 3T';
}

function createEmptyHabilitadoHoja3Row() {
    return { cliente: '', ops: '', color: '', pds: '', comentario: '', comentario_general: '' };
}

function normalizeHabilitadoHoja3Turno(turno) {
    const val = String(turno || '').toUpperCase().trim();
    if (val === 'PROG 1T' || val === 'PROG 2T' || val === 'PROG 3T') return val;
    return '';
}

function cloneHabilitadoHoja3Rows(rows) {
    return (rows || []).map((r) => ({
        cliente: String((r && r.cliente) || ''),
        ops: String((r && r.ops) || ''),
        color: String((r && r.color) || ''),
        pds: String((r && r.pds) || ''),
        comentario: String((r && r.comentario) || ''),
        comentario_general: String((r && r.comentario_general) || '')
    }));
}

function getHabilitadoHoja3TurnoActual() {
    return normalizeHabilitadoHoja3Turno(habilitadoHoja3TurnoActual || currentHabilitadoFilter);
}

function persistHabilitadoHoja3Draft() {
    const turno = getHabilitadoHoja3TurnoActual();
    if (!turno) return;
    habilitadoHoja3RowsByTurn[turno] = cloneHabilitadoHoja3Rows(habilitadoHoja3Rows);
}

function loadHabilitadoHoja3Draft(turno) {
    const turnoNorm = normalizeHabilitadoHoja3Turno(turno);
    habilitadoHoja3TurnoActual = turnoNorm;
    if (!turnoNorm) {
        habilitadoHoja3Rows = [];
        return;
    }
    const stored = Array.isArray(habilitadoHoja3RowsByTurn[turnoNorm]) ? habilitadoHoja3RowsByTurn[turnoNorm] : [];
    habilitadoHoja3Rows = cloneHabilitadoHoja3Rows(stored);
}

function normalizeHoja3HeaderKey(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function parseHoja3RowsFromGvizResponse(jsonResponse, turno) {
    const table = (jsonResponse && jsonResponse.table) ? jsonResponse.table : null;
    if (!table) return [];

    const cols = Array.isArray(table.cols) ? table.cols : [];
    const rows = Array.isArray(table.rows) ? table.rows : [];

    const getCellValue = function (cells, idx) {
        if (idx < 0 || idx >= cells.length) return '';
        const cell = cells[idx];
        if (!cell) return '';
        if (cell.f !== null && cell.f !== undefined && String(cell.f) !== '') {
            return String(cell.f);
        }
        if (cell.v === null || cell.v === undefined) return '';
        const val = cell.v;
        if (Object.prototype.toString.call(val) === '[object Date]') {
            try {
                const y = val.getFullYear();
                const m = String(val.getMonth() + 1).padStart(2, '0');
                const d = String(val.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            } catch (e) { }
        }
        return String(val);
    };

    let headers = cols.map(col => String((col && (col.label || col.id)) || '').trim());
    let dataRows = rows;

    const findHeaderIndexFrom = function (headersInput, keys) {
        const wanted = keys.map(k => normalizeHoja3HeaderKey(k));
        for (let i = 0; i < headersInput.length; i++) {
            const hdr = normalizeHoja3HeaderKey(headersInput[i]);
            if (wanted.indexOf(hdr) !== -1) return i;
        }
        return -1;
    };

    let idxTurnoFound = findHeaderIndexFrom(headers, ['TURNO']);
    if (idxTurnoFound === -1 && rows.length > 0) {
        const firstRowCells = (rows[0] && Array.isArray(rows[0].c)) ? rows[0].c : [];
        const headersFromRow = [];
        for (let hi = 0; hi < firstRowCells.length; hi++) {
            headersFromRow.push(getCellValue(firstRowCells, hi));
        }
        if (headersFromRow.length > 0) {
            headers = headersFromRow;
            dataRows = rows.slice(1);
            idxTurnoFound = findHeaderIndexFrom(headers, ['TURNO']);
        }
    }

    const idxClienteFound = findHeaderIndexFrom(headers, ['CLIENTE']);
    const idxOpsFound = findHeaderIndexFrom(headers, ['OPS', 'OP']);
    const idxColorFound = findHeaderIndexFrom(headers, ['COLOR']);
    const idxPdsFound = findHeaderIndexFrom(headers, ['PDS']);
    const idxComentarioFound = findHeaderIndexFrom(headers, ['COMENTARIO']);
    const idxComentarioGeneralFound = findHeaderIndexFrom(headers, ['COMENTARIOSGENERALES', 'COMENTARIOGENERAL']);
    const idxTurno = idxTurnoFound !== -1 ? idxTurnoFound : 0;
    const idxCliente = idxClienteFound !== -1 ? idxClienteFound : 1;
    const idxOps = idxOpsFound !== -1 ? idxOpsFound : 2;
    const idxColor = idxColorFound !== -1 ? idxColorFound : 3;
    const idxPds = idxPdsFound !== -1 ? idxPdsFound : 4;
    const idxComentario = idxComentarioFound !== -1 ? idxComentarioFound : 5;
    const idxComentarioGeneral = idxComentarioGeneralFound !== -1 ? idxComentarioGeneralFound : 6;

    const turnoNorm = normalizeHabilitadoHoja3Turno(turno);
    const out = [];
    dataRows.forEach((row) => {
        const cells = (row && Array.isArray(row.c)) ? row.c : [];
        const rowTurno = String(getCellValue(cells, idxTurno) || '').toUpperCase().trim();
        if (turnoNorm && rowTurno !== turnoNorm) return;

        const clienteRaw = String(getCellValue(cells, idxCliente) || '').trim();
        const cliente = String(normalizeClientName(clienteRaw) || clienteRaw || '').trim();
        const ops = String(getCellValue(cells, idxOps) || '').trim();
        const color = String(getCellValue(cells, idxColor) || '').trim();
        const pds = String(getCellValue(cells, idxPds) || '').trim();
        const comentario = String(getCellValue(cells, idxComentario) || '').trim();
        const comentario_general = String(getCellValue(cells, idxComentarioGeneral) || '').trim();

        if (!cliente && !ops && !color && !pds && !comentario && !comentario_general) return;
        out.push({ cliente, ops, color, pds, comentario, comentario_general });
    });
    return out;
}

function fetchHoja3RowsByTurn(turno) {
    return new Promise((resolve, reject) => {
        const cbName = '__loadHoja3Rows_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        let script = null;
        let timer = null;
        let settled = false;

        const cleanup = function () {
            if (timer) clearTimeout(timer);
            if (script && script.parentNode) {
                try { script.parentNode.removeChild(script); } catch (e) { }
            }
            try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
        };

        const finish = function (handler, payload) {
            if (settled) return;
            settled = true;
            cleanup();
            handler(payload);
        };

        window[cbName] = function (jsonResponse) {
            try {
                const parsed = parseHoja3RowsFromGvizResponse(jsonResponse, turno);
                finish(resolve, parsed);
            } catch (err) {
                finish(reject, err);
            }
        };

        script = document.createElement('script');
        script.async = true;
        script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:${cbName}&sheet=${encodeURIComponent('Hoja 3')}&headers=0&_=${Date.now()}`;
        script.onerror = function () {
            finish(reject, new Error('No se pudo cargar Hoja 3'));
        };

        timer = setTimeout(() => {
            finish(reject, new Error('Tiempo de espera agotado cargando Hoja 3'));
        }, 12000);

        document.body.appendChild(script);
    });
}

async function loadHabilitadoHoja3FromSheet(turno, requestId) {
    const turnoNorm = normalizeHabilitadoHoja3Turno(turno);
    if (!turnoNorm) return;
    try {
        const rows = await fetchHoja3RowsByTurn(turnoNorm);
        if (requestId !== habilitadoHoja3LoadRequestId) return;
        if (getHabilitadoHoja3TurnoActual() !== turnoNorm) return;
        habilitadoHoja3Rows = cloneHabilitadoHoja3Rows(rows);
        ensureHabilitadoHoja3Rows();
        persistHabilitadoHoja3Draft();
        renderHabilitadoHoja3Rows();
    } catch (err) {
        console.error('Error cargando Hoja 3 por turno', err);
    }
}

function ensureHabilitadoHoja3Rows(minRows = HABILITADO_HOJA3_MIN_ROWS) {
    if (!Array.isArray(habilitadoHoja3Rows)) habilitadoHoja3Rows = [];
    while (habilitadoHoja3Rows.length < minRows) habilitadoHoja3Rows.push(createEmptyHabilitadoHoja3Row());
}

function getUniqueClientesHoja1ForHabilitadoHoja3() {
    const map = new Map();
    if (!Array.isArray(rawData) || rawData.length <= 1) return [];
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const rawCliente = String(getVal(row, 'CLIENTE') || '').trim();
        const clienteNorm = String(normalizeClientName(rawCliente) || rawCliente || '').trim();
        if (!clienteNorm) continue;
        const key = clienteNorm.toUpperCase();
        if (!map.has(key)) map.set(key, clienteNorm);
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function renderHabilitadoHoja3Rows() {
    const leftBody = document.getElementById('tbody-habilitado-hoja3-left');
    const rightBody = document.getElementById('tbody-habilitado-hoja3-right');
    if (!leftBody || !rightBody) return;

    ensureHabilitadoHoja3Rows();
    const clientes = getUniqueClientesHoja1ForHabilitadoHoja3();

    leftBody.innerHTML = '';
    rightBody.innerHTML = '';

    habilitadoHoja3Rows.forEach((rowData, idx) => {
        const trLeft = document.createElement('tr');

        const tdCliente = document.createElement('td');
        const selCliente = document.createElement('select');
        selCliente.className = 'habilitado-hoja3-select';
        const optEmpty = document.createElement('option');
        optEmpty.value = '';
        optEmpty.textContent = 'Seleccionar';
        selCliente.appendChild(optEmpty);
        clientes.forEach(c => {
            const o = document.createElement('option');
            o.value = c;
            o.textContent = c;
            selCliente.appendChild(o);
        });
        selCliente.value = rowData.cliente || '';
        selCliente.onchange = function () {
            habilitadoHoja3Rows[idx].cliente = this.value || '';
            persistHabilitadoHoja3Draft();
        };
        tdCliente.appendChild(selCliente);
        trLeft.appendChild(tdCliente);

        const tdOps = document.createElement('td');
        const inpOps = document.createElement('input');
        inpOps.type = 'text';
        inpOps.className = 'habilitado-hoja3-input';
        inpOps.value = rowData.ops || '';
        inpOps.oninput = function () {
            habilitadoHoja3Rows[idx].ops = this.value || '';
            persistHabilitadoHoja3Draft();
        };
        tdOps.appendChild(inpOps);
        trLeft.appendChild(tdOps);

        const tdColor = document.createElement('td');
        const inpColor = document.createElement('input');
        inpColor.type = 'text';
        inpColor.className = 'habilitado-hoja3-input';
        inpColor.value = rowData.color || '';
        inpColor.oninput = function () {
            habilitadoHoja3Rows[idx].color = this.value || '';
            persistHabilitadoHoja3Draft();
        };
        tdColor.appendChild(inpColor);
        trLeft.appendChild(tdColor);

        const tdPds = document.createElement('td');
        const inpPds = document.createElement('input');
        inpPds.type = 'text';
        inpPds.className = 'habilitado-hoja3-input';
        inpPds.value = rowData.pds || '';
        inpPds.oninput = function () {
            habilitadoHoja3Rows[idx].pds = this.value || '';
            persistHabilitadoHoja3Draft();
        };
        tdPds.appendChild(inpPds);
        trLeft.appendChild(tdPds);

        const tdComentario = document.createElement('td');
        const inpComentario = document.createElement('input');
        inpComentario.type = 'text';
        inpComentario.className = 'habilitado-hoja3-input';
        inpComentario.value = rowData.comentario || '';
        inpComentario.oninput = function () {
            habilitadoHoja3Rows[idx].comentario = this.value || '';
            persistHabilitadoHoja3Draft();
        };
        tdComentario.appendChild(inpComentario);
        trLeft.appendChild(tdComentario);

        leftBody.appendChild(trLeft);

        const trRight = document.createElement('tr');
        const tdGeneral = document.createElement('td');
        const inpGeneral = document.createElement('input');
        inpGeneral.type = 'text';
        inpGeneral.className = 'habilitado-hoja3-input';
        inpGeneral.value = rowData.comentario_general || '';
        inpGeneral.oninput = function () {
            habilitadoHoja3Rows[idx].comentario_general = this.value || '';
            persistHabilitadoHoja3Draft();
        };
        tdGeneral.appendChild(inpGeneral);
        trRight.appendChild(tdGeneral);
        rightBody.appendChild(trRight);
    });

    persistHabilitadoHoja3Draft();
}

function setHabilitadoHoja3ModalSubtitle(turno) {
    const subtitle = document.getElementById('modal-habilitado-hoja3-subtitle');
    if (!subtitle) return;
    const turnoNorm = normalizeHabilitadoHoja3Turno(turno);
    subtitle.textContent = turnoNorm ? `Turno: ${turnoNorm}` : 'Turno: -';
}

function closeHabilitadoHoja3Modal() {
    persistHabilitadoHoja3Draft();
    const modal = document.getElementById('modal-habilitado-hoja3');
    if (modal) modal.classList.remove('active');
}

function openHabilitadoHoja3Modal() {
    if (isHabilitadoIngresosMode || !isHabilitadoProgTurnSubtab()) return;
    const turno = normalizeHabilitadoHoja3Turno(currentHabilitadoFilter);
    if (!turno) return;
    loadHabilitadoHoja3Draft(turno);
    ensureHabilitadoHoja3Rows();
    setHabilitadoHoja3ModalSubtitle(turno);
    renderHabilitadoHoja3Rows();
    const modal = document.getElementById('modal-habilitado-hoja3');
    if (modal) modal.classList.add('active');
    const requestId = ++habilitadoHoja3LoadRequestId;
    loadHabilitadoHoja3FromSheet(turno, requestId);
}

function updateHabilitadoHoja3BlockVisibility() {
    const btn = document.getElementById('btn-habilitado-notas');
    const shouldShow = !isHabilitadoIngresosMode && isHabilitadoProgTurnSubtab();
    if (btn) btn.style.display = shouldShow ? 'inline-flex' : 'none';
    if (!shouldShow) {
        closeHabilitadoHoja3Modal();
        return;
    }
    setHabilitadoHoja3ModalSubtitle(currentHabilitadoFilter);
}

window.abrirModalHabilitadoHoja3 = openHabilitadoHoja3Modal;
window.cerrarModalHabilitadoHoja3 = closeHabilitadoHoja3Modal;

window.addHabilitadoHoja3Row = function () {
    ensureHabilitadoHoja3Rows();
    habilitadoHoja3Rows.push(createEmptyHabilitadoHoja3Row());
    persistHabilitadoHoja3Draft();
    renderHabilitadoHoja3Rows();
};

window.limpiarHabilitadoHoja3 = function () {
    habilitadoHoja3Rows = [];
    ensureHabilitadoHoja3Rows();
    persistHabilitadoHoja3Draft();
    renderHabilitadoHoja3Rows();
};

window.guardarHabilitadoHoja3 = function () {
    const turnoGuardar = getHabilitadoHoja3TurnoActual();
    if (!turnoGuardar) {
        alert('Seleccione PROG 1T, PROG 2T o PROG 3T para guardar notas.');
        return;
    }
    const rows = (habilitadoHoja3Rows || []).map(r => ({
        cliente: String(r.cliente || '').trim(),
        ops: String(r.ops || '').trim(),
        color: String(r.color || '').trim(),
        pds: String(r.pds || '').trim(),
        comentario: String(r.comentario || '').trim(),
        comentario_general: String(r.comentario_general || '').trim()
    })).filter(r => (r.cliente || r.ops || r.color || r.pds || r.comentario || r.comentario_general));

    const isClearAll = rows.length === 0;

    const btn = document.getElementById('btn-guardar-habilitado-hoja3');
    if (btn) btn.disabled = true;

    window.PcpProgramaService.guardarHoja3Rows(turnoGuardar, rows, { noCors: true }).then(() => {
        if (isClearAll) {
            alert(`Notas del turno ${turnoGuardar} actualizadas: se limpiaron los registros en Hoja 3.`);
        } else {
            alert(`Datos actualizados en Hoja 3 (${rows.length} fila(s)).`);
        }
        window.limpiarHabilitadoHoja3();
    }).catch((err) => {
        console.error('Error guardando Hoja 3', err);
        alert('No se pudo guardar en Hoja 3.');
    }).finally(() => {
        if (btn) btn.disabled = false;
    });
};

// =============================================
// FUNCIONES PARA PROGRAMAR FILAS EN CORTE PZAS (X PROG)
// =============================================

// Helper: Obtener todas las filas visibles en la vista Corte Pzas con el mismo OP-PTDA y F. GIRADO
