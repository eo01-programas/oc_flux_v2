function getLavadaRouteState(row) {
    const estadoBloq = (getVal(row, "estado_bloqueo") || "").toString().toUpperCase().trim();
    const estadoLav = (getVal(row, "estado_lavada") || "").toString().toUpperCase().trim();
    if (estadoBloq === "") return "X PEDIR";
    if (estadoBloq.indexOf('PROG') !== -1) return "X BLOQ";
    if (estadoBloq === 'OK' && (estadoLav === '' || estadoLav === 'EN LAV')) return "X LAVAR";
    if (estadoLav === 'OK') return "LV-OK";
    return "LV";
}

function getHabilitadoStatusValue(row, evNormInput = '') {
    const rutaTela = (getVal(row, 'RUTA TELA') || getVal(row, 'RUTA_TELA') || getVal(row, 'RUTA') || '').toString().toUpperCase().trim();
    const estadoCorte = (getVal(row, 'STATUS_CORTE') || getVal(row, 'STATUS') || getVal(row, 'estado_corte') || getVal(row, 'ESTADO_CORTE') || '').toString().toUpperCase().trim();
    const estadoBloqueo = (getVal(row, 'estado_bloqueo') || getVal(row, 'ESTADO_BLOQUEO') || '').toString().toUpperCase().trim();
    const estadoLavada = (getVal(row, 'estado_lavada') || getVal(row, 'ESTADO_LAVADA') || '').toString().toUpperCase().trim();
    const evNorm = (evNormInput || getVal(row, 'estado_enumerado') || '').toString().toUpperCase().trim();

    if (rutaTela === 'ACABADA') {
        if (estadoCorte === '' || estadoCorte === 'X PROG') return 'x cortar';
        if (estadoCorte === 'PROG' || estadoCorte === 'PROG 1T' || estadoCorte === 'PROG 2T' || estadoCorte === 'PROG 3T') return 'Proc Corte';
        if (estadoCorte === 'OK') {
            if (evNorm === '' || evNorm === 'X PROG') return 'x enm';
            if (evNorm === 'OK ENM' || evNorm === 'OK PAQUETEO') return 'x Hab';
            return 'x enm';
        }
    } else if (rutaTela === 'LAVADA') {
        if (estadoBloqueo === '') return 'x pedir';
        if (estadoBloqueo.indexOf('PROG') !== -1) return 'x bloq';
        if (estadoBloqueo === 'OK') {
            if (estadoLavada !== 'OK') return 'x lavar';
            if (estadoCorte === '' || estadoCorte === 'X PROG') return 'x cortar';
            if (estadoCorte === 'PROG' || estadoCorte === 'PROG 1T' || estadoCorte === 'PROG 2T' || estadoCorte === 'PROG 3T') return 'Proc Corte';
            if (estadoCorte === 'OK') {
                if (evNorm === 'OK ENM' || evNorm === 'OK PAQUETEO') return 'x Hab';
                return 'x enm';
            }
        }
        return 'x bloq';
    }

    return '';
}
