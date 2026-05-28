// Multi-select de estilos para Artes > Asignar.
window._artesEstiloSelected = new Set();

window.toggleArtesEstiloDropdown = function () {
    const dd = document.getElementById('artes-estilo-dropdown');
    if (!dd) return;
    dd.classList.toggle('open');
    if (dd.classList.contains('open')) {
        const searchInput = document.getElementById('artes-estilo-search');
        if (searchInput) { searchInput.value = ''; filterArtesEstiloOptions(); searchInput.focus(); }
    }
};

document.addEventListener('click', function (e) {
    const container = document.getElementById('artes-estilo-multiselect');
    if (container && !container.contains(e.target)) {
        const dd = document.getElementById('artes-estilo-dropdown');
        if (dd) dd.classList.remove('open');
    }
});

window.getArtesSelectedEstilos = function () {
    return window._artesEstiloSelected;
};

window.updateArtesEstiloLabel = function () {
    const label = document.getElementById('artes-estilo-label');
    if (!label) return;
    const sel = window._artesEstiloSelected;
    if (sel.size === 0) {
        label.textContent = 'Todos los estilos';
    } else if (sel.has('__NONE__')) {
        label.textContent = 'Ning?n estilo';
    } else if (sel.size === 1) {
        label.textContent = Array.from(sel)[0];
    } else if (sel.size <= 2) {
        label.textContent = Array.from(sel).join(', ');
    } else {
        label.textContent = sel.size + ' estilos seleccionados';
    }
};

window.onArtesEstiloCheckChange = function (checkbox) {
    const val = checkbox.value;
    window._artesEstiloSelected.delete('__NONE__');
    if (checkbox.checked) {
        window._artesEstiloSelected.add(val);
    } else {
        window._artesEstiloSelected.delete(val);
    }
    updateArtesEstiloLabel();
    syncSelectAllFilteredArtesCheckbox();
    renderArtesAsignar();
};

window.selectAllArtesEstilos = function (selectAll) {
    const checkboxes = document.querySelectorAll('#artes-estilo-options input[type="checkbox"]');
    if (selectAll) {
        window._artesEstiloSelected.clear();
        checkboxes.forEach(cb => cb.checked = false);
    } else {
        window._artesEstiloSelected.clear();
        window._artesEstiloSelected.add('__NONE__');
        checkboxes.forEach(cb => cb.checked = false);
    }
    updateArtesEstiloLabel();
    renderArtesAsignar();
};

window.filterArtesEstiloOptions = function () {
    const search = (document.getElementById('artes-estilo-search')?.value || '').toLowerCase().trim();
    const options = document.querySelectorAll('#artes-estilo-options .multiselect-option');
    let visibleCount = 0;
    options.forEach(opt => {
        const text = (opt.querySelector('label')?.textContent || '').toLowerCase();
        const visible = text.includes(search);
        opt.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
    });
    const selectFilteredRow = document.getElementById('artes-estilo-select-filtered');
    const selectFilteredChk = document.getElementById('chk-artes-select-filtered');
    if (selectFilteredRow) {
        const selectFilteredLabel = selectFilteredRow.querySelector('label');
        if (search.length > 0 && visibleCount > 0) {
            selectFilteredRow.style.display = 'flex';
            if (selectFilteredLabel) selectFilteredLabel.textContent = 'Seleccionar todos (' + visibleCount + ')';
            let allChecked = true;
            options.forEach(opt => {
                if (opt.style.display !== 'none') {
                    const cb = opt.querySelector('input[type="checkbox"]');
                    if (cb && !cb.checked) allChecked = false;
                }
            });
            if (selectFilteredChk) selectFilteredChk.checked = allChecked;
        } else {
            selectFilteredRow.style.display = 'none';
            if (selectFilteredChk) selectFilteredChk.checked = false;
        }
    }
};

window.selectAllFilteredArtesEstilos = function (checked) {
    window._artesEstiloSelected.delete('__NONE__');
    const options = document.querySelectorAll('#artes-estilo-options .multiselect-option');
    options.forEach(opt => {
        if (opt.style.display !== 'none') {
            const cb = opt.querySelector('input[type="checkbox"]');
            if (cb) {
                cb.checked = checked;
                if (checked) {
                    window._artesEstiloSelected.add(cb.value);
                } else {
                    window._artesEstiloSelected.delete(cb.value);
                }
            }
        }
    });
    updateArtesEstiloLabel();
    renderArtesAsignar();
};

window.syncSelectAllFilteredArtesCheckbox = function () {
    const search = (document.getElementById('artes-estilo-search')?.value || '').trim();
    const selectFilteredChk = document.getElementById('chk-artes-select-filtered');
    if (!selectFilteredChk || search.length === 0) return;
    const options = document.querySelectorAll('#artes-estilo-options .multiselect-option');
    let allChecked = true;
    let hasVisible = false;
    options.forEach(opt => {
        if (opt.style.display !== 'none') {
            hasVisible = true;
            const cb = opt.querySelector('input[type="checkbox"]');
            if (cb && !cb.checked) allChecked = false;
        }
    });
    selectFilteredChk.checked = hasVisible && allChecked;
};

window.populateArtesEstiloOptions = function (estilos) {
    const container = document.getElementById('artes-estilo-options');
    if (!container) return;
    const sorted = Array.from(estilos).sort();
    const prevSelected = new Set(window._artesEstiloSelected);
    if (!prevSelected.has('__NONE__')) {
        prevSelected.forEach(v => {
            if (!estilos.has(v)) window._artesEstiloSelected.delete(v);
        });
    }
    container.innerHTML = '';
    sorted.forEach(estilo => {
        const div = document.createElement('div');
        div.className = 'multiselect-option';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = estilo;
        cb.checked = window._artesEstiloSelected.has(estilo);
        cb.id = 'ms-art-' + estilo.replace(/[^a-zA-Z0-9]/g, '_');
        cb.onchange = function () { onArtesEstiloCheckChange(this); };
        const lbl = document.createElement('label');
        lbl.textContent = estilo;
        lbl.setAttribute('for', cb.id);
        div.appendChild(cb);
        div.appendChild(lbl);
        container.appendChild(div);
    });
    updateArtesEstiloLabel();
};
