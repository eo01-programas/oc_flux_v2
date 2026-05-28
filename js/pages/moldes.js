
        const SHEET_ID = window.PCP_CONFIG.SHEET_ID;
        const CACHE_KEY = 'moldes_data_cache';
        const CACHE_VERSION = 5;
        const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutos
        const GVIZ_TIMEOUT_MS = 12000;
        const XLSX_LIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        
        const ROWS_PER_PAGE = 50;
        let allData = [];
        let headers = [];
        let colIndices = {};
        let currentPage = 1;
        let totalPages = 1;
        let xlsxLoaderPromise = null;

        function showLoader(show) {
            document.getElementById('loader').style.display = show ? 'flex' : 'none';
        }

        function showToast(message, type = '') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast ' + type;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 2000);
        }

        function enviarCorreoOCSinMolde() {
            try {
                if (!Array.isArray(allData) || allData.length === 0) {
                    showToast('No hay OC para enviar por correo', 'error');
                    return;
                }

                const destinatarios = [
                    'moldaje1@cofaco.com',
                    'TEscalante@cofaco.com',
                    'moldaje6@cofaco.com',
                    'tizado@cofaco.com',
                    'corte@cofaco.com',
                    'jefecorte@cofaco.com',
                    'pcp14@cofaco.com',
                    'LPerez@cofaco.com',
                    'pcp16@cofaco.com',
                    'pcp10@cofaco.com',
                    'churtado@cofaco.com',
                    'pcp03@cofaco.com'
                ].join(';');

                const fecha = new Date();
                const fechaFormato = `${fecha.getDate().toString().padStart(2, '0')}/${MONTHS_SHORT[fecha.getMonth()]}/${fecha.getFullYear()}`;
                const asunto = `ordenes de corte sin nro molde fecha ${fechaFormato}`;

                const hora = fecha.getHours();
                const saludo = hora < 12 ? 'Buenos dias' : 'Buenas tardes';

                const ordenesAgrupadas = {};
                allData.forEach(item => {
                    const cliente = normalizeClientName(item.cliente || 'Sin Cliente') || 'Sin Cliente';
                    const oc = String(item.oc || '').trim();
                    if (!oc) return;

                    if (!ordenesAgrupadas[cliente]) {
                        ordenesAgrupadas[cliente] = [];
                    }
                    ordenesAgrupadas[cliente].push(oc);
                });

                const clientes = Object.keys(ordenesAgrupadas);
                if (clientes.length === 0) {
                    showToast('No se encontraron OC validas para correo', 'error');
                    return;
                }

                const totalOc = allData.length;
                const totalPds = allData.reduce((sum, row) => sum + parseMetricNumber(row.pds_giradas), 0);
                const totalKg = allData.reduce((sum, row) => sum + parseMetricNumber(row.kg_girados), 0);
                const resumen = `OC ${totalOc} / Total PDS: ${formatMetricNumber(totalPds, 0)} / Total KG GIRADOS: ${formatMetricNumber(totalKg, 2)}`;

                let cuerpoCorreo = `${saludo}\nOrdenes de corte sin NRO. MOLDE\n${resumen}\n\n`;
                clientes.sort().forEach(cliente => {
                    cuerpoCorreo += `CLIENTE: ${cliente}\n`;
                    ordenesAgrupadas[cliente].forEach(oc => {
                        cuerpoCorreo += `${oc}\n`;
                    });
                    cuerpoCorreo += '\n';
                });
                cuerpoCorreo += 'PCP Confecciones';

                const mailtoLink = `mailto:${destinatarios}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpoCorreo)}`;
                const opened = window.open(mailtoLink, '_self');
                if (!opened) {
                    window.location.href = mailtoLink;
                }
            } catch (error) {
                console.error('Error al abrir Outlook:', error);
                alert('No se pudo abrir Outlook automaticamente. Por favor, envia el correo manualmente.');
            }
        }

        // Carga diferida de XLSX (solo para importacion Excel)
        function ensureXlsxLoaded() {
            if (window.XLSX) return Promise.resolve();
            if (xlsxLoaderPromise) return xlsxLoaderPromise;

            xlsxLoaderPromise = new Promise((resolve, reject) => {
                const existing = document.querySelector('script[data-xlsx-lib="1"]');
                if (existing) {
                    existing.addEventListener('load', () => resolve(), { once: true });
                    existing.addEventListener('error', () => reject(new Error('No se pudo cargar la libreria XLSX.')), { once: true });
                    return;
                }

                const script = document.createElement('script');
                script.src = XLSX_LIB_URL;
                script.async = true;
                script.defer = true;
                script.setAttribute('data-xlsx-lib', '1');
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('No se pudo cargar la libreria XLSX.'));
                document.head.appendChild(script);
            });

            return xlsxLoaderPromise;
        }

        function parseGvizToMatrix(jsonResponse) {
            if (!jsonResponse || !jsonResponse.table) {
                throw new Error('Respuesta gviz invalida');
            }

            const cols = Array.isArray(jsonResponse.table.cols) ? jsonResponse.table.cols : [];
            const rows = Array.isArray(jsonResponse.table.rows) ? jsonResponse.table.rows : [];
            const colCount = cols.length;

            const rowsRaw = rows.map(r => {
                const cells = Array.isArray(r.c) ? r.c : [];
                const mapped = cells.map(cell => {
                    if (!cell) return '';
                    if (cell.v !== null && cell.v !== undefined) return cell.v;
                    if (cell.f !== null && cell.f !== undefined) return cell.f;
                    return '';
                });
                if (colCount > 0 && mapped.length < colCount) {
                    while (mapped.length < colCount) mapped.push('');
                }
                return mapped;
            });

            const gvizHeaders = cols.map(col => col.label || col.id || '');
            let matrix;

            if (gvizHeaders.includes('OP TELA')) {
                matrix = [gvizHeaders, ...rowsRaw];
            } else {
                let headerRowIndex = -1;
                for (let i = 0; i < rowsRaw.length; i++) {
                    if (rowsRaw[i].includes('OP TELA')) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex !== -1) {
                    const actualHeaders = rowsRaw[headerRowIndex];
                    matrix = [actualHeaders, ...rowsRaw];
                } else {
                    matrix = [gvizHeaders, ...rowsRaw];
                }
            }

            if (matrix.length > 0 && Array.isArray(matrix[0])) {
                matrix[0] = matrix[0].map(h => (h === null || h === undefined) ? '' : String(h).trim());
            }

            return matrix;
        }

        function normalizeHeader(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '');
        }

        function normalizeClientName(value) {
            const name = String(value || '').trim().toUpperCase();
            if (!name) return '';

            // Normalizaciones rápidas
            if (name.includes('LACOSTE')) return 'LAC';
            if (name.includes('ATHLETA, INC.')) return 'ATH';
            if (name.includes('ALLBIRDS')) return 'ALLB';
            if (name.includes('BANANA REPUBLIC, LLC')) return 'BNN';
            if (name.includes('THEORY LLC,')) return 'THE';
            if (name.includes('DISH & DUER')) return 'DDU';
            if (name.includes('SKECHERS PERFORMANCE')) return 'SKE';
            if (name.includes('LULULEMON ATHLETICA CANADA INC')) return 'LLL';
            if (name.includes('AM RETAIL S.A.C.')) return 'AMR';

            return String(value || '').trim();
        }

        function buildColIndices(headerRow) {
            const safeHeaders = Array.isArray(headerRow) ? headerRow.map(h => String(h || '').trim()) : [];
            const normalizedColMap = {};
            safeHeaders.forEach((header, idx) => {
                normalizedColMap[normalizeHeader(header)] = idx;
            });

            const getColIdx = (...aliases) => {
                for (const alias of aliases) {
                    const exact = safeHeaders.indexOf(alias);
                    if (exact !== -1) return exact;
                    const normalizedAlias = normalizeHeader(alias);
                    if (normalizedColMap[normalizedAlias] !== undefined) {
                        return normalizedColMap[normalizedAlias];
                    }
                }
                return -1;
            };

            return {
                f_girado: getColIdx('F. GIRADO', 'F GIRADO', 'FGIRADO'),
                f_ing_cost: getColIdx('F.ING.COST', 'F. ING. COST', 'F ING COST', 'FINGCOST'),
                f_despacho: getColIdx('F. DESPACHO', 'F DESPACHO', 'FDESPACHO', 'HOD'),
                cliente: getColIdx('CLIENTE', 'CLI'),
                ruta_tela: getColIdx('RUTA TELA', 'RUTA_TELA', 'RUTA'),
                op: getColIdx('OP'),
                corte: getColIdx('CORTE'),
                oc: getColIdx('OC', 'OP-CORTE', 'OP CORTE'),
                color: getColIdx('COLOR'),
                op_tela: getColIdx('OP TELA', 'OP_TELA', 'OPTELA'),
                partida: getColIdx('PARTIDA'),
                articulo: getColIdx('ARTÍCULO', 'ARTICULO', 'ART.', 'DESCRIPCIÓN', 'DESCRIPCION'),
                kg_girados: getColIdx('KG GIRADOS', 'KG_GIRADOS', 'KGGIRADOS'),
                pds_giradas: getColIdx('PDS GIRADAS', 'PDS_GIRADAS', 'PDS'),
                nro_molde: getColIdx('NRO. MOLDE', 'NRO MOLDE', 'NROMOLDE')
            };
        }

        function isColIndicesComplete(indices) {
            if (!indices || typeof indices !== 'object') return false;

            const hasIdentity = indices.cliente !== -1
                && indices.ruta_tela !== -1
                && indices.color !== -1
                && indices.nro_molde !== -1;
            const hasOc = (indices.op !== -1 && indices.corte !== -1) || indices.oc !== -1;
            const hasMetrics = indices.kg_girados !== -1 && indices.pds_giradas !== -1;
            const hasDates = indices.f_girado !== -1 || indices.f_ing_cost !== -1 || indices.f_despacho !== -1;

            return hasIdentity && hasOc && hasMetrics && hasDates;
        }

        function fetchDataViaGviz() {
            return window.PcpGoogleSheets.loadGvizJsonp({
                spreadsheetId: SHEET_ID,
                headers: 0,
                label: 'moldes',
                callbackPrefix: 'moldesLoadDataCallback',
                timeoutMs: GVIZ_TIMEOUT_MS,
                errorMessage: 'Error de conexion con Google Sheets (gviz)',
                timeoutMessage: 'Tiempo de espera agotado en gviz'
            }).then(parseGvizToMatrix);
        }

        async function fetchDataViaWebApp() {
            const data = await window.PcpProgramaService.get();
            if (!data || !Array.isArray(data)) {
                throw new Error('Datos invalidos');
            }
            return data;
        }

        // Cargar desde cache primero, luego actualizar
        function loadFromCache() {
            try {
                const cachedRaw = localStorage.getItem(CACHE_KEY);
                if (!cachedRaw) return null;

                const cached = JSON.parse(cachedRaw);
                if (!cached || typeof cached !== 'object' || Array.isArray(cached)) return null;
                if (cached.version !== CACHE_VERSION) return null;
                const timestamp = Number(cached && cached.timestamp ? cached.timestamp : 0);
                if (!timestamp || (Date.now() - timestamp >= CACHE_EXPIRY)) return null;

                if (Array.isArray(cached.rows)) {
                    return { kind: 'processed', rows: cached.rows };
                }
                if (Array.isArray(cached.data)) {
                    return { kind: 'raw', data: cached.data };
                }
            } catch (e) {}
            return null;
        }

        function saveProcessedCache(rows) {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    version: CACHE_VERSION,
                    rows: rows,
                    timestamp: Date.now()
                }));
            } catch (e) {}
        }

        function applyCachedRows(rows) {
            allData = sortRowsByDateAndOc((Array.isArray(rows) ? rows : []).map(row => ({
                ...row,
                cliente: normalizeClientName(row.cliente || '')
            })));
            totalPages = Math.ceil(allData.length / ROWS_PER_PAGE);
            updateStats();
            updatePaginationControls();
        }

        function buildValidDate(year, month, day) {
            const date = new Date(year, month, day);
            if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
                return null;
            }
            return date;
        }

        function parseDateValue(value) {
            if (value instanceof Date && !isNaN(value.getTime())) {
                return new Date(value.getFullYear(), value.getMonth(), value.getDate());
            }

            if (typeof value === 'number' && Number.isFinite(value)) {
                const utcBase = Date.UTC(1899, 11, 30);
                const serialDate = new Date(utcBase + Math.floor(value) * 86400000);
                if (!isNaN(serialDate.getTime())) {
                    return new Date(serialDate.getUTCFullYear(), serialDate.getUTCMonth(), serialDate.getUTCDate());
                }
            }

            const text = String(value === null || value === undefined ? '' : value).trim();
            if (!text) return null;

            if (/^\d+(?:[.,]\d+)?$/.test(text)) {
                const serialNumber = Number(text.replace(',', '.'));
                if (Number.isFinite(serialNumber) && serialNumber > 20000) {
                    const utcBase = Date.UTC(1899, 11, 30);
                    const serialDate = new Date(utcBase + Math.floor(serialNumber) * 86400000);
                    if (!isNaN(serialDate.getTime())) {
                        return new Date(serialDate.getUTCFullYear(), serialDate.getUTCMonth(), serialDate.getUTCDate());
                    }
                }
            }

            let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s.*)?$/);
            if (match) {
                const year = Number(match[1]);
                const month = Number(match[2]) - 1;
                const day = Number(match[3]);
                const date = buildValidDate(year, month, day);
                if (date) return date;
            }

            match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s.*)?$/);
            if (match) {
                const day = Number(match[1]);
                const month = Number(match[2]) - 1;
                let year = Number(match[3]);
                if (year < 100) year += 2000;
                const date = buildValidDate(year, month, day);
                if (date) return date;
            }

            match = text.match(/^(\d{1,2})[-/ ]([A-Za-z\u00C0-\u017F]{3,})[-/ ](\d{2,4})(?:\s.*)?$/);
            if (match) {
                const day = Number(match[1]);
                const monthToken = match[2]
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .slice(0, 3);
                const month = MONTHS_SHORT.indexOf(monthToken);
                let year = Number(match[3]);
                if (year < 100) year += 2000;
                if (month !== -1) {
                    const date = buildValidDate(year, month, day);
                    if (date) return date;
                }
            }

            const fallback = new Date(text);
            if (!isNaN(fallback.getTime())) {
                return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
            }

            return null;
        }

        function formatDateDisplay(value) {
            const date = parseDateValue(value);
            if (!date) {
                return String(value === null || value === undefined ? '' : value).trim();
            }

            return `${String(date.getDate()).padStart(2, '0')}/${MONTHS_SHORT[date.getMonth()]}/${date.getFullYear()}`;
        }

        function formatDateShort(value) {
            const date = parseDateValue(value);
            if (!date) {
                return String(value === null || value === undefined ? '' : value).trim();
            }

            return `${String(date.getDate()).padStart(2, '0')}/${MONTHS_SHORT[date.getMonth()]}`;
        }

        function getDateSortValue(value) {
            const date = parseDateValue(value);
            return date ? date.getTime() : Number.POSITIVE_INFINITY;
        }

        function sortRowsByDateAndOc(rows) {
            return rows.sort((a, b) => {
                const dateA = getDateSortValue(a.f_girado);
                const dateB = getDateSortValue(b.f_girado);
                if (dateA !== dateB) return dateA - dateB;

                return String(a.oc || '').localeCompare(String(b.oc || ''), 'es', {
                    numeric: true,
                    sensitivity: 'base'
                });
            });
        }

        function reloadData(forceRefresh = false) {
            showLoader(true);
            currentPage = 1;

            if (!forceRefresh) {
                const cachedPayload = loadFromCache();
                if (cachedPayload) {
                    if (cachedPayload.kind === 'processed') {
                        applyCachedRows(cachedPayload.rows);
                    } else if (cachedPayload.kind === 'raw') {
                        processData(cachedPayload.data);
                    }
                    renderPage();
                    showLoader(false);
                    fetchDataInBackground();
                    return;
                }
            }

            fetchDataInBackground();
        }

        async function fetchDataInBackground() {
            try {
                let data;
                let source = 'gviz';
                try {
                    data = await fetchDataViaGviz();
                } catch (gvizError) {
                    console.warn('Fallo gviz, usando fallback WebApp:', gvizError);
                    source = 'webapp';
                    data = await fetchDataViaWebApp();
                }

                if (!data || !Array.isArray(data)) {
                    throw new Error('Datos invalidos');
                }

                if (source === 'gviz') {
                    const gvizHeaders = Array.isArray(data[0]) ? data[0] : [];
                    const gvizIndices = buildColIndices(gvizHeaders);
                    if (!isColIndicesComplete(gvizIndices)) {
                        console.warn('Headers incompletos en gviz, usando fallback WebApp');
                        data = await fetchDataViaWebApp();
                    }
                }

                processData(data);
                if (!isColIndicesComplete(colIndices)) {
                    console.warn('No se guarda cache por indices incompletos:', colIndices);
                    throw new Error('No se pudieron identificar las columnas requeridas en la hoja.');
                }

                saveProcessedCache(allData);
                renderPage();
            } catch (error) {
                console.error('Error cargando datos:', error);
                if (allData.length === 0) {
                    document.getElementById('tbody-moldes').innerHTML = '<tr><td colspan="12" class="no-data">Error: ' + error.message + '</td></tr>';
                }
            } finally {
                showLoader(false);
            }
        }

        function processData(data) {
            if (!Array.isArray(data) || data.length === 0) {
                console.log('No data received or data is not an array');
                allData = [];
                return;
            }

            headers = Array.isArray(data[0]) ? data[0].map(h => String(h || '').trim()) : [];
            const rows = data.slice(1);

            console.log('Headers:', headers);
            console.log('Total rows:', rows.length);

            // Encontrar indices de columnas (flexibles)
            colIndices = buildColIndices(headers);

            console.log('Column indices:', colIndices);

            // Filtrar solo registros donde NRO. MOLDE estÃ¡ vacÃ­o y CORTE no sea 9000+
            allData = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const nroMolde = colIndices.nro_molde !== -1 ? String(row[colIndices.nro_molde] || '').trim() : '';

                let opRaw = colIndices.op !== -1 ? String(row[colIndices.op] || '').trim() : '';
                let corteRaw = colIndices.corte !== -1 ? String(row[colIndices.corte] || '').trim() : '';
                const ocFromColumn = colIndices.oc !== -1 ? String(row[colIndices.oc] || '').trim() : '';

                if ((!opRaw || !corteRaw) && ocFromColumn.includes('-')) {
                    const parts = ocFromColumn.split('-').map(p => String(p || '').trim()).filter(Boolean);
                    if (!opRaw && parts.length > 0) opRaw = parts[0];
                    if (!corteRaw && parts.length > 1) corteRaw = parts.slice(1).join('-');
                }

                const corteValue = corteRaw;
                
                // Verificar si CORTE es 9000 o superior (9000, 9001, 9002, etc.)
                const corteNum = parseInt(corteValue);
                const isCorte9000Plus = !isNaN(corteNum) && corteNum >= 9000 && corteNum < 10000;
                
                // Solo incluir filas donde NRO. MOLDE estÃ© vacÃ­o y CORTE NO sea 9000+
                if (nroMolde === '' && !isCorte9000Plus) {
                    // Construir OC: OP + CORTE
                    let oc = '-';
                    if (opRaw && corteRaw) {
                        oc = `${opRaw}-${corteRaw}`;
                    } else if (ocFromColumn) {
                        oc = ocFromColumn;
                    } else if (opRaw || corteRaw) {
                        oc = `${opRaw}-${corteRaw}`.replace(/^-+/, '').replace(/-+$/, '');
                    }
                    
                    // Construir OP-PTDA: OP TELA + PARTIDA
                    const opTelaRaw = colIndices.op_tela !== -1 ? String(row[colIndices.op_tela] || '').trim() : '';
                    const partidaRaw = colIndices.partida !== -1 ? String(row[colIndices.partida] || '').trim() : '';
                    const articuloRaw = colIndices.articulo !== -1 ? String(row[colIndices.articulo] || '').trim() : '';
                    const op_ptda = `${opTelaRaw}-${partidaRaw}`.replace(/^-+/, '').replace(/-+$/, '');
                    
                    allData.push({
                        rowIndex: i + 1, // +1 porque data[0]=headers, data[1]=fila 2, etc. El servidor suma +1 para obtener la fila real
                        f_girado: colIndices.f_girado !== -1 ? (row[colIndices.f_girado] || '') : '',
                        f_ing_cost: colIndices.f_ing_cost !== -1 ? (row[colIndices.f_ing_cost] || '') : '',
                        f_despacho: colIndices.f_despacho !== -1 ? (row[colIndices.f_despacho] || '') : '',
                        cliente: colIndices.cliente !== -1 ? normalizeClientName(row[colIndices.cliente] || '') : '',
                        ruta_tela: colIndices.ruta_tela !== -1 ? (row[colIndices.ruta_tela] || '') : '',
                        oc: oc,
                        op_raw: opRaw,
                        corte_raw: corteRaw,
                        color: colIndices.color !== -1 ? (row[colIndices.color] || '') : '',
                        op_ptda: op_ptda,
                        articulo: articuloRaw,
                        kg_girados: colIndices.kg_girados !== -1 ? (row[colIndices.kg_girados] || '') : '',
                        pds_giradas: colIndices.pds_giradas !== -1 ? (row[colIndices.pds_giradas] || '') : ''
                    });
                }
            }

            allData = sortRowsByDateAndOc(allData);

            console.log('Filtered data (empty NRO. MOLDE):', allData.length, 'records');
            totalPages = Math.ceil(allData.length / ROWS_PER_PAGE);
            updateStats();
            updatePaginationControls();
        }

        function parseMetricNumber(value) {
            if (typeof value === 'number') {
                return Number.isFinite(value) ? value : 0;
            }

            let text = String(value === null || value === undefined ? '' : value).trim();
            if (!text) return 0;

            text = text.replace(/\s+/g, '');

            if (text.includes(',') && text.includes('.')) {
                if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
                    text = text.replace(/\./g, '').replace(',', '.');
                } else {
                    text = text.replace(/,/g, '');
                }
            } else if (text.includes(',')) {
                const commaCount = (text.match(/,/g) || []).length;
                text = commaCount === 1 ? text.replace(',', '.') : text.replace(/,/g, '');
            } else if (text.includes('.')) {
                const dotCount = (text.match(/\./g) || []).length;
                if (dotCount > 1) {
                    text = text.replace(/\./g, '');
                }
            }

            const num = parseFloat(text);
            return Number.isFinite(num) ? num : 0;
        }

        function formatMetricNumber(value, maxDecimals = 0) {
            return Number(value || 0).toLocaleString('es-PE', {
                minimumFractionDigits: 0,
                maximumFractionDigits: maxDecimals
            });
        }

        function updateStats() {
            document.getElementById('stat-total').textContent = allData.length;
            document.getElementById('stat-pendientes').textContent = allData.length;

            const totalPds = allData.reduce((sum, row) => {
                return sum + parseMetricNumber(row.pds_giradas);
            }, 0);
            const totalKg = allData.reduce((sum, row) => {
                return sum + parseMetricNumber(row.kg_girados);
            }, 0);

            const statPds = document.getElementById('stat-pds');
            if (statPds) statPds.textContent = formatMetricNumber(totalPds, 0);

            const statKg = document.getElementById('stat-kg');
            if (statKg) statKg.textContent = formatMetricNumber(totalKg, 2);
        }

        function updatePaginationControls() {
            const paginationDiv = document.getElementById('pagination');
            const btnPrev = document.getElementById('btn-prev');
            const btnNext = document.getElementById('btn-next');

            if (allData.length === 0) {
                paginationDiv.style.display = 'none';
                return;
            }

            if (totalPages <= 1) {
                paginationDiv.style.display = 'none';
            } else {
                paginationDiv.style.display = 'flex';
            }

            document.getElementById('page-current').textContent = currentPage;
            document.getElementById('page-total').textContent = totalPages;
            
            const start = (currentPage - 1) * ROWS_PER_PAGE + 1;
            const end = Math.min(currentPage * ROWS_PER_PAGE, allData.length);
            document.getElementById('page-shown').textContent = end - start + 1;
            document.getElementById('page-all').textContent = allData.length;

            btnPrev.disabled = currentPage === 1;
            btnNext.disabled = currentPage === totalPages;
        }

        function previousPage() {
            if (currentPage > 1) {
                currentPage--;
                renderPage();
                window.scrollTo(0, 0);
            }
        }

        function nextPage() {
            if (currentPage < totalPages) {
                currentPage++;
                renderPage();
                window.scrollTo(0, 0);
            }
        }

        function renderPage() {
            const start = (currentPage - 1) * ROWS_PER_PAGE;
            const end = start + ROWS_PER_PAGE;
            const pageData = allData.slice(start, end);

            renderTable(pageData);
            updatePaginationControls();
        }

        function renderTable(pageData) {
            const tbody = document.getElementById('tbody-moldes');

            if (pageData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="12" class="no-data">No hay registros pendientes de asignar Nro Molde.</td></tr>';
                return;
            }

            let html = '';
            pageData.forEach((row, idx) => {
                html += `<tr data-row-index="${row.rowIndex}">
                    <td>${formatDateShort(row.f_girado)}</td>
                    <td>${formatDateShort(row.f_ing_cost)}</td>
                    <td>${formatDateShort(row.f_despacho)}</td>
                    <td>${row.cliente}</td>
                    <td>${row.ruta_tela}</td>
                    <td style="background-color: #d1fae5;">${row.oc}</td>
                    <td>${row.color}</td>
                    <td>${row.op_ptda}</td>
                    <td class="article-cell">${row.articulo}</td>
                    <td style="text-align:right;">${row.kg_girados}</td>
                    <td style="text-align:right;">${row.pds_giradas}</td>
                    <td>
                        <input type="text" 
                               class="molde-input" 
                               data-row-index="${row.rowIndex}"
                               placeholder="Ingrese nro molde..."
                               onchange="guardarMolde(this)"
                               onkeypress="handleKeyPress(event, this)">
                    </td>
                </tr>`;
            });

            tbody.innerHTML = html;
        }

        function handleKeyPress(event, input) {
            if (event.key === 'Enter') {
                input.blur();
                guardarMolde(input);
            }
        }

        // OPTIMISTIC UPDATE: La UI responde inmediatamente
        function guardarMolde(input) {
            const value = input.value.trim();
            const rowIndex = parseInt(input.dataset.rowIndex);

            if (!value) return;

            // 1. INMEDIATAMENTE: Actualizar UI (no esperar servidor)
            input.classList.add('saved');
            input.disabled = true;
            
            const tr = input.closest('tr');
            tr.style.transition = 'opacity 0.15s, transform 0.15s';
            tr.style.opacity = '0.3';
            
            // 2. Remover fila de la vista inmediatamente
            setTimeout(() => {
                tr.style.opacity = '0';
                tr.style.transform = 'translateX(20px)';
                
                setTimeout(() => {
                    tr.remove();
                    
                    // Actualizar datos locales
                    allData = allData.filter(d => d.rowIndex !== rowIndex);
                    totalPages = Math.ceil(allData.length / ROWS_PER_PAGE);
                    if (currentPage > totalPages && currentPage > 1) currentPage--;
                    
                    document.getElementById('stat-total').textContent = allData.length;
                    document.getElementById('stat-pendientes').textContent = allData.length;
                    
                    if (allData.length === 0) {
                        document.getElementById('tbody-moldes').innerHTML = '<tr><td colspan="12" class="no-data">No hay registros pendientes.</td></tr>';
                        document.getElementById('pagination').style.display = 'none';
                    } else {
                        renderPage();
                    }
                }, 150);
            }, 50);

            // 3. EN PARALELO: Enviar al servidor (sin bloquear UI)
            const payload = {
                action: 'update',
                row: rowIndex,
                colName: 'NRO. MOLDE',
                value: value
            };

            console.log('Guardando molde:', payload); // Debug

            window.PcpProgramaService.actualizarCampo(rowIndex, 'NRO. MOLDE', value, { noCors: true })
            .then(() => {
                console.log('Molde enviado correctamente:', payload);
                showToast('âœ“ Guardado', 'success');
                // Limpiar cachÃ© para forzar recarga fresca
                localStorage.removeItem(CACHE_KEY);
            })
            .catch(error => {
                console.error('Error guardando:', error);
                showToast('Error de conexiÃ³n', 'error');
            });
        }

        // ============ CARGA MASIVA DE NRO. MOLDE DESDE EXCEL ============

        async function procesarExcelMoldes(input) {
            const file = input.files[0];
            if (!file) return;

            const btn = document.getElementById('btnFabExcel');
            btn.disabled = true;
            showToast('Procesando Excel...', '');

            try {
                await ensureXlsxLoaded();
            } catch (error) {
                console.error('Error cargando XLSX:', error);
                showToast('No se pudo cargar el lector de Excel', 'error');
                btn.disabled = false;
                input.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                    // Buscar fila de encabezado que contenga "OP" y "CORTE" y "NRO. MOLDE"
                    let headerRowIdx = -1;
                    let colOP = -1, colCORTE = -1, colMOLDE = -1;

                    for (let i = 0; i < Math.min(rawData.length, 20); i++) {
                        const row = rawData[i];
                        if (!row) continue;
                        const cells = Array.from(row, c => (c == null ? '' : c.toString().trim().toUpperCase()));
                        const idxOP = cells.indexOf('OP');
                        const idxCorte = cells.indexOf('CORTE');
                        const idxMolde = cells.findIndex(c => {
                            if (!c) return false;
                            const clean = c.replace(/[\s.]+/g, '');
                            return clean === 'NROMOLDE' || c === 'NRO. MOLDE' || c === 'NRO MOLDE';
                        });
                        if (idxOP !== -1 && idxCorte !== -1 && idxMolde !== -1) {
                            headerRowIdx = i;
                            colOP = idxOP;
                            colCORTE = idxCorte;
                            colMOLDE = idxMolde;
                            break;
                        }
                    }

                    if (headerRowIdx === -1) {
                        showToast('No se encontraron columnas OP, CORTE y NRO. MOLDE en el Excel', 'error');
                        btn.disabled = false;
                        input.value = '';
                        return;
                    }

                    // Construir mapa del Excel: clave = "OP_norm|CORTE_norm" â†’ NRO. MOLDE
                    const normalizar = v => (v || '').toString().trim().replace(/^0+/, '') || '0';
                    const excelMap = new Map();
                    let totalExcelRows = 0;

                    for (let i = headerRowIdx + 1; i < rawData.length; i++) {
                        const row = rawData[i];
                        if (!row) continue;
                        const opVal = normalizar(row[colOP]);
                        const corteVal = normalizar(row[colCORTE]);
                        const moldeVal = (row[colMOLDE] || '').toString().trim();
                        if (opVal && corteVal && moldeVal) {
                            const key = opVal + '|' + corteVal;
                            excelMap.set(key, moldeVal);
                            totalExcelRows++;
                        }
                    }

                    if (totalExcelRows === 0) {
                        showToast('El Excel no contiene datos de NRO. MOLDE vÃ¡lidos', 'error');
                        btn.disabled = false;
                        input.value = '';
                        return;
                    }

                    // Buscar coincidencias con allData (registros sin molde)
                    const matches = [];
                    const noEncontrados = [];

                    allData.forEach(item => {
                        const opNorm = normalizar(item.op_raw);
                        const corteNorm = normalizar(item.corte_raw);
                        const key = opNorm + '|' + corteNorm;
                        if (excelMap.has(key)) {
                            matches.push({
                                rowIndex: item.rowIndex,
                                oc: item.oc,
                                cliente: normalizeClientName(item.cliente || ''),
                                nroMolde: excelMap.get(key)
                            });
                        } else {
                            noEncontrados.push({ oc: item.oc, cliente: normalizeClientName(item.cliente || '') });
                        }
                    });

                    if (matches.length === 0) {
                        mostrarResumenExcel(0, noEncontrados.length, noEncontrados, totalExcelRows);
                        btn.disabled = false;
                        input.value = '';
                        return;
                    }

                    // Mostrar modal de progreso y enviar actualizaciones
                    mostrarProgresoExcel(matches.length);
                    enviarActualizacionesMolde(matches, noEncontrados, totalExcelRows, btn);

                } catch (err) {
                    console.error('Error procesando Excel:', err);
                    showToast('Error al procesar el archivo: ' + err.message, 'error');
                    btn.disabled = false;
                }
                input.value = '';
            };

            reader.onerror = function() {
                showToast('Error al leer el archivo', 'error');
                btn.disabled = false;
                input.value = '';
            };

            reader.readAsBinaryString(file);
        }

        function mostrarProgresoExcel(total) {
            const body = document.getElementById('excelModalBody');
            body.innerHTML = `
                <div style="text-align:center; margin-bottom:12px;">
                    <div class="spinner" style="margin:0 auto 10px;"></div>
                    <div style="font-size:14px; color:var(--gray-800); font-weight:600;">Cargando datos al sistema...</div>
                    <div style="font-size:12px; color:var(--gray-500); margin-top:4px;">No cierres esta ventana</div>
                </div>
                <div class="progress-container">
                    <div class="progress-text">
                        <span id="progressLabel">0 de ${total}</span>
                        <span id="progressPct">0%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" id="progressBarFill"></div>
                    </div>
                </div>
            `;
            document.getElementById('excelModalTitle').textContent = 'Actualizando NRO. MOLDE';
            document.getElementById('excelModalOverlay').classList.add('active');
        }

        function actualizarProgreso(current, total) {
            const pct = Math.round((current / total) * 100);
            const fill = document.getElementById('progressBarFill');
            const label = document.getElementById('progressLabel');
            const pctLabel = document.getElementById('progressPct');
            if (fill) fill.style.width = pct + '%';
            if (label) label.textContent = current + ' de ' + total;
            if (pctLabel) pctLabel.textContent = pct + '%';
            if (current === total && fill) fill.classList.add('done');
        }

        async function enviarActualizacionesMolde(matches, noEncontrados, totalExcelRows, btn) {
            let exitosos = 0;
            let errores = 0;
            const total = matches.length;

            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                try {
                    await window.PcpProgramaService.actualizarCampo(match.rowIndex, 'NRO. MOLDE', match.nroMolde, { noCors: true });
                    exitosos++;
                } catch (err) {
                    console.error('Error actualizando OC ' + match.oc + ':', err);
                    errores++;
                }
                actualizarProgreso(i + 1, total);
            }

            // Limpiar cachÃ© y recargar datos
            localStorage.removeItem(CACHE_KEY);
            showToast('âœ“ ' + exitosos + ' moldes actualizados', 'success');

            // PequeÃ±a pausa para que se vea el 100%
            await new Promise(r => setTimeout(r, 500));

            // Mostrar resumen
            mostrarResumenExcel(exitosos, noEncontrados.length, noEncontrados, totalExcelRows);

            btn.disabled = false;

            // Recargar datos frescos del servidor
            reloadData(true);
        }

        function mostrarResumenExcel(actualizados, sinCoincidencia, listaNoEncontrados, totalExcel) {
            const body = document.getElementById('excelModalBody');
            let html = '';
            html += '<div class="summary-item"><span class="summary-label">Registros en Excel con NRO. MOLDE</span><span class="summary-value">' + totalExcel + '</span></div>';
            html += '<div class="summary-item"><span class="summary-label">Moldes asignados correctamente</span><span class="summary-value success">' + actualizados + '</span></div>';
            html += '<div class="summary-item"><span class="summary-label">OC sin coincidencia en Excel</span><span class="summary-value warning">' + sinCoincidencia + '</span></div>';

            if (listaNoEncontrados.length > 0) {
                // Agrupar por CLIENTE
                const grouped = {};
                listaNoEncontrados.forEach(item => {
                    const cli = normalizeClientName(item.cliente || '') || 'SIN CLIENTE';
                    if (!grouped[cli]) grouped[cli] = [];
                    grouped[cli].push(item.oc);
                });

                html += '<div style="margin-top:12px; font-size:12px; color:var(--gray-500);">OC que permanecen sin NRO. MOLDE:</div>';
                html += '<div class="not-found-list">';
                Object.keys(grouped).sort().forEach(cliente => {
                    html += '<div class="client-group">';
                    html += '<div class="client-name">' + cliente + '</div>';
                    html += '<div class="client-ocs">';
                    grouped[cliente].forEach(oc => {
                        html += '<div>' + oc + '</div>';
                    });
                    html += '</div></div>';
                });
                html += '</div>';
            }

            body.innerHTML = html;
            document.getElementById('excelModalTitle').textContent = actualizados > 0 ? 'âœ“ Carga completada' : 'Sin coincidencias';
            document.getElementById('excelModalOverlay').classList.add('active');
        }

        function cerrarModalExcel() {
            document.getElementById('excelModalOverlay').classList.remove('active');
        }

        // Cargar datos al iniciar (mas rapido que esperar window.load)
        window.addEventListener('DOMContentLoaded', () => {
            reloadData();
            if (window.requestIdleCallback) {
                requestIdleCallback(() => { ensureXlsxLoaded().catch(() => {}); }, { timeout: 2000 });
            }
        });
    
