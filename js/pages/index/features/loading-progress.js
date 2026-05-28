// Helpers del modal de progreso usado en operaciones largas.
window.updateLoadingModalProgress = function (completed, total, startTime) {
    const pctEl = document.getElementById('loading-progress-text');
    const barEl = document.getElementById('loading-progress-bar');
    const etaEl = document.getElementById('loading-eta-text');
    if (!pctEl || !barEl || !etaEl) return;
    const pct = Math.round((completed / total) * 100);
    pctEl.textContent = completed + ' / ' + total + '  (' + pct + '%)';
    barEl.style.width = pct + '%';
    if (completed > 0 && completed < total) {
        const elapsed = Date.now() - startTime;
        const avgPerItem = elapsed / completed;
        const remaining = Math.ceil(((total - completed) * avgPerItem) / 1000);
        if (remaining >= 60) {
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            etaEl.textContent = 'Tiempo restante aprox: ' + mins + 'm ' + secs + 's';
        } else {
            etaEl.textContent = 'Tiempo restante aprox: ' + remaining + 's';
        }
    } else if (completed >= total) {
        etaEl.textContent = 'Completado';
    } else {
        etaEl.textContent = 'Estimando tiempo restante...';
    }
};

window.resetLoadingModalProgress = function () {
    const pctEl = document.getElementById('loading-progress-text');
    const barEl = document.getElementById('loading-progress-bar');
    const etaEl = document.getElementById('loading-eta-text');
    if (pctEl) pctEl.textContent = '';
    if (barEl) barEl.style.width = '0%';
    if (etaEl) etaEl.textContent = 'Estimando tiempo restante...';
};
