function normalizeClientName(clientName) {
    if (!clientName) return "";
    const name = clientName.toString().toUpperCase();
    if (name.includes("LACOSTE")) return "LAC";
    if (name.includes("ATHLETA, INC.")) return "ATH";
    if (name.includes("ALLBIRDS")) return "ALLB";
    if (name.includes("BANANA REPUBLIC, LLC")) return "BNN";
    if (name.includes("THEORY LLC,")) return "THE";
    if (name.includes("DISH & DUER")) return "DDU";
    if (name.includes("SKECHERS PERFORMANCE")) return "SKE";
    if (name.includes("LULULEMON ATHLETICA CANADA INC")) return "LLL";
    if (name.includes("AM RETAIL S.A.C.")) return "AMR";
    return clientName;
}

function normalizeClientForTransfer(clientName) {
    if (!clientName && clientName !== 0) return '';
    const s = String(clientName).trim();
    const up = s.toUpperCase();
    if (up.includes('LACOSTE - AMERICAS OPERATIONS PLATFORM')) return 'LACOSTE';
    if (up.includes('LULULEMON ATHLETICA CANADA INC')) return 'LULULEMON';
    if (up.includes('SKECHERS PERFORMANCE')) return 'SKECHERS';
    if (up.includes('ATHLETA, INC.')) return 'ATHLETA';
    if (up.includes('BANANA REPUBLIC, LLC')) return 'BANANA';
    if (up.includes('THEORY LLC,')) return 'THEORY';
    if (up.includes('LACOSTE')) return 'LACOSTE';
    if (up.includes('LULULEMON')) return 'LULULEMON';
    if (up.includes('SKECHERS')) return 'SKECHERS';
    if (up.includes('ATHLETA')) return 'ATHLETA';
    if (up.includes('BANANA')) return 'BANANA';
    if (up.includes('THEORY')) return 'THEORY';
    return s;
}

function abbreviateHeather(colorName) {
    return window.PcpTextUtils.abbreviateHeather(colorName, colorName);
}

function normalizePrenda(prenda) {
    return window.PcpTextUtils.normalizePrenda(prenda, prenda || "");
}

function normalizeTipoCert(tipoCert) {
    return window.PcpTextUtils.normalizeTipoCert(tipoCert);
}
