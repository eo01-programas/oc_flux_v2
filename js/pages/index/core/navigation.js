window.switchView = function (viewName, btn) {
    // Cerrar todos los men?s contextuales al cambiar de vista
    hideAllContextMenus();
    if (viewName !== 'habilitado') {
        try { if (typeof window.cerrarModalHabilitadoHoja3 === 'function') window.cerrarModalHabilitadoHoja3(); } catch (e) { }
    }

    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    btn.classList.add('active');
    // Re-render the view we just activated so dynamic row content
    // (selects shown for Enumerado or Corte sub-tabs) is created
    // while the view has the 'active' class.
    try {
        if (viewName === 'bloqueo') renderBloqueo();
        else if (viewName === 'lavado') renderLavado();
        else if (viewName === 'corte') renderCorte();
        else if (viewName === 'corte-bloques') renderCorteBloques();
        else if (viewName === 'enumerado') renderEnumerado();
        else if (viewName === 'artes') renderArtes();
        else if (viewName === 'habilitado') renderHabilitado();
    } catch (e) { console.error('Error re-rendering view after switch:', e); }
};

window.filterHabilitado = function (filterState, btn) {
    hideAllContextMenus(); // Cerrar men?s contextuales
    currentHabilitadoFilter = filterState;
    isHabilitadoIngresosMode = false;
    habilitadoIngresosDateFilter = '';
    habilitadoIngresosPlantFilter = '';
    try { if (typeof window.cerrarModalHabilitadoHoja3 === 'function') window.cerrarModalHabilitadoHoja3(); } catch (e) { }
    document.querySelectorAll('#view-habilitado .sub-tab').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    // Limpiar filtros de encabezado cuando se cambia de sub-tab
    habilitadoHeaderFilters = [];
    habilitadoHeaderFilter = null;

    // Ocultar bot?n Programar Habilitado y limpiar pendientes al cambiar de sub-tab
    try {
        const btnProgramarHab = document.getElementById('btn-programar-habilitado');
        if (btnProgramarHab) btnProgramarHab.style.display = 'none';
        pendingProgramarHabilitado = {};
        touchedPlantaOcGroups = new Set();
        touchedOcGroups = new Set();
    } catch (e) { }

    renderHabilitado();
};

window.filterBloqueo = function (filterState, btn) {
    hideAllContextMenus(); // Cerrar men?s contextuales
    currentBloqueoFilter = filterState;
    document.querySelectorAll('#view-bloqueo .sub-tab:not(#btn-programar-bloqueo)').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    bloqueoHeaderFilters = []; // Limpiar filtros al cambiar de sub-tab
    bloqueoHeaderFilter = null;
    // Limpiar pendientes y ocultar bot?n Programar al cambiar de sub-tab
    pendingProgramarBloqueo = {};
    updateBtnProgramarBloqueo();
    try {
        const printBtn = document.getElementById('btn-print-bloqueo-prog');
        if (printBtn) printBtn.style.display = (currentBloqueoFilter === 'PROG') ? 'inline-flex' : 'none';
    } catch (e) { }
    renderBloqueo();
};

window.filterLavado = function (filterState, btn) {
    hideAllContextMenus(); // Cerrar men?s contextuales
    currentLavadoFilter = filterState;
    document.querySelectorAll('#view-lavado .sub-tab').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    lavadoHeaderFilters = []; // Limpiar filtros al cambiar de sub-tab
    lavadoHeaderFilter = null;
    renderLavado();
};

window.filterCorte = function (filterState, btn) {
    hideAllContextMenus(); // Cerrar men?s contextuales
    currentCorteFilter = filterState;
    document.querySelectorAll('#view-corte .sub-tab').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    corteHeaderFilters = []; // Limpiar filtros al cambiar de sub-tab
    corteHeaderFilter = null;
    // Mostrar/ocultar filtros por RUTA solo cuando estemos en 'Por Programar' (X PROG)
    try {
        const filtEl = document.getElementById('corte-route-filters');
        if (filtEl) filtEl.style.display = (filterState === 'X PROG') ? 'flex' : 'none';
    } catch (e) { }
    // Mostrar/ocultar bot?n EQ_Corte solo cuando estemos en 'Por Programar' (X PROG)
    try {
        const eqBtn = document.getElementById('eqcorte-btn');
        if (eqBtn) eqBtn.style.display = (filterState === 'X PROG') ? 'inline-flex' : 'none';
    } catch (e) { }
    // Mostrar/ocultar boton "Nuevo corte" solo en sub-tab Por Programar (X PROG)
    try {
        const btnNuevoCorte = document.getElementById('btn-nuevo-corte');
        if (btnNuevoCorte) {
            const isXProg = (filterState === 'X PROG');
            btnNuevoCorte.style.display = isXProg ? 'inline-flex' : 'none';
            if (!isXProg && typeof cerrarModalNuevoCorte === 'function') cerrarModalNuevoCorte();
        }
    } catch (e) { }
    // Ocultar bot?n Programar y limpiar pendientes al cambiar de sub-tab
    try {
        const btnProgramar = document.getElementById('btn-programar-corte');
        if (btnProgramar) btnProgramar.style.display = 'none';
        pendingProgramarCorte = {};
    } catch (e) { }
    renderCorte();
};

// Filter for Corte Bloques (X PROG o PROG)
window.filterCorteBloques = function (filterState, btn) {
    hideAllContextMenus(); // Cerrar men?s contextuales
    currentCorteBloquesFilter = filterState;
    document.querySelectorAll('#view-corte-bloques .sub-tab').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    corteBloquesHeaderFilter = null; // Limpiar filtro al cambiar de sub-tab
    renderCorteBloques();
};

window.filterTransfer = function (filterState, btn) {
    hideAllContextMenus(); // Cerrar men?s contextuales
    currentTransferFilter = filterState;
    document.querySelectorAll('#view-transfer .sub-tab').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    transferHeaderFilters = []; // Limpiar filtros al cambiar de sub-tab
    transferHeaderFilter = null; // Limpiar filtro al cambiar de sub-tab
    renderTransfer();
};

window.filterBordado = function (filterState, btn) {
    hideAllContextMenus(); // Cerrar men?s contextuales
    window.currentArtesBordadoFilter = filterState;
    document.querySelectorAll('#bordado-subtabs .sub-tab').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    artesHeaderFilters = []; // Limpiar filtros al cambiar de sub-tab
    artesHeaderFilter = null; // Limpiar filtro al cambiar de sub-tab
    renderArtesBordado();
};

window.currentArtesEstampadoFilter = 'X PROG';
window.filterEstampado = function (filterState, btn) {
    hideAllContextMenus(); // Cerrar men?s contextuales
    window.currentArtesEstampadoFilter = filterState;
    document.querySelectorAll('#estampado-subtabs .sub-tab').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    artesHeaderFilters = []; // Limpiar filtros al cambiar de sub-tab
    artesHeaderFilter = null; // Limpiar filtro al cambiar de sub-tab
    renderArtesEstampado();
};

// --- ARTES (Pza) : filtros ---
window.currentArtesFilter = 'BORDADO';
window.currentArtesBordadoFilter = 'X PROG';

window.filterArtes = function (filterState, btn) {
    hideAllContextMenus(); // Cerrar men?s contextuales
    window.currentArtesFilter = filterState;
    document.querySelectorAll('#view-artes .sub-tab').forEach(el => el.classList.remove('active'));
    if (btn) {
        btn.classList.add('active');
    }
    artesHeaderFilters = []; // Limpiar filtros al cambiar de sub-tab
    artesHeaderFilter = null; // Limpiar filtro al cambiar de sub-tab

    // Mostrar/ocultar subtabs de Bordado/Estampado seg?n la pesta?a activa
    try {
        const bordadoSubs = document.getElementById('bordado-subtabs');
        const estampadoSubs = document.getElementById('estampado-subtabs');
        if (filterState === 'BORDADO') { if (bordadoSubs) bordadoSubs.style.display = 'flex'; if (estampadoSubs) estampadoSubs.style.display = 'none'; }
        else if (filterState === 'ESTAMPADO') { if (bordadoSubs) bordadoSubs.style.display = 'none'; if (estampadoSubs) estampadoSubs.style.display = 'flex'; }
        else if (filterState === 'ASIGNAR') { if (bordadoSubs) bordadoSubs.style.display = 'none'; if (estampadoSubs) estampadoSubs.style.display = 'none'; }
        else { if (bordadoSubs) bordadoSubs.style.display = 'flex'; if (estampadoSubs) estampadoSubs.style.display = 'none'; }
    } catch (e) { }

    const bordadoContainer = document.getElementById('table-container-artes-bordado');
    const estampadoContainer = document.getElementById('table-container-artes-estampado');
    const asignarContainer = document.getElementById('table-container-artes-asignar');
    const asignarFilters = document.getElementById('artes-asignar-filters');
    if (filterState === 'ASIGNAR') {
        if (bordadoContainer) bordadoContainer.style.display = 'none';
        if (estampadoContainer) estampadoContainer.style.display = 'none';
        if (asignarContainer) asignarContainer.style.display = 'block';
        if (asignarFilters) asignarFilters.style.display = 'flex';
        try {
            const hayDatoSelect = document.getElementById('filter-artes-haydato');
            if (hayDatoSelect) hayDatoSelect.value = 'SIN';
        } catch (e) { }
        renderArtesAsignar();
    } else if (filterState === 'ESTAMPADO') {
        if (bordadoContainer) bordadoContainer.style.display = 'none';
        if (estampadoContainer) estampadoContainer.style.display = 'block';
        if (asignarContainer) asignarContainer.style.display = 'none';
        if (asignarFilters) asignarFilters.style.display = 'none';
        // Asegurar que el sub-tab interno de Estampado muestre el estado "activo"
        try {
            const subs = document.querySelectorAll('#estampado-subtabs .sub-tab');
            subs.forEach(el => el.classList.remove('active'));
            const btnId = (window.currentArtesEstampadoFilter && window.currentArtesEstampadoFilter.toUpperCase().indexOf('PROG') !== -1 && window.currentArtesEstampadoFilter.toUpperCase() !== 'X PROG') ? 'btn-estampado-prog' : 'btn-estampado-xprog';
            const btn = document.getElementById(btnId);
            if (btn) btn.classList.add('active');
        } catch (e) { }
        renderArtesEstampado();
    } else {
        if (bordadoContainer) bordadoContainer.style.display = 'block';
        if (estampadoContainer) estampadoContainer.style.display = 'none';
        if (asignarContainer) asignarContainer.style.display = 'none';
        if (asignarFilters) asignarFilters.style.display = 'none';
        // Asegurar que el sub-tab interno de Bordado muestre el estado "activo"
        try {
            const subs = document.querySelectorAll('#bordado-subtabs .sub-tab');
            subs.forEach(el => el.classList.remove('active'));
            const btnId = (window.currentArtesBordadoFilter && window.currentArtesBordadoFilter.toUpperCase().indexOf('PROG') !== -1 && window.currentArtesBordadoFilter.toUpperCase() !== 'X PROG') ? 'btn-bordado-prog' : 'btn-bordado-xprog';
            const btn = document.getElementById(btnId);
            if (btn) btn.classList.add('active');
        } catch (e) { }
        renderArtesBordado();
    }
};
