
    // Variables globales para el modal de búsqueda
    let registrosEncontrados = [];
    let registrosEditados = {};

    // ============ FUNCIONES DEL MODAL DE BÚSQUEDA ============
    
    function abrirModalBuscar() {
        document.getElementById('modalBuscar').classList.add('active');
    }

    function cerrarModalBuscar() {
        document.getElementById('modalBuscar').classList.remove('active');
        // Limpiar búsqueda
        document.getElementById('inputBuscarOP').value = '';
        document.getElementById('inputBuscarCorte').value = '';
        document.getElementById('resultadosBusqueda').innerHTML = 
            '<p class="no-results">Ingresa un OP o CORTE para buscar registros.</p>';
        registrosEncontrados = [];
        registrosEditados = {};
    }

    // Manejar Enter en campo OP: buscar y mover foco a CORTE
    function handleEnterOP(event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
            event.preventDefault();
            buscarRegistros();
            document.getElementById('inputBuscarCorte').focus();
        }
    }

    // Manejar Enter en campo CORTE: buscar
    function handleEnterCorte(event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
            event.preventDefault();
            buscarRegistros();
        }
    }

    async function buscarRegistros() {
        const op = document.getElementById('inputBuscarOP').value.trim();
        const corte = document.getElementById('inputBuscarCorte').value.trim();

        if (!op && !corte) {
            alert('Por favor, ingresa al menos un OP o CORTE para buscar.');
            return;
        }

        const resultadosDiv = document.getElementById('resultadosBusqueda');
        resultadosDiv.innerHTML = '<p class="loading" style="padding:20px; text-align:center;">Buscando...</p>';

        try {
            // Obtener todos los datos del sheet
            const todosLosDatos = await window.PcpProgramaService.obtenerTodosLosDatos(
                { errorMessage: 'Error al obtener datos del sheet' }
            );

            // Filtrar por OP y/o CORTE
            const normalizar = (valor) => {
                return valor ? valor.toString().trim().replace(/^0+/, '').toUpperCase() : '';
            };

            const opNormalizado = normalizar(op);
            const corteNormalizado = normalizar(corte);

            registrosEncontrados = todosLosDatos.filter(registro => {
                const regOP = normalizar(registro.op || '');
                const regCorte = normalizar(registro.corte || '');
                
                let match = true;
                if (opNormalizado && !regOP.includes(opNormalizado)) match = false;
                if (corteNormalizado && !regCorte.includes(corteNormalizado)) match = false;
                
                return match;
            });

            if (registrosEncontrados.length === 0) {
                resultadosDiv.innerHTML = '<p class="no-results">No se encontraron registros con los criterios de búsqueda.</p>';
                return;
            }

            // Mostrar tabla con resultados
            mostrarTablaResultados();

        } catch (error) {
            console.error('Error en búsqueda:', error);
            resultadosDiv.innerHTML = '<p class="error" style="padding:20px;">Error al buscar: ' + error.message + '</p>';
        }
    }

    function mostrarTablaResultados() {
        const resultadosDiv = document.getElementById('resultadosBusqueda');
        
        let html = '<table class="results-table">';
        html += '<thead><tr>';
        html += '<th style="width:40px;"></th>'; // Columna eliminar
        html += '<th>CLIENTE</th>';
        html += '<th>OP</th>';
        html += '<th>CORTE</th>';
        html += '<th>PDS GIRADAS</th>';
        html += '<th>OP TELA</th>';
        html += '<th>PARTIDA</th>';
        html += '<th>KG GIRADOS</th>';
        html += '</tr></thead><tbody>';

        // Función para normalizar nombres de cliente
        function normalizeClient(name) {
            if (!name) return '';
            const s = name.toString().toUpperCase().trim();
            if (s.indexOf('LULULEMON') !== -1) return 'LULULEMON';
            if (s.indexOf('AM RETAIL') !== -1) return 'AM RETAIL';
            if (s.indexOf('ATHLETA') !== -1) return 'ATHLETA';
            if (s.indexOf('BANANA REPUBLIC') !== -1) return 'BANANA';
            if (s.indexOf('LACOSTE') !== -1) return 'LACOSTE';
            if (s.indexOf('SKECHERS') !== -1) return 'SKECHERS';
            if (s.indexOf('THEORY') !== -1) return 'THEORY';
            // Fallback: remove common suffixes and punctuation
            return s.replace(/,?\s*(LLC|L\.L\.C|INC|INC\.|S\.A\.C\.|LLP|CORP|CO\.|CO|SAC)\.?/g, '').replace(/\s*-.*$/,'').trim();
        }

        registrosEncontrados.forEach((registro, index) => {
            // Asignar el índice de fila real del sheet (rowIndex)
            const rowIndex = registro.rowIndex || index + 2; // +2 porque hay encabezado
            
            html += '<tr>';
            // Columna eliminar
            html += `<td><button class="btn-delete" onclick="eliminarRegistro(${index}, ${rowIndex})" title="Eliminar">🗑</button></td>`;
            html += `<td>${normalizeClient(registro.cliente) || ''}</td>`;
            html += `<td>${registro.op || ''}</td>`;
            html += `<td>${registro.corte || ''}</td>`;
            // PDS GIRADAS - editable
            html += `<td><input type="number" value="${registro.pds_giradas || ''}" onchange="marcarEditado(${index}, 'pds_giradas', this.value)"></td>`;
            // OP TELA - editable
            html += `<td><input type="text" value="${registro.op_tela || ''}" onchange="marcarEditado(${index}, 'op_tela', this.value)"></td>`;
            // PARTIDA - editable
            html += `<td><input type="text" value="${registro.partida || ''}" onchange="marcarEditado(${index}, 'partida', this.value)"></td>`;
            // KG GIRADOS - editable
            html += `<td><input type="number" step="0.01" value="${registro.kg_girados || ''}" onchange="marcarEditado(${index}, 'kg_girados', this.value)"></td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        html += '<button class="btn-guardar-modal" onclick="guardarCambios()">Guardar Cambios</button>';
        
        resultadosDiv.innerHTML = html;
    }

    function marcarEditado(index, campo, valor) {
        if (!registrosEditados[index]) {
            registrosEditados[index] = {
                rowIndex: registrosEncontrados[index].rowIndex || index + 2,
                op: registrosEncontrados[index].op,
                corte: registrosEncontrados[index].corte,
                cambios: {}
            };
        }
        registrosEditados[index].cambios[campo] = valor;
    }

    async function guardarCambios() {
        const editados = Object.values(registrosEditados);
        
        if (editados.length === 0) {
            alert('No hay cambios para guardar.');
            return;
        }

        if (!confirm(`¿Deseas guardar los cambios en ${editados.length} registro(s)?`)) {
            return;
        }

        const resultadosDiv = document.getElementById('resultadosBusqueda');
        const contenidoOriginal = resultadosDiv.innerHTML;
        resultadosDiv.innerHTML = '<p class="loading" style="padding:20px; text-align:center;">Guardando cambios...</p>';

        try {
            await window.PcpProgramaService.actualizarRegistros(editados, { noCors: true });

            // Con no-cors no podemos leer la respuesta, asumimos éxito
            alert('¡Cambios guardados correctamente!');
            registrosEditados = {};
            
            // Re-buscar para mostrar datos actualizados
            await buscarRegistros();

        } catch (error) {
            console.error('Error guardando cambios:', error);
            alert('Error al guardar cambios: ' + error.message);
            resultadosDiv.innerHTML = contenidoOriginal;
        }
    }

    async function eliminarRegistro(index, rowIndex) {
        const registro = registrosEncontrados[index];
        
        if (!confirm(`¿Estás seguro de eliminar este registro?\n\nOP: ${registro.op || ''}\nCORTE: ${registro.corte || ''}`)) {
            return;
        }

        const resultadosDiv = document.getElementById('resultadosBusqueda');
        const contenidoOriginal = resultadosDiv.innerHTML;
        resultadosDiv.innerHTML = '<p class="loading" style="padding:20px; text-align:center;">Eliminando registro...</p>';

        try {
            await window.PcpProgramaService.eliminarRegistroConReferencia(rowIndex, {
                op: registro.op,
                corte: registro.corte
            }, { noCors: true });

            // Con no-cors asumimos éxito
            alert('¡Registro eliminado correctamente!');
            
            // Re-buscar para actualizar la tabla
            await buscarRegistros();

        } catch (error) {
            console.error('Error eliminando registro:', error);
            alert('Error al eliminar: ' + error.message);
            resultadosDiv.innerHTML = contenidoOriginal;
        }
    }

    // ============ FUNCIONES ORIGINALES ============

    function mostrarStatus(mensaje, tipo) {
        const div = document.getElementById('status');
        div.style.display = 'block';
        div.className = tipo;
        div.innerText = mensaje;
    }

    async function procesarExcel() {
        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];

        if (!file) {
            mostrarStatus("Por favor selecciona un archivo primero.", "error");
            return;
        }

        mostrarStatus("Procesando archivo...", "loading");
        document.getElementById('btnProcesar').disabled = true;

        const reader = new FileReader();

        reader.onload = async function(e) {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, {type: 'binary'});
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet, {header: 1});

                const datosLimpios = limpiarDatos(rawData);
                
                if (datosLimpios.length === 0) {
                    throw new Error("No se encontraron datos válidos para cargar.");
                }

                // Obtener datos existentes del sheet
                mostrarStatus("Verificando duplicados en el sistema...", "loading");
                const datosExistentes = await obtenerDatosExistentes();

                // Filtrar duplicados
                const {datosFiltrados, duplicados} = filtrarDuplicados(datosLimpios, datosExistentes);

                if (duplicados.length > 0) {
                    console.log('Registros duplicados encontrados:', duplicados);
                }

                if (datosFiltrados.length === 0) {
                    mostrarStatus(`Todos los registros (${datosLimpios.length}) ya existen en el sistema. No hay nada que cargar.`, "error");
                    document.getElementById('btnProcesar').disabled = false;
                    return;
                }

                // Mostrar resumen
                if (duplicados.length > 0) {
                    mostrarStatus(`Se cargarán ${datosFiltrados.length} registros nuevos. ${duplicados.length} duplicados omitidos.`, "loading");
                }

                await enviarAGoogleSheets(datosFiltrados);

            } catch (error) {
                mostrarStatus("Error: " + error.message, "error");
                document.getElementById('btnProcesar').disabled = false;
            }
        };

        reader.onerror = function() {
            mostrarStatus("Error al leer el archivo.", "error");
            document.getElementById('btnProcesar').disabled = false;
        };

        reader.readAsBinaryString(file);
    }

    function limpiarDatos(rawData) {
        let headerRowIndex = -1;
        
        // 1. Buscar fila de encabezado
        for (let i = 0; i < rawData.length; i++) {
            if (rawData[i] && rawData[i].toString().includes("F. DESPACHO")) {
                headerRowIndex = i; break;
            }
        }
        if (headerRowIndex === -1) throw new Error("No se encontró la fila de encabezado 'F. DESPACHO'.");

        const headers = rawData[headerRowIndex];
        const colMap = {};
        
        // Mapeamos los nombres de columna
        headers.forEach((h, i) => { if(h) colMap[h.toString().trim()] = i; });

        // Orden de columnas deseado
        const columnasDeseadas = [
            "F. DESPACHO", "F. GIRADO", "RSV", "CLIENTE", "OP", "CORTE", "COLOR", 
            "PDS GIRADAS", "OP TELA", "PARTIDA", "KG GIRADOS", "RIB", "ARTÍCULO", 
            "ESTILO", "NRO. MOLDE", "PRENDA", "TIPO CERTIFICADO", "RUTA TELA"
        ];

        // Columnas que son FECHAS
        const columnasFecha = ["F. DESPACHO", "F. GIRADO"];
        
        // Columnas a regularizar (Quitar ceros y espacios)
        const colsRegularizar = ["OP TELA", "PARTIDA"];

        const datosFinales = [];

        // --- DETECTAR INDICES DE 'F. ING COST' Y 'PLANTA' (variantes) ---
        const normalizeHeader = (h) => (h || '').toString().toLowerCase().replace(/\s+/g, '').replace(/\./g,'').replace(/_/g,'').replace(/-/g,'').trim();
        let idxFIngCost = -1;
        let idxPlanta = -1;
        let idxDscColorPrenda = -1;
        let idxHiloCostura = -1;
        Object.keys(colMap).forEach(k => {
            const nk = normalizeHeader(k);
            if (nk === 'fingcost') idxFIngCost = colMap[k];
            if (nk === 'planta') idxPlanta = colMap[k];
            if (nk === 'dsccolorprenda') idxDscColorPrenda = colMap[k];
            if (nk === 'hilocostura') idxHiloCostura = colMap[k];
        });

        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const filaOriginal = rawData[i];
            
            // Si no hay fila o no tiene OP, saltamos
            if (!filaOriginal || !filaOriginal[colMap["OP"]]) continue; 

            // Filtrar OP menores a 39000
            const opValor = parseInt(filaOriginal[colMap["OP"]], 10);
            if (!isNaN(opValor) && opValor < 39000) continue;

            // Filtrar CORTE de 9000 a 9999 (no se cargan al sheet ni al correo)
            const corteValor = parseInt(filaOriginal[colMap["CORTE"]], 10);
            if (!isNaN(corteValor) && corteValor >= 9000 && corteValor <= 9999) continue;

            const filaLimpia = [];

            columnasDeseadas.forEach(colNombre => {
                const indexOrigen = colMap[colNombre];
                let valor = (indexOrigen !== undefined) ? filaOriginal[indexOrigen] : "";

                // Si COLOR es LISTADO, PFD+ o PFD +, usar DSC. COLOR PRENDA cuando exista.
                if (colNombre === "COLOR") {
                    const colorNorm = (valor || "").toString().trim().toUpperCase();
                    if ((colorNorm === "LISTADO" || colorNorm === "PFD+" || colorNorm === "PFD +") && idxDscColorPrenda !== -1) {
                        const dscColor = filaOriginal[idxDscColorPrenda];
                        if (dscColor !== undefined && dscColor !== null && dscColor.toString().trim() !== "") {
                            valor = dscColor;
                        }
                    }
                }

                // --- CONVERSIÓN DE FECHAS ---
                if (columnasFecha.includes(colNombre) && typeof valor === 'number') {
                    valor = excelFechaATexto(valor); 
                }
                
                // --- REGULARIZACIÓN (Trim + Quitar Ceros a la izquierda) ---
                if (colsRegularizar.includes(colNombre) && valor) {
                    // Convertimos a string, quitamos espacios laterales y luego ceros al inicio
                    valor = valor.toString().trim().replace(/^0+/, '');
                }

                filaLimpia.push(valor || "");
            });

            // Rellenar 18 columnas vacías extra
            for(let j=0; j<18; j++) filaLimpia.push("");

            // Asignar valores a las columnas S y T del sheet (índices 18 y 19, 0-based)
            // Estas corresponden a `F.ING.COST` y `PLANTA` en la hoja destino.
            try {
                if (idxFIngCost !== -1) {
                    let v = filaOriginal[idxFIngCost];
                    if (typeof v === 'number') v = excelFechaATexto(v);
                    filaLimpia[18] = v || "";
                }
                if (idxPlanta !== -1) {
                    let v2 = filaOriginal[idxPlanta];
                    filaLimpia[19] = v2 || "";
                }
                if (idxHiloCostura !== -1) {
                    while (filaLimpia.length <= 50) filaLimpia.push("");
                    let v3 = filaOriginal[idxHiloCostura];
                    filaLimpia[50] = v3 || "";
                }
            } catch(e) { /* ignore assignment errors */ }
            
            datosFinales.push(filaLimpia);
        }
        return datosFinales;
    }

    function excelFechaATexto(serial) {
        // Conversión de número serial de Excel a Fecha dd/mmm/yyyy
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400; 
        const dateInfo = new Date(utc_value * 1000);

        const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
        
        const dia = dateInfo.getUTCDate().toString().padStart(2, '0');
        const mes = meses[dateInfo.getUTCMonth()];
        const anio = dateInfo.getUTCFullYear();

        return `${dia}/${mes}/${anio}`;
    }

    async function obtenerDatosExistentes() {
        // Obtiene TODOS los datos del sheet para verificar duplicados (no solo últimos 5 días)
        try {
            console.log('Consultando datos existentes...');
            const datos = await window.PcpProgramaService.obtenerTodosLosDatos(
                { errorMessage: 'Error al obtener datos del sheet' }
            );
            console.log('Datos obtenidos del sheet:', datos.length, 'registros');
            console.log('Muestra de datos:', datos.slice(0, 3));
            return datos; // Debe retornar array con {op, corte, estado_bloqueo, estado_lavada, estado_corte}
        } catch (error) {
            console.error('Error obteniendo datos existentes:', error);
            throw error;
        }
    }

    function filtrarDuplicados(datosNuevos, datosExistentes) {
        // Función auxiliar para normalizar (quitar ceros a la izquierda)
        const normalizar = (valor) => {
            return valor.toString().trim().replace(/^0+/, '') || '0';
        };
        
        // Crear Map con OP+CORTE como clave y los estados como valor
        const registrosExistentes = new Map();
        
        datosExistentes.forEach(row => {
            // Normalizar OP y CORTE antes de concatenar
            const op = normalizar(row.op || '');
            const corte = normalizar(row.corte || '');
            const concatenado = `${op}|${corte}`.toUpperCase();
            
            // CAMBIO: Agregar TODOS los registros al Map (sin filtrar por estados)
            // Para que cualquier OP+CORTE existente se considere duplicado
            registrosExistentes.set(concatenado, {
                estado_bloqueo: row.estado_bloqueo || '',
                estado_lavada: row.estado_lavada || '',
                estado_corte: row.estado_corte || ''
            });
        });
        
        console.log('Registros existentes con estados llenos:', registrosExistentes.size);
        console.log('Primeros 5 concatenados:', Array.from(registrosExistentes.keys()).slice(0, 5));

        // Filtrar datos nuevos
        // Nota: además de comparar contra el sheet, también evitamos
        // duplicados dentro del mismo archivo que se está cargando.
        const datosFiltrados = [];
        const duplicados = [];
        const clavesNuevas = new Set();

        datosNuevos.forEach((fila, index) => {
            // Las columnas están en el orden definido en columnasDeseadas
            // ["F. DESPACHO", "F. GIRADO", "RSV", "CLIENTE", "OP", "CORTE", "COLOR", ...]
            const opRaw = (fila[4] || '').toString().trim();
            const corteRaw = (fila[5] || '').toString().trim();
            
            // Normalizar quitando ceros a la izquierda
            const op = normalizar(opRaw);
            const corte = normalizar(corteRaw);
            const concatenado = `${op}|${corte}`.toUpperCase();

            if (index < 3) {
                console.log(`Fila ${index}: OP="${opRaw}"→"${op}", CORTE="${corteRaw}"→"${corte}", Concatenado="${concatenado}"`);
            }

            const existeEnSheet = registrosExistentes.has(concatenado);
            const existeEnArchivo = clavesNuevas.has(concatenado);

            if (existeEnSheet || existeEnArchivo) {
                const estados = existeEnSheet
                    ? registrosExistentes.get(concatenado)
                    : {estado_bloqueo: '', estado_lavada: '', estado_corte: ''};
                duplicados.push({
                    op: opRaw,
                    corte: corteRaw,
                    estados,
                    origen: existeEnSheet ? 'sheet' : 'archivo'
                });
            } else {
                datosFiltrados.push(fila);
                clavesNuevas.add(concatenado);
            }
        });

        console.log(`Resultados: ${datosFiltrados.length} nuevos, ${duplicados.length} duplicados`);
        if (duplicados.length > 0) {
            console.log('Ejemplos de duplicados:', duplicados.slice(0, 3));
        }

        return {datosFiltrados, duplicados};
    }

    async function enviarAGoogleSheets(datos) {
        mostrarStatus("Enviando " + datos.length + " filas...", "loading");

        try {
            await window.PcpProgramaService.cargarGiros(datos, { noCors: true });
            
            mostrarStatus("¡Éxito! " + datos.length + " registros cargados correctamente.", "success");
            document.getElementById('btnProcesar').disabled = false;
            document.getElementById('fileInput').value = ""; // Limpiar input
            
            // Enviar correo automático con Outlook (con un pequeño delay)
            setTimeout(() => {
                enviarCorreoOutlook(datos);
            }, 500);
        } catch (error) {
            console.error('Error:', error);
            mostrarStatus("Error de conexión.", "error");
            document.getElementById('btnProcesar').disabled = false;
        }
    }

    function enviarCorreoOutlook(datos) {
        try {
            // Destinatarios
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

            // Obtener fecha actual en formato dd/mmm/yyyy
            const fecha = new Date();
            const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            const fechaFormato = `${fecha.getDate().toString().padStart(2, '0')}/${meses[fecha.getMonth()]}/${fecha.getFullYear()}`;

            // Asunto
            const asunto = `ordenes de corte giradas fecha ${fechaFormato}`;

            // Saludo según la hora
            const hora = fecha.getHours();
            const saludo = hora < 12 ? 'Buenos dias' : 'Buenas tardes';

            // Agrupar órdenes por cliente (almacenar op y corte por separado)
            const ordenesAgrupadas = {};
            datos.forEach(fila => {
                // fila[3] = CLIENTE, fila[4] = OP, fila[5] = CORTE
                const cliente = fila[3] || 'Sin Cliente';
                const op = fila[4] ? fila[4].toString().trim() : '';
                const corte = fila[5] ? fila[5].toString().trim() : '';
                
                // Excluir si CORTE es de 9000 a 9999
                const corteNum = parseInt(corte, 10);
                if (!isNaN(corteNum) && corteNum >= 9000 && corteNum <= 9999) {
                    return; // Saltar este registro
                }
                
                if (!ordenesAgrupadas[cliente]) {
                    ordenesAgrupadas[cliente] = [];
                }
                ordenesAgrupadas[cliente].push({op, corte});
            });

            // Construir cuerpo del correo (sin codificar aún)
            let cuerpoCorreo = `${saludo}\nOrdenes de corte giradas\n\n`;
            
            for (const cliente in ordenesAgrupadas) {
                cuerpoCorreo += `CLIENTE: ${cliente}\n`;
                ordenesAgrupadas[cliente].forEach(item => {
                    const op = item.op || '';
                    const corte = item.corte || '';
                    let displayCorte = '';
                    if (corte) {
                        const n = parseInt(corte, 10);
                        displayCorte = !isNaN(n) ? String(n) : corte.replace(/^0+/, '') || corte;
                    }
                    const linea = op + (displayCorte ? '-' + displayCorte : (corte ? '-' + corte : ''));
                    cuerpoCorreo += `${linea}\n`;
                });
                cuerpoCorreo += '\n';
            }

            cuerpoCorreo += 'Yolanda Lopez\nPCP Confecciones';

            // Crear enlace mailto para Outlook
            const mailtoLink = `mailto:${destinatarios}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpoCorreo)}`;

            console.log('Abriendo Outlook con correo...', mailtoLink.substring(0, 100));

            // Intentar abrir con window.open primero (más confiable)
            const opened = window.open(mailtoLink, '_self');
            
            // Si no funciona, intentar con location.href
            if (!opened) {
                window.location.href = mailtoLink;
            }
        } catch (error) {
            console.error('Error al abrir Outlook:', error);
            alert('No se pudo abrir Outlook automáticamente. Por favor, envía el correo manualmente.');
        }
    }
