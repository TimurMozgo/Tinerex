/* ==========================================================================
   T-PULSE REAL — POCKET OPTION ENGINE (WS + PRICE LINES + CYCLE ENGINE)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------------
    // 1. Инициализация Telegram SDK & Пользователя
    // ----------------------------------------------------------------------
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#06090e');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#06090e');
    }

    const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230098ea'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z'/%3E%3C/svg%3E";

    const tgUser = tg?.initDataUnsafe?.user;
    const currentUser = {
        id: tgUser?.id ? String(tgUser.id) : 'me',
        name: tgUser?.first_name ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() : 'Трейдер',
        avatar: tgUser?.photo_url || DEFAULT_AVATAR
    };

    // ----------------------------------------------------------------------
    // 2. Лимиты, Константы и Переменные Состояния
    // ----------------------------------------------------------------------
    const MIN_BET = 0.1;
    const MAX_BET = 1.0;

    let balance = 10.00;
    let selectedBet = 0.1;
    let selectedDirection = null; // 'UP' или 'DOWN'

    // Цикл: 20с приём ставок / 60с раунд
    const BETTING_TIME = 20;
    const ROUND_TIME = 60;

    let gameState = 'BETTING'; 
    let phaseTimer = BETTING_TIME;
    let mainLoopInterval = null;

    let roundEntryPrice = 0.00;
    let myPendingBet = null;

    // График и котировки
    let currentPrice = 0.00;
    let targetPrice = 0.00;
    let socket = null;
    let chart = null;
    let areaSeries = null;
    let entryPriceLine = null;

    let activePlayers = [];

    // ----------------------------------------------------------------------
    // 3. Имитация живого рынка (Боты)
    // ----------------------------------------------------------------------
    const BOT_NAMES = ['Nikita_33', 'ETERNITX'];

    const BOT_AVATARS = [
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300f2fe'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300e676'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ff9100'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z'/%3E%3C/svg%3E",
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23e040fb'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z'/%3E%3C/svg%3E"
    ];

    let botSpawnerInterval = null;

    function startBotSimulation() {
        if (botSpawnerInterval) clearInterval(botSpawnerInterval);

        spawnBotBet();
        spawnBotBet();

        botSpawnerInterval = setInterval(() => {
            if (gameState === 'BETTING') {
                if (Math.random() > 0.25) {
                    spawnBotBet();
                }
            }
        }, 1800);
    }

    function stopBotSimulation() {
        if (botSpawnerInterval) {
            clearInterval(botSpawnerInterval);
            botSpawnerInterval = null;
        }
    }

    function spawnBotBet() {
        if (gameState !== 'BETTING') return;

        const placedBotNames = activePlayers.filter(p => p.isBot).map(p => p.name);
        const availableNames = BOT_NAMES.filter(name => !placedBotNames.includes(name));

        if (availableNames.length === 0) return;

        const randomName = availableNames[Math.floor(Math.random() * availableNames.length)];
        const randomAvatar = BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)];
        const amounts = [0.10, 0.20, 0.50, 1.00];
        const randomBet = amounts[Math.floor(Math.random() * amounts.length)];
        const randomDirection = Math.random() > 0.48 ? 'UP' : 'DOWN';

        const botCard = {
            id: 'bot_' + Math.random().toString(36).substring(2, 9),
            name: randomName,
            avatar: randomAvatar,
            bet: randomBet,
            multiplier: 1.80,
            direction: randomDirection,
            status: '',
            resultText: randomBet.toFixed(2),
            isBot: true
        };

        if (myPendingBet) {
            activePlayers.splice(1, 0, botCard);
        } else {
            activePlayers.unshift(botCard);
        }

        renderPlayersList();
    }

    // ----------------------------------------------------------------------
    // 4. Элементы DOM
    // ----------------------------------------------------------------------
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
    const playersFeedContainer = document.getElementById('playersFeedContainer');

    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');

    // ----------------------------------------------------------------------
    // 5. Отрисовка ленты игроков
    // ----------------------------------------------------------------------
    function renderPlayersList() {
        if (!playersFeedContainer) return;
        playersFeedContainer.innerHTML = '';

        activePlayers.forEach(player => {
            const card = document.createElement('div');
            card.className = `player-card ${player.status || ''}`;
            card.dataset.id = player.id;

            const avatarSrc = player.avatar || DEFAULT_AVATAR;
            const dirIcon = player.direction === 'UP' ? '🟢 UP' : '🔴 DOWN';

            card.innerHTML = `
                <div class="player-left">
                    <img src="${avatarSrc}" alt="${player.name}" class="player-avatar">
                    <div class="player-info">
                        <span class="player-name">${player.name} ${player.id === currentUser.id ? '(Вы)' : ''}</span>
                        <div class="player-bet-tag">
                            <span class="dir-tag">${dirIcon}</span>
                            <span class="icon">💎</span>
                            <span class="bet-amount">${Number(player.bet).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                <div class="player-right">
                    <span class="icon">💎</span>
                    <span class="result-amount">${player.resultText !== undefined ? player.resultText : Number(player.bet).toFixed(2)}</span>
                </div>
            `;
            playersFeedContainer.appendChild(card);
        });
    }

    // ----------------------------------------------------------------------
    // 6. Инициализация Графика
    // ----------------------------------------------------------------------
    async function initRealChart() {
        const chartContainer = document.getElementById('tvchart');
        if (!chartContainer || chart) return;

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

        setStatus('Загрузка рынка BTC/USDT...');

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
            }
        } catch (e) {
            console.warn('Binance REST error');
        }

        connectBinanceWebSocket();
        startOrganicAnimation();
        renderPlayersList();
        startGameCycle();
    }

    // ----------------------------------------------------------------------
    // 7. Binance WS + Отрисовка
    // ----------------------------------------------------------------------
    function connectBinanceWebSocket() {
        socket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');

        socket.onmessage = (event) => {
            const trade = JSON.parse(event.data);
            if (!trade.p) return;

            targetPrice = parseFloat(trade.p);
            if (currentPrice === 0) currentPrice = targetPrice;
        };

        socket.onerror = (err) => console.error('WS Error:', err);
        socket.onclose = () => setTimeout(connectBinanceWebSocket, 3000);
    }

    function startOrganicAnimation() {
        setInterval(() => {
            if (!areaSeries || targetPrice === 0) return;

            currentPrice += (targetPrice - currentPrice) * 0.1;
            const organicNoise = (Math.random() - 0.48) * 1.5;
            const finalValue = parseFloat((currentPrice + organicNoise).toFixed(2));
            const now = Math.floor(Date.now() / 1000);

            areaSeries.update({
                time: now,
                value: finalValue
            });

            currentPrice = finalValue;

            if (gameState === 'ROUND' && entryPriceLine && myPendingBet) {
                const isProfitable = (myPendingBet.direction === 'UP' && currentPrice > roundEntryPrice) ||
                                     (myPendingBet.direction === 'DOWN' && currentPrice < roundEntryPrice);
                
                entryPriceLine.applyOptions({
                    color: isProfitable ? '#00e676' : '#ff1744'
                });
            }
        }, 150);
    }

    // ----------------------------------------------------------------------
    // 8. Движок PocketOption (Цикл Раундов + Подсчет Ботов)
    // ----------------------------------------------------------------------
    function startGameCycle() {
        startBettingPhase();

        if (mainLoopInterval) clearInterval(mainLoopInterval);

        mainLoopInterval = setInterval(() => {
            if (gameState === 'BETTING') {
                phaseTimer--;
                if (roundTimerEl) roundTimerEl.textContent = phaseTimer;
                setStatus(`Прием ставок! До раунда: ${phaseTimer}s`);

                if (phaseTimer <= 0) {
                    startRoundPhase();
                }
            } else if (gameState === 'ROUND') {
                phaseTimer--;
                if (roundTimerEl) roundTimerEl.textContent = phaseTimer;
                setStatus(`Раунд идет! Вход: $${roundEntryPrice.toFixed(2)} | До конца: ${phaseTimer}s`);

                if (phaseTimer <= 0) {
                    finishRoundPhase();
                }
            }
        }, 1000);
    }

    function startBettingPhase() {
        gameState = 'BETTING';
        phaseTimer = BETTING_TIME;
        myPendingBet = null;

        activePlayers = [];
        renderPlayersList();

        startBotSimulation();

        if (entryPriceLine && areaSeries) {
            areaSeries.removePriceLine(entryPriceLine);
            entryPriceLine = null;
        }

        if (btnUp) btnUp.disabled = false;
        if (btnDown) btnDown.disabled = false;

        if (roundTimerEl) {
            roundTimerEl.style.display = 'flex';
            roundTimerEl.style.color = '#00e676';
            roundTimerEl.textContent = phaseTimer;
        }

        setStatus(`Прием ставок! До начала раунда: ${phaseTimer} сек`);
    }

    function startRoundPhase() {
        gameState = 'ROUND';
        phaseTimer = ROUND_TIME;
        roundEntryPrice = currentPrice;

        stopBotSimulation();

        if (btnUp) btnUp.disabled = true;
        if (btnDown) btnDown.disabled = true;
        closeBetModal();

        if (roundTimerEl) {
            roundTimerEl.style.color = '#ff1744';
            roundTimerEl.textContent = phaseTimer;
        }

        if (areaSeries && roundEntryPrice > 0 && myPendingBet) {
            if (entryPriceLine) areaSeries.removePriceLine(entryPriceLine);

            const lineColor = myPendingBet.direction === 'UP' ? '#00e676' : '#ff1744';

            entryPriceLine = areaSeries.createPriceLine({
                price: roundEntryPrice,
                color: lineColor,
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                axisLabelVisible: true,
                title: `ВХОД (${myPendingBet.direction}): $${roundEntryPrice.toFixed(2)}`,
            });
        }

        setStatus(`Раунд начался! Игроков в раунде: ${activePlayers.length}`);
        haptic('notification', 'warning');
    }

    function finishRoundPhase() {
        if (gameState !== 'ROUND') return;
        gameState = 'FINISHED'; 

        const roundExitPrice = currentPrice;

        activePlayers.forEach(p => {
            const isWin = (p.direction === 'UP' && roundExitPrice > roundEntryPrice) ||
                          (p.direction === 'DOWN' && roundExitPrice < roundEntryPrice);

            if (isWin) {
                const profit = p.bet * 1.8;
                p.status = 'win';
                p.resultText = profit.toFixed(2);

                if (p.id === currentUser.id && myPendingBet) {
                    balance += profit;
                    updateBalanceUI();
                    setStatus(`ПОБЕДА! Вход: $${roundEntryPrice.toFixed(2)} | Выход: $${roundExitPrice.toFixed(2)} (+${profit.toFixed(2)} Gram)`);
                    haptic('notification', 'success');
                }
            } else {
                p.status = 'lose';
                p.resultText = '0.00';

                if (p.id === currentUser.id && myPendingBet) {
                    setStatus(`ПРОИГРЫШ! Вход: $${roundEntryPrice.toFixed(2)} | Выход: $${roundExitPrice.toFixed(2)} (-${myPendingBet.amount.toFixed(2)} Gram)`);
                    haptic('notification', 'error');
                }
            }
        });

        myPendingBet = null;
        renderPlayersList();

        setTimeout(() => {
            startBettingPhase();
        }, 2000);
    }

    // ----------------------------------------------------------------------
    // 9. Модалка ставок
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
        const val = parseFloat(customBetInput?.value || 0);
        
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
        if (gameState !== 'BETTING') {
            setStatus('Ставки закрыты! Дождитесь следующего раунда.');
            haptic('notification', 'error');
            return;
        }

        if (myPendingBet) {
            setStatus('Вы уже сделали ставку на этот раунд!');
            haptic('notification', 'warning');
            return;
        }

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

    btnConfirmBet?.addEventListener('click', () => {
        if (gameState !== 'BETTING') {
            setStatus('Время приёма ставок истекло!');
            closeBetModal();
            return;
        }

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

        myPendingBet = {
            amount: selectedBet,
            direction: selectedDirection
        };

        const userCard = {
            id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            bet: selectedBet,
            multiplier: 1.80,
            direction: selectedDirection,
            status: '',
            resultText: selectedBet.toFixed(2)
        };

        activePlayers = activePlayers.filter(p => p.id !== currentUser.id);
        activePlayers.unshift(userCard);
        renderPlayersList();

        closeBetModal();
        setStatus(`Ставка принята: ${selectedBet} Gram на ${selectedDirection}! Ждем старт раунда.`);
        haptic('notification', 'success');
    });

    // ----------------------------------------------------------------------
    // 10. Навигация
    // ----------------------------------------------------------------------
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const tabName = item.dataset.tab;
            if (tabName === 'tab-start') return;

            e.preventDefault();
            navItems.forEach(n => n.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active'));

            item.classList.add('active');
            
            let targetPage = document.getElementById(`${tabName}Page`);
            if (!targetPage && tabName === 'bonus') {
                targetPage = document.getElementById('walletPage');
            }

            if (targetPage) targetPage.classList.add('active');
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

    // ----------------------------------------------------------------------
    // 11. Инициализация TON Connect & Депозиты (Безопасно внутри DOMContentLoaded)
    // ----------------------------------------------------------------------
    
    // 📍 Место 1: Твой публичный TON-кошелек (Касса проекта, куда идут деньги)
    const MY_ADMIN_WALLET = "UQCxupmZDDujlyyzP8SBYz4hPJ5yePBzFrLKnGxLd125CXSt"; 
    
    let tonConnectUI = null;

    if (window.TON_CONNECT_UI) {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://your-domain.com/tonconnect-manifest.json' // Ссылка на твой манифест
        });

        const balanceBox = document.querySelector('.balance-box');

        if (balanceBox) {
            balanceBox.addEventListener('click', async () => {
                if (!tonConnectUI.connected) {
                    tonConnectUI.openModal();
                }
            });
        }

        tonConnectUI.onStatusChange(wallet => {
            const balanceLabel = document.querySelector('.balance-label');
            
            if (wallet) {
                const rawAddr = wallet.account.address;
                const shortAddress = `${rawAddr.slice(0, 4)}...${rawAddr.slice(-4)}`;
                if (balanceLabel) balanceLabel.textContent = shortAddress;
                console.log('Кошелек подключен:', rawAddr);
            } else {
                if (balanceLabel) balanceLabel.textContent = 'ПОДКЛЮЧИТЬ TON';
                const realBalEl = document.getElementById('realBalance');
                if (realBalEl) realBalEl.textContent = '0.00';
            }
        });
    }

    // 🚀 Функция проведения депозита
    async function depositTON(amountInTon) {
        if (!tonConnectUI) {
            setStatus('Ошибка: Скрипт TON Connect не загружен!');
            return;
        }

        if (!tonConnectUI.connected) {
            setStatus('Сначала подключи кошелек!');
            tonConnectUI.openModal();
            return;
        }

        // Формируем транзакцию на кассу
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 600, // 10 минут
            messages: [
                {
                    address: MY_ADMIN_WALLET, // Адрес твоей кассы
                    amount: Math.floor(amountInTon * 1000000000).toString(), // Перевод в nanoTON
                }
            ]
        };

        try {
            setStatus('Подтвердите транзакцию в кошельке...');
            const result = await tonConnectUI.sendTransaction(transaction);
            
            console.log('Успешная отправка:', result);
            setStatus('Депозит отправлен в блокчейн! Ожидаем зачисления...');
            if (typeof haptic === 'function') haptic('notification', 'success');

        } catch (e) {
            console.error('Ошибка депозита:', e);
            setStatus('Депозит отменен или произошла ошибка.');
            if (typeof haptic === 'function') haptic('notification', 'error');
        }
    }

    // Запуск графиков и циклов
    initRealChart();
});