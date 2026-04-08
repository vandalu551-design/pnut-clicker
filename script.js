// ========== Игровые переменные ==========
let clicks = 0;
let pnutBalance = 0;
let clickMultiplier = 1;
let autoClickerActive = false;
let autoClickerInterval = null;
let walletAddress = null;

// ========== Защита от накрутки ==========
let lastClickTime = 0;
const CLICK_COOLDOWN = 200; // миллисекунд (максимум 5 кликов в секунду)
let clicksSinceCaptcha = 0;
const CAPTCHA_INTERVAL = 100; // капча после каждых 100 кликов
let captchaActive = false;
let pendingClicks = 0; // накопленные клики во время капчи

// Загрузка сохранённых данных
function loadGameData() {
    const saved = localStorage.getItem('pnutClickerData');
    if (saved) {
        const data = JSON.parse(saved);
        clicks = data.clicks || 0;
        pnutBalance = data.pnutBalance || 0;
        clickMultiplier = data.clickMultiplier || 1;
        if (data.autoClickerActive) {
            activateAutoClicker();
        }
    }
    updateUI();
    checkAchievements();
}

// Сохранение данных
function saveGameData() {
    const data = {
        clicks: clicks,
        pnutBalance: pnutBalance,
        clickMultiplier: clickMultiplier,
        autoClickerActive: autoClickerActive
    };
    localStorage.setItem('pnutClickerData', JSON.stringify(data));
}

// ========== TON Connect ==========
let tonConnectUI = null;

async function initTonConnect() {
    if (typeof TON_CONNECT_UI === 'undefined') {
        console.log('TON Connect UI not loaded yet');
        return;
    }
    
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: 'https://fedpostnut.com/tonconnect-manifest.json',
        buttonRootId: 'connect-wallet'
    });
    
    tonConnectUI.onStatusChange(async (wallet) => {
        if (wallet) {
            walletAddress = wallet.account.address;
            document.getElementById('wallet-info').innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>✅ ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}</span>
                    <button id="disconnect-wallet" class="connect-btn" style="background: #ff4444;">Disconnect</button>
                </div>
            `;
            document.getElementById('disconnect-wallet')?.addEventListener('click', () => {
                tonConnectUI.disconnect();
                walletAddress = null;
                document.getElementById('wallet-info').innerHTML = '<button id="connect-wallet" class="connect-btn">🔌 Connect Wallet</button>';
                document.getElementById('connect-wallet')?.addEventListener('click', () => tonConnectUI.openModal());
            });
            
            await fetchRealBalance();
        } else {
            walletAddress = null;
        }
    });
}

async function fetchRealBalance() {
    if (!walletAddress) return;
    console.log('Fetching real balance for', walletAddress);
}

// ========== Капча ==========
function showCaptcha() {
    if (captchaActive) return;
    captchaActive = true;
    
    // Приостанавливаем автокликер
    let wasAutoClickerActive = autoClickerActive;
    if (autoClickerActive) {
        stopAutoClicker();
    }
    
    const captchaDiv = document.createElement('div');
    captchaDiv.className = 'captcha-overlay';
    captchaDiv.innerHTML = `
        <div class="captcha-window">
            <div class="captcha-icon">🔧</div>
            <p>Prove you're not a bot</p>
            <div class="captcha-buttons">
                <button id="captcha-btn" class="captcha-confirm">I'm human</button>
            </div>
            <div class="captcha-timeout" id="captcha-timeout">⏱️ 10 seconds</div>
        </div>
    `;
    document.body.appendChild(captchaDiv);
    
    let timeLeft = 10;
    const timeoutDisplay = document.getElementById('captcha-timeout');
    
    const timer = setInterval(() => {
        timeLeft--;
        if (timeoutDisplay) {
            timeoutDisplay.textContent = `⏱️ ${timeLeft} seconds`;
        }
        if (timeLeft <= 0) {
            clearInterval(timer);
            if (captchaDiv && captchaDiv.parentNode) {
                captchaDiv.remove();
            }
            captchaActive = false;
            showToast('❌ Captcha timeout! Clicks reset.');
            clicksSinceCaptcha = 0;
            pendingClicks = 0;
            // Возвращаем автокликер
            if (wasAutoClickerActive) {
                activateAutoClicker();
            }
        }
    }, 1000);
    
    const btn = document.getElementById('captcha-btn');
    btn.onclick = () => {
        clearInterval(timer);
        captchaDiv.remove();
        captchaActive = false;
        clicksSinceCaptcha = 0;
        showToast('✅ Human verified!');
        
        // Начисляем накопленные клики
        if (pendingClicks > 0) {
            showToast(`📦 Processing ${pendingClicks} pending clicks...`);
            for (let i = 0; i < pendingClicks; i++) {
                processClick();
            }
            pendingClicks = 0;
        }
        
        // Возвращаем автокликер
        if (wasAutoClickerActive) {
            activateAutoClicker();
        }
    };
}

// ========== Процессинг клика (внутренняя логика) ==========
function processClick() {
    const earnAmount = 0.1 * clickMultiplier;
    pnutBalance += earnAmount;
    clicks++;
    
    // Анимация
    const printer = document.getElementById('printer');
    if (printer) {
        printer.classList.add('printer-clicked');
        setTimeout(() => printer.classList.remove('printer-clicked'), 100);
    }
    
    // Ореховая анимация
    const shells = document.getElementById('peanut-shells');
    if (shells) {
        shells.innerHTML = '🥜';
        shells.classList.add('shell-pop');
        setTimeout(() => {
            shells.innerHTML = '';
            shells.classList.remove('shell-pop');
        }, 300);
    }
    
    // Прогресс-бар (каждый 10 кликов — 1% к ремонту)
    const progress = (clicks % 1000) / 10;
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
    
    updateUI();
    saveGameData();
    checkAchievements();
    
    // Обновляем лидерборд
    if (walletAddress) {
        updateLeaderboard();
    }
}

// ========== Основная функция клика с защитой ==========
function handleClick(event) {
    // Защита 1: проверка на программный клик
    if (event && event.detail === 0 && !event.isTrusted) {
        console.log('Bot detected: programmatic click');
        showToast('🤖 Bot detected! Click blocked.');
        return;
    }
    
    // Защита 2: ограничение частоты кликов
    const now = Date.now();
    if (now - lastClickTime < CLICK_COOLDOWN) {
        showToast('⏱️ Too fast! Slow down.');
        return;
    }
    lastClickTime = now;
    
    // Защита 3: капча
    if (captchaActive) {
        pendingClicks++;
        showToast('🔒 Captcha active. Click queued.');
        return;
    }
    
    clicksSinceCaptcha++;
    
    if (clicksSinceCaptcha >= CAPTCHA_INTERVAL) {
        showCaptcha();
        return;
    }
    
    processClick();
}

// ========== Автокликер ==========
function activateAutoClicker() {
    if (autoClickerInterval) return;
    autoClickerActive = true;
    autoClickerInterval = setInterval(() => {
        // Автокликеры тоже должны проходить защиту
        const now = Date.now();
        if (!captchaActive && (now - lastClickTime >= CLICK_COOLDOWN)) {
            lastClickTime = now;
            processClick();
        }
    }, 1100); // чуть медленнее лимита
    showToast('🤖 Auto Clicker activated!');
}

function stopAutoClicker() {
    if (autoClickerInterval) {
        clearInterval(autoClickerInterval);
        autoClickerInterval = null;
    }
    autoClickerActive = false;
}

// ========== Бустеры ==========
function buyBooster(type) {
    if (type === 'double' && clickMultiplier === 1 && pnutBalance >= 50) {
        pnutBalance -= 50;
        clickMultiplier = 2;
        showToast('⚡ Double Click activated!');
        updateUI();
        saveGameData();
    } else if (type === 'auto' && !autoClickerActive && pnutBalance >= 200) {
        pnutBalance -= 200;
        activateAutoClicker();
        updateUI();
        saveGameData();
    } else if (type === 'peanut' && pnutBalance >= 500) {
        pnutBalance -= 500;
        // Peanut rain: даём 50 кликов мгновенно (с защитой)
        showToast('🥜 Peanut Rain! +50 clicks incoming...');
        let clicksAdded = 0;
        const addClickWithDelay = () => {
            if (clicksAdded < 50 && !captchaActive) {
                processClick();
                clicksAdded++;
                setTimeout(addClickWithDelay, 50);
            } else if (clicksAdded < 50 && captchaActive) {
                // Если капча активна, откладываем
                setTimeout(addClickWithDelay, 200);
            } else {
                showToast('✅ Peanut Rain complete!');
            }
        };
        addClickWithDelay();
        updateUI();
        saveGameData();
    } else {
        showToast('❌ Not enough $PNUT');
    }
}

// ========== UI Обновление ==========
function updateUI() {
    const clickCountEl = document.getElementById('click-count');
    const balanceEl = document.getElementById('pnut-balance');
    if (clickCountEl) clickCountEl.textContent = clicks;
    if (balanceEl) balanceEl.textContent = pnutBalance.toFixed(1);
}

// ========== Достижения ==========
function checkAchievements() {
    const achievements = {
        100: 'Beginner Fixer',
        1000: 'Printer Expert',
        10000: 'Factory Owner'
    };
    
    for (const [target, name] of Object.entries(achievements)) {
        const achievementDiv = document.querySelector(`[data-achievement="${target}"]`);
        if (achievementDiv) {
            if (clicks >= target && !achievementDiv.classList.contains('unlocked')) {
                achievementDiv.classList.add('unlocked');
                showToast(`🏆 Achievement unlocked: ${name}!`);
            }
            const progressSpan = achievementDiv.querySelector('.achievement-progress');
            if (progressSpan) {
                progressSpan.textContent = `${Math.min(clicks, target)}/${target}`;
            }
        }
    }
}

// ========== Реферальная система ==========
function initReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const referrer = urlParams.get('ref');
    
    if (referrer && !localStorage.getItem('referred')) {
        localStorage.setItem('referred', 'true');
        console.log('Referred by:', referrer);
        showToast('🎉 Welcome! You were referred!');
    }
    
    const currentUrl = window.location.href.split('?')[0];
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = Math.random().toString(36).substring(2, 10);
        localStorage.setItem('userId', userId);
    }
    
    const referralLink = `${currentUrl}?ref=${userId}`;
    const referralInput = document.getElementById('referral-link');
    if (referralInput) {
        referralInput.value = referralLink;
    }
    
    const referrals = JSON.parse(localStorage.getItem('referrals') || '[]');
    const referralCountEl = document.getElementById('referral-count');
    const referralBonusEl = document.getElementById('referral-bonus');
    if (referralCountEl) referralCountEl.textContent = referrals.length;
    if (referralBonusEl) referralBonusEl.textContent = referrals.length * 10;
}

// ========== Лидерборд ==========
function updateLeaderboard() {
    if (!walletAddress) return;
    
    let leaderboard = JSON.parse(localStorage.getItem('pnutLeaderboard') || '[]');
    const existing = leaderboard.find(entry => entry.wallet === walletAddress);
    
    if (existing) {
        existing.clicks = clicks;
        existing.balance = pnutBalance;
    } else {
        leaderboard.push({
            wallet: walletAddress,
            clicks: clicks,
            balance: pnutBalance,
            date: new Date().toISOString()
        });
    }
    
    leaderboard.sort((a, b) => b.clicks - a.clicks);
    const topLeaderboard = leaderboard.slice(0, 20);
    localStorage.setItem('pnutLeaderboard', JSON.stringify(topLeaderboard));
    
    renderLeaderboard(topLeaderboard);
}

function renderLeaderboard(leaderboard) {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;
    
    if (leaderboard.length === 0) {
        container.innerHTML = '<div class="leaderboard-loading">No data yet</div>';
        return;
    }
    
    container.innerHTML = leaderboard.map((entry, index) => `
        <div class="leaderboard-item">
            <span class="leaderboard-rank">#${index + 1}</span>
            <span>${entry.wallet.slice(0, 6)}...${entry.wallet.slice(-4)}</span>
            <span>${entry.clicks} clicks</span>
        </div>
    `).join('');
}

// ========== Уведомления ==========
function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = '#f5c542';
    toast.style.color = '#0a0f1e';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '30px';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '1000';
    toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    toast.style.whiteSpace = 'nowrap';
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

// ========== Инициализация ==========
function init() {
    loadGameData();
    initTonConnect();
    initReferral();
    
    const clickBtn = document.getElementById('click-btn');
    if (clickBtn) {
        clickBtn.addEventListener('click', handleClick);
    }
    
    document.querySelectorAll('.booster').forEach(booster => {
        booster.addEventListener('click', () => {
            const type = booster.dataset.booster;
            buyBooster(type);
        });
    });
    
    const copyBtn = document.getElementById('copy-link');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const linkInput = document.getElementById('referral-link');
            if (linkInput) {
                linkInput.select();
                document.execCommand('copy');
                showToast('✅ Link copied!');
            }
        });
    }
    
    const savedLeaderboard = JSON.parse(localStorage.getItem('pnutLeaderboard') || '[]');
    renderLeaderboard(savedLeaderboard);
}

// Запуск
init();
