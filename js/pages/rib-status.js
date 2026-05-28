
        const SHEET_ID = window.PCP_CONFIG.SHEET_ID;
        const RIB_OPTIONS = ["SI LLEVA", "NO PASO", "EN CORTE", "EN LAV", "LAV(rep)", "EN HAB"];
        const FILTER_RIB_VALUES = new Set(["NO PASO", "LAV(REP)"]);

        let rawData = [];
        let colMap = {};
        let viewRows = [];

        document.addEventListener("DOMContentLoaded", reloadData);

        function reloadData() {
            setStatus("", "");
            toggleLoader(true);
            toggleError("");

            window.PcpGoogleSheets.loadGvizJsonp({
                spreadsheetId: SHEET_ID,
                gid: 0,
                label: "rib-status",
                callbackPrefix: "loadRibStatusData",
                errorMessage: "Error de conexion con Google Sheets."
            }).then(function(jsonResponse) {
                if (typeof window.loadRibStatusData === "function") {
                    window.loadRibStatusData(jsonResponse);
                }
            }).catch(function(error) {
                showFatalError(error && error.message ? error.message : "Error de conexion con Google Sheets.");
            });
        }

        window.loadRibStatusData = function(jsonResponse) {
            try {
                if (!jsonResponse || !jsonResponse.table) {
                    throw new Error("Datos invalidos.");
                }

                const rowsRaw = jsonResponse.table.rows.map(function(r) {
                    return r.c.map(function(cell) {
                        return (cell && cell.v !== null && cell.v !== undefined) ? cell.v : "";
                    });
                });
                const gvizHeaders = jsonResponse.table.cols.map(function(col) {
                    return (col.label || col.id || "").toString();
                });

                if (gvizHeaders.some(function(h) { return normalizeHeaderName(h) === normalizeHeaderName("OP TELA"); })) {
                    rawData = [gvizHeaders].concat(rowsRaw);
                } else {
                    let headerRowIndex = -1;
                    for (let i = 0; i < rowsRaw.length; i++) {
                        if (rowsRaw[i].some(function(v) { return normalizeHeaderName(v) === normalizeHeaderName("OP TELA"); })) {
                            headerRowIndex = i;
                            break;
                        }
                    }
                    if (headerRowIndex !== -1) {
                        rawData = [rowsRaw[headerRowIndex]].concat(rowsRaw);
                    } else {
                        rawData = [gvizHeaders].concat(rowsRaw);
                    }
                }

                if (!rawData || rawData.length === 0) {
                    throw new Error("No hay datos disponibles.");
                }
                rawData[0] = rawData[0].map(function(h) { return String(h || "").trim(); });

                mapColumns();
                if (colMap.estadoRib === -1) {
                    throw new Error("No se encontro la columna estado_rib en el sheet.");
                }
                buildViewRows();
                renderTable();
                toggleLoader(false);
            } catch (err) {
                showFatalError(err && err.message ? err.message : String(err));
            }
        };

        function normalizeHeaderName(value) {
            return String(value || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "");
        }

        function findHeaderIndex(candidates) {
            if (!rawData || !rawData.length) return -1;
            const headers = rawData[0];
            const candidateNorm = candidates.map(function(c) { return normalizeHeaderName(c); });
            for (let i = 0; i < headers.length; i++) {
                const hNorm = normalizeHeaderName(headers[i]);
                if (candidateNorm.indexOf(hNorm) !== -1) return i;
            }
            return -1;
        }

        function mapColumns() {
            colMap = {
                rsv: findHeaderIndex(["RSV"]),
                fGirado: findHeaderIndex(["F. GIRADO", "F GIRADO"]),
                hod: findHeaderIndex(["HOD", "F. DESPACHO", "F DESPACHO"]),
                fIngCost: findHeaderIndex(["F.ING.COST", "F ING COST", "F. ING. COST"]),
                cliente: findHeaderIndex(["CLIENTE"]),
                rutaTela: findHeaderIndex(["RUTA TELA", "RUTA_TELA"]),
                ruta: findHeaderIndex(["RUTA"]),
                op: findHeaderIndex(["OP"]),
                corte: findHeaderIndex(["CORTE"]),
                color: findHeaderIndex(["COLOR"]),
                opTela: findHeaderIndex(["OP TELA", "OP_TELA"]),
                partida: findHeaderIndex(["PARTIDA"]),
                pds: findHeaderIndex(["PDS GIRADAS", "PDS_GIRADAS", "PDS"]),
                prenda: findHeaderIndex(["PRENDA"]),
                articulo: findHeaderIndex(["ARTICULO", "ARTICULO.", "ARTICULO ", "ART.", "ART?CULO"]),
                tipoCert: findHeaderIndex(["TIPO CERTIFICADO", "TIPO CERT", "TIPO CERT."]),
                statusCorte: findHeaderIndex(["STATUS_CORTE", "STATUS", "status", "ESTADO CORTE", "ESTADO_CORTE", "estado_corte"]),
                status: findHeaderIndex(["STATUS", "status"]),
                estadoCorte: findHeaderIndex(["estado_corte", "ESTADO CORTE", "ESTADO_CORTE"]),
                estadoBloqueo: findHeaderIndex(["estado_bloqueo", "ESTADO_BLOQUEO", "ESTADO BLOQUEO"]),
                estadoLavada: findHeaderIndex(["estado_lavada", "ESTADO_LAVADA", "ESTADO LAVADA"]),
                estadoEnumerado: findHeaderIndex(["estado_enumerado", "ESTADO_ENUMERADO", "ESTADO ENUMERADO"]),
                rib: findHeaderIndex(["RIB"]),
                estadoRib: findHeaderIndex(["estado_rib", "ESTADO_RIB", "ESTADO RIB", "estado rib"])
            };
        }

        function getVal(row, key) {
            if (!row || !colMap.hasOwnProperty(key)) return "";
            const idx = colMap[key];
            if (idx === undefined || idx === -1 || idx >= row.length) return "";
            const v = row[idx];
            return (v === null || v === undefined) ? "" : v;
        }

        function getHeaderNameForKey(key, fallback) {
            const idx = colMap[key];
            if (idx !== undefined && idx !== -1 && rawData && rawData[0] && rawData[0][idx]) {
                return String(rawData[0][idx]);
            }
            return fallback;
        }

        function formatDateCustom(val) {
            const mesesEs = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

            if (!val && val !== 0) return "";

            if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val.getTime())) {
                const dd = String(val.getDate()).padStart(2, "0");
                const mm = mesesEs[val.getMonth()] || "";
                const yy = String(val.getFullYear()).slice(-2);
                return dd + "/" + mm + "/" + yy;
            }

            if (typeof val === "string" && val.indexOf("Date(") !== -1) {
                const match = val.match(/Date\((\d+),(\d+),(\d+)\)/);
                if (match) {
                    const yy = String(match[1]).slice(-2);
                    const mmIdx = parseInt(match[2], 10);
                    const dd = String(match[3]).padStart(2, "0");
                    return dd + "/" + (mesesEs[mmIdx] || "") + "/" + yy;
                }
            }

            if (typeof val === "number" && val > 30000) {
                const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                const dd = String(date.getDate()).padStart(2, "0");
                const mm = mesesEs[date.getMonth()] || "";
                const yy = String(date.getFullYear()).slice(-2);
                return dd + "/" + mm + "/" + yy;
            }

            return String(val);
        }

        function formatThousands(val, decimals) {
            const num = Number(val);
            if (!isFinite(num)) return "0";
            if (decimals && decimals > 0) {
                return num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
            }
            return Math.round(num).toLocaleString("en-US");
        }

        function normalizeClientName(clientName) {
            if (!clientName && clientName !== 0) return "";
            const name = String(clientName).toUpperCase().trim();
            if (name.indexOf("LACOSTE") !== -1) return "LAC";
            if (name.indexOf("ATHLETA, INC.") !== -1) return "ATH";
            if (name.indexOf("ALLBIRDS") !== -1) return "ALLB";
            if (name.indexOf("BANANA REPUBLIC, LLC") !== -1) return "BNN";
            if (name.indexOf("THEORY LLC,") !== -1) return "THE";
            if (name.indexOf("DISH & DUER") !== -1) return "DDU";
            if (name.indexOf("SKECHERS PERFORMANCE") !== -1) return "SKE";
            if (name.indexOf("LULULEMON ATHLETICA CANADA INC") !== -1) return "LLL";
            if (name.indexOf("AM RETAIL S.A.C.") !== -1) return "AMR";
            return name;
        }

        function abbreviateHeather(colorName) {
            return window.PcpTextUtils.abbreviateHeather(colorName, "");
        }

        function normalizePrenda(prenda) {
            return window.PcpTextUtils.normalizePrenda(prenda, "");
        }

        function normalizeTipoCert(tipoCert) {
            return window.PcpTextUtils.normalizeTipoCert(tipoCert);
        }

        function normalizeRibStatus(value) {
            return String(value || "").toUpperCase().trim();
        }

        function escapeHtml(value) {
            return window.PcpTextUtils.escapeHtml(value);
        }

        function joinDash(left, right) {
            const a = String(left || "").trim();
            const b = String(right || "").trim();
            if (a && b) return a + "-" + b;
            return a || b || "";
        }

        function renderRutaBadge(row) {
            const rutaRaw = getVal(row, "rutaTela") || getVal(row, "ruta") || "";
            const rutaKey = String(rutaRaw).toUpperCase().trim();
            if (rutaKey === "ACABADA") {
                return '<span class="route-badge route-ac">AC</span>';
            }
            if (rutaKey === "LAVADA") {
                return '<span class="route-badge route-lv">LV</span>';
            }
            return escapeHtml(rutaRaw);
        }

        function getHabilitadoStatusValue(row) {
            const rutaTela = (getVal(row, "rutaTela") || getVal(row, "ruta") || "").toString().toUpperCase().trim();
            const estadoCorte = (getVal(row, "statusCorte") || getVal(row, "status") || getVal(row, "estadoCorte") || "").toString().toUpperCase().trim();
            const estadoBloqueo = (getVal(row, "estadoBloqueo") || "").toString().toUpperCase().trim();
            const estadoLavada = (getVal(row, "estadoLavada") || "").toString().toUpperCase().trim();
            const evNorm = (getVal(row, "estadoEnumerado") || "").toString().toUpperCase().trim();

            if (rutaTela === "ACABADA") {
                if (estadoCorte === "" || estadoCorte === "X PROG") return "x cortar";
                if (estadoCorte === "PROG" || estadoCorte === "PROG 1T" || estadoCorte === "PROG 2T" || estadoCorte === "PROG 3T") return "Proc Corte";
                if (estadoCorte === "OK") {
                    if (evNorm === "" || evNorm === "X PROG") return "x enm";
                    if (evNorm === "OK ENM" || evNorm === "OK PAQUETEO") return "x Hab";
                    return "x enm";
                }
            } else if (rutaTela === "LAVADA") {
                if (estadoBloqueo === "") return "x pedir";
                if (estadoBloqueo.indexOf("PROG") !== -1) return "x bloq";
                if (estadoBloqueo === "OK") {
                    if (estadoLavada !== "OK") return "x lavar";
                    if (estadoCorte === "" || estadoCorte === "X PROG") return "x cortar";
                    if (estadoCorte === "PROG" || estadoCorte === "PROG 1T" || estadoCorte === "PROG 2T" || estadoCorte === "PROG 3T") return "Proc Corte";
                    if (estadoCorte === "OK") {
                        if (evNorm === "OK ENM" || evNorm === "OK PAQUETEO") return "x Hab";
                        return "x enm";
                    }
                }
                return "x bloq";
            }

            return "";
        }

        function renderStatusCellHtml(statusValue) {
            const statusSafe = escapeHtml(statusValue || "");
            const statusUpper = String(statusValue || "").toUpperCase();

            if (statusUpper.indexOf("X CORTAR") !== -1) return '<span class="pill pill-pda">' + statusSafe + "</span>";
            if (statusUpper.indexOf("PROC CORTE") !== -1) return '<span class="pill pill-pza">' + statusSafe + "</span>";
            if (statusUpper.indexOf("X PEDIR") !== -1) return '<span class="pill pill-xpedir">' + statusSafe + "</span>";
            if (statusUpper.indexOf("X ENM") !== -1) return '<span class="pill pill-pda">' + statusSafe + "</span>";
            if (statusUpper.indexOf("X HAB") !== -1) return '<span class="pill pill-ok-dark">' + statusSafe + "</span>";
            if (statusUpper.indexOf("X BLOQ") !== -1) return '<span class="pill pill-pda">' + statusSafe + "</span>";
            if (statusUpper.indexOf("X LAVAR") !== -1) return '<span class="pill pill-pda">' + statusSafe + "</span>";
            return statusSafe;
        }

        function buildViewRows() {
            viewRows = [];
            if (!rawData || rawData.length <= 1) return;

            for (let i = 1; i < rawData.length; i++) {
                const row = rawData[i];
                const estadoRibNorm = normalizeRibStatus(getVal(row, "estadoRib"));
                if (!FILTER_RIB_VALUES.has(estadoRibNorm)) continue;
                viewRows.push({ rowIndex: i, row: row });
            }

            viewRows.sort(function(a, b) {
                const aOpPtda = joinDash(getVal(a.row, "opTela"), getVal(a.row, "partida"));
                const bOpPtda = joinDash(getVal(b.row, "opTela"), getVal(b.row, "partida"));
                const byOpPtda = aOpPtda.localeCompare(bOpPtda);
                if (byOpPtda !== 0) return byOpPtda;

                const aOc = joinDash(getVal(a.row, "op"), getVal(a.row, "corte"));
                const bOc = joinDash(getVal(b.row, "op"), getVal(b.row, "corte"));
                return aOc.localeCompare(bOc);
            });
        }

        function isRibDanger(ribValue) {
            const norm = normalizeRibStatus(ribValue);
            return norm === "NO PASO" || norm === "LAV(REP)";
        }

        function buildRibSelectHtml(rowIndex, row) {
            const ribOriginal = String(getVal(row, "rib") || "NO LLEVA").trim();
            const ribGuardado = String(getVal(row, "estadoRib") || "").trim();
            const ribValue = ribGuardado || (normalizeRibStatus(ribOriginal) === "NO LLEVA" ? "NO LLEVA" : "SI LLEVA");
            const disabled = normalizeRibStatus(ribOriginal) === "NO LLEVA";
            const dangerClass = isRibDanger(ribValue) ? " rib-danger" : "";

            if (disabled) {
                return '<select class="table-select" disabled><option value="NO LLEVA">NO LLEVA</option></select>';
            }

            const optionsHtml = RIB_OPTIONS.map(function(opt) {
                const selected = (opt === ribValue) ? " selected" : "";
                return '<option value="' + escapeHtml(opt) + '"' + selected + ">" + escapeHtml(opt) + "</option>";
            }).join("");

            return '<select class="table-select' + dangerClass + '" onchange="handleRibChange(' + rowIndex + ', this.value, this)">' + optionsHtml + "</select>";
        }

        function renderTable() {
            const tbody = document.getElementById("tbody-rib-status");
            tbody.innerHTML = "";

            let totalPds = 0;
            let lastOpPtda = null;
            let group = "a";

            if (!viewRows.length) {
                const tr = document.createElement("tr");
                tr.innerHTML = '<td class="empty-row" colspan="15">No hay filas con estado_rib = NO PASO o LAV(rep).</td>';
                tbody.appendChild(tr);
                document.getElementById("summary-pill").textContent = "Filas: 0 | PDS: 0";
                return;
            }

            viewRows.forEach(function(item) {
                const row = item.row;
                const rowIndex = item.rowIndex;

                const rsv = String(getVal(row, "rsv") || "").trim();
                const fGirado = formatDateCustom(getVal(row, "fGirado"));
                const hod = formatDateCustom(getVal(row, "hod"));
                const fIngCost = formatDateCustom(getVal(row, "fIngCost"));
                const statusValue = getHabilitadoStatusValue(row);
                const cliente = normalizeClientName(getVal(row, "cliente"));
                const color = abbreviateHeather(getVal(row, "color"));
                const opPtda = joinDash(getVal(row, "opTela"), getVal(row, "partida"));
                const oc = joinDash(getVal(row, "op"), getVal(row, "corte"));
                const pdsRaw = parseFloat(getVal(row, "pds")) || 0;
                const pds = formatThousands(pdsRaw, 0);
                const prenda = normalizePrenda(getVal(row, "prenda"));
                const articulo = String(getVal(row, "articulo") || "").trim();
                const tipoCert = normalizeTipoCert(getVal(row, "tipoCert"));
                const ribSelect = buildRibSelectHtml(rowIndex, row);

                totalPds += pdsRaw;

                if (lastOpPtda !== null && opPtda !== lastOpPtda) {
                    group = (group === "a") ? "b" : "a";
                }
                lastOpPtda = opPtda;

                const tr = document.createElement("tr");
                tr.className = "group-" + group;
                tr.setAttribute("data-row-index", rowIndex);
                tr.innerHTML = ""
                    + "<td title=\"" + escapeHtml(rsv) + "\">" + escapeHtml(rsv) + "</td>"
                    + "<td title=\"" + escapeHtml(fGirado) + "\">" + escapeHtml(fGirado) + "</td>"
                    + "<td title=\"" + escapeHtml(hod) + "\">" + escapeHtml(hod) + "</td>"
                    + "<td title=\"" + escapeHtml(fIngCost) + "\">" + escapeHtml(fIngCost) + "</td>"
                    + "<td title=\"" + escapeHtml(statusValue) + "\">" + renderStatusCellHtml(statusValue) + "</td>"
                    + "<td title=\"" + escapeHtml(cliente) + "\">" + escapeHtml(cliente) + "</td>"
                    + "<td title=\"" + escapeHtml(String(getVal(row, "rutaTela") || getVal(row, "ruta") || "")) + "\">" + renderRutaBadge(row) + "</td>"
                    + "<td title=\"" + escapeHtml(oc) + "\">" + escapeHtml(oc) + "</td>"
                    + "<td title=\"" + escapeHtml(color) + "\">" + escapeHtml(color) + "</td>"
                    + "<td class=\"wrap\" title=\"" + escapeHtml(opPtda) + "\">" + escapeHtml(opPtda) + "</td>"
                    + "<td class=\"right\" title=\"" + escapeHtml(pds) + "\">" + escapeHtml(pds) + "</td>"
                    + "<td title=\"" + escapeHtml(prenda) + "\">" + escapeHtml(prenda) + "</td>"
                    + "<td title=\"" + escapeHtml(articulo) + "\">" + escapeHtml(articulo) + "</td>"
                    + "<td title=\"" + escapeHtml(tipoCert) + "\">" + escapeHtml(tipoCert) + "</td>"
                    + "<td>" + ribSelect + "</td>";

                tbody.appendChild(tr);
            });

            document.getElementById("summary-pill").textContent = "Filas: " + viewRows.length + " | PDS: " + formatThousands(totalPds, 0);
        }

        async function handleRibChange(rowIndex, newValue, selectEl) {
            const row = rawData[rowIndex];
            if (!row) return;

            const estadoRibIdx = colMap.estadoRib;
            const prevValue = (estadoRibIdx !== -1) ? String(row[estadoRibIdx] || "") : "";

            selectEl.disabled = true;
            setStatus("Guardando cambio...", "");

            try {
                const result = await window.PcpProgramaService.actualizarCampoConOrigen(
                    rowIndex,
                    getHeaderNameForKey("estadoRib", "estado_rib"),
                    newValue,
                    {
                    sourceOp: getVal(row, "op"),
                    sourceCorte: getVal(row, "corte"),
                    sourceOpTela: getVal(row, "opTela"),
                    sourcePartida: getVal(row, "partida"),
                    sourceColor: getVal(row, "color")
                    }
                );

                if (!result || result.result !== "success") {
                    const msg = (result && result.message) ? result.message : "No se pudo actualizar estado_rib.";
                    throw new Error(msg);
                }

                if (estadoRibIdx !== -1) {
                    rawData[rowIndex][estadoRibIdx] = newValue;
                }

                buildViewRows();
                renderTable();
                setStatus("Cambio guardado correctamente.", "ok");
            } catch (err) {
                if (estadoRibIdx !== -1) {
                    rawData[rowIndex][estadoRibIdx] = prevValue;
                }
                try { selectEl.value = prevValue; } catch (e) {}
                setStatus("Error al guardar: " + (err && err.message ? err.message : String(err)), "error");
                console.error(err);
            } finally {
                selectEl.disabled = false;
            }
        }

        function setStatus(text, tone) {
            const el = document.getElementById("status-msg");
            el.textContent = text || "";
            el.className = "";
            if (tone === "ok") el.classList.add("ok");
            if (tone === "error") el.classList.add("error");
        }

        function toggleLoader(show) {
            const el = document.getElementById("loader");
            el.style.display = show ? "flex" : "none";
        }

        function toggleError(message) {
            const el = document.getElementById("error-screen");
            if (!message) {
                el.style.display = "none";
                return;
            }
            document.getElementById("error-details").textContent = message;
            el.style.display = "flex";
        }

        function showFatalError(message) {
            toggleLoader(false);
            toggleError(message || "Error no controlado.");
            setStatus("", "");
        }
    
