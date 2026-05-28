(function () {
    function get(params, options) {
        return window.PcpAppScript.get(params, options);
    }

    function post(payload, options) {
        return window.PcpAppScript.post(payload, options);
    }

    function obtenerTodosLosDatos(options) {
        return get({ action: "getAllData" }, options);
    }

    function actualizarCampo(row, colName, value, options) {
        return post({
            action: "update",
            row,
            colName,
            value
        }, options);
    }

    function actualizarCampoConOrigen(row, colName, value, origen, options) {
        return post({
            action: "update",
            row,
            colName,
            value,
            ...(origen || {})
        }, options);
    }

    function actualizarRegistros(records, options) {
        return post({
            action: "updateRecords",
            records
        }, options);
    }

    function cargarGiros(datos, options) {
        return post(datos, options);
    }

    function eliminarRegistro(rowIndex, reason, options) {
        const payload = {
            action: "deleteRecord",
            rowIndex
        };
        if (reason !== undefined && reason !== null) {
            payload.reason = reason;
        }
        return post(payload, options);
    }

    function eliminarRegistroConReferencia(rowIndex, referencia, options) {
        return post({
            action: "deleteRecord",
            rowIndex,
            ...(referencia || {})
        }, options);
    }

    function eliminarTendido(rowIndex, op, corte, options) {
        return post({
            action: "deleteRecord",
            rowIndex,
            op: String(op || "").trim(),
            corte: String(corte || "").trim(),
            reason: "deleteTendido"
        }, options);
    }

    function duplicarFila(payload, options) {
        return post({
            ...payload,
            action: "duplicateRow"
        }, options);
    }

    function actualizarFilaBatch(payload, options) {
        return post({
            ...payload,
            action: "batchUpdateRow"
        }, options);
    }

    function guardarHoja3Rows(turno, rows, options) {
        return post({
            action: "saveHoja3Rows",
            turno,
            rows
        }, options);
    }

    function crearTendidos(payload, options) {
        return post({
            ...payload,
            action: "createTendidos"
        }, options);
    }

    function actualizarEquipoCorte(eq, nombre, row, options) {
        return post({
            action: "updateEQCorte",
            eq,
            nombre,
            row
        }, options);
    }

    window.PcpProgramaService = Object.freeze({
        get,
        post,
        obtenerTodosLosDatos,
        actualizarCampo,
        actualizarCampoConOrigen,
        actualizarRegistros,
        cargarGiros,
        eliminarRegistro,
        eliminarRegistroConReferencia,
        eliminarTendido,
        duplicarFila,
        actualizarFilaBatch,
        guardarHoja3Rows,
        crearTendidos,
        actualizarEquipoCorte
    });
})();
