window.PcpTextUtils = Object.freeze({
    escapeHtml(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    },

    escapeHtmlLoose(value) {
        return this.escapeHtml(value || "");
    },

    escapeHtmlAttr(value) {
        return this.escapeHtml(value)
            .replace(/\n/g, "&#10;");
    },

    abbreviateHeather(value, emptyValue = "") {
        if (!value && value !== 0) return emptyValue;
        try {
            return String(value).replace(/\bHEATHER(?:ED)?\b/ig, "HTR");
        } catch (e) {
            return value;
        }
    },

    normalizePrenda(value, emptyValue = "") {
        if (!value && value !== 0) return emptyValue;
        try {
            let text = String(value).toUpperCase().trim();
            text = text.replace(/\bT[- ]?SHIRT\b\s*/ig, "");
            if (text === "") return String(value).toUpperCase().trim();
            text = text.replace(/\s+/g, "");
            text = text.replace(/\//g, "");
            return text;
        } catch (e) {
            return value;
        }
    },

    normalizeTipoCert(value) {
        if (value === undefined || value === null) return "";
        try {
            return String(value).replace(/\s*\|\s*/g, "|").trim();
        } catch (e) {
            return value;
        }
    }
});
