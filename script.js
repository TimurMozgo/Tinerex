// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
if (tg && tg.expand) {
    tg.expand();
}

// ==========================================
// Состояние приложения
// ==========================================
let currentMode = 'demo'; // 'demo' или 'real'
let demoBalance = 1000;
let realBalance = 0.00;
let isTrading = false;
let roundTimerInterval = null;
let chart = null;
let candlestickSeries = null;

let selectedDirection = null;
let currentBetAmount = 50;

// Пресеты ставок для каждого режима
const presets = {
    demo: [50, 100, 500, 1000],
    real: [0.1, 0.5, 1, 5]
};

// ==========================================
// Элементы DOM
// ==========================================
// Экраны и структуры
const welcomePage = document.getElementById('welcomePage');
const tradePage = document.getElementById('tradePage');
const appHeader = document.getElementById('appHeader');
const appNav = document.getElementById('appNav');

// Кнопки приветственного экрана
const startDemoBtn = document.getElementById('startDemoBtn');
const startRealBtn = document.getElementById('startRealBtn');

// Шапка и переключатели режимов
const btnModeDemo = document.getElementById('btnModeDemo');
const btnModeReal = document.getElementById('btnModeReal');
const balanceEl = document.getElementById('balance');
const currencyLabel = document.getElementById('currencyLabel');

// Торговые элементы
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
const tradingControls = document.getElementById('tradingControls');
const betModalPanel = document.getElementById('betModalPanel');
const selectedDirectionLabel = document.getElementById('selectedDirectionLabel');
const modalCurrency = document.getElementById('modalCurrency');
const betPresetsContainer = document.getElementById('betPresetsContainer');
const btnConfirmBet = document.getElementById('btnConfirmBet');
const btnCancelBet = document.getElementById('btnCancelBet');
const statusMessage = document.getElementById('statusMessage');
const roundTimerEl = document.getElementById('roundTimer');
const resultPopup = document.getElementById('resultPopup');

// ==========================================
// 1. Вход в игру через приветственный экран
// ==========================================
startDemoBtn.addEventListener('click', () => enterGame('demo'));
startRealBtn.addEventListener('click', () => enterGame('real'));

function enterGame(mode) {
    if (welcomePage) welcomePage.classList.remove('active');
    
    if (appHeader) appHeader.style.display = 'flex';
    if (appNav) appNav.style.display = 'flex';
    if (tradePage) tradePage.classList.add('active');

    switchMode(mode);

    if (!chart) {
        initChart();
    }

    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
}

// ==========================================
// 2. Переключение режимов DEMO / REAL
// ==========================================
btnModeDemo.addEventListener('click', () => switchMode('demo'));
btnModeReal.addEventListener('click', () => switchMode('real'));

function switchMode(mode) {
    if (isTrading) return; // Запрет смены во время раунда
    currentMode = mode;

    if (mode === 'demo') {
        btnModeDemo.classList.add('active');
        btnModeReal.classList.remove('active');
        currencyLabel.innerText = 'TNRX';
        currencyLabel.style.color = '#ffd700';
        balanceEl.innerText = demoBalance;
        statusMessage.innerText = 'Демо-режим: тренируйся без риска!';
    } else {
        btnModeReal.classList.add('active');
        btnModeDemo.classList.remove('active');
        currencyLabel.innerText = 'TON';
        currencyLabel.style.color = '#0088cc';
        balanceEl.innerText = realBalance.toFixed(2);
        statusMessage.innerText = 'Режим REAL (TON): игра на реальный профит!';
    }

    renderPresets();
    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

// Динамическая генерация чипов-пресетов
function renderPresets() {
    if (!betPresetsContainer) return;
    betPresetsContainer.innerHTML = '';
    
    const currentPresets = presets[currentMode];
    currentBetAmount = currentPresets[0]; // Ставка по умолчанию — первый пресет

    currentPresets.forEach((amount, index) => {
        const btn = document.createElement('button');
        btn.className = `preset-btn ${index === 0 ? 'active' : ''}`;
        btn.innerText = amount;
        btn.setAttribute('data-amount', amount);
        
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentBetAmount = parseFloat(amount);
            if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
        });

        betPresetsContainer.appendChild(btn);
    });

    if (modalCurrency) {
        modalCurrency.innerText = currentMode === 'demo' ? 'TNRX' : 'TON';
    }
}

// ==========================================
// 3. Инициализация графика TradingView
// ==========================================
function initChart() {
    const chartContainer = document.getElementById('tvchart');
    if (!chartContainer) return;

    chart = LightweightCharts.createChart(chartContainer, {
        layout: {
            background: { type: 'solid', color: '#06080c' },
            textColor: '#8b949e',
        },
        grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: true,
            borderColor: 'rgba(255, 255, 255, 0.1)',
        },
        rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
        },
    });

    candlestickSeries = chart.addCandlestickSeries({
        upColor: '#00b09b',
        downColor: '#ff416c',
        borderDownColor: '#ff416c',
        borderUpColor: '#00b09b',
        wickDownColor: '#ff416c',
        wickUpColor: '#00b09b',
    });

    // Генерация начальных данных BTC/USDT
    const initialData = [];
    let currentTime = Math.floor(Date.now() / 1000) - 60 * 30;
    let basePrice = 65000;

    for (let i = 0; i < 30; i++) {
        let open = basePrice + (Math.random() * 40 - 20);
        let close = open + (Math.random() * 60 - 30);
        let high = Math.max(open, close) + Math.random() * 20;
        let low = Math.min(open, close) - Math.random() * 20;
        
        initialData.push({
            time: currentTime,
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2))
        });
        
        basePrice = close;
        currentTime += 60;
    }

    candlestickSeries.setData(initialData);
    chart.timeScale().fitContent();

    // Симуляция движения цены
    setInterval(() => {
        const data = candlestickSeries.data();
        if (!data || data.length === 0) return;
        let lastCandle = { ...data[data.length - 1] };
        
        let delta = (Math.random() * 20 - 10);
        lastCandle.close = parseFloat((lastCandle.close + delta).toFixed(2));
        lastCandle.high = Math.max(lastCandle.high, lastCandle.close);
        lastCandle.low = Math.min(lastCandle.low, lastCandle.close);

        candlestickSeries.update(lastCandle);
    }, 1000);

    window.addEventListener('resize', () => {
        chart.applyOptions({ width: chartContainer.clientWidth, height: chartContainer.clientHeight });
    });
}

// ==========================================
// 4. Логика шторки выбора ставки
// ==========================================
btnUp.addEventListener('click', () => openBetModal('up'));
btnDown.addEventListener('click', () => openBetModal('down'));

function openBetModal(direction) {
    if (isTrading) return;
    selectedDirection = direction;
    
    if (direction === 'up') {
        selectedDirectionLabel.innerText = 'UP 📈';
        selectedDirectionLabel.style.color = '#00b09b';
    } else {
        selectedDirectionLabel.innerText = 'DOWN 📉';
        selectedDirectionLabel.style.color = '#ff416c';
    }

    tradingControls.style.display = 'none';
    betModalPanel.style.display = 'flex';
    
    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

btnCancelBet.addEventListener('click', () => {
    betModalPanel.style.display = 'none';
    tradingControls.style.display = 'flex';
    if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
});

btnConfirmBet.addEventListener('click', () => {
    betModalPanel.style.display = 'none';
    tradingControls.style.display = 'flex';
    
    executeTrade(selectedDirection, currentBetAmount);
});

// ==========================================
// 5. Торговый движок и исполнение раунда
// ==========================================
function executeTrade(direction, amount) {
    let currentBalance = currentMode === 'demo' ? demoBalance : realBalance;
    const currName = currentMode === 'demo' ? 'TNRX' : 'TON';

    if (currentBalance < amount) {
        statusMessage.innerText = `Недостаточно ${currName} на балансе!`;
        statusMessage.style.color = '#ff416c';
        return;
    }

    isTrading = true;
    
    if (currentMode === 'demo') {
        demoBalance -= amount;
    } else {
        realBalance -= amount;
    }
    updateBalanceUI();

    statusMessage.innerText = `Сделка ${direction.toUpperCase()} на ${amount} ${currName} открыта! Аудит запущен...`;
    statusMessage.style.color = '#00f2fe';
    resultPopup.innerText = '';
    roundTimerEl.style.display = 'flex';

    let timeLeft = 10;
    roundTimerEl.innerText = timeLeft;

    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

    roundTimerInterval = setInterval(() => {
        timeLeft--;
        roundTimerEl.innerText = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(roundTimerInterval);
            finalizeTrade(direction, amount);
        }
    }, 1000);
}

function finalizeTrade(direction, amount) {
    isTrading = false;
    roundTimerEl.style.display = 'none';

    const currName = currentMode === 'demo' ? 'TNRX' : 'TON';
    const isWin = Math.random() >= 0.5;

    if (isWin) {
        let profit = currentMode === 'demo' ? Math.round(amount * 1.8) : parseFloat((amount * 1.8).toFixed(2));
        let netProfit = currentMode === 'demo' ? (profit - amount) : parseFloat((profit - amount).toFixed(2));

        if (currentMode === 'demo') {
            demoBalance += profit;
        } else {
            realBalance += profit;
        }

        statusMessage.innerText = `Победа! Аудит подтвердил профит +${netProfit} ${currName}`;
        statusMessage.style.color = '#00b09b';
        resultPopup.innerText = `+$${netProfit}`;
        resultPopup.style.color = '#00b09b';
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } else {
        statusMessage.innerText = `Раунд проигран. Аудитор зафиксировал минус ${amount} ${currName}`;
        statusMessage.style.color = '#ff416c';
        resultPopup.innerText = `-${amount}`;
        resultPopup.style.color = '#ff416c';
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    }

    updateBalanceUI();
}

function updateBalanceUI() {
    if (currentMode === 'demo') {
        balanceEl.innerText = demoBalance;
    } else {
        balanceEl.innerText = realBalance.toFixed(2);
    }
}

// ==========================================
// 6. Навигация по табам (Нижнее меню)
// ==========================================
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const tabName = item.getAttribute('data-tab');

        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        pages.forEach(page => page.classList.remove('active'));
        document.getElementById(tabName + 'Page').classList.add('active');

        if (tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    });
});