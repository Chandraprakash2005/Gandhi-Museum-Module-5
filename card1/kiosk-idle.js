// Standalone Kiosk Idle Management (no parent page routing)
(function() {
    let idleTimer;
    const IDLE_TIME = 3 * 60 * 1000; // 3 minutes
    
    function resetIdleTimer(isInitial = false) {
        clearTimeout(idleTimer);
        
        // Restart the 3 minute timer
        idleTimer = setTimeout(() => {
            console.log('3 minutes of inactivity.');
            // Dispatch event for the card to handle internally
            window.dispatchEvent(new Event('kiosk_idle_timeout'));
        }, IDLE_TIME);
    }

    // Listen for manual interactions
    ['mousedown', 'touchstart', 'keydown', 'wheel'].forEach(evt => {
        document.addEventListener(evt, (e) => {
            if (e.isTrusted) {
                resetIdleTimer(false);
            }
        }, true);
    });
    
    // Initial start of timer
    resetIdleTimer(true);
})();
