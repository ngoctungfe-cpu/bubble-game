const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const inputBox = document.getElementById('input-box');
const startScreen = document.getElementById('start-screen');
const gameContainer = document.getElementById('game-container');
const playerNameInput = document.getElementById('player-name-input');
const startBtn = document.getElementById('start-btn');
const modeBtns = document.querySelectorAll('.mode-btn');
const homeBtn = document.getElementById('home-btn');

let từĐơnBank = [];

if (window.visualViewport) {
    visualViewport.addEventListener('resize', () => {
        const diff = window.innerHeight - visualViewport.height;
        inputBox.style.bottom = diff > 100 ? diff + 'px' : '0';
    });
}

async function loadOnlineDictionary() {
    startBtn.innerText = "Đang kết nối...";
    startBtn.disabled = true;

    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Quá thời gian tải")), 3000)
    );

    try {
        const fetchPromise = fetch('https://raw.githubusercontent.com/TrangMinhTran/Vietnamese-Wordlist/master/Vietnamese-Wordlist.txt')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.text();
            });

        const text = await Promise.race([fetchPromise, timeout]);

        let allWords = text.split('\n')
            .map(w => w.trim().toLowerCase())
            .filter(w => w.length > 0 && !w.includes(' '));

        từĐơnBank = [...new Set(allWords)];
        console.log(`Đã tải xong ${từĐơnBank.length} từ online!`);
    } catch (error) {
        console.warn("Không tải được từ điển online:", error.message, "- dùng từ dự phòng.");
        từĐơnBank = [
            'nắng', 'mưa', 'gió', 'biển', 'trời', 'đất', 'bóng', 'đá', 'cầu', 'phím',
            'máy', 'tính', 'chạy', 'bước', 'nhìn', 'xem', 'nói', 'cười', 'học', 'tập',
            'sách', 'vở', 'bút', 'mực', 'đỉnh', 'chóp', 'quá', 'dữ', 'ghê', 'vượt',
            'màn', 'chiến', 'thắng', 'tốc', 'độ', 'chính', 'xác', 'nhanh', 'chậm', 'đợi',
            'chút', 'xin', 'chào', 'tạm', 'biệt', 'nghĩ', 'suy', 'làm', 'việc', 'trung'
        ];
    } finally {
        startBtn.innerText = "BẮT ĐẦU CHƠI";
        startBtn.disabled = false;
    }
}
loadOnlineDictionary();

function getRandomPhrase() {
    const rand = Math.random();
    let type = 1;
    let wordCount = 1;

    if (rand < 0.5) {
        type = 1;
        wordCount = 1;
    } else if (rand < 0.8) {
        type = 2;
        wordCount = 2;
    } else {
        type = 3;
        wordCount = Math.floor(Math.random() * 2) + 3;
    }

    let tempBank = [...từĐơnBank];
    let phraseWords = [];

    for (let i = 0; i < wordCount; i++) {
        if (tempBank.length === 0) tempBank = [...từĐơnBank];
        const randomIndex = Math.floor(Math.random() * tempBank.length);
        const pickedWord = tempBank[randomIndex];
        phraseWords.push(pickedWord);
        tempBank.splice(randomIndex, 1);
    }

    return { text: phraseWords.join(' '), type: type };
}

let bubbles = [];
let score = 0;
let missed = 0;
const maxMissed = 8;
let isGameOver = false;
let isGameStarted = false;
let isGameWin = false;
let playerName = "Người chơi";

let targetWinCount = 10;
let currentPopCount = 0;
let totalSpawnedCount = 0;

let fireworks = [];
let bgStars = [];
let screenScale = 1;

function updateScale() {
    const w = canvas.clientWidth;
    screenScale = w > 0 ? Math.min(w / 800, 1) : 1;
}

window.addEventListener('resize', updateScale);

updateScale();

for (let i = 0; i < 40; i++) {
    bgStars.push({
        x: Math.random() * 800,
        y: Math.random() * 550,
        r: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.3 + 0.1,
        alpha: Math.random() * 0.5 + 0.2,
    });
}

modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        targetWinCount = parseInt(btn.getAttribute('data-target'));
    });
});

startBtn.addEventListener('click', startGame);
playerNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });

function startGame() {
    if (từĐơnBank.length === 0) return;

    const inputName = playerNameInput.value.trim();
    if (inputName !== "") playerName = inputName;

    startScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    updateScale();

    bubbles = [];
    fireworks = [];
    score = 0;
    missed = 0;
    currentPopCount = 0;
    totalSpawnedCount = 0;
    isGameOver = false;
    isGameWin = false;
    isGameStarted = true;

    homeBtn.classList.add('hidden');
    inputBox.style.display = 'block';
    inputBox.value = '';
    inputBox.focus();
    refreshLeaderboard();
    gameLoop();
}

class Bubble {
    constructor(existing) {
        const data = getRandomPhrase();
        this.text = data.text;
        this.type = data.type;

        if (this.type === 1) { this.radius = 80; this.points = 10; this.color = '#00ffcc'; }
        else if (this.type === 2) { this.radius = 110; this.points = 25; this.color = '#ffcc00'; }
        else { this.radius = 150; this.points = 50; this.color = '#ff3366'; }

        this.x = this.pickX(existing);
        this.y = -this.radius;

        let speedBonus = this.type === 1 ? 0.55 : (this.type === 2 ? 0.45 : 0.35);
        this.speed = (Math.random() * 0.15 + speedBonus) * 0.8;
        this.glowPhase = Math.random() * Math.PI * 2;
    }

    pickX(existing) {
        const tries = 40;
        const gap = 20;
        for (let i = 0; i < tries; i++) {
            const x = Math.random() * (canvas.width - this.radius * 2) + this.radius;
            let ok = true;
            for (let b of existing) {
                const minDist = this.radius + b.radius + gap;
                if (Math.abs(x - b.x) < minDist && Math.abs(-this.radius - b.y) < minDist) {
                    ok = false;
                    break;
                }
            }
            if (ok) return x;
        }
        return Math.random() * (canvas.width - this.radius * 2) + this.radius;
    }

    update() {
        this.y += this.speed;
        this.glowPhase += 0.03;
    }

    draw() {
        ctx.save();
        const x = this.x, y = this.y, r = this.radius;
        const glow = Math.sin(this.glowPhase) * 0.15 + 0.85;

        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20 * glow;

        let gradient = ctx.createRadialGradient(x, y, r * 0.05, x, y, r);
        gradient.addColorStop(0, `rgba(255, 255, 255, 0.9)`);
        gradient.addColorStop(0.3, this.color);
        gradient.addColorStop(0.85, this.color);
        gradient.addColorStop(1, `rgba(255, 255, 255, 0.05)`);

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * glow})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, Math.max(r - 14, r * 0.7), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fill();

        const fontSize = this.type === 3 ? 32 : (this.type === 2 ? 34 : 36);
        ctx.font = `bold ${Math.max(fontSize, 14)}px "Poppins", "Arial Black", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 8;

        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 4;
        ctx.strokeText(this.text, x, y);

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, x, y);

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.radius = Math.random() * 3 + 1;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 2;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.alpha = 1; this.gravity = 0.1;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += this.gravity; this.alpha -= 0.015; }
    draw() {
        ctx.save(); ctx.globalAlpha = this.alpha; ctx.shadowColor = this.color; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill(); ctx.restore();
    }
}

function spawnFirework() {
    const x = Math.random() * canvas.width;
    const y = Math.random() * (canvas.height / 2);
    const color = `hsl(${Math.random() * 360}, 100%, 60%)`;
    for (let i = 0; i < 60; i++) { fireworks.push(new Particle(x, y, color)); }
}

function drawBackground() {
    bgStars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) { star.y = -2; star.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.fill();
    });
}

function drawPanel(x, y, w, h) {
    ctx.save();
    const s = screenScale;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 20 * s;
    ctx.fillStyle = 'rgba(15, 12, 41, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

let frameCount = 0;

let cachedLeaderboard = null;

function refreshLeaderboard() {
    LeaderboardService.loadLeaderboard().then(data => { cachedLeaderboard = data; });
}

function handleBubbles() {
    if (isGameOver || isGameWin) { bubbles = []; return; }

    if (Math.random() < 0.022 && totalSpawnedCount < targetWinCount) {
        bubbles.push(new Bubble(bubbles));
        totalSpawnedCount++;
    }

    for (let i = bubbles.length - 1; i >= 0; i--) {
        bubbles[i].update();
        bubbles[i].draw();

        if (bubbles[i].y - bubbles[i].radius > canvas.height) {
            bubbles.splice(i, 1);
            missed++;
            if (missed >= maxMissed) { isGameOver = true; saveScore(); }
        }
    }

    if (bubbles.length === 0 && totalSpawnedCount >= targetWinCount) {
        if (currentPopCount >= targetWinCount && !isGameWin) {
            isGameWin = true;
            saveScore();
        } else if (!isGameOver && !isGameWin) {
            isGameOver = true;
            saveScore();
        }
    }
}

homeBtn.addEventListener('click', goHome);
homeBtn.addEventListener('touchend', (e) => { e.preventDefault(); goHome(); });

function goHome() {
    isGameStarted = false;
    homeBtn.classList.add('hidden');
    inputBox.style.display = 'none';
    gameContainer.classList.add('hidden');
    startScreen.classList.remove('hidden');
    playerNameInput.focus();
}

inputBox.addEventListener('input', () => {
    if (isGameOver || isGameWin) return;
    let typedText = inputBox.value.trim().toLowerCase();
    for (let i = 0; i < bubbles.length; i++) {
        if (bubbles[i].text.toLowerCase() === typedText) {
            score += bubbles[i].points;
            currentPopCount++;
            bubbles.splice(i, 1);
            inputBox.value = '';
            break;
        }
    }
});

function saveScore() {
    LeaderboardService.saveScore(playerName, score);
    refreshLeaderboard();
}

function drawLeaderboard(titleText, titleColor) {
    let leaderboard = cachedLeaderboard || [];
    if (leaderboard.length === 0) {
        try { leaderboard = JSON.parse(localStorage.getItem('bubbleLeaderboard')) || []; }
        catch (e) { /* localStorage không khả dụng */ }
    }

    const s = screenScale;

    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(15, 12, 41, 0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';

    ctx.shadowColor = titleColor;
    ctx.shadowBlur = 20 * s;
    ctx.fillStyle = titleColor;
    ctx.font = `bold ${Math.round(36 * s)}px Poppins, Arial, sans-serif`;
    ctx.fillText(titleText, canvas.width / 2, 70 * s);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fdbb2d';
    ctx.font = `bold ${Math.round(18 * s)}px Poppins, Arial, sans-serif`;
    ctx.fillText(`Điểm: ${score}  |  Đã nổ: ${currentPopCount}/${targetWinCount}`, canvas.width / 2, 110 * s);

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(canvas.width / 2 - 180 * s, 135 * s, 360 * s, 1, 0);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(16 * s)}px Poppins, Arial, sans-serif`;
    ctx.fillText('BẢNG THÀNH TÍCH', canvas.width / 2, 168 * s);

    ctx.font = `${Math.round(14 * s)}px Poppins, Arial, sans-serif`;
    ctx.textAlign = 'left';

    if (leaderboard.length === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'center';
        ctx.fillText('Chưa có thành tích nào', canvas.width / 2, 230 * s);
    } else {
        let startY = 195 * s;
        leaderboard.forEach((item, index) => {
            const isFirst = index === 0;
            const y = startY + (index * 38 * s);

            ctx.fillStyle = isFirst ? '#ffd700' : 'rgba(255,255,255,0.85)';
            ctx.font = isFirst ? `bold ${Math.round(15 * s)}px Poppins, Arial, sans-serif` : `${Math.round(14 * s)}px Poppins, Arial, sans-serif`;

            const rank = index + 1;
            ctx.fillText(`#${rank}`, canvas.width / 2 - 160 * s, y);
            ctx.fillText(item.name, canvas.width / 2 - 120 * s, y);
            ctx.textAlign = 'right';
            ctx.fillText(`${item.score} điểm`, canvas.width / 2 + 160 * s, y);
            ctx.textAlign = 'left';
        });
    }

    ctx.restore();
    inputBox.style.display = 'none';
    homeBtn.classList.remove('hidden');
}

function drawUI() {
    if (isGameOver) { drawLeaderboard('KẾT THÚC', '#ff4444'); return; }
    if (isGameWin) {
        drawLeaderboard('CHIẾN THẮNG', '#00ffcc');
        if (Math.random() < 0.05) spawnFirework();
        for (let i = fireworks.length - 1; i >= 0; i--) {
            fireworks[i].update(); fireworks[i].draw();
            if (fireworks[i].alpha <= 0) fireworks.splice(i, 1);
        }
        return;
    }

    const s = screenScale;
    const pad = 16 * s;
    const panelW = 200 * s;
    const panelH = 80 * s;

    ctx.save();

    drawPanel(pad, pad, panelW, panelH);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(13 * s)}px Poppins, Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`🧑 ${playerName}`, pad + 16 * s, pad + 28 * s);
    ctx.font = `bold ${Math.round(20 * s)}px Poppins, Arial, sans-serif`;
    ctx.fillStyle = '#00ffcc';
    ctx.fillText(`${score}`, pad + 16 * s, pad + 62 * s);

    drawPanel(canvas.width - panelW - pad, pad, panelW, panelH);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(13 * s)}px Poppins, Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`Tiến độ`, canvas.width - pad - 16 * s, pad + 28 * s);
    ctx.font = `bold ${Math.round(18 * s)}px Poppins, Arial, sans-serif`;
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`⚡ ${currentPopCount}/${targetWinCount}`, canvas.width - pad - 16 * s, pad + 58 * s);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(13 * s)}px Poppins, Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`Bỏ lỡ: ${missed}/${maxMissed}`, canvas.width - pad - 16 * s, pad + 76 * s);

    const progress = currentPopCount / targetWinCount;
    if (progress > 0) {
        const barX = pad;
        const barY = pad + 90 * s;
        const barW = canvas.width - pad * 2;
        const barH = 6 * s;

        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 3 * s);
        ctx.fill();

        const fillW = barW * Math.min(progress, 1);
        const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
        grad.addColorStop(0, '#00ffcc');
        grad.addColorStop(1, '#ffcc00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, fillW, barH, 3 * s);
        ctx.fill();
    }

    ctx.restore();
}

function gameLoop() {
    if (!isGameStarted) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    handleBubbles();
    drawUI();
    requestAnimationFrame(gameLoop);
}
