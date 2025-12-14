const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios'); 

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// --- CẤU HÌNH NGƯỠNG ---
const TEMP_LIMIT = 31; 
const FIRE_LIMIT = 33; 
const GAS_LIMIT = 1500;
const RAIN_DETECTED = 1;

// --- CẤU HÌNH API THỜI TIẾT ---
const WEATHER_API_KEY = '31e0334beffad83dfda8b665003245bc'; 
const CITY = 'Ho Chi Minh, VN'; 
const WEATHER_URL = `http://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${WEATHER_API_KEY}&units=metric&lang=vi`;

// --- DATABASE TRONG RAM ---
let db = {
    temp: 0, humid: 0, gas: 0, rain: 0, image: "",
    
    controls: { 
        fan: 0,     // Quạt
        servo: 0,   // Mái che
        led: 0,     // Đèn 1 (GPIO 5) - Báo Gas hoặc Nhiệt độ > 35
        led2: 0     // Đèn 2 (GPIO 15) - Báo Cháy (Nhiệt độ > 50)
    },
    
    // Trạng thái cảnh báo để Web hiển thị
    alerts: { 
        gasDanger: false, 
        rainDanger: false, 
        fireDanger: false // Cảnh báo cháy
    },
    
    weatherOnline: { temp: "--", desc: "Đang tải...", icon: "" },
    lastUpdate: Date.now()
};

// --- HÀM LẤY THỜI TIẾT ---
const fetchWeather = async () => {
    try {
        if (WEATHER_API_KEY.startsWith('Y')) return; 
        const response = await axios.get(WEATHER_URL);
        const data = response.data;
        db.weatherOnline = {
            temp: Math.round(data.main.temp),
            desc: data.weather[0].description, 
            icon: `http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
        };
        console.log(`☁️ Weather updated: ${db.weatherOnline.temp}°C`);
    } catch (error) {
        console.error("❌ Weather Error:", error.message);
    }
};
fetchWeather();
setInterval(fetchWeather, 15 * 60 * 1000);

// --- API NHẬN DỮ LIỆU TỪ ESP32 ---
app.post('/api/update', (req, res) => {
    const { temp, humid, gas, rain, image } = req.body;
    
    if (temp !== undefined) db.temp = temp;
    if (humid !== undefined) db.humid = humid;
    if (gas !== undefined) db.gas = gas;
    if (rain !== undefined) db.rain = rain;
    if (image !== undefined) db.image = image;
    
    db.lastUpdate = Date.now();

    // ================= XỬ LÝ LOGIC TỰ ĐỘNG =================

    // 1. Logic Mưa
    if (db.rain == RAIN_DETECTED) {
        db.controls.servo = 1;
        db.alerts.rainDanger = true;
    } else {
        db.controls.servo = 0;
        db.alerts.rainDanger = false;
    }

    // 2. Logic Nhiệt độ & Cháy
    // Mặc định tắt hết trước khi check
    let triggerFan = 0;
    let triggerLed1 = 0; // GPIO 5
    let triggerLed2 = 0; // GPIO 15
    let triggerFireAlert = false;

    if (db.temp > FIRE_LIMIT) {
        // TRƯỜNG HỢP > 50 độ: Báo cháy, bật TẤT CẢ
        triggerFireAlert = true;
        triggerFan = 1;
        triggerLed1 = 1;
        triggerLed2 = 1;
    } else if (db.temp > TEMP_LIMIT) {
        // TRƯỜNG HỢP > 35 độ và <= 50: Bật quạt, báo 1 LED
        triggerFireAlert = false;
        triggerFan = 1;
        triggerLed1 = 1;
        triggerLed2 = 0;
    } else {
        // Bình thường
        triggerFireAlert = false;
        triggerFan = 0;
        triggerLed1 = 0;
        triggerLed2 = 0;
    }

    db.controls.fan = triggerFan;
    db.controls.led2 = triggerLed2;
    db.alerts.fireDanger = triggerFireAlert;

    // 3. Logic Khí Ga (Kết hợp với LED 1)
    // LED 1 (GPIO 5) sẽ sáng nếu: (Gas quá mức) HOẶC (Nhiệt độ > 35)
    if (db.gas > GAS_LIMIT) {
        db.alerts.gasDanger = true;
        db.controls.led = 1; // Bắt buộc bật LED 1
    } else {
        db.alerts.gasDanger = false;
        // Nếu không có Gas, thì LED 1 lấy trạng thái từ nhiệt độ bên trên
        db.controls.led = triggerLed1; 
    }

    res.json({ success: true, controls: db.controls });
});

// --- API LẤY DỮ LIỆU ---
app.get('/api/data', (req, res) => {
    const isOnline = (Date.now() - db.lastUpdate) < 15000;
    res.json({ ...db, isOnline });
});

// --- API ĐIỀU KHIỂN THỦ CÔNG ---
app.post('/api/control', (req, res) => {
    const { device, status } = req.body;
    if (db.controls[device] !== undefined) {
        db.controls[device] = parseInt(status);
    }
    res.json({ success: true, controls: db.controls });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));