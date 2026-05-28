
    const SHEET_SOURCES=window.PCP_CONFIG.SHEET_SOURCES,DAY=86400000,MONTHS=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],HIDDEN_MONTH_KEYS=new Set(["2025-08","2025-09","2025-10","2025-11","2025-12","2026-01"]);
    let rawData=[],colMap=new Map(),processedData=[],currentDashboardRows=[],currentDashboardMonth="ALL",currentDashboardField="fDesp",chart1=null,chart3=null,chart2Detail=null,chart3Detail=null,lastLoadedAt=null,entregasHoverCellMap=new Map();
    const $=id=>document.getElementById(id);
    const chartLabelHitboxesPlugin={id:"chartLabelHitboxes",beforeDatasetsDraw(chart){chart.$dataLabelHitboxes=[];}};
    const doughnutPctLabelsPlugin={id:"doughnutPctLabels",afterDatasetsDraw(chart,args,pluginOptions){if(chart.config.type!=="doughnut"||!pluginOptions?.display)return;const meta=chart.getDatasetMeta(0),values=pluginOptions.values||[];if(!meta?.data?.length||!values.length)return;const ctx=chart.ctx;ctx.save();ctx.font="bold 11px Segoe UI";ctx.textAlign="center";ctx.textBaseline="middle";meta.data.forEach((arc,i)=>{const pct=values[i];if(!pct||pct<1)return;const angle=(arc.startAngle+arc.endAngle)/2,radius=arc.innerRadius+(arc.outerRadius-arc.innerRadius)*0.58,x=arc.x+Math.cos(angle)*radius,y=arc.y+Math.sin(angle)*radius;ctx.lineWidth=3;ctx.strokeStyle="rgba(255,255,255,0.95)";ctx.strokeText(`${pct}%`,x,y);ctx.fillStyle="#111827";ctx.fillText(`${pct}%`,x,y);});ctx.restore();}};
    const linePointLabelsPlugin={id:"linePointLabels",afterDatasetsDraw(chart,args,pluginOptions){if(chart.config.type!=="line"||!pluginOptions?.display)return;const ctx=chart.ctx,offsets=pluginOptions.offsets||[-14,0,14],format=typeof pluginOptions.format==="function"?pluginOptions.format:v=>String(v),font=pluginOptions.font||"bold 10px Segoe UI",fontSize=fontPx(font),lineHeight=fontSize+2;ctx.save();ctx.font=font;ctx.textAlign="center";ctx.textBaseline="top";chart.data.datasets.forEach((ds,di)=>{const meta=chart.getDatasetMeta(di);if(meta.hidden||ds.hidePointLabels||((ds.type||chart.config.type)!=="line"))return;meta.data.forEach((point,i)=>{const raw=ds.data?.[i],value=raw&&typeof raw==="object"?raw.y:raw;if(value===null||value===void 0||Number.isNaN(value))return;const pos=point.tooltipPosition(),offset=offsets[di%offsets.length]||-12,rawLabel=format(value,ds,di,i),lines=(Array.isArray(rawLabel)?rawLabel:[String(rawLabel)]).flatMap(v=>String(v).split(/\r?\n/)).filter(Boolean);if(!lines.length)return;const width=Math.max(...lines.map(line=>ctx.measureText(line).width))+8,totalHeight=lines.length*lineHeight,blockTop=offset<0?pos.y+offset-totalHeight:pos.y+offset;ctx.lineWidth=3;ctx.strokeStyle="rgba(255,255,255,0.96)";ctx.fillStyle=Array.isArray(ds.borderColor)?ds.borderColor[i]:ds.borderColor||"#111827";lines.forEach((line,idx)=>{const y=blockTop+idx*lineHeight;ctx.strokeText(line,pos.x,y);ctx.fillText(line,pos.x,y);});if(Array.isArray(chart.$dataLabelHitboxes))chart.$dataLabelHitboxes.push({datasetIndex:di,index:i,x:pos.x-width/2,y:blockTop,w:width,h:totalHeight+4,cx:pos.x,cy:blockTop+(totalHeight+4)/2});});});ctx.restore();}};
    const barValueLabelsPlugin={id:"barValueLabels",afterDatasetsDraw(chart,args,pluginOptions){if(!pluginOptions?.display)return;const ctx=chart.ctx,format=typeof pluginOptions.format==="function"?pluginOptions.format:v=>String(v),font=pluginOptions.font||"bold 10px Segoe UI",fontSize=fontPx(font),lineHeight=fontSize+2,placement=pluginOptions.placement||"top",inset=pluginOptions.inset??6;ctx.save();ctx.font=font;ctx.textAlign="center";ctx.textBaseline="top";chart.data.datasets.forEach((ds,di)=>{const meta=chart.getDatasetMeta(di);if(meta.hidden||ds.type!=="bar")return;meta.data.forEach((bar,i)=>{const raw=ds.data?.[i],value=raw&&typeof raw==="object"?raw.y:raw;if(value===null||value===void 0||Number.isNaN(value))return;const props=typeof bar.getProps==="function"?bar.getProps(["x","y","base"],true):bar,x=props.x,top=Math.min(props.y,props.base),bottom=Math.max(props.y,props.base),atBase=placement==="base",rawLabel=format(value,ds,di,i),lines=(Array.isArray(rawLabel)?rawLabel:[String(rawLabel)]).flatMap(v=>String(v).split(/\r?\n/)).filter(Boolean);if(!lines.length)return;const borderColor=Array.isArray(ds.borderColor)?ds.borderColor[i]:ds.borderColor,backgroundColor=Array.isArray(ds.backgroundColor)?ds.backgroundColor[i]:ds.backgroundColor,color=borderColor||backgroundColor||"#475569",width=Math.max(...lines.map(line=>ctx.measureText(line).width))+8,totalHeight=lines.length*lineHeight,blockTop=atBase?(props.base>=props.y?bottom-inset-totalHeight:top+inset):top-inset-totalHeight;ctx.lineWidth=3;ctx.strokeStyle="rgba(255,255,255,0.96)";ctx.fillStyle=color;lines.forEach((line,idx)=>{const y=blockTop+idx*lineHeight;ctx.strokeText(line,x,y);ctx.fillText(line,x,y);});if(Array.isArray(chart.$dataLabelHitboxes))chart.$dataLabelHitboxes.push({datasetIndex:di,index:i,x:x-width/2,y:blockTop,w:width,h:totalHeight+4,cx:x,cy:blockTop+(totalHeight+4)/2});});});ctx.restore();}};
    const barInsideLabelsPlugin={id:"barInsideLabels",afterDatasetsDraw(chart,args,pluginOptions){if(!pluginOptions?.display)return;const ctx=chart.ctx,font=pluginOptions.font||"bold 9px Segoe UI";ctx.save();ctx.font=font;ctx.textAlign="center";ctx.textBaseline="middle";chart.data.datasets.forEach((ds,di)=>{const meta=chart.getDatasetMeta(di);if(meta.hidden||ds.type!=="bar"||!ds.insideLabel)return;meta.data.forEach((bar,i)=>{const raw=ds.data?.[i],value=raw&&typeof raw==="object"?raw.y:raw;if(value===null||value===void 0||Number.isNaN(value))return;const props=typeof bar.getProps==="function"?bar.getProps(["x","y","base","width"],true):bar,label=typeof ds.insideLabel==="function"?ds.insideLabel(i):ds.insideLabel;if(!label)return;const top=Math.min(props.y,props.base),bottom=Math.max(props.y,props.base),height=bottom-top,width=Math.abs(props.width||bar.width||0),textWidth=ctx.measureText(label).width;if(height<textWidth+10||width<12)return;ctx.save();ctx.translate(props.x,top+height/2);ctx.rotate(-Math.PI/2);ctx.lineWidth=3;ctx.strokeStyle="rgba(255,255,255,0.78)";ctx.fillStyle=ds.insideLabelColor||"#1f2937";ctx.strokeText(label,0,0);ctx.fillText(label,0,0);ctx.restore();});});ctx.restore();}};
    Chart.register(chartLabelHitboxesPlugin,doughnutPctLabelsPlugin,linePointLabelsPlugin,barValueLabelsPlugin,barInsideLabelsPlugin);
    document.addEventListener("DOMContentLoaded",()=>{
      $("dateFieldFilter").addEventListener("change",()=>handleDateFieldChange());
      $("monthFilter").addEventListener("change",e=>updateDashboard(e.target.value));
      $("refreshButton").addEventListener("click",()=>loadLiveData(true));
      $("kpi2-detail-button").addEventListener("click",openKpi2DetailModal);
      $("kpi2-detail-close").addEventListener("click",closeKpi2DetailModal);
      $("kpi2-detail-modal").addEventListener("click",e=>{if(e.target===e.currentTarget)closeKpi2DetailModal();});
      $("kpi2-cuts-close").addEventListener("click",closeKpi2CutsModal);
      $("kpi2-cuts-modal").addEventListener("click",e=>{if(e.target===e.currentTarget)closeKpi2CutsModal();});
      $("kpi3-detail-button").addEventListener("click",openKpi3DetailModal);
      $("kpi3-detail-close").addEventListener("click",closeKpi3DetailModal);
      $("kpi3-detail-modal").addEventListener("click",e=>{if(e.target===e.currentTarget)closeKpi3DetailModal();});
      document.addEventListener("keydown",e=>{
        if(e.key!=="Escape")return;
        if(isKpi2CutsModalOpen()){closeKpi2CutsModal();return;}
        if(isKpi2DetailModalOpen())closeKpi2DetailModal();
        if(isKpi3DetailModalOpen())closeKpi3DetailModal();
      });
      syncMonthFilterLabel();
      loadLiveData(false);
    });

    function loadLiveData(preserveSelection){
      const prev=preserveSelection?($("monthFilter").value||currentMonthKey()):currentMonthKey();
      disableControls(true);
      Promise.allSettled(SHEET_SOURCES.map(source=>loadSheetMatrix(source))).then(results=>{
        const matrices=[],failures=[];
        results.forEach((result,i)=>{
          const source=SHEET_SOURCES[i];
          if(result.status==="fulfilled"&&result.value?.length)matrices.push(result.value);
          else failures.push({source,reason:result.status==="rejected"?result.reason:result.value?.error||new Error("Respuesta vacia")});
        });
        if(!matrices.length){
          showError("No se pudo leer ninguna de las hojas compartidas de Google Sheets.");
          return;
        }
        rawData=mergeSheetMatrices(matrices);
        buildColumnMap();
        processedData=buildProcessedData();
        lastLoadedAt=new Date();
        populateMonthFilter(prev);
        updateDashboard(resolveSelectedMonth(prev));
        disableControls(false);
        if(failures.length)console.warn("Se cargaron los KPI con una o más fuentes con error:",failures);
      }).catch(error=>{
        console.error(error);
        showError(`Error cargando datos: ${error.message}`);
      });
    }

    function loadSheetMatrix(source){
      return window.PcpGoogleSheets.loadGvizJsonp({
        spreadsheetId:source.id,
        gid:source.gid,
        label:source.label,
        callbackPrefix:"kpiCb",
        errorMessage:`No se pudo leer la hoja compartida (${source.label}).`
      }).then(extractSheetMatrix);
    }

    function extractSheetMatrix(json){
      return window.PcpGoogleSheets.gvizTableToMatrix(json,{
        requiredHeader:"OP TELA",
        normalizeHeader:norm,
        invalidMessage:"Respuesta invalida de la hoja.",
        missingHeadersMessage:"No se encontraron encabezados en la hoja."
      });
    }

    function mergeSheetMatrices(matrices){
      const merged=[matrices[0][0]||[]];
      matrices.forEach(matrix=>{
        if(!Array.isArray(matrix)||!matrix.length)return;
        const header=matrix[0]||[];
        const body=matrix.slice(1);
        if(!merged[0].length&&header.length)merged[0]=header;
        if(merged[0].length&&header.length&&header.length!==merged[0].length)console.warn("La hoja cargada tiene una cantidad de columnas distinta; se intentará continuar.",header,merged[0]);
        body.forEach(row=>merged.push(Array.isArray(row)?row:[]));
      });
      return merged;
    }

    function buildColumnMap(){
      colMap=new Map();
      (rawData[0]||[]).forEach((h,i)=>{const k=norm(h);if(k&&!colMap.has(k))colMap.set(k,i);});
      const fd=norm("F. DESPACHO");
      if(!colMap.has("HOD")&&colMap.has(fd))colMap.set("HOD",colMap.get(fd));
      if(!colMap.has(fd)&&colMap.has("HOD"))colMap.set(fd,colMap.get("HOD"));
    }

    function buildProcessedData(){return rawData.slice(1).map((row,i)=>buildRow(row,i)).filter(Boolean);}
    function buildRow(row,i){
      if(!Array.isArray(row)||!row.length)return null;
      const op=txt(val(row,["OP"])),corte=txt(val(row,["CORTE"])),cliente=txt(val(row,["CLIENTE","CUSTOMER","CLIENT"])),oc=txt(val(row,["OC","O/C","ORDEN DE COMPRA","ORDEN COMPRA","PO","P.O.","P/O"]))||op,color=txt(val(row,["COLOR","COLOR TELA","COLOUR","COLORWAY"])),fGirRaw=val(row,["F. GIRADO","F GIRADO"]),fGir=dayStart(fGirRaw);
      if(!op||!corte||!fGir)return null;
      const fCorteRaw=val(row,["FECHA CORTE","F. CORTE","F CORTE"]),fDespRaw=val(row,["HOD","F. DESPACHO","F DESPACHO"]),fPlanRaw=val(row,["F.ING.COST","F. ING COST","F ING COST","F.ING"]),fRealRaw=getFIngReal(row),ruta=route(val(row,["RUTA TELA","RUTA"])),tipoBordado=txt(val(row,["tipo-bordado","TIPO-BORDADO","tipo_bordado","TIPO_BORDADO","tipo bordado","TIPO BORDADO"])),pdsGiradas=numberValue(val(row,["PDS GIRADAS","PDS_GIRADAS","PDSGIRADAS"])),fCorte=dayStart(fCorteRaw),fDesp=dayStart(fDespRaw),fReal=dayStart(fRealRaw);
      return {src:i+2,op,corte,cliente,oc,color,ruta,tipoBordado,isEnPieza:isEnPiezaTipo(tipoBordado),fGirRaw,fCorteRaw,fDespRaw,fPlanRaw,fRealRaw,fGir,fCorte,fDesp,fReal,pdsGiradas,monthKey:monthKey(fGir),k1:diffDays(fDespRaw,fGirRaw),k2:diffDays(fRealRaw,fGirRaw),k3:diffDays(fRealRaw,fPlanRaw)};
    }

    function updateDashboard(month){
      const current=month||"ALL",select=$("monthFilter");
      if([...select.options].some(o=>o.value===current))select.value=current;
      const field=selectedDateField(),data=current==="ALL"?[...processedData]:processedData.filter(r=>monthKeyByField(r,field)===current);
      currentDashboardRows=data;
      currentDashboardMonth=current;
      currentDashboardField=field;
      renderKPIs(data);renderCharts(data);renderStatus(data,current);
      if(isKpi2DetailModalOpen())renderKpi2DetailChart();
      if(isKpi3DetailModalOpen())renderKpi3DetailChart();
    }

    function renderKPIs(data){
      const k1s=data.filter(r=>r.k1!==null).map(r=>r.k1),k1Ge45=k1s.filter(v=>v>=45),k1Ge30Lt45=k1s.filter(v=>v>=30&&v<45),k1Ge20Lt30=k1s.filter(v=>v>=20&&v<30),k1Ge10Lt20=k1s.filter(v=>v>=10&&v<20),k1Lt10=k1s.filter(v=>v<10),k2aP=data.filter(r=>isAcabLike(r.ruta)&&r.isEnPieza&&r.k2!==null).map(r=>r.k2),k2aO=data.filter(r=>isAcabLike(r.ruta)&&!r.isEnPieza&&r.k2!==null).map(r=>r.k2),k2lP=data.filter(r=>r.ruta==="LAVADA"&&r.isEnPieza&&r.k2!==null).map(r=>r.k2),k2lO=data.filter(r=>r.ruta==="LAVADA"&&!r.isEnPieza&&r.k2!==null).map(r=>r.k2),k3s=data.filter(r=>r.k3!==null).map(r=>r.k3),earlyVals=k3s.filter(v=>v<0),onTimeVals=k3s.filter(v=>v===0),lateVals=k3s.filter(v=>v>0),missingPlanCount=data.filter(r=>!txt(r.fPlanRaw)).length;
      setMetric("kpi1-value",avg(k1s),v=>v>=30,v=>v<30);setPctAvgMetric("kpi1-ge45-pct","kpi1-ge45",k1Ge45.length,k1s.length,avg(k1Ge45));setPctAvgMetric("kpi1-ge30lt45-pct","kpi1-ge30lt45",k1Ge30Lt45.length,k1s.length,avg(k1Ge30Lt45));setPctAvgMetric("kpi1-ge20lt30-pct","kpi1-ge20lt30",k1Ge20Lt30.length,k1s.length,avg(k1Ge20Lt30));setPctAvgMetric("kpi1-ge10lt20-pct","kpi1-ge10lt20",k1Ge10Lt20.length,k1s.length,avg(k1Ge10Lt20));setPctAvgMetric("kpi1-lt10-pct","kpi1-lt10",k1Lt10.length,k1s.length,avg(k1Lt10));
      setMetric("kpi2-acabada-pieza",mode(k2aP));setMetric("kpi2-acabada-otros",mode(k2aO));setMetric("kpi2-lavada-pieza",mode(k2lP));setMetric("kpi2-lavada-otros",mode(k2lO));setMetric("kpi3-value",avg(k3s),v=>v>=-2&&v<=2,v=>v>2,v=>v<-2,true);
      setCountAvgMetric("kpi3-early",earlyVals.length,"adelantados",avg(earlyVals),k3s.length,true);setCountAvgMetric("kpi3-ontime",onTimeVals.length,"en fecha",avg(onTimeVals),k3s.length,false);setCountAvgMetric("kpi3-late",lateVals.length,"atrasados",avg(lateVals),k3s.length,true);
      setCountNoteMetric("kpi3-missing-plan",missingPlanCount,"cortes",data.length,"sin F.ING.COST");
    }

    function renderCharts(data){renderEntregasTelaTable(data);renderScatter(data);}
    function renderEntregasTelaTable(data){
      const wrap=$("entregas-tela-wrap"),thead=$("entregas-tela-thead"),tbody=$("entregas-tela-tbody"),empty=$("entregas-tela-empty"),rows=data.filter(r=>r.k1!==null),buckets=[{label:"Cortes Tela \u226545d",min:45,max:null},{label:"Cortes Tela \u226530d y <45d",min:30,max:45},{label:"Cortes Tela \u226520d y <30d",min:20,max:30},{label:"Cortes Tela \u226510d y <20d",min:10,max:20},{label:"Cortes Tela <10d",min:null,max:10}];
      const clientTotals=new Map(),clientOrder=[];
      rows.forEach(r=>{const client=normalizeClientLabel(r.cliente);if(!clientTotals.has(client))clientOrder.push(client);clientTotals.set(client,(clientTotals.get(client)||0)+(r.pdsGiradas||0));});
      const clients=clientOrder.slice().sort((a,b)=>(clientTotals.get(b)||0)-(clientTotals.get(a)||0)||a.localeCompare(b,"es",{sensitivity:"base"})),bucketRowsList=buckets.map(bucket=>rows.filter(r=>bucket.min===null?r.k1<bucket.max:bucket.max===null?r.k1>=bucket.min:r.k1>=bucket.min&&r.k1<bucket.max));
      if(!rows.length||!clients.length){thead.innerHTML="";tbody.innerHTML="";wrap.classList.add("hidden");empty.classList.remove("hidden");return;}
      empty.classList.add("hidden");wrap.classList.remove("hidden");
      thead.innerHTML=`<tr><th class="sticky top-0 z-10 border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold">Rango Entrega</th>${clients.map(client=>`<th class="sticky top-0 z-10 border border-slate-300 bg-slate-100 px-3 py-2 text-center font-semibold">${escapeHtml(client)}</th>`).join("")}</tr>`;
      const clientBucketValues=clients.map(client=>bucketRowsList.map(bucketRows=>bucketRows.reduce((sum,r)=>normalizeClientLabel(r.cliente)===client?sum+(r.pdsGiradas||0):sum,0))),clientBucketPcts=clientBucketValues.map(values=>percentagesThatSumTo100(values));
      const clientBucketTotals=clientBucketValues.map(values=>values.reduce((sum,v)=>sum+(v||0),0));
      entregasHoverCellMap=new Map();
      bucketRowsList.forEach((bucketRows,bucketIndex)=>{clients.forEach((client,clientIndex)=>{const cellRows=bucketRows.filter(r=>normalizeClientLabel(r.cliente)===client).slice().sort((a,b)=>{const at=dayStart(a.fCorteRaw)?.getTime()||0,bt=dayStart(b.fCorteRaw)?.getTime()||0;return at-bt||(txt(a.corte).localeCompare(txt(b.corte),"es",{sensitivity:"base"}));}),points=cellRows.map((r,i)=>({x:diffDays(r.fCorteRaw,r.fGirRaw),op:r.op,corte:r.corte,cliente:r.cliente,fCorte:r.fCorteRaw,fGir:r.fGirRaw})).filter(p=>p.x!==null);entregasHoverCellMap.set(`${bucketIndex}|${clientIndex}`,{bucketLabel:buckets[bucketIndex].label,clientLabel:client,points});});});
      tbody.innerHTML=`${buckets.map((bucket,idx)=>`<tr class="${idx%2?"bg-slate-50/70":"bg-white"}"><td class="whitespace-nowrap border border-slate-300 px-3 py-2 font-semibold text-slate-800">${escapeHtml(bucket.label)}</td>${clients.map((client,clientIndex)=>{const pct=clientBucketPcts[clientIndex]?.[idx],heat=heatmapBlueStyle(pct);return `<td data-entregas-key="${idx}|${clientIndex}" class="whitespace-nowrap border border-slate-300 px-3 py-2 text-right ${heat.textClass} cursor-crosshair" style="${heat.style}" title="${pct===null?"":`${pct}%`}">${escapeHtml(pct===null||pct===0?"":`${pct}%`)}</td>`;}).join("")}</tr>`).join("")}<tr class="bg-emerald-100/35 font-bold text-emerald-900"><td class="whitespace-nowrap border border-emerald-300 px-3 py-2 font-bold text-emerald-900">TOTAL PRENDAS</td>${clients.map((client,clientIndex)=>`<td class="whitespace-nowrap border border-emerald-300 px-3 py-2 text-right font-bold text-emerald-900">${escapeHtml(compactPdsText(clientBucketTotals[clientIndex]))}</td>`).join("")}</tr>`;
      wireEntregasHoverCells();
    }

    function wireEntregasHoverCells(){
      const cells=document.querySelectorAll("td[data-entregas-key]");
      cells.forEach(cell=>{
        cell.addEventListener("click",handleEntregasHoverEnter);
      });
      document.addEventListener("click",handleEntregasDocumentClick);
    }

    function handleEntregasHoverEnter(event){
      const cell=event.currentTarget,key=cell?.dataset?.entregasKey,info=entregasHoverCellMap.get(key);
      if(!info||!info.points.length){hideEntregasHoverTooltip();return;}
      event.stopPropagation();
      showEntregasHoverTooltip(info,event);
    }

    function handleEntregasDocumentClick(event){
      const tooltip=$("entregas-hover-tooltip");
      if(!tooltip||tooltip.classList.contains("hidden"))return;
      if(event.target.closest?.("td[data-entregas-key]"))return;
      if(tooltip.contains(event.target))return;
      hideEntregasHoverTooltip();
    }

    function showEntregasHoverTooltip(info,event){
      const tooltip=$("entregas-hover-tooltip"),title=$("entregas-hover-title"),subtitle=$("entregas-hover-subtitle"),summary=$("entregas-hover-summary");
      if(!tooltip||!title||!subtitle||!summary)return;
      title.textContent=`${info.bucketLabel} | ${info.clientLabel}`;
      subtitle.textContent="Eje X: dias (FECHA CORTE - F. GIRADO) | Eje Y: frecuencia";
      const points=info.points||[],stats=buildEntregasStats(points.map(p=>p.x));
      summary.textContent=stats.count?[
        `n=${stats.count} | Media: ${formatStatDays(stats.mean)} | Mediana: ${formatStatDays(stats.median)}`,
        `P25-P75: ${formatStatDays(stats.p25)} - ${formatStatDays(stats.p75)} | Min-Max: ${formatStatDays(stats.min)} - ${formatStatDays(stats.max)} | SD: ${formatStatDays(stats.stdev)}`
      ].join("\n"):"Sin datos suficientes para resumir.";
      tooltip.classList.remove("hidden");
      drawEntregasHoverHistogram(points,stats);
      positionEntregasHoverTooltip(event);
    }

    function hideEntregasHoverTooltip(){
      const tooltip=$("entregas-hover-tooltip");
      if(!tooltip)return;
      tooltip.classList.add("hidden");
    }

    function positionEntregasHoverTooltip(event){
      const tooltip=$("entregas-hover-tooltip");
      if(!tooltip)return;
      const pad=16,offset=18,width=tooltip.offsetWidth||320,height=tooltip.offsetHeight||220;
      let left=event.clientX+offset,top=event.clientY+offset;
      if(left+width+pad>window.innerWidth)left=event.clientX-width-offset;
      if(top+height+pad>window.innerHeight)top=event.clientY-height-offset;
      left=Math.max(pad,Math.min(left,window.innerWidth-width-pad));
      top=Math.max(pad,Math.min(top,window.innerHeight-height-pad));
      tooltip.style.left=`${left}px`;
      tooltip.style.top=`${top}px`;
    }

    function drawEntregasHoverGaussian(points){
      const canvas=$("entregas-hover-canvas"),ctx=canvas?.getContext("2d");
      if(!ctx)return;
      const w=canvas.width,h=canvas.height,m={l:42,r:14,t:16,b:34};
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);
      ctx.strokeStyle="#dbe4f0";ctx.lineWidth=1;
      const xs=(points||[]).map(p=>p.x).filter(v=>v!==null&&!Number.isNaN(v));
      if(!xs.length){ctx.fillStyle="#94a3b8";ctx.font="12px Segoe UI";ctx.fillText("Sin datos para graficar",m.l,Math.floor(h/2));return;}
      const plotW=w-m.l-m.r,plotH=h-m.t-m.b;
      const sorted=[...xs].sort((a,b)=>a-b),mean=avg(sorted)||0,variance=sorted.reduce((acc,v)=>acc+((v-mean)**2),0)/Math.max(1,sorted.length-1),stdev=Math.sqrt(variance)||1,bandwidth=Math.max(1,stdev*0.65);
      const kde=x=>sorted.reduce((acc,v)=>acc+Math.exp(-0.5*(((x-v)/bandwidth)**2)),0);
      const minX=Math.min(...sorted),maxX=Math.max(...sorted),padX=maxX===minX?1:Math.max(1,(maxX-minX)*0.2),xMin=minX-padX,xMax=maxX+padX;
      const sampleCount=Math.max(28,Math.min(64,Math.round(plotW/8))),samples=Array.from({length:sampleCount},(_,i)=>xMin+(i*(xMax-xMin))/Math.max(1,sampleCount-1)),densities=samples.map(x=>kde(x)),maxDensity=Math.max(...densities,1);
      const xScale=x=>m.l+((x-xMin)/(xMax-xMin))*plotW;
      const yScale=d=>h-m.b-(d/maxDensity)*plotH*0.82;
      ctx.strokeStyle="#e2e8f0";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(m.l,m.t);ctx.lineTo(m.l,h-m.b);ctx.lineTo(w-m.r,h-m.b);ctx.stroke();
      ctx.font="10px Segoe UI";ctx.fillStyle="#64748b";ctx.textAlign="right";ctx.textBaseline="middle";
      const yTicks=4;
      for(let i=0;i<=yTicks;i++){
        const d=maxDensity-(i*(maxDensity/yTicks)),y=yScale(d);
        ctx.strokeStyle="#eef2f7";ctx.beginPath();ctx.moveTo(m.l,y);ctx.lineTo(w-m.r,y);ctx.stroke();
        ctx.fillText(i===0?"100%":`${Math.round((d/maxDensity)*100)}%`,m.l-6,y);
      }
      ctx.textAlign="center";ctx.textBaseline="top";
      [xMin,mean,xMax].forEach(v=>{const x=xScale(v);ctx.fillText(`${metricValue(v,false)}`,x,h-m.b+4);});
      const dotRadius=Math.max(4.2,Math.min(6.2,plotW/70));
      sorted.forEach(x=>{
        const density=kde(x),intensity=0.15+0.82*(density/maxDensity),px=xScale(x),py=yScale(density);
        ctx.save();
        ctx.shadowColor=`rgba(37,99,235,${Math.min(0.35,intensity/2)})`;
        ctx.shadowBlur=2;
        ctx.fillStyle=`rgba(37,99,235,${intensity})`;
        ctx.beginPath();ctx.arc(px,py,dotRadius,0,Math.PI*2);ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle="#334155";ctx.font="bold 10px Segoe UI";ctx.textAlign="center";ctx.textBaseline="top";ctx.fillText("Días",w/2,h-4);
      ctx.save();ctx.translate(9,h/2);ctx.rotate(-Math.PI/2);ctx.fillText("Densidad gaussiana",0,0);ctx.restore();
    }

    function drawEntregasHoverHeatmapDots(points){
      const canvas=$("entregas-hover-canvas"),ctx=canvas?.getContext("2d");
      if(!ctx)return;
      const w=canvas.width,h=canvas.height,m={l:42,r:14,t:16,b:34};
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);
      ctx.strokeStyle="#dbe4f0";ctx.lineWidth=1;
      const xs=(points||[]).map(p=>p.x).filter(v=>v!==null&&!Number.isNaN(v));
      if(!xs.length){ctx.fillStyle="#94a3b8";ctx.font="12px Segoe UI";ctx.fillText("Sin datos para graficar",m.l,Math.floor(h/2));return;}
      const plotW=w-m.l-m.r,plotH=h-m.t-m.b;
      const sorted=[...xs].sort((a,b)=>a-b),mean=avg(sorted)||0;
      const minX=Math.min(...sorted),maxX=Math.max(...sorted),padX=maxX===minX?1:Math.max(1,(maxX-minX)*0.18),xMin=minX-padX,xMax=maxX+padX;
      const xScale=x=>m.l+((x-xMin)/(xMax-xMin))*plotW;
      const kdeBandwidth=Math.max(1,(maxX-minX||1)*0.16);
      const kde=x=>sorted.reduce((acc,v)=>acc+Math.exp(-0.5*(((x-v)/kdeBandwidth)**2)),0);
      const maxDensity=Math.max(...sorted.map(v=>kde(v)),1);
      const binCount=Math.max(10,Math.min(18,Math.round(Math.sqrt(sorted.length)*2)));
      const binWidth=(xMax-xMin)/binCount||1;
      const bins=Array.from({length:binCount},()=>[]);
      sorted.forEach(x=>{
        const idx=Math.max(0,Math.min(binCount-1,Math.floor((x-xMin)/binWidth)));
        bins[idx].push(x);
      });
      ctx.strokeStyle="#e2e8f0";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(m.l,m.t);ctx.lineTo(m.l,h-m.b);ctx.lineTo(w-m.r,h-m.b);ctx.stroke();
      ctx.font="10px Segoe UI";ctx.fillStyle="#64748b";ctx.textAlign="right";ctx.textBaseline="middle";
      const yTicks=4;
      for(let i=0;i<=yTicks;i++){
        const level=i/yTicks,y=h-m.b-(level*plotH*0.82);
        ctx.strokeStyle="#eef2f7";ctx.beginPath();ctx.moveTo(m.l,y);ctx.lineTo(w-m.r,y);ctx.stroke();
        ctx.fillText(i===0?"100%":`${Math.round((1-level)*100)}%`,m.l-6,y);
      }
      ctx.textAlign="center";ctx.textBaseline="top";
      [xMin,mean,xMax].forEach(v=>{const x=xScale(v);ctx.fillText(`${metricValue(v,false)}`,x,h-m.b+4);});
      const baseRadius=Math.max(4.2,Math.min(6.4,plotW/68));
      const stackGap=Math.max(8,Math.min(14,plotH/10));
      bins.forEach((bin,binIndex)=>{
        if(!bin.length)return;
        const cx=xScale(xMin+(binIndex+0.5)*binWidth),density=kde(cx),intensity=0.14+0.84*(density/maxDensity);
        bin.forEach((_,itemIndex)=>{
          const row=Math.floor(itemIndex/3),col=itemIndex%3,px=cx+((col-1)*4),py=h-m.b-10-(row*stackGap);
          ctx.save();
          ctx.shadowColor=`rgba(37,99,235,${Math.min(0.30,intensity/2)})`;
          ctx.shadowBlur=2;
          ctx.fillStyle=`rgba(37,99,235,${intensity})`;
          ctx.beginPath();ctx.arc(px,py,baseRadius,0,Math.PI*2);ctx.fill();
          ctx.restore();
        });
      });
      ctx.fillStyle="#334155";ctx.font="bold 10px Segoe UI";ctx.textAlign="center";ctx.textBaseline="top";ctx.fillText("Dias",w/2,h-4);
      ctx.save();ctx.translate(9,h/2);ctx.rotate(-Math.PI/2);ctx.fillText("Densidad",0,0);ctx.restore();
    }

    function drawEntregasHoverHistogram(points,stats){
      const canvas=$("entregas-hover-canvas"),ctx=canvas?.getContext("2d");
      if(!ctx)return;
      const w=canvas.width,h=canvas.height,m={l:44,r:14,t:16,b:34};
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h);
      ctx.strokeStyle="#dbe4f0";ctx.lineWidth=1;
      const xs=(points||[]).map(p=>p.x).filter(v=>v!==null&&!Number.isNaN(v));
      if(!xs.length){ctx.fillStyle="#94a3b8";ctx.font="12px Segoe UI";ctx.fillText("Sin datos para graficar",m.l,Math.floor(h/2));return;}
      const plotW=w-m.l-m.r,plotH=h-m.t-m.b;
      const sorted=sortedNumeric(xs),count=sorted.length;
      const min=stats?.min??sorted[0],max=stats?.max??sorted[sorted.length-1],mean=stats?.mean??avg(sorted),median=stats?.median??quantileSorted(sorted,0.5),q1=stats?.p25??quantileSorted(sorted,0.25),q3=stats?.p75??quantileSorted(sorted,0.75);
      const xMin=min===max?min-1:min-Math.max(1,(max-min)*0.12),xMax=min===max?max+1:max+Math.max(1,(max-min)*0.12);
      const binCount=Math.max(5,Math.min(9,Math.round(Math.sqrt(count)+1))),binWidth=(xMax-xMin)/binCount||1,bins=Array.from({length:binCount},()=>0);
      sorted.forEach(v=>{
        const idx=Math.max(0,Math.min(binCount-1,Math.floor((v-xMin)/binWidth)));
        bins[idx]+=1;
      });
      const maxCount=Math.max(...bins,1),xScale=v=>m.l+((v-xMin)/(xMax-xMin))*plotW,yScale=c=>h-m.b-(c/maxCount)*(plotH*0.8);
      ctx.strokeStyle="#e2e8f0";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(m.l,m.t);ctx.lineTo(m.l,h-m.b);ctx.lineTo(w-m.r,h-m.b);ctx.stroke();
      ctx.font="10px Segoe UI";ctx.fillStyle="#64748b";ctx.textAlign="right";ctx.textBaseline="middle";
      const yTicks=4;
      for(let i=0;i<=yTicks;i++){
        const c=maxCount-(i*(maxCount/yTicks)),y=yScale(c);
        ctx.strokeStyle="#eef2f7";ctx.beginPath();ctx.moveTo(m.l,y);ctx.lineTo(w-m.r,y);ctx.stroke();
        ctx.fillText(i===0?"0":`${Math.round(c)}`,m.l-6,y);
      }
      ctx.textAlign="center";ctx.textBaseline="top";
      [min,q1,median,q3,max].filter(v=>v!==null&&v!==void 0&&!Number.isNaN(v)).forEach(v=>{const x=xScale(v);ctx.fillText(`${metricValue(v,false)}`,x,h-m.b+4);});
      bins.forEach((c,idx)=>{
        if(!c)return;
        const barW=Math.max(6,(plotW/binCount)-3),left=m.l+idx*(plotW/binCount)+1,barH=(c/maxCount)*(plotH*0.8),top=(h-m.b)-barH,intensity=0.18+0.76*(c/maxCount);
        ctx.fillStyle=`rgba(37,99,235,${intensity})`;
        ctx.strokeStyle=`rgba(29,78,216,${Math.min(0.95,intensity+0.08)})`;
        ctx.fillRect(left,top,barW,barH);
        ctx.strokeRect(left,top,barW,barH);
      });
      if(Number.isFinite(mean)){
        const meanX=xScale(mean);
        ctx.save();
        ctx.setLineDash([5,4]);
        ctx.strokeStyle="#0f172a";
        ctx.lineWidth=1.2;
        ctx.beginPath();ctx.moveTo(meanX,m.t);ctx.lineTo(meanX,h-m.b);ctx.stroke();
        ctx.restore();
      }
      if(Number.isFinite(median)){
        const medianX=xScale(median);
        ctx.save();
        ctx.setLineDash([3,3]);
        ctx.strokeStyle="#1d4ed8";
        ctx.lineWidth=1.3;
        ctx.beginPath();ctx.moveTo(medianX,m.t);ctx.lineTo(medianX,h-m.b);ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle="#334155";ctx.font="bold 10px Segoe UI";ctx.textAlign="center";ctx.textBaseline="top";ctx.fillText("Dias",w/2,h-4);
      ctx.save();ctx.translate(10,h/2);ctx.rotate(-Math.PI/2);ctx.fillText("Frecuencia",0,0);ctx.restore();
    }

    function renderScatter(data){
      const ctx=$("chartKPI3").getContext("2d"),pts=buildScatterPoints(data);
      if(chart3)chart3.destroy();
      chart3=new Chart(ctx,{type:"scatter",data:{datasets:[{label:"Cortes",data:pts,backgroundColor:pts.map(p=>p.color),borderColor:pts.map(p=>p.borderColor),pointRadius:pts.map(p=>p.radius),pointHoverRadius:pts.map(p=>p.radius+2),pointHitRadius:10}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label(c){const p=c.raw;return[`OP ${p.op} / Corte ${p.corte}`,`Anticipacion real: ${p.ax}d`,`Desviacion real: ${metricText(p.ay,true)}`,`Ruta: ${p.ruta}`,`Gir: ${p.gir} | Plan: ${p.plan} | Real: ${p.real}`,p.n>1?`Comparte coordenada con ${p.n} corte(s)`:"Coordenada unica"];}}}},scales:{x:{title:{display:true,text:"Anticipacion Tela (Dias)",color:"#000",font:{size:13,weight:"700"}},ticks:{color:"#000",font:{size:12}}},y:{title:{display:true,text:"Desviacion Costura (Dias)",color:"#000",font:{size:13,weight:"700"}},ticks:{color:"#000",font:{size:12}},grid:{color(ctx){return ctx.tick.value===0?"rgba(0,0,0,0.35)":"rgba(0,0,0,0.05)";}}}}}});
    }

    function openKpi2DetailModal(){
      const modal=$("kpi2-detail-modal");
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      syncDetailModalBodyOverflow();
      requestAnimationFrame(()=>renderKpi2DetailChart());
    }

    function closeKpi2DetailModal(){
      closeKpi2CutsModal();
      const modal=$("kpi2-detail-modal");
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      syncDetailModalBodyOverflow();
    }

    function isKpi2DetailModalOpen(){return $("kpi2-detail-modal")&&!$("kpi2-detail-modal").classList.contains("hidden");}

    function openKpi2CutsModal(detail){
      const modal=$("kpi2-cuts-modal"),tbody=$("kpi2-cuts-tbody"),empty=$("kpi2-cuts-empty"),wrap=$("kpi2-cuts-table-wrap"),rows=(Array.isArray(detail?.rows)?detail.rows:[]).filter(r=>r&&r.k2!==null).slice().sort((a,b)=>(b.k2-a.k2)||ocDisplayValue(a).localeCompare(ocDisplayValue(b))),summaryParts=[detail?.datasetLabel||"Cortes",detail?.weekLabel||"",detail?.period||"",`${rows.length} corte(s)`,`Ordenado por dias de mayor a menor.`].filter(Boolean);
      $("kpi2-cuts-subtitle").textContent=summaryParts.slice(0,4).join(" | ")||"Detalle de cortes por barra del KPI 2.";
      $("kpi2-cuts-summary").textContent=summaryParts.join(" | ");
      tbody.innerHTML=rows.map((r,idx)=>`<tr class="${idx%2?"bg-slate-50/70":"bg-white"}"><td class="whitespace-nowrap px-3 py-2">${escapeHtml(displayText(r.cliente))}</td><td class="whitespace-nowrap px-3 py-2 font-semibold text-slate-800">${escapeHtml(ocDisplayValue(r))}</td><td class="whitespace-nowrap px-3 py-2">${escapeHtml(displayText(r.color))}</td><td class="whitespace-nowrap px-3 py-2 text-right">${escapeHtml(numberText(r.pdsGiradas))}</td><td class="whitespace-nowrap px-3 py-2">${escapeHtml(shortMonthYearDateLabel(r.fGirRaw))}</td><td class="whitespace-nowrap px-3 py-2">${escapeHtml(shortMonthYearDateLabel(r.fPlanRaw))}</td><td class="whitespace-nowrap px-3 py-2">${escapeHtml(shortMonthYearDateLabel(r.fCorteRaw))}</td><td class="whitespace-nowrap px-3 py-2">${escapeHtml(shortMonthYearDateLabel(r.fRealRaw))}</td><td class="whitespace-nowrap px-3 py-2">${escapeHtml(shortMonthYearDateLabel(r.fDespRaw))}</td><td class="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-800">${escapeHtml(numberText(r.k2))}</td></tr>`).join("");
      wrap.classList.toggle("hidden",!rows.length);
      empty.classList.toggle("hidden",rows.length>0);
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      syncDetailModalBodyOverflow();
    }

    function closeKpi2CutsModal(){
      const modal=$("kpi2-cuts-modal");
      if(!modal)return;
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      syncDetailModalBodyOverflow();
    }

    function isKpi2CutsModalOpen(){return $("kpi2-cuts-modal")&&!$("kpi2-cuts-modal").classList.contains("hidden");}

    function renderKpi2DetailChart(){
      const ctx=$("chartKPI2Detail").getContext("2d"),empty=$("kpi2-detail-empty"),wrap=$("kpi2-detail-chart-wrap"),detail=buildKpi2DetailContext(),series=buildKpi2DetailSeries(detail.rows),hasData=series.labels.length>0;
      $("kpi2-detail-subtitle").textContent=`X: Semana agrupada de F.ING.REAL | Y: moda de dias desde F. Girado hasta ingreso costura real${detail.selectionLabel?` | Filtro: ${detail.selectionLabel}`:""}${series.range?` | Rango: ${series.range}`:""}`;
      empty.classList.toggle("hidden",hasData);
      wrap.style.minWidth=`${Math.max(960,series.labels.length*86)}px`;
      if(chart2Detail)chart2Detail.destroy();
      if(!hasData)return;
      chart2Detail=new Chart(ctx,{type:"line",data:{labels:series.labels,datasets:[kpi2LineDataset("Meta 7 dias",series.labels.map(()=>7),series.labels.map(()=>0),"#DC2626",{pointRadius:0,pointHoverRadius:0,pointHitRadius:0,borderWidth:1.8,tension:0,hidePointLabels:true}),kpi2BarDataset("RUTA: ACABADA + Bordado",series.acabadaPieza,series.acabadaPiezaCount,"rgba(79, 70, 229, 0.28)","#4F46E5",{insideLabel:"ACAB+ BD",insideLabelColor:"#312E81",detailRows:series.acabadaPiezaRows}),kpi2BarDataset("RUTA: ACABADA (sin bordado)",series.acabadaOtros,series.acabadaOtrosCount,"rgba(14, 165, 233, 0.22)","#0EA5E9",{insideLabel:"ACAB s/bd",insideLabelColor:"#075985",detailRows:series.acabadaOtrosRows}),kpi2BarDataset("RUTA: LAVADA + Bordado",series.lavadaPieza,series.lavadaPiezaCount,"rgba(124, 58, 237, 0.30)","#7C3AED",{insideLabel:"LAV+ BD",insideLabelColor:"#4C1D95",detailRows:series.lavadaPiezaRows}),kpi2BarDataset("RUTA: LAVADA (sin bordado)",series.lavadaOtros,series.lavadaOtrosCount,"rgba(236, 72, 153, 0.24)","#EC4899",{insideLabel:"LAV s/bd",insideLabelColor:"#9D174D",detailRows:series.lavadaOtrosRows})]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:"top",labels:{usePointStyle:true,boxWidth:10,font:{size:11}}},linePointLabels:{display:false},barValueLabels:{display:true,format:v=>kpi2PointLabel(v)},barInsideLabels:{display:true,font:"bold 9px Segoe UI"},tooltip:{callbacks:{title(items){if(!items.length)return"";const i=items[0].dataIndex;return`${series.labels[i]} | ${series.periods[i]||""}`.trim();},label(c){return`${c.dataset.label}: ${modeDaysOnlyLabel(c.raw)}`;},afterLabel(c){const count=c.dataset.counts?.[c.dataIndex]||0;return count?`Cortes: ${count}`:"";}}}},scales:{x:{title:{display:true,text:"Semana (F. Ing. Real)",color:"#0f172a",font:{size:13,weight:"700"}},ticks:{color:"#334155",font:{size:11},maxRotation:0,minRotation:0},grid:{display:false}},y:{beginAtZero:true,title:{display:true,text:"Moda de dias (F. Girado -> F. Ing. Real)",color:"#0f172a",font:{size:13,weight:"700"}},ticks:{color:"#334155",font:{size:11},callback:v=>`${v}`},grid:{color:"rgba(148,163,184,0.2)"}}}}});
      chart2Detail.$detailPeriods=series.periods;
      chart2Detail.canvas.oncontextmenu=e=>handleKpi2DetailContextMenu(chart2Detail,e);
    }

    function buildKpi2DetailContext(){
      const field=currentDashboardField||selectedDateField(),months=getVisibleMonthKeys(field);
      if(!months.length)return{rows:[],selectionLabel:""};
      let reference=currentDashboardMonth&&currentDashboardMonth!=="ALL"?currentDashboardMonth:months[months.length-1];
      if(!months.includes(reference))reference=months[months.length-1];
      const previous=shiftMonthKey(reference,-1),monthList=[previous,reference].filter(Boolean),rows=processedData.filter(r=>monthList.includes(monthKeyByField(r,field))&&r.k2!==null&&r.fReal),hasPrevious=rows.some(r=>monthKeyByField(r,field)===previous),labels=hasPrevious&&previous?[monthLabel(previous),monthLabel(reference)]:[monthLabel(reference)];
      return{rows,selectionLabel:`${labels.join(" y ")} (${dateFieldLabel(field)})`};
    }

    function buildKpi2DetailSeries(data){
      const rows=data.filter(r=>r.k2!==null&&r.fReal&&(isAcabLike(r.ruta)||r.ruta==="LAVADA")).slice().sort((a,b)=>a.fReal-b.fReal),byWeek=new Map();
      rows.forEach(r=>{
        const week=weekInfo(r.fReal),key=`${week.year}-${String(week.week).padStart(2,"0")}`;
        if(!byWeek.has(key))byWeek.set(key,{year:week.year,week:week.week,label:`SEM${String(week.week).padStart(2,"0")}`,period:week.rangeLabel,acabadaPiezaVals:[],acabadaPiezaRows:[],acabadaOtrosVals:[],acabadaOtrosRows:[],lavadaPiezaVals:[],lavadaPiezaRows:[],lavadaOtrosVals:[],lavadaOtrosRows:[]});
        const item=byWeek.get(key);
        if(isAcabLike(r.ruta)){if(r.isEnPieza){item.acabadaPiezaVals.push(r.k2);item.acabadaPiezaRows.push(r);}else{item.acabadaOtrosVals.push(r.k2);item.acabadaOtrosRows.push(r);}return;}
        if(r.ruta==="LAVADA"){if(r.isEnPieza){item.lavadaPiezaVals.push(r.k2);item.lavadaPiezaRows.push(r);}else{item.lavadaOtrosVals.push(r.k2);item.lavadaOtrosRows.push(r);}}
      });
      const points=[...byWeek.values()];
      return{labels:points.map(p=>p.label),periods:points.map(p=>p.period),acabadaPieza:points.map(p=>mode(p.acabadaPiezaVals)),acabadaPiezaCount:points.map(p=>p.acabadaPiezaVals.length),acabadaPiezaRows:points.map(p=>p.acabadaPiezaRows.slice()),acabadaOtros:points.map(p=>mode(p.acabadaOtrosVals)),acabadaOtrosCount:points.map(p=>p.acabadaOtrosVals.length),acabadaOtrosRows:points.map(p=>p.acabadaOtrosRows.slice()),lavadaPieza:points.map(p=>mode(p.lavadaPiezaVals)),lavadaPiezaCount:points.map(p=>p.lavadaPiezaVals.length),lavadaPiezaRows:points.map(p=>p.lavadaPiezaRows.slice()),lavadaOtros:points.map(p=>mode(p.lavadaOtrosVals)),lavadaOtrosCount:points.map(p=>p.lavadaOtrosVals.length),lavadaOtrosRows:points.map(p=>p.lavadaOtrosRows.slice()),range:points.length?`${points[0].label} a ${points[points.length-1].label}`:""};
    }

    function kpi2LineDataset(label,data,counts,color,extra){return{label,data,counts,borderColor:color,backgroundColor:color,pointBackgroundColor:color,pointBorderColor:"#ffffff",pointBorderWidth:1.5,pointRadius:4,pointHoverRadius:5,borderWidth:2,tension:.25,fill:false,yAxisID:"y",...(extra||{})};}
    function kpi2BarDataset(label,data,counts,backgroundColor,borderColor,extra){return{type:"bar",label,data,counts,backgroundColor,borderColor,borderWidth:1,barPercentage:.72,categoryPercentage:.58,yAxisID:"y",order:1,...(extra||{})};}
    function kpi2PointLabel(v){return v===null||v===void 0||Number.isNaN(v)?"":`${metricValue(v,false)}d`;}
    function syncDetailModalBodyOverflow(){document.body.style.overflow=isKpi2DetailModalOpen()||isKpi2CutsModalOpen()||isKpi3DetailModalOpen()?"hidden":"";}

    function openKpi3DetailModal(){
      const modal=$("kpi3-detail-modal");
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      syncDetailModalBodyOverflow();
      requestAnimationFrame(()=>renderKpi3DetailChart());
    }

    function closeKpi3DetailModal(){
      const modal=$("kpi3-detail-modal");
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      syncDetailModalBodyOverflow();
    }

    function isKpi3DetailModalOpen(){return $("kpi3-detail-modal")&&!$("kpi3-detail-modal").classList.contains("hidden");}

    function renderKpi3DetailChart(){
      const ctx=$("chartKPI3Detail").getContext("2d"),empty=$("kpi3-detail-empty"),wrap=$("kpi3-detail-chart-wrap"),detail=buildKpi3DetailContext(),series=buildKpi3DetailSeries(detail.rows),hasData=series.labels.length>0;
      $("kpi3-detail-subtitle").textContent=`X: Semana de ingreso real | Y: dias promedio de adherencia | Y secundario: dias tela atrasados${detail.monthsLabel?` | Meses: ${detail.monthsLabel}`:""}${series.range?` | Rango: ${series.range}`:""}`;
      empty.classList.toggle("hidden",hasData);
      wrap.style.minWidth=`${Math.max(960,series.labels.length*74)}px`;
      if(chart3Detail)chart3Detail.destroy();
      if(!hasData)return;
      chart3Detail=new Chart(ctx,{type:"line",data:{labels:series.labels,datasets:[{type:"bar",label:"atrasados dias tela",data:series.lateK1Avg,pdsGiradas:series.latePdsGiradas,totalPdsGiradas:series.totalPdsGiradas,backgroundColor:"rgba(239, 68, 68, 0.18)",borderColor:"rgba(239, 68, 68, 0.55)",borderWidth:1,yAxisID:"y2",order:1,barPercentage:.78,categoryPercentage:.6,cycleDetails:series.lateCycle},{label:"adelantados",data:series.earlyAvg,counts:series.early,pdsGiradas:series.earlyPdsGiradas,borderColor:"#2563EB",backgroundColor:"#2563EB",pointBackgroundColor:"#2563EB",pointBorderColor:"#ffffff",pointBorderWidth:1.5,pointRadius:4,pointHoverRadius:5,borderWidth:2,tension:.25,fill:false,yAxisID:"y",order:0,cycleDetails:series.earlyCycle},{label:"en fecha",data:series.onTimeAvg,counts:series.onTime,pdsGiradas:series.onTimePdsGiradas,borderColor:"#10B981",backgroundColor:"#10B981",pointBackgroundColor:"#10B981",pointBorderColor:"#ffffff",pointBorderWidth:1.5,pointRadius:4,pointHoverRadius:5,borderWidth:2,tension:.25,fill:false,yAxisID:"y",order:0,cycleDetails:series.onTimeCycle},{label:"atrasados",data:series.lateAvg,counts:series.late,pdsGiradas:series.latePdsGiradas,borderColor:"#EF4444",backgroundColor:"#EF4444",pointBackgroundColor:"#EF4444",pointBorderColor:"#ffffff",pointBorderWidth:1.5,pointRadius:4,pointHoverRadius:5,borderWidth:2,tension:.25,fill:false,yAxisID:"y",order:0,cycleDetails:series.lateCycle}]},options:{responsive:true,maintainAspectRatio:false,animation:false,events:[],plugins:{legend:{position:"top",labels:{usePointStyle:true,boxWidth:10,font:{size:11}}},linePointLabels:{display:true,offsets:[-16],format:(v,ds,di,i)=>detailPointLabel(v,ds.counts?.[i],ds.pdsGiradas?.[i],true)},barValueLabels:{display:true,placement:"base",format:(v,ds,di,i)=>avgDaysPdsLabel(v,ds.pdsGiradas?.[i],ds.totalPdsGiradas?.[i])},tooltip:{callbacks:{title(items){if(!items.length)return"";const i=items[0].dataIndex;return`${series.labels[i]} | ${series.periods[i]||""}`.trim();},label(c){return c.dataset.type==="bar"?`${c.dataset.label}: ${avgDaysPdsTooltip(c.raw,c.dataset.pdsGiradas?.[c.dataIndex],c.dataset.totalPdsGiradas?.[c.dataIndex])}`:`${c.dataset.label}: ${detailPointLabel(c.raw,c.dataset.counts?.[c.dataIndex],c.dataset.pdsGiradas?.[c.dataIndex],false)}`;},afterLabel(c){const extra=[];if(c.dataset.type==="bar"){const latePds=c.dataset.pdsGiradas?.[c.dataIndex],totalPds=c.dataset.totalPdsGiradas?.[c.dataIndex];if(totalPds)extra.push(`PDS GIRADAS atrasadas: ${numberText(latePds)} / ${numberText(totalPds)}`);}return[...extra,...cycleTooltipLines(c.dataset.cycleDetails?.[c.dataIndex])];}}}},scales:{x:{title:{display:true,text:"Semana (F. Ing. Real)",color:"#0f172a",font:{size:13,weight:"700"}},ticks:{color:"#334155",font:{size:11},maxRotation:0,minRotation:0},grid:{display:false}},y:{beginAtZero:true,title:{display:true,text:"Promedio de desviacion costura (Dias)",color:"#0f172a",font:{size:13,weight:"700"}},ticks:{color:"#334155",font:{size:11},callback:v=>`${v}`},grid:{color(ctx){return ctx.tick.value===0?"rgba(0,0,0,0.35)":"rgba(148,163,184,0.2)";}}},y2:{beginAtZero:true,position:"right",title:{display:true,text:"Dias F. Despacho - F. Girado",color:"#475569",font:{size:13,weight:"700"}},ticks:{color:"#475569",font:{size:11},callback:v=>`${v}`},grid:{drawOnChartArea:false}}}}});
      chart3Detail.canvas.onclick=e=>handleDetailChartClick(chart3Detail,e);
    }

    function buildKpi3DetailContext(){
      const field=currentDashboardField||selectedDateField(),months=getVisibleMonthKeys(field);
      if(!months.length)return{rows:[],monthsLabel:""};
      let reference=currentDashboardMonth&&currentDashboardMonth!=="ALL"?currentDashboardMonth:months[months.length-1];
      if(!months.includes(reference))reference=months[months.length-1];
      const previous=shiftMonthKey(reference,-1),monthList=[previous,reference].filter(Boolean),rows=processedData.filter(r=>monthList.includes(monthKeyByField(r,field))),hasPrevious=rows.some(r=>monthKeyByField(r,field)===previous),labels=hasPrevious&&previous?[monthLabel(previous),monthLabel(reference)]:[monthLabel(reference)];
      return{rows,monthsLabel:labels.join(" y ")};
    }

    function buildKpi3DetailSeries(data){
      const rows=data.filter(r=>r.k3!==null&&r.fReal).slice().sort((a,b)=>a.fReal-b.fReal),byWeek=new Map();
      rows.forEach(r=>{const week=weekInfo(r.fReal),key=`${week.year}-${String(week.week).padStart(2,"0")}`;if(!byWeek.has(key))byWeek.set(key,{year:week.year,week:week.week,label:`SEM${String(week.week).padStart(2,"0")}`,period:week.rangeLabel,early:0,onTime:0,late:0,totalPdsGiradas:0,earlyPdsGiradas:0,onTimePdsGiradas:0,latePdsGiradas:0,earlyVals:[],onTimeVals:[],lateVals:[],earlyK1Vals:[],onTimeK1Vals:[],lateK1Vals:[],earlyRows:[],onTimeRows:[],lateRows:[]});const item=byWeek.get(key),pds=r.pdsGiradas===null||r.pdsGiradas===void 0||Number.isNaN(r.pdsGiradas)?0:r.pdsGiradas;item.totalPdsGiradas+=pds;if(r.k3<0){item.early+=1;item.earlyVals.push(r.k3);item.earlyRows.push(r);item.earlyPdsGiradas+=pds;if(r.k1!==null)item.earlyK1Vals.push(r.k1);}else if(r.k3>0){item.late+=1;item.lateVals.push(r.k3);item.lateRows.push(r);item.latePdsGiradas+=pds;if(r.k1!==null)item.lateK1Vals.push(r.k1);}else{item.onTime+=1;item.onTimeVals.push(r.k3);item.onTimeRows.push(r);item.onTimePdsGiradas+=pds;if(r.k1!==null)item.onTimeK1Vals.push(r.k1);}});
      const points=[...byWeek.values()];
      return{labels:points.map(p=>p.label),periods:points.map(p=>p.period),early:points.map(p=>p.early),earlyAvg:points.map(p=>avg(p.earlyVals)),earlyK1Avg:points.map(p=>avg(p.earlyK1Vals)),earlyPdsGiradas:points.map(p=>p.earlyPdsGiradas),earlyCycle:points.map(p=>buildCycleTooltipDetail(p.earlyRows)),onTime:points.map(p=>p.onTime),onTimeAvg:points.map(p=>avg(p.onTimeVals)),onTimeK1Avg:points.map(p=>avg(p.onTimeK1Vals)),onTimePdsGiradas:points.map(p=>p.onTimePdsGiradas),onTimeCycle:points.map(p=>buildCycleTooltipDetail(p.onTimeRows)),late:points.map(p=>p.late),lateAvg:points.map(p=>avg(p.lateVals)),lateK1Avg:points.map(p=>avg(p.lateK1Vals)),latePdsGiradas:points.map(p=>p.latePdsGiradas),totalPdsGiradas:points.map(p=>p.totalPdsGiradas),lateCycle:points.map(p=>buildCycleTooltipDetail(p.lateRows)),range:points.length?`${points[0].label} a ${points[points.length-1].label}`:""};
    }

    function buildScatterPoints(data){
      const items=data.filter(r=>r.k1!==null&&r.k3!==null),map=new Map(),pts=[];
      items.forEach(r=>{const k=`${r.k1}|${r.k3}`;if(!map.has(k))map.set(k,[]);map.get(k).push(r);});
      map.forEach(group=>{if(group.length===1){pts.push(scatterPoint(group[0],0,0,1));return;}group.forEach((r,i)=>{const ring=Math.floor(i/6),pos=i%6,angle=(Math.PI*2*pos)/Math.min(group.length,6),dist=.18+ring*.12;pts.push(scatterPoint(r,Math.cos(angle)*dist,Math.sin(angle)*dist,group.length));});});
      return pts;
    }

    function scatterPoint(r,dx,dy,n){const color=devColor(r.k3);return{x:r.k1+dx,y:r.k3+dy,ax:r.k1,ay:r.k3,op:r.op,corte:r.corte,ruta:r.ruta,n,gir:shortDate(r.fGirRaw),plan:shortDate(r.fPlanRaw),real:shortDate(r.fRealRaw),color,borderColor:color.replace("0.7","1"),radius:n>1?6:4.5};}

    function renderStatus(data,month){
      if(!processedData.length)return;
    }

    function showError(msg){disableControls(false);processedData=[];currentDashboardRows=[];currentDashboardMonth="ALL";$("monthFilter").innerHTML='<option value="ALL">Todos los meses</option>';syncMonthFilterLabel();renderKPIs([]);renderCharts([]);if(isKpi2DetailModalOpen())renderKpi2DetailChart();if(isKpi3DetailModalOpen())renderKpi3DetailChart();console.error(msg);}
    function handleDateFieldChange(){syncMonthFilterLabel();populateMonthFilter($("monthFilter").value||currentMonthKey());updateDashboard(resolveSelectedMonth($("monthFilter").value||currentMonthKey()));}
    function populateMonthFilter(prev){const select=$("monthFilter"),field=selectedDateField(),months=[...new Set(processedData.map(r=>monthKeyByField(r,field)).filter(Boolean))].filter(m=>!HIDDEN_MONTH_KEYS.has(m)).sort();select.innerHTML='<option value="ALL">Todos los meses</option>';months.forEach(m=>{const o=document.createElement("option");o.value=m;o.textContent=monthLabel(m);select.appendChild(o);});const current=currentMonthKey(),latest=months.length?months[months.length-1]:"ALL",options=[...select.options].map(o=>o.value),pick=[prev,current,latest,"ALL"].find(v=>options.includes(v));select.value=pick||"ALL";}
    function resolveSelectedMonth(prev){const options=[...$("monthFilter").options].map(o=>o.value),current=currentMonthKey(),latest=options.length>1?options[options.length-1]:"ALL";return [prev,current,latest,$("monthFilter").value,"ALL"].find(v=>options.includes(v))||"ALL";}

    function setMetric(id,val,good,bad,alt,sign){const el=$(id),big=id==="kpi1-value"||id==="kpi3-value",base=big?"text-2xl font-extrabold":"text-xl font-bold",seriesClass=kpi2MetricColorClass(id);if(val===null||Number.isNaN(val)){el.textContent="--";el.className=`${base} text-gray-400`;return;}el.textContent=metricValue(val,!!sign);if(good&&good(val)){el.className=`${base} text-green-600`;return;}if(bad&&bad(val)){el.className=`${base} text-red-600`;return;}if(alt&&alt(val)){el.className=`${base} text-blue-600`;return;}el.className=`${base} ${seriesClass||"text-gray-900"}`;}
    function setPctAvgMetric(pctId,avgId,count,total,avgVal){const pctEl=$(pctId),avgEl=$(avgId),pct=total?Math.round(count*100/total):null,avgText=avgVal===null||Number.isNaN(avgVal)?"--":`${metricValue(avgVal,false)} dias`;if(pctEl)pctEl.textContent=pct===null?"--":`${pct}%`;if(avgEl)avgEl.textContent=avgText;}
    function setCountAvgMetric(id,count,label,avgVal,total,sign){const el=$(id),pct=total?Math.round(count*100/total):null,avgText=avgVal===null||Number.isNaN(avgVal)?"--":`${metricValue(avgVal,!!sign)} dias prom.`;el.innerHTML=`<span class="block">${count} ${label} ${pct===null?"":"["+pct+"%]"}</span><span class="block text-[10px] font-medium">${avgText}</span>`;}
    function setCountNoteMetric(id,count,label,total,note){const el=$(id),pct=total?Math.round(count*100/total):null;el.innerHTML=`<span class="block">${count} ${label} ${pct===null?"":"["+pct+"%]"}</span><span class="block text-[10px] font-medium">${note||""}</span>`;}
    function donutLegendLabel(label,k3Avg){return`${label} - Desv. ${devAvgText(k3Avg)}`;}
    function avgDaysText(v){return v===null||Number.isNaN(v)?"--":`${metricValue(v,false)} dias prom.`;}
    function kpi2MetricColorClass(id){return id==="kpi2-acabada-pieza"?"text-indigo-600":id==="kpi2-acabada-otros"?"text-sky-600":id==="kpi2-lavada-pieza"?"text-violet-600":id==="kpi2-lavada-otros"?"text-pink-600":"";}
    function devAvgText(v){return v===null||Number.isNaN(v)?"Sin F. Ing. Real/Plan":`${metricValue(v,true)} dias`;}
    function fontPx(font){const m=String(font||"").match(/(\d+)px/i);return m?parseInt(m[1],10):10;}
    function hideDetailChartTooltip(chart){if(!chart||!chart.tooltip||typeof chart.tooltip.setActiveElements!=="function")return;chart.setActiveElements([]);chart.tooltip.setActiveElements([],{x:0,y:0});chart.update();}
    function showDetailChartTooltip(chart,hit){if(!chart||!chart.tooltip||typeof chart.tooltip.setActiveElements!=="function"||!hit)return;const active=[{datasetIndex:hit.datasetIndex,index:hit.index}];chart.setActiveElements(active);chart.tooltip.setActiveElements(active,{x:hit.cx,y:hit.cy});chart.update();}
    function detailChartClickPosition(chart,event){if(typeof Chart.helpers?.getRelativePosition==="function")return Chart.helpers.getRelativePosition(event,chart);const rect=chart.canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*(chart.width/rect.width),y:(event.clientY-rect.top)*(chart.height/rect.height)};}
    function findChartDatasetHit(chart,event,predicate){
      if(!chart||typeof chart.getElementsAtEventForMode!=="function")return null;
      const hits=chart.getElementsAtEventForMode(event,"nearest",{intersect:true},true)||[];
      for(const hit of hits){
        const dataset=chart.data?.datasets?.[hit.datasetIndex];
        if(predicate&&!predicate(dataset,hit))continue;
        const element=hit.element||chart.getDatasetMeta(hit.datasetIndex)?.data?.[hit.index],center=typeof element?.getCenterPoint==="function"?element.getCenterPoint():null;
        return{datasetIndex:hit.datasetIndex,index:hit.index,cx:center?.x||0,cy:center?.y||0};
      }
      return null;
    }
    function findDetailLabelHitbox(chart,event){const pos=detailChartClickPosition(chart,event),boxes=Array.isArray(chart?.$dataLabelHitboxes)?chart.$dataLabelHitboxes:[];for(let i=boxes.length-1;i>=0;i--){const b=boxes[i];if(pos.x>=b.x&&pos.x<=b.x+b.w&&pos.y>=b.y&&pos.y<=b.y+b.h)return b;}return null;}
    function handleDetailChartClick(chart,event){if(!chart)return;const hit=findDetailLabelHitbox(chart,event),active=typeof chart.tooltip?.getActiveElements==="function"?chart.tooltip.getActiveElements():[];if(!hit){hideDetailChartTooltip(chart);return;}if(active.length===1&&active[0].datasetIndex===hit.datasetIndex&&active[0].index===hit.index){hideDetailChartTooltip(chart);return;}showDetailChartTooltip(chart,hit);}
    function handleKpi2DetailContextMenu(chart,event){
      const hit=findChartDatasetHit(chart,event,dataset=>dataset?.type==="bar");
      if(!hit)return;
      event.preventDefault();
      showDetailChartTooltip(chart,hit);
      const dataset=chart.data?.datasets?.[hit.datasetIndex],rows=dataset?.detailRows?.[hit.index]||[];
      openKpi2CutsModal({datasetLabel:dataset?.label||"Cortes",weekLabel:chart.data?.labels?.[hit.index]||"",period:chart.$detailPeriods?.[hit.index]||"",rows});
    }
    function metricValue(v,sign){const n=Math.round(v*10)/10;return sign&&n>0?`+${n.toFixed(1)}`:n.toFixed(1);}
    function numberText(v){if(v===null||v===void 0||Number.isNaN(v))return"--";const n=Math.round(v*10)/10;return Number.isInteger(n)?`${n}`:n.toFixed(1);}
    function numberKText(v){if(v===null||v===void 0||Number.isNaN(v))return"--";const n=Math.round((v/1000)*10)/10;return`${Number.isInteger(n)?n:n.toFixed(1)}k`;}
    function compactPdsText(v){if(v===null||v===void 0||Number.isNaN(v))return"--";const n=Math.round(v);if(Math.abs(n)<1000)return`${n}`;return`${(n/1000).toFixed(1)}k`;}
    function displayText(v){const s=txt(v);return s||"--";}
    function ocDisplayValue(row){const op=txt(row?.op),corte=txt(row?.corte);if(op&&corte)return`${op}-${corte}`;return displayText(op||corte||row?.oc);}
    function escapeHtml(v){return window.PcpTextUtils.escapeHtml(v);}
    function ratioPct(part,total){return total?Math.round(part*100/total):null;}
    function percentagesThatSumTo100(values){
      const list=Array.isArray(values)?values.map(v=>Number(v)||0):[];
      const total=list.reduce((a,b)=>a+b,0);
      if(!total)return list.map(()=>null);
      const raw=list.map(v=>v*100/total),base=raw.map(v=>Math.floor(v)),remainder=100-base.reduce((a,b)=>a+b,0),order=raw.map((v,i)=>({i,frac:v-base[i],value:list[i]})).sort((a,b)=>b.frac-a.frac||b.value-a.value||a.i-b.i);
      for(let i=0;i<remainder;i++)base[order[i%order.length].i]+=1;
      return base.map((v,i)=>list[i]>0?v:0);
    }
    function heatmapBlueStyle(pct){
      if(pct===null||pct===void 0||Number.isNaN(pct)||pct<=0){
        return{style:"background-color:#ffffff;color:#94a3b8;",textClass:"text-slate-400"};
      }
      const alpha=Math.max(0.10,Math.min(0.92,0.10+(pct/100)*0.82));
      const dark=pct>=55;
      return{
        style:`background-color:rgba(59,130,246,${alpha});`,
        textClass:dark?"text-white":"text-slate-900"
      };
    }
    function avgDaysOnlyLabel(v){return v===null||v===void 0||Number.isNaN(v)?"--":`${metricValue(v,false)} dias prom.`;}
    function avgDaysPdsLabel(v,part,total){if(v===null||v===void 0||Number.isNaN(v))return"--";const base=`${metricValue(v,false)} dias al HOD`,pct=ratioPct(part||0,total||0);return pct===null?base:`${base}\n[${pct}%]`;}
    function avgDaysPdsTooltip(v,part,total){if(v===null||v===void 0||Number.isNaN(v))return"--";const base=`${metricValue(v,false)} dias al HOD`,pct=ratioPct(part||0,total||0);return pct===null?base:`${base} [${pct}%]`;}
    function modeDaysOnlyLabel(v){return v===null||v===void 0||Number.isNaN(v)?"--":`${metricValue(v,false)} dias (moda)`;}
    function detailPointLabel(avgVal,count,pds,withBrackets){if(avgVal===null||avgVal===void 0||Number.isNaN(avgVal))return"--";const avgText=`${metricValue(avgVal,true)} dias prom`;if(count===null||count===void 0||Number.isNaN(count))return avgText;const detail=`[${count} OC - ${numberKText(pds)} pds]`;return withBrackets?`${avgText}\n${detail}`:`${avgText} ${detail}`;}
    function cycleDaysLabel(v){return v===null||v===void 0||Number.isNaN(v)?"--":`${metricValue(v,false)} dias (moda)`;}
    function buildCycleTooltipDetail(rows){const list=Array.isArray(rows)?rows:[],acabadaPieza=list.filter(r=>isAcabLike(r.ruta)&&r.isEnPieza&&r.k2!==null).map(r=>r.k2),acabadaOtros=list.filter(r=>isAcabLike(r.ruta)&&!r.isEnPieza&&r.k2!==null).map(r=>r.k2),lavadaPieza=list.filter(r=>r.ruta==="LAVADA"&&r.isEnPieza&&r.k2!==null).map(r=>r.k2),lavadaOtros=list.filter(r=>r.ruta==="LAVADA"&&!r.isEnPieza&&r.k2!==null).map(r=>r.k2);return{acabadaPieza:mode(acabadaPieza),acabadaOtros:mode(acabadaOtros),lavadaPieza:mode(lavadaPieza),lavadaOtros:mode(lavadaOtros)};}
    function cycleTooltipLines(detail){const d=detail||{};return["KPI 2: Ciclo de Corte","RUTA: ACABADA",`Bordado ${cycleDaysLabel(d.acabadaPieza)}`,`Sin bordado ${cycleDaysLabel(d.acabadaOtros)}`,"RUTA: LAVADA",`Bordado ${cycleDaysLabel(d.lavadaPieza)}`,`Sin bordado ${cycleDaysLabel(d.lavadaOtros)}`];}
    function metricText(v,sign){if(v===null||Number.isNaN(v))return"--";const n=Math.round(v);return sign&&n>0?`+${n} d`:`${n} d`;}
    function avgDaysLabel(v,sign){return v===null||Number.isNaN(v)?"--":`${metricValue(v,!!sign)}d prom.`;}
    function devColor(v){if(v>0)return"rgba(239, 68, 68, 0.7)";if(v<0)return"rgba(59, 130, 246, 0.7)";return"rgba(16, 185, 129, 0.7)";}
    function disableControls(disabled){$("dateFieldFilter").disabled=disabled;$("monthFilter").disabled=disabled;$("refreshButton").disabled=disabled;$("refreshButton").classList.toggle("opacity-60",disabled);$("refreshButton").classList.toggle("cursor-not-allowed",disabled);}

    function norm(v){return String(v||"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]/g,"");}
    function txt(v){return String(v||"").trim();}
    function isEnPiezaTipo(v){return norm(v).includes("ENPIEZA");}
    function selectedDateField(){return $("dateFieldFilter")?.value||"fDesp";}
    function dateFieldLabel(key){return key==="fCorte"?"FECHA CORTE":key==="fIngReal"?"F.ING.REAL":key==="fDesp"?"F. DESPACHO":"F. Girado";}
    function syncMonthFilterLabel(){$("monthFilterLabel").textContent=`${dateFieldLabel(selectedDateField())}:`;}
    function monthKeyByField(row,field){if(field==="fCorte")return monthKey(row.fCorte);if(field==="fIngReal")return monthKey(row.fReal);if(field==="fDesp")return monthKey(row.fDesp);return monthKey(row.fGir);}
    function val(row,names){for(const n of(Array.isArray(names)?names:[names])){const i=colMap.get(norm(n));if(i===void 0||i===-1)continue;const v=row[i];if(v!==void 0&&v!==null&&String(v).trim()!=="")return v;}return"";}
    function getFIngReal(row){const direct=val(row,["F.ING.REAL","F ING REAL","F. ING. REAL","F.ING REAL","FINGREAL"]);if(direct!=="")return direct;const headers=rawData[0]||[];for(let i=0;i<headers.length;i++){const k=norm(headers[i]);const hit=k==="FINGREAL"||k.includes("FINGREAL")||k.includes("FINGRESOREAL")||k.includes("FECHAINGRESOREAL")||(k.startsWith("FING")&&k.includes("REAL"));if(!hit)continue;const v=row[i];if(v!==void 0&&v!==null&&String(v).trim()!=="")return v;}return"";}
    function numberValue(raw){if(raw===null||raw===void 0||raw==="")return null;if(typeof raw==="number")return Number.isFinite(raw)?raw:null;const s=String(raw).trim().replace(/\s+/g,"").replace(/,/g,"");if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null;}
    function parseDate(raw){
      if(raw===null||raw===void 0||raw==="")return null;
      if(raw instanceof Date&&!Number.isNaN(raw.getTime()))return raw;
      const fromSerial=s=>{const n=Number(s);if(!Number.isFinite(n)||n<=0)return null;const whole=Math.floor(n),frac=n-whole,d=new Date(1899,11,30);d.setDate(d.getDate()+whole);d.setSeconds(d.getSeconds()+Math.round(frac*86400));return Number.isNaN(d.getTime())?null:d;};
      if(typeof raw==="number"&&raw>30000)return fromSerial(raw);
      const s=String(raw).trim();if(!s)return null;
      if(/^\d+(\.\d+)?$/.test(s)){const n=parseFloat(s);if(n>30000){const d=fromSerial(n);if(d)return d;}}
      const dc=s.match(/Date\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+))?\)/i);
      if(dc){const d=new Date(parseInt(dc[1],10),parseInt(dc[2],10),parseInt(dc[3],10),parseInt(dc[4]||"0",10),parseInt(dc[5]||"0",10),parseInt(dc[6]||"0",10),parseInt(dc[7]||"0",10));return Number.isNaN(d.getTime())?null:d;}
      const iso=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      if(iso){const d=new Date(parseInt(iso[1],10),parseInt(iso[2],10)-1,parseInt(iso[3],10),parseInt(iso[4]||"0",10),parseInt(iso[5]||"0",10),parseInt(iso[6]||"0",10));return Number.isNaN(d.getTime())?null:d;}
      const dm=s.match(/^(\d{1,2})[\/\-](\d{1,2}|[A-Za-z]{3,})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i);
      if(dm){const day=parseInt(dm[1],10),mRaw=String(dm[2]).toLowerCase();let month=-1;if(/^\d+$/.test(mRaw))month=parseInt(mRaw,10)-1;else{const map={ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};month=map[mRaw.slice(0,3)]??-1;}let year=parseInt(dm[3],10);if(year<100)year+=2000;if(month>=0){const d=new Date(year,month,day,parseInt(dm[4]||"0",10),parseInt(dm[5]||"0",10),parseInt(dm[6]||"0",10));return Number.isNaN(d.getTime())?null:d;}}
      const parsed=new Date(s);return Number.isNaN(parsed.getTime())?null:parsed;
    }
    function dayStart(raw){const d=parseDate(raw);if(!d)return null;const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());return Number.isNaN(x.getTime())?null:x;}
    function diffDays(later,earlier){const a=dayStart(later),b=dayStart(earlier);if(!a||!b)return null;return Math.round((a-b)/DAY);}
    function dateKey(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
    function addDays(d,days){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+days);return x;}
    function shiftMonthKey(k,delta){if(!k)return"";const [y,m]=k.split("-").map(Number),d=new Date(y,(m-1)+delta,1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
    function monthKey(d){if(!d)return"";return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
    function currentMonthKey(){try{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Lima",year:"numeric",month:"2-digit"}).formatToParts(new Date()),year=parts.find(p=>p.type==="year")?.value,month=parts.find(p=>p.type==="month")?.value;if(year&&month)return`${year}-${month}`;}catch(e){}const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
    function monthLabel(k){if(!k)return"";const [y,m]=k.split("-");return`${MONTHS[Math.max(0,Math.min(11,parseInt(m,10)-1))]} ${y}`;}
    function getVisibleMonthKeys(field){return[...new Set(processedData.map(r=>monthKeyByField(r,field)).filter(Boolean))].filter(m=>!HIDDEN_MONTH_KEYS.has(m)).sort();}
    function shortDate(raw){const d=dayStart(raw);return d?`${String(d.getDate()).padStart(2,"0")}/${MONTHS[d.getMonth()]}`:"--";}
    function fullDateLabel(raw){const d=dayStart(raw);return d?`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`:"--";}
    function shortMonthYearDateLabel(raw){const d=dayStart(raw);return d?`${String(d.getDate()).padStart(2,"0")}/${MONTHS[d.getMonth()].toLowerCase()}/${String(d.getFullYear()).slice(-2)}`:"--";}
    function weekInfo(raw){
      const d=dayStart(raw);
      if(!d)return{year:"",week:0,rangeLabel:""};
      const weekday=(d.getDay()+6)%7,start=addDays(d,-weekday),end=addDays(start,6),thursday=addDays(d,3-weekday),weekYear=thursday.getFullYear(),yearStart=new Date(weekYear,0,4),yearWeekday=(yearStart.getDay()+6)%7,firstThursday=addDays(yearStart,3-yearWeekday),week=1+Math.round((thursday-firstThursday)/(7*DAY));
      return{year:weekYear,week,rangeLabel:`${fullDateLabel(start)} - ${fullDateLabel(end)}`};
    }
    function avg(arr){return Array.isArray(arr)&&arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;}
    function sortedNumeric(arr){return Array.isArray(arr)?arr.filter(v=>v!==null&&v!==void 0&&!Number.isNaN(v)).slice().sort((a,b)=>a-b):[];}
    function quantileSorted(sorted,q){
      if(!Array.isArray(sorted)||!sorted.length)return null;
      const pos=(sorted.length-1)*q,base=Math.floor(pos),rest=pos-base,next=sorted[Math.min(sorted.length-1,base+1)];
      return sorted[base]+(next-sorted[base])*rest;
    }
    function buildEntregasStats(values){
      const xs=sortedNumeric(values);
      if(!xs.length)return{count:0,mean:null,median:null,p25:null,p75:null,min:null,max:null,stdev:null};
      const mean=avg(xs),median=quantileSorted(xs,0.5),p25=quantileSorted(xs,0.25),p75=quantileSorted(xs,0.75),variance=xs.length>1?xs.reduce((acc,v)=>acc+((v-mean)**2),0)/(xs.length-1):0,stdev=Math.sqrt(variance);
      return{count:xs.length,mean,median,p25,p75,min:xs[0],max:xs[xs.length-1],stdev};
    }
    function formatStatDays(v){return v===null||v===void 0||Number.isNaN(v)?"--":`${metricValue(v,false)} d`;}
    function mode(arr){
      if(!Array.isArray(arr)||!arr.length)return null;
      const freq=new Map();
      arr.forEach(v=>{if(v===null||v===void 0||Number.isNaN(v))return;freq.set(v,(freq.get(v)||0)+1);});
      if(!freq.size)return null;
      let bestValue=null,bestCount=0;
      // En empate de frecuencias se toma el menor valor para mantener una unica moda visible.
      [...freq.entries()].sort((a,b)=>a[0]-b[0]).forEach(([value,count])=>{
        if(count>bestCount){bestValue=value;bestCount=count;}
      });
      return bestValue;
    }
    function route(v){const raw=txt(v).toUpperCase(),k=norm(raw);if(!k)return"SIN RUTA";if(k.includes("LAV"))return"LAVADA";if(k.includes("ACAB"))return"ACABADA";if(k.includes("NORM"))return"NORMAL";return raw;}
    function isAcabLike(r){return r==="ACABADA"||r==="NORMAL";}
    function normalizeClientLabel(clientName){
      const name=txt(clientName).toUpperCase();
      if(name.includes("LACOSTE"))return"LAC";
      if(name.includes("ATHLETA, INC."))return"ATH";
      if(name.includes("ALLBIRDS"))return"ALLB";
      if(name.includes("BANANA REPUBLIC, LLC"))return"BNN";
      if(name.includes("THEORY LLC,"))return"THE";
      if(name.includes("DISH & DUER"))return"DDU";
      if(name.includes("SKECHERS PERFORMANCE"))return"SKE";
      if(name.includes("LULULEMON ATHLETICA CANADA INC"))return"LLL";
      if(name.includes("AM RETAIL S.A.C."))return"AMR";
      return txt(clientName)||"--";
    }
  
