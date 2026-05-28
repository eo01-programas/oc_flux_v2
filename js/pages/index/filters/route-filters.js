// Filtros por RUTA (por defecto todos desactivados -> sin filtrado)
const routeFilters = {
    'NORMAL': false
};

function onRouteFilterChange(key, checked) {
    if (routeFilters.hasOwnProperty(key)) routeFilters[key] = !!checked;
    try {
        if (document.getElementById('view-corte').classList.contains('active') && currentCorteFilter === 'X PROG') {
            renderCorte();
        }
    } catch (e) { }
}

function getRouteKeyForRow(row) {
    const rutaVal = getVal(row, "RUTA TELA") || getVal(row, "RUTA") || "";
    const rutaKey = String(rutaVal || "").toUpperCase().trim();
    if (rutaKey === '' || rutaKey.indexOf('NORMAL') !== -1) return 'NORMAL';
    return 'OTHER';
}
