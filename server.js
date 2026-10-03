const dgram = require('dgram');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const QRCode = require('qrcode');

// Ports
const UDP_PORT = 5300;   // Forza sends telemetry here
const HTTP_PORT = 8080;  // Devices connect to dashboard here

// Detect local IPv4 address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal && !name.toLowerCase().includes('tailscale') && !name.toLowerCase().includes('virtual') && !name.toLowerCase().includes('wsl')) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const LOCAL_IP = getLocalIP();
const DASHBOARD_URL = `http://${LOCAL_IP}:${HTTP_PORT}`;

// Static File Server
const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';

    if (reqUrl === '/qr') {
        QRCode.toBuffer(DASHBOARD_URL, { margin: 1, width: 260 }, (err, buffer) => {
            if (err) {
                res.writeHead(500);
                res.end('QR Code generation failed');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(buffer);
        });
        return;
    }

    if (reqUrl === '/api/info') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ip: LOCAL_IP, port: HTTP_PORT, udpPort: UDP_PORT, url: DASHBOARD_URL }));
        return;
    }

    const filePath = path.join(__dirname, 'public', reqUrl);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

// WebSocket Server
const wss = new WebSocket.Server({ server });
let clientCount = 0;

wss.on('connection', (ws) => {
    clientCount++;
    console.log(`📱 Device connected to dashboard! (Active clients: ${clientCount})`);

    ws.on('close', () => {
        clientCount = Math.max(0, clientCount - 1);
    });
});

function broadcast(data) {
    if (clientCount === 0) return;
    const msg = JSON.stringify(data);
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    }
}

// Forza Telemetry UDP Listener
const udpSocket = dgram.createSocket('udp4');

let lastPacketTime = 0;
let isReceivingForza = false;

udpSocket.on('error', (err) => {
    console.error('UDP Socket error:', err);
});

udpSocket.on('message', (buf, rinfo) => {
    lastPacketTime = Date.now();
    if (!isReceivingForza) {
        isReceivingForza = true;
        console.log(`\n🏎️ FORZA TELEMETRY DATA DETECTED! Receiving stream from ${rinfo.address}:${rinfo.port}`);
    }

    // Packet must be at least 232 bytes (standard Forza data format)
    if (buf.length < 232) return;

    try {
        const isRaceOn = buf.readInt32LE(0);
        const engineMaxRpm = buf.readFloatLE(8);
        const engineIdleRpm = buf.readFloatLE(12);
        const currentEngineRpm = buf.readFloatLE(16);

        const vx = buf.readFloatLE(32);
        const vy = buf.readFloatLE(36);
        const vz = buf.readFloatLE(40);
        const calculatedSpeed = Math.hypot(vx, vy, vz) * 3.6;

        let speed = calculatedSpeed;
        let gear = 0;
        let boost = 0;
        let accel = 0;
        let brake = 0;
        let clutch = 0;
        let handbrake = 0;
        let tireTempFL = 0;
        let tireTempFR = 0;
        let tireTempRL = 0;
        let tireTempRR = 0;

        // If dash format (311+ bytes)
        if (buf.length >= 311) {
            if (buf.length >= 260) {
                const dashSpeed = buf.readFloatLE(256) * 3.6;
                if (!isNaN(dashSpeed) && dashSpeed > 0) speed = dashSpeed;
            }
            if (buf.length >= 284) {
                tireTempFL = buf.readFloatLE(268);
                tireTempFR = buf.readFloatLE(272);
                tireTempRL = buf.readFloatLE(276);
                tireTempRR = buf.readFloatLE(280);
            }
            if (buf.length >= 288) boost = buf.readFloatLE(284);
            if (buf.length >= 320) {
                accel = buf.readUInt8(315) / 255;
                brake = buf.readUInt8(316) / 255;
                clutch = buf.readUInt8(317) / 255;
                handbrake = buf.readUInt8(318);
                gear = buf.readUInt8(319);
            }
        }

        const telemetry = {
            isRaceOn: isRaceOn !== 0,
            speed: Math.round(speed),
            rpm: Math.round(currentEngineRpm),
            maxRpm: Math.round(engineMaxRpm > 1000 ? engineMaxRpm : 8000),
            idleRpm: Math.round(engineIdleRpm),
            gear: gear, // 0 = R, 1 = 1st, 2 = 2nd, etc.
            boost: +(boost).toFixed(1),
            accel: +(accel).toFixed(2),
            brake: +(brake).toFixed(2),
            clutch: +(clutch).toFixed(2),
            tireTemps: [
                Math.round(tireTempFL),
                Math.round(tireTempFR),
                Math.round(tireTempRL),
                Math.round(tireTempRR)
            ],
            source: 'forza'
        };

        broadcast(telemetry);
    } catch (e) {
        // Silently ignore corrupted packets
    }
});

udpSocket.bind(UDP_PORT, '0.0.0.0', () => {
    console.log(`\n================================================================`);
    console.log(`🏁 FORZA TELEMETRY DASHBOARD SERVER RUNNING`);
    console.log(`================================================================`);
    console.log(`📡 UDP Telemetry Listening On : 0.0.0.0:${UDP_PORT}`);
    console.log(`📱 Phone Dashboard Web Link   : ${DASHBOARD_URL}`);
    console.log(`----------------------------------------------------------------`);
    console.log(`\n⚙️  FORZA IN-GAME CONFIGURATION (HUD & GAMEPLAY):`);
    console.log(`   1. Data Out                      : ON`);
    console.log(`   2. Data Out IP Address           : ${LOCAL_IP} (or 127.0.0.1)`);
    console.log(`   3. Data Out IP Port              : ${UDP_PORT}`);
    console.log(`================================================================\n`);
});

server.listen(HTTP_PORT, '0.0.0.0', () => {
    QRCode.toString(DASHBOARD_URL, { type: 'terminal', small: true }, (err, qr) => {
        if (!err) {
            console.log('📲 Scan this QR code with your mobile camera to open the dashboard:\n');
            console.log(qr);
        }
    });
});
