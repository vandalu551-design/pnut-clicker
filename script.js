// ========== Игровые переменные ==========
let clicks = 0;
let pnutBalance = 0;
let clickMultiplier = 1;
let autoClickerActive = false;
let autoClickerInterval = null;
let walletAddress = null;

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
// Загружаем реальный баланс $PNUT (если есть)
await fetchRealBalance();
} else {
walletAddress = null;
}
});
}

async function fetchRealBalance() {
if (!walletAddress) return;
// Здесь будет запрос к TON API за реальным балансом
// Пока оставим заглушку
console.log('Fetching real balance for', walletAddress);
}

// ========== Игровая логика ==========
function handleClick() {
const earnAmount = 0.1 * clickMultiplier;
pnutBalance += earnAmount;
clicks++;
// Анимация
const printer = document.getElementById('printer');
printer.classList.add('printer-clicked');
setTimeout(() => printer.classList.remove('printer-clicked'), 100);
// Ореховая анимация
const shells = document.getElementById('peanut-shells');
shells.innerHTML = '🥜';
shells.classList.add('shell-pop');
setTimeout(() => {
shells.innerHTML = '';
shells.classList.remove('shell-pop');
}, 300);
// Прогресс-бар (каждый 10 кликов — 1% к ремонту)
const progress = (clicks % 1000) / 10;
document.getElementById('progress-bar').style.width = `${progress}%`;
updateUI();
saveGameData();
checkAchievements();
// Добавляем в лидерборд (если есть кошелёк)
if (walletAddress) {
updateLeaderboard();
}
}

function updateUI() {
document.getElementById('click-count').textContent = clicks;
document.getElementById('pnut-balance').textContent = pnutBalance.toFixed(1);
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
// Peanut rain: даём 50 кликов мгновенно
for (let i = 0; i < 50; i++) {
handleClick();
}
showToast('🥜 Peanut Rain! +50 clicks');
updateUI();
saveGameData();
} else {
showToast('❌ Not enough $PNUT');
}
}

function activateAutoClicker() {
if (autoClickerInterval) return;
autoClickerActive = true;
autoClickerInterval = setInterval(() => {
handleClick();
}, 1000);
showToast('🤖 Auto Clicker activated!');
}

// ========== Достижения ==========
function checkAchievements() {
const achievements = {
100: 'Beginner Fixer',
1000: 'Printer Expert',
10000: 'Factory Owner'
};
for (const [target, name] of Object.entries(achievements)) {
if (clicks >= target) {
const achievementDiv = document.querySelector(`[data-achievement="${target}"]`);
if (achievementDiv && !achievementDiv.classList.contains('unlocked')) {
achievementDiv.classList.add('unlocked');
showToast(`🏆 Achievement unlocked: ${name}!`);
}
const progressSpan = achievementDiv?.querySelector('.achievement-progress');
if (progressSpan) {
progressSpan.textContent = `${Math.min(clicks, target)}/${target}`;
}
} else {
const achievementDiv = document.querySelector(`[data-achievement="${target}"]`);
const progressSpan = achievementDiv?.querySelector('.achievement-progress');
if (progressSpan) {
progressSpan.textContent = `${clicks}/${target}`;
}
}
}
}

// ========== Реферальная система ==========
function initReferral() {
const urlParams = new URLSearchParams(window.location.search);
const referrer = urlParams.get('ref');
if (referrer && !localStorage.getItem('referred')) {
// Начисляем бонус пригласившему
localStorage.setItem('referred', 'true');
// Здесь нужно будет отправить запрос на бэкенд
console.log('Referred by:', referrer);
}
// Генерируем реферальную ссылку
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
// Загружаем статистику рефералов (заглушка)
const referrals = JSON.parse(localStorage.getItem('referrals') || '[]');
document.getElementById('referral-count').textContent = referrals.length;
document.getElementById('referral-bonus').textContent = referrals.length * 10;
}

// ========== Лидерборд (локальный) ==========
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
leaderboard = leaderboard.slice(0, 20);
localStorage.setItem('pnutLeaderboard', JSON.stringify(leaderboard));
renderLeaderboard(leaderboard);
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
// Создаём временное уведомление
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
// Обработчики кликов
const clickBtn = document.getElementById('click-btn');
if (clickBtn) {
clickBtn.addEventListener('click', handleClick);
}
// Обработчики бустеров
document.querySelectorAll('.booster').forEach(booster => {
booster.addEventListener('click', () => {
const type = booster.dataset.booster;
buyBooster(type);
});
});
// Копирование реферальной ссылки
document.getElementById('copy-link')?.addEventListener('click', () => {
const linkInput = document.getElementById('referral-link');
linkInput.select();
document.execCommand('copy');
showToast('✅ Link copied!');
});
// Загружаем лидерборд
const savedLeaderboard = JSON.parse(localStorage.getItem('pnutLeaderboard') || '[]');
renderLeaderboard(savedLeaderboard);
}

// Запуск
init();
