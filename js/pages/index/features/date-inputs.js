function updateShortYearDisplay(inputEl) {
    if (!inputEl) return;
    let span = inputEl.nextSibling;
    while (span && span.nodeType !== 1) span = span.nextSibling;
    if (!span || !span.classList || !span.classList.contains('date-yy')) {
        span = document.createElement('span');
        span.className = 'date-yy';
        inputEl.parentNode.insertBefore(span, inputEl.nextSibling);

        span.onclick = function (e) {
            e.stopPropagation();
            inputEl.showPicker ? inputEl.showPicker() : inputEl.click();
        };
    }
    const formatted = formatDateShortFromInput(inputEl.value || '');
    span.innerText = formatted || 'mm/dd/aaaa';
}

function initializeDateInputs() {
    setTimeout(() => {
        document.querySelectorAll('input.short-year').forEach(inputEl => {
            const spanEl = inputEl.nextElementSibling;
            if (spanEl && spanEl.classList.contains('date-yy')) {
                spanEl.onclick = function (e) {
                    e.stopPropagation();
                    inputEl.showPicker ? inputEl.showPicker() : inputEl.click();
                };
            }
        });
    }, 0);
}

function openHabilitadoFIngPicker(cell, evt) {
    if (evt) evt.stopPropagation();
    if (!cell) return;
    const inputEl = cell.querySelector('input.short-year');
    if (!inputEl) return;
    try {
        if (typeof inputEl.focus === 'function') {
            inputEl.focus({ preventScroll: true });
        } else {
            inputEl.focus();
        }
    } catch (e) { }
    try {
        if (typeof inputEl.showPicker === 'function') {
            inputEl.showPicker();
        } else {
            inputEl.click();
        }
    } catch (e) {
        try { inputEl.click(); } catch (err) { }
    }
}
