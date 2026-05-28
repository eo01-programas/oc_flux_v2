
    (function () {
        // Stock funnel: c?digo de visualizaci?n removido.
        // Se mantiene una funci?n de cierre m?nima para compatibilidad con el modal HTML.
        window.closeStockFunnelModal = function () {
            const modal = document.getElementById('modal-stock-funnel');
            if (!modal) return;
            modal.classList.remove('active');
        };
    })();
