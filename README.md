# 🏎️ Forza Telemetry Dashboard & Digital Cockpit

Forza Horizon 4/5 ve Forza Motorsport serisinden **UDP 60Hz** protokolü ile gelen gerçek zamanlı yarış telemetri verilerini okuyan, işleyen ve yerel ağınızdaki herhangi bir telefon, tablet veya tarayıcıda yarış kokpiti gibi gösteren canlı telemetri paneli.

---

## ✨ Özellikler

- 🚥 **16 Kademeli F1/GT3 LED Shift Lights:** Motor devrine göre renk değiştiren (Yeşil, Sarı, Kırmızı, Mavi) ve redline sınırında stroboskopik yanıp sönen ışıklar.
- ⚡ **Hızlı Telemetri Göstergeleri:**
  - Anlık Dijital Hız (km/h)
  - Büyük Vites Göstergesi (R / N / 1-6+)
  - Hassas Devir (RPM)
  - Gaz, Fren ve Debriyaj basınç barları
  - Gerçek zamanlı Turbo Boost (PSI)
  - 4 Teker Bağımsız Lastik Sıcaklıkları (°C Renk Kodlu Isı Haritası)
- 📳 **Haptik Titreşim:** Vites atma noktasında (Shift Warning) mobil cihazlarda titreşim desteği.
- 📱 **Ekran Uyanık Tutma (Wake Lock):** Telefon ekranının yarış esnasında otomatik kapanmasını engeller.
- 🖥️ **Tam Ekran Desteği:** Tek dokunuşla tam ekran yarış kokpiti deneyimi.
- 🔄 **Dahili 60Hz Simülatör & Test Modu:** Forza oyunu açık olmasa bile panel veya terminal üzerinden tüm sürüş dinamiklerini test etme imkânı.

---

## 🚀 Hızlı Başlangıç

### 1. Gereksinimler
- [Node.js](https://nodejs.org/) (v16 veya üzeri)
- Forza Horizon 4 / 5 veya Forza Motorsport

### 2. Kurulum
```bash
git clone https://github.com/emiukob/Forza_Telemetry_Dashboard.git
cd Forza_Telemetry_Dashboard
npm install
```

### 3. Çalıştırma
```bash
npm start
```
> Terminalde oluşturulan **QR kodu** telefonunuzun kamerasıyla okutarak veya gösterilen yerel IP adresine (`http://192.168.x.x:8080`) tarayıcınızdan bağlanabilirsiniz.

---

## ⚙️ Forza Oyun İçi Ayarları

1. Oyunu açın ve **Ayarlar (Settings) > HUD ve Oynanış (HUD and Gameplay)** menüsüne gidin.
2. Sayfanın en altına inin:
   - **Veri Çıkışı (Data Out):** `AÇIK (ON)`
   - **Veri Çıkışı IP Adresi (Data Out IP Address):** `Bilgisayarınızın Yerel IP Adresi` *(Örn: 192.168.1.x)* veya aynı PC'de ise `127.0.0.1`
   - **Veri Çıkışı IP Bağlantı Noktası (Data Out IP Port):** `5300`
3. Ayarları kaydedin ve yarışa başlayın!

---

## 🧪 Oyun Olmadan Test Etme (Simülatör)

Oyunu açmadan dashboard'u test etmek isterseniz terminalden simülatörü çalıştırabilirsiniz:
```bash
npm run sim
```

---

## 🛠️ Kullanılan Teknolojiler

- **Backend:** Node.js, `dgram` (UDP Socket 60Hz), `ws` (WebSocket), `http`, `qrcode`
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (WebSocket Client, Canvas/Animations, WakeLock API, Vibration API)

---

## 📄 Lisans
Bu proje [MIT](LICENSE) lisansı ile korunmaktadır.
