/**
 * GEORGIA AND LILLY ABACUS
 * Pure Static Web App
 */

// --- Constants & Config ---
const COLS = ['Ones', 'Tens', 'Hundreds', 'Thousands'];
const MULTIPLIERS = [1, 10, 100, 1000];
const COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444']; // Yellow, Green, Blue, Red

const SVG_WIDTH = 700;
const SVG_HEIGHT = 500;
const PADDING = 60;
const BEAD_W = 40;
const BEAD_H = 35;
const ROD_T = 8;
const SLOT_W = BEAD_W + 4;
const EXTRA_LEFT = 60;

// --- State Management ---
const state = {
    user: localStorage.getItem('abacus_user') || null,
    counts: [0, 0, 0, 0], // Index matches COLS
    voice: false,
    sound: true,
    chatty: 'Normal',
    lesson: null,
    lessonStep: 0,
    isCarrying: false
};

// --- DOM References ---
const screens = {
    splash: document.getElementById('screen-splash'),
    user: document.getElementById('screen-user'),
    app: document.getElementById('screen-app')
};

const el = {
    svg: document.getElementById('abacus-svg'),
    total: document.getElementById('total-value'),
    breakdown: document.getElementById('column-breakdown'),
    badge: document.getElementById('user-badge'),
    name: document.getElementById('display-name'),
    feedback: document.getElementById('feedback-bubble'),
    lessonUi: document.getElementById('lesson-ui'),
    lessonText: document.getElementById('lesson-text'),
    freePlayUi: document.getElementById('free-play-ui')
};

// Audio Setup
let audioCtx = null;

// --- Initialisation ---
function init() {
    bindEvents();
    if (state.user) {
        showScreen('app');
    } else {
        showScreen('splash');
    }
}

function bindEvents() {
    // Splash
    document.getElementById('btn-splash-start').onclick = () => {
        initAudio();
        showScreen('user');
        speak("Hello! Who is playing today?");
    };

    // User Picker
    document.querySelectorAll('.btn-user').forEach(btn => {
        btn.onclick = () => {
            state.user = btn.dataset.user;
            localStorage.setItem('abacus_user', state.user);
            showScreen('app');
        };
    });

    document.getElementById('btn-hear-prompt').onclick = () => speak("Who is playing today?");

    // Settings
    document.getElementById('btn-change-user').onclick = () => {
        state.user = null;
        localStorage.removeItem('abacus_user');
        showScreen('user');
    };

    const toggleVoice = document.getElementById('toggle-voice');
    toggleVoice.onclick = () => {
        state.voice = !state.voice;
        toggleVoice.classList.toggle('on', state.voice);
        toggleVoice.textContent = state.voice ? 'On' : 'Off';
        if (state.voice) speak("Voice enabled. I am your English teacher.");
    };

    const toggleSound = document.getElementById('toggle-sound');
    toggleSound.onclick = () => {
        state.sound = !state.sound;
        toggleSound.classList.toggle('on', state.sound);
        toggleSound.textContent = state.sound ? 'On' : 'Off';
    };

    document.querySelectorAll('.lvl-btn').forEach(btn => {
        btn.onclick = () => {
            state.chatty = btn.dataset.lvl;
            document.querySelectorAll('.lvl-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    // Actions
    document.getElementById('btn-reset').onclick = resetAbacus;
    document.getElementById('btn-start-lesson').onclick = startLesson;
    document.getElementById('btn-lesson-quit').onclick = quitLesson;
    document.getElementById('btn-lesson-check').onclick = checkLesson;
}

function showScreen(key) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[key].classList.add('active');
    if (key === 'app') renderApp();
}

// --- Audio & Speech ---
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playClack(row) {
    if (!state.sound || !audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    
    // Deeper clack for lower rods
    const freq = [1200, 800, 400, 200][row] || 800;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq + Math.random() * 50, now);
    
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.connect(g);
    g.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.1);
}

function speak(text) {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // Seek "English Lady" (en-GB female)
    const lady = voices.find(v => v.lang.startsWith('en-GB') && (v.name.includes('Female') || v.name.includes('Google UK English Female') || v.name.includes('Hazel') || v.name.includes('Serena'))) 
              || voices.find(v => v.lang.startsWith('en-GB')) 
              || voices[0];

    if (lady) msg.voice = lady;
    msg.lang = 'en-GB';
    msg.pitch = 1.1;
    msg.rate = 0.95;
    window.speechSynthesis.speak(msg);
}

// --- App Logic ---
function renderApp() {
    el.badge.textContent = state.user ? state.user[0] : '?';
    el.name.textContent = state.user;
    
    const total = state.counts.reduce((sum, count, idx) => sum + count * MULTIPLIERS[idx], 0);
    el.total.textContent = total;

    el.breakdown.innerHTML = COLS.slice().reverse().map((name, i) => {
        const idx = 3 - i;
        return `<span>${name}: <b>${state.counts[idx]}</b></span>`;
    }).join('');

    renderAbacus();
    updateLessonDisplay();
}

function updateLessonDisplay() {
    if (state.lesson) {
        el.lessonUi.classList.remove('hidden');
        el.freePlayUi.classList.add('hidden');
        const prompts = [
            "Clear the abacus to start!",
            `Move 2 beads to the left on the top row (Ones).`,
            "Now add 2 more beads to the left.",
            "Well done! 2 plus 2 equals 4!"
        ];
        el.lessonText.textContent = prompts[state.lessonStep] || "";
    } else {
        el.lessonUi.classList.add('hidden');
        el.freePlayUi.classList.remove('hidden');
    }
}

// --- Abacus SVG Engine ---
function renderAbacus() {
    el.svg.innerHTML = '';
    
    // Defs
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
        <linearGradient id="rodGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#999"/><stop offset="50%" stop-color="#fff"/><stop offset="100%" stop-color="#666"/></linearGradient>
        <filter id="beadShadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dx="2" dy="2"/><feComponentTransfer><feFuncA type="linear" slope="0.4"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    `;
    el.svg.appendChild(defs);

    // Frame (Inner dark area)
    const frame = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    frame.setAttribute('x', PADDING/2);
    frame.setAttribute('y', PADDING/2);
    frame.setAttribute('width', SVG_WIDTH - PADDING);
    frame.setAttribute('height', SVG_HEIGHT - PADDING);
    frame.setAttribute('fill', '#331a00');
    frame.setAttribute('rx', '10');
    el.svg.appendChild(frame);

    const rodSpacing = (SVG_HEIGHT - PADDING * 2) / 4;

    state.counts.forEach((count, rowIdx) => {
        const y = PADDING + rowIdx * rodSpacing + rodSpacing/2;
        
        // Rod
        const rod = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rod.setAttribute('x', PADDING);
        rod.setAttribute('y', y - ROD_T/2);
        rod.setAttribute('width', SVG_WIDTH - PADDING * 2);
        rod.setAttribute('height', ROD_T);
        rod.setAttribute('fill', 'url(#rodGrad)');
        rod.setAttribute('rx', '4');
        el.svg.appendChild(rod);

        // Rod Name label (Faint)
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute('x', PADDING + 10);
        label.setAttribute('y', y - 15);
        label.setAttribute('fill', 'rgba(255,255,255,0.3)');
        label.setAttribute('font-size', '12');
        label.setAttribute('font-weight', 'bold');
        label.textContent = COLS[rowIdx].toUpperCase();
        el.svg.appendChild(label);

        // Interaction Hitbox
        const hitbox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        hitbox.setAttribute('x', PADDING);
        hitbox.setAttribute('y', y - rodSpacing/2);
        hitbox.setAttribute('width', SVG_WIDTH - PADDING * 2);
        hitbox.setAttribute('height', rodSpacing);
        hitbox.setAttribute('fill', 'transparent');
        hitbox.style.cursor = 'pointer';
        hitbox.addEventListener('pointerdown', (e) => onRodInteraction(e, rowIdx));
        el.svg.appendChild(hitbox);

        // Beads
        for (let i = 0; i < 10; i++) {
            const isOnLeft = i < count;
            const tx = isOnLeft 
                ? PADDING + EXTRA_LEFT + i * SLOT_W 
                : SVG_WIDTH - PADDING - (10 - i) * SLOT_W;

            const bead = document.createElementNS("http://www.w3.org/2000/svg", "g");
            bead.setAttribute('transform', `translate(${tx}, ${y - BEAD_H/2})`);
            bead.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)';
            bead.innerHTML = `
                <rect width="${BEAD_W}" height="${BEAD_H}" fill="${COLORS[rowIdx]}" rx="8" filter="url(#beadShadow)"/>
                <rect x="5" y="4" width="${BEAD_W - 10}" height="4" fill="white" fill-opacity="0.2" rx="2"/>
            `;
            // Click on specific bead
            bead.onclick = (e) => {
                e.stopPropagation();
                if (state.isCarrying) return;
                const newCount = isOnLeft ? i : i + 1;
                updateCount(rowIdx, newCount);
            };

            el.svg.appendChild(bead);
        }
    });
}

function onRodInteraction(e, rowIdx) {
    if (state.isCarrying) return;
    initAudio();
    const rect = el.svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SVG_WIDTH;

    // Logic: find nearest count boundary
    // Approximate boundaries: beads on left vs beads on right
    // Simple logic: if click is near left side, set count based on X
    const leftStart = PADDING + EXTRA_LEFT;
    const rightEnd = SVG_WIDTH - PADDING;
    
    // Determine if user clicked a side
    let newCount = state.counts[rowIdx];
    if (x < SVG_WIDTH / 2) {
        // Left side clicks
        const relX = x - leftStart;
        newCount = Math.max(0, Math.min(10, Math.ceil(relX / SLOT_W)));
    } else {
        // Right side clicks
        const relX = x - (rightEnd - 10 * SLOT_W);
        newCount = Math.max(0, Math.min(10, Math.floor(relX / SLOT_W)));
    }

    if (newCount !== state.counts[rowIdx]) {
        updateCount(rowIdx, newCount);
    }
}

function updateCount(row, val) {
    if (state.isCarrying) return;
    const old = state.counts[row];
    state.counts[row] = val;
    if (old !== val) {
        playClack(row);
        checkCarry();
        renderApp();
        provideFeedback(row);
    }
}

function checkCarry() {
    for (let i = 0; i < 3; i++) {
        if (state.counts[i] >= 10) {
            state.isCarrying = true;
            setTimeout(() => {
                state.counts[i] = 0;
                state.counts[i + 1] += 1;
                state.isCarrying = false;
                playClack(i + 1);
                if (state.voice) speak("Ten ones carry to the next row!");
                checkCarry(); // Nested carries
                renderApp();
            }, 500);
            break;
        }
    }
}

function provideFeedback(changedRow) {
    const total = state.counts.reduce((sum, count, idx) => sum + count * MULTIPLIERS[idx], 0);
    
    let text = "";
    if (state.chatty === 'Quiet') {
        text = `Total is ${total}.`;
    } else {
        text = `${state.user}, you have ${state.counts[changedRow]} on the ${COLS[changedRow].toLowerCase()} column. `;
        text += `That makes ${total} altogether.`;
        if (state.chatty === 'Chatty' && Math.random() > 0.6) {
            const phrases = ["Great counting!", "You are doing brilliant!", "Maths is fun!", "Well done!"];
            text += " " + phrases[Math.floor(Math.random() * phrases.length)];
        }
    }

    el.feedback.textContent = `"${text}"`;
    if (state.voice) speak(text);
}

function resetAbacus() {
    state.counts = [0, 0, 0, 0];
    state.lesson = null;
    playClack(0);
    if (state.voice) speak("Abacus cleared.");
    renderApp();
}

// --- Lesson Logic ---
function startLesson() {
    resetAbacus();
    state.lesson = '2plus2';
    state.lessonStep = 0;
    renderApp();
    speak("Let's learn 2 plus 2. First, clear the abacus.");
}

function quitLesson() {
    state.lesson = null;
    renderApp();
}

function checkLesson() {
    if (state.lesson === '2plus2') {
        if (state.lessonStep === 0) {
            const isClear = state.counts.every(c => c === 0);
            if (isClear) {
                state.lessonStep = 1;
                speak("Brilliant. Step one: move 2 beads on the Ones column.");
            } else {
                speak("Not quite. Move everything to the right first.");
            }
        } else if (state.lessonStep === 1) {
            if (state.counts[0] === 2) {
                state.lessonStep = 2;
                speak("Perfect. Now add 2 more beads on the same column.");
            } else {
                speak("You need to move exactly 2 beads.");
            }
        } else if (state.lessonStep === 2) {
            if (state.counts[0] === 4) {
                state.lessonStep = 3;
                speak("Well done! 2 plus 2 equals 4. You are a maths star!");
            } else {
                speak("Count again! We want 4 on the left.");
            }
        } else if (state.lessonStep === 3) {
            state.lesson = null;
            speak("Lesson complete!");
        }
    }
    renderApp();
}

// Start
init();