function markFilteredColumns(viewId, filters) {
    const view = document.getElementById(viewId);
    if (!view) return;

    const thead = view.querySelector('thead');
    if (!thead) return;

    thead.querySelectorAll('th.column-filtered').forEach(th => {
        th.classList.remove('column-filtered');
    });

    if (!filters || !Array.isArray(filters) || filters.length === 0) return;

    const fieldMappings = {
        'CLIENTE': ['CLIENTE', 'CLI'],
        'HOD': ['HOD'],
        'F.ING.COST': ['F.ING.COST', 'FING.COST', 'F. ING. COST', 'F.ING'],
        'F.ING': ['F.ING', 'F.ING.PROG', 'F.ING.COST'],
        'F.HAB': ['F.HAB', 'F.ING.REAL'],
        'F.ING.REAL': ['F.ING.REAL', 'F.HAB'],
        'OP-PTDA': ['OP-PTDA', 'OP PTDA'],
        'OC': ['OC'],
        'COLOR': ['COLOR'],
        'RSV': ['RSV'],
        'RUTA': ['RUTA'],
        'P': ['P'],
        'STATUS': ['STATUS', 'STATUS_CORTE', 'ESTADO'],
        'PLANTA': ['PLANTA'],
        'LINEA': ['LINEA'],
        'CLI': ['CLI', 'CLIENTE']
    };

    const filteredFields = filters.map(f => f.field.toUpperCase().trim());

    thead.querySelectorAll('th').forEach(th => {
        const headerText = th.textContent.trim().replace(/\s+/g, ' ').toUpperCase();

        for (const fieldUpper of filteredFields) {
            let match = (headerText === fieldUpper);

            if (!match && fieldMappings[fieldUpper]) {
                match = fieldMappings[fieldUpper].some(m => headerText === m.toUpperCase());
            }

            if (!match && fieldUpper.length <= 2) {
                match = (headerText === fieldUpper);
            }

            if (!match && fieldUpper.length > 2) {
                if (headerText === fieldUpper || (fieldMappings[fieldUpper] && fieldMappings[fieldUpper].includes(headerText))) {
                    match = true;
                }
            }

            if (match) {
                th.classList.add('column-filtered');
                break;
            }
        }
    });
}

function markFilteredColumn(viewId, fieldName, clearAll = true) {
    if (fieldName) {
        markFilteredColumns(viewId, [{ field: fieldName, value: '' }]);
    } else {
        markFilteredColumns(viewId, []);
    }
}

function updateAllFilterIndicators() {
    markFilteredColumns('view-bloqueo', bloqueoHeaderFilters.length > 0 ? bloqueoHeaderFilters : (bloqueoHeaderFilter ? [bloqueoHeaderFilter] : []));
    markFilteredColumns('view-corte', corteHeaderFilters.length > 0 ? corteHeaderFilters : (corteHeaderFilter ? [corteHeaderFilter] : []));
    markFilteredColumns('view-enumerado', enumeradoHeaderFilters.length > 0 ? enumeradoHeaderFilters : (enumeradoHeaderFilter ? [enumeradoHeaderFilter] : []));
    markFilteredColumns('view-habilitado', habilitadoHeaderFilters.length > 0 ? habilitadoHeaderFilters : (habilitadoHeaderFilter ? [habilitadoHeaderFilter] : []));
    markFilteredColumns('view-lavado', lavadoHeaderFilters.length > 0 ? lavadoHeaderFilters : (lavadoHeaderFilter ? [lavadoHeaderFilter] : []));
    markFilteredColumns('view-corte-bloques', corteBloquesHeaderFilters.length > 0 ? corteBloquesHeaderFilters : (corteBloquesHeaderFilter ? [corteBloquesHeaderFilter] : []));
    markFilteredColumns('view-transfer', transferHeaderFilters.length > 0 ? transferHeaderFilters : (transferHeaderFilter ? [transferHeaderFilter] : []));
    markFilteredColumns('view-artes', artesHeaderFilters.length > 0 ? artesHeaderFilters : (artesHeaderFilter ? [artesHeaderFilter] : []));
}
