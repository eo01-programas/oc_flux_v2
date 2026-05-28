function sortBloqueoData(indices, priorityView = '') {
    return indices.sort((a, b) => {
        const rowA = rawData[a];
        const rowB = rawData[b];

        const opTelaA = String(rowA[colMap["OP TELA"]] || "").trim();
        const partidaA = String(rowA[colMap["PARTIDA"]] || "").trim();
        const opPtdaA = (opTelaA + "-" + partidaA).toLowerCase();

        const opTelaB = String(rowB[colMap["OP TELA"]] || "").trim();
        const partidaB = String(rowB[colMap["PARTIDA"]] || "").trim();
        const opPtdaB = (opTelaB + "-" + partidaB).toLowerCase();

        const idxP = findPriorityHeaderIndex(priorityView);
        let pA = '';
        let pB = '';
        if (idxP !== -1) {
            pA = String(rowA[idxP] || '').trim();
            pB = String(rowB[idxP] || '').trim();
        }
        const pNumA = pA === '' ? Infinity : parseInt(pA) || Infinity;
        const pNumB = pB === '' ? Infinity : parseInt(pB) || Infinity;

        try {
            if (typeof currentBloqueoFilter !== 'undefined' && currentBloqueoFilter === 'PROG') {
                if (pNumA !== pNumB) return pNumA - pNumB;
                const opPtdaCmp = opPtdaA.localeCompare(opPtdaB, undefined, { numeric: true, sensitivity: 'base' });
                if (opPtdaCmp !== 0) return opPtdaCmp;
            } else {
                const opPtdaCmp = opPtdaA.localeCompare(opPtdaB, undefined, { numeric: true, sensitivity: 'base' });
                if (opPtdaCmp !== 0) return opPtdaCmp;
                if (pNumA !== pNumB) return pNumA - pNumB;
            }
        } catch (e) {
            const opPtdaCmp = opPtdaA.localeCompare(opPtdaB, undefined, { numeric: true, sensitivity: 'base' });
            if (opPtdaCmp !== 0) return opPtdaCmp;
            if (pNumA !== pNumB) return pNumA - pNumB;
        }

        const dateA = rowA[colMap["HOD"]] || 0;
        const dateB = rowB[colMap["HOD"]] || 0;
        if (dateA !== dateB) return dateB - dateA;

        return 0;
    });
}

function sortLavadoData(indices) {
    const idxP = findPriorityHeaderIndex('lavado');
    const groups = {};
    indices.forEach(i => {
        const row = rawData[i];
        const opTela = String(row[colMap["OP TELA"]] || '').trim();
        const partida = String(row[colMap["PARTIDA"]] || '').trim();
        const key = (opTela + '-' + partida).toLowerCase();
        if (!groups[key]) groups[key] = { indices: [], minP: Infinity, opPtda: key };
        groups[key].indices.push(i);
        let p = '';
        if (idxP !== -1) p = String(row[idxP] || '').trim();
        const pnum = (p === '') ? Infinity : (parseInt(p) || Infinity);
        if (pnum < groups[key].minP) groups[key].minP = pnum;
    });

    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
        const ga = groups[a], gb = groups[b];
        if (ga.minP !== gb.minP) return ga.minP - gb.minP;
        return ga.opPtda.localeCompare(gb.opPtda, undefined, { numeric: true, sensitivity: 'base' });
    });

    const result = [];
    sortedGroupKeys.forEach(k => {
        const arr = groups[k].indices.slice();
        arr.sort((a, b) => {
            const rowA = rawData[a], rowB = rawData[b];
            let pA = '', pB = '';
            if (idxP !== -1) { pA = String(rowA[idxP] || '').trim(); pB = String(rowB[idxP] || '').trim(); }
            const pnA = (pA === '') ? Infinity : (parseInt(pA) || Infinity);
            const pnB = (pB === '') ? Infinity : (parseInt(pB) || Infinity);
            if (pnA !== pnB) return pnA - pnB;

            const dateA = rowA[colMap["HOD"]] || 0;
            const dateB = rowB[colMap["HOD"]] || 0;
            if (dateA !== dateB) return dateB - dateA;

            const opTelaA = String(rowA[colMap["OP TELA"]] || '').trim();
            const partidaA = String(rowA[colMap["PARTIDA"]] || '').trim();
            const opPtdaA = (opTelaA + '-' + partidaA).toLowerCase();
            const opTelaB = String(rowB[colMap["OP TELA"]] || '').trim();
            const partidaB = String(rowB[colMap["PARTIDA"]] || '').trim();
            const opPtdaB = (opTelaB + '-' + partidaB).toLowerCase();
            return opPtdaA.localeCompare(opPtdaB, undefined, { numeric: true, sensitivity: 'base' });
        });
        result.push(...arr);
    });

    return result;
}

function sortCorteData(indices) {
    return indices.sort((a, b) => {
        const rowA = rawData[a];
        const rowB = rawData[b];

        const opTelaA = String(rowA[colMap["OP TELA"]] || "").trim();
        const partidaA = String(rowA[colMap["PARTIDA"]] || "").trim();
        const opPtdaA = (opTelaA + "-" + partidaA).toLowerCase();

        const opTelaB = String(rowB[colMap["OP TELA"]] || "").trim();
        const partidaB = String(rowB[colMap["PARTIDA"]] || "").trim();
        const opPtdaB = (opTelaB + "-" + partidaB).toLowerCase();

        const idxP = findPriorityHeaderIndex('corte');
        let pA = '';
        let pB = '';
        if (idxP !== -1) {
            pA = String(rowA[idxP] || '').trim();
            pB = String(rowB[idxP] || '').trim();
        }
        const pNumA = pA === '' ? Infinity : parseInt(pA) || Infinity;
        const pNumB = pB === '' ? Infinity : parseInt(pB) || Infinity;

        try {
            if (typeof currentCorteFilter !== 'undefined' && (currentCorteFilter === 'PROG 1T' || currentCorteFilter === 'PROG 2T' || currentCorteFilter === 'PROG 3T')) {
                if (pNumA !== pNumB) return pNumA - pNumB;
                const opPtdaCmp = opPtdaA.localeCompare(opPtdaB, undefined, { numeric: true, sensitivity: 'base' });
                if (opPtdaCmp !== 0) return opPtdaCmp;
            } else {
                const opPtdaCmp = opPtdaA.localeCompare(opPtdaB, undefined, { numeric: true, sensitivity: 'base' });
                if (opPtdaCmp !== 0) return opPtdaCmp;
                if (pNumA !== pNumB) return pNumA - pNumB;
            }
        } catch (e) {
            const opPtdaCmp = opPtdaA.localeCompare(opPtdaB, undefined, { numeric: true, sensitivity: 'base' });
            if (opPtdaCmp !== 0) return opPtdaCmp;
            if (pNumA !== pNumB) return pNumA - pNumB;
        }

        const dateA = rowA[colMap["HOD"]] || 0;
        const dateB = rowB[colMap["HOD"]] || 0;
        if (dateA !== dateB) return dateB - dateA;

        return 0;
    });
}
