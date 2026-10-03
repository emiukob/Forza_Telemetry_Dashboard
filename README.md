# 🏎️ Forza Horizon & Motorsport Telemetry Dashboard

A real-time, low-latency **60Hz UDP Telemetry Dashboard & Digital Cockpit** designed for **Forza Horizon 4 / 5** and **Forza Motorsport**.

It reads raw UDP telemetry data packets transmitted by the game, processes vehicle physics and engine metrics in real-time, and streams them via WebSockets to an ultra-responsive web dashboard optimized for mobile phones, tablets, and secondary monitors.

---

## ✨ Features

- 🚥 **16-Stage F1 / GT3 LED Shift Lights:** Color-coded shift indicator (Green ➔ Amber ➔ Red ➔ Blue) with high-intensity strobe flash at redline.
- ⚡ **Real-Time Digital Instrument Cluster:**
  - Precision Digital Speedometer (km/h)
  - Giant Sequential Gear Display (R / N / 1–6+)
  - Engine Tachometer (RPM & Redline Warning)
  - Throttle, Brake, and Clutch input pressure bars
  - Real-time Turbo Boost gauge (PSI)
  - **4-Wheel Independent Tire Temperature Heatmap** (°C with dynamic cold/optimal/hot color scaling)
- 📳 **Haptic Feedback:** Vibrates mobile devices when reaching optimal shift points.
- 📱 **Screen Wake Lock:** Prevents phone or tablet screens from dimming or locking during races.
- 🖥️ **Full-Screen Cockpit Mode:** One-tap toggle for an immersive standalone display.
- 🔄 **Built-in 60Hz Physics Simulator:** Test and demo the entire cockpit without launching the game.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16.0.0 or later)
- Forza Horizon 4 / 5 or Forza Motorsport

### 2. Installation
```bash
git clone https://github.com/emiukob/Forza_Telemetry_Dashboard.git
cd Forza_Telemetry_Dashboard
npm install
```

### 3. Launch Server
```bash
npm start
```

> The server will automatically detect your local IP address and print a **QR Code** directly in your terminal. Scan the QR code with your smartphone camera or navigate to `http://<YOUR_LOCAL_IP>:8080` in any web browser.

---

## ⚙️ In-Game Configuration (Forza)

1. Launch **Forza Horizon 4/5** or **Forza Motorsport**.
2. Navigate to **Settings > HUD and Gameplay**.
3. Scroll down to the bottom and configure the following:
   - **Data Out:** `ON`
   - **Data Out IP Address:** `Your PC's Local IP` *(e.g., 192.168.1.xxx)* or `127.0.0.1` (if running on the same machine)
   - **Data Out IP Port:** `5300`
4. Save settings and start driving!

---

## 🧪 Testing Without the Game (Built-in Simulator)

You can run the standalone 60Hz physics telemetry simulator to test and demo the dashboard anytime:

```bash
npm run sim
```

This generates realistic telemetry packets (acceleration runs, gear shifts, braking heat buildup, boost curves) and broadcasts them directly to the server.

---

## 🛠️ Architecture & Tech Stack

- **Backend:** Node.js, `dgram` (UDP 60Hz Socket), `ws` (WebSocket Server), `http`, `qrcode`
- **Frontend:** Vanilla HTML5, CSS3 (Hardware-accelerated CSS Animations), JavaScript (WebSocket Client, Screen WakeLock API, Vibration API)
- **Protocol:** Forza Data Out Dash Format (324-byte UDP structure)

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
