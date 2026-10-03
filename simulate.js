/**
 * Forza Horizon / Motorsport Telemetry UDP Simulator
 * 
 * Generates realistic 60Hz Forza "Dash" format (324 bytes) UDP packets
 * and sends them to 127.0.0.1:5300 to test the Telemetry Dashboard in real-time.
 */

const dgram = require('dgram');
const readline = require('readline');

// Target configuration
const TARGET_HOST = process.env.FORZA_HOST || '127.0.0.1';
const TARGET_PORT = parseInt(process.env.FORZA_PORT || '5300', 10);
const TICK_RATE_HZ = 60; // Standard Forza telemetry tick rate
const INTERVAL_MS = 1000 / TICK_RATE_HZ;

const client = dgram.createSocket('udp4');

// Car Specifications
const IDLE_RPM = 950;
const MAX_RPM = 8600;
const SHIFT_RPM = 8150;
const MAX_BOOST_PSI = 22.5;

// Gear speed ranges (km/h max per gear)
const GEAR_MAX_SPEED = {
    1: 68,
    2: 114,
    3: 165,
    4: 218,
    5: 270,
    6: 320
};

// Simulation State
let state = {
    speed: 0,        // km/h
    rpm: IDLE_RPM,
    gear: 1,         // 0: R, 1: 1st, ...
    boost: 0,        // PSI
    accel: 0,        // 0.0 - 1.0
    brake: 0,        // 0.0 - 1.0
    clutch: 0,       // 0.0 - 1.0
    handbrake: 0,
    tireTemps: [72, 72, 70, 70], // FL, FR, RL, RR (°C)
    isShifting: false,
    shiftTimer: 0,
    phase: 'ACCELERATING', // ACCELERATING, TOP_SPEED, BRAKING, CORNERING
    phaseTimer: 0,
    packetCount: 0,
    startTime: Date.now()
};

/**
 * Encodes telemetry data into 324-byte standard Forza Dash UDP packet
 */
function createForzaPacket(data) {
    const buf = Buffer.alloc(324);

    // 0: IsRaceOn (s32)
    buf.writeInt32LE(1, 0);

    // 4: TimestampMS (u32)
    buf.writeUInt32LE((Date.now() - state.startTime) & 0xFFFFFFFF, 4);

    // 8: EngineMaxRpm (f32)
    buf.writeFloatLE(MAX_RPM, 8);

    // 12: EngineIdleRpm (f32)
    buf.writeFloatLE(IDLE_RPM, 12);

    // 16: CurrentEngineRpm (f32)
    buf.writeFloatLE(Math.max(IDLE_RPM, data.rpm), 16);

    // 32, 36, 40: VelocityX, VelocityY, VelocityZ (f32)
    const speedMs = data.speed / 3.6;
    buf.writeFloatLE(0.0, 32);
    buf.writeFloatLE(0.0, 36);
    buf.writeFloatLE(speedMs, 40);

    // 256: Dash Speed in m/s (f32)
    buf.writeFloatLE(speedMs, 256);

    // 268, 272, 276, 280: Tire temperatures FL, FR, RL, RR (f32)
    buf.writeFloatLE(data.tireTemps[0], 268);
    buf.writeFloatLE(data.tireTemps[1], 272);
    buf.writeFloatLE(data.tireTemps[2], 276);
    buf.writeFloatLE(data.tireTemps[3], 280);

    // 284: Boost in PSI (f32)
    buf.writeFloatLE(data.boost, 284);

    // 315: Accel (u8 0-255)
    buf.writeUInt8(Math.min(255, Math.max(0, Math.round(data.accel * 255))), 315);

    // 316: Brake (u8 0-255)
    buf.writeUInt8(Math.min(255, Math.max(0, Math.round(data.brake * 255))), 316);

    // 317: Clutch (u8 0-255)
    buf.writeUInt8(Math.min(255, Math.max(0, Math.round(data.clutch * 255))), 317);

    // 318: HandBrake (u8)
    buf.writeUInt8(data.handbrake ? 1 : 0, 318);

    // 319: Gear (u8: 0=R, 1=1st, 2=2nd, ...)
    buf.writeUInt8(data.gear, 319);

    return buf;
}

/**
 * Updates vehicle simulation physics
 */
function updatePhysics(dt) {
    state.phaseTimer += dt;

    switch (state.phase) {
        case 'ACCELERATING': {
            state.accel = 1.0;
            state.brake = 0.0;
            state.handbrake = 0;

            if (state.isShifting) {
                state.shiftTimer -= dt;
                state.clutch = 1.0;
                state.boost = Math.max(0, state.boost - dt * 45); // Blow-off valve
                state.rpm = Math.max(IDLE_RPM, state.rpm - dt * 18000);

                if (state.shiftTimer <= 0) {
                    state.isShifting = false;
                    state.clutch = 0.0;
                }
            } else {
                state.clutch = 0.0;
                // Boost builds up
                state.boost = Math.min(MAX_BOOST_PSI, state.boost + dt * 28);

                // Acceleration rate depends on gear
                const accelRate = (7 - state.gear) * 11.5; 
                state.speed += accelRate * dt;

                // RPM calculated based on current gear speed ratio
                const prevGearMax = state.gear > 1 ? GEAR_MAX_SPEED[state.gear - 1] : 0;
                const currGearMax = GEAR_MAX_SPEED[state.gear];
                const gearProgress = Math.max(0, Math.min(1, (state.speed - prevGearMax * 0.7) / (currGearMax - prevGearMax * 0.7)));
                
                state.rpm = IDLE_RPM + gearProgress * (SHIFT_RPM - IDLE_RPM + 350);

                // Tire heat slightly rises under acceleration
                state.tireTemps[2] = Math.min(95, state.tireTemps[2] + dt * 0.8);
                state.tireTemps[3] = Math.min(95, state.tireTemps[3] + dt * 0.8);

                // Upshift trigger
                if (state.rpm >= SHIFT_RPM) {
                    if (state.gear < 6) {
                        state.gear++;
                        state.isShifting = true;
                        state.shiftTimer = 0.12; // 120ms quick shift
                    } else {
                        // Reached top speed in 6th gear!
                        state.phase = 'TOP_SPEED';
                        state.phaseTimer = 0;
                    }
                }
            }
            break;
        }

        case 'TOP_SPEED': {
            state.accel = 0.95;
            state.brake = 0.0;
            state.clutch = 0.0;
            state.boost = MAX_BOOST_PSI - 1.5;
            state.rpm = 8400 + Math.sin(Date.now() / 80) * 80; // Rev bounce near limiter
            state.speed = 312 + Math.sin(Date.now() / 200) * 2;

            if (state.phaseTimer > 2.5) {
                state.phase = 'BRAKING';
                state.phaseTimer = 0;
            }
            break;
        }

        case 'BRAKING': {
            state.accel = 0.0;
            state.brake = 0.95;
            state.clutch = 0.0;
            state.boost = Math.max(0, state.boost - dt * 30);

            // Rapid deceleration
            const decelRate = 85; // km/h per sec
            state.speed = Math.max(35, state.speed - decelRate * dt);

            // Brakes get hot!
            state.tireTemps[0] = Math.min(118, state.tireTemps[0] + dt * 7.5);
            state.tireTemps[1] = Math.min(118, state.tireTemps[1] + dt * 7.5);
            state.tireTemps[2] = Math.min(105, state.tireTemps[2] + dt * 4.0);
            state.tireTemps[3] = Math.min(105, state.tireTemps[3] + dt * 4.0);

            // Downshifting
            if (state.gear > 2 && state.speed < GEAR_MAX_SPEED[state.gear - 1] * 0.85) {
                state.gear--;
                state.rpm = 6500; // Rev match blip
            } else {
                state.rpm = Math.max(IDLE_RPM + 800, (state.speed / GEAR_MAX_SPEED[state.gear]) * 7500);
            }

            if (state.speed <= 45 || state.phaseTimer > 3.8) {
                state.phase = 'CORNERING';
                state.phaseTimer = 0;
                state.gear = 2;
            }
            break;
        }

        case 'CORNERING': {
            // Apex speed maintenance and power-out
            state.brake = 0.0;
            state.accel = 0.45 + (state.phaseTimer / 2.0) * 0.55;
            state.speed = 45 + (state.phaseTimer / 2.0) * 40;
            state.rpm = IDLE_RPM + (state.speed / GEAR_MAX_SPEED[2]) * 6500;
            state.boost = Math.min(15, state.phaseTimer * 8);

            // Lateral tire scrub heat on outer tires
            state.tireTemps[1] = Math.min(110, state.tireTemps[1] + dt * 2.5);
            state.tireTemps[3] = Math.min(100, state.tireTemps[3] + dt * 2.0);
            // Inner tires cool down
            state.tireTemps[0] = Math.max(68, state.tireTemps[0] - dt * 1.5);
            state.tireTemps[2] = Math.max(65, state.tireTemps[2] - dt * 1.5);

            if (state.phaseTimer > 2.0) {
                state.phase = 'ACCELERATING';
                state.phaseTimer = 0;
            }
            break;
        }
    }
}

// Terminal UI rendering
let lastTerminalUpdate = 0;

function drawDashboardUI() {
    const now = Date.now();
    if (now - lastTerminalUpdate < 100) return; // 10 FPS console refresh
    lastTerminalUpdate = now;

    const rpmPercent = Math.min(1, Math.max(0, state.rpm / MAX_RPM));
    const rpmBarLen = 30;
    const filledLen = Math.round(rpmPercent * rpmBarLen);
    const rpmBar = '█'.repeat(filledLen) + '░'.repeat(rpmBarLen - filledLen);

    const isShiftZone = state.rpm >= SHIFT_RPM;
    const shiftWarning = isShiftZone ? '\x1b[41m\x1b[37m  SHIFT!  \x1b[0m' : '          ';

    const throttleBar = '█'.repeat(Math.round(state.accel * 10)).padEnd(10, '░');
    const brakeBar = '█'.repeat(Math.round(state.brake * 10)).padEnd(10, '░');

    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);

    console.log(`\x1b[36m====================================================================\x1b[0m`);
    console.log(`\x1b[1m\x1b[33m 🏎️  FORZA HORIZON TELEMETRY UDP SIMULATOR (60 Hz)\x1b[0m`);
    console.log(`\x1b[36m====================================================================\x1b[0m`);
    console.log(`📡 Target Host   : \x1b[32m${TARGET_HOST}:${TARGET_PORT}\x1b[0m`);
    console.log(`📦 Packets Sent  : \x1b[35m${state.packetCount}\x1b[0m | State: \x1b[33m${state.phase}\x1b[0m`);
    console.log(`--------------------------------------------------------------------`);
    console.log(` ⚙️  GEAR    : \x1b[1m\x1b[32m[ ${state.gear} ]\x1b[0m  ${shiftWarning}  SPEED: \x1b[1m\x1b[37m${Math.round(state.speed).toString().padStart(3, ' ')} km/h\x1b[0m`);
    console.log(` ⚡ RPM     : \x1b[33m${Math.round(state.rpm).toString().padStart(4, ' ')} / ${MAX_RPM}\x1b[0m [${isShiftZone ? '\x1b[31m' : '\x1b[32m'}${rpmBar}\x1b[0m]`);
    console.log(` 💨 TURBO   : \x1b[36m${state.boost.toFixed(1).padStart(4, ' ')} PSI\x1b[0m`);
    console.log(` 🟢 THROTTLE: [${throttleBar}] ${(state.accel * 100).toFixed(0).padStart(3, ' ')}%`);
    console.log(` 🔴 BRAKE   : [${brakeBar}] ${(state.brake * 100).toFixed(0).padStart(3, ' ')}%`);
    console.log(`--------------------------------------------------------------------`);
    console.log(` 🛞 TIRE TEMPERATURES:`);
    console.log(`    FRONT LEFT : ${formatTemp(state.tireTemps[0])}   |   FRONT RIGHT: ${formatTemp(state.tireTemps[1])}`);
    console.log(`    REAR LEFT  : ${formatTemp(state.tireTemps[2])}   |   REAR RIGHT : ${formatTemp(state.tireTemps[3])}`);
    console.log(`--------------------------------------------------------------------`);
    console.log(`💡 \x1b[90mPress Ctrl + C to stop the simulator.\x1b[0m`);
}

function formatTemp(temp) {
    const t = Math.round(temp);
    if (t < 75) return `\x1b[36m${t}°C (Cold)\x1b[0m`;
    if (t < 100) return `\x1b[32m${t}°C (Optimal)\x1b[0m`;
    return `\x1b[31m${t}°C (Hot!)\x1b[0m`;
}

// 60Hz Simulation Loop
console.clear();
console.log(`🚀 Starting Forza Telemetry Simulator: ${TARGET_HOST}:${TARGET_PORT}...`);

const loop = setInterval(() => {
    updatePhysics(INTERVAL_MS / 1000);
    const packet = createForzaPacket(state);

    client.send(packet, 0, packet.length, TARGET_PORT, TARGET_HOST, (err) => {
        if (err) {
            console.error('UDP Transmission Error:', err);
        } else {
            state.packetCount++;
        }
    });

    drawDashboardUI();
}, INTERVAL_MS);

// Handle Clean Exit
process.on('SIGINT', () => {
    clearInterval(loop);
    client.close();
    console.log(`\n\n🛑 Simulator stopped. Broadcasted ${state.packetCount} UDP packets.`);
    process.exit(0);
});
