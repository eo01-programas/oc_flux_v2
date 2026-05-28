
        // ============================================================
        //  CONFIGURACIÓN
        // ============================================================
        const SHEET_ID = window.PCP_CONFIG.SHEET_ID;
        let rawData = [];
        let colMap = {};
        let processedRows = [];   // filas procesadas para renderizar
        let filteredRows = [];    // filas después de filtros
        let currentSort = { col: 'oc', asc: true };
        let selectedYear = '';
        let selectedMonth = '';
        let selectedCliente = '';
        let selectedFecha = '';
        let filterSinFecha = false;
        let editingRowData = null;
        // ============================================================
        //  INICIALIZACIÓN
        // ============================================================
        document.addEventListener('DOMContentLoaded', function() {
            window.PcpGoogleSheets.loadGvizJsonp({
                spreadsheetId: SHEET_ID,
                label: 'tabla-dinamica',
                callbackPrefix: 'loadDataCallback',
                cacheBust: false,
                errorMessage: "Error de conexión con Google Sheets."
            }).then(function(jsonResponse) {
                if (typeof window.loadDataCallback === 'function') {
                    window.loadDataCallback(jsonResponse);
                }
            }).catch(function(error) {
                showError(error && error.message ? error.message : "Error de conexión con Google Sheets.");
            });
        });

        window.loadDataCallback = function(jsonResponse) {
            try {
                if (!jsonResponse || !jsonResponse.table) throw new Error("Datos inválidos.");

                const rowsRaw = jsonResponse.table.rows.map(r => r.c.map(cell => (cell && cell.v !== null) ? cell.v : ""));
                const gvizHeaders = jsonResponse.table.cols.map(col => col.label || col.id);

                let headerRowIndex = -1;
                if (gvizHeaders.includes("OP TELA")) {
                    rawData = [gvizHeaders, ...rowsRaw];
                } else {
                    for (let i = 0; i < rowsRaw.length; i++) {
                        if (rowsRaw[i].includes("OP TELA")) { headerRowIndex = i; break; }
                    }
                    if (headerRowIndex !== -1) {
                        rawData = rowsRaw.slice(headerRowIndex);
                    } else {
                        rawData = [gvizHeaders, ...rowsRaw];
                    }
                }

                // Limpiar headers
                if (rawData.length > 0) rawData[0] = rawData[0].map(h => h ? h.toString().trim() : "");

                mapColumns();
                buildProcessedRows();
                populateDespachoChips();
                updateFechaDropdown();
                applyFilters();
                document.getElementById('loader').style.display = 'none';
            } catch (error) {
                console.error(error);
                showError("Error procesando datos: " + error.message);
            }
        };

        function showError(msg) {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('error-screen').style.display = 'flex';
            document.getElementById('error-details').innerText = msg;
        }

        // ============================================================
        //  MAPEO DE COLUMNAS
        // ============================================================
        function getColIndex(name) {
            if (!rawData || rawData.length === 0) return -1;
            const headers = rawData[0];
            const target = name.toLowerCase().trim();
            return headers.findIndex(h => h.toLowerCase().trim() === target);
        }

        function findHeaderIndexCaseInsensitive(name) {
            if (!rawData || rawData.length === 0) return -1;
            const headers = rawData[0];
            const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const target = norm(name);
            for (let i = 0; i < headers.length; i++) {
                if (norm(headers[i]) === target) return i;
            }
            return -1;
        }

        function mapColumns() {
            if (!rawData || rawData.length === 0) return;
            colMap = {};
            const knownColumns = [
                "HOD", "F.ING.COST", "CLIENTE", "OP TELA", "PARTIDA",
                "OP", "CORTE", "COLOR", "KG GIRADOS", "PDS GIRADAS", "ARTÍCULO",
                "NRO. MOLDE", "TIPO CERTIFICADO", "estado_bloqueo", "estado_rib",
                "estado_lavada", "RUTA TELA", "ESTILO", "PRENDA", "F. GIRADO", "RIB",
                "STATUS_CORTE", "STATUS", "status", "ESTADO CORTE", "ESTADO_CORTE", "estado_corte",
                "estado_enumerado", "ESTADO_ENUMERADO",
                "estado_habilitado", "ESTADO_HABILITADO",
                "RSV"
            ];
            knownColumns.forEach(col => {
                const idx = getColIndex(col);
                if (idx !== -1) colMap[col] = idx;
            });

            // Mapear F. DESPACHO -> HOD
            try {
                const idxFDesp = findHeaderIndexCaseInsensitive('F. DESPACHO');
                if (idxFDesp !== -1) {
                    colMap['HOD'] = idxFDesp;
                    colMap['F. DESPACHO'] = idxFDesp;
                }
            } catch(e) {}
        }

        function getVal(row, colName) {
            if (!colName) return "";
            let idx = colMap[colName];
            if (idx !== undefined && idx !== -1) return row[idx] || "";
            const variants = [
                colName, colName.toLowerCase(), colName.toUpperCase(),
                colName.replace(/[^a-zA-Z0-9]/g, ''),
                colName.toLowerCase().replace(/[^a-z0-9]/g, ''),
                colName.toUpperCase().replace(/[^A-Z0-9]/g, '')
            ];
            for (let k of variants) {
                idx = colMap[k];
                if (idx !== undefined && idx !== -1) return row[idx] || "";
            }
            try {
                const found = findHeaderIndexCaseInsensitive(colName);
                if (found !== -1) return row[found] || "";
            } catch (e) {}
            return "";
        }

        // ============================================================
        //  UTILIDADES
        // ============================================================
        function formatDateCustom(val) {
            const mesesEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            if (typeof val === 'string' && val.includes('Date(')) {
                const match = val.match(/Date\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?\)/);
                if (match) {
                    const year = String(match[1]).slice(-2);
                    const month = parseInt(match[2]);
                    const day = String(match[3]).padStart(2, '0');
                    return `${day}/${mesesEs[month]}/${year}`;
                }
            }
            if (val instanceof Date && !isNaN(val.getTime())) {
                const day = String(val.getDate()).padStart(2, '0');
                const month = mesesEs[val.getMonth()];
                const year = String(val.getFullYear()).slice(-2);
                return `${day}/${month}/${year}`;
            }
            if (typeof val === 'number' && val > 30000) {
                const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                const day = String(date.getDate()).padStart(2, '0');
                const month = mesesEs[date.getMonth()];
                const year = String(date.getFullYear()).slice(-2);
                return `${day}/${month}/${year}`;
            }
            return val;
        }

        function formatValue(val, type) {
            if (type === 'date') return formatDateCustom(val);
            return val;
        }

        function formatThousands(val, decimals = 0) {
            if (val === null || val === undefined || isNaN(val)) return val;
            if (decimals > 0) return Number(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
            return Math.round(val).toLocaleString('en-US');
        }

        function parseDisplayDateToDate(dateStr) {
            if (!dateStr) return null;
            const mesesMap = {'ene':0,'feb':1,'mar':2,'abr':3,'may':4,'jun':5,'jul':6,'ago':7,'sep':8,'oct':9,'nov':10,'dic':11};
            const parts = String(dateStr).trim().split('/');
            if (parts.length !== 3) return null;
            const day = parseInt(parts[0], 10);
            const month = mesesMap[String(parts[1]).toLowerCase()];
            let year = parseInt(parts[2], 10);
            if (Number.isNaN(day) || month === undefined || Number.isNaN(year)) return null;
            if (year < 100) year += 2000;
            return new Date(year, month, day);
        }

        function getDaysSinceDisplayDate(dateStr) {
            const sourceDate = parseDisplayDateToDate(dateStr);
            if (!sourceDate) return '';
            const today = new Date();
            const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const localSource = new Date(sourceDate.getFullYear(), sourceDate.getMonth(), sourceDate.getDate());
            const diffMs = localToday.getTime() - localSource.getTime();
            return Math.floor(diffMs / 86400000);
        }

        function getDaysPillHtml(daysValue) {
            if (daysValue === '' || daysValue === null || daysValue === undefined || isNaN(daysValue)) return '';
            const days = parseInt(daysValue, 10);
            if (days <= 7) return `<span class="pill pill-days-blue">${days}</span>`;
            if (days <= 10) return `<span class="pill pill-days-green">${days}</span>`;
            return `<span class="pill pill-days-red">${days}</span>`;
        }

        function getDaysDiffBetweenDisplayDates(startDateStr, endDateStr) {
            const startDate = parseDisplayDateToDate(startDateStr);
            const endDate = parseDisplayDateToDate(endDateStr);
            if (!startDate || !endDate) return '';
            const localStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const localEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
            return Math.floor((localStart.getTime() - localEnd.getTime()) / 86400000);
        }

        function escapeHtmlAttr(value) {
            return window.PcpTextUtils.escapeHtmlAttr(value);
        }

        function normalizeTooltipLine(label, value) {
            const text = String(value === null || value === undefined ? '' : value).trim();
            if (!text) return '';
            if (normalizeUpperText(text) === 'NO LLEVA') return '';
            return `${label}: ${text}`;
        }

        function buildRibTooltipText(r) {
            const rawRow = (rawData && rawData[r._rawIndex]) ? rawData[r._rawIndex] : null;
            if (!rawRow) return '';

            const lines = [];
            const tipoBordado = getVal(rawRow, 'tipo-bordado') || getVal(rawRow, 'tipo bordado');
            const nBd = getVal(rawRow, 'n.BDxpda') || getVal(rawRow, 'n bdxpda');
            const tipoTransfer = getVal(rawRow, 'tipo-transfer') || getVal(rawRow, 'tipo transfer');
            const nTransfer = getVal(rawRow, 'n.transfxpda') || getVal(rawRow, 'n transfxpda');
            const nEstamp = getVal(rawRow, 'n.ESTAMPxpda') || getVal(rawRow, 'n estampxpda');

            const line1 = normalizeTooltipLine('Bordado', tipoBordado);
            const line2 = normalizeTooltipLine('#bordados', nBd);
            const line3 = normalizeTooltipLine('Transfer', tipoTransfer);
            const line4 = normalizeTooltipLine('#transfer', nTransfer);
            const line5 = normalizeTooltipLine('Estampado', nEstamp);

            if (line1) lines.push(line1);
            if (line2) lines.push(line2);
            if (line3) lines.push(line3);
            if (line4) lines.push(line4);
            if (line5) lines.push(line5);

            const diffCorteGirado = getDaysDiffBetweenDisplayDates(r.fCorte, r.fGirado);
            if (diffCorteGirado !== '') {
                lines.push(`FECHA CORTE - F.GIRADO: ${diffCorteGirado}`);
            }

            return lines.join('\n');
        }

        function normalizeClientName(clientName) {
            if (!clientName) return "";
            const name = clientName.toString().toUpperCase();
            if (name.includes("LACOSTE")) return "LAC";
            if (name.includes("ATHLETA, INC.")) return "ATH";
            if (name.includes("BANANA REPUBLIC, LLC")) return "BNN";
            if (name.includes("THEORY LLC,")) return "THE";
            if (name.includes("DISH & DUER")) return "DDU";
            if (name.includes("SKECHERS PERFORMANCE")) return "SKE";
            if (name.includes("LULULEMON ATHLETICA CANADA INC")) return "LLL";
            if (name.includes("AM RETAIL S.A.C.")) return "AMR";
            if (name.includes("ALLBIRDS")) return "ALLB";
            return clientName;
        }

        function abbreviateHeather(colorName) {
            return window.PcpTextUtils.abbreviateHeather(colorName, colorName);
        }

        function normalizeUpperText(value) {
            return (value || '').toString().toUpperCase().trim();
        }

        function ribDisplayText(ribValue, estadoRibValue) {
            const ribUpper = normalizeUpperText(ribValue);
            const estadoRib = (estadoRibValue || '').toString().trim();

            if (ribUpper === 'NO LLEVA') return 'No lleva';
            if (ribUpper === 'SI LLEVA') return estadoRib || 'Sin estado';
            return (ribValue || '').toString().trim();
        }

        function ribPillHtml(ribValue, estadoRibValue) {
            const ribUpper = normalizeUpperText(ribValue);
            const estadoUpper = normalizeUpperText(estadoRibValue);
            const estadoText = (estadoRibValue || '').toString().trim();

            if (ribUpper === 'NO LLEVA') {
                return `<span class="pill pill-rib-nolleva">No lleva</span>`;
            }

            if (ribUpper === 'SI LLEVA') {
                if (!estadoText) {
                    return `<span class="pill pill-rib-neutral">Sin estado</span>`;
                }
                if (estadoUpper.includes('NO PASO')) {
                    return `<span class="pill pill-rib-nopaso">${estadoText}</span>`;
                }
                if (estadoUpper.includes('LAV(REP)') || estadoUpper.includes('LAV REP')) {
                    return `<span class="pill pill-rib-lavrep">${estadoText}</span>`;
                }
                if (estadoUpper.includes('EN CORTE')) {
                    return `<span class="pill pill-rib-corte">${estadoText}</span>`;
                }
                if (estadoUpper.includes('EN LAV')) {
                    return `<span class="pill pill-rib-lav">${estadoText}</span>`;
                }
                if (estadoUpper.includes('EN HAB')) {
                    return `<span class="pill pill-rib-hab">${estadoText}</span>`;
                }
                return `<span class="pill pill-rib-neutral">${estadoText}</span>`;
            }

            if (ribUpper) {
                return `<span class="pill pill-rib-neutral">${(ribValue || '').toString().trim()}</span>`;
            }

            return '';
        }

        function getOcGroupKey(ocValue) {
            const oc = (ocValue || '').toString().trim();
            if (!oc) return '';
            const parts = oc.split('-');
            const prefix = (parts[0] || oc).trim();
            const suffix = (parts[1] || '').trim();
            if (!suffix) return prefix;

            // Agrupa por familia de OC:
            // - sufijos de 3 o menos dígitos: usa el primer dígito
            // - sufijos mayores: usa los primeros 3 dígitos
            // Ej.: 401-404 -> 4, 201-203 -> 2, 12804-12805 -> 128
            const suffixKey = suffix.length > 3 ? suffix.slice(0, 3) : suffix.slice(0, 1);
            return `${prefix}-${suffixKey}`;
        }

        // ============================================================
        //  STATUS – misma lógica que vista "Habilitado" en index.html
        // ============================================================
        function computeStatus(row) {
            const rutaTela = (getVal(row, 'RUTA TELA') || getVal(row, 'RUTA_TELA') || '').toString().toUpperCase().trim();
            const estadoCorte = (getVal(row, 'estado_corte') || getVal(row, 'ESTADO_CORTE') || getVal(row, 'STATUS_CORTE') || getVal(row, 'STATUS') || '').toString().toUpperCase().trim();
            const estadoBloqueo = (getVal(row, 'estado_bloqueo') || getVal(row, 'ESTADO_BLOQUEO') || '').toString().toUpperCase().trim();
            const estadoLavada = (getVal(row, 'estado_lavada') || getVal(row, 'ESTADO_LAVADA') || '').toString().toUpperCase().trim();

            let ev = '';
            try {
                const idxEv = findHeaderIndexCaseInsensitive('estado_enumerado');
                if (idxEv !== -1 && row[idxEv] !== undefined) ev = row[idxEv];
                else ev = getVal(row, 'estado_enumerado') || '';
            } catch(e) { ev = getVal(row, 'estado_enumerado') || ''; }
            const evNorm = (ev || '').toString().toUpperCase().trim();

            if (rutaTela === 'ACABADA') {
                // ACABADA no se bloquea → nunca mostrar "x bloq"
                if (estadoCorte === '' || estadoCorte === 'X PROG') return 'x cortar';
                if (estadoCorte === 'PROG' || estadoCorte === 'PROG 1T' || estadoCorte === 'PROG 2T' || estadoCorte === 'PROG 3T') return 'Proc Corte';
                if (estadoCorte === 'OK') {
                    if (evNorm === '' || evNorm === 'X PROG') return 'x enm';
                    if (evNorm === 'OK ENM' || evNorm === 'OK PAQUETEO') return 'x Hab';
                    return 'x enm';
                }
            } else if (rutaTela === 'LAVADA') {
                if (estadoBloqueo === '') return 'x pedir';
                if (estadoBloqueo === 'X PROG') return 'x bloq';
                if (estadoBloqueo === 'PROG') return 'x Bloq';
                if (estadoBloqueo === 'OK') {
                    if (estadoLavada !== 'OK') return 'x lavar';
                    // estado_lavada = OK
                    if (estadoCorte === '' || estadoCorte === 'X PROG') return 'x cortar';
                    if (estadoCorte === 'PROG 1T' || estadoCorte === 'PROG 2T' || estadoCorte === 'PROG 3T') return 'Proc Corte';
                    if (estadoCorte === 'OK') {
                        if (evNorm === 'OK ENM' || evNorm === 'OK PAQUETEO') return 'x Hab';
                        return 'x enm';
                    }
                }
            }
            return '';
        }

        function statusPillHtml(statusValue) {
            const s = (statusValue || '').toUpperCase();
            if (s.includes('X PEDIR'))    return `<span class="pill pill-xpedir">${statusValue}</span>`;
            if (s.includes('X CORTAR'))   return `<span class="pill pill-xcortar">${statusValue}</span>`;
            if (s.includes('PROC CORTE')) return `<span class="pill pill-proccorte">${statusValue}</span>`;
            if (s.includes('X ENM'))      return `<span class="pill pill-xenm">${statusValue}</span>`;
            if (s.includes('X HAB'))      return `<span class="pill pill-xhab">${statusValue}</span>`;
            if (s.includes('X BLOQ'))     return `<span class="pill pill-xbloq">${statusValue}</span>`;
            if (s.includes('X LAVAR'))    return `<span class="pill pill-xlavar">${statusValue}</span>`;
            return statusValue;
        }

        // ============================================================
        //  PROCESAR FILAS
        // ============================================================
        function buildProcessedRows() {
            processedRows = [];
            if (!rawData || rawData.length <= 1) return;

            for (let i = 1; i < rawData.length; i++) {
                const row = rawData[i];
                const op = getVal(row, 'OP') || '';
                const corte = getVal(row, 'CORTE') || '';
                if (!op && !corte) continue; // saltear filas vacías

                const oc = (op || corte) ? `${op}-${corte}` : '';
                const pds = parseFloat(getVal(row, 'PDS GIRADAS')) || 0;

                // estado_corte: PDS GIRADAS cuyo estado_corte sea diferente a OK
                const estadoCorteRaw = (getVal(row, 'estado_corte') || getVal(row, 'ESTADO_CORTE') || getVal(row, 'STATUS_CORTE') || getVal(row, 'STATUS') || '').toString().toUpperCase().trim();
                const qtyXCortar = (estadoCorteRaw !== 'OK') ? pds : 0;

                // estado_habilitado: PDS GIRADAS cuyo estado_habilitado sea diferente a OK
                const estadoHabRaw = (getVal(row, 'estado_habilitado') || getVal(row, 'ESTADO_HABILITADO') || '').toString().toUpperCase().trim();
                if (estadoHabRaw === 'DEPURADO') continue; // no mostrar filas depuradas en ninguna tabla
                const qtyXIngresar = (estadoHabRaw !== 'OK') ? pds : 0;

                const fDespacho = formatValue(getVal(row, 'HOD'), 'date') || '';
                const fGirado = formatValue(getVal(row, 'F. GIRADO'), 'date') || '';
                const diasGirado = getDaysSinceDisplayDate(fGirado);
                const fCorte = formatValue(getVal(row, 'FECHA CORTE') || getVal(row, 'F. CORTE') || getVal(row, 'F.CORTE'), 'date') || '';
                const fIngCost = formatValue(getVal(row, 'F.ING.COST'), 'date') || '';
                const rsv = String(getVal(row, 'RSV') || '').trim();
                const cliente = normalizeClientName(getVal(row, 'CLIENTE'));
                const estilo = getVal(row, 'ESTILO') || '';
                const color = abbreviateHeather(getVal(row, 'COLOR')) || '';
                const rutaTela = (getVal(row, 'RUTA TELA') || '').toString().trim();
                const ribRaw = (getVal(row, 'RIB') || '').toString().trim();
                const estadoRib = (getVal(row, 'estado_rib') || '').toString().trim();
                const rib = ribDisplayText(ribRaw, estadoRib);
                const status = computeStatus(row);
                const planta = (getVal(row, 'PLANTA') || '').toString().trim();
                const linea = (getVal(row, 'LINEA') || '').toString().trim();

                processedRows.push({
                    fDespacho, diasGirado, fGirado, fCorte, fIngCost, rsv, cliente, estilo, oc, color,
                    rutaTela, rib, _ribRaw: ribRaw, estadoRib, status, planta, linea, qtyXCortar, qtyXIngresar,
                    _rawIndex: i, // índice en rawData para enviar al GAS
                    // para ordenar por fecha (valor numérico/raw)
                    _fDespachoRaw: getVal(row, 'HOD'),
                    _fGiradoRaw: getVal(row, 'F. GIRADO'),
                    _fIngCostRaw: getVal(row, 'F.ING.COST'),
                    _clienteRaw: getVal(row, 'CLIENTE')
                });
            }
        }

        // ============================================================
        //  FILTROS
        // ============================================================

        function applyFilters() {
            const search = (document.getElementById('search-input').value || '').trim().toUpperCase();
            const statusFilter = document.getElementById('filter-status').value;
            const rutaFilter = document.getElementById('filter-ruta').value;

            filteredRows = processedRows.filter(r => {
                // Ocultar filas donde ambas QTY son 0
                if (r.qtyXCortar === 0 && r.qtyXIngresar === 0) return false;
                // Filtro S/Fecha: solo mostrar las que NO tienen F.DESPACHO
                if (filterSinFecha) {
                    if (r.fDespacho && r.fDespacho.toString().trim() !== '') return false;
                }
                // Chip: Año
                if (selectedYear) {
                    const yy = extractYear(r.fDespacho);
                    if (yy !== selectedYear) return false;
                }
                // Chip: Mes
                if (selectedMonth) {
                    const mm = extractMonth(r.fDespacho);
                    if (mm !== selectedMonth) return false;
                }
                // Chip: Cliente
                if (selectedCliente) {
                    if (r.cliente !== selectedCliente) return false;
                }
                // Dropdown: Fecha exacta
                if (selectedFecha) {
                    if (r.fDespacho !== selectedFecha) return false;
                }
                // Texto libre
                if (search) {
                    const haystack = [r.cliente, r.estilo, r.oc, r.color, r.rsv, r.rib, r.status, r.planta, r.linea, r.rutaTela, r.estadoRib, r.fDespacho, r.fGirado, r.fCorte].join('|').toUpperCase();
                    if (!haystack.includes(search)) return false;
                }
                // Status
                if (statusFilter) {
                    if (r.status.toUpperCase().replace(/\s+/g, ' ').trim() !== statusFilter.toUpperCase().replace(/\s+/g, ' ').trim()) return false;
                }
                // Ruta
                if (rutaFilter) {
                    if (r.rutaTela.toUpperCase() !== rutaFilter) return false;
                }
                return true;
            });

            // Re-aplicar orden
            if (currentSort.col) sortArray(filteredRows, currentSort.col, currentSort.asc);

            updateFechaDropdown();
            updateClienteChips();
            renderTable();
        }

        function clearFilters() {
            document.getElementById('search-input').value = '';
            document.getElementById('filter-status').value = '';
            document.getElementById('filter-ruta').value = '';
            // Reset año y mes al actual
            const now = new Date();
            const currentYY = String(now.getFullYear()).slice(-2);
            const currentMes = MESES_NAMES[now.getMonth()];
            selectedYear = currentYY;
            selectedMonth = currentMes;
            selectedCliente = '';
            selectedFecha = '';
            filterSinFecha = false;
            currentSort = { col: 'oc', asc: true };
            // Reset chip active states
            document.querySelectorAll('#chip-year-bar .chip-btn').forEach(b => b.classList.toggle('active', b.dataset.value === currentYY));
            document.querySelectorAll('#chip-month-bar .chip-btn').forEach(b => b.classList.toggle('active', b.dataset.value === currentMes));
            document.querySelectorAll('#chip-cliente-bar .chip-btn').forEach(b => b.classList.toggle('active', b.dataset.value === ''));
            document.getElementById('filter-fecha').value = '';
            document.getElementById('btn-sfecha').classList.remove('active');
            applyFilters();
        }

        // ============================================================
        //  CHIP FILTERS – Año / Mes de F.DESPACHO
        // ============================================================
        const MESES_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

        // Extrae año (2 dígitos) de un string tipo "04/Nov/25" → "25"
        function extractYear(dateStr) {
            if (!dateStr) return '';
            const parts = String(dateStr).split('/');
            if (parts.length === 3) return parts[2].trim();
            return '';
        }

        // Extrae mes abreviado de un string tipo "04/Nov/25" → "Nov"
        function extractMonth(dateStr) {
            if (!dateStr) return '';
            const parts = String(dateStr).split('/');
            if (parts.length === 3) return parts[1].trim();
            return '';
        }

        function populateDespachoChips() {
            const now = new Date();
            const currentYY = String(now.getFullYear()).slice(-2);
            const currentMes = MESES_NAMES[now.getMonth()];

            // Defaults
            selectedYear = currentYY;
            selectedMonth = currentMes;

            const years = new Set();
            const months = new Set();
            const clients = new Set();
            processedRows.forEach(r => {
                const y = extractYear(r.fDespacho);
                const m = extractMonth(r.fDespacho);
                if (y) years.add(y);
                if (m) months.add(m);
                if (r.cliente) clients.add(r.cliente);
            });

            // Año chips (sin "Todos")
            const yearBar = document.getElementById('chip-year-bar');
            const sortedYears = [...years].sort();
            sortedYears.forEach(y => {
                const btn = document.createElement('button');
                btn.className = 'chip-btn' + (y === currentYY ? ' active' : '');
                btn.dataset.value = y;
                btn.textContent = '20' + y;
                btn.onclick = function() { selectYear(this, y); };
                yearBar.appendChild(btn);
            });

            // Mes chips – orden calendario
            const monthBar = document.getElementById('chip-month-bar');
            const btnTodosMes = document.createElement('button');
            btnTodosMes.className = 'chip-btn';
            btnTodosMes.dataset.value = '';
            btnTodosMes.textContent = 'Todos';
            btnTodosMes.onclick = function() { selectMonth(this, ''); };
            monthBar.appendChild(btnTodosMes);
            const sortedMonths = MESES_NAMES.filter(m => months.has(m));
            sortedMonths.forEach(m => {
                const btn = document.createElement('button');
                btn.className = 'chip-btn' + (m === currentMes ? ' active' : '');
                btn.dataset.value = m;
                btn.textContent = m;
                btn.onclick = function() { selectMonth(this, m); };
                monthBar.appendChild(btn);
            });

            updateClienteChips();
        }

        function selectYear(btn, value) {
            selectedYear = value;
            filterSinFecha = false;
            document.getElementById('btn-sfecha').classList.remove('active');
            document.querySelectorAll('#chip-year-bar .chip-btn:not(.chip-sfecha)').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateFechaDropdown();
            updateClienteChips();
            applyFilters();
        }

        function selectCliente(btn, value) {
            selectedCliente = value;
            document.querySelectorAll('#chip-cliente-bar .chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateFechaDropdown();
            updateClienteChips();
            applyFilters();
        }

        function toggleSinFecha(btn) {
            filterSinFecha = !filterSinFecha;
            btn.classList.toggle('active', filterSinFecha);
            if (filterSinFecha) {
                // Desactivar chips de año/mes/fecha
                document.querySelectorAll('#chip-year-bar .chip-btn:not(.chip-sfecha)').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('#chip-month-bar .chip-btn').forEach(b => b.classList.remove('active'));
                selectedYear = '';
                selectedMonth = '';
                selectedFecha = '';
                document.getElementById('filter-fecha').value = '';
            } else {
                // Restaurar año y mes actual
                const now = new Date();
                const currentYY = String(now.getFullYear()).slice(-2);
                const currentMes = MESES_NAMES[now.getMonth()];
                selectedYear = currentYY;
                selectedMonth = currentMes;
                document.querySelectorAll('#chip-year-bar .chip-btn:not(.chip-sfecha)').forEach(b => b.classList.toggle('active', b.dataset.value === currentYY));
                document.querySelectorAll('#chip-month-bar .chip-btn').forEach(b => b.classList.toggle('active', b.dataset.value === currentMes));
                updateFechaDropdown();
            }
            applyFilters();
        }

        function selectMonth(btn, value) {
            selectedMonth = value;
            document.querySelectorAll('#chip-month-bar .chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateFechaDropdown();
            updateClienteChips();
            applyFilters();
        }

        function selectFecha(value) {
            selectedFecha = value;
            applyFilters();
        }

        // Actualiza el dropdown de fechas según año, mes y cliente seleccionados
        function updateFechaDropdown() {
            const sel = document.getElementById('filter-fecha');
            sel.innerHTML = '<option value="">Todas</option>';

            const search = (document.getElementById('search-input').value || '').trim().toUpperCase();
            const statusFilter = document.getElementById('filter-status').value;
            const rutaFilter = document.getElementById('filter-ruta').value;
            const fechas = new Set();
            processedRows.forEach(r => {
                if (r.qtyXCortar === 0 && r.qtyXIngresar === 0) return;
                if (filterSinFecha) {
                    if (r.fDespacho && r.fDespacho.toString().trim() !== '') return;
                }
                if (selectedYear && extractYear(r.fDespacho) !== selectedYear) return;
                if (selectedMonth && extractMonth(r.fDespacho) !== selectedMonth) return;
                if (selectedCliente && r.cliente !== selectedCliente) return;
                if (search) {
                    const haystack = [r.cliente, r.estilo, r.oc, r.color, r.rsv, r.rib, r.status, r.planta, r.linea, r.rutaTela, r.estadoRib, r.fDespacho, r.fGirado, r.fCorte].join('|').toUpperCase();
                    if (!haystack.includes(search)) return;
                }
                if (statusFilter) {
                    if (r.status.toUpperCase().replace(/\s+/g, ' ').trim() !== statusFilter.toUpperCase().replace(/\s+/g, ' ').trim()) return;
                }
                if (rutaFilter) {
                    if (r.rutaTela.toUpperCase() !== rutaFilter) return;
                }
                if (r.fDespacho) fechas.add(r.fDespacho);
            });

            // Ordenar fechas cronológicamente (dd/Mes/yy)
            const mesesIdx = {};
            MESES_NAMES.forEach((m, i) => { mesesIdx[m.toLowerCase()] = i; });
            const sorted = [...fechas].sort((a, b) => {
                const pa = a.split('/'), pb = b.split('/');
                const ya = parseInt(pa[2]) || 0, yb = parseInt(pb[2]) || 0;
                if (ya !== yb) return ya - yb;
                const ma = mesesIdx[(pa[1] || '').toLowerCase()] || 0;
                const mb = mesesIdx[(pb[1] || '').toLowerCase()] || 0;
                if (ma !== mb) return ma - mb;
                return (parseInt(pa[0]) || 0) - (parseInt(pb[0]) || 0);
            });

            sorted.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f; opt.textContent = f;
                sel.appendChild(opt);
            });

            if (selectedFecha && !sorted.includes(selectedFecha)) {
                selectedFecha = '';
            }
            sel.value = selectedFecha || '';
        }

        function updateClienteChips() {
            const clienteBar = document.getElementById('chip-cliente-bar');
            if (!clienteBar) return;

            const currentSelected = selectedCliente;
            const search = (document.getElementById('search-input').value || '').trim().toUpperCase();
            const statusFilter = document.getElementById('filter-status').value;
            const rutaFilter = document.getElementById('filter-ruta').value;
            const clients = new Set();
            processedRows.forEach(r => {
                if (r.qtyXCortar === 0 && r.qtyXIngresar === 0) return;
                if (filterSinFecha) {
                    if (r.fDespacho && r.fDespacho.toString().trim() !== '') return;
                }
                if (selectedYear && extractYear(r.fDespacho) !== selectedYear) return;
                if (selectedMonth && extractMonth(r.fDespacho) !== selectedMonth) return;
                if (selectedFecha && r.fDespacho !== selectedFecha) return;
                if (search) {
                    const haystack = [r.cliente, r.estilo, r.oc, r.color, r.rsv, r.rib, r.status, r.planta, r.linea, r.rutaTela, r.estadoRib, r.fDespacho, r.fGirado, r.fCorte].join('|').toUpperCase();
                    if (!haystack.includes(search)) return;
                }
                if (statusFilter) {
                    if (r.status.toUpperCase().replace(/\s+/g, ' ').trim() !== statusFilter.toUpperCase().replace(/\s+/g, ' ').trim()) return;
                }
                if (rutaFilter) {
                    if (r.rutaTela.toUpperCase() !== rutaFilter) return;
                }
                if (r.cliente) clients.add(r.cliente);
            });

            clienteBar.innerHTML = '';
            const btnTodos = document.createElement('button');
            btnTodos.className = 'chip-btn' + (!currentSelected ? ' active' : '');
            btnTodos.dataset.value = '';
            btnTodos.textContent = 'Todos';
            btnTodos.onclick = function() { selectCliente(this, ''); };
            clienteBar.appendChild(btnTodos);

            [...clients].sort().forEach(c => {
                const btn = document.createElement('button');
                btn.className = 'chip-btn' + (c === currentSelected ? ' active' : '');
                btn.dataset.value = c;
                btn.textContent = c;
                btn.onclick = function() { selectCliente(this, c); };
                clienteBar.appendChild(btn);
            });

            if (currentSelected && !clients.has(currentSelected)) {
                selectedCliente = '';
                btnTodos.classList.add('active');
            }
        }

        // ============================================================
        //  ORDENAMIENTO
        // ============================================================
        function sortTable(col) {
            if (currentSort.col === col) {
                currentSort.asc = !currentSort.asc;
            } else {
                currentSort.col = col;
                currentSort.asc = true;
            }
            sortArray(filteredRows, col, currentSort.asc);

            // Visual: actualizar iconos
            document.querySelectorAll('#main-table thead th').forEach(th => {
                th.classList.remove('sorted');
                const icon = th.querySelector('.sort-icon');
                if (icon) icon.textContent = '⇅';
            });
            const activeTh = document.querySelector(`#main-table thead th[data-col="${col}"]`);
            if (activeTh) {
                activeTh.classList.add('sorted');
                const icon = activeTh.querySelector('.sort-icon');
                if (icon) icon.textContent = currentSort.asc ? '↑' : '↓';
            }

            renderTable();
        }

        function sortArray(arr, col, asc) {
            const numericCols = ['diasGirado', 'qtyXCortar', 'qtyXIngresar'];
            arr.sort((a, b) => {
                let va = a[col], vb = b[col];
                if (numericCols.includes(col)) {
                    va = parseFloat(va) || 0;
                    vb = parseFloat(vb) || 0;
                    return asc ? va - vb : vb - va;
                }
                va = String(va || '').toUpperCase();
                vb = String(vb || '').toUpperCase();
                const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
                return asc ? cmp : -cmp;
            });
        }

        // ============================================================
        //  RENDERIZADO
        // ============================================================
        function renderTable() {
            const tbody = document.getElementById('main-tbody');
            tbody.innerHTML = '';

            let totalXCortar = 0;
            let totalXIngresar = 0;
            let lastOcGroupKey = null;
            let groupClass = 'a';

            filteredRows.forEach((r, idx) => {
                totalXCortar += r.qtyXCortar;
                totalXIngresar += r.qtyXIngresar;

                // Alternar color de fila por grupo de OC
                const ocGroupKey = getOcGroupKey(r.oc);
                if (lastOcGroupKey !== null && ocGroupKey !== lastOcGroupKey) {
                    groupClass = (groupClass === 'a') ? 'b' : 'a';
                }
                lastOcGroupKey = ocGroupKey;

                const tr = document.createElement('tr');
                tr.classList.add(`group-${groupClass}`);

                // Ruta Tela pill
                const rutaUpper = r.rutaTela.toUpperCase();
                let rutaHtml = r.rutaTela;
                if (rutaUpper === 'ACABADA') rutaHtml = `<span class="pill pill-pza">AC</span>`;
                else if (rutaUpper === 'LAVADA') rutaHtml = `<span class="pill pill-warning">LV</span>`;
                const ribTooltip = buildRibTooltipText(r);
                const daysTooltip = ribTooltip ? escapeHtmlAttr(ribTooltip) : '';

                tr.innerHTML = `
                    <td class="editable-date" ondblclick="openDateModal(${idx})" title="Doble clic para editar fecha">${r.fDespacho}</td>
                    <td>${r.fGirado}</td>
                    <td style="text-align:center;"${daysTooltip ? ` title="${daysTooltip}"` : ''}>${getDaysPillHtml(r.diasGirado)}</td>
                    <td>${r.fCorte}</td>
                    <td class="editable-date" ondblclick="openIngCostModal(${idx})" title="Doble clic para editar fecha">${r.fIngCost}</td>
                    <td style="text-align:center;">${r.rsv}</td>
                    <td title="${r._clienteRaw || r.cliente}">${r.cliente}</td>
                    <td title="${r.estilo}">${r.estilo}</td>
                    <td title="${r.oc}">${r.oc}</td>
                    <td title="${r.color}">${r.color}</td>
                    <td style="text-align:center;">${rutaHtml}</td>
                    <td style="text-align:center;">${ribPillHtml(r._ribRaw, r.estadoRib)}</td>
                    <td style="text-align:center;">${statusPillHtml(r.status)}</td>
                    <td style="text-align:center;">${r.planta}</td>
                    <td style="text-align:center;">${r.linea}</td>
                    <td style="text-align:right; font-weight:600; ${r.qtyXCortar > 0 ? 'color:#ef4444;' : 'color:#10b981;'}">${formatThousands(r.qtyXCortar, 0)}</td>
                    <td style="text-align:right; font-weight:600; ${r.qtyXIngresar > 0 ? 'color:#f59e0b;' : 'color:#10b981;'}">${formatThousands(r.qtyXIngresar, 0)}</td>
                `;
                tbody.appendChild(tr);
            });

            // Actualizar contadores
            document.getElementById('count-total').innerText = filteredRows.length;
            document.getElementById('summary-xcortar').innerText = formatThousands(totalXCortar, 0);
            document.getElementById('summary-xingresar').innerText = formatThousands(totalXIngresar, 0);
        }

        // ============================================================
        //  MODAL F. DESPACHO – Editar fecha con doble clic
        // ============================================================
        function parseDisplayDateToISO(dateStr) {
            if (!dateStr) return '';
            const mesesMap = {'ene':'01','feb':'02','mar':'03','abr':'04','may':'05','jun':'06',
                              'jul':'07','ago':'08','sep':'09','oct':'10','nov':'11','dic':'12'};
            const parts = String(dateStr).split('/');
            if (parts.length !== 3) return '';
            const day = parts[0].padStart(2, '0');
            const month = mesesMap[parts[1].toLowerCase()] || '';
            let year = parts[2];
            if (year.length === 2) year = '20' + year;
            if (!month) return '';
            return `${year}-${month}-${day}`;
        }

        function openDateModal(filteredIdx) {
            editingRowData = filteredRows[filteredIdx];
            if (!editingRowData) return;
            document.getElementById('modal-oc-info').textContent = editingRowData.oc || '-';
            document.getElementById('modal-cliente-info').textContent = editingRowData.cliente || '-';
            document.getElementById('modal-color-info').textContent = editingRowData.color || '-';
            const dateInput = document.getElementById('modal-date-input');
            dateInput.value = parseDisplayDateToISO(editingRowData.fDespacho);
            document.getElementById('modal-fdespacho').classList.add('active');
            setTimeout(() => dateInput.focus(), 100);
        }

        function closeDateModal() {
            document.getElementById('modal-fdespacho').classList.remove('active');
            editingRowData = null;
        }

        // Cerrar modal con Escape
        document.addEventListener('keydown', function(e) {
            if (e.key !== 'Escape') return;
            const modalFDespacho = document.getElementById('modal-fdespacho');
            const modalFIngCost = document.getElementById('modal-fingcost');
            if (modalFDespacho && modalFDespacho.classList.contains('active')) closeDateModal();
            if (modalFIngCost && modalFIngCost.classList.contains('active')) closeIngCostModal();
        });

        function saveFDespacho() {
            if (!editingRowData) return;
            const dateInput = document.getElementById('modal-date-input');
            const dateValue = dateInput.value; // yyyy-MM-dd
            if (!dateValue) { alert('Seleccione una fecha'); return; }

            const rawIndex = editingRowData._rawIndex;

            // Determinar el nombre real de la columna F. DESPACHO en los headers del sheet
            let colName = 'HOD';
            if (rawData && rawData.length > 0) {
                const idx = colMap['HOD'] !== undefined ? colMap['HOD'] : colMap['F. DESPACHO'];
                if (idx !== undefined && idx !== -1 && rawData[0][idx]) {
                    colName = rawData[0][idx].toString().trim();
                }
            }

            // Convertir fecha ISO a formato dd/Mes/yy (mismo patrón que handleDateChange)
            const mesesEs = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            const parts = dateValue.split('-');
            const yearShort = parts[0].slice(-2);
            const month = parseInt(parts[1], 10) - 1;
            const day = parts[2];
            const formattedDate = `${day}/${mesesEs[month]}/${yearShort}`;

            // Actualizar datos locales inmediatamente
            editingRowData.fDespacho = formattedDate;
            editingRowData._fDespachoRaw = dateValue;
            if (rawData[rawIndex]) {
                const colIdx = colMap['HOD'] !== undefined ? colMap['HOD'] : colMap['F. DESPACHO'];
                if (colIdx !== undefined && colIdx !== -1) {
                    rawData[rawIndex][colIdx] = formattedDate;
                }
            }

            // Feedback visual
            const saveBtn = document.getElementById('modal-save-btn');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Guardando…';

            // Enviar al GAS (mode: no-cors como patrón existente)
            window.PcpProgramaService.actualizarCampo(rawIndex, colName, formattedDate, { noCors: true }).then(() => {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar';
                closeDateModal();
                updateFechaDropdown();
                applyFilters();
            }).catch(err => {
                console.error('Error al guardar F. Despacho:', err);
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar';
                closeDateModal();
                updateFechaDropdown();
                applyFilters();
            });
        }

        function openIngCostModal(filteredIdx) {
            editingRowData = filteredRows[filteredIdx];
            if (!editingRowData) return;
            document.getElementById('modal-oc-info-ingcost').textContent = editingRowData.oc || '-';
            document.getElementById('modal-cliente-info-ingcost').textContent = editingRowData.cliente || '-';
            document.getElementById('modal-color-info-ingcost').textContent = editingRowData.color || '-';
            const dateInput = document.getElementById('modal-ingcost-input');
            dateInput.value = parseDisplayDateToISO(editingRowData.fIngCost);
            document.getElementById('modal-fingcost').classList.add('active');
            setTimeout(() => dateInput.focus(), 100);
        }

        function closeIngCostModal() {
            document.getElementById('modal-fingcost').classList.remove('active');
            editingRowData = null;
        }

        function saveFIngCost() {
            if (!editingRowData) return;
            const dateInput = document.getElementById('modal-ingcost-input');
            const dateValue = dateInput.value; // yyyy-MM-dd
            if (!dateValue) { alert('Seleccione una fecha'); return; }

            const rawIndex = editingRowData._rawIndex;

            // Determinar el nombre real de la columna F.ING.COST en los headers del sheet
            let colName = 'F.ING.COST';
            let colIdx = (colMap['F.ING.COST'] !== undefined) ? colMap['F.ING.COST'] : -1;
            if (colIdx === -1) colIdx = findHeaderIndexCaseInsensitive('F.ING.COST');
            if (colIdx === -1) colIdx = findHeaderIndexCaseInsensitive('F ING COST');
            if (rawData && rawData.length > 0 && colIdx !== -1 && rawData[0][colIdx]) {
                colName = rawData[0][colIdx].toString().trim();
            }

            // Convertir fecha ISO a formato dd/Mes/yy
            const mesesEs = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            const parts = dateValue.split('-');
            const yearShort = parts[0].slice(-2);
            const month = parseInt(parts[1], 10) - 1;
            const day = parts[2];
            const formattedDate = `${day}/${mesesEs[month]}/${yearShort}`;

            // Actualizar datos locales inmediatamente
            editingRowData.fIngCost = formattedDate;
            editingRowData._fIngCostRaw = dateValue;
            if (rawData[rawIndex] && colIdx !== -1) {
                rawData[rawIndex][colIdx] = formattedDate;
            }

            // Feedback visual
            const saveBtn = document.getElementById('modal-ingcost-save-btn');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Guardando...';

            // Enviar al GAS (mode: no-cors como patrón existente)
            window.PcpProgramaService.actualizarCampo(rawIndex, colName, formattedDate, { noCors: true }).then(() => {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar';
                closeIngCostModal();
                applyFilters();
            }).catch(err => {
                console.error('Error al guardar F.ING.COST:', err);
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Guardar';
                closeIngCostModal();
                applyFilters();
            });
        }

        // ============================================================
        //  EXPORTAR A EXCEL
        // ============================================================
        async function exportToExcel() {
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Tabla Dinámica');

            // Encabezados
            const headers = ['F. DESPACHO', '#D', 'F. GIRADO', 'FECHA CORTE', 'F.ING.COST', 'RSV', 'CLIENTE', 'ESTILO', 'OC', 'COLOR', 'RUTA TELA', 'RIB', 'STATUS', 'PLANTA', 'LINEA', 'QTY xCO', 'QTY xING'];
            const headerRow = ws.addRow(headers);
            headerRow.eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' },
                    bottom: { style: 'thin' }, right: { style: 'thin' }
                };
            });

            // Datos
            filteredRows.forEach(r => {
                ws.addRow([
                    r.fDespacho, r.fGirado, r.diasGirado, r.fCorte, r.fIngCost, r.rsv, r.cliente, r.estilo,
                    r.oc, r.color, r.rutaTela, r.rib, r.status, r.planta, r.linea, r.qtyXCortar, r.qtyXIngresar
                ]);
            });

            // Fila de totales
            const totalRow = ws.addRow(['', '', '', '', '', '', '', '', '', '', '', '', 'TOTAL', '', '', 
                filteredRows.reduce((s, r) => s + r.qtyXCortar, 0),
                filteredRows.reduce((s, r) => s + r.qtyXIngresar, 0)
            ]);
            totalRow.eachCell(cell => { cell.font = { bold: true, size: 11 }; });

            // Ancho de columnas
            ws.columns = [
                { width: 14 }, { width: 14 }, { width: 8 }, { width: 14 }, { width: 6 },
                { width: 12 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 18 },
                { width: 12 }, { width: 12 }, { width: 14 }, { width: 10 }, { width: 10 },
                { width: 12 }, { width: 12 }
            ];

            // Formato numérico para QTY
            ws.getColumn(3).numFmt = '0';
            ws.getColumn(16).numFmt = '#,##0';
            ws.getColumn(17).numFmt = '#,##0';

            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Tabla_Dinamica_${new Date().toISOString().slice(0,10)}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        }
    
