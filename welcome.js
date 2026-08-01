document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.expand) {
        tg.expand();
    }

    const btnGoDemo = document.getElementById('btnGoDemo');
    const btnGoReal = document.getElementById('btnGoReal');

    if (btnGoDemo) {
        btnGoDemo.addEventListener('click', () => {
            if (tg?.HapticFeedback) tg.HapticFeedback.selectionChanged();
            // Переход на страницу DEMO версии
            window.location.href = 'demo.html';
        });
    }

    if (btnGoReal) {
        btnGoReal.addEventListener('click', () => {
            if (tg?.HapticFeedback) tg.HapticFeedback.selectionChanged();
            // Переход на страницу REAL версии
            window.location.href = 'real.html';
        });
    }
});