function formatearFechaDespacho(valor) {
    if (!valor || valor === '') return '';
    const mesesEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Si es string con formato Date(yyyy,mm,dd)
    if (typeof valor === 'string') {
        const m = valor.match(/Date\((\d+),(\d+),(\d+)\)/);
        if (m) {
            const year = m[1];
            const month = parseInt(m[2], 10);
            const day = String(m[3]).padStart(2, '0');
            const monthName = mesesEs[month] || '';
            return `${day}/${monthName}`;
        }
    }
    return valor;
}

// Funci?n para descargar Excel "Correo Almacen" con datos filtrados usando ExcelJS
window.downloadCorreoAlmacenExcel = async function () {
    if (!rawData || rawData.length < 2) {
        alert('No hay datos disponibles para descargar.');
        return;
    }

    // Definir las columnas espec?ficas que queremos exportar (en el orden correcto)
    const columnasExportar = [
        'CLIENTE', 'OP', 'CORTE', 'COLOR', 'PDS GIRADAS',
        'OP TELA', 'PARTIDA', 'KG GIRADOS', 'RIB',
        'ART?CULO', 'NRO. MOLDE', 'F. DESPACHO', 'P'
    ];

    // Obtener ?ndices de las columnas a exportar
    const headers = rawData[0];
    const colIndices = columnasExportar.map(col => {
        const idx = getColIndex(col);
        return idx !== -1 ? idx : null;
    }).filter(idx => idx !== null);

    // Obtener el ?ndice de la columna "F. DESPACHO" para formatearla
    const idxFDespacho = getColIndex('F. DESPACHO');
    const idxFDespachoEnExportar = columnasExportar.indexOf('F. DESPACHO');

    // Obtener el ?ndice de la columna "F.PROGBAC" para el filtro de fecha
    const idxFProgbac = getColIndex('F.PROGBAC');

    // Funci?n para parsear fechas en diferentes formatos
    function parsearFecha(fechaStr) {
        if (!fechaStr) return null;

        // Formato: Date(2026,0,27) - Google Sheets Date object
        const dateMatch = fechaStr.match(/Date\((\d{4}),(\d+),(\d+)\)/);
        if (dateMatch) {
            const ano = parseInt(dateMatch[1]);
            const mes = String(parseInt(dateMatch[2]) + 1).padStart(2, '0'); // Suma 1 porque mes 0 = enero
            const dia = String(parseInt(dateMatch[3])).padStart(2, '0');
            return `${dia}/${mes}/${ano}`;
        }

        // Si es un formato de fecha normal, devolver como est?
        return fechaStr;
    }

    // Obtener la fecha de hoy
    const todayFilter = new Date();
    const dayToday = String(todayFilter.getDate()).padStart(2, '0');
    const monthToday = String(todayFilter.getMonth() + 1).padStart(2, '0');
    const yearToday = todayFilter.getFullYear();
    // Crear diferentes formatos posibles para comparar
    const fechaHoyFormatos = [
        `${dayToday}/${monthToday}/${yearToday}`,  // dd/mm/yyyy
        `${dayToday}/${monthToday}/2026`,          // dd/mm/2026
        `${dayToday}/${monthToday}`,               // dd/mm
        `${dayToday}-${monthToday}-${yearToday}`   // dd-mm-yyyy
    ];

    console.log('DEBUG - idxFProgbac:', idxFProgbac);
    console.log('DEBUG - fechaHoyFormatos:', fechaHoyFormatos);

    // Filtrar datos seg?n los criterios y agrupar por RUTA TELA
    const grupoLavada = [];
    const grupoAcabada = [];

    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        const rutaTela = (getVal(row, 'RUTA TELA') || '').toString().trim().toUpperCase();
        const estadoBloqueo = (getVal(row, 'estado_bloqueo') || '').toString().trim().toUpperCase();
        const estadoCorte = (getVal(row, 'STATUS_CORTE') || getVal(row, 'STATUS') || getVal(row, 'estado_corte') || getVal(row, 'ESTADO_CORTE') || '').toString().trim().toUpperCase();

        // Obtener el valor de F.PROGBAC y verificar si es igual a hoy
        const fProgbacRaw = (idxFProgbac !== -1 ? (row[idxFProgbac] || '').toString().trim() : '');
        const fProgbac = parsearFecha(fProgbacRaw);
        const esHoy = fechaHoyFormatos.includes(fProgbac);

        // DEBUG - mostrar primera fila y algunas con datos
        if (i === 1 || (fProgbac && fProgbac.length > 0)) {
            console.log(`DEBUG Fila ${i}: F.PROGBAC_RAW="${fProgbacRaw}" | F.PROGBAC_PARSED="${fProgbac}" | esHoy=${esHoy} | RUTA="${rutaTela}" | estado_bloqueo="${estadoBloqueo}" | estado_corte="${estadoCorte}"`);
        }

        // Extraer solo las columnas necesarias
        const rowFiltrada = colIndices.map((idx, posicion) => {
            const valor = row[idx] || '';
            // Formatear la columna "F. DESPACHO"
            if (idxFDespachoEnExportar === posicion && idxFDespacho !== -1) {
                return formatearFechaDespacho(valor);
            }
            return valor;
        });

        // Criterio 1: RUTA TELA = "LAVADA", estado_bloqueo = "PROG" Y F.PROGBAC = HOY
        if (rutaTela === 'LAVADA' && estadoBloqueo === 'PROG' && esHoy) {
            grupoLavada.push({
                row: rowFiltrada,
                kgGirados: parseFloat(getVal(row, 'KG GIRADOS')) || 0,
                pdsGiradas: parseFloat(getVal(row, 'PDS GIRADAS')) || 0
            });
        }
        // Criterio 2: RUTA TELA = "ACABADA", estado_corte = "PROG 1T", "PROG 2T" o "PROG 3T" Y F.PROGBAC = HOY
        else if (rutaTela === 'ACABADA' && (estadoCorte === 'PROG 1T' || estadoCorte === 'PROG 2T' || estadoCorte === 'PROG 3T') && esHoy) {
            grupoAcabada.push({
                row: rowFiltrada,
                kgGirados: parseFloat(getVal(row, 'KG GIRADOS')) || 0,
                pdsGiradas: parseFloat(getVal(row, 'PDS GIRADAS')) || 0
            });
        }
    }

    if (grupoLavada.length === 0 && grupoAcabada.length === 0) {
        alert('No hay datos que cumplan los criterios de filtro.');
        return;
    }

    // Crear encabezados filtrados
    const headersFiltrados = colIndices.map(idx => headers[idx]);

    // Crear workbook y worksheet con ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Hoja 1');

    // Definir anchos de columna
    worksheet.columns = [
        { width: 30 }, // CLIENTE
        { width: 10 }, // OP
        { width: 10 }, // CORTE
        { width: 25 }, // COLOR
        { width: 12 }, // PDS GIRADAS
        { width: 10 }, // OP TELA
        { width: 10 }, // PARTIDA
        { width: 12 }, // KG GIRADOS
        { width: 10 }, // RIB
        { width: 45 }, // ART?CULO
        { width: 15 }, // NRO. MOLDE
        { width: 13 }, // F. DESPACHO
        { width: 8 }   // P
    ];

    // Agregar encabezados con formato
    const headerRow = worksheet.addRow(headersFiltrados);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.eachCell((cell) => {
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };
    });

    const idxKgGirados = headersFiltrados.indexOf('KG GIRADOS') + 1; // +1 porque las columnas en ExcelJS son 1-indexed
    const idxPdsGiradas = headersFiltrados.indexOf('PDS GIRADAS') + 1;

    // Calcular sumas antes de crear el Excel
    let sumaKgLavada = 0;
    let sumaPdsLavada = 0;
    let sumaKgAcabada = 0;
    let sumaPdsAcabada = 0;

    if (grupoLavada.length > 0) {
        sumaKgLavada = grupoLavada.reduce((sum, item) => sum + item.kgGirados, 0);
        sumaPdsLavada = grupoLavada.reduce((sum, item) => sum + item.pdsGiradas, 0);
    }

    if (grupoAcabada.length > 0) {
        sumaKgAcabada = grupoAcabada.reduce((sum, item) => sum + item.kgGirados, 0);
        sumaPdsAcabada = grupoAcabada.reduce((sum, item) => sum + item.pdsGiradas, 0);
    }

    // Agregar grupo LAVADA si tiene datos
    if (grupoLavada.length > 0) {
        // Fila de t?tulo "RUTA TELA: LAVADA"
        const tituloLavadaRow = worksheet.addRow(['RUTA TELA: LAVADA']);
        worksheet.mergeCells(tituloLavadaRow.number, 1, tituloLavadaRow.number, headersFiltrados.length);
        tituloLavadaRow.font = { bold: true, color: { argb: 'FF000000' }, size: 11, name: 'Calibri' };
        tituloLavadaRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC66' } };
        tituloLavadaRow.alignment = { horizontal: 'left', vertical: 'middle' };

        // Datos de LAVADA
        grupoLavada.forEach(item => {
            const dataRow = worksheet.addRow(item.row);
            dataRow.font = { size: 11, name: 'Calibri' };
            dataRow.alignment = { vertical: 'middle' };
            dataRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
                };
            });
        });

        // Fila de suma para LAVADA
        const sumRowLavada = worksheet.addRow([]);
        sumRowLavada.getCell(idxPdsGiradas).value = parseFloat(sumaPdsLavada.toFixed(0));
        sumRowLavada.getCell(idxKgGirados).value = parseFloat(sumaKgLavada.toFixed(1));
        sumRowLavada.font = { bold: true, size: 11, name: 'Calibri' };
        sumRowLavada.getCell(idxPdsGiradas).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
        sumRowLavada.getCell(idxKgGirados).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
    }

    // Agregar grupo ACABADA si tiene datos
    if (grupoAcabada.length > 0) {
        // Fila de t?tulo "RUTA TELA: ACABADA"
        const tituloAcabadaRow = worksheet.addRow(['RUTA TELA: ACABADA']);
        worksheet.mergeCells(tituloAcabadaRow.number, 1, tituloAcabadaRow.number, headersFiltrados.length);
        tituloAcabadaRow.font = { bold: true, color: { argb: 'FF000000' }, size: 11, name: 'Calibri' };
        tituloAcabadaRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC66' } };
        tituloAcabadaRow.alignment = { horizontal: 'left', vertical: 'middle' };

        // Datos de ACABADA
        grupoAcabada.forEach(item => {
            const dataRow = worksheet.addRow(item.row);
            dataRow.font = { size: 11, name: 'Calibri' };
            dataRow.alignment = { vertical: 'middle' };
            dataRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
                };
            });
        });

        // Fila de suma para ACABADA
        const sumRowAcabada = worksheet.addRow([]);
        sumRowAcabada.getCell(idxPdsGiradas).value = parseFloat(sumaPdsAcabada.toFixed(0));
        sumRowAcabada.getCell(idxKgGirados).value = parseFloat(sumaKgAcabada.toFixed(1));
        sumRowAcabada.font = { bold: true, size: 11, name: 'Calibri' };
        sumRowAcabada.getCell(idxPdsGiradas).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
        sumRowAcabada.getCell(idxKgGirados).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
    }

    // Generar nombre del archivo con fecha actual (dd-mmm)
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const month = months[today.getMonth()];
    const fileName = `PROGRAMA DE BLOQUEO Y LAVADO (${day}-${month})`;

    // Generar archivo Excel y descargar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName + '.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);

    // Esperar un poco antes de generar la imagen
    setTimeout(async () => {
        // Generar tabla HTML para convertir a imagen
        let htmlTable = '<table style="border-collapse: collapse; font-family: Calibri; font-size: 11px; background: white;">';

        // Agregar encabezados
        htmlTable += '<tr>';
        headersFiltrados.forEach(header => {
            htmlTable += `<td style="border: 1px solid #000; background-color: #4472C4; color: white; padding: 8px; font-weight: bold; text-align: center;">${header}</td>`;
        });
        htmlTable += '</tr>';

        // Agregar grupo LAVADA
        if (grupoLavada.length > 0) {
            htmlTable += `<tr><td colspan="${headersFiltrados.length}" style="border: 1px solid #D0D0D0; background-color: #FFCC66; padding: 8px; font-weight: bold;">RUTA TELA: LAVADA</td></tr>`;
            grupoLavada.forEach(item => {
                htmlTable += '<tr>';
                item.row.forEach(cell => {
                    htmlTable += `<td style="border: 1px solid #D0D0D0; padding: 6px;">${cell}</td>`;
                });
                htmlTable += '</tr>';
            });
            htmlTable += '<tr>';
            headersFiltrados.forEach((header, idx) => {
                const isPds = header === 'PDS GIRADAS';
                const isKg = header === 'KG GIRADOS';
                let cellValue = '';
                if (isPds) cellValue = parseFloat(sumaPdsLavada.toFixed(0));
                else if (isKg) cellValue = parseFloat(sumaKgLavada.toFixed(1));
                htmlTable += `<td style="border: 1px solid #D0D0D0; background-color: #E7E6E6; padding: 6px; font-weight: bold; ${(isPds || isKg) ? 'text-align: center;' : ''}">${cellValue}</td>`;
            });
            htmlTable += '</tr>';
        }

        // Agregar grupo ACABADA
        if (grupoAcabada.length > 0) {
            htmlTable += `<tr><td colspan="${headersFiltrados.length}" style="border: 1px solid #D0D0D0; background-color: #FFCC66; padding: 8px; font-weight: bold;">RUTA TELA: ACABADA</td></tr>`;
            grupoAcabada.forEach(item => {
                htmlTable += '<tr>';
                item.row.forEach(cell => {
                    htmlTable += `<td style="border: 1px solid #D0D0D0; padding: 6px;">${cell}</td>`;
                });
                htmlTable += '</tr>';
            });
            htmlTable += '<tr>';
            headersFiltrados.forEach((header, idx) => {
                const isPds = header === 'PDS GIRADAS';
                const isKg = header === 'KG GIRADOS';
                let cellValue = '';
                if (isPds) cellValue = parseFloat(sumaPdsAcabada.toFixed(0));
                else if (isKg) cellValue = parseFloat(sumaKgAcabada.toFixed(1));
                htmlTable += `<td style="border: 1px solid #D0D0D0; background-color: #E7E6E6; padding: 6px; font-weight: bold; ${(isPds || isKg) ? 'text-align: center;' : ''}">${cellValue}</td>`;
            });
            htmlTable += '</tr>';
        }

        htmlTable += '</table>';

        // Crear elemento temporal para renderizar la tabla
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlTable;
        tempDiv.style.position = 'fixed';
        tempDiv.style.top = '0';
        tempDiv.style.left = '0';
        tempDiv.style.backgroundColor = 'white';
        tempDiv.style.padding = '10px';
        tempDiv.style.zIndex = '10000';
        document.body.appendChild(tempDiv);

        // Convertir tabla a imagen
        try {
            const canvas = await html2canvas(tempDiv, {
                scale: 2,
                backgroundColor: '#ffffff',
                allowTaint: true,
                useCORS: true
            });
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = fileName + '.png';
            link.click();
            document.body.removeChild(tempDiv);

            // Abrir Outlook de escritorio despu?s de generar los archivos
            setTimeout(() => {
                abrirOutlookCorreoAlmacen(fileName);
            }, 500);
        } catch (err) {
            console.error('Error al generar imagen:', err);
            document.body.removeChild(tempDiv);
            alert('Error al generar la imagen. El archivo Excel se descarg? correctamente.');
        }
    }, 500);
};

// Funci?n para abrir Outlook de escritorio con el correo preparado
function abrirOutlookCorreoAlmacen(fileName) {
    // Destinatarios
    const destinatarios = [
        'msilva@cofaco.com',
        'Tizado@cofaco.com',
        'jefecorte@cofaco.com',
        'Lavanderia01@cofaco.com',
        'corte@cofaco.com',
        'WHodali@cofaco.com'
    ].join(';');

    // Fecha para el asunto: ddd dd/mmm - yyyy
    const today = new Date();
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mi?', 'Jue', 'Vie', 'S?b'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const diaSemana = diasSemana[today.getDay()];
    const dia = String(today.getDate()).padStart(2, '0');
    const mes = meses[today.getMonth()];
    const anio = today.getFullYear();

    const asunto = `PROGRAMA DE BLOQUEO Y LAVADO ${diaSemana} ${dia}/${mes} - ${anio}`;

    // Saludo seg?n la hora
    const hora = today.getHours();
    const saludo = hora < 12 ? 'Buenos d?as' : 'Buenas tardes';

    // Cuerpo del correo
    const cuerpo = `Hola Marco, ${saludo}

    Por favor pasar las siguientes telas a corte, si hay algo anexado avisar y pasar.

    [PEGAR IMAGEN AQU?]

    Gracias.
    PCP Confecciones

    ---
    NOTA: Por favor adjunte los archivos descargados (${fileName}.xlsx y ${fileName}.png)`;

    // Crear URL mailto para abrir Outlook
    const mailtoUrl = `mailto:${destinatarios}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

    // Abrir Outlook
    window.location.href = mailtoUrl;
}
