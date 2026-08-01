/* ==========================================================================
   T-PULSE REAL — ENGINE (REAL BINANCE WS + SMOOTH ORGANIC AREA STYLE)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Инициализация Telegram SDK
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#06090e');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#06090e');
    }

    // 2. Лимиты и состояние
    const MIN_BET = 0.1;
    const MAX_BET = 1.0;

    let balance = 10.00;
    let selectedBet = 0.1;
    let selectedDirection = null; // 'UP' или 'DOWN'
    let isRoundActive = false;
    let roundTimerInterval = null;
    
    let currentPrice = 0.00;
    let targetPrice = 0.00;
    let socket = null;

    let chart = null;
    let areaSeries = null; // Областной график вместо candleSeries

    // 3. Элементы DOM
    const balanceEl = document.getElementById('balance');
    const statusEl = document.getElementById('statusMessage');
    
    const btnUp = document.getElementById('btnUp');
    const btnDown = document.getElementById('btnDown');
    
    const betModalPanel = document.getElementById('betModalPanel');
    const betPresetsContainer = document.getElementById('betPresetsContainer');
    const customBetInput = document.getElementById('customBetInput');
    const customBetBox = document.querySelector('.custom-bet-box');
    const selectedDirectionLabel = document.getElementById('selectedDirectionLabel');
    const btnConfirmBet = document.getElementById('btnConfirmBet');
    const btnCancelBet = document.getElementById('btnCancelBet');
    
    const roundTimerEl = document.getElementById('roundTimer');

    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');

    // ----------------------------------------------------------------------
    // 4. Инициализация Неонового Графика (Сглаженный Area Style)
    // ----------------------------------------------------------------------
    async function initRealChart() {
        const chartContainer = document.getElementById('tvchart');
        if (!chartContainer || chart) return;

        // Создаем график без жестких размеров
        chart = LightweightCharts.createChart(chartContainer, {
            layout: {
                background: { color: 'transparent' },
                textColor: '#7f8c9d',
            },
            grid: {
                vertLines: { color: 'rgba(0, 152, 234, 0.05)' },
                horzLines: { color: 'rgba(0, 152, 234, 0.05)' },
            },
            rightPriceScale: { borderColor: 'rgba(0, 152, 234, 0.2)' },
            timeScale: { 
                borderColor: 'rgba(0, 152, 234, 0.2)', 
                timeVisible: true, 
                secondsVisible: true 
            },
            handleScroll: true,
            handleScale: true,
        });

        // ResizeObserver автоматически подгоняет холст под флексы
        const resizeObserver = new ResizeObserver(entries => {
            if (!entries || entries.length === 0) return;
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0) {
                chart.applyOptions({ width, height });
            }
        });
        resizeObserver.observe(chartContainer);

        // Настройки неонового градиентного графика
        const areaStyle = {
            topColor: 'rgba(0, 152, 234, 0.35)',    // Голубой градиент сверху
            bottomColor: 'rgba(0, 152, 234, 0.00)',  // Прозрачность снизу
            lineColor: '#0098ea',                    // Яркая неоновая линия
            lineWidth: 2,
            crosshairMarkerVisible: true,            // Точка на текущей цене
            crosshairMarkerRadius: 5,
            crosshairMarkerBorderColor: '#ffffff',
            crosshairMarkerBackgroundColor: '#0098ea',
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },
        };

        // Совместимость v4 / v5
        if (typeof chart.addSeries === 'function' && LightweightCharts.AreaSeries) {
            areaSeries = chart.addSeries(LightweightCharts.AreaSeries, areaStyle);
        } else {
            areaSeries = chart.addAreaSeries(areaStyle);
        }

        setStatus('Загрузка истории рынка BTC/USDT...');

        // 1. Загружаем настоящую историю с Binance REST API
        try {
            const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100');
            if (response.ok) {
                const data = await response.json();
                const realPoints = data.map(c => ({
                    time: Math.floor(c[0] / 1000),
                    value: parseFloat(c[4]) // Цена закрытия (Close)
                }));
                areaSeries.setData(realPoints);
                currentPrice = realPoints[realPoints.length - 1].value;
                targetPrice = currentPrice;
                setStatus(`Рынок подключен. BTC: $${currentPrice.toFixed(2)}`);
            }
        } catch (e) {
            console.warn('Binance REST недоступен, работаем на WebSocket');
        }

        // 2. Подключаем живые тики через WebSocket и плавную отрисовку
        connectBinanceWebSocket();
        startOrganicAnimation();
    }

    // ----------------------------------------------------------------------
    // 5. Поток Binance WebSocket + Плавное органическое сглаживание
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
        // Каждые 150мс добавляем легкий живой шум и плавно тянем цену к реальной цели с биржи
        setInterval(() => {
            if (!areaSeries || targetPrice === 0) return;

            // Плавное приближение к целевой цене (интерполяция без резких телепортаций)
            currentPrice += (targetPrice - currentPrice) * 0.1;

            // Естественные микро-колебания, чтобы линия не шла по линейке
            const organicNoise = (Math.random() - 0.48) * 1.5;
            const finalValue = parseFloat((currentPrice + organicNoise).toFixed(2));

            const now = Math.floor(Date.now() / 1000);

            areaSeries.update({
                time: now,
                value: finalValue
            });

            currentPrice = finalValue;
        }, 150);
    }

    // ----------------------------------------------------------------------
    // 6. Пресеты и Валидация ставок
    // ----------------------------------------------------------------------
    const presets = [0.1, 0.25, 0.5, 1.0];

    function renderPresets() {
        if (!betPresetsContainer) return;
        betPresetsContainer.innerHTML = '';

        presets.forEach(amount => {
            const btn = document.createElement('button');
            btn.className = `bet-preset-btn ${amount === selectedBet ? 'active' : ''}`;
            btn.textContent = `${amount} G`;
            btn.addEventListener('click', () => {
                setBetValue(amount);
                haptic('selection');
            });
            betPresetsContainer.appendChild(btn);
        });
    }

    function setBetValue(val) {
        selectedBet = parseFloat(val);
        if (customBetInput) customBetInput.value = selectedBet;
        validateBetInput();
        renderPresets();
    }

    function validateBetInput() {
        const val = parseFloat(customBetInput.value);
        
        if (isNaN(val) || val < MIN_BET || val > MAX_BET) {
            customBetBox?.classList.add('has-error');
            if (btnConfirmBet) {
                btnConfirmBet.disabled = true;
                btnConfirmBet.style.opacity = '0.5';
            }
            return false;
        } else {
            customBetBox?.classList.remove('has-error');
            if (btnConfirmBet) {
                btnConfirmBet.disabled = false;
                btnConfirmBet.style.opacity = '1';
            }
            selectedBet = Number(val.toFixed(2));
            renderPresets();
            return true;
        }
    }

    customBetInput?.addEventListener('input', validateBetInput);

    function openBetModal(direction) {
        if (isRoundActive) return;

        selectedDirection = direction;
        if (selectedDirectionLabel) {
            selectedDirectionLabel.textContent = direction;
            selectedDirectionLabel.style.color = direction === 'UP' ? '#00e676' : '#ff1744';
        }

        setBetValue(selectedBet);
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
    // 7. Логика Игрового Раунда
    // ----------------------------------------------------------------------
    btnConfirmBet?.addEventListener('click', () => {
        if (!validateBetInput()) {
            haptic('notification', 'error');
            return;
        }

        if (balance < selectedBet) {
            setStatus('Недостаточно Gram на балансе!');
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

        setStatus(`Сделка: ${selectedBet} Gram на ${selectedDirection} | Вход: $${entryPrice.toFixed(2)}`);
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
            setStatus(`ПОБЕДА! Вход: $${entryPrice.toFixed(2)} | Выход: $${exitPrice.toFixed(2)} (+${profit.toFixed(2)} Gram)`);
            haptic('notification', 'success');
        } else {
            setStatus(`Проигрыш! Вход: $${entryPrice.toFixed(2)} | Выход: $${exitPrice.toFixed(2)} (-${selectedBet.toFixed(2)} Gram)`);
            haptic('notification', 'warning');
        }
    }

    // ----------------------------------------------------------------------
    // 8. Переключение вкладок и хелперы
    // ----------------------------------------------------------------------
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const tabName = item.dataset.tab;
            if (tabName === 'tab-start') return; // Внешняя ссылка на welcome.html

            e.preventDefault();
            navItems.forEach(n => n.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active'));

            item.classList.add('active');
            
            let targetPage = document.getElementById(`${tabName}Page`);
            if (!targetPage && tabName === 'bonus') {
                targetPage = document.getElementById('walletPage');
            }

            if (targetPage) {
                targetPage.classList.add('active');
            }

            haptic('selection');
        });
    });

    function updateBalanceUI() {
        if (balanceEl) balanceEl.textContent = balance.toFixed(2);
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

    // Запуск приложения
    initRealChart();
});

