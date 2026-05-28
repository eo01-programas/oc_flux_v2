window.PcpAppScript = Object.freeze({
    get(params, options) {
        const config = options || {};
        const url = this.buildUrl(params, config);
        return fetch(url, {
            method: "GET"
        }).then(response => {
            if (!response.ok) {
                throw new Error(config.errorMessage || `HTTP error! status: ${response.status}`);
            }
            if (config.responseType === "text") return response.text();
            return response.json();
        });
    },

    post(payload, options) {
        const config = options || {};
        const url = config.url || window.PCP_CONFIG.WEB_APP_URL;
        const noCors = config.noCors === true;
        const headers = config.headers || (noCors
            ? { "Content-Type": "application/json" }
            : { "Content-Type": "text/plain;charset=utf-8" });

        return fetch(url, {
            method: "POST",
            mode: noCors ? "no-cors" : undefined,
            headers,
            body: JSON.stringify(payload)
        }).then(response => {
            if (noCors || config.assumeSuccess) return { ok: true, noCors: true };
            if (!response.ok) {
                throw new Error(config.errorMessage || `HTTP error! status: ${response.status}`);
            }
            if (config.responseType === "text") return response.text();
            return response.text().then(text => {
                if (!text) return null;
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return text;
                }
            });
        });
    },

    buildUrl(params, options) {
        const config = options || {};
        const url = new URL(config.url || window.PCP_CONFIG.WEB_APP_URL);
        const query = params || {};
        Object.keys(query).forEach(key => {
            const value = query[key];
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, value);
            }
        });
        return url.toString();
    }
});
