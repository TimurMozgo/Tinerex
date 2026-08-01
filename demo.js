/* ==========================================================================
   T-PULSE DEMO — ENGINE (REAL BINANCE WS + SMOOTH ORGANIC AREA STYLE)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------------
    // 1. Инициализация Telegram SDK
    // ----------------------------------------------------------------------
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#08080a');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#08080a');
    }

    // ----------------------------------------------------------------------
    // 2. Состояние приложения (State)
    // ----------------------------------------------------------------------
    let balance = 1000;
    let selectedBet = 50;
    let selectedDirection = null; // 'UP' или 'DOWN'
    let isRoundActive = false;
    let roundTimerInterval = null;
    
    let currentPrice = 0.00;
    let targetPrice = 0.00;
    let socket = null;

    // График и данные
    let chart = null;
    let areaSeries = null;

    // ----------------------------------------------------------------------
    // 3. Элементы DOM
    // ----------------------------------------------------------------------
    const balanceEl = document.getElementById('balance');
    const statusEl = document.getElementById('statusMessage');
    
    const btnUp = document.getElementById('btnUp');
    const btnDown = document.getElementById('btnDown');
    
    const betModalPanel = document.getElementById('betModalPanel');
    const betPresetsContainer = document.getElementById('betPresetsContainer');
    const selectedDirectionLabel = document.getElementById('selectedDirectionLabel');
    const btnConfirmBet = document.getElementById('btnConfirmBet');
    const btnCancelBet = document.getElementById('btnCancelBet');
    
    const roundTimerEl = document.getElementById('roundTimer');
    const resultPopupEl = document.getElementById('resultPopup');

    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const claimBonusBtn = document.getElementById('claimBonus');

    // ----------------------------------------------------------------------
    // 4. Инициализация Графика
    // ----------------------------------------------------------------------
    async function initChart() {
        const chartContainer = document.getElementById('tvchart');
        if (!chartContainer || chart) return;

        chart = LightweightCharts.createChart(chartContainer, {
            layout: {
                background: { color: 'transparent' },
                textColor: '#8a8f9d',
            },
            grid: {
                vertLines: { color: 'rgba(0, 152, 234, 0.05)' },
                horzLines: { color: 'rgba(0, 152, 234, 0.05)' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: 'rgba(0, 152, 234, 0.15)',
            },
            timeScale: {
                borderColor: 'rgba(0, 152, 234, 0.15)',
                timeVisible: true,
                secondsVisible: true,
            },
            handleScroll: false,
            handleScale: false,
        });

        const resizeObserver = new ResizeObserver(entries => {
            if (!entries || entries.length === 0) return;
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0) {
                chart.applyOptions({ width, height });
            }
        });
        resizeObserver.observe(chartContainer);

        const areaStyle = {
            topColor: 'rgba(0, 152, 234, 0.35)',
            bottomColor: 'rgba(0, 152, 234, 0.00)',
            lineColor: '#0098ea',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 5,
            crosshairMarkerBorderColor: '#ffffff',
            crosshairMarkerBackgroundColor: '#0098ea',
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },
        };

        if (typeof chart.addSeries === 'function' && LightweightCharts.AreaSeries) {
            areaSeries = chart.addSeries(LightweightCharts.AreaSeries, areaStyle);
        } else {
            areaSeries = chart.addAreaSeries(areaStyle);
        }

        setStatus('Загрузка истории рынка...');

        try {
            const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100');
            if (response.ok) {
                const data = await response.json();
                const realPoints = data.map(c => ({
                    time: Math.floor(c[0] / 1000),
                    value: parseFloat(c[4])
                }));
                areaSeries.setData(realPoints);
                currentPrice = realPoints[realPoints.length - 1].value;
                targetPrice = currentPrice;
                setStatus(`Demo активен. BTC: $${currentPrice.toFixed(2)}`);
            }
        } catch (e) {
            console.warn('REST API недоступен, ждем поток...');
        }

        connectBinanceWebSocket();
        startOrganicAnimation();
    }

    // ----------------------------------------------------------------------
    // 5. Живой WebSocket + Органическое сглаживание
    // ----------------------------------------------------------------------
    function connectBinanceWebSocket() {
        socket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');

        socket.onmessage = (event) => {
            const trade = JSON.parse(event.data);
            if (!trade.p) return;

            targetPrice = parseFloat(trade.p);
            if (currentPrice === 0) {
                currentPrice = targetPrice;
            }
        };

        socket.onerror = (err) => console.error('WS Error:', err);
        socket.onclose = () => setTimeout(connectBinanceWebSocket, 3000);
    }

    function startOrganicAnimation() {
        // Каждые 150мс добавляем легкий естественный шумок и тянем цену к реальной цели
        setInterval(() => {
            if (!areaSeries || targetPrice === 0) return;

            // Плавное приближение к целевой цене с биржи (без резких скачков)
            currentPrice += (targetPrice - currentPrice) * 0.1;

            // Добавляем небольшой живой «шум» (микро-колебания), чтобы линия не шла по линейке
            const organicNoise = (Math.random() - 0.48) * 1.5;
            const finalValue = parseFloat((currentPrice + organicNoise).toFixed(2));

            const now = Math.floor(Date.now() / 1000);

            areaSeries.update({
                time: now,
                value: finalValue
            });

            // Держим актуальную цену для расчетов сделок
            currentPrice = finalValue;
        }, 150);
    }

    // ----------------------------------------------------------------------
    // 6. Выбор ставок и интерфейс
    // ----------------------------------------------------------------------
    const presets = [10, 50, 100, 250];

    function renderPresets() {
        if (!betPresetsContainer) return;
        betPresetsContainer.innerHTML = '';

        presets.forEach(amount => {
            const btn = document.createElement('button');
            btn.className = `bet-preset-btn ${amount === selectedBet ? 'active' : ''}`;
            btn.textContent = amount;
            btn.addEventListener('click', () => {
                selectedBet = amount;
                renderPresets();
                haptic('selection');
            });
            betPresetsContainer.appendChild(btn);
        });
    }

    function openBetModal(direction) {
        if (isRoundActive) return;

        selectedDirection = direction;
        if (selectedDirectionLabel) {
            selectedDirectionLabel.textContent = direction;
            selectedDirectionLabel.style.color = direction === 'UP' ? '#00e676' : '#ff1744';
        }

        renderPresets();
        if (betModalPanel) betModalPanel.style.display = 'flex';
        haptic('impact');
    }

    function closeBetModal() {
        if (betModalPanel) betModalPanel.style.display = 'none';
        selectedDirection = null;
    }

    btnUp?.addEventListener('click', () => openBetModal('UP'));
    btnDown?.addEventListener('click', () => openBetModal('DOWN'));
    btnCancelBet?.addEventListener('click', closeBetModal);

    // ----------------------------------------------------------------------
    // 7. Игровые раунды
    // ----------------------------------------------------------------------
    btnConfirmBet?.addEventListener('click', () => {
        if (balance < selectedBet) {
            setStatus('Недостаточно Tinerex на балансе!');
            haptic('notification', 'error');
            return;
        }

        balance -= selectedBet;
        updateBalanceUI();
        closeBetModal();

        startRound();
    });

    function startRound() {
        isRoundActive = true;
        const entryPrice = currentPrice;
        let timeLeft = 10;

        if (btnUp) btnUp.disabled = true;
        if (btnDown) btnDown.disabled = true;

        if (roundTimerEl) {
            roundTimerEl.textContent = timeLeft;
            roundTimerEl.style.display = 'flex';
        }

        setStatus(`Сделка: ${selectedDirection} | Вход: $${entryPrice.toFixed(2)}`);
        haptic('notification', 'success');

        roundTimerInterval = setInterval(() => {
            timeLeft--;
            if (roundTimerEl) roundTimerEl.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(roundTimerInterval);
                finishRound(entryPrice);
            }
        }, 1000);
    }

    function finishRound(entryPrice) {
        isRoundActive = false;
        const exitPrice = currentPrice;
        if (roundTimerEl) roundTimerEl.style.display = 'none';

        if (btnUp) btnUp.disabled = false;
        if (btnDown) btnDown.disabled = false;

        const isWin = (selectedDirection === 'UP' && exitPrice > entryPrice) ||
                      (selectedDirection === 'DOWN' && exitPrice < entryPrice);

        if (isWin) {
            const profit = selectedBet * 1.8;
            balance += profit;
            updateBalanceUI();
            setStatus(`Победа! +${profit} Tinerex (Выход: $${exitPrice.toFixed(2)})`);
            haptic('notification', 'success');
        } else {
            setStatus(`Проигрыш! -${selectedBet} Tinerex (Выход: $${exitPrice.toFixed(2)})`);
            haptic('notification', 'warning');
        }
    }

    // ----------------------------------------------------------------------
    // 8. Бонусы и навигация
    // ----------------------------------------------------------------------
    claimBonusBtn?.addEventListener('click', () => {
        balance += 500;
        updateBalanceUI();
        claimBonusBtn.disabled = true;
        claimBonusBtn.textContent = 'Бонус получен!';
        haptic('notification', 'success');
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.dataset.tab;

            navItems.forEach(n => n.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active'));

            item.classList.add('active');
            const targetPage = document.getElementById(`${tabName}Page`);
            if (targetPage) targetPage.classList.add('active');

            haptic('selection');
        });
    });

    // ----------------------------------------------------------------------
    // 9. Вспомогательные функции
    // ----------------------------------------------------------------------
    function updateBalanceUI() {
        if (balanceEl) balanceEl.textContent = Math.floor(balance);
    }

    function setStatus(msg) {
        if (statusEl) statusEl.textContent = msg;
    }

    function haptic(type, style = 'light') {
        if (!tg?.HapticFeedback) return;
        if (type === 'selection') tg.HapticFeedback.selectionChanged();
        if (type === 'impact') tg.HapticFeedback.impactOccurred(style);
        if (type === 'notification') tg.HapticFeedback.notificationOccurred(style);
    }

    initChart();
});