
    // Gesti?n de eliminaci?n de filas (OC)
    window._pendingDeleteRow = null;

    window.openDeleteModal = function (rowIndex, oc) {
        window._pendingDeleteRow = rowIndex;
        try { document.getElementById('modal-delete-oc-message').innerText = `?Estas seguro de eliminar esta OC? ${oc}`; } catch (e) { }
        const m = document.getElementById('modal-delete-oc'); if (m) m.classList.add('active');
    };

    window.closeDeleteModal = function () {
        window._pendingDeleteRow = null;
        const m = document.getElementById('modal-delete-oc'); if (m) m.classList.remove('active');
    };

    window.confirmDeleteOC = async function () {
        if (window._pendingDeleteRow === null) return window.closeDeleteModal();
        const row = window._pendingDeleteRow;
        let deleteSent = false;
        // Enviar petici?n al backend para eliminar la fila
        try {
            // Code.gs espera action: 'deleteRecord' y rowIndex = excelRow (1-based)
            const payload = { action: 'deleteRecord', rowIndex: (row + 1), reason: 'deleteOC' };
            console.log('Enviando delete payload (POST)', payload);
            await window.PcpProgramaService.eliminarRegistro((row + 1), 'deleteOC', { noCors: true, headers: {} });
            deleteSent = true;
        } catch (e) {
            console.error('Error enviando petici?n delete', e);
        }
        if (!deleteSent) {
            alert('No se pudo enviar la eliminaci?n al sheet. Intente nuevamente.');
            return;
        }

        // Eliminar localmente la fila para actualizar vista inmediatamente
        try {
            if (rawData && rawData.length > row) {
                rawData.splice(row, 1);
            }
        } catch (e) { console.error('Error removiendo fila localmente', e); }

        window.closeDeleteModal();
        try { updateCounters(); } catch (e) { }
        try { renderCorte(); } catch (e) { }
        try { renderBloqueo(); } catch (e) { }
        try { renderLavado(); } catch (e) { }
        try { renderEnumerado(); } catch (e) { }
        try { renderTransfer(); } catch (e) { }
        try { renderHabilitado(); } catch (e) { }
    };
