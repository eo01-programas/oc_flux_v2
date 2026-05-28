function showError(msg) {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('error-screen').style.display = 'flex';
    document.getElementById('error-details').innerText = msg;
}

function renderAllViews() {
    renderBloqueo();
    renderLavado();
    renderCorte();
    renderCorteBloques();
    renderEnumerado();
    try { renderArtes(); } catch (e) { }
    try { if (typeof updateArtesBadges === 'function') updateArtesBadges(); } catch (e) { }
    renderHabilitado();
    updateCounters();
}

function initFloatingMenu() {
    const toggleBtn = document.getElementById('floating-menu-toggle');
    const menuItems = document.getElementById('floating-menu-items');

    if (!toggleBtn || !menuItems) return;

    // Toggle del men? al hacer click en el bot?n
    toggleBtn.addEventListener('click', function () {
        menuItems.classList.toggle('active');
    });

    // Cerrar men? al hacer click fuera
    document.addEventListener('click', function (e) {
        if (!toggleBtn.contains(e.target) && !menuItems.contains(e.target)) {
            menuItems.classList.remove('active');
        }
    });

    // Cerrar men? cuando se hace click en un item (despu?s de navegar)
    const menuButtons = menuItems.querySelectorAll('.floating-menu-item');
    menuButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            menuItems.classList.remove('active');
        });
    });
}

window.hideAllContextMenus = function () {
    try { hideBloqueoContextMenu(); } catch (e) { }
    try { hideCorteContextMenu(); } catch (e) { }
    try { hideEnumeradoContextMenu(); } catch (e) { }
    try { hideHabilitadoContextMenu(); } catch (e) { }
    try { hideLavadoContextMenu(); } catch (e) { }
    try { hideCorteBloquesContextMenu(); } catch (e) { }
    try { hideTransferContextMenu(); } catch (e) { }
    try { hideArtesContextMenu(); } catch (e) { }
    try { hideCorteOcContextMenu(); } catch (e) { }
};

document.addEventListener('click', function (e) {
    const contextMenuIds = [
        'bloqueo-context-menu', 'corte-context-menu', 'enumerado-context-menu',
        'habilitado-context-menu', 'lavado-context-menu', 'corte-bloques-context-menu',
        'transfer-context-menu', 'artes-context-menu', 'corte-oc-context-menu'
    ];
    let clickedInsideMenu = false;
    for (const id of contextMenuIds) {
        const menu = document.getElementById(id);
        if (menu && menu.contains(e.target)) {
            clickedInsideMenu = true;
            break;
        }
    }
    if (!clickedInsideMenu) {
        hideAllContextMenus();
    }
});
