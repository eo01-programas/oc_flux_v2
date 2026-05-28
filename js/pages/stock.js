
// Copiamos la configuraciÃ³n del proyecto (usar la misma web app y sheet id que en index.html)
const SHEET_ID = window.PCP_CONFIG.SHEET_ID;
let rawData = [];
let useKg = false; // false => use PDS GIRADAS, true => use KG GIRADOS
let monthlyDespachosByMonth = {}; // { 'YYYY-MM': prendas }

function reloadData(){
    document.getElementById('btn-refresh').style.display='none';
    document.getElementById('loader').style.display='flex';
    clearChartKeepLegend('chart');
    if(document.getElementById('chart3')) clearChartKeepLegend('chart3');
    document.getElementById('no-data').style.display='none';
    monthlyDespachosByMonth = {};
    window.PcpGoogleSheets.loadGvizJsonp({
        spreadsheetId: SHEET_ID,
        gid: 0,
        label: 'stock',
        callbackPrefix: 'loadStockData',
        cacheBust: false,
        errorMessage: 'Error cargando Google Sheets'
    }).then(jsonResponse => {
        if(typeof window.loadStockData === 'function') window.loadStockData(jsonResponse);
    }).catch(error => showError(error && error.message ? error.message : 'Error cargando Google Sheets'));

    // Cargar hoja "despachos" (anio, mes, prendas) para cabecera mensual
    window.PcpGoogleSheets.loadGvizJsonp({
        spreadsheetId: SHEET_ID,
        sheet: 'despachos',
        label: 'despachos',
        callbackPrefix: 'loadDespachosData',
        cacheBust: false
    }).then(jsonResponse => {
        if(typeof window.loadDespachosData === 'function') window.loadDespachosData(jsonResponse);
    }).catch(() => {
        monthlyDespachosByMonth = {};
        if(rawData && rawData.length > 1) processAndRender();
    });
}

window.loadStockData = function(jsonResponse){
    try{
        if(!jsonResponse || !jsonResponse.table) throw new Error('Respuesta invÃ¡lida');
        const rowsRaw = jsonResponse.table.rows.map(r => r.c.map(cell => (cell && cell.v !== null) ? cell.v : ""));
        const gvizHeaders = jsonResponse.table.cols.map(col => col.label || col.id);

        // Si el gvizHeaders contiene el nombre de la cabecera principal la usamos, sino buscamos fila con encabezados
        if (gvizHeaders.includes("PDS GIRADAS")) {
            rawData = [gvizHeaders, ...rowsRaw];
        } else {
            // buscar fila que tenga PDS GIRADAS
            let headerRowIndex = -1;
            for(let i=0;i<rowsRaw.length;i++){
                if (rowsRaw[i].some(c => String(c).toUpperCase().trim() === 'PDS GIRADAS')){ headerRowIndex = i; break; }
            }
            if (headerRowIndex !== -1) rawData = rowsRaw.slice(headerRowIndex);
            else rawData = [gvizHeaders, ...rowsRaw];
        }

        // normalize headers
        if(rawData.length>0) rawData[0] = rawData[0].map(h=> h ? String(h).trim() : '');

        processAndRender();
    }catch(err){
        showError(err.message || err);
    }
};

window.loadDespachosData = function(jsonResponse){
    try{
        monthlyDespachosByMonth = {};
        if(!jsonResponse || !jsonResponse.table) return;

        const rowsRaw = (jsonResponse.table.rows || []).map(r => (r && r.c ? r.c.map(cell => (cell && cell.v !== null) ? cell.v : "") : []));
        let headers = (jsonResponse.table.cols || []).map(col => String(col.label || col.id || '').trim());
        let dataRows = rowsRaw;

        let idxAnio = getHeaderIndexFlexible(headers, ['año','ano','anio','year']);
        let idxMes = getHeaderIndexFlexible(headers, ['mes','month']);
        let idxPrendas = getHeaderIndexFlexible(headers, ['prendas','pds','cantidad']);

        // Fallback: buscar fila de encabezado dentro de rows
        if(idxAnio === -1 || idxMes === -1 || idxPrendas === -1){
            let headerRowIndex = -1;
            for(let i=0;i<rowsRaw.length;i++){
                const row = rowsRaw[i];
                if(
                    getHeaderIndexFlexible(row, ['año','ano','anio','year']) !== -1 &&
                    getHeaderIndexFlexible(row, ['mes','month']) !== -1 &&
                    getHeaderIndexFlexible(row, ['prendas','pds','cantidad']) !== -1
                ){
                    headerRowIndex = i;
                    break;
                }
            }
            if(headerRowIndex !== -1){
                headers = rowsRaw[headerRowIndex].map(v => String(v || '').trim());
                dataRows = rowsRaw.slice(headerRowIndex + 1);
                idxAnio = getHeaderIndexFlexible(headers, ['año','ano','anio','year']);
                idxMes = getHeaderIndexFlexible(headers, ['mes','month']);
                idxPrendas = getHeaderIndexFlexible(headers, ['prendas','pds','cantidad']);
            }
        }

        if(idxAnio === -1 || idxMes === -1 || idxPrendas === -1){
            if(rawData && rawData.length > 1) processAndRender();
            return;
        }

        for(let i=0;i<dataRows.length;i++){
            const row = dataRows[i] || [];
            const monthKey = buildMonthKeyFromYearMonth(row[idxAnio], row[idxMes]);
            if(!monthKey) continue;
            const prendas = parseDespachoNumber(row[idxPrendas]);
            monthlyDespachosByMonth[monthKey] = (monthlyDespachosByMonth[monthKey] || 0) + prendas;
        }

        if(rawData && rawData.length > 1) processAndRender();
    }catch(err){
        console.error('Error cargando hoja despachos:', err);
        monthlyDespachosByMonth = {};
        if(rawData && rawData.length > 1) processAndRender();
    }
};

function showError(msg){
    document.getElementById('loader').style.display='none';
    document.getElementById('btn-refresh').style.display='inline-flex';
    document.getElementById('no-data').style.display='block';
    document.getElementById('no-data').innerText = 'Error: ' + msg;
}

function getColIndexFlexible(names){
    if(!rawData || rawData.length===0) return -1;
    const headers = rawData[0];
    for(const name of names){
        const target = name.toLowerCase().trim();
        const idx = headers.findIndex(h=> String(h || '').toLowerCase().trim() === target);
        if(idx !== -1) return idx;
    }
    return -1;
}

function getVal(row, idx){
    if(!row) return '';
    if(idx<0 || idx>=row.length) return '';
    return row[idx];
}

function normalizeHeaderText(txt){
    return String(txt || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function getHeaderIndexFlexible(headers, candidates){
    const normHeaders = (headers || []).map(h => normalizeHeaderText(h));
    for(const cand of candidates){
        const target = normalizeHeaderText(cand);
        const idx = normHeaders.indexOf(target);
        if(idx !== -1) return idx;
    }
    return -1;
}

function parseDespachoNumber(value){
    if(value === null || value === undefined) return 0;
    if(typeof value === 'number' && Number.isFinite(value)) return value;
    const txt = String(value).trim();
    if(!txt) return 0;
    if(/^\d{1,3}([.,]\d{3})+$/.test(txt)) return Number(txt.replace(/[.,]/g, '')) || 0;
    const n1 = Number(txt.replace(/,/g, ''));
    if(Number.isFinite(n1)) return n1;
    const n2 = Number(txt.replace(/\./g, ''));
    return Number.isFinite(n2) ? n2 : 0;
}

function buildMonthKeyFromYearMonth(yearVal, monthVal){
    const y = parseInt(String(yearVal || '').trim(), 10);
    if(!Number.isFinite(y) || y < 1900) return null;
    const mTxt = normalizeHeaderText(monthVal);
    const monthMap = {
        ene:1, enero:1,
        feb:2, febrero:2,
        mar:3, marzo:3,
        abr:4, abril:4,
        may:5, mayo:5,
        jun:6, junio:6,
        jul:7, julio:7,
        ago:8, agosto:8,
        sep:9, set:9, septiembre:9, setiembre:9,
        oct:10, octubre:10,
        nov:11, noviembre:11,
        dic:12, diciembre:12
    };
    let m = monthMap[mTxt];
    if(!m){
        const mn = parseInt(mTxt, 10);
        if(Number.isFinite(mn) && mn >= 1 && mn <= 12) m = mn;
    }
    if(!m) return null;
    return y + '-' + String(m).padStart(2, '0');
}

function normalizeClientName(clientName){
    if(!clientName && clientName !== 0) return 'SIN CLIENTE';
    const raw = String(clientName).trim();
    if(!raw) return 'SIN CLIENTE';
    const name = raw.toUpperCase();
    if(name.includes('LACOSTE')) return 'LAC';
    if(name.includes('ATHLETA, INC.')) return 'ATH';
    if(name.includes('ALLBIRDS')) return 'ALLB';
    if(name.includes('BANANA REPUBLIC, LLC')) return 'BNN';
    if(name.includes('THEORY LLC,')) return 'THE';
    if(name.includes('DISH & DUER')) return 'DDU';
    if(name.includes('SKECHERS PERFORMANCE')) return 'SKE';
    if(name.includes('LULULEMON ATHLETICA CANADA INC')) return 'LLL';
    if(name.includes('AM RETAIL S.A.C.')) return 'AMR';
    return name.replace(/\s+/g, ' ');
}

function formatPercent(part, total){
    if(!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return '0.0%';
    return ((part / total) * 100).toFixed(1) + '%';
}

function buildClientBreakdownTooltip(clientTotals, totalForPct){
    const entries = Object.entries(clientTotals || {}).filter(([, v]) => Number(v) !== 0);
    if(entries.length === 0) return '';
    entries.sort((a, b) => b[1] - a[1]);
    const unitLabel = useKg ? 'kg' : 'pds';
    const totalRef = (Number.isFinite(totalForPct) && totalForPct > 0)
        ? totalForPct
        : entries.reduce((acc, [, v]) => acc + Number(v || 0), 0);
    return entries.map(([client, value]) => `${client}: ${formatNumber(value)} ${unitLabel} (${formatPercent(value, totalRef)})`).join('\n');
}

function buildBarTooltip(b){
    const unitLabel = useKg ? 'kg' : 'pds';
    const total = (b.prog || 0) + (b.xprog || 0);
    const base = `${b.label} | PROG: ${formatNumber(b.prog || 0)} ${unitLabel} | X PROG: ${formatNumber(b.xprog || 0)} ${unitLabel} | TOTAL: ${formatNumber(total)} ${unitLabel}`;
    const byClient = buildClientBreakdownTooltip(b.clientTotals, total);
    if(!byClient) return base;
    return `${base}\n\nPor CLIENTE:\n${byClient}`;
}

function buildSegmentTooltip(label, segmentValue, totalValue, clientTotals){
    const unitLabel = useKg ? 'kg' : 'pds';
    const base = `${label}: ${formatNumber(segmentValue)} ${unitLabel}`;
    const byClient = buildClientBreakdownTooltip(clientTotals, totalValue);
    if(!byClient) return base;
    return `${base}\n\nPor CLIENTE:\n${byClient}`;
}

function processAndRender(){
    // columnas de interÃ©s (variantes posibles)
    const idxRuta = getColIndexFlexible(['RUTA TELA','RUTA','RUTA_TELA','RUTA TELA ']);
    const idxEstadoBloq = getColIndexFlexible(['estado_bloqueo','ESTADO_BLOQUEO','BLOQUEO','BLOQUEO_ESTADO','ESTADO BLOQUEO']);
    const idxPds = getColIndexFlexible(['PDS GIRADAS','PDS_GIRADAS','PDS','PDS GIRADAS ']);
    const idxKg = getColIndexFlexible(['KG GIRADOS','KG_GIRADOS','KG GIRADOS ']);
    const idxCliente = getColIndexFlexible(['CLIENTE','CLIENT','CLI','NOMBRE CLIENTE','NOMBRE_CLIENTE']);

    const idxValue = useKg ? idxKg : idxPds;

    if(idxValue === -1){
        showError(useKg ? 'No se encontrÃ³ la columna "KG GIRADOS"' : 'No se encontrÃ³ la columna "PDS GIRADAS"');
        return;
    }
    if(idxRuta === -1){ showError('No se encontrÃ³ la columna "RUTA TELA"'); return; }
    if(idxEstadoBloq === -1){ showError('No se encontrÃ³ la columna "estado_bloqueo / BLOQUEO"'); return; }

    // Calculamos dos series para BLOQUEO: PROG (estado que contiene 'PROG') y X PROG (filas sin valor -> X PROG)
    let sumPROG = 0;
    let sumXPROG = 0;

    // AdemÃ¡s calculamos LAVANDERIA: filas con estado_bloqueo = 'OK' y estado_lavada != 'OK'
    let sumLavPROG = 0;

    // Calculamos CORTE PZAS: filas con RUTA = ACABADA OR (LAVADA y estado_lavada = OK)
    // y las clasificamos por estado_corte en PROG (PROG 1T/2T/3T) o X PROG (no OK ni PROGs)
    let sumCortePROG = 0;
    let sumCorteXPROG = 0;

    // Desglose CORTE PZAS por RUTA TELA
    let cortePROG_lavada = 0;
    let cortePROG_acabada = 0;
    let corteXPROG_lavada = 0;
    let corteXPROG_acabada = 0;
    
    // Calculamos CORTE BLOQ: estado_corte = OK AND estado_bloques = 'Ok corte' AND estado_corte_bloques != OK
    // Clasificamos PROG cuando estado_corte_bloques == 'PROG', X PROG otherwise
    let sumCorteBloqPROG = 0;
    let sumCorteBloqXPROG = 0;

        // ENUMERADO (Por enumerar): misma logica de la vista Enumerado > Por enumerar
        // estado_corte = 'OK' y estado_enumerado distinto de:
        // 'OK ENM', 'OK S/ENM', 'OK PAQUETEO' (y variante 'OK PAQUETO')
        let sumEnumeradoPROG = 0;

    // TRANSFER:
    // - considerar solo estado_enumerado = OK ENM / OK S/ENM / OK PAQUETEO
    // - NO considerar estado_habilitado = OK
    // - en Prendas: valor = n.transfxpda * PDS GIRADAS
    // - en Kg: valor = KG GIRADOS (sin multiplicar por n.transfxpda)
    // - si n.transfxpda vacio, no numerico o 'NO LLEVA', aporta 0
    // Se muestra solo PROG (X PROG = 0)
    let sumTransferPROG = 0;

    // BORDADO:
    // - estado_enumerado = 'OK ENM'
    // - estado_habilitado != OK / PROG 1T / PROG 2T / PROG 3T / OK S/DESTINO
    // - tipo-bordado = 'En pieza'
    // Se muestra solo PROG (X PROG = 0)
    let sumBordadoPROG = 0;

    // HABILITADO: filas con estado_corte = 'OK'
    // y estado_habilitado distinto de 'OK' y 'DEPURADO'
    let sumHabPROG = 0;
    let sumHabXPROG = 0;
    let sumHabOkSinDestino = 0;

    const hasClienteCol = idxCliente !== -1;
    const clientTotalsByBar = {
        BLOQUEO: {},
        LAVANDERIA: {},
        'CORTE PZAS': {},
        'CORTE BLOQ': {},
        ENUMERADO: {},
        TRANSFER: {},
        BORDADO: {},
        HABILITADO: {}
    };
    const clientTotalsByBarSegment = {
        BLOQUEO: { prog:{}, xprog:{} },
        LAVANDERIA: { prog:{}, xprog:{} },
        'CORTE PZAS': { prog:{}, xprog:{} },
        'CORTE BLOQ': { prog:{}, xprog:{} },
        ENUMERADO: { prog:{}, xprog:{} },
        TRANSFER: { prog:{}, xprog:{} },
        BORDADO: { prog:{}, xprog:{} },
        HABILITADO: { prog:{}, xprog:{} }
    };
    const corteBreakdownClients = {
        prog: { lavada: {}, acabada: {} },
        xprog: { lavada: {}, acabada: {} }
    };
    const habOkSinDestinoClients = {};
    function addClientToTotals(bucket, clientName, amount){
        if(!hasClienteCol) return;
        if(!Number.isFinite(amount) || amount === 0) return;
        if(!bucket) return;
        bucket[clientName] = (bucket[clientName] || 0) + amount;
    }
    function addClientToBar(label, clientName, amount, segmentKey){
        if(!hasClienteCol) return;
        const bucket = clientTotalsByBar[label];
        addClientToTotals(bucket, clientName, amount);
        if(segmentKey){
            const segBucket = clientTotalsByBarSegment[label] ? clientTotalsByBarSegment[label][segmentKey] : null;
            addClientToTotals(segBucket, clientName, amount);
        }
    }

    // Ã­ndices auxiliares
    const idxEstadoLav = getColIndexFlexible(['estado_lavada','ESTADO_LAVADA','estado_lavado','ESTADO_LAVADO']);
    const idxEstadoCorte = getColIndexFlexible(['estado_corte','STATUS_CORTE','STATUS','ESTADO CORTE','ESTADO_CORTE','estado corte']);
    const idxEstadoBloques = getColIndexFlexible(['estado_bloques','ESTADO_BLOQUES','ESTADO BLOQUES','ESTADO_BLOQUES']);
    const idxEstadoCorteBloques = getColIndexFlexible(['estado_corte_bloques','ESTADO_CORTE_BLOQUES','estado_corte_bloques','estado corte bloques']);
    const idxEstadoEnumerado = getColIndexFlexible(['estado_enumerado','ESTADO_ENUMERADO','estado enumerado']);
    const idxNTransfxpda = getColIndexFlexible(['n.transfxpda','N.TRANSFXPDA','n_transfxpda','N_TRANSFXPDA']);
    const idxEstadoHabilitado = getColIndexFlexible(['estado_habilitado','ESTADO_HABILITADO','estado habilitado']);
    const idxTipoBordado = getColIndexFlexible(['tipo-bordado','TIPO-BORDADO','tipo_bordado','TIPO_BORDADO','tipo bordado']);
    const idxFDespacho = getColIndexFlexible(['F. DESPACHO','F.DESPACHO','FDESPACHO','F DESPACHO','F. DESPACHO ']);

    // Monthly data by F. DESPACHO: { 'YYYY-MM': { bloqueo:{prog,xprog}, corte:{prog,xprog}, hab:{prog,xprog} } }
    const monthlyData = {};
    const monthlyClientData = {};
    const monthlyPdsIngresadas = {};
    const monthlyPdsCorte = {};
    const monthlyPdsIngresadasClients = {};
    const monthlyPdsCorteClients = {};

    for(let i=1;i<rawData.length;i++){
        const row = rawData[i];
        const rutaVal = String(getVal(row, idxRuta) || '').toUpperCase().trim();
        const clienteNorm = normalizeClientName(hasClienteCol ? getVal(row, idxCliente) : '');

        // valor segÃºn el switch (PDS o KG)
        let valRaw = getVal(row, idxValue);
        let val = 0;
        if (valRaw === null || valRaw === undefined || String(valRaw).trim() === '') val = 0;
        else val = Number(String(valRaw).toString().replace(/,/g, '')) || 0;
        let pdsVal = 0;
        if(idxPds !== -1){
            const pdsRaw = getVal(row, idxPds);
            if(!(pdsRaw === null || pdsRaw === undefined || String(pdsRaw).trim() === '')){
                pdsVal = Number(String(pdsRaw).toString().replace(/,/g, '')) || 0;
            }
        }

        // BLOQUEO: requiere RUTA = LAVADA y estado_bloqueo != OK
        if(rutaVal === 'LAVADA'){
            let estadoBloqVal = (getVal(row, idxEstadoBloq) || '').toString().trim();
            const estadoBloqUpper = String(estadoBloqVal).toUpperCase().trim();
            if(estadoBloqUpper !== 'OK'){
                if(estadoBloqUpper.indexOf('PROG') !== -1) {
                    sumPROG += val;
                    addClientToBar('BLOQUEO', clienteNorm, val, 'prog');
                } else if(estadoBloqVal === '' ) {
                    // filas sin valor -> considerarlas X PROG
                    sumXPROG += val;
                    addClientToBar('BLOQUEO', clienteNorm, val, 'xprog');
                } else {
                    // otras etiquetas (no PROG ni vacÃ­o) las sumamos a PROG
                    sumPROG += val;
                    addClientToBar('BLOQUEO', clienteNorm, val, 'prog');
                }
            }
        }

        // LAVANDERIA: estado_bloqueo == OK y estado_lavada != OK
        let estadoBloqVal2 = (getVal(row, idxEstadoBloq) || '').toString().trim();
        const estadoBloqUpper2 = String(estadoBloqVal2).toUpperCase().trim();
        const estadoLavVal = (idxEstadoLav !== -1) ? String(getVal(row, idxEstadoLav) || '').toUpperCase().trim() : '';
        if(estadoBloqUpper2 === 'OK' && estadoLavVal !== 'OK'){
            // segÃºn requerimiento, esta suma entra en la misma categorÃ­a PROG
            sumLavPROG += val;
            addClientToBar('LAVANDERIA', clienteNorm, val, 'prog');
        }

        // CORTE PZAS: RUTA = ACABADA OR (LAVADA y estado_lavada = OK)
        const includeCorte = (rutaVal === 'ACABADA') || (rutaVal === 'LAVADA' && estadoLavVal === 'OK');
        if(includeCorte){
            const estadoCorteVal = (idxEstadoCorte !== -1) ? String(getVal(row, idxEstadoCorte) || '').toUpperCase().trim() : '';
            // PROG: exact matches 'PROG 1T','PROG 2T','PROG 3T'
            if(estadoCorteVal === 'PROG 1T' || estadoCorteVal === 'PROG 2T' || estadoCorteVal === 'PROG 3T'){
                sumCortePROG += val;
                addClientToBar('CORTE PZAS', clienteNorm, val, 'prog');
                if(rutaVal === 'LAVADA'){
                    cortePROG_lavada += val;
                    addClientToTotals(corteBreakdownClients.prog.lavada, clienteNorm, val);
                }
                else if(rutaVal === 'ACABADA'){
                    cortePROG_acabada += val;
                    addClientToTotals(corteBreakdownClients.prog.acabada, clienteNorm, val);
                }
            } else if(estadoCorteVal !== 'OK'){
                // X PROG: diferente a OK y a los PROG definidos
                sumCorteXPROG += val;
                addClientToBar('CORTE PZAS', clienteNorm, val, 'xprog');
                if(rutaVal === 'LAVADA'){
                    corteXPROG_lavada += val;
                    addClientToTotals(corteBreakdownClients.xprog.lavada, clienteNorm, val);
                }
                else if(rutaVal === 'ACABADA'){
                    corteXPROG_acabada += val;
                    addClientToTotals(corteBreakdownClients.xprog.acabada, clienteNorm, val);
                }
            }
        }

        // CORTE BLOQ: filas con estado_corte = 'OK' and estado_bloques = 'Ok corte' and estado_corte_bloques != 'OK'
        const estadoCorteRow = (idxEstadoCorte !== -1) ? String(getVal(row, idxEstadoCorte) || '').toUpperCase().trim() : '';
        const estadoBloquesRow = (idxEstadoBloques !== -1) ? String(getVal(row, idxEstadoBloques) || '').toUpperCase().trim() : '';
        const estadoCorteBloquesRow = (idxEstadoCorteBloques !== -1) ? String(getVal(row, idxEstadoCorteBloques) || '').toUpperCase().trim() : '';

            // Enumerado > Por enumerar (misma logica de index/CORTE_index):
            // estado_corte = OK y estado_enumerado != OK ENM/OK S/ENM/OK PAQUETEO
            const estadoEnumeradoRow = (idxEstadoEnumerado !== -1) ? String(getVal(row, idxEstadoEnumerado) || '').toUpperCase().trim() : '';
            if(
                estadoCorteRow === 'OK' &&
                estadoEnumeradoRow !== 'OK ENM' &&
                estadoEnumeradoRow !== 'OK S/ENM' &&
                estadoEnumeradoRow !== 'OK PAQUETEO' &&
                estadoEnumeradoRow !== 'OK PAQUETO'
            ){
                sumEnumeradoPROG += val;
                addClientToBar('ENUMERADO', clienteNorm, val, 'prog');
            }

            // TRANSFER: considerar solo estados permitidos en Enumerado y excluir habilitado OK/S-DESTINO
            const estadoHabRow = (idxEstadoHabilitado !== -1) ? String(getVal(row, idxEstadoHabilitado) || '').toUpperCase().trim() : '';
            const isHabilitadoExcluded = estadoHabRow === 'DEPURADO';
            const includeByEnumerado =
                estadoEnumeradoRow === 'OK ENM' ||
                estadoEnumeradoRow === 'OK S/ENM' ||
                estadoEnumeradoRow === 'OK PAQUETEO' ||
                estadoEnumeradoRow === 'OK PAQUETO';
            const excludeByHabilitado =
                estadoHabRow === 'OK' ||
                estadoHabRow === 'OK S/DESTINO';
            if(includeByEnumerado && !excludeByHabilitado){
                const rawNTransf = (idxNTransfxpda !== -1) ? getVal(row, idxNTransfxpda) : '';
                const nTransfTxt = String(rawNTransf || '').toUpperCase().trim();
                let transferVal = 0;
                if(nTransfTxt !== '' && nTransfTxt !== 'NO LLEVA'){
                    if(useKg){
                        // En Kg no se multiplica por n.transfxpda
                        transferVal = val;
                    } else {
                        let nTransfNum = Number(String(rawNTransf).replace(/,/g, '').trim());
                        if(!Number.isFinite(nTransfNum)) nTransfNum = 0;
                        transferVal = nTransfNum * val;
                    }
                }
                sumTransferPROG += transferVal;
                addClientToBar('TRANSFER', clienteNorm, transferVal, 'prog');
            }

            // BORDADO: solo OK ENM, habilitado en cola (no OK/PROGs), tipo-bordado = EN PIEZA
            const tipoBordadoRow = (idxTipoBordado !== -1)
                ? String(getVal(row, idxTipoBordado) || '').toUpperCase().replace(/\s+/g, ' ').trim()
                : '';
            const isBordadoEnPieza =
                estadoEnumeradoRow === 'OK ENM' &&
                estadoHabRow !== 'OK' &&
                estadoHabRow !== 'PROG 1T' &&
                estadoHabRow !== 'PROG 2T' &&
                estadoHabRow !== 'PROG 3T' &&
                estadoHabRow !== 'OK S/DESTINO' &&
                tipoBordadoRow === 'EN PIEZA';
            if(isBordadoEnPieza){
                sumBordadoPROG += val;
                addClientToBar('BORDADO', clienteNorm, val, 'prog');
            }

        if(estadoCorteRow === 'OK' && estadoBloquesRow === 'OK CORTE' && estadoCorteBloquesRow !== 'OK'){
            if(estadoCorteBloquesRow === 'PROG'){
                sumCorteBloqPROG += val;
                addClientToBar('CORTE BLOQ', clienteNorm, val, 'prog');
            }
            else{
                sumCorteBloqXPROG += val;
                addClientToBar('CORTE BLOQ', clienteNorm, val, 'xprog');
            }
        }

        // HABILITADO: estado_corte = 'OK'
        // y estado_habilitado != 'OK' y != 'DEPURADO'
        if(estadoCorteRow === 'OK'){
            if(estadoHabRow === 'OK S/DESTINO'){
                sumHabOkSinDestino += val;
                addClientToTotals(habOkSinDestinoClients, clienteNorm, val);
                sumHabXPROG += val;
                addClientToBar('HABILITADO', clienteNorm, val, 'xprog');
            } else if(estadoHabRow !== 'OK' && !isHabilitadoExcluded){
                if(estadoHabRow === 'PROG 1T' || estadoHabRow === 'PROG 2T' || estadoHabRow === 'PROG 3T'){
                    sumHabPROG += val;
                    addClientToBar('HABILITADO', clienteNorm, val, 'prog');
                } else if(!isBordadoEnPieza) {
                    // vacÃ­o, 'X PROG', u otro â†’ X PROG
                    sumHabXPROG += val;
                    addClientToBar('HABILITADO', clienteNorm, val, 'xprog');
                }
            }
        }

        // â”€â”€ Monthly F. DESPACHO tracking for chart3 â”€â”€
        if(idxFDespacho !== -1){
            const rawDespacho = getVal(row, idxFDespacho);
            const mKey = parseMonthKey(rawDespacho) || 'SIN-FECHA';
            {
                if(!monthlyData[mKey]) monthlyData[mKey] = {
                    bloqueo:{prog:0,xprog:0}, corte:{prog:0,xprog:0}, hab:{prog:0,xprog:0}
                };
                if(!monthlyClientData[mKey]) monthlyClientData[mKey] = {
                    bloqueo:{prog:{},xprog:{}}, corte:{prog:{},xprog:{}}, hab:{prog:{},xprog:{}}
                };
                if(monthlyPdsIngresadas[mKey] === undefined) monthlyPdsIngresadas[mKey] = 0;
                if(monthlyPdsCorte[mKey] === undefined) monthlyPdsCorte[mKey] = 0;
                if(!monthlyPdsIngresadasClients[mKey]) monthlyPdsIngresadasClients[mKey] = {};
                if(!monthlyPdsCorteClients[mKey]) monthlyPdsCorteClients[mKey] = {};
                const md = monthlyData[mKey];
                const mcd = monthlyClientData[mKey];
                // PDS ingresadas: estado_habilitado exactamente "OK"
                if(estadoHabRow === 'OK'){
                    monthlyPdsIngresadas[mKey] += pdsVal;
                    addClientToTotals(monthlyPdsIngresadasClients[mKey], clienteNorm, pdsVal);
                }
                // PDS corte: estado_corte exactamente "OK"
                if(estadoCorteRow === 'OK'){
                    monthlyPdsCorte[mKey] += pdsVal;
                    addClientToTotals(monthlyPdsCorteClients[mKey], clienteNorm, pdsVal);
                }
                // BLOQUEO
                if(rutaVal === 'LAVADA' && estadoBloqUpper2 !== 'OK'){
                    if(estadoBloqVal2 === ''){
                        md.bloqueo.xprog += val;
                        addClientToTotals(mcd.bloqueo.xprog, clienteNorm, val);
                    }
                    else{
                        md.bloqueo.prog += val;
                        addClientToTotals(mcd.bloqueo.prog, clienteNorm, val);
                    }
                }
                // CORTE PZAS
                const inclCorteM = (rutaVal === 'ACABADA') || (rutaVal === 'LAVADA' && estadoLavVal === 'OK');
                if(inclCorteM){
                    if(estadoCorteRow === 'PROG 1T' || estadoCorteRow === 'PROG 2T' || estadoCorteRow === 'PROG 3T'){
                        md.corte.prog += val;
                        addClientToTotals(mcd.corte.prog, clienteNorm, val);
                    } else if(estadoCorteRow !== 'OK'){
                        md.corte.xprog += val;
                        addClientToTotals(mcd.corte.xprog, clienteNorm, val);
                    }
                }
                // HABILITADO
                if(estadoCorteRow === 'OK'){
                    if(estadoHabRow === 'OK S/DESTINO'){
                        md.hab.xprog += val;
                        addClientToTotals(mcd.hab.xprog, clienteNorm, val);
                    } else if(estadoHabRow !== 'OK' && !isHabilitadoExcluded){
                        if(estadoHabRow === 'PROG 1T' || estadoHabRow === 'PROG 2T' || estadoHabRow === 'PROG 3T'){
                            md.hab.prog += val;
                            addClientToTotals(mcd.hab.prog, clienteNorm, val);
                        } else {
                            md.hab.xprog += val;
                            addClientToTotals(mcd.hab.xprog, clienteNorm, val);
                        }
                    }
                }
            }
        }
    }

    // Renderizar varias barras: BLOQUEO, LAVANDERIA y CORTE PZAS
    renderMultipleBars([
        { label: 'BLOQUEO', prog: sumPROG, xprog: sumXPROG, clientTotals: clientTotalsByBar.BLOQUEO, clientTotalsProg: clientTotalsByBarSegment.BLOQUEO.prog, clientTotalsXProg: clientTotalsByBarSegment.BLOQUEO.xprog },
        { label: 'LAVANDERIA', prog: sumLavPROG, xprog: 0, clientTotals: clientTotalsByBar.LAVANDERIA, clientTotalsProg: clientTotalsByBarSegment.LAVANDERIA.prog, clientTotalsXProg: clientTotalsByBarSegment.LAVANDERIA.xprog },
        { label: 'CORTE PZAS', prog: sumCortePROG, xprog: sumCorteXPROG, clientTotals: clientTotalsByBar['CORTE PZAS'], clientTotalsProg: clientTotalsByBarSegment['CORTE PZAS'].prog, clientTotalsXProg: clientTotalsByBarSegment['CORTE PZAS'].xprog },
        { label: 'CORTE BLOQ', prog: sumCorteBloqPROG, xprog: sumCorteBloqXPROG, clientTotals: clientTotalsByBar['CORTE BLOQ'], clientTotalsProg: clientTotalsByBarSegment['CORTE BLOQ'].prog, clientTotalsXProg: clientTotalsByBarSegment['CORTE BLOQ'].xprog },
        { label: 'ENUMERADO', prog: sumEnumeradoPROG, xprog: 0, clientTotals: clientTotalsByBar.ENUMERADO, clientTotalsProg: clientTotalsByBarSegment.ENUMERADO.prog, clientTotalsXProg: clientTotalsByBarSegment.ENUMERADO.xprog },
        { label: 'TRANSFER', prog: sumTransferPROG, xprog: 0, clientTotals: clientTotalsByBar.TRANSFER, clientTotalsProg: clientTotalsByBarSegment.TRANSFER.prog, clientTotalsXProg: clientTotalsByBarSegment.TRANSFER.xprog },
        { label: 'BORDADO', prog: sumBordadoPROG, xprog: 0, clientTotals: clientTotalsByBar.BORDADO, clientTotalsProg: clientTotalsByBarSegment.BORDADO.prog, clientTotalsXProg: clientTotalsByBarSegment.BORDADO.xprog },
        { label: 'HABILITADO', prog: sumHabPROG, xprog: sumHabXPROG, clientTotals: clientTotalsByBar.HABILITADO, clientTotalsProg: clientTotalsByBarSegment.HABILITADO.prog, clientTotalsXProg: clientTotalsByBarSegment.HABILITADO.xprog, okSinDestino: sumHabOkSinDestino, okSinDestinoClients: habOkSinDestinoClients }
    ]);

    // Renderizar grÃ¡fico horizontal de desglose CORTE PZAS
    renderCorteBreakdown({
        prog:  { lavada: cortePROG_lavada,  acabada: cortePROG_acabada,  clients: corteBreakdownClients.prog  },
        xprog: { lavada: corteXPROG_lavada, acabada: corteXPROG_acabada, clients: corteBreakdownClients.xprog }
    });

    // Renderizar grÃ¡fico mensual por F. DESPACHO
    renderMonthlyChart(
        monthlyData,
        monthlyClientData,
        monthlyPdsIngresadas,
        monthlyPdsCorte,
        monthlyDespachosByMonth,
        monthlyPdsIngresadasClients,
        monthlyPdsCorteClients
    );
}

function renderChartFromAgg(agg){
    document.getElementById('loader').style.display='none';
    document.getElementById('btn-refresh').style.display='inline-flex';
    const chart = document.getElementById('chart');
    chart.innerHTML = '';

    const entries = Object.entries(agg).filter(([_k,v])=> v>0);
    if(entries.length === 0){
        document.getElementById('no-data').style.display='block';
        document.getElementById('no-data').innerText = 'No hay filas con RUTA TELA = "LAVADA" y estado_bloqueo distinto de "OK".';
        return;
    }

    // ordenar por valor descendente
    entries.sort((a,b)=> b[1] - a[1]);
    const max = entries[0][1];

    // crear barras
    for(const [key, value] of entries){
        const item = document.createElement('div');
        item.className = 'bar-item';

        const valEl = document.createElement('div');
        valEl.className = 'value';
        valEl.innerText = formatNumber(value);

        const bar = document.createElement('div');
        bar.className = 'bar';
        // altura relativa compacta para que la vista inicial entre sin scroll de página
        const height = Math.round((value / max) * 160) || 2;
        bar.style.height = height + 'px';
        bar.title = key + ': ' + value;
        bar.innerText = value >= (max*0.12) ? formatNumber(value) : '';

        const label = document.createElement('div');
        label.className = 'label';
        label.innerText = key;

        item.appendChild(valEl);
        item.appendChild(bar);
        item.appendChild(label);
        chart.appendChild(item);
    }
}

function renderMultipleBars(bars){
    document.getElementById('loader').style.display='none';
    document.getElementById('btn-refresh').style.display='inline-flex';
    const chart = document.getElementById('chart');
    clearChartKeepLegend('chart');

    // calcular totales y max para escalar alturas
    const totals = bars.map(b => (b.prog || 0) + (b.xprog || 0));
    const maxTotal = Math.max(...totals, 0);
    if(maxTotal === 0){
        document.getElementById('no-data').style.display='block';
        document.getElementById('no-data').innerText = 'No hay datos para mostrar.';
        return;
    }

    const maxHeight = 160;

    bars.forEach((b, idx) => {
        const total = (b.prog || 0) + (b.xprog || 0);
        const item = document.createElement('div');
        item.className = 'bar-item';

        if(b.label === 'HABILITADO'){
            const okSinDestinoVal = Number(b.okSinDestino) || 0;
            const pill = document.createElement('div');
            pill.className = 'ok-destino-pill';
            pill.innerHTML = `
                <div class="ok-pill-top">
                    <span class="ok-pill-ok">Ok</span>
                    <span class="ok-pill-text">Sin compl.<br>Sin destino</span>
                </div>
                <div class="ok-pill-value">${formatNumber(okSinDestinoVal)} ${useKg ? 'kg' : 'prendas'}</div>
            `;
            pill.title = buildSegmentTooltip('OK S/DESTINO', okSinDestinoVal, okSinDestinoVal, b.okSinDestinoClients || {});
            item.appendChild(pill);
        }

        const valEl = document.createElement('div');
        valEl.className = 'value';
        valEl.innerText = formatNumber(total);

        const bar = document.createElement('div');
        bar.className = 'bar';
        const height = Math.max(2, Math.round((total / maxTotal) * maxHeight));
        bar.style.height = height + 'px';
        bar.removeAttribute('title');

        // X PROG on top
        if(b.xprog && b.xprog > 0){
            const h = Math.max(2, Math.round((b.xprog / total) * height));
            const segTop = document.createElement('div');
            segTop.className = 'segment seg-xprog';
            segTop.style.height = h + 'px';
            segTop.innerText = (b.xprog >= (maxTotal*0.03)) ? formatNumber(b.xprog) : '';
            segTop.title = buildSegmentTooltip('X PROG', b.xprog, total, b.clientTotalsXProg);
            bar.appendChild(segTop);
        }

        if(b.prog && b.prog > 0){
            const hProg = Math.max(2, Math.round((b.prog / total) * height));
            const segBot = document.createElement('div');
            segBot.className = 'segment seg-prog';
            segBot.style.height = hProg + 'px';
            segBot.innerText = formatNumber(b.prog);
            segBot.title = buildSegmentTooltip('PROG', b.prog, total, b.clientTotalsProg);
            bar.appendChild(segBot);
        }

        const label = document.createElement('div');
        label.className = 'label';
        label.innerText = b.label;

        item.appendChild(valEl);
        item.appendChild(bar);
        item.appendChild(label);
        chart.appendChild(item);
    });
}

function renderCorteBreakdown(data){
    const chart2 = document.getElementById('chart2');
    clearChartKeepLegend('chart2');

    const rows = [
        { label: 'PROG',   lavada: data.prog.lavada,   acabada: data.prog.acabada,  clients: (data.prog && data.prog.clients) ? data.prog.clients : { lavada:{}, acabada:{} } },
        { label: 'X PROG', lavada: data.xprog.lavada,  acabada: data.xprog.acabada, clients: (data.xprog && data.xprog.clients) ? data.xprog.clients : { lavada:{}, acabada:{} } }
    ];

    const maxVal = Math.max(...rows.map(r => r.lavada + r.acabada), 1);

    rows.forEach(r => {
        const total = r.lavada + r.acabada;
        const pctLav  = total > 0 ? ((r.lavada  / total) * 100).toFixed(1) : '0.0';
        const pctAcab = total > 0 ? ((r.acabada / total) * 100).toFixed(1) : '0.0';

        const rowDiv = document.createElement('div');
        rowDiv.className = 'hbar-row';

        // Label
        const lbl = document.createElement('div');
        lbl.className = 'hbar-label';
        lbl.innerText = r.label;
        rowDiv.appendChild(lbl);

        // Track
        const track = document.createElement('div');
        track.className = 'hbar-track';
        const widthPct = total > 0 ? Math.max(4, (total / maxVal) * 100) : 0;
        track.style.width = widthPct + '%';

        if(r.lavada > 0){
            const seg = document.createElement('div');
            seg.className = 'hbar-seg lavada';
            seg.style.flex = r.lavada;
            seg.innerText = formatNumber(r.lavada) + ' [' + pctLav + '%]';
            seg.title = buildSegmentTooltip('LAVADA', r.lavada, total, r.clients.lavada);
            track.appendChild(seg);
        }
        if(r.acabada > 0){
            const seg = document.createElement('div');
            seg.className = 'hbar-seg acabada';
            seg.style.flex = r.acabada;
            seg.innerText = formatNumber(r.acabada) + ' [' + pctAcab + '%]';
            seg.title = buildSegmentTooltip('ACABADA', r.acabada, total, r.clients.acabada);
            track.appendChild(seg);
        }

        rowDiv.appendChild(track);

        // Total
        const tot = document.createElement('div');
        tot.className = 'hbar-total';
        tot.innerText = formatNumber(total);
        rowDiv.appendChild(tot);

        chart2.appendChild(rowDiv);
    });
}

function parseMonthKey(val){
    if(val === null || val === undefined || val === '') return null;
    let d = null;

    // 1) Ya es un Date object (gviz JSONP puede devolver Date objects reales)
    if(val instanceof Date && !isNaN(val.getTime())){
        d = val;
    }

    // 2) NÃºmero serial de Excel (> 30000) â€” igual que index.html
    if(!d && typeof val === 'number' && val > 30000){
        d = new Date(Math.round((val - 25569) * 86400 * 1000));
    }

    // 3) String "Date(year,month,day)" de gviz (month es 0-based)
    if(!d && typeof val === 'string'){
        const gm = val.match(/Date\((\d+),\s*(\d+),\s*(\d+)\)/);
        if(gm){
            d = new Date(parseInt(gm[1]), parseInt(gm[2]), parseInt(gm[3]));
        }
    }

    // 4) String "DD/Mon/YY" o "DD/Mon/YYYY" o "DD/MM/YYYY"
    if(!d && typeof val === 'string'){
        const s = val.trim();
        const parts = s.split('/');
        if(parts.length === 3){
            const meses = {ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};
            const mp = parts[1].toLowerCase().trim();
            let year = parseInt(parts[2]);
            if(!isNaN(year) && year < 100) year += 2000; // Fix aÃ±o de 2 dÃ­gitos: 26 â†’ 2026
            const day = parseInt(parts[0]);
            if(!isNaN(year) && !isNaN(day)){
                if(meses[mp] !== undefined){
                    d = new Date(year, meses[mp], day);
                } else {
                    const mn = parseInt(parts[1]);
                    if(mn >= 1 && mn <= 12) d = new Date(year, mn - 1, day);
                }
            }
        }
    }

    if(!d || isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}

function monthKeyToLabel(key){
    if(key === 'SIN-FECHA') return 'Sin F.Despacho';
    const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const [y,m] = key.split('-');
    return names[parseInt(m)-1] + '/' + y;
}

function getCurrentAndNextMonthKeys(){
    const now = new Date();
    const currentKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextKey = nextDate.getFullYear() + '-' + String(nextDate.getMonth() + 1).padStart(2, '0');
    return new Set([currentKey, nextKey]);
}

function renderMonthlyChart(
    monthlyData,
    monthlyClientData,
    monthlyPdsIngresadas,
    monthlyPdsCorte,
    monthlyDespachos,
    monthlyPdsIngresadasClients,
    monthlyPdsCorteClients
){
    const chart3 = document.getElementById('chart3');
    if(!chart3) return;
    clearChartKeepLegend('chart3');
    const monthKeysWithFaltaTela = getCurrentAndNextMonthKeys();

    const keys = Object.keys(monthlyData).sort((a,b) => {
        if(a === 'SIN-FECHA') return 1;
        if(b === 'SIN-FECHA') return -1;
        return a.localeCompare(b);
    });
    if(keys.length === 0) return;

    // Max value for scaling
    let maxVal = 0;
    keys.forEach(k => {
        const d = monthlyData[k];
        ['bloqueo','corte','hab'].forEach(cat => {
            const t = d[cat].prog + d[cat].xprog;
            if(t > maxVal) maxVal = t;
        });
    });
    if(maxVal === 0) return;

    keys.forEach(k => {
        const d = monthlyData[k];
        const categories = [
            { key: 'bloqueo', label: 'BLOQUEO',    data: d.bloqueo },
            { key: 'corte',   label: 'CORTE PZAS', data: d.corte },
            { key: 'hab',     label: 'HABILITADO', data: d.hab }
        ];
        const hasVisibleRows = categories.some(cat => (cat.data.prog + cat.data.xprog) > 0);
        if(!hasVisibleRows) return;

        const group = document.createElement('div');
        group.className = 'month-group';

        const label = document.createElement('div');
        label.className = 'month-label';
        const baseMonthLabel = monthKeyToLabel(k);
        const pdsDespacho = Number(monthlyDespachos && monthlyDespachos[k]) || 0;
        const pdsIngresadas = Number(monthlyPdsIngresadas && monthlyPdsIngresadas[k]) || 0;
        const pdsCorte = Number(monthlyPdsCorte && monthlyPdsCorte[k]) || 0;
        const pdsIngresadasByClient = (monthlyPdsIngresadasClients && monthlyPdsIngresadasClients[k]) ? monthlyPdsIngresadasClients[k] : {};
        const pdsCorteByClient = (monthlyPdsCorteClients && monthlyPdsCorteClients[k]) ? monthlyPdsCorteClients[k] : {};
        const pctCorte = formatPercentRounded(pdsCorte, pdsDespacho);
        const pctIng = formatPercentRounded(pdsIngresadas, pdsDespacho);
        const hideDetailsForEarly2026 = (k === '2026-01' || k === '2026-02') && pdsDespacho === 0;
        if(useKg){
            label.innerText = baseMonthLabel;
        } else if(hideDetailsForEarly2026){
            label.innerText = `${baseMonthLabel} |`;
        } else {
            label.appendChild(document.createTextNode(`${baseMonthLabel} | ${formatCompactK(pdsDespacho)} despacho | `));

            const corteTip = document.createElement('span');
            corteTip.className = 'month-metric-tip';
            corteTip.innerText = `${formatCompactK(pdsCorte)} corte (${pctCorte})`;
            corteTip.title = buildSegmentTooltip('CORTE OK', pdsCorte, pdsCorte, pdsCorteByClient);
            label.appendChild(corteTip);

            label.appendChild(document.createTextNode(' | '));

            const ingTip = document.createElement('span');
            ingTip.className = 'month-metric-tip';
            ingTip.innerText = `${formatCompactK(pdsIngresadas)} ing (${pctIng})`;
            ingTip.title = buildSegmentTooltip('ING OK', pdsIngresadas, pdsIngresadas, pdsIngresadasByClient);
            label.appendChild(ingTip);
        }
        group.appendChild(label);

        if(!useKg && monthKeysWithFaltaTela.has(k)){
            const faltaTela = Math.round((pdsDespacho * 1.02) - pdsCorte - 309 - 1284);
            const sub = document.createElement('div');
            sub.className = 'month-subnote';
            sub.innerText = `${formatCompactK(faltaTela)} pds por falta de tela`;
            group.appendChild(sub);
        }

        categories.forEach(cat => {
            const total = cat.data.prog + cat.data.xprog;
            if(total === 0) return; // skip empty bars
            const monthClient = (monthlyClientData && monthlyClientData[k] && monthlyClientData[k][cat.key])
                ? monthlyClientData[k][cat.key]
                : { prog:{}, xprog:{} };
            const row = document.createElement('div');
            row.className = 'month-row';

            const lbl = document.createElement('div');
            lbl.className = 'month-row-label';
            lbl.innerText = cat.label;
            row.appendChild(lbl);

            const track = document.createElement('div');
            track.className = 'month-bar-track';
            track.style.width = Math.max(3, (total / maxVal) * 100) + '%';

            if(cat.data.prog > 0){
                const seg = document.createElement('div');
                seg.className = 'month-bar-seg m-prog';
                seg.style.flex = cat.data.prog;
                seg.innerText = formatNumber(cat.data.prog);
                seg.title = buildSegmentTooltip('PROG', cat.data.prog, total, monthClient.prog);
                track.appendChild(seg);
            }
            if(cat.data.xprog > 0){
                const seg = document.createElement('div');
                seg.className = 'month-bar-seg m-xprog';
                seg.style.flex = cat.data.xprog;
                seg.innerText = formatNumber(cat.data.xprog);
                seg.title = buildSegmentTooltip('X PROG', cat.data.xprog, total, monthClient.xprog);
                track.appendChild(seg);
            }

            row.appendChild(track);

            const tot = document.createElement('div');
            tot.className = 'month-bar-total';
            tot.innerText = formatNumber(total);
            row.appendChild(tot);

            group.appendChild(row);
        });

        chart3.appendChild(group);
    });
}

function toggleUnit(unit){
    const chkPds = document.getElementById('chk-pds');
    const chkKg = document.getElementById('chk-kg');
    if(unit === 'kg'){
        useKg = true;
        chkKg.checked = true;
        chkPds.checked = false;
        chkKg.parentElement.classList.add('switch-active');
        chkPds.parentElement.classList.remove('switch-active');
    } else {
        useKg = false;
        chkPds.checked = true;
        chkKg.checked = false;
        chkPds.parentElement.classList.add('switch-active');
        chkKg.parentElement.classList.remove('switch-active');
    }
    // Actualizar tÃ­tulo del grÃ¡fico
    updateChartTitle();
    // si ya cargamos datos, re-renderizamos inmediatamente
    if(rawData && rawData.length>1){
        document.getElementById('no-data').style.display='none';
        processAndRender();
    } else {
        document.getElementById('btn-refresh').style.display='inline-flex';
    }
}

function updateChartTitle(){
    const titleEl = document.getElementById('chart-title');
    if(titleEl){
        titleEl.innerText = useKg
            ? 'Stock de Kilogramos Corte/Habilitado'
            : 'Stock de prendas Corte/Habilitado';
    }
    const title2El = document.getElementById('chart2-title');
    if(title2El){
        title2El.innerText = useKg
            ? 'Desglose CORTE PZAS por Ruta Tela (Kilogramos)'
            : 'Desglose CORTE PZAS por Ruta Tela (Prendas)';
    }
    const title3El = document.getElementById('chart3-title');
    if(title3El){
        title3El.innerText = useKg
            ? 'Stock por Mes de Despacho (Kilogramos)'
            : 'Stock por Mes de Despacho (Prendas)';
    }
}

function formatNumber(n){
    // entero => separador de miles con coma; decimal => 2 dec con separador de miles
    if(Number.isInteger(n)) return n.toLocaleString('en-US');
    return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatCompactK(n){
    const num = Number(n) || 0;
    if(Math.abs(num) >= 1000){
        return Math.round(num / 1000) + 'k';
    }
    return formatNumber(Math.round(num));
}

function formatPercentRounded(part, total){
    if(!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return '0%';
    return Math.round((part / total) * 100) + '%';
}

function clearChartKeepLegend(id){
    const el = document.getElementById(id);
    const children = Array.from(el.children);
    children.forEach(child => {
        if(!child.classList.contains('legend-inside')) el.removeChild(child);
    });
}

// Inicializar carga
reloadData();
