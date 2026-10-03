// Forza Horizon Telemetry Dashboard Client

// DOM Elements
const shiftLightsBar = document.getElementById('shift-lights-bar');
const leds = document.querySelectorAll('.led');
const connPill = document.getElementById('conn-pill');
const connText = document.getElementById('conn-text');
const speedDisplay = document.getElementById('speed-display');
const gearDisplay = document.getElementById('gear-display');
const rpmDisplay = document.getElementById('rpm-display');
const throttleFill = document.getElementById('throttle-fill');
const brakeFill = document.getElementById('brake-fill');
const clutchFill = document.getElementById('clutch-fill');
const boostDisplay = document.getElementById('boost-display');
const boostFill = document.getElementById('boost-fill');
const tempFL = document.getElementById('temp-fl');
const tempFR = document.getElementById('temp-fr');
const tempRL = document.getElementById('temp-rl');
const tempRR = document.getElementById('temp-rr');
const shiftBanner = document.getElementById('shift-banner');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnDemo = document.getElementById('btn-demo');

// State
let isConnected = false;
let isDemoMode = false;
let demoInterval = null;
let lastShiftVibrate = 0;

// Screen WakeLock to keep mobile screen awake
async function enableWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            await navigator.wakeLock.request('screen');
            console.log('💡 Screen WakeLock Active!');
        }
    } catch (err) {
        console.warn('WakeLock not granted:', err);
    }
}
enableWakeLock();
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') enableWakeLock();
});

// Fullscreen Handler
btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        btnFullscreen.textContent = 'EXIT';
    } else {
        document.exitFullscreen().catch(() => {});
        btnFullscreen.textContent = '⛶ FULLSCREEN';
    }
});

// Double tap anywhere to toggle fullscreen
document.addEventListener('dblclick', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    }
});

// WebSocket Connection
function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        isConnected = true;
        updateConnectionStatus(true);
    };

    ws.onmessage = (event) => {
        if (isDemoMode) return;
        try {
            const data = JSON.parse(event.data);
            updateDashboard(data);
        } catch (e) {}
    };

    ws.onclose = () => {
        isConnected = false;
        updateConnectionStatus(false);
        setTimeout(connectWebSocket, 1500);
    };

    ws.onerror = () => {
        ws.close();
    };
}

function updateConnectionStatus(online) {
    if (online) {
        connPill.className = 'pill-online';
        connText.textContent = 'LIVE TELEMETRY ACTIVE';
    } else {
        connPill.className = 'pill-waiting';
        connText.textContent = isDemoMode ? 'DEMO MODE ACTIVE' : 'WAITING FOR FORZA...';
    }
}

// Gear Formatter
function formatGear(gear) {
    if (gear === 0) return 'R';
    if (gear === undefined || gear === null) return 'N';
    return gear.toString();
}

// Update Dashboard View
function updateDashboard(data) {
    const speed = data.speed || 0;
    const rpm = data.rpm || 0;
    const maxRpm = data.maxRpm || 8500;
    const gear = data.gear;
    const boost = data.boost || 0;
    const accel = data.accel || 0;
    const brake = data.brake || 0;
    const clutch = data.clutch || 0;
    const tireTemps = data.tireTemps || [0, 0, 0, 0];

    // Numbers
    speedDisplay.textContent = Math.round(speed);
    gearDisplay.textContent = formatGear(gear);
    rpmDisplay.textContent = Math.round(rpm);

    // Shift Lights (16 LEDs)
    const rpmRatio = Math.min(1.0, Math.max(0, rpm / maxRpm));
    const activeLedCount = Math.floor(rpmRatio * 16);
    leds.forEach((led, i) => {
        if (i < activeLedCount) {
            led.classList.add('active');
        } else {
            led.classList.remove('active');
        }
    });

    // Redline Strobe & Shift Warning (> 92% of RPM)
    const isRedline = rpmRatio >= 0.92;
    if (isRedline) {
        shiftLightsBar.classList.add('strobe-flash');
        shiftBanner.classList.remove('hidden');

        // Phone Haptic Vibration (DualSense / Shift feel)
        const now = Date.now();
        if (now - lastShiftVibrate > 350 && 'vibrate' in navigator) {
            navigator.vibrate(35);
            lastShiftVibrate = now;
        }
    } else {
        shiftLightsBar.classList.remove('strobe-flash');
        shiftBanner.classList.add('hidden');
    }

    // Pedals
    throttleFill.style.height = `${accel * 100}%`;
    brakeFill.style.height = `${brake * 100}%`;
    clutchFill.style.height = `${clutch * 100}%`;

    // Boost (assume max 30 PSI)
    boostDisplay.textContent = boost.toFixed(1);
    const boostRatio = Math.min(1.0, Math.max(0, boost / 30));
    boostFill.style.width = `${boostRatio * 100}%`;

    // Tires
    applyTireTemp(tempFL, tireTemps[0]);
    applyTireTemp(tempFR, tireTemps[1]);
    applyTireTemp(tempRL, tireTemps[2]);
    applyTireTemp(tempRR, tireTemps[3]);
}

function applyTireTemp(element, temp) {
    if (!temp || temp <= 0) {
        element.textContent = '--';
        element.style.color = '#64748b';
        return;
    }
    element.textContent = temp;
    if (temp < 60) {
        element.style.color = '#00f0ff'; // cold blue
    } else if (temp < 95) {
        element.style.color = '#00ff66'; // optimal green
    } else if (temp < 115) {
        element.style.color = '#ffaa00'; // warm orange
    } else {
        element.style.color = '#ff1744'; // hot red
    }
}

// Demo / Test Mode Loop
btnDemo.addEventListener('click', () => {
    isDemoMode = !isDemoMode;
    btnDemo.textContent = isDemoMode ? 'STOP DEMO' : '⚡ DEMO MODE';

    if (isDemoMode) {
        updateConnectionStatus(false);
        runDemoSimulation();
    } else {
        if (demoInterval) clearInterval(demoInterval);
        updateDashboard({ speed: 0, rpm: 0, gear: 0, accel: 0, brake: 0 });
    }
});

function runDemoSimulation() {
    let currentRpm = 1000;
    let maxRpm = 8800;
    let gear = 1;
    let speed = 0;
    let accel = 1.0;
    let brake = 0;
    let boost = 0;

    demoInterval = setInterval(() => {
        if (gear <= 6) {
            currentRpm += 160;
            speed += (1.4 / gear);
            boost = Math.min(22.5, currentRpm / 350);

            if (currentRpm >= maxRpm) {
                // Shift up!
                gear++;
                currentRpm = 5200;
            }
        } else {
            // Braking cycle
            accel = 0;
            brake = 0.95;
            boost = 0;
            speed = Math.max(0, speed - 3.5);
            currentRpm = Math.max(900, currentRpm - 200);
            if (speed <= 5) {
                gear = 1;
                accel = 1.0;
                brake = 0;
            }
        }

        updateDashboard({
            speed: speed,
            rpm: currentRpm,
            maxRpm: maxRpm,
            gear: gear,
            accel: accel,
            brake: brake,
            clutch: currentRpm > maxRpm - 200 ? 0.8 : 0,
            boost: boost,
            tireTemps: [82, 84, 88, 87]
        });
    }, 25);
}

// Start
connectWebSocket();
