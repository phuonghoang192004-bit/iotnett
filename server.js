// FILE server.js (CẬP NHẬT MỚI)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// CẤU HÌNH NGƯỠNG
const TEMP_LIMIT = 35;
const GAS_LIMIT = 2000;
const RAIN_DETECTED = 1;

// Database phải khớp với Web
let db = {
    temp: 0, humid: 0, gas: 0, rain: 0, image: "",
    controls: { fan: 0, servo: 0 },
    // 👇 PHẢI CÓ DÒNG NÀY (Web mới cần cái này để hiển thị đèn báo)
    alerts: { gasDanger: false, rainDanger: false },
    lastUpdate: Date.now()
};

app.post('/api/update', (req, res) => {
    const { temp, humid, gas, rain, image } = req.body;
    
    // Cập nhật dữ liệu
    if (temp !== undefined) db.temp = temp;
    if (humid !== undefined) db.humid = humid;
    if (gas !== undefined) db.gas = gas;
    if (rain !== undefined) db.rain = rain;
    if (image !== undefined) db.image = image;
    
    db.lastUpdate = Date.now();

    // LOGIC TỰ ĐỘNG
    // 1. Mưa -> Thu sào (Servo 180)
    if (db.rain == RAIN_DETECTED) {
        db.controls.servo = 1;
        db.alerts.rainDanger = true;
    } else {
        db.controls.servo = 0;
        db.alerts.rainDanger = false;
    }

    // 2. Ga -> Báo động
    if (db.gas > GAS_LIMIT) {
        db.alerts.gasDanger = true;
    } else {
        db.alerts.gasDanger = false;
    }

    // 3. Nóng -> Bật quạt
    if (db.temp > TEMP_LIMIT) {
        db.controls.fan = 1;
    } else {
        db.controls.fan = 0;
    }

    res.json({ success: true, controls: db.controls });
});

app.get('/api/data', (req, res) => {
    // Nếu quá 15s không nhận tin từ ESP32 -> Offline
    const isOnline = (Date.now() - db.lastUpdate) < 15000;
    res.json({ ...db, isOnline });
});

app.post('/api/control', (req, res) => {
    const { device, status } = req.body;
    if (db.controls[device] !== undefined) db.controls[device] = parseInt(status);
    res.json({ success: true, controls: db.controls });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server updated port ${PORT}`));