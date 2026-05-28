function isCorteProgSubtab() {
    try {
        return document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active')
            && currentCorteFilter && currentCorteFilter.toString().toUpperCase().startsWith('PROG ') && currentCorteFilter !== 'X PROG';
    } catch (e) { return false; }
}

function isEnumeradoView() {
    try {
        return document.getElementById('view-enumerado') && document.getElementById('view-enumerado').classList.contains('active');
    } catch (e) { return false; }
}

function isHabilitadoView() {
    try {
        return document.getElementById('view-habilitado') && document.getElementById('view-habilitado').classList.contains('active');
    } catch (e) { return false; }
}

function renderRutaBadge(rutaVal, row = null, rowIndex = null) {
    const rutaKey = String(rutaVal || "").toUpperCase().trim();
    let rutaDisplay = rutaVal;

    try {
        const onCorteView = document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active');
        if (rutaKey.indexOf('NORMAL') !== -1 && onCorteView && currentCorteFilter === 'X PROG') {
            const current = String(rutaVal || '').toUpperCase().trim();
            const opts = ['LAVADA', 'ACABADA'];
            let optionsHtml = '';
            let matched = false;
            for (const o of opts) {
                const sel = (current === o) ? 'selected' : '';
                if (sel) matched = true;
                optionsHtml += `<option value="${o}" ${sel}>${o}</option>`;
            }
            if (current && !matched) {
                optionsHtml = `<option value="${current}" selected>${current}</option>` + optionsHtml;
            }
            const idx = (rowIndex !== null) ? rowIndex : '';
            rutaDisplay = `<select class="table-select" onchange="updateRow(${idx}, 'RUTA TELA', this.value, this)">${optionsHtml}</select>`;
            return rutaDisplay;
        }
    } catch (e) { }

    if (rutaKey === 'ACABADA') {
        rutaDisplay = `<span class="route-badge route-ac">AC</span>`;
    } else if (rutaKey === 'LAVADA') {
        if (row) {
            const lavadaState = getLavadaRouteState(row);
            if (lavadaState === 'X PEDIR') {
                rutaDisplay = `<span class="route-badge route-xpedir">x pedir</span>`;
            } else if (lavadaState === 'X BLOQ') {
                rutaDisplay = `<span class="route-badge route-bloq">x bloq</span>`;
            } else if (lavadaState === 'X LAVAR') {
                rutaDisplay = `<span class="route-badge route-xlav">x lavar</span>`;
            } else if (lavadaState === 'LV-OK') {
                rutaDisplay = `<span class="route-badge route-lv">LV-ok</span>`;
            } else {
                rutaDisplay = `<span class="route-badge route-lv">LV</span>`;
            }
        } else {
            rutaDisplay = `<span class="route-badge route-lv">LV</span>`;
        }
    }

    return rutaDisplay;
}
