
    const SHEET_ID = window.PCP_CONFIG.SHEET_ID;
    const state = { unit:'pds', ready:{pds:false,kg:false}, series:{pds:[],kg:[]}, details:{pds:null,kg:null}, errors:{pds:'',kg:''} };

    function reloadData(){
      state.ready.pds = false; state.ready.kg = false;
      state.series.pds = []; state.series.kg = [];
      state.details.pds = null; state.details.kg = null;
      state.errors.pds = ''; state.errors.kg = '';
      clearChart();
      clearProcessSummary();
      clearSummary();
      clearVariabilitySummary();
      setLoading(true); showError('');
      loadSheet('stock_pds', 'loadStockPdsData');
      loadSheet('stock_kg', 'loadStockKgData');
    }

    function loadSheet(sheetName, handlerName){
      window.PcpGoogleSheets.loadGvizJsonp({
        spreadsheetId: SHEET_ID,
        sheet: sheetName,
        label: sheetName,
        callbackPrefix: handlerName,
        cacheBust: false,
        errorMessage: 'Error cargando la hoja ' + sheetName
      }).then(jsonResponse => {
        if(typeof window[handlerName] === 'function') window[handlerName](jsonResponse);
      }).catch(() => {
        state.errors[sheetName === 'stock_pds' ? 'pds' : 'kg'] = 'Error cargando la hoja ' + sheetName;
        markReady(sheetName);
      });
    }

    function markReady(sheetName){
      const key = sheetName === 'stock_pds' ? 'pds' : 'kg';
      state.ready[key] = true;
      maybeRender();
    }

    window.loadStockPdsData = function(jsonResponse){ const parsed = parseStockSeries(jsonResponse); state.series.pds = parsed.series; state.details.pds = parsed; markReady('stock_pds'); };
    window.loadStockKgData = function(jsonResponse){ const parsed = parseStockSeries(jsonResponse); state.series.kg = parsed.series; state.details.kg = parsed; markReady('stock_kg'); };

    function maybeRender(){
      if(!state.ready.pds || !state.ready.kg) return;
      setLoading(false);
      const series = state.series[state.unit] || [];
      showError(state.errors[state.unit] || '');
      renderProcessBreakdown(state.details[state.unit], state.unit);
      renderWeeklyVariation(state.details[state.unit], state.unit);
      renderVariabilityPanel(state.details[state.unit], state.unit);
      if(series.length === 0){ drawEmptyChart(state.unit); clearSummary(); clearProcessSummary(); clearVariabilitySummary(); return; }
      renderChart(series, state.unit);
    }

    function parseStockSeries(jsonResponse){
      try{
        if(!jsonResponse || !jsonResponse.table) return { series: [], daily: [], latest: null, latestProcesses: [], fields: [] };
        const cols = (jsonResponse.table.cols || []).map(col => String(col.label || col.id || '').trim());
        const rows = (jsonResponse.table.rows || []).map(r => (r && r.c ? r.c.map(cell => (cell && cell.v !== null) ? cell.v : '') : []));
        let headers = cols;
        let dataRows = rows;
        if(!headers.some(h => normalizeHeader(h) === 'fecha') && rows.length && normalizeHeader(rows[0][0]) === 'fecha'){
          headers = rows[0].map(v => String(v || '').trim());
          dataRows = rows.slice(1);
        }
        const dateIdx = getHeaderIndex(headers, ['fecha', 'date']);
        const processFields = headers
          .map((h, idx) => ({ name: String(h || '').trim(), idx }))
          .filter(x => x.idx !== dateIdx && normalizeHeader(x.name) !== '');
        const totalFields = processFields.filter(field => {
          const key = normalizeHeader(field.name);
          return key !== 'transfer' && key !== 'bordado';
        });
        const series = [];
        const byDate = new Map();
        for(const row of dataRows){
          const dt = parseAnyDate(row[dateIdx >= 0 ? dateIdx : 0]);
          if(!dt) continue;
          let total = 0;
          for(const field of totalFields) total += parseNumber(row[field.idx]);
          const dateKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          if(!byDate.has(dateKey)){
            byDate.set(dateKey, { date: dt, total: 0, processes: {}, dateKey });
          }
          const bucket = byDate.get(dateKey);
          bucket.total += total;
          for(const field of processFields){
            bucket.processes[field.name] = (bucket.processes[field.name] || 0) + parseNumber(row[field.idx]);
          }
          series.push({ date: dt, total });
        }
        series.sort((a,b) => a.date - b.date);
        const daily = Array.from(byDate.values()).sort((a,b) => a.date - b.date);
        const latest = daily[daily.length - 1] || null;
        const latestProcesses = latest ? Object.entries(latest.processes).map(([name, value]) => ({ name, value: Number(value) || 0 })).sort((a,b) => b.value - a.value) : [];
        return { series, daily, latest, latestProcesses, fields: processFields.map(x => x.name) };
      }catch(err){
        console.error(err);
        return { series: [], daily: [], latest: null, latestProcesses: [], fields: [] };
      }
    }

    function renderChart(series, unit){
      const svg = document.getElementById('svg-chart');
      const unitLabel = unit === 'pds' ? 'pds' : 'kg';
      const prettyUnit = unit === 'pds' ? 'Prendas' : 'Kg';
      const values = series.map(x => Number(x.total) || 0);
      const last = values[values.length - 1] || 0;
      const avg = values.reduce((a,b) => a + b, 0) / values.length;
      const peak = Math.max(...values, 0);
      const positive = values.filter(v => v > 0);
      const min = positive.length ? Math.min(...positive) : 0;
      const delta = avg > 0 ? ((last - avg) / avg) * 100 : 0;
      const stateLabel = getStateLabel(last, avg);
      const trendLabel = getTrendLabel(values);

      updateSummary({
        prettyUnit, unitLabel, last, avg, peak, min, delta,
        stateLabel, trendLabel,
        rangeLabel: `${formatNumber(min)} - ${formatNumber(peak)} ${unitLabel}`,
        count: series.length
      });
      const width = 1000, height = 210, pad = { top:14, right:18, bottom:40, left:62 };
      const innerW = width - pad.left - pad.right, innerH = height - pad.top - pad.bottom;
      const axisMin = unit === 'pds'
        ? (min > 80000 ? 80000 : Math.max(0, Math.floor(min * 0.95)))
        : 0;
      const axisMax = Math.max(peak, avg * 1.18, axisMin + 1);
      const span = Math.max(axisMax - axisMin, 1);
      const y = v => pad.top + innerH - (((v - axisMin) / span) * innerH);
      const x = i => pad.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
      const avgY = y(avg), warnLowY = y(avg * 0.90), warnHighY = y(avg * 1.10);
      const avgLabelY = Math.max(pad.top + 8, Math.min(height - 38, avgY - 14));

      const grid = [0, .25, .5, .75, 1].map(fr => {
        const vv = axisMin + (span * fr), yy = y(vv);
        return `<line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" stroke="#e5e7eb" stroke-width="1"></line><text x="${pad.left - 10}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#64748b">${formatCompact(vv)} ${unitLabel}</text>`;
      }).join('');
      const step = Math.max(1, Math.ceil(series.length / 8));
      const labels = series.map((item, i) => {
        if(i !== 0 && i !== series.length - 1 && i % step !== 0) return '';
        return `<text x="${x(i)}" y="${height - 18}" text-anchor="middle" font-size="11" fill="#64748b">${formatDateShort(item.date)}</text>`;
      }).join('');
      const line = series.length > 1 ? `M ${series.map((item, i) => `${x(i)} ${y(Number(item.total) || 0)}`).join(' L ')}` : '';
      const circles = series.map((item, i) => {
        const xx = x(i), yy = y(Number(item.total) || 0), value = Number(item.total) || 0, lastDot = i === series.length - 1;
        return `<circle cx="${xx}" cy="${yy}" r="${lastDot ? 5.5 : 4.5}" fill="${lastDot ? '#2563eb' : '#ffffff'}" stroke="#2563eb" stroke-width="2"><title>${formatDateLong(item.date)}: ${formatNumber(value)} ${unitLabel}</title></circle>`;
      }).join('');
      const lastValue = `<g transform="translate(${Math.min(width - 130, x(series.length - 1) + 16)}, ${Math.max(34, y(last) - 18)})"><rect x="0" y="0" rx="8" ry="8" width="116" height="32" fill="#2563eb"></rect><text x="58" y="21" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${formatNumber(last)} ${unitLabel}</text></g>`;
      svg.innerHTML = `
        <rect x="${pad.left}" y="${warnHighY}" width="${width - pad.left - pad.right}" height="${pad.top + innerH - warnHighY}" fill="rgba(239,68,68,0.07)" rx="10"></rect>
        <rect x="${pad.left}" y="${warnLowY}" width="${width - pad.left - pad.right}" height="${warnHighY - warnLowY}" fill="rgba(245,158,11,0.09)"></rect>
        <rect x="${pad.left}" y="${pad.top}" width="${width - pad.left - pad.right}" height="${warnLowY - pad.top}" fill="rgba(16,185,129,0.05)" rx="10"></rect>
        ${grid}
        <line x1="${pad.left}" y1="${avgY}" x2="${width - pad.right}" y2="${avgY}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="8 6"></line>
        ${line ? `<path d="${line}" fill="none" stroke="#2563eb" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"></path>` : ''}
        ${circles}
        ${lastValue}
        <g transform="translate(${pad.left + 10}, ${avgLabelY})">
          <rect x="0" y="0" rx="8" ry="8" width="160" height="26" fill="#ffffff" fill-opacity="0.92" stroke="#cbd5e1"></rect>
          <text x="10" y="17" font-size="11" fill="#475569" font-weight="700">Promedio ${formatCompact(avg)} ${unitLabel}</text>
        </g>
        ${labels}
        <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="#94a3b8" stroke-width="1.1"></line>
        <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="#94a3b8" stroke-width="1.1"></line>
      `;
    }

    function drawEmptyChart(unit){
      document.getElementById('svg-chart').innerHTML = `<rect x="0" y="0" width="1000" height="210" rx="12" fill="#fff"></rect><text x="500" y="105" text-anchor="middle" font-size="16" fill="#64748b">Sin datos para ${unit === 'pds' ? 'prendas' : 'kg'}</text>`;
    }

    function renderProcessBreakdown(detail, unit){
      const list = document.getElementById('process-list');
      const badge = document.getElementById('panel2-badges');
      const panelTitle = document.getElementById('panel2-title');
      const panelSubtitle = document.getElementById('panel2-subtitle');
      const panelDate = document.getElementById('panel2-date');
      const panelMeta = document.getElementById('panel2-meta');
      const panelTotal = document.getElementById('panel2-total');

      const unitLabel = unit === 'pds' ? 'pds' : 'kg';
      const analytics = buildProcessAnalytics(detail);
      const baseTitle = 'Participacion por proceso - ult.fecha';
      panelTitle.textContent = baseTitle;
      panelSubtitle.textContent = 'Participacion del ultimo dia + variabilidad del stock por proceso';

      if(!analytics.latest){
        panelDate.textContent = '';
        panelMeta.textContent = '';
        panelTotal.innerHTML = '<strong>Total</strong><span>-</span>';
        badge.className = 'process-badge warn';
        badge.innerHTML = '<strong>Proceso lider</strong><span>-</span>';
        list.innerHTML = '<div class="process-empty">Cuando cargue la fecha mas reciente, aqui veremos cada proceso con su participacion y su CV para leer volumen y estabilidad en la misma fila.</div>';
        return;
      }

      const sorted = analytics.rows;
      const maxShare = analytics.maxShare;
      const maxCv = analytics.maxCv;
      const leader = sorted[0] || { name:'-', value:0 };

      panelTitle.textContent = `${baseTitle} ${formatDateShort(analytics.latest.date)}`;
      panelDate.textContent = `Ultima fecha ${formatDateLong(analytics.latest.date)}`;
      panelMeta.textContent = 'X% del total del dia + CV por proceso';
      panelTotal.innerHTML = `<strong>Total</strong><span>${formatNumber(analytics.latestTotal)} ${unitLabel}</span>`;
      badge.className = leader.value > analytics.latestTotal * 0.5 ? 'process-badge bad' : leader.value > analytics.latestTotal * 0.3 ? 'process-badge warn' : 'process-badge good';
      badge.innerHTML = `<strong>Proceso lider</strong><span>${escapeHtml(leader.name)}</span>`;

      if(sorted.length === 0){
        list.innerHTML = '<div class="process-empty">La ultima fecha no trae valores en los procesos principales.</div>';
        return;
      }

      list.innerHTML = sorted.map(item => {
        const shareWidth = Math.max(6, (item.sharePct / maxShare) * 100);
        const cvValue = Number.isFinite(item.cv) ? item.cv : null;
        const cvWidth = cvValue !== null ? Math.max(6, (cvValue / maxCv) * 100) : 6;
        const cvLevel = cvValue === null ? 'missing' : cvValue >= 35 ? 'high' : cvValue >= 20 ? 'mid' : 'low';
        const cvLabel = cvValue === null ? 'Sin dato' : `${cvValue.toFixed(1)}% CV`;
        const shareTitle = `${item.sharePct.toFixed(1)}% del total`;
        const stdLabel = cvValue === null ? 'Sin variabilidad' : `sigma ${formatNumber(item.stdDev)} ${unitLabel}`;
        return `
          <div class="process-row compare">
            <div class="process-label" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
            <div class="process-metric">
              <div class="process-metric-title">Participacion</div>
              <div class="process-track part" aria-hidden="true">
                <div class="process-fill part" style="width:${shareWidth}%">${item.sharePct.toFixed(1)}%</div>
              </div>
            </div>
            <div class="process-metric">
              <div class="process-metric-title">Variabilidad</div>
              <div class="process-track var" aria-hidden="true">
                <div class="process-fill ${cvLevel}" style="width:${cvWidth}%">${cvLabel}</div>
              </div>
            </div>
            <div class="process-value stack">
              <span class="process-value-main">${formatNumber(item.value)} ${unitLabel}</span>
              <span class="process-value-sub">${shareTitle}  |  ${stdLabel}  |  ${cvLabel}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    function renderWeeklyVariation(detail, unit){
      const list = document.getElementById('weekly-list');
      const titleEl = document.getElementById('panel3-title');
      const windowEl = document.getElementById('panel3-window');
      const metaEl = document.getElementById('panel3-meta');
      const unitLabel = unit === 'pds' ? 'pds' : 'kg';
      if(!detail || !detail.daily || detail.daily.length === 0){
        titleEl.textContent = 'Variacion semanal por proceso';
        windowEl.textContent = '';
        metaEl.textContent = '';
        list.innerHTML = '<div class="weekly-empty">Aqui veremos las barras de variacion semanal. Las barras a la derecha muestran crecimiento y las que van a la izquierda muestran drenaje.</div>';
        return;
      }

      const weekly = computeWeeklyVariation(detail);
      if(weekly.length === 0){
        titleEl.textContent = 'Variacion semanal por proceso';
        windowEl.textContent = '';
        metaEl.textContent = '';
        list.innerHTML = '<div class="weekly-empty">Se comparan los ultimos 7 dias contra los 7 anteriores. Si faltan dias en la hoja, se toman como cero para no perder la ventana.</div>';
        return;
      }

      const maxAbs = Math.max(...weekly.map(item => Math.abs(item.delta)), 1);
      const growing = weekly.filter(item => item.delta > 0);
      const draining = weekly.filter(item => item.delta < 0);
      const periodLabel = formatWeeklyWindowLabel(weekly[0].prevStart, weekly[0].prevEnd, weekly[0].lastStart, weekly[0].lastEnd);

      titleEl.textContent = `Variacion semanal : ${periodLabel}`;
      windowEl.textContent = '';
      metaEl.textContent = '';

      list.innerHTML = weekly.map(item => {
        const ratio = Math.min(1, Math.abs(item.delta) / maxAbs);
        const width = Math.max(4, ratio * 50);
        const pct = item.prevTotal > 0 ? ((item.delta / item.prevTotal) * 100) : (item.delta > 0 ? 100 : 0);
        const label = item.name;
        if(item.delta >= 0){
          return `
            <div class="weekly-row">
              <div class="weekly-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
              <div class="weekly-track" aria-hidden="true">
                <div class="weekly-zero"></div>
                <div class="weekly-fill pos" style="width:${width}%">${Math.abs(pct).toFixed(1)}%</div>
              </div>
              <div class="weekly-value">${formatSignedNumber(item.delta, unitLabel)} <span class="muted">(${pct.toFixed(1)}%)</span></div>
            </div>
          `;
        }
        return `
          <div class="weekly-row">
            <div class="weekly-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
            <div class="weekly-track" aria-hidden="true">
              <div class="weekly-zero"></div>
              <div class="weekly-fill neg" style="width:${width}%">${Math.abs(pct).toFixed(1)}%</div>
            </div>
            <div class="weekly-value">${formatSignedNumber(item.delta, unitLabel)} <span class="muted">(${pct.toFixed(1)}%)</span></div>
          </div>
        `;
      }).join('');
    }

    function renderVariabilityPanel(detail, unit){
      const list = document.getElementById('var-list');
      const badge = document.getElementById('panel4-badges');
      const windowEl = document.getElementById('panel4-window');
      const metaEl = document.getElementById('panel4-meta');

      const analytics = buildProcessAnalytics(detail);
      const points = analytics.rows.filter(item => Number.isFinite(item.cv) && item.sharePct >= 0);

      if(!analytics.latest || points.length === 0){
        windowEl.textContent = '';
        metaEl.textContent = '';
        if(badge) badge.innerHTML = '<div class="scatter-chip blue"><strong>X</strong><span>Participaci&oacute;n</span></div><div class="scatter-chip amber"><strong>Y</strong><span>CV</span></div>';
        list.innerHTML = '<div class="var-empty">Aqu&iacute; veremos una dispersi&oacute;n por proceso. M&aacute;s a la derecha = m&aacute;s participaci&oacute;n; m&aacute;s arriba = m&aacute;s CV.</div>';
        return;
      }

      const xMax = Math.max(100, Math.ceil(analytics.maxShare / 10) * 10);
      const maxCvSource = Math.max(...points.map(item => Number(item.cv) || 0), 1);
      const yMax = Math.max(10, Math.ceil((maxCvSource * 1.15) / 5) * 5);
      const avgShare = points.reduce((acc, item) => acc + item.sharePct, 0) / points.length;
      const avgCv = points.reduce((acc, item) => acc + item.cv, 0) / points.length;
      const width = 1000;
      const height = 380;
      const pad = { left: 78, right: 18, top: 20, bottom: 56 };
      const innerW = width - pad.left - pad.right;
      const innerH = height - pad.top - pad.bottom;
      const x = value => pad.left + (Math.min(value, xMax) / xMax) * innerW;
      const y = value => pad.top + innerH - (Math.min(value, yMax) / yMax) * innerH;
      const ticks = (maxValue, count) => {
        const safeCount = Math.max(count, 2);
        const step = maxValue / (safeCount - 1);
        return Array.from({ length: safeCount }, (_, idx) => idx === safeCount - 1 ? maxValue : step * idx);
      };
      const xTicks = ticks(xMax, 5);
      const yTicks = ticks(yMax, 5);
      const topLabels = new Set(
        points
          .slice()
          .sort((a, b) => ((b.sharePct * 0.55) + (b.cv * 0.45)) - ((a.sharePct * 0.55) + (a.cv * 0.45)))
          .slice(0, 6)
          .map(item => item.name)
      );
      const pointShapes = points.map(item => {
        const cx = x(item.sharePct);
        const cy = y(item.cv);
        const levelClass = item.cv >= 35 ? 'high' : item.cv >= 20 ? 'mid' : 'low';
        const labelDx = item.sharePct > xMax * 0.72 ? -10 : 10;
        const labelAnchor = item.sharePct > xMax * 0.72 ? 'end' : 'start';
        return `
          <g class="scatter-point-group">
            <title>${escapeHtml(item.name)} | ${item.sharePct.toFixed(1)}% participacion | ${item.cv.toFixed(1)}% CV</title>
            <circle class="scatter-point ${levelClass}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7"></circle>
            ${topLabels.has(item.name) ? `<text x="${(cx + labelDx).toFixed(1)}" y="${(cy - 10).toFixed(1)}" text-anchor="${labelAnchor}" class="scatter-point-label">${escapeHtml(item.name)}</text>` : ''}
          </g>
        `;
      }).join('');
      const gridX = xTicks.map(value => `<line x1="${x(value).toFixed(1)}" y1="${pad.top}" x2="${x(value).toFixed(1)}" y2="${pad.top + innerH}" stroke="rgba(148,163,184,.25)" stroke-dasharray="4 6"></line>`).join('');
      const gridY = yTicks.map(value => `<line x1="${pad.left}" y1="${y(value).toFixed(1)}" x2="${pad.left + innerW}" y2="${y(value).toFixed(1)}" stroke="rgba(148,163,184,.25)" stroke-dasharray="4 6"></line>`).join('');
      const xAxisLabels = xTicks.map(value => `<text x="${x(value).toFixed(1)}" y="${pad.top + innerH + 22}" text-anchor="middle" class="scatter-axis-label">${Math.round(value)}%</text>`).join('');
      const yAxisLabels = yTicks.map(value => `<text x="${pad.left - 10}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end" class="scatter-axis-label">${Math.round(value)}%</text>`).join('');
      const avgX = x(avgShare);
      const avgY = y(avgCv);

      windowEl.textContent = `Ultima fecha ${formatDateLong(analytics.latest.date)}`;
      metaEl.textContent = `${points.length} procesos visibles  |  arriba = mayor CV  |  derecha = mayor participacion`;
      if(badge){
        badge.innerHTML = '<div class="scatter-chip blue"><strong>X</strong><span>Participaci&oacute;n</span></div><div class="scatter-chip amber"><strong>Y</strong><span>CV</span></div><div class="scatter-chip red"><strong>Rojo</strong><span>m&aacute;s inestable</span></div>';
      }

      list.innerHTML = `
        <div class="scatter-panel">
          <div class="scatter-shell">
            <svg id="scatter-chart" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Dispersi&oacute;n por proceso">
              <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="#fff"></rect>
              <rect x="${pad.left}" y="${pad.top}" width="${innerW}" height="${innerH}" fill="rgba(248,250,252,.88)" rx="10"></rect>
              ${gridX}
              ${gridY}
              <line x1="${pad.left}" y1="${avgY.toFixed(1)}" x2="${pad.left + innerW}" y2="${avgY.toFixed(1)}" stroke="#f59e0b" stroke-width="1.4" stroke-dasharray="7 6"></line>
              <line x1="${avgX.toFixed(1)}" y1="${pad.top}" x2="${avgX.toFixed(1)}" y2="${pad.top + innerH}" stroke="#2563eb" stroke-width="1.4" stroke-dasharray="7 6"></line>
              ${pointShapes}
              <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${pad.left + innerW}" y2="${pad.top + innerH}" stroke="#94a3b8" stroke-width="1.1"></line>
              <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" stroke="#94a3b8" stroke-width="1.1"></line>
              ${xAxisLabels}
              ${yAxisLabels}
              <text x="${pad.left + innerW / 2}" y="${height - 12}" text-anchor="middle" class="scatter-axis-label">Participacion del ultimo dia</text>
              <text x="20" y="${pad.top + innerH / 2}" text-anchor="middle" class="scatter-axis-label" transform="rotate(-90 20 ${pad.top + innerH / 2})">CV del stock diario</text>
            </svg>
          </div>
          <div class="scatter-note">Cada punto representa un proceso. Los puntos arriba a la derecha combinan mayor peso en el dia y mayor inestabilidad.</div>
        </div>
      `;
    }

    function computeVariability(detail){
      const daily = (detail && detail.daily) ? detail.daily.slice().sort((a,b) => a.date - b.date) : [];
      if(daily.length === 0) return [];

      const processNames = Array.from(new Set(daily.flatMap(day => Object.keys(day.processes || {}))))
        .filter(name => name.replace(/\s+/g, ' ').trim().toUpperCase() !== 'CORTE BLOQ');
      const results = processNames.map(name => {
        const values = daily.map(day => Number((day.processes && day.processes[name]) || 0));
        const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
        const variance = values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? (stdDev / mean) * 100 : 0;
        return { name, mean, stdDev, cv, values };
      }).filter(item => item.mean > 0);

      return results.sort((a,b) => b.cv - a.cv);
    }

    function buildProcessAnalytics(detail){
      const latest = detail && detail.latest ? detail.latest : null;
      const latestTotal = Number(latest && latest.total) || 0;
      const variability = computeVariability(detail);
      const variabilityMap = new Map(variability.map(item => [item.name, item]));
      const rows = ((detail && detail.latestProcesses) ? detail.latestProcesses : [])
        .filter(item => Number(item.value) > 0)
        .map(item => {
          const value = Number(item.value) || 0;
          const varItem = variabilityMap.get(item.name) || null;
          const sharePct = latestTotal > 0 ? (value / latestTotal) * 100 : 0;
          return {
            name: item.name,
            value,
            sharePct,
            mean: varItem ? varItem.mean : null,
            stdDev: varItem ? varItem.stdDev : null,
            cv: varItem ? varItem.cv : null,
            values: varItem ? varItem.values : null
          };
        });
      const maxShare = Math.max(...rows.map(item => item.sharePct), 1);
      const maxCv = Math.max(...rows.map(item => Number.isFinite(item.cv) ? item.cv : 0), 1);
      return { latest, latestTotal, rows, maxShare, maxCv };
    }

    function computeWeeklyVariation(detail){
      const daily = (detail && detail.daily) ? detail.daily.slice().sort((a,b) => a.date - b.date) : [];
      if(daily.length === 0) return [];
      const latest = daily[daily.length - 1];
      const end = latest.date;
      const prevEnd = addDays(end, -7);
      const prevStart = addDays(end, -13);
      const lastStart = addDays(end, -6);

      const map = new Map();
      for(const day of daily){
        const key = dateKey(day.date);
        map.set(key, day.processes || {});
      }

      const processNames = Array.from(new Set(daily.flatMap(day => Object.keys(day.processes || {}))))
        .filter(name => name.replace(/\s+/g, ' ').trim().toUpperCase() !== 'CORTE BLOQ');
      if(processNames.length === 0) return [];
      const results = processNames.map(name => {
        let prevTotal = 0;
        let lastTotal = 0;
        for(let offset = -13; offset <= 0; offset++){
          const current = addDays(end, offset);
          const key = dateKey(current);
          const bucket = map.get(key) || {};
          const value = Number(bucket[name]) || 0;
          if(offset <= -7) prevTotal += value;
          else lastTotal += value;
        }
        return {
          name,
          prevTotal,
          lastTotal,
          delta: lastTotal - prevTotal,
          prevStart,
          prevEnd,
          lastStart,
          lastEnd: end
        };
      }).sort((a,b) => b.delta - a.delta);

      return results;
    }

    function dateKey(date){
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function addDays(date, days){
      const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      copy.setDate(copy.getDate() + days);
      return copy;
    }

    function clearProcessSummary(){
      const list = document.getElementById('process-list');
      if(list) list.innerHTML = '<div class="process-empty">Sin datos disponibles para el proceso mas reciente.</div>';
      const panelDate = document.getElementById('panel2-date');
      const panelMeta = document.getElementById('panel2-meta');
      const panelTotal = document.getElementById('panel2-total');
      const badge = document.getElementById('panel2-badges');
      if(panelDate) panelDate.textContent = '';
      if(panelMeta) panelMeta.textContent = '';
      if(panelTotal) panelTotal.innerHTML = '<strong>Total</strong><span>-</span>';
      if(badge){ badge.className = 'process-badge warn'; badge.innerHTML = '<strong>Proceso lider</strong><span>-</span>'; }
    }

    function clearVariabilitySummary(){
      const list = document.getElementById('var-list');
      const windowEl = document.getElementById('panel4-window');
      const metaEl = document.getElementById('panel4-meta');
      const badge = document.getElementById('panel4-badges');
      if(list) list.innerHTML = '<div class="var-empty">Aqu&iacute; veremos una dispersi&oacute;n por proceso. M&aacute;s a la derecha = m&aacute;s participaci&oacute;n; m&aacute;s arriba = m&aacute;s CV.</div>';
      if(windowEl) windowEl.textContent = '';
      if(metaEl) metaEl.textContent = '';
      if(badge) badge.innerHTML = '<div class="scatter-chip blue"><strong>X</strong><span>Participaci&oacute;n</span></div><div class="scatter-chip amber"><strong>Y</strong><span>CV</span></div><div class="scatter-chip red"><strong>Rojo</strong><span>m&aacute;s inestable</span></div>';
    }

    function formatSignedNumber(value, unitLabel){
      const n = Number(value) || 0;
      const prefix = n > 0 ? '+' : '';
      return `${prefix}${formatNumber(n)} ${unitLabel}`;
    }

    function updateSummary(info){
      document.getElementById('panel1-title').textContent = `WIP total diario - ${info.prettyUnit}`;
      document.getElementById('kpi-last').innerHTML = `<span>${formatNumber(info.last)} ${info.unitLabel}</span>`;
      document.getElementById('kpi-last-meta').textContent = '';
      document.getElementById('kpi-avg').innerHTML = `<span>${formatNumber(info.avg)} ${info.unitLabel}</span>`;
      document.getElementById('kpi-peak').innerHTML = `<span>${formatNumber(info.peak)} ${info.unitLabel}</span>`;
      document.getElementById('kpi-delta').innerHTML = `<span>${info.delta >= 0 ? '+' : ''}${info.delta.toFixed(1)}%</span>`;
      document.getElementById('kpi-delta-meta').textContent = '';
      document.getElementById('kpi-peak-meta').textContent = '';
      const trendChip = document.getElementById('chip-trend');
      trendChip.className = `chip ${info.trendLabel.className}`; trendChip.innerHTML = `<b>Tendencia</b><span>${info.trendLabel.text}</span>`;
      document.getElementById('chip-range').className = 'chip';
      document.getElementById('chip-range').innerHTML = `<b>Rango</b><span>${info.rangeLabel}</span>`;
    }

    function clearSummary(){
      document.getElementById('panel1-title').textContent = `WIP total diario - ${state.unit === 'pds' ? 'Prendas' : 'Kg'}`;
      document.getElementById('kpi-last').innerHTML = '<span>-</span>'; document.getElementById('kpi-last-meta').textContent = '';
      document.getElementById('kpi-avg').innerHTML = '<span>-</span>'; document.getElementById('kpi-peak').innerHTML = '<span>-</span>'; document.getElementById('kpi-delta').innerHTML = '<span>-</span>';
      document.getElementById('chip-trend').className = 'chip'; document.getElementById('chip-trend').innerHTML = '<b>Tendencia</b><span>-</span>';
      document.getElementById('chip-range').className = 'chip'; document.getElementById('chip-range').innerHTML = '<b>Rango</b><span>-</span>';
    }

    function setUnit(unit){
      state.unit = unit;
      maybeRender();
    }

    function setLoading(isLoading){
      document.getElementById('loader').style.display = isLoading ? 'flex' : 'none';
      document.getElementById('btn-refresh').style.opacity = isLoading ? '0.7' : '1';
    }
    function showError(msg){
      const box = document.getElementById('error-box');
      if(!msg){ box.style.display = 'none'; box.textContent = ''; return; }
      box.style.display = 'block'; box.textContent = msg;
    }

    function normalizeHeader(value){ return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
    function getHeaderIndex(headers, candidates){ const norm = (headers || []).map(normalizeHeader); for(const c of candidates){ const idx = norm.indexOf(normalizeHeader(c)); if(idx !== -1) return idx; } return -1; }
    function parseNumber(value){
      if(value === null || value === undefined || value === '') return 0;
      if(typeof value === 'number' && Number.isFinite(value)) return value;
      const txt = String(value).trim(); if(!txt) return 0;
      if(/^\d{1,3}([.,]\d{3})+$/.test(txt)) return Number(txt.replace(/[.,]/g, '')) || 0;
      const direct = Number(txt.replace(/,/g, '')); if(Number.isFinite(direct)) return direct;
      const fallback = Number(txt.replace(/\./g, '')); return Number.isFinite(fallback) ? fallback : 0;
    }
    function parseAnyDate(value){
      if(value === null || value === undefined || value === '') return null;
      if(value instanceof Date && !isNaN(value.getTime())) return value;
      if(typeof value === 'number' && value > 30000){ const d = new Date(Math.round((value - 25569) * 86400 * 1000)); return isNaN(d.getTime()) ? null : d; }
      if(typeof value === 'string'){
        const txt = value.trim();
        const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if(iso){ const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])); return isNaN(d.getTime()) ? null : d; }
        const gviz = txt.match(/Date\((\d+),\s*(\d+),\s*(\d+)\)/);
        if(gviz){ const d = new Date(Number(gviz[1]), Number(gviz[2]), Number(gviz[3])); return isNaN(d.getTime()) ? null : d; }
        const parts = txt.split('/');
        if(parts.length === 3){ let day = Number(parts[0]), month = Number(parts[1]), year = Number(parts[2]); if(Number.isFinite(year) && year < 100) year += 2000; const d = new Date(year, month - 1, day); return isNaN(d.getTime()) ? null : d; }
      }
      return null;
    }
    function formatNumber(n){ return Math.round(Number(n) || 0).toLocaleString('en-US'); }
    function formatCompact(n){ const v = Number(n) || 0; return Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : formatNumber(v); }
    function formatDateShort(date){ const m = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; return `${String(date.getDate()).padStart(2,'0')}/${m[date.getMonth()]}`; }
    function formatDateLong(date){ const m = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']; return `${String(date.getDate()).padStart(2,'0')} ${m[date.getMonth()]} ${date.getFullYear()}`; }
    function formatWeeklyWindowLabel(prevStart, prevEnd, lastStart, lastEnd){
      const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const prevMonth = months[prevStart.getMonth()];
      const lastMonth = months[lastStart.getMonth()];
      if(prevMonth === lastMonth){
        return `${String(prevStart.getDate()).padStart(2,'0')}-${String(prevEnd.getDate()).padStart(2,'0')}/${prevMonth} vs ${String(lastStart.getDate()).padStart(2,'0')}-${String(lastEnd.getDate()).padStart(2,'0')}/${lastMonth}`;
      }
      return `${formatDateShort(prevStart)} - ${formatDateShort(prevEnd)} vs ${formatDateShort(lastStart)} - ${formatDateShort(lastEnd)}`;
    }
    function getStateLabel(last, avg){ if(!(avg > 0)) return { text:'Sin referencia', className:'warn' }; const ratio = last / avg; if(ratio < 0.9) return { text:'Bajo', className:'good' }; if(ratio <= 1.1) return { text:'Normal', className:'warn' }; return { text:'Alto', className:'bad' }; }
    function getTrendLabel(values){ if(!values || values.length < 2) return { text:'Sin comparacion', className:'' }; const first = values[0], last = values[values.length - 1]; if(last > first * 1.08) return { text:'Subiendo', className:'warn' }; if(last < first * 0.92) return { text:'Bajando', className:'good' }; return { text:'Estable', className:'' }; }

    function clearChart(){ document.getElementById('svg-chart').innerHTML = ''; }

    function escapeHtml(text){
      return window.PcpTextUtils.escapeHtmlLoose(text);
    }

    reloadData();
  
