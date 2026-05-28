window.updateBtnProgramarBloqueo = function () {
    const btnProgramar = document.getElementById('btn-programar-bloqueo');
    const badge = document.getElementById('badge-programar-bloqueo-count');
    if (!btnProgramar) return;

    // Contar total de filas pendientes de programar
    let count = 0;
    for (const key in pendingProgramarBloqueo) {
        count += pendingProgramarBloqueo[key].length;
    }

    if (count > 0) {
        btnProgramar.style.display = 'inline-flex';
        if (badge) badge.textContent = count;
    } else {
        btnProgramar.style.display = 'none';
        if (badge) badge.textContent = '0';
    }
};

// Funcion para programar todas las filas de bloqueo pendientes
window.programarFilasBloqueo = async function () {
    // Recolectar todas las filas a programar
    const filasAProgramar = [];
    for (const key in pendingProgramarBloqueo) {
        const filas = pendingProgramarBloqueo[key];
        for (const rowIndex of filas) {
            filasAProgramar.push(rowIndex);
        }
    }

    if (filasAProgramar.length === 0) {
        alert('No hay filas para programar.');
        return;
    }

    console.log('[programarFilasBloqueo] Filas a programar:', filasAProgramar);

    // Mostrar loader o deshabilitar boton
    const btnProgramar = document.getElementById('btn-programar-bloqueo');
    if (btnProgramar) {
        btnProgramar.disabled = true;
        btnProgramar.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
    }

    try {
        // Funcion auxiliar para encontrar indice de columna
        function findColIndexNormalized(name) {
            if (!rawData || rawData.length === 0) return -1;
            const headers = rawData[0];
            const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const target = norm(name);
            for (let i = 0; i < headers.length; i++) {
                if (norm(headers[i]) === target) return i;
            }
            return -1;
        }

        // Preparar F.PROGBAC si aplica
        const idxRutaTela = findColIndexNormalized('RUTA TELA');
        const idxFProgbac = findColIndexNormalized('F.PROGBAC');
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const fechaHoy = dd + '/' + mm + '/' + yyyy;

        if (idxFProgbac !== -1) {
            colMap['F.PROGBAC'] = idxFProgbac;
        }

        // Enviar TODAS las peticiones en PARALELO para mayor velocidad
        const promises = [];

        for (const rowIndex of filasAProgramar) {
            // NOTA: El backend (Code.gs) convierte el indice de rawData a fila de Excel con: excelRow = params.row + 1
            // Por tanto, debemos enviar el indice de rawData directamente (rowIndex)

            // Asegurar que rawData tiene PROG
            if (colMap['estado_bloqueo'] !== undefined) {
                rawData[rowIndex][colMap['estado_bloqueo']] = 'PROG';
            }

            console.log(`[programarFilasBloqueo] Enviando estado_bloqueo=PROG: rawDataIndex=${rowIndex}`);

            // Guardar estado_bloqueo (en paralelo)
            promises.push(
                window.PcpProgramaService.actualizarCampo(rowIndex, 'estado_bloqueo', 'PROG', { noCors: true, headers: {} }).catch(e => console.error('Error guardando estado_bloqueo:', e))
            );

            // Guardar F.PROGBAC si RUTA TELA = LAVADA
            if (idxRutaTela !== -1 && idxFProgbac !== -1) {
                const rutaTela = (rawData[rowIndex] && rawData[rowIndex][idxRutaTela])
                    ? String(rawData[rowIndex][idxRutaTela]).toUpperCase().trim() : '';

                if (rutaTela === 'LAVADA') {
                    rawData[rowIndex][idxFProgbac] = fechaHoy;

                    promises.push(
                        window.PcpProgramaService.actualizarCampo(rowIndex, 'F.PROGBAC', fechaHoy, { noCors: true, headers: {} }).catch(e => console.error('Error guardando F.PROGBAC:', e))
                    );

                    console.log('F.PROGBAC enviado:', fechaHoy, 'para rawDataIndex', rowIndex);
                }
            }
        }

        // Esperar a que todas las peticiones se envien
        await Promise.all(promises);

        // Espera adicional para dar tiempo al backend de procesar
        await new Promise(resolve => setTimeout(resolve, 800));

        console.log('[programarFilasBloqueo] Guardado completado para', filasAProgramar.length, 'filas');

        // Limpiar pendientes
        pendingProgramarBloqueo = {};

        // Ocultar boton
        if (btnProgramar) {
            btnProgramar.style.display = 'none';
            btnProgramar.disabled = false;
            btnProgramar.innerHTML = '<i class="ph ph-check-circle"></i> Programar <span class="kg-badge" id="badge-programar-bloqueo-count" style="background: rgba(255,255,255,0.3); color: white;">0</span>';
        }

        // Re-renderizar las vistas
        renderBloqueo();
        updateCounters();

    } catch (error) {
        console.error('Error al programar filas de bloqueo:', error);
        alert('Ocurri? un error al guardar. Por favor intente nuevamente.');
        if (btnProgramar) {
            btnProgramar.disabled = false;
            btnProgramar.innerHTML = '<i class="ph ph-check-circle"></i> Programar <span class="kg-badge" id="badge-programar-bloqueo-count" style="background: rgba(255,255,255,0.3); color: white;">' + filasAProgramar.length + '</span>';
        }
    }
};
