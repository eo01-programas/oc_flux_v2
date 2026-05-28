const HABILITADO_OK_ALLOWED_PLANTAS = ['COFACO', 'CITI1', 'CITI2', 'CITI3', 'CITI4', 'CITI5'];

function normalizeHabilitadoPlantaValue(value) {
    const plantaRaw = String(value || '').trim();
    const plantaNorm = plantaRaw.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    if (!plantaNorm) return '';
    if (plantaNorm === 'COFACO') return 'COFACO';
    if (plantaNorm === 'COFACO2') return 'COFACO 2';
    if (plantaNorm === 'S/DESTINO') return 'S/DESTINO';
    const citiMatch = plantaNorm.match(/^CITI([1-5])$/);
    if (citiMatch) return `CITI${citiMatch[1]}`;
    return plantaRaw.toUpperCase();
}

function getHabilitadoEstadoNorm(rowIndex) {
    if (!rawData[rowIndex]) return '';
    return String(
        getVal(rawData[rowIndex], 'estado_habilitado')
        || getVal(rawData[rowIndex], 'ESTADO_HABILITADO')
        || getVal(rawData[rowIndex], 'ESTADO HABILITADO')
        || ''
    ).trim().toUpperCase();
}

function validateHabilitadoPlantaForEstado(plantaValue, estadoHabValue) {
    const estadoNorm = String(estadoHabValue || '').trim().toUpperCase();
    const normalizedPlanta = normalizeHabilitadoPlantaValue(plantaValue);
    if (estadoNorm === 'OK' && HABILITADO_OK_ALLOWED_PLANTAS.indexOf(normalizedPlanta) === -1) {
        return {
            valid: false,
            normalizedPlanta,
            message: 'Si HAB = OK, PLANTA solo puede ser COFACO, CITI1, CITI2, CITI3, CITI4 o CITI5.'
        };
    }
    return { valid: true, normalizedPlanta };
}

function syncIngresoCosturaPlantaOptions(estadoHabTarget) {
    const plantaSelect = document.getElementById('modal-ingreso-planta');
    if (!plantaSelect) return;
    const allowSDestino = String(estadoHabTarget || '').trim().toUpperCase() === 'OK S/DESTINO';
    Array.from(plantaSelect.options).forEach(option => {
        if (option.value === 'S/DESTINO') {
            option.hidden = !allowSDestino;
            option.disabled = !allowSDestino;
        }
    });
}

// --- FUNCI?N PARA ACTUALIZAR PLANTA EN HABILITADO ---
function updatePlanta(rowIndex, value, selectElement) {
    // PROTECCION: No permitir escritura en encabezados
    if (rowIndex < 1 || !rawData[rowIndex]) {
        console.error('PROTECCION updatePlanta: rowIndex invalido=' + rowIndex);
        return;
    }
    const currentPlanta = getVal(rawData[rowIndex], 'PLANTA') || '';
    const validation = validateHabilitadoPlantaForEstado(value, getHabilitadoEstadoNorm(rowIndex));
    if (!validation.valid) {
        if (selectElement) {
            selectElement.value = normalizeHabilitadoPlantaValue(currentPlanta);
        }
        alert(validation.message);
        return;
    }
    const normalizedValue = validation.normalizedPlanta;
    if (selectElement && selectElement.value !== normalizedValue) {
        selectElement.value = normalizedValue;
    }

    const groupKey = getOcGroupKey(rowIndex);
    const isFirstTouch = groupKey && !touchedPlantaOcGroups.has(groupKey);
    const rowsToUpdate = isFirstTouch
        ? getVisibleHabilitadoRowsWithSameOcGroup(rowIndex)
        : [rowIndex];

    if (isFirstTouch) touchedPlantaOcGroups.add(groupKey);

    rowsToUpdate.forEach(idx => {
        const idxPlanta = findHeaderIndexCaseInsensitive('PLANTA');
        if (idxPlanta !== -1 && rawData[idx]) {
            rawData[idx][idxPlanta] = normalizedValue;
        }

        let targetSelect = null;
        try {
            const tbodyHab = document.getElementById('tbody-habilitado');
            if (tbodyHab) {
                const tr = tbodyHab.querySelector('tr[data-row-index="' + idx + '"]');
                if (tr) targetSelect = tr.querySelector('select.planta-select[data-row="' + idx + '"]');
            }
        } catch (e) { console.error('Error ubicando select de PLANTA:', idx, e); }

        if (targetSelect && targetSelect.value !== normalizedValue) {
            targetSelect.value = normalizedValue;
        }

        updateRow(idx, 'PLANTA', normalizedValue, targetSelect || (idx === rowIndex ? selectElement : null));
    });
}
