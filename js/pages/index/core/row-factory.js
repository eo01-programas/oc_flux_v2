function createRow(row, rowIndex, type, groupClass = "") {
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-index', rowIndex);
    if (groupClass) tr.className = `group-${groupClass}`;
    // Flag para marcar filas en devoluci?n de lavado
    let isDevolucionRow = false;

    // Colorear fila por prioridad seg?n vista/tipo cuando aplica
    try {
        const priorityViewByType = (type === 'bloqueo') ? 'bloqueo' : ((type === 'lavado') ? 'lavado' : ((type === 'corte') ? 'corte' : ''));
        const idxP = findPriorityHeaderIndex(priorityViewByType);
        if (idxP !== -1) {
            const pValue = String(row[idxP] || "").trim();
            if (pValue === "1") {
                tr.style.backgroundColor = "rgb(255,163,163)";
            }
        }
    } catch (e) { }

    if (type === "bloqueo" || type === "lavado") {
        const fDespacho = formatValue(getVal(row, "HOD"), 'date');

        // Determinar si F.ING.COST debe ser date picker
        let fIngCostHtml = '';
        let useDatePicker = false;
        try {
            const isBloqueoView = document.getElementById('view-bloqueo') && document.getElementById('view-bloqueo').classList.contains('active');
            const isLavadoView = document.getElementById('view-lavado') && document.getElementById('view-lavado').classList.contains('active');

            // Bloqueo ? Por Programar (X PROG)
            if (isBloqueoView && currentBloqueoFilter === 'X PROG') useDatePicker = true;
            // Lavado siempre tiene sub-tab activo, no aplica date picker aqu?
        } catch (e) { }

        if (useDatePicker) {
            const rawFIngCost = getVal(row, "F.ING.COST");
            const dateValue = convertToDateInputFormat(rawFIngCost);
            fIngCostHtml = `<td class="date-cell"><input type="date" class="short-year" value="${dateValue}" onchange="handleDateChange(this, ${rowIndex}, 'F.ING.COST')"><span class="date-yy">${formatDateShortFromInput(dateValue) || 'mm/dd/aaaa'}</span></td>`;
        } else {
            const fIngCost = formatValue(getVal(row, "F.ING.COST"), 'date');
            fIngCostHtml = `<td class="date-cell">${fIngCost}</td>`;
        }

        const cliente = normalizeClientName(getVal(row, "CLIENTE"));

        // === VISUALIZACI?N TAL CUAL VIENE DEL EXCEL ===
        // Usamos la comilla invertida para forzar texto si es necesario, pero
        // con String() y trim() es suficiente. La clave es que no intentamos limpiar "ceros"
        const opTela = String(getVal(row, "OP TELA") || "").trim();
        const partida = String(getVal(row, "PARTIDA") || "").trim();

        // Unimos con un caracter visible
        const opPtda = `${opTela}-${partida}`;

        const op = getVal(row, "OP");
        const corte = getVal(row, "CORTE");
        const rawColor = getVal(row, "COLOR");
        const color = abbreviateHeather(rawColor);
        const oc = `${op}-${corte}`;

        let kg = "0.00";
        const rawKg = getVal(row, "KG GIRADOS");
        if (rawKg) kg = parseFloat(rawKg).toFixed(2);

        const rib = getVal(row, "RIB");
        const articulo = getVal(row, "ART?CULO");
        const nroMolde = getVal(row, "NRO. MOLDE");
        const tipoCert = normalizeTipoCert(getVal(row, "TIPO CERTIFICADO"));
        const fGirado = formatValue(getVal(row, "F. GIRADO"), 'date');
        const ruta = getVal(row, "RUTA TELA") || "";

        let controlHtml = "";

        if (type === "bloqueo") {
            const ribOriginal = rib || "NO LLEVA";
            const ribGuardado = getVal(row, "estado_rib");
            const ribValue = ribGuardado || (ribOriginal === "NO LLEVA" ? "NO LLEVA" : "SI LLEVA");
            let ribDisabled = (ribOriginal === "NO LLEVA") ? "disabled" : "";
            let ribClass = (ribValue === "OK") ? "sel-OK" : "";
            // Si estamos en la vista Bloqueo y en el sub-tab 'Por Programar' (X PROG),
            // mostrar solo el dato (sin desplegable). Para el resto de vistas
            // mantener el select como antes.
            let ribHtml = '';
            try {
                const onBloqView = document.getElementById('view-bloqueo') && document.getElementById('view-bloqueo').classList.contains('active');
                if (onBloqView && currentBloqueoFilter === 'X PROG') {
                    const spanClass = (ribValue === 'SI LLEVA') ? 'rib-si-lleva' : 'rib-text';
                    ribHtml = `<td title="${ribValue}"><span class="${spanClass}">${ribValue}</span></td>`;
                } else {
                    const ribSelect = `
                                <select class="table-select ${ribClass}" ${ribDisabled} onchange="updateRow(${rowIndex}, 'estado_rib', this.value, this)">
                                    ${ribOriginal === "NO LLEVA"
                            ? `<option>NO LLEVA</option>`
                            : `<option value="SI LLEVA" ${ribValue === "SI LLEVA" ? "selected" : ""}>SI LLEVA</option>
                                        <option value="NO PASO" ${ribValue === "NO PASO" ? "selected" : ""}>NO PASO</option>
                                        <option value="EN CORTE" ${ribValue === "EN CORTE" ? "selected" : ""}>EN CORTE</option>
                                        <option value="EN LAV" ${ribValue === "EN LAV" ? "selected" : ""}>EN LAV</option>
                                        <option value="LAV(rep)" ${ribValue === "LAV(rep)" ? "selected" : ""}>LAV(rep)</option>
                                        <option value="EN HAB" ${ribValue === "EN HAB" ? "selected" : ""}>EN HAB</option>`
                        }
                                </select>`;
                    ribHtml = `<td>${ribSelect}</td>`;
                }
            } catch (e) {
                const ribSelect = `
                            <select class="table-select ${ribClass}" ${ribDisabled} onchange="updateRow(${rowIndex}, 'estado_rib', this.value, this)">
                                ${ribOriginal === "NO LLEVA"
                        ? `<option>NO LLEVA</option>`
                        : `<option value="SI LLEVA" ${ribValue === "SI LLEVA" ? "selected" : ""}>SI LLEVA</option>
                                    <option value="NO PASO" ${ribValue === "NO PASO" ? "selected" : ""}>NO PASO</option>
                                    <option value="EN CORTE" ${ribValue === "EN CORTE" ? "selected" : ""}>EN CORTE</option>
                                    <option value="EN LAV" ${ribValue === "EN LAV" ? "selected" : ""}>EN LAV</option>
                                    <option value="LAV(rep)" ${ribValue === "LAV(rep)" ? "selected" : ""}>LAV(rep)</option>
                                    <option value="EN HAB" ${ribValue === "EN HAB" ? "selected" : ""}>EN HAB</option>`
                    }
                            </select>`;
                ribHtml = `<td>${ribSelect}</td>`;
            }
            const bloqValue = getVal(row, "estado_bloqueo") || "X PROG";
            let bloqClass = "";
            if (bloqValue === "PROG") bloqClass = "sel-PROG";
            if (bloqValue === "OK") bloqClass = "sel-OK";

            // Determinar si se deben ocultar opciones en el select de Bloqueo
            let showOkOption = true;
            let showXProgOption = true;
            try {
                const onBloqView = document.getElementById('view-bloqueo') && document.getElementById('view-bloqueo').classList.contains('active');
                if (onBloqView && currentBloqueoFilter === 'X PROG') showOkOption = false;
                if (onBloqView && currentBloqueoFilter === 'PROG') showXProgOption = false;
            } catch (e) { /* silent */ }

            // Si ocultamos X PROG pero el valor actual es 'X PROG', forzamos un valor visible
            const effectiveValue = (bloqValue === 'X PROG' && !showXProgOption) ? 'PROG' : bloqValue;

            const xProgOptionHtml = showXProgOption ? `<option value="X PROG" ${effectiveValue === "X PROG" ? "selected" : ""}>X PROG</option>` : '';
            const okOptionHtml = showOkOption ? `<option value="OK" ${effectiveValue === "OK" ? "selected" : ""}>OK</option>` : '';

            // En la vista Bloqueo->Programado, requerir que el usuario haya seleccionado RIB (estado_rib)
            // para permitir cambiar el estado de Bloqueo. Si no existe un valor guardado en estado_rib,
            // deshabilitar el select y mostrar tooltip indicando que primero debe elegir RIB.
            let requireRibSelection = false;
            try {
                const onBloqView = document.getElementById('view-bloqueo') && document.getElementById('view-bloqueo').classList.contains('active');
                if (onBloqView && currentBloqueoFilter === 'PROG') requireRibSelection = true;
            } catch (e) { /* ignore */ }

            // Considerar que si la columna original "RIB" indica "NO LLEVA",
            // entonces se considera como si ya estuviera seleccionada y por tanto
            // permitir cambiar el estado de Bloqueo incluso en sub-tab PROG.
            const hasRibSavedOrNoLleva = !!ribGuardado || (String(ribOriginal).toUpperCase() === "NO LLEVA");
            const bloqDisabledAttr = (requireRibSelection && !hasRibSavedOrNoLleva) ? 'disabled' : '';
            const bloqTitle = (requireRibSelection && !hasRibSavedOrNoLleva) ? 'Seleccione RIB primero' : '';

            const bloqSelect = `
                        <select class="table-select ${bloqClass}" ${bloqDisabledAttr} title="${bloqTitle}" onchange="updateRow(${rowIndex}, 'estado_bloqueo', this.value, this)">
                            ${xProgOptionHtml}
                            <option value="PROG" ${effectiveValue === "PROG" ? "selected" : ""}>PROG</option>
                            ${okOptionHtml}
                        </select>`;

            controlHtml = `<td title="${nroMolde}">${nroMolde}</td><td title="${tipoCert}">${tipoCert}</td><td>${bloqSelect}</td>${ribHtml}`;

        } else if (type === "lavado") {
            const lavValue = getVal(row, "estado_lavada") || "EN LAV";
            let lavClass = "sel-ENLAV";
            if (lavValue === "OK") lavClass = "sel-OK";

            // Detectar devolucion (tolerante a may?sculas/acento)
            const isDevol = String(lavValue || '').toUpperCase().includes('DEVOLUCION') || String(lavValue || '').toUpperCase().includes('DEVOLUCI?N');
            if (isDevol) isDevolucionRow = true;

            const lavSelect = `
                            <div class="lav-wrap">
                                <select class="table-select ${lavClass}" onchange="updateRow(${rowIndex}, 'estado_lavada', this.value, this)">
                                    <option value="EN LAV" ${lavValue === "EN LAV" ? "selected" : ""}>EN LAV</option>
                                    <option value="X ARRANQUE" ${lavValue === "X ARRANQUE" ? "selected" : ""}>X ARRANQUE</option>
                                    <option value="X LAVAR" ${lavValue === "X LAVAR" ? "selected" : ""}>X LAVAR</option>
                                    <option value="X CENTRIFUGAR" ${lavValue === "X CENTRIFUGAR" ? "selected" : ""}>X CENTRIFUGAR</option>
                                    <option value="X SECAR" ${lavValue === "X SECAR" ? "selected" : ""}>X SECAR</option>
                                    <option value="X AUD INTERNA" ${lavValue === "X AUD INTERNA" ? "selected" : ""}>X AUD INTERNA</option>
                                    <option value="X AUD CALIDAD" ${lavValue === "X AUD CALIDAD" ? "selected" : ""}>X AUD CALIDAD</option>
                                    <option value="RECHAZADO" ${lavValue === "RECHAZADO" ? "selected" : ""}>RECHAZADO</option>
                                    <option value="OK" ${lavValue === "OK" ? "selected" : ""}>OK</option>
                                </select>
                                ${isDevol ? '<span class="lav-badge" title="EN LAV (devolucion)">DEVOL.</span>' : ''}
                            </div>`;

            const ribOriginal = rib || "NO LLEVA";
            const ribGuardado = getVal(row, "estado_rib");
            const ribValue = ribGuardado || (ribOriginal === "NO LLEVA" ? "NO LLEVA" : "SI LLEVA");
            let ribDisabled = (ribOriginal === "NO LLEVA") ? "disabled" : "";
            let ribClass = (ribValue === "OK") ? "sel-OK" : "";

            // En Lavado mostrar s?lo las opciones solicitadas. Si es NO LLEVA mantener celda deshabilitada.
            let ribSelect = '';
            try {
                if (ribOriginal === "NO LLEVA") {
                    ribSelect = `<select class="table-select" disabled><option>NO LLEVA</option></select>`;
                } else {
                    // Aplicar clase de peligro si el valor es NO PASO o LAV(rep)
                    const danger = (String(ribValue).toUpperCase() === 'NO PASO' || String(ribValue).toUpperCase() === 'LAV(REP)');
                    const extraClass = danger ? 'rib-danger' : '';
                    ribSelect = `
                                <select class="table-select ${ribClass} ${extraClass}" onchange="updateRow(${rowIndex}, 'estado_rib', this.value, this)">
                                    <option value="NO PASO" ${ribValue === "NO PASO" ? "selected" : ""}>NO PASO</option>
                                    <option value="EN CORTE" ${ribValue === "EN CORTE" ? "selected" : ""}>EN CORTE</option>
                                    <option value="EN LAV" ${ribValue === "EN LAV" ? "selected" : ""}>EN LAV</option>
                                    <option value="LAV(rep)" ${ribValue === "LAV(rep)" ? "selected" : ""}>LAV(rep)</option>
                                </select>`;
                }
            } catch (e) {
                ribSelect = `<select class="table-select ${ribClass}" ${ribDisabled} onchange="updateRow(${rowIndex}, 'estado_rib', this.value, this)">
                                        <option value="NO PASO" ${ribValue === "NO PASO" ? "selected" : ""}>NO PASO</option>
                                        <option value="EN CORTE" ${ribValue === "EN CORTE" ? "selected" : ""}>EN CORTE</option>
                                        <option value="EN LAV" ${ribValue === "EN LAV" ? "selected" : ""}>EN LAV</option>
                                        <option value="LAV(rep)" ${ribValue === "LAV(rep)" ? "selected" : ""}>LAV(rep)</option>
                                    </select>`;
            }

            controlHtml = `<td title="${tipoCert}">${tipoCert}</td><td>${lavSelect}</td><td>${ribSelect}</td>`;
        }

        // Usamos title para mostrar el dato completo en hover por si acaso
        let html = `
                    ${type === "bloqueo" ? `<td>${fGirado}</td>` : ''}
                    <td class="date-cell">${fDespacho}</td>
                    ${fIngCostHtml}
                    <td>${cliente}</td>
                    ${type === "bloqueo" ? `<td title="${ruta}">${ruta}</td>` : ''}
                    <!-- TOOLTIP TITLE PARA VER TEXTO COMPLETO -->
                    <td class="op-cell wrap-text" title="${opPtda}">${opPtda}</td>
                    <td class="op-cell oc-cell" title="${oc}">${oc}</td>
                    <td title="${color}">${color}</td>
                    <td class="kg-cell" style="text-align:right;">${kg}</td>
                    <td title="${articulo}">${articulo}</td>
                    ${controlHtml}
                `;
        tr.innerHTML = html;

        // Inicializar eventos onclick de los spans de fecha
        setTimeout(() => {
            const inputEl = tr.querySelector('input.short-year');
            const spanEl = tr.querySelector('span.date-yy');
            if (inputEl && spanEl) {
                spanEl.onclick = function (e) {
                    e.stopPropagation();
                    inputEl.showPicker ? inputEl.showPicker() : inputEl.click();
                };
            }
        }, 0);

        // Si la fila corresponde a una devoluci?n de lavado, marcar visualmente
        try {
            if (isDevolucionRow) tr.classList.add('lav-devolucion');
        } catch (e) { /* ignore */ }

    } else {
        const fDespacho = formatValue(getVal(row, "HOD"), 'date');

        // Determinar si F.ING.COST debe ser date picker en esta vista/sub-tab
        let fIngCostHtml = '';
        let useDatePicker = false;
        try {
            const isCorteView = document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active');
            const isEnumeradoView = document.getElementById('view-enumerado') && document.getElementById('view-enumerado').classList.contains('active');
            const isTransferView = document.getElementById('view-transfer') && document.getElementById('view-transfer').classList.contains('active');
            const isArtesView = document.getElementById('view-artes') && document.getElementById('view-artes').classList.contains('active');
            const isHabilitadoView = document.getElementById('view-habilitado') && document.getElementById('view-habilitado').classList.contains('active');
            const isCorteBloques = document.getElementById('view-corte-bloques') && document.getElementById('view-corte-bloques').classList.contains('active');

            // Corte Pzas ? Por Programar (X PROG)
            if (isCorteView && currentCorteFilter === 'X PROG') useDatePicker = true;
            // Corte Bloques ? Por Programar (X PROG)
            if (isCorteBloques && currentCorteBloquesFilter === 'X PROG') useDatePicker = true;
            // Enumerado ? Por enumerar (sub-tab activo)
            if (isEnumeradoView) useDatePicker = true;
            // Transfer ? Por Programar (X PROG)
            if (isTransferView && currentTransferFilter === 'X PROG') useDatePicker = true;
            // Arte (Pzas) ? Bordado X PROG o Estampado X PROG
            if (isArtesView) {
                const isBordado = document.getElementById('btn-artes-bordado') && document.getElementById('btn-artes-bordado').classList.contains('active');
                const isEstampado = document.getElementById('btn-artes-estampado') && document.getElementById('btn-artes-estampado').classList.contains('active');
                if (isBordado) {
                    // Verificar sub-tab X PROG de Bordado
                    const btnBordadoXProg = document.getElementById('btn-bordado-xprog');
                    if (btnBordadoXProg && btnBordadoXProg.classList.contains('active')) useDatePicker = true;
                }
                if (isEstampado) {
                    // Verificar sub-tab X PROG de Estampado
                    const btnEstampadoXProg = document.getElementById('btn-estampado-xprog');
                    if (btnEstampadoXProg && btnEstampadoXProg.classList.contains('active')) useDatePicker = true;
                }
            }
            // Habilitado (toda la vista)
            if (isHabilitadoView) useDatePicker = true;
        } catch (e) { }

        if (useDatePicker) {
            const rawFIngCost = getVal(row, "F.ING.COST");
            const dateValue = convertToDateInputFormat(rawFIngCost);
            fIngCostHtml = `<td class="date-cell"><input type="date" class="short-year" value="${dateValue}" onchange="handleDateChange(this, ${rowIndex}, 'F.ING.COST')"><span class="date-yy">${formatDateShortFromInput(dateValue) || 'mm/dd/aaaa'}</span></td>`;
        } else {
            const fIngCost = formatValue(getVal(row, "F.ING.COST"), 'date');
            fIngCostHtml = `<td class="date-cell">${fIngCost}</td>`;
        }

        const cliente = normalizeClientName(getVal(row, "CLIENTE"));

        const op = getVal(row, "OP");
        const corte = getVal(row, "CORTE");
        const oc = (op || corte) ? `${op}-${corte}` : "";

        const rutaVal = getVal(row, "RUTA TELA") || getVal(row, "RUTA") || "";

        const rawColor = getVal(row, "COLOR");
        const color = abbreviateHeather(rawColor);
        const fGirado = formatValue(getVal(row, "F. GIRADO"), 'date');

        const opTela = String(getVal(row, "OP TELA") || "").trim();
        const partida = String(getVal(row, "PARTIDA") || "").trim();
        const opPtda = `${opTela}-${partida}`;

        const pdsRaw = parseFloat(getVal(row, "PDS GIRADAS")) || 0;
        const pdsStr = formatThousands(pdsRaw, 0);

        const prenda = getVal(row, "PRENDA");
        const prendaNorm = normalizePrenda(prenda);
        const articulo = getVal(row, "ART?CULO");
        const tipoCert = normalizeTipoCert(getVal(row, "TIPO CERTIFICADO"));
        const rib = getVal(row, "RIB") || getVal(row, "estado_rib") || "";

        const equipoCorte = getVal(row, "EQUIPO CORTE") || getVal(row, "EQUIPO_CORTE") || getVal(row, "equipo_corte") || "";
        const estadoCorte = getVal(row, "STATUS_CORTE") || getVal(row, "STATUS") || getVal(row, "status") || getVal(row, "ESTADO CORTE") || getVal(row, "ESTADO_CORTE") || getVal(row, "estado_corte") || "";
        // Determinar el nombre de columna a usar al guardar: preferir la que exista en colMap
        let updateColName = 'STATUS_CORTE';
        if (colMap[updateColName] === undefined || colMap[updateColName] === -1) {
            const candidates = ['STATUS', 'status', 'estado_corte', 'ESTADO CORTE', 'ESTADO_CORTE'];
            for (let c of candidates) {
                if (colMap[c] !== undefined && colMap[c] !== -1) { updateColName = c; break; }
            }
        }
        const estadoBloques = getVal(row, "ESTADO BLOQUES") || getVal(row, "ESTADO_BLOQUES") || getVal(row, "estado_bloques") || "";
        const estadoCollTap = getVal(row, "ESTADO COLL TAP") || getVal(row, "ESTADO_COLL_TAP") || getVal(row, "estado_coll_tap") || "";

        // Determinar si mostrar el bot?n de tendido (solo en sub-tabs PROG 1T/2T/3T)
        const showTendidoBtn = esSubtabProgCorteParaTendido() && !isHabilitadoView() && !esCorteInicialBloqueadoParaTendido(corte);
        const tendidoBtnHtml = showTendidoBtn
            ? `<button class="btn-tendido" onclick="abrirModalTendido(${rowIndex})" title="Dividir en tendidos">+</button>`
            : '';

        // Usar la funci?n helper para renderizar el badge de RUTA
        const rutaDisplay = renderRutaBadge(rutaVal, row, rowIndex);

        // Determinar si OP-PTDA debe ser clickeable en Corte PROG 1T/2T/3T
        const isCorteProgView = (currentCorteFilter === 'PROG 1T' || currentCorteFilter === 'PROG 2T' || currentCorteFilter === 'PROG 3T');
        const makeOpPtdaClickable = isCorteProgView && !isHabilitadoView();
        // Mostrar bot?n eliminar (papelera) solo cuando RUTA TELA est? vac?a y el switch 'Normal' est? activado
        const rutaEmpty = String(rutaVal || '').trim() === '';
        const showDeleteBtn = rutaEmpty && routeFilters && routeFilters['NORMAL'] && (document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active'));
        const deleteHtml = showDeleteBtn ? `<button type="button" class="btn-delete-oc" onclick="openDeleteModal(${rowIndex}, '${(oc || '').toString().replace(/'/g, "\\'")}')" title="Eliminar OC" style="background:none;border:none;color:var(--danger);margin-left:6px;cursor:pointer;"><i class="ph ph-trash"></i></button>` : '';
        const opPtdaHtml = makeOpPtdaClickable
            ? `<span class="oc-link" style="cursor:pointer;" onclick="abrirModalLavadoFromCorte(${rowIndex})" title="Cambiar estado lavada">${opPtda}</span>`
            : opPtda;

        // Obtener valor RSV
        const rsv = getVal(row, "RSV") || "";

        let html = `
                    <td title="${rsv}">${rsv}</td>
                    <td>${fGirado}</td>
                    <td class="date-cell">${fDespacho}</td>
                    ${fIngCostHtml}
                    <td title="${cliente}">${cliente}</td>
                    <td title="${rutaVal}">${rutaDisplay}</td>
                <td class="op-cell oc-cell" title="${oc}">${tendidoBtnHtml}<span class="oc-link" onclick="if(isHabilitadoView()) abrirModalOC(${rowIndex});" oncontextmenu="showCorteOcContextMenu(event, ${rowIndex}); return false;">${oc}</span>${deleteHtml}</td>
                    <td title="${color}">${color}</td>
                    <td class="op-cell wrap-text" title="${opPtda}">${opPtdaHtml}</td>
                    <td class="kg-cell" style="text-align:center;">${pdsStr}</td>
                    <td title="${prenda}">${prendaNorm}</td>
                    <td title="${articulo}">${articulo}</td>
                    <td title="${tipoCert}">${tipoCert}</td>
                    <td>
                        ${(() => {
                const ribOriginal = getVal(row, "RIB") || "NO LLEVA";
                const ribGuardado = getVal(row, "estado_rib");
                const ribValue = ribGuardado || (ribOriginal === "NO LLEVA" ? "NO LLEVA" : "SI LLEVA");
                const ribDisabled = (ribOriginal === "NO LLEVA") ? "disabled" : "";
                const ribClass = (ribValue === "OK") ? "sel-OK" : "";
                try {
                    const onCorteView = document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active');
                    // En PROG 1T/2T/3T: si NO LLEVA mostrar pill, si SI LLEVA mostrar desplegable con estado_rib
                    const corteFilterNorm = String(currentCorteFilter || '').toUpperCase().trim();
                    const isProgSubtab = (corteFilterNorm.startsWith('PROG ') && corteFilterNorm !== 'X PROG');
                    if (onCorteView && isProgSubtab) {
                        if (ribOriginal === 'NO LLEVA') {
                            return `<span class="pill pill-rib-no-lleva" title="NO LLEVA">NO LLEVA</span>`;
                        } else {
                            // SI LLEVA: mostrar desplegable con estado_rib
                            return `
                                            <select class="table-select ${ribClass}" onchange="handleRibChangeCorte(${rowIndex}, this.value, this)">
                                                <option value="SI LLEVA" ${ribValue === "SI LLEVA" ? "selected" : ""}>SI LLEVA</option>
                                                <option value="NO PASO" ${ribValue === "NO PASO" ? "selected" : ""}>NO PASO</option>
                                                <option value="EN CORTE" ${ribValue === "EN CORTE" ? "selected" : ""}>EN CORTE</option>
                                                <option value="EN LAV" ${ribValue === "EN LAV" ? "selected" : ""}>EN LAV</option>
                                                <option value="LAV(rep)" ${ribValue === "LAV(rep)" ? "selected" : ""}>LAV(rep)</option>
                                                <option value="EN HAB" ${ribValue === "EN HAB" ? "selected" : ""}>EN HAB</option>
                                            </select>
                                        `;
                        }
                    }
                    if (onCorteView && currentCorteFilter === 'X PROG') {
                        const spanClass = (ribValue === 'SI LLEVA') ? 'rib-si-lleva' : 'rib-text';
                        return `<span title="${ribValue}" class="${spanClass}">${ribValue}</span>`;
                    }
                } catch (e) { /* ignore */ }
                return `
                                <select class="table-select ${ribClass}" ${ribDisabled} onchange="updateRow(${rowIndex}, 'estado_rib', this.value, this)">
                                    ${ribOriginal === "NO LLEVA"
                        ? `<option>NO LLEVA</option>`
                        : `<option value="SI LLEVA" ${ribValue === "SI LLEVA" ? "selected" : ""}>SI LLEVA</option>
                                        <option value="NO PASO" ${ribValue === "NO PASO" ? "selected" : ""}>NO PASO</option>
                                        <option value="EN CORTE" ${ribValue === "EN CORTE" ? "selected" : ""}>EN CORTE</option>
                                        <option value="EN LAV" ${ribValue === "EN LAV" ? "selected" : ""}>EN LAV</option>
                                        <option value="LAV(rep)" ${ribValue === "LAV(rep)" ? "selected" : ""}>LAV(rep)</option>
                                        <option value="EN HAB" ${ribValue === "EN HAB" ? "selected" : ""}>EN HAB</option>`}
                                </select>
                            `;
            })()}
                    </td>
                    <td>
                            ${(() => {
                // En la vista Enumerado siempre mostrar solo el dato (sin select)
                try {
                    if (isEnumeradoView()) return equipoCorte || '';
                } catch (e) { }

                // Si estamos en sub-tab "Por Programar" (X PROG), mostrar select
                if (currentCorteFilter === 'X PROG') {
                    const currentEquipo = equipoCorte || '';
                    let optionsHtml = '<option value="">-- Seleccionar --</option>';
                    equiposCorteData.forEach(eq => {
                        const selected = (currentEquipo === eq.nombre) ? 'selected' : '';
                        optionsHtml += `<option value="${eq.nombre}" ${selected}>${eq.nombre}</option>`;
                    });
                    return `
                                    <select class="table-select" data-rowindex="${rowIndex}" onchange="handleEquipoCorteChange(${rowIndex}, this.value, this)">
                                        ${optionsHtml}
                                    </select>
                                `;
                } else {
                    // En otros sub-tabs, solo mostrar el texto
                    return equipoCorte;
                }
            })()}
                        </td>
                        <td>
                            ${(() => {
                const est = (estadoCorte || '').toString();
                const estClass = est.toUpperCase().includes('PROG') ? 'sel-PROG' : (est === 'OK' ? 'sel-OK' : '');
                // Ocultar opci?n OK s?lo cuando estamos en la vista Corte y en el sub-tab 'X PROG'
                let allowOk = true;
                // Mantener X PROG disponible tambi?n en sub-tabs PROG (1T/2T/3T)
                let allowXProg = true;
                let isXProgSubtab = false;
                try {
                    const onCorte = document.getElementById('view-corte') && document.getElementById('view-corte').classList.contains('active');
                    if (onCorte && currentCorteFilter === 'X PROG') { allowOk = false; isXProgSubtab = true; }
                } catch (e) { /* ignore */ }

                const okOption = allowOk ? `<option value="OK" ${est === 'OK' ? 'selected' : ''}>OK</option>` : '';
                let effectiveEst = est;

                const xProgOption = allowXProg ? `<option value="X PROG" ${(!effectiveEst || effectiveEst === '' || effectiveEst === 'X PROG') ? 'selected' : ''}>X PROG</option>` : '';

                // En X PROG: deshabilitar el select hasta que se seleccione equipo_corte
                // Verificar si ya tiene equipo_corte asignado o est? en pendingProgramarCorte
                let disabledAttr = '';
                if (isXProgSubtab) {
                    const hasEquipo = equipoCorte && equipoCorte.trim() !== '';
                    const hasPending = pendingProgramarCorte[rowIndex] && pendingProgramarCorte[rowIndex].equipo_corte;
                    if (!hasEquipo && !hasPending) {
                        disabledAttr = 'disabled title="Primero seleccione equipo_corte"';
                    }
                }

                return `
                                    <select class="table-select ${estClass}" data-rowindex="${rowIndex}" ${disabledAttr} onchange="handleStatusCorteChange(${rowIndex}, '${updateColName}', this.value, this)">
                                        ${xProgOption}
                                        <option value="PROG 1T" ${effectiveEst === 'PROG 1T' ? 'selected' : ''}>PROG 1T</option>
                                        <option value="PROG 2T" ${effectiveEst === 'PROG 2T' ? 'selected' : ''}>PROG 2T</option>
                                        <option value="PROG 3T" ${effectiveEst === 'PROG 3T' ? 'selected' : ''}>PROG 3T</option>
                                        ${okOption}
                                    </select>
                                `;
            })()}
                        </td>
                    ${(() => {
                // Si estamos en sub-tab PROG (1T/2T/3T) dentro de la vista Corte,
                // o si estamos en la vista Enumerado, mostramos selects con las opciones solicitadas.
                if (isCorteProgSubtab() || isEnumeradoView() || isHabilitadoView()) {
                    const bloqVal = (estadoBloques || '').toString();
                    const collVal = (estadoCollTap || '').toString();
                    // Para BLOQUES?: en las vistas Enumerado y Habilitado mostramos el dato (texto),
                    // en otras vistas mostramos el select editable.
                    let bloqCell = '';
                    if (isHabilitadoView() || isEnumeradoView()) {
                        const bloqDisplay = estadoBloques || '';
                        bloqCell = `<td title="${bloqDisplay}">${bloqDisplay}</td>`;
                    } else {
                        bloqCell = `
                                    <td>
                                        <select class="table-select" onchange="handleBloquesChangeCorte(${rowIndex}, this.value, this)">
                                            <option value="LLEVA?" ${(!bloqVal || bloqVal === 'LLEVA?') ? 'selected' : ''}>LLEVA?</option>
                                            <option value="Ok corte" ${bloqVal === 'Ok corte' ? 'selected' : ''}>Ok corte</option>
                                            <option value="NO LLEVA" ${bloqVal === 'NO LLEVA' ? 'selected' : ''}>NO LLEVA</option>
                                        </select>
                                    </td>`;
                    }

                    // Para COLL o TAP?: en Habilitado mostrar select con el dato actual + OK,
                    // en otras vistas mantener las opciones completas. En particular,
                    // para los sub-tabs PROG de la vista Corte queremos el select completo
                    // (igual que Enumerado), as? que forzamos ese HTML cuando corresponda.
                    let collSelect = '';
                    const fullCollSelectHtml = `
                                    <td>
                                        <select class="table-select" onchange="handleCollTapChangeCorte(${rowIndex}, this.value, this)">
                                            <option value="LLEVA?" ${(!collVal || collVal === 'LLEVA?') ? 'selected' : ''}>LLEVA?</option>
                                            <option value="Coll en Hab" ${collVal === 'Coll en Hab' ? 'selected' : ''}>Coll en Hab</option>
                                            <option value="Tap en Hab" ${collVal === 'Tap en Hab' ? 'selected' : ''}>Tap en Hab</option>
                                            <option value="Coll/Tap nCorte" ${collVal === 'Coll/Tap nCorte' ? 'selected' : ''}>Coll/Tap nCorte</option>
                                            <option value="Coll+Tap en Hab" ${collVal === 'Coll+Tap en Hab' ? 'selected' : ''}>Coll+Tap en Hab</option>
                                            <option value="NO LLEVA" ${collVal === 'NO LLEVA' ? 'selected' : ''}>NO LLEVA</option>
                                        </select>
                                    </td>`;

                    if (isHabilitadoView()) {
                        const currentVal = (collVal || '').toString();
                        const isOk = currentVal === 'OK';
                        const isNoLleva = currentVal.toUpperCase() === 'NO LLEVA';

                        // Si es "NO LLEVA", mostrar badge con el mismo estilo que RUTA en Corte Pzas
                        if (isNoLleva) {
                            collSelect = `
                                        <td title="NO LLEVA">
                                            <span class="route-badge route-bloq">NO LLEVA</span>
                                        </td>`;
                        } else {
                            // Si est? vac?o, mostrar 'x llenar'
                            const displayLabel = currentVal === '' ? 'x llenar' : currentVal;
                            const safeVal = (currentVal === '' ? 'x llenar' : currentVal).replace(/\"/g, '&quot;');
                            collSelect = `
                                        <td>
                                            <select class="table-select" onchange="updateRow(${rowIndex}, 'ESTADO_COLL_TAP', this.value, this)">
                                                <option value="${safeVal}" ${!isOk ? 'selected' : ''}>${displayLabel}</option>
                                                <option value="OK" ${isOk ? 'selected' : ''}>OK</option>
                                            </select>
                                        </td>`;
                        }
                    } else {
                        collSelect = fullCollSelectHtml;
                    }
                    // Si estamos en un sub-tab PROG dentro de Corte, devolver el select completo
                    // (igual que en Enumerado) y evitar caer en el retorno por defecto.
                    try {
                        if (isCorteProgSubtab()) {
                            return bloqCell + collSelect;
                        }
                    } catch (e) { }

                    // Si estamos en Enumerado o Habilitado, tambi?n a?adir el select

                    // Forzar select completo en los sub-tabs PROG dentro de Corte
                    try {
                        if (isCorteProgSubtab()) collSelect = fullCollSelectHtml;
                    } catch (e) { }

                    // Si estamos en Enumerado o Habilitado, tambi?n a?adir el select
                    // para estado_enumerado como ?ltima columna
                    if (isEnumeradoView() || isHabilitadoView()) {
                        const enmVal = (estadoBloques && estadoBloques.toString()) ? '' : '';
                        // Buscar valor actual en las variantes de columna
                        const evCandidates = ['estado_enumerado', 'ESTADO_ENumerado', 'ESTADO ENUMERADO'];
                        // Intentar recuperar valor real (si existe) desde rawData
                        let ev = '';
                        try {
                            const idxEv = findHeaderIndexCaseInsensitive('estado_enumerado');
                            if (idxEv !== -1 && rawData[rowIndex] && rawData[rowIndex][idxEv]) ev = String(rawData[rowIndex][idxEv]);
                        } catch (e) { ev = ''; }
                        const evNorm = (ev || '').toString();
                        // Construir dos variantes del select: una para Enumerado y otra para Habilitado
                        const enmSelectEnumerado = `
                                            <td>
                                                <select class="table-select" onchange="updateRow(${rowIndex}, 'estado_enumerado', this.value, this)">
                                                    <option value="X ENM" ${(evNorm === '' || evNorm === 'X ENM') ? 'selected' : ''}>X ENM</option>
                                                    <option value="OK ENM" ${evNorm === 'OK ENM' ? 'selected' : ''}>OK ENM</option>
                                                </select>
                                            </td>`;

                        const enmSelectHabilitado = `
                                            <td>
                                                <select class="table-select" onchange="updateRow(${rowIndex}, 'estado_enumerado', this.value, this)">
                                                    <option value="X ENM" ${(evNorm === '' || evNorm === 'X ENM') ? 'selected' : ''}>X ENM</option>
                                                    <option value="OK ENM" ${evNorm === 'OK ENM' ? 'selected' : ''}>OK ENM</option>
                                                    <option value="OK S/ENM" ${evNorm === 'OK S/ENM' ? 'selected' : ''}>OK S/ENM</option>
                                                </select>
                                            </td>`;

                        // Si estamos en Enumerado, mostrar solo las opciones solicitadas (X ENM, OK ENM)
                        if (isEnumeradoView() && !isHabilitadoView()) {
                            return bloqCell + enmSelectEnumerado;
                        }

                        // Para la vista Habilitado a?adimos una columna adicional ESTADO_BLOQS
                        // entre BLOQUES? y COLL o TAP? que muestra el valor sin desplegable.
                        if (isHabilitadoView()) {
                            const estBloqsVal = getVal(row, 'estado_corte_bloques') || getVal(row, 'ESTADO_CORTE_BLOQUES') || getVal(row, 'ESTADO CORTE BLOQUES') || getVal(row, 'ESTADO_BLOQS') || '';
                            const estBloqsTd = `<td title="${estBloqsVal}">${estBloqsVal}</td>`;
                            return bloqCell + estBloqsTd + collSelect + enmSelectHabilitado;
                        }

                        // Comportamiento por defecto (Corte PROG u otros): incluir COLL + el select de Habilitado
                        return bloqCell + collSelect + enmSelectHabilitado;
                    }
                }
                return `<td title="${estadoBloques}">${estadoBloques}</td>\n                    <td title="${estadoCollTap}">${estadoCollTap}</td>`;
            })()}
                `;
        tr.innerHTML = html;
    }

    return tr;
}
