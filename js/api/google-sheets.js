window.PcpGoogleSheets = Object.freeze({
    loadGvizJsonp(options) {
        return new Promise((resolve, reject) => {
            const config = options || {};
            const spreadsheetId = config.spreadsheetId || config.id;
            if (!spreadsheetId) {
                reject(new Error("No se indico el ID del Google Sheet."));
                return;
            }

            const label = config.label || "sheet";
            const prefix = config.callbackPrefix || "pcpGviz";
            const callbackName = `${prefix}_${label}_${Date.now()}_${Math.floor(Math.random() * 1000)}`.replace(/[^a-zA-Z0-9_$]/g, "_");
            const script = document.createElement("script");
            let done = false;
            let timeoutId = null;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                try {
                    delete window[callbackName];
                } catch (e) {
                    window[callbackName] = void 0;
                }
                if (script.parentNode) script.parentNode.removeChild(script);
            };

            window[callbackName] = json => {
                if (done) return;
                done = true;
                cleanup();
                resolve(json);
            };

            const queryParts = [`tqx=responseHandler:${callbackName}`];
            if (config.gid !== undefined && config.gid !== null) {
                queryParts.push(`gid=${encodeURIComponent(config.gid)}`);
            }
            if (config.sheet) {
                queryParts.push(`sheet=${encodeURIComponent(config.sheet)}`);
            }
            if (config.headers !== undefined && config.headers !== null) {
                queryParts.push(`headers=${encodeURIComponent(config.headers)}`);
            }
            if (config.cacheBust !== false) {
                queryParts.push(`_=${Date.now()}`);
            }

            script.src = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${queryParts.join("&")}`;
            script.onerror = () => {
                if (done) return;
                done = true;
                cleanup();
                reject(new Error(config.errorMessage || `No se pudo leer la hoja compartida (${label}).`));
            };
            if (config.timeoutMs) {
                timeoutId = setTimeout(() => {
                    if (done) return;
                    done = true;
                    cleanup();
                    reject(new Error(config.timeoutMessage || `Tiempo de espera agotado en gviz (${label}).`));
                }, config.timeoutMs);
            }
            document.body.appendChild(script);
        });
    },

    gvizTableToMatrix(json, options) {
        const config = options || {};
        const invalidMessage = config.invalidMessage || "Respuesta invalida de la hoja.";
        const missingHeadersMessage = config.missingHeadersMessage || "No se encontraron encabezados en la hoja.";
        const normalizeHeader = typeof config.normalizeHeader === "function"
            ? config.normalizeHeader
            : value => String(value || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");

        if (!json || !json.table) throw new Error(invalidMessage);

        const cols = Array.isArray(json.table.cols) ? json.table.cols : [];
        const headers = cols.map(col => String(col.label || col.id || "").trim());
        const rows = (Array.isArray(json.table.rows) ? json.table.rows : []).map(row => {
            const cells = row && Array.isArray(row.c) ? row.c : [];
            return cols.map((_, index) => {
                const cell = cells[index];
                return cell && cell.v !== null ? cell.v : "";
            });
        });

        let finalHeaders = headers;
        let bodyRows = rows;
        const requiredHeaders = Array.isArray(config.requiredHeaders)
            ? config.requiredHeaders
            : (config.requiredHeader ? [config.requiredHeader] : []);
        const hasRequiredHeaders = headerRow => {
            if (!requiredHeaders.length) return true;
            const normalized = (headerRow || []).map(normalizeHeader);
            return requiredHeaders.every(header => normalized.includes(normalizeHeader(header)));
        };

        if (!hasRequiredHeaders(headers)) {
            const headerRowIndex = rows.findIndex(row => hasRequiredHeaders(row));
            if (headerRowIndex !== -1) {
                finalHeaders = rows[headerRowIndex].map(value => String(value || "").trim());
                bodyRows = rows.slice(headerRowIndex + 1);
            }
        }

        if (!finalHeaders.length) throw new Error(missingHeadersMessage);
        return [finalHeaders.map(value => String(value || "").trim()), ...bodyRows];
    }
});
