function escapeHtmlDevolucionHabilitado(txt) {
    return window.PcpTextUtils.escapeHtmlLoose(txt);
}

function getOcDevolucionHabilitadoRow(row) {
    const op = String(getVal(row, 'OP') || '').trim();
    const corte = String(getVal(row, 'CORTE') || '').trim();
    if (op && corte) return `${op}-${corte}`;
    const ocRaw = String(getVal(row, 'OC') || '').trim();
    if (ocRaw) return ocRaw;
    if (op) return op;
    return corte;
}

function getDefaultHabDevolucionValue() {
    const f = String(currentHabilitadoFilter || '').toUpperCase().trim();
    if (f === 'PROG 1T' || f === 'PROG 2T' || f === 'PROG 3T') return f;
    return 'PROG 1T';
}

function findRowsForDevolucionByOc(query) {
    const queryNorm = String(query || '').toUpperCase().replace(/\s+/g, '').trim();
    if (!queryNorm) return [];

    const results = [];
    const defaultHab = getDefaultHabDevolucionValue();
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const oc = getOcDevolucionHabilitadoRow(row);
        if (!oc) continue;
        const ocNorm = String(oc).toUpperCase().replace(/\s+/g, '').trim();
        if (!ocNorm.startsWith(queryNorm)) continue;

        const habNorm = String(getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || '').toUpperCase().trim();
        if (habNorm !== 'OK' && habNorm !== 'OK S/DESTINO') continue;

        const cliente = normalizeClientName(getVal(row, 'CLIENTE')) || '';
        const pdsRaw = parseFloat(getVal(row, 'PDS GIRADAS') || getVal(row, 'PDS') || 0) || 0;
        const plantaRaw = String(getVal(row, 'PLANTA') || '').trim();
        const plantaNorm = plantaRaw.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
        let plantaValue = plantaRaw;
        if (plantaNorm === 'CITI1') plantaValue = 'CITI1';
        else if (plantaNorm === 'CITI2') plantaValue = 'CITI2';
        else if (plantaNorm === 'CITI3') plantaValue = 'CITI3';
        else if (plantaNorm === 'CITI4') plantaValue = 'CITI4';
        else if (plantaNorm === 'CITI5') plantaValue = 'CITI5';
        else if (plantaNorm === 'COFACO') plantaValue = 'COFACO';
        else if (plantaNorm === 'S/DESTINO') plantaValue = 'S/DESTINO';
        else if (plantaNorm === '') plantaValue = '';
        const lineaValue = String(getVal(row, 'LINEA') || '').trim();
        results.push({
            rowIndex: i,
            cliente,
            oc,
            pdsRaw,
            pds: formatThousands(pdsRaw, 0),
            plantaValue,
            lineaValue,
            nuevoHab: defaultHab
        });
    }

    results.sort((a, b) => {
        const cmpOc = a.oc.localeCompare(b.oc, undefined, { numeric: true, sensitivity: 'base' });
        if (cmpOc !== 0) return cmpOc;
        return b.pdsRaw - a.pdsRaw;
    });
    return results;
}

function renderModalDevolucionHabilitadoRows() {
    const tbody = document.getElementById('modal-devolucion-habilitado-tbody');
    if (!tbody) return;

    const rows = (modalDevolucionHabilitadoData && Array.isArray(modalDevolucionHabilitadoData.matches))
        ? modalDevolucionHabilitadoData.matches
        : [];
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="modal-devolucion-empty">No se encontraron filas en estado OK para esa OC.</td></tr>';
        return;
    }

    let html = '';
    rows.forEach((item, idx) => {
        const habNorm = String(item.nuevoHab || '').toUpperCase().trim();
        const plantaVal = String(item.plantaValue || '').trim();
        const lineaVal = String(item.lineaValue || '').trim();
        const knownPlantas = ['', 'COFACO', 'CITI1', 'CITI2', 'CITI3', 'CITI4', 'CITI5', 'S/DESTINO'];
        const extraPlantaOpt = (plantaVal && knownPlantas.indexOf(plantaVal) === -1)
            ? `<option value="${escapeHtmlDevolucionHabilitado(plantaVal)}" selected>${escapeHtmlDevolucionHabilitado(plantaVal)}</option>`
            : '';
        html += `
                    <tr data-row-index="${item.rowIndex}">
                        <td title="${escapeHtmlDevolucionHabilitado(item.cliente)}">${escapeHtmlDevolucionHabilitado(item.cliente)}</td>
                        <td title="${escapeHtmlDevolucionHabilitado(item.oc)}">${escapeHtmlDevolucionHabilitado(item.oc)}</td>
                        <td style="text-align:center;">${escapeHtmlDevolucionHabilitado(item.pds)}</td>
                        <td style="text-align:center;">
                            <select class="table-select" onchange="handleDevolucionHabilitadoPlantaChange(${idx}, this.value)">
                                ${extraPlantaOpt}
                                <option value="" ${plantaVal === '' ? 'selected' : ''}>XASIG</option>
                                <option value="COFACO" ${plantaVal === 'COFACO' ? 'selected' : ''}>COFACO</option>
                                <option value="CITI1" ${plantaVal === 'CITI1' ? 'selected' : ''}>CITI1</option>
                                <option value="CITI2" ${plantaVal === 'CITI2' ? 'selected' : ''}>CITI2</option>
                                <option value="CITI3" ${plantaVal === 'CITI3' ? 'selected' : ''}>CITI3</option>
                                <option value="CITI4" ${plantaVal === 'CITI4' ? 'selected' : ''}>CITI4</option>
                                <option value="CITI5" ${plantaVal === 'CITI5' ? 'selected' : ''}>CITI5</option>
                                <option value="S/DESTINO" ${plantaVal === 'S/DESTINO' ? 'selected' : ''}>S/DESTINO</option>
                            </select>
                        </td>
                        <td style="text-align:center;">
                        <input type="text" value="${escapeHtmlDevolucionHabilitado(lineaVal)}" placeholder="XASIG" style="width:82px; padding:6px 8px; border:1px solid var(--gray-300); border-radius:6px; font-size:12px; text-align:center;" oninput="handleDevolucionHabilitadoLineaChange(${idx}, this.value)" onchange="handleDevolucionHabilitadoLineaChange(${idx}, this.value)">
                        </td>
                        <td style="text-align:center;">
                            <select class="table-select sel-PROG" onchange="handleDevolucionHabilitadoHabChange(${idx}, this.value)">
                                <option value="PROG 1T" ${habNorm === 'PROG 1T' ? 'selected' : ''}>PROG 1T</option>
                                <option value="PROG 2T" ${habNorm === 'PROG 2T' ? 'selected' : ''}>PROG 2T</option>
                                <option value="PROG 3T" ${habNorm === 'PROG 3T' ? 'selected' : ''}>PROG 3T</option>
                            </select>
                        </td>
                    </tr>
                `;
    });
    tbody.innerHTML = html;
}

window.abrirModalDevolucionHabilitado = function () {
    const modal = document.getElementById('modal-devolucion-habilitado');
    if (!modal) return;

    modalDevolucionHabilitadoData = { matches: [] };

    const input = document.getElementById('modal-devolucion-habilitado-oc');
    if (input) input.value = '';

    const info = document.getElementById('modal-devolucion-habilitado-info');
    if (info) {
        info.style.display = 'none';
        info.textContent = '';
    }

    const tbody = document.getElementById('modal-devolucion-habilitado-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="modal-devolucion-empty">Ingrese una OC y presione Buscar.</td></tr>';

    const btn = document.getElementById('btn-habilitado-devolucion');
    if (btn) btn.classList.add('active');

    modal.classList.add('active');
    setTimeout(() => { try { if (input) input.focus(); } catch (e) { } }, 50);
};

window.cerrarModalDevolucionHabilitado = function () {
    const modal = document.getElementById('modal-devolucion-habilitado');
    if (modal) modal.classList.remove('active');
    const btn = document.getElementById('btn-habilitado-devolucion');
    if (btn) btn.classList.remove('active');
    modalDevolucionHabilitadoData = { matches: [] };
};

window.buscarOCHabilitadoDevolucion = function () {
    const input = document.getElementById('modal-devolucion-habilitado-oc');
    const query = input ? String(input.value || '').trim() : '';
    if (!query) {
        alert('Ingrese una OC para buscar.');
        return;
    }

    const matches = findRowsForDevolucionByOc(query);
    modalDevolucionHabilitadoData.matches = matches;
    renderModalDevolucionHabilitadoRows();

    const info = document.getElementById('modal-devolucion-habilitado-info');
    if (info) {
        info.style.display = 'block';
        info.textContent = `Busqueda: ${query} | Filas OK encontradas: ${matches.length}`;
    }
};

window.handleDevolucionHabilitadoHabChange = function (idx, value) {
    if (!modalDevolucionHabilitadoData || !Array.isArray(modalDevolucionHabilitadoData.matches)) return;
    if (!modalDevolucionHabilitadoData.matches[idx]) return;
    modalDevolucionHabilitadoData.matches[idx].nuevoHab = String(value || '').toUpperCase().trim();
};

window.handleDevolucionHabilitadoPlantaChange = function (idx, value) {
    if (!modalDevolucionHabilitadoData || !Array.isArray(modalDevolucionHabilitadoData.matches)) return;
    if (!modalDevolucionHabilitadoData.matches[idx]) return;
    modalDevolucionHabilitadoData.matches[idx].plantaValue = String(value || '').trim();
};

window.handleDevolucionHabilitadoLineaChange = function (idx, value) {
    if (!modalDevolucionHabilitadoData || !Array.isArray(modalDevolucionHabilitadoData.matches)) return;
    if (!modalDevolucionHabilitadoData.matches[idx]) return;
    modalDevolucionHabilitadoData.matches[idx].lineaValue = String(value || '').trim();
};

window.generarDevolucionHabilitado = function () {
    const rows = (modalDevolucionHabilitadoData && Array.isArray(modalDevolucionHabilitadoData.matches))
        ? modalDevolucionHabilitadoData.matches
        : [];
    if (!rows.length) {
        alert('No hay filas para devolver.');
        return;
    }

    const validStates = new Set(['PROG 1T', 'PROG 2T', 'PROG 3T']);
    const btn = document.getElementById('btn-modal-devolucion-generar');
    if (btn) btn.disabled = true;

    try {
        let updatedCount = 0;
        rows.forEach((item) => {
            const state = String(item.nuevoHab || '').toUpperCase().trim();
            if (!validStates.has(state)) return;
            const plantaVal = String(item.plantaValue || '').trim();
            const lineaVal = String(item.lineaValue || '').trim();
            updateRow(item.rowIndex, 'PLANTA', plantaVal, null, true, true);
            updateRow(item.rowIndex, 'LINEA', lineaVal, null, true, true);
            updateRow(item.rowIndex, 'estado_habilitado', state, null, true, true);
            updatedCount++;
        });

        if (updatedCount === 0) {
            alert('No se aplicaron cambios.');
            return;
        }

        cerrarModalDevolucionHabilitado();
        setTimeout(() => {
            try { renderHabilitado(); } catch (e) { }
            try { updateCounters(); } catch (e) { }
        }, 300);
        alert(`Devolucion generada en ${updatedCount} fila(s).`);
    } finally {
        if (btn) btn.disabled = false;
    }
};

// Funci?n auxiliar para propagar cambios a filas con mismo OP y serie de corte
